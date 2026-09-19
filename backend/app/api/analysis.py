import re
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import User, File as FileModel, AnalysisSession, AnalysisMessage, Sheet, AnalysisHistory
from app.schemas.schemas import (
    AnalysisSessionCreate,
    AnalysisSessionResponse,
    AnalysisMessageCreate,
    AnalysisMessageResponse,
    InlineStatisticsRequest,
    InlineStatisticsResponse,
    InlineChartRequest,
    InlineChartsResponse,
    ChatRequest,
    ChatResponse,
)
from app.utils.security import get_current_user
from app.services.excel_service import parse_excel, read_excel_data
from app.services.stats_service import calculate_statistics, calculate_full_statistics
from app.services.chart_service import generate_inline_charts
from app.services.ai_service import (
    build_rich_context,
    build_automatic_analysis,
    call_ai_api,
    parse_chart_request,
)
from app.services.data_analysis_tools import execute_tool, TOOLS_MAP

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _parse_and_execute_tools(df: pd.DataFrame, ai_response: str) -> list:
    tool_pattern = r"CALC:(\w+):(\{[^}]+\})"
    matches = re.findall(tool_pattern, ai_response)
    results = []

    for tool_name, params_str in matches:
        try:
            import json
            params = json.loads(params_str)
            result = execute_tool(df, tool_name, params)
            results.append({"tool": tool_name, "params": params, "result": result})
        except Exception:
            results.append({"tool": tool_name, "params": params_str, "result": {"error": "Failed to parse"}})

    return results


def _load_dataframe(db_file: FileModel, sheet_name: str = None):
    parsed = parse_excel(db_file.file_path)

    target_sheet = sheet_name
    if not target_sheet and parsed["sheets"]:
        target_sheet = parsed["sheets"][0]["name"]

    if not target_sheet:
        return None, None, None, None

    sheet_info = next((s for s in parsed["sheets"] if s["name"] == target_sheet), None)
    if not sheet_info:
        return None, None, None, None

    import os
    ext = os.path.splitext(db_file.file_path)[1].lower()
    if ext == ".csv":
        df = pd.read_csv(db_file.file_path)
    else:
        df = pd.read_excel(db_file.file_path, sheet_name=target_sheet)
    col_types = sheet_info.get("column_types", {})

    return df, col_types, target_sheet, parsed


def _save_analysis_history(
    db: Session,
    user_id: str,
    file_id: str,
    filename: str,
    dataset_version: int | None,
    question: str,
    response: str,
    statistics: dict | None = None,
    charts: dict | None = None,
    dataset_snapshot: dict | None = None,
):
    record = AnalysisHistory(
        user_id=user_id,
        file_id=file_id,
        filename=filename,
        dataset_version=dataset_version,
        analysis_question=question,
        ai_response=response,
        statistics_snapshot=statistics,
        chart_config=charts,
        dataset_snapshot=dataset_snapshot,
    )
    db.add(record)
    db.commit()


@router.post("/{file_id}/sessions", response_model=AnalysisSessionResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    file_id: str,
    body: AnalysisSessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_file = (
        db.query(FileModel)
        .filter(FileModel.id == file_id, FileModel.user_id == current_user.id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    session = AnalysisSession(
        user_id=current_user.id,
        file_id=file_id,
        title=body.title or "New Analysis",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return AnalysisSessionResponse(
        id=session.id,
        file_id=session.file_id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        message_count=0,
    )


@router.get("/sessions", response_model=list[AnalysisSessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sessions = (
        db.query(AnalysisSession)
        .filter(AnalysisSession.user_id == current_user.id)
        .order_by(AnalysisSession.updated_at.desc())
        .all()
    )
    result = []
    for s in sessions:
        msg_count = db.query(AnalysisMessage).filter(AnalysisMessage.session_id == s.id).count()
        result.append(AnalysisSessionResponse(
            id=s.id,
            file_id=s.file_id,
            title=s.title,
            created_at=s.created_at,
            updated_at=s.updated_at,
            message_count=msg_count,
        ))
    return result


@router.get("/sessions/{session_id}")
def get_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(AnalysisSession)
        .filter(AnalysisSession.id == session_id, AnalysisSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = (
        db.query(AnalysisMessage)
        .filter(AnalysisMessage.session_id == session_id)
        .order_by(AnalysisMessage.created_at)
        .all()
    )

    return {
        "session": AnalysisSessionResponse(
            id=session.id,
            file_id=session.file_id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=len(messages),
        ),
        "messages": [AnalysisMessageResponse.model_validate(m) for m in messages],
    }


@router.post("/sessions/{session_id}/messages", response_model=AnalysisMessageResponse)
def send_message(
    session_id: str,
    body: AnalysisMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(AnalysisSession)
        .filter(AnalysisSession.id == session_id, AnalysisSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db_file = (
        db.query(FileModel)
        .filter(FileModel.id == session.file_id, FileModel.user_id == current_user.id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=404, detail="Associated file not found")

    user_message = AnalysisMessage(
        session_id=session_id,
        role="user",
        content=body.content,
    )
    db.add(user_message)
    db.flush()

    df = None
    full_stats = None

    try:
        df, col_types, sheet_name, parsed = _load_dataframe(db_file)
        if df is None:
            ai_response_text = "Could not load the worksheet. Please check the file."
        else:
            statistics = calculate_statistics(df)
            full_stats = calculate_full_statistics(df)

            file_info = {
                "filename": db_file.original_filename,
                "sheet_name": sheet_name,
            }

            context = build_rich_context(
                df=df,
                column_types=col_types,
                statistics=statistics,
                full_stats=full_stats,
                file_info=file_info,
            )

            chat_history = []
            previous_messages = (
                db.query(AnalysisMessage)
                .filter(AnalysisMessage.session_id == session_id)
                .order_by(AnalysisMessage.created_at)
                .all()
            )
            for msg in previous_messages:
                chat_history.append({"role": msg.role, "content": msg.content})

            ai_response_text = call_ai_api(context, body.content, chat_history, user_id=current_user.id, file_id=db_file.id)

            tool_results = _parse_and_execute_tools(df, ai_response_text)
            if tool_results:
                tool_summary = "\n\n**Calculated Results:**\n"
                for tr in tool_results:
                    if "error" not in tr["result"]:
                        result_val = tr["result"].get("result", tr["result"])
                        tool_summary += f"- {tr['tool']}({tr['params']}): {result_val}\n"
                    else:
                        tool_summary += f"- {tr['tool']}: {tr['result']['error']}\n"
                ai_response_text += tool_summary

    except Exception as e:
        ai_response_text = (
            f"I encountered an error while analyzing your data. "
            "Please make sure the file is a valid Excel document and try again."
        )

    chart_request = parse_chart_request(ai_response_text)

    assistant_message = AnalysisMessage(
        session_id=session_id,
        role="assistant",
        content=ai_response_text,
        metadata_json={"chart_request": chart_request} if chart_request else None,
    )
    db.add(assistant_message)

    msg_count = db.query(AnalysisMessage).filter(AnalysisMessage.session_id == session_id).count()
    if msg_count <= 1:
        session.title = body.content[:100]

    db.commit()
    db.refresh(assistant_message)

    try:
        dataset_snapshot = {
            "columns": list(df.columns) if df is not None else [],
            "row_count": len(df) if df is not None else 0,
        }
        _save_analysis_history(
            db=db,
            user_id=current_user.id,
            file_id=db_file.id,
            filename=db_file.original_filename,
            dataset_version=db_file.dataset_version,
            question=body.content,
            response=ai_response_text,
            statistics={"full_statistics": full_stats} if full_stats is not None else None,
            charts={"chart_request": chart_request} if chart_request else None,
            dataset_snapshot=dataset_snapshot,
        )
    except Exception:
        pass

    return AnalysisMessageResponse.model_validate(assistant_message)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = (
        db.query(AnalysisSession)
        .filter(AnalysisSession.id == session_id, AnalysisSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()


@router.post("/statistics", response_model=InlineStatisticsResponse)
def calculate_inline_statistics(
    body: InlineStatisticsRequest,
    current_user: User = Depends(get_current_user),
):
    if not body.columns:
        raise HTTPException(status_code=400, detail="No columns provided")

    try:
        df = pd.DataFrame(body.rows, columns=body.columns)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create DataFrame: {str(e)}")

    return calculate_full_statistics(df)


@router.post("/charts", response_model=InlineChartsResponse)
def calculate_inline_charts_endpoint(
    body: InlineChartRequest,
    current_user: User = Depends(get_current_user),
):
    if not body.columns:
        raise HTTPException(status_code=400, detail="No columns provided")

    try:
        result = generate_inline_charts(
            columns=body.columns,
            rows=body.rows,
            chart_type=body.chart_type,
            x_column=body.x_column,
            y_column=body.y_column,
            aggregation=body.aggregation,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate charts: {str(e)}")

    return InlineChartsResponse(
        suggestions=result["suggestions"],
        columns=result["columns"],
    )


@router.post("/{file_id}/chat", response_model=ChatResponse)
def chat_with_data(
    file_id: str,
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_file = (
        db.query(FileModel)
        .filter(FileModel.id == file_id, FileModel.user_id == current_user.id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    if body.columns and body.rows is not None:
        df = pd.DataFrame(body.rows, columns=body.columns) if body.columns else pd.DataFrame()
        col_types = {}
        for col in body.columns:
            if df[col].dtype in ("int64", "float64"):
                col_types[col] = "numeric"
            elif df[col].dtype == "bool":
                col_types[col] = "boolean"
            else:
                col_types[col] = "categorical"
        sheet_name = body.sheet_name or "Sheet1"
        file_info = {
            "filename": db_file.original_filename,
            "sheet_name": sheet_name,
        }
    else:
        df, col_types, sheet_name, parsed = _load_dataframe(db_file, body.sheet_name)
        if df is None:
            raise HTTPException(status_code=400, detail="Could not load worksheet")
        file_info = {
            "filename": db_file.original_filename,
            "sheet_name": sheet_name,
        }

    statistics = calculate_statistics(df)
    full_stats = calculate_full_statistics(df)

    context = build_rich_context(
        df=df,
        column_types=col_types,
        statistics=statistics,
        full_stats=full_stats,
        file_info=file_info,
    )

    ai_response_text = call_ai_api(context, body.content, [], user_id=current_user.id, file_id=db_file.id)

    tool_results = _parse_and_execute_tools(df, ai_response_text)
    tool_results_clean = []
    if tool_results:
        for tr in tool_results:
            if "error" not in tr["result"]:
                result_val = tr["result"].get("result", tr["result"])
                ai_response_text += f"\n- {tr['tool']}: {result_val}"
                tool_results_clean.append(tr["result"])

    chart_request = parse_chart_request(ai_response_text)

    dataset_snapshot = {
        "columns": list(df.columns) if df is not None else [],
        "row_count": len(df) if df is not None else 0,
    }

    try:
        _save_analysis_history(
            db=db,
            user_id=current_user.id,
            file_id=db_file.id,
            filename=db_file.original_filename,
            dataset_version=db_file.dataset_version,
            question=body.content,
            response=ai_response_text,
            statistics={"full_statistics": full_stats},
            charts={"chart_request": chart_request} if chart_request else None,
            dataset_snapshot=dataset_snapshot,
        )
    except Exception:
        pass

    return ChatResponse(
        role="assistant",
        content=ai_response_text,
        chart_request=chart_request,
        tool_results=tool_results_clean if tool_results_clean else None,
    )


@router.post("/{file_id}/analyze")
def auto_analyze_dataset(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_file = (
        db.query(FileModel)
        .filter(FileModel.id == file_id, FileModel.user_id == current_user.id)
        .first()
    )
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    df, col_types, sheet_name, parsed = _load_dataframe(db_file)
    if df is None:
        raise HTTPException(status_code=400, detail="Could not load worksheet")

    statistics = calculate_statistics(df)
    full_stats = calculate_full_statistics(df)

    file_info = {
        "filename": db_file.original_filename,
        "sheet_name": sheet_name,
    }

    data_context = build_automatic_analysis(
        df=df,
        column_types=col_types,
        statistics=statistics,
        full_stats=full_stats,
    )

    system_prompt = """You are an expert data analyst. Provide a comprehensive, structured analysis of the dataset.

Format your analysis with clear sections using markdown:
1. **Dataset Overview** - Summary of what the dataset contains
2. **Key Statistics** - Important numbers for each column
3. **Important Trends** - Notable patterns in the data
4. **Highest/Lowest Values** - Key extremes
5. **Missing Data Analysis** - What data is missing and implications
6. **Outliers** - Any unusual values detected
7. **Correlations** - Relationships between numeric columns
8. **Key Insights** - Main takeaways (3-5 bullet points)
9. **Areas Requiring Attention** - Data quality issues or anomalies

Use specific numbers from the data. Be factual. Do not invent information.
Respond in the same language as the dataset context suggests (English or Bahasa Melayu)."""

    context = f"{data_context}\n\nPlease provide a comprehensive analysis of this dataset."
    ai_response = call_ai_api(context, "Provide a comprehensive analysis of this dataset.", [], system_prompt=system_prompt, user_id=current_user.id, file_id=db_file.id)

    dataset_snapshot = {
        "columns": list(df.columns) if df is not None else [],
        "row_count": len(df) if df is not None else 0,
    }

    try:
        _save_analysis_history(
            db=db,
            user_id=current_user.id,
            file_id=db_file.id,
            filename=db_file.original_filename,
            dataset_version=db_file.dataset_version,
            question="Analyze this dataset",
            response=ai_response,
            statistics={"full_statistics": full_stats},
            charts=None,
            dataset_snapshot=dataset_snapshot,
        )
    except Exception:
        pass

    return {"analysis": ai_response, "sheet_name": sheet_name}
