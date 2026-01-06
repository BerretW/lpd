@echo off
echo Nastavuji Frontend...

if not exist venv (
    python -m venv venv
)

call venv\Scripts\activate.bat

:: Pokud nemas requirements, vytvorime je
if not exist requirements.txt (
    echo flask > requirements.txt
    echo requests >> requirements.txt
    echo python-dotenv >> requirements.txt
)

pip install -r requirements.txt

:: Konfigurace pro spojeni s backendem
set "FLASK_APP=main.py"
set "FLASK_ENV=development"
set "BACKEND_URL=http://127.0.0.1:8000"
set "SECRET_KEY=nejake-tajne-heslo-pro-session"

flask run --host=127.0.0.1 --port=5000