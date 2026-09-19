# Excel AI Analyzer

AI-powered Excel data analysis platform with real-time chat, live statistics, interactive charts, and collaborative editing.

## Features

- **File Upload & Management**: Upload Excel (.xlsx, .xls) and CSV files with version tracking
- **Live Spreadsheet Editor**: AG Grid-based editor with undo/redo, cell formatting, formula support
- **AI Chat**: Ask questions about your data, get AI-powered insights via Gemini API
- **Advanced AI Analysis**: Auto-profiling, smart insights, trend detection, anomaly detection, forecasting, group comparison, chart recommendations, report generation
- **Real-time Statistics**: Dynamic statistics that update as you edit data
- **Interactive Charts**: Auto-generated bar, line, pie, scatter, and box charts
- **Data Synchronization**: Multi-user version conflict detection and resolution
- **Analysis History**: Track and review past analysis sessions with search and re-analysis
- **Admin Panel**: User management, dataset monitoring, AI usage tracking, system health, audit logs
- **Responsive UI**: Works on desktop and mobile devices

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12+, FastAPI, SQLAlchemy, SQLite/MySQL |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS v4 |
| Data Grid | AG Grid Community Edition |
| Charts | Recharts |
| AI | Google Gemini API |

---

## Local Development Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- Gemini API key (optional, for AI features)

### 1. Clone and Configure

```bash
cd excel-ai-analyzer
cp .env.example backend/.env
# Edit backend/.env with your settings (JWT_SECRET is the only required change)
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv

# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Start Development Servers

**Terminal 1 - Backend** (port 8000):
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend** (port 3000):
```bash
cd frontend
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Production Deployment

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `DATABASE_URL` | No | Full MySQL connection string | (uses SQLite) |
| `DB_HOST` | No | MySQL hostname | `localhost` |
| `DB_PORT` | No | MySQL port | `3306` |
| `DB_NAME` | No | MySQL database name | `excel_ai_analyzer` |
| `DB_USER` | No | MySQL username | `root` |
| `DB_PASSWORD` | No | MySQL password | (empty) |
| `JWT_SECRET` | **Yes** | Secret key for JWT signing | (must change) |
| `JWT_ALGORITHM` | No | JWT algorithm | `HS256` |
| `JWT_EXPIRY_HOURS` | No | Token expiry in hours | `72` |
| `AI_API_KEY` | No | Google Gemini API key | (empty) |
| `AI_MODEL` | No | AI model name | `gemini-2.0-flash` |
| `FRONTEND_URL` | **Yes** | Frontend domain for CORS | `http://localhost:3000` |
| `BACKEND_URL` | No | Backend URL | `http://localhost:8000` |
| `ENVIRONMENT` | No | `production` or `development` | `development` |

### Frontend Environment Variables

Create `frontend/.env.local` for development or set in hosting platform:

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://api.your-domain.com` |

### Production Build

**Frontend:**
```bash
cd frontend
NEXT_PUBLIC_API_URL=https://api.your-domain.com npm run build
npm start
```

**Backend:**
```bash
cd backend
ENVIRONMENT=production uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### MySQL Production Database

1. Create the database:
```sql
CREATE DATABASE excel_ai_analyzer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Create a dedicated user:
```sql
CREATE USER 'excel_app'@'%' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON excel_ai_analyzer.* TO 'excel_app'@'%';
FLUSH PRIVILEGES;
```

3. Set environment variables:
```
DATABASE_URL=mysql+pymysql://excel_app:secure_password_here@your-mysql-host:3306/excel_ai_analyzer
```

Tables are created automatically on first startup.

### Deployment Architecture

```
User Browser
      |
      v
Frontend (Vercel / Netlify / Static)
      |
      v
Backend API (Render / Railway / VPS)
      |
      +---> MySQL Database (PlanetScale / AWS RDS / DigitalOcean)
      |
      +---> File Storage (local disk / S3-compatible)
      |
      +---> Gemini AI API (external)
```

### Recommended Hosting

| Component | Options |
|-----------|---------|
| Frontend | Vercel, Netlify, Cloudflare Pages |
| Backend | Render, Railway, Fly.io, VPS (DigitalOcean, Linode) |
| Database | PlanetScale, AWS RDS, DigitalOcean Managed MySQL |

### CORS Configuration

CORS is configured via `FRONTEND_URL`. In production:
- Set `FRONTEND_URL=https://your-domain.com`
- Only this domain can make authenticated requests
- Swagger docs are disabled in production (`ENVIRONMENT=production`)

### HTTPS

Deploy behind a reverse proxy (Nginx, Caddy) or use a platform that provides HTTPS automatically (Render, Vercel). The application works correctly behind reverse proxies.

---

## API Endpoints

### Health Check
- `GET /api/health` - Returns `{"status": "ok", "database": "connected", "version": "1.0.0"}`

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files` - List files
- `GET /api/files/{id}` - Get file details
- `PUT /api/files/{id}` - Rename file
- `DELETE /api/files/{id}` - Delete file
- `GET /api/files/{id}/data` - Read paginated data
- `PUT /api/files/{id}/data` - Update data
- `PUT /api/files/{id}/data/save` - Save with version conflict detection
- `DELETE /api/files/{id}/data/discard` - Discard changes
- `GET /api/files/{id}/version` - Get dataset version
- `POST /api/files/{id}/recalculate` - Recalculate statistics
- `GET /api/files/{id}/statistics` - Get full statistics
- `GET /api/files/{id}/charts` - Get chart configurations
- `GET /api/files/{id}/download` - Download file

### Analysis
- `POST /api/analysis/{file_id}/sessions` - Create analysis session
- `GET /api/analysis/sessions` - List sessions
- `POST /api/analysis/sessions/{id}/messages` - Send message
- `POST /api/analysis/{file_id}/chat` - Direct chat with file
- `POST /api/analysis/{file_id}/analyze` - Auto-analyze dataset

### History
- `POST /api/history` - Create history entry
- `GET /api/history` - List history
- `GET /api/history/{id}` - Get history entry
- `DELETE /api/history/{id}` - Delete history entry

### Advanced Analysis
- `POST /api/analysis/{file_id}/profile` - Auto-profile dataset
- `POST /api/analysis/{file_id}/insights` - Generate smart insights
- `POST /api/analysis/{file_id}/trends` - Detect trends
- `POST /api/analysis/{file_id}/compare` - Compare groups
- `POST /api/analysis/{file_id}/top-bottom` - Top/bottom N values
- `POST /api/analysis/{file_id}/anomalies` - Detect outliers
- `POST /api/analysis/{file_id}/forecast` - Simple forecasting
- `POST /api/analysis/{file_id}/chart-recommend` - Chart recommendations
- `POST /api/analysis/{file_id}/report` - Generate full report
- `POST /api/analysis/{file_id}/explain` - Explain analysis
- `POST /api/analysis/{file_id}/ask` - Natural language Q&A

### Admin (requires admin role)
- `GET /api/admin/dashboard` - Admin dashboard counts
- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/{id}/role` - Change user role
- `PUT /api/admin/users/{id}/toggle-active` - Enable/disable user
- `GET /api/admin/datasets` - List all datasets
- `DELETE /api/admin/datasets/{id}` - Delete dataset
- `GET /api/admin/analyses` - List all analyses
- `GET /api/admin/usage` - AI usage records
- `GET /api/admin/logs` - System audit logs
- `GET /api/admin/health` - System health status

---

## Security

- API keys are never exposed to the frontend
- CORS restricted to configured `FRONTEND_URL`
- JWT authentication on all private endpoints
- Passwords hashed with bcrypt
- File upload validation (extension, size, MIME type)
- User data isolation (users can only access their own files)
- Path traversal protection on file storage
- Admin endpoints require admin role (enforced server-side)
- Production error handlers hide internal details
- Swagger/ReDoc disabled in production
- Request logging middleware for audit trail

---

## Backup Procedure

### Database Backup (MySQL)
```bash
mysqldump -u excel_app -p excel_ai_analyzer > backup_$(date +%Y%m%d).sql
```

### Database Restore (MySQL)
```bash
mysql -u excel_app -p excel_ai_analyzer < backup_20260919.sql
```

### File Storage Backup
```bash
# Backup uploaded files
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz backend/storage/uploads/
```

### Full Backup
```bash
# Database
mysqldump -u excel_app -p excel_ai_analyzer > db_backup.sql

# Files
tar -czf files_backup.tar.gz backend/storage/uploads/

# Configuration (DO NOT include .env with secrets in unencrypted backups)
cp backend/.env config_backup.env
```

---

## Testing

```bash
cd backend
python -m pytest tests/ -v
```

232 tests covering auth, files, statistics, AI chat, synchronization, admin, advanced analysis, and end-to-end workflows.

---

## Project Structure

```
excel-ai-analyzer/
├── backend/
│   ├── app/
│   │   ├── api/           # API route handlers (auth, files, analysis, history, admin, advanced)
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic schemas (main + advanced)
│   │   ├── services/      # Business logic (ai, excel, stats, chart, advanced_analysis)
│   │   ├── utils/         # Security, helpers
│   │   ├── config.py      # Settings
│   │   ├── database.py    # Database connection
│   │   └── main.py        # FastAPI app
│   ├── tests/             # Test suite (232 tests)
│   ├── storage/uploads/   # Uploaded files
│   ├── requirements.txt
│   └── .env               # Environment variables (gitignored)
├── frontend/
│   ├── app/               # Next.js pages (dashboard, auth, admin/*, history)
│   ├── components/        # React components (30+ components)
│   ├── lib/               # API client, utilities (api.ts, formulaEngine, history, utils)
│   ├── types/             # TypeScript interfaces
│   ├── .env.local         # Local environment (gitignored)
│   └── package.json
├── database/
│   └── schema.sql         # MySQL schema reference
├── .env.example           # Environment template
├── .gitignore
├── BACKUP.md              # Backup and recovery guide
└── README.md
```
