@echo off
if not exist venv (
    python -m venv venv
    if %errorlevel% neq 0 (
        pause
        exit /b %errorlevel%
    )
    
)

call venv\Scripts\activate.bat
pip install -r requirements.txt
if %errorlevel% neq 0 (
    
    pause
    exit /b %errorlevel%
)

set "DATABASE_URL=mysql+asyncmy://root:1234@localhost:3306/database"

set "JWT_SECRET=super-tajny-klic-pro-lokalni-vyvoj"
set "JWT_EXPIRE_MINUTES=120"


uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause