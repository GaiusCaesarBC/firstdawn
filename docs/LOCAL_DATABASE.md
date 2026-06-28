# Local Database

First Dawn uses PostgreSQL through Prisma. For local development, create a dedicated database named `first_dawn_dev`.

## Install PostgreSQL

If PostgreSQL is not installed, install PostgreSQL for Windows from the official installer:

```text
https://www.postgresql.org/download/windows/
```

During installation, include the command line tools and remember the password you choose for the `postgres` user. Do not use production database credentials for local development.

Common Windows install paths are:

```text
C:\Program Files\PostgreSQL\16\bin
C:\Program Files\PostgreSQL\17\bin
C:\Program Files\PostgreSQL\18\bin
```

You can use `psql.exe` and `createdb.exe` from those folders directly without changing your global PATH.

## Connection String

Use this local development `DATABASE_URL` format:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/first_dawn_dev?schema=public"
```

Put the real value in a local `.env` file at the project root:

```text
C:\Users\2cody\Documents\First Dawn\.env
```

Do not commit `.env`. It can contain private credentials, and local development should never use production database credentials.

## Start PostgreSQL

If PostgreSQL is installed as a Windows service but stopped, start it from Services or PowerShell. Common service names are:

```text
postgresql-x64-16
postgresql-x64-17
postgresql-x64-18
```

PowerShell examples:

```powershell
Start-Service postgresql-x64-16
Start-Service postgresql-x64-17
Start-Service postgresql-x64-18
```

## Create the Database

If PostgreSQL is installed locally and the `postgres` role exists, create the development database with:

```powershell
createdb -U postgres -h localhost -p 5432 first_dawn_dev
```

If `createdb` is not available but `psql` is, use:

```powershell
psql -U postgres -h localhost -p 5432 -c "CREATE DATABASE first_dawn_dev;"
```

If the database already exists, continue with the migration.

## Verify Prisma Can Connect

From the project root, run:

```powershell
npx prisma validate
```

Then run the initial migration:

```powershell
npm run prisma:migrate -- --name init_world_lifecycle
```

Seed the initial worlds:

```powershell
npm run world:seed
```

Verify the seeded worlds:

```powershell
npm run world:verify
```