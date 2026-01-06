@echo off
echo Nastavuji Backend...

if not exist venv (
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -r requirements.txt

:: Nastaveni ENV pro lokalni Windows (DB bezi jinde/lokalne)
set "DATABASE_URL=mysql+asyncmy://root:1234@localhost:3306/database"
set "JWT_SECRET=super-tajny-klic-pro-lokalni-vyvoj"
set "JWT_EXPIRE_MINUTES=120"
set "ENCRYPTION_KEY=NrZeCmjkQxYWtsTEuKRFUZj8TLeivWvnCe4WXyo8Mk4="

uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload