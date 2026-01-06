import os
import requests
from flask import Flask, render_template, request, redirect, url_for, session, flash
from jose import jwt

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "nejake-tajne-heslo-pro-session")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

# --- POMOCNÉ FUNKCE ---

def api_call(method, endpoint, data=None, is_json=True):
    """Univerzální funkce pro volání backendu."""
    headers = {}
    if "token" in session:
        headers["Authorization"] = f"Bearer {session['token']}"
    
    url = f"{BACKEND_URL}{endpoint}"
    try:
        if method == "GET":
            return requests.get(url, headers=headers, timeout=5)
        elif method == "POST":
            if is_json:
                return requests.post(url, json=data, headers=headers, timeout=5)
            else:
                return requests.post(url, data=data, headers=headers, timeout=5)
        elif method == "PATCH":
            return requests.patch(url, json=data, headers=headers, timeout=5)
    except Exception as e:
        print(f"API Error ({method} {endpoint}): {e}")
        return None

def get_all_tenants():
    """Vytáhne seznam ID firem z JWT tokenu."""
    token = session.get("token")
    if not token: return []
    try:
        payload = jwt.get_unverified_claims(token)
        return payload.get("tenants", [])
    except:
        return []

@app.context_processor
def inject_globals():
    """Zpřístupní proměnné ve všech HTML šablonách."""
    return dict(
        user_tenants=get_all_tenants(), 
        active_company_id=session.get("active_company_id")
    )

# --- AUTH TRASY ---

@app.route("/")
def index():
    if "token" not in session: return redirect(url_for("login"))
    return redirect(url_for("locations"))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        # Backend vyžaduje OAuth2 form data
        resp = api_call("POST", "/auth/login", data={"username": email, "password": password}, is_json=False)
        if resp and resp.status_code == 200:
            session["token"] = resp.json().get("access_token")
            session["user_email"] = email
            tenants = get_all_tenants()
            if tenants:
                session["active_company_id"] = tenants[0]
            flash("Přihlášení úspěšné", "success")
            return redirect(url_for("locations"))
        flash("Chybné přihlašovací údaje", "danger")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))

@app.route("/profile", methods=["GET", "POST"])
def profile():
    if "token" not in session: return redirect(url_for("login"))
    if request.method == "POST":
        new_email = request.form.get("email")
        resp = api_call("PATCH", "/users/me", data={"email": new_email})
        if resp and resp.status_code == 200:
            session["user_email"] = new_email
            flash("Profil aktualizován", "success")
        else:
            flash("Chyba při aktualizaci", "danger")
    return render_template("profile.html")

# --- FIRMY ---

@app.route("/switch-company/<int:company_id>")
def switch_company(company_id):
    if company_id in get_all_tenants():
        session["active_company_id"] = company_id
        flash(f"Přepnuto na firmu ID {company_id}", "info")
    return redirect(request.referrer or url_for("locations"))

@app.route("/companies/new", methods=["GET", "POST"])
def create_company():
    if "token" not in session: return redirect(url_for("login"))
    if request.method == "POST":
        name = request.form.get("name")
        data = {
            "company_name": name,
            "slug": name.lower().replace(" ", "-"),
            "admin_email": session["user_email"],
            "admin_password": "PASSWORD_MANAGED_BY_BACKEND"
        }
        resp = api_call("POST", "/auth/register_company", data=data)
        if resp and resp.status_code == 201:
            flash("Firma vytvořena. Přihlaste se prosím znovu.", "success")
            return redirect(url_for("logout"))
    return render_template("create_company.html")

# --- SKLADY (LOCATIONS) ---

@app.route("/locations")
def locations():
    if "token" not in session: return redirect(url_for("login"))
    cid = session.get("active_company_id")
    if not cid:
        return render_template("locations.html", locations=[])
    
    resp = api_call("GET", f"/companies/{cid}/locations/my-locations")
    locs = resp.json() if resp and resp.status_code == 200 else []
    return render_template("locations.html", locations=locs)

@app.route("/locations/create", methods=["POST"])
def create_location():
    cid = session.get("active_company_id")
    if cid:
        data = {"name": request.form.get("name"), "description": request.form.get("description")}
        api_call("POST", f"/companies/{cid}/locations", data=data)
    return redirect(url_for("locations"))

# --- INVENTÁŘ ---

@app.route("/inventory")
def inventory():
    if "token" not in session: return redirect(url_for("login"))
    cid = session.get("active_company_id")
    if not cid: return redirect(url_for("locations"))
    
    resp = api_call("GET", f"/companies/{cid}/inventory")
    items = resp.json() if resp and resp.status_code == 200 else []
    return render_template("inventory.html", items=items)

@app.route("/inventory/<int:item_id>")
def inventory_detail(item_id):
    if "token" not in session: return redirect(url_for("login"))
    cid = session.get("active_company_id")
    resp = api_call("GET", f"/companies/{cid}/inventory/{item_id}")
    if resp and resp.status_code == 200:
        return render_template("inventory_detail.html", item=resp.json())
    flash("Položka nenalezena", "danger")
    return redirect(url_for("inventory"))

# --- ZAKÁZKY (WORK ORDERS) ---

@app.route("/work-orders")
def work_orders():
    if "token" not in session: return redirect(url_for("login"))
    cid = session.get("active_company_id")
    if not cid: return redirect(url_for("locations"))
    
    resp = api_call("GET", f"/companies/{cid}/work-orders")
    orders = resp.json() if resp and resp.status_code == 200 else []
    return render_template("work_orders.html", orders=orders)

# --- VÝDEJKY (PICKING ORDERS) - Tato trasa chyběla! ---

@app.route("/picking-orders")
def picking_orders():
    if "token" not in session: return redirect(url_for("login"))
    cid = session.get("active_company_id")
    if not cid: return redirect(url_for("locations"))
    
    resp = api_call("GET", f"/companies/{cid}/picking-orders")
    orders = resp.json() if resp and resp.status_code == 200 else []
    return render_template("picking_orders.html", orders=orders)


@app.route("/locations/<int:location_id>")
def location_detail(location_id):
    if "token" not in session: return redirect(url_for("login"))
    cid = session.get("active_company_id")
    if not cid: return redirect(url_for("locations"))

    # 1. Načteme položky na této lokaci
    resp_items = api_call("GET", f"/companies/{cid}/locations/{location_id}/inventory")
    items = resp_items.json() if resp_items and resp_items.status_code == 200 else []

    # 2. Načteme info o lokaci (abychom věděli název skladu)
    # Backend nemá samostatný detail lokace, tak ho najdeme v seznamu "my-locations"
    resp_locs = api_call("GET", f"/companies/{cid}/locations/my-locations")
    locs = resp_locs.json() if resp_locs and resp_locs.status_code == 200 else []
    location = next((l for l in locs if l['id'] == location_id), None)

    if not location:
        flash("Sklad nenalezen nebo k němu nemáte přístup.", "danger")
        return redirect(url_for("locations"))

    return render_template("location_inventory.html", location=location, items=items)


if __name__ == "__main__":
    app.run(port=5000, debug=True)

