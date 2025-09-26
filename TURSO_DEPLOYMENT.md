# Turso Deployment Guide

## Overview
Your app now uses Turso (SQLite) for persistent data storage that works across instance restarts.

## Local Development (Already Working!)
- **Database**: Local SQLite file (`local.db`)  
- **Setup**: Zero configuration needed
- **Data**: Persists between restarts
- **Reset**: Delete `local.db` file to reset data

## Production Setup (Render + Turso Cloud)

### 1. Create Turso Account & Database
```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Create account (if needed)
turso auth signup

# Create your database
turso db create vocabpractice

# Get database URL
turso db show vocabpractice

# Create auth token
turso db tokens create vocabpractice
```

### 2. Configure Render Environment Variables
In your Render dashboard, set these environment variables:

```
NODE_ENV=production
DATABASE_URL=libsql://vocabpractice-[your-org].turso.io
TURSO_AUTH_TOKEN=your-generated-token
```

### 3. Deploy to Render
Push your code to Git - Render will automatically:
- Use Turso cloud database (persistent)
- Run database migrations
- Your data will persist across restarts!

## Environment Behavior

| Environment | Database | Configuration Required |
|-------------|----------|----------------------|
| **Local Dev** | SQLite file (`local.db`) | None |
| **Production** | Turso Cloud | `DATABASE_URL` + `TURSO_AUTH_TOKEN` |

## Troubleshooting

### Local Development Issues
- **No data persisting**: Check if `local.db` exists in project root
- **Schema errors**: Run `npm run db:push` to update local database

### Production Issues
- **Data not persisting**: Verify `DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in Render
- **Connection errors**: Check Turso database exists and token is valid

## Migration from Current Setup
Your existing in-memory data will be lost (expected). After deployment:
1. Users will need to recreate their sessions
2. Settings will reset to defaults
3. All future data will persist properly

## Costs
- **Turso Free Tier**: 500 databases, 9GB storage, 1B row reads
- **Render Free Tier**: Compatible
- **Total cost**: $0 for typical usage

## Database Management
```bash
# Connect to production database
turso db shell vocabpractice

# View tables
.tables

# Query sessions
SELECT * FROM sessions;

# Backup database (optional)
turso db dump vocabpractice --output backup.sql
```
