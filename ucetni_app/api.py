import requests
from config import API_BASE_URL

class ApiClient:
    def __init__(self):
        self.token = None
        self.company_id = None

    def set_token(self, token):
        self.token = token

    def set_company_id(self, company_id):
        self.company_id = company_id

    def _get_headers(self):
        if not self.token:
            return {"Content-Type": "application/json"}
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def login(self, username, password):
        url = f"{API_BASE_URL}/auth/login"
        try:
            # OAuth2 očekává form data, ale requests to zvládne i takto, 
            # pokud backend používá Form(...)
            response = requests.post(url, data={"username": username, "password": password})
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Login error: {e}")
            return None

    # --- GENERIC CRUD HELPERS ---
    def _get(self, endpoint, params=None):
        url = f"{API_BASE_URL}/companies/{self.company_id}/{endpoint}"
        try:
            r = requests.get(url, headers=self._get_headers(), params=params)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            print(f"GET {endpoint} error: {e}")
            # Vracíme prázdný seznam nebo None podle kontextu, 
            # ale pro bezpečí v UI raději vyhodíme chybu nebo vrátíme [], 
            # zde necháme bublat výjimku, pokud ji chceme chytat v UI, 
            # nebo vrátíme None a ošetříme v main.py
            raise e 

    def _post(self, endpoint, data):
        url = f"{API_BASE_URL}/companies/{self.company_id}/{endpoint}"
        r = requests.post(url, headers=self._get_headers(), json=data)
        r.raise_for_status()
        return r.json()

    def _patch(self, endpoint, resource_id, data):
        url = f"{API_BASE_URL}/companies/{self.company_id}/{endpoint}/{resource_id}"
        r = requests.patch(url, headers=self._get_headers(), json=data)
        r.raise_for_status()
        return r.json()

    def _delete(self, endpoint, resource_id=None):
        # Pokud resource_id není None, přidáme ho do URL, jinak voláme endpoint přímo
        # (např. pro mazání specifické marže, kde ID je součástí cesty specificky)
        url = f"{API_BASE_URL}/companies/{self.company_id}/{endpoint}"
        if resource_id is not None:
            url = f"{url}/{resource_id}"
            
        r = requests.delete(url, headers=self._get_headers())
        r.raise_for_status()
        return True

    # ==========================================
    # KATEGORIE (pro dropdown ve výběru marží)
    # ==========================================
    def get_categories(self):
        """Načte strom kategorií"""
        try:
            return self._get("categories")
        except:
            return []

    # ==========================================
    # ZÁKAZNÍCI (CLIENTS)
    # ==========================================
    def get_clients(self):
        try:
            return self._get("clients")
        except:
            return []
    
    def get_client(self, client_id):
        """Získá detail jednoho klienta"""
        # Voláme přímo URL bez helperu _get, protože _get vrací json nebo raise
        # Ale použijeme logiku URL z helperu
        url = f"{API_BASE_URL}/companies/{self.company_id}/clients/{client_id}"
        r = requests.get(url, headers=self._get_headers())
        r.raise_for_status()
        return r.json()

    def create_client(self, data):
        """
        data: {name, email, phone, address, ico, dic, margin_percentage, ...}
        """
        return self._post("clients", data)

    def update_client(self, client_id, data):
        """
        Aktualizuje základní údaje klienta (vč. výchozí marže)
        """
        return self._patch("clients", client_id, data)
    
    def delete_client(self, client_id):
        return self._delete("clients", client_id)

    # ==========================================
    # MARŽE ZÁKAZNÍKA (CLIENT MARGINS)
    # ==========================================
    def get_client_margins(self, client_id):
        """Získá seznam specifických marží pro klienta"""
        try:
            return self._get(f"clients/{client_id}/margins")
        except:
            return []

    def set_client_margin(self, client_id, category_id, margin_percentage):
        """Nastaví nebo aktualizuje marži pro konkrétní kategorii"""
        data = {
            "category_id": category_id,
            "margin_percentage": margin_percentage
        }
        # Endpoint v backendu je definován jako POST (upsert)
        return self._post(f"clients/{client_id}/margins", data)

    def delete_client_margin(self, client_id, category_id):
        """Smaže specifickou marži"""
        # Voláme DELETE na endpoint .../margins/{category_id}
        url_part = f"clients/{client_id}/margins/{category_id}"
        # Helper _delete očekává endpoint a ID, ale tady je ID kategorie až na konci
        # Takže to zavoláme takto:
        url = f"{API_BASE_URL}/companies/{self.company_id}/{url_part}"
        r = requests.delete(url, headers=self._get_headers())
        r.raise_for_status()
        return True

    # ==========================================
    # SKLAD (INVENTORY)
    # ==========================================
    def get_inventory(self):
        try:
            return self._get("inventory")
        except:
            return []
            
    def create_item(self, data):
        return self._post("inventory", data)
        
    def update_item(self, item_id, data):
        return self._patch("inventory", item_id, data)
        
    def delete_item(self, item_id):
        return self._delete("inventory", item_id)

    # ==========================================
    # ZAKÁZKY (WORK ORDERS)
    # ==========================================
    def get_work_orders(self):
        try:
            return self._get("work-orders")
        except:
            return []
            
    def create_work_order(self, data):
        return self._post("work-orders", data)
        
    def update_work_order_status(self, wid, status): 
        return self._post(f"work-orders/{wid}/status", {"status": status})

    def get_tasks(self, work_order_id):
        try:
            return self._get(f"work-orders/{work_order_id}/tasks")
        except:
            return []

    def get_billing_report(self, work_order_id, start_date=None, end_date=None):
        params = {}
        if start_date: params['start_date'] = start_date
        if end_date: params['end_date'] = end_date
        
        url = f"{API_BASE_URL}/companies/{self.company_id}/work-orders/{work_order_id}/billing-report"
        r = requests.get(url, headers=self._get_headers(), params=params)
        r.raise_for_status()
        return r.json()