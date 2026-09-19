# Backup & Recovery Guide

## Overview

This guide covers backing up and restoring the Excel AI Analyzer system, including the database, uploaded files, and configuration.

---

## 1. Database Backup (MySQL)

### Automated Backup Script

Create a backup script (e.g., `backup.sh` or `backup.bat`):

```bash
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Keep only last 30 days of backups
find $BACKUP_DIR -name "db_*.sql" -mtime +30 -delete

echo "Database backup completed: db_$DATE.sql"
```

### Manual Backup

```bash
mysqldump -u excel_app -p excel_ai_analyzer > backup_$(date +%Y%m%d).sql
```

### Restore

```bash
mysql -u excel_app -p excel_ai_analyzer < backup_20260919.sql
```

---

## 2. File Storage Backup

Uploaded files are stored in `backend/storage/uploads/`.

### Backup

```bash
tar -czf uploads_$(date +%Y%m%d).tar.gz backend/storage/uploads/
```

### Restore

```bash
tar -xzf uploads_20260919.tar.gz
```

---

## 3. Configuration Backup

### Environment Variables

```bash
cp backend/.env backup_config.env
```

**WARNING**: Do NOT commit `.env` files to version control or share them unencrypted. They contain JWT_SECRET and AI_API_KEY.

---

## 4. Full System Backup

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/full_$DATE"
mkdir -p $BACKUP_DIR

# Database
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > $BACKUP_DIR/database.sql

# Files
tar -czf $BACKUP_DIR/uploads.tar.gz backend/storage/uploads/

# Config (redact secrets)
cp .env.example $BACKUP_DIR/env_template.env

echo "Full backup completed: $BACKUP_DIR"
```

---

## 5. Automated Backups (Cron)

Add to crontab (`crontab -e`):

```bash
# Daily backup at 2 AM
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

---

## 6. What to Back Up

| Component | Location | Frequency |
|-----------|----------|-----------|
| MySQL database | All tables | Daily |
| Uploaded files | `backend/storage/uploads/` | Daily |
| Environment config | `backend/.env` | When changed |

## 7. What NOT to Back Up

- `node_modules/` directories
- `__pycache__/` directories
- `.env` files in unencrypted form (redact secrets)
- Test databases (`backend/test.db`)
- `.pytest_cache/`
