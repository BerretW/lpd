import os
import requests
from flask import Flask, render_template, request, redirect, url_for, session, flash
from jose import jwt

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "dev-secret-123")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

def get_all_tenants():
    """Získá ID firem z tokenu."""
    token = session.get("token")
    if not token: return []
    payload = jwt.get_unverified_claims(token)
    return payload.get("tenants", [])

@app.context_processor
def inject_companies():
    """Umožní v každé šabloně vypsat seznam firem uživatele."""
    return dict(user_tenants=get_all_tenants())

@app.route("/switch-company/<int:company_id>")
def switch_company(company_id):
    if company_id in get_all_tenants():
        session["active_company_id"] = company_id
        flash(f"Přepnuto na firmu ID {company_id}", "info")
    return redirect(url_for("locations"))

# --- PROFIL ---
@app.route("/profile", methods=["GET", "POST"])
def profile():
    if "token" not in session: return redirect(url_for("login"))
    
    if request.method == "POST":
        new_email = request.form.get("email")
        resp = api_call("PATCH", "/users/me", data={"email": new_email})
        if resp and resp.status_code == 200:
            session["user_email"] = new_email
            flash("Email úspěšně změněn. Při příštím přihlášení použijte nový email.", "success")
        else:
            flash("Změna se nezdařila.", "danger")
            
    return render_template("profile.html")

# --- ZALOŽENÍ FIRMY ---
@app.route("/companies/new", methods=["GET", "POST"])
def create_company():
    if "token" not in session: return redirect(url_for("login"))
    
    if request.method == "POST":
        data = {
            "company_name": request.form.get("name"),
            "slug": request.form.get("name").lower().replace(" ", "-"),
            "admin_email": session["user_email"],
            "admin_password": "SKIP" # Backend by měl být upraven, aby pro existujícího uživatele heslo neřešil
        }
        # Poznámka: register_company endpoint vytvoří firmu i membership
        resp = api_call("POST", "/auth/register_company", data=data)
        if resp and resp.status_code == 201:
            flash("Firma vytvořena! Znovu se přihlaste pro aktualizaci oprávnění.", "success")
            return redirect(url_for("logout"))
            
    return render_template("create_company.html")

@app.route("/locations/create", methods=["POST"])
def create_location():
    if "token" not in session:
        return redirect(url_for("login"))
    
    company_id = session.get("active_company_id")
    if not company_id:
        flash("Nejdříve vyberte nebo založte firmu v horním menu!", "warning")
        return redirect(url_for("locations"))

    # Data z formuláře
    name = request.form.get("name")
    description = request.form.get("description")

    # Volání API backendu
    resp = api_call("POST", f"/companies/{company_id}/locations", data={
        "name": name,
        "description": description
    })

    if resp and resp.status_code == 201:
        flash(f"Sklad '{name}' byl úspěšně vytvořen.", "success")
    else:
        error_msg = "Nepodařilo se vytvořit sklad."
        if resp:
            try:
                error_msg = resp.json().get("detail", error_msg)
            except: pass
        flash(f"Chyba: {error_msg}", "danger")

    return redirect(url_for("locations"))

# Pomocná funkce pro dekódování tokenu a získání ID firmy
def get_company_id():
    token = session.get("token")
    if not token:
        return None
    try:
        payload = jwt.get_unverified_claims(token)
        tenants = payload.get("tenants", [])
        return tenants[0] if tenants else None
    except Exception:
        return None

# Pomocná funkce pro API volání
def api_call(method, endpoint, data=None, is_json=True):
    headers = {}
    if "token" in session:
        headers["Authorization"] = f"Bearer {session['token']}"
    
    url = f"{BACKEND_URL}{endpoint}"
    try:
        if method == "POST":
            if is_json:
                return requests.post(url, json=data, headers=headers)
            else:
                return requests.post(url, data=data, headers=headers) # Pro OAuth2 login
        return requests.get(url, headers=headers)
    except Exception as e:
        print(f"API Error: {e}")
        return None

@app.route("/")
def index():
    if "token" not in session:
        return redirect(url_for("login"))
    return redirect(url_for("locations"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        
        # FastAPI login vyžaduje form-data (OAuth2 standard)
        payload = {"username": email, "password": password}
        resp = api_call("POST", "/auth/login", data=payload, is_json=False)
        
        if resp and resp.status_code == 200:
            session["token"] = resp.json().get("access_token")
            session["user_email"] = email
            flash("Úspěšně přihlášeno", "success")
            return redirect(url_for("locations"))
        else:
            flash("Chybné jméno nebo heslo", "danger")
            
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/locations")
def locations():
    if "token" not in session:
        return redirect(url_for("login"))
    
    company_id = get_company_id()
    if not company_id:
        flash("Uživatel není přiřazen k žádné firmě", "warning")
        return redirect(url_for("login"))

    # Volání tvého endpointu /companies/{id}/locations/my-locations
    resp = api_call("GET", f"/companies/{company_id}/locations/my-locations")
    
    locations_list = []
    if resp and resp.status_code == 200:
        locations_list = resp.json()
    else:
        flash("Nepodařilo se načíst sklady", "danger")

    return render_template("locations.html", locations=locations_list)

if __name__ == "__main__":
    app.run(port=5000, debug=True)