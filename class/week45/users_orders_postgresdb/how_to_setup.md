# 🏃 How to Run the Flask + PostgreSQL App

## ✅ Prerequisites

- Python 3.8+
- PostgreSQL installed and running
- `psycopg2-binary` installed
- `flask` and `flask_sqlalchemy` installed

You can install dependencies using pip:

```bash
pip install flask flask_sqlalchemy psycopg2-binary

Create the Database
Access the PostgreSQL shell:

```bash
psql -U postgres
Then run:

CREATE DATABASE testdb;
\q


## Common psql commands
1. START brew services start postgresql
2. STOP brew services stop postgresql
3. Enter postgres terminal:
    Open your terminal and enter the PostgreSQL shell:
    Run psql postgres
    Check check existing roles with \du
4. Create user if it doesn't exist
    Run createuser -s postgres
    Set password psql -U postgres
    Run \password
    Enter password and confirm

## Create postgres user on mac
1. Go to terminal and run psql postgres
2. Run CREATE ROLE postgres WITH LOGIN SUPERUSER PASSWORD 'postgres';
3. Confirm with \du

## Create the testdb Database
1. Enter PostgreSQL Shell - Use the role you created (e.g., postgres):
 Run psql -U postgres
2. Create the Database: At the psql prompt, run:
    Run CREATE DATABASE testdb;
    Quit by \q