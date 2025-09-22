# PostgreSQL Database Setup Guide

## Option 1: Install PostgreSQL Locally (Recommended for Development)

### Windows Installation:

1. **Download PostgreSQL**:
   - Go to https://www.postgresql.org/download/windows/
   - Download the installer for PostgreSQL 15 or 16
   - Run the installer as Administrator

2. **Installation Settings**:
   - Port: 5432 (default)
   - Superuser password: Choose a secure password (remember this!)
   - Locale: Default locale

3. **Create Database and User**:
   After installation, open "SQL Shell (psql)" and run:
   ```sql
   -- Connect as postgres superuser
   CREATE DATABASE kse_shopify;
   CREATE USER kse_user WITH PASSWORD 'your_secure_password';
   GRANT ALL PRIVILEGES ON DATABASE kse_shopify TO kse_user;
   \q
   ```

## Option 2: Use Docker (Alternative)

If you have Docker installed:

```bash
# Run PostgreSQL in Docker
docker run --name kse-postgres \
  -e POSTGRES_DB=kse_shopify \
  -e POSTGRES_USER=kse_user \
  -e POSTGRES_PASSWORD=your_secure_password \
  -p 5432:5432 \
  -d postgres:15

# Check if it's running
docker ps
```

## Option 3: Use Cloud Database (Production Ready)

### Supabase (Free Tier Available):
1. Go to https://supabase.com
2. Create a new project
3. Get connection details from Settings > Database
4. Use the connection string in your `.env`

### Railway:
1. Go to https://railway.app
2. Create new project
3. Add PostgreSQL service
4. Get connection details from Variables tab

## Your .env Configuration

Once you have PostgreSQL running, update your `.env` file:

```env
# For Local PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=kse_user
DB_PASSWORD=your_secure_password
DB_DATABASE=kse_shopify
DB_SYNCHRONIZE=true
DB_LOGGING=true

# For Cloud Database (replace with your actual values)
# DB_HOST=your-cloud-host
# DB_PORT=5432
# DB_USERNAME=your-username
# DB_PASSWORD=your-password
# DB_DATABASE=your-database
```

## Test Connection

After setup, test the connection:

```bash
# If using local PostgreSQL
psql -h localhost -U kse_user -d kse_shopify

# If using Docker
docker exec -it kse-postgres psql -U kse_user -d kse_shopify
```

## Next Steps

Once PostgreSQL is set up and your `.env` file is configured:
1. We'll create the database entities
2. Set up the TypeORM configuration
3. Test the connection with your NestJS app

**Recommendation**: For development, use **Option 1 (Local Installation)** as it's the most straightforward and gives you full control.
