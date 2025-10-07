# api_client.py
import requests
import jwt
from typing import Optional, Dict, Any, List

from config import API_BASE_URL

class ApiClient:
    def __init__(self):
        self._token: Optional[str] = None
        self.company_id: Optional[int] = None
        self.user_email: Optional[str] = None

    def login(self, email: str, password: str) -> bool:
        """Pokusí se přihlásit a uloží token a company_id."""
        try:
            # --- ZMĚNA ZDE ---
            # Místo JSON posíláme data jako formulář (x-www-form-urlencoded)
            # a klíč pro e-mail je 'username', jak vyžaduje OAuth2PasswordRequestForm.
            payload = {
                "username": email,
                "password": password
            }
            response = requests.post(f"{API_BASE_URL}/auth/login", data=payload)
            # --- KONEC ZMĚNY ---

            if response.status_code == 200:
                self._token = response.json()["access_token"]
                decoded_token = jwt.decode(self._token, options={"verify_signature": False})
                
                # Získáme tenants a ověříme, že existují
                tenants = decoded_token.get("tenants")
                if not tenants:
                    print("Chyba: Token neobsahuje informace o firmě (tenants).")
                    return False
                
                self.company_id = tenants[0]
                self.user_email = decoded_token.get("sub") # V JWT je user ID, ne email. Získat email by vyžadovalo další API call. Změníme to.
                
                # Správně je v 'sub' ID uživatele. Email použijeme ten, kterým se přihlásil.
                self.user_email = email

                return True
            else:
                print(f"Chyba přihlášení: {response.status_code} - {response.text}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"Chyba připojení k API: {e}")
            return False

    def _make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Pomocná metoda pro tvorbu autorizovaných požadavků."""
        if not self._token or not self.company_id:
            raise PermissionError("Nejste přihlášeni nebo nemáte firmu.")
        
        headers = kwargs.get("headers", {})
        headers["Authorization"] = f"Bearer {self._token}"
        kwargs["headers"] = headers
        
        url = f"{API_BASE_URL}{endpoint}"
        return requests.request(method, url, **kwargs)

    def get_inventory_items(self, category_id: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """Získá všechny položky skladu, volitelně filtrované podle kategorie a jejích podkategorií."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory?limit=1000"
            
            # Pokud je ID kategorie zadáno (a není to "Všechny kategorie"), přidáme ho do dotazu
            if category_id is not None and category_id != -1:
                endpoint += f"&category_id={category_id}"

            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání skladu: {e}")
            return None

    def find_item_by_ean(self, ean: str) -> Optional[Dict[str, Any]]:
        """Najde položku podle EAN."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory/by-ean/{ean}"
            response = self._make_request("GET", endpoint)
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při hledání EAN {ean}: {e}")
            return None

    def create_inventory_item(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Vytvoří novou položku."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření položky: {e}")
            return None

    def update_inventory_item(self, item_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Aktualizuje existující položku."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory/{item_id}"
            response = self._make_request("PATCH", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při aktualizaci položky {item_id}: {e}")
            return None

    def get_categories(self) -> Optional[List[Dict[str, Any]]]:
        """Získá stromovou strukturu kategorií."""
        try:
            endpoint = f"/companies/{self.company_id}/categories"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání kategorií: {e}")
            return None

    def create_category(self, name: str, parent_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Vytvoří novou kategorii."""
        try:
            endpoint = f"/companies/{self.company_id}/categories"
            payload = {"name": name, "parent_id": parent_id}
            response = self._make_request("POST", endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření kategorie: {e}")
            return None
    
    def get_audit_logs(self, limit: int = 5000) -> Optional[List[Dict[str, Any]]]:
        """Získá historii pohybů ve skladu."""
        try:
            endpoint = f"/companies/{self.company_id}/audit-logs?limit={limit}"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání auditních logů: {e}")
            return None