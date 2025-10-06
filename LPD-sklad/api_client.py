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
            response = requests.post(f"{API_BASE_URL}/auth/login", json={"email": email, "password": password})
            if response.status_code == 200:
                self._token = response.json()["access_token"]
                # Dekódujeme token, abychom získali ID firmy bez nutnosti ověřování podpisu
                decoded_token = jwt.decode(self._token, options={"verify_signature": False})
                self.company_id = decoded_token.get("tenants", [None])[0]
                self.user_email = decoded_token.get("sub") # email je v 'sub'
                
                if not self.company_id:
                    print("Chyba: Uživatel není přiřazen k žádné firmě.")
                    return False
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

    def get_inventory_items(self) -> Optional[List[Dict[str, Any]]]:
        """Získá všechny položky skladu."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory?limit=1000" # Zvýšíme limit
            response = self._make_request("GET", endpoint)
            response.raise_for_status() # Vyvolá výjimku pro 4xx/5xx chyby
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
                return None # Nenalezeno je validní scénář
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při hledání EAN {ean}: {e}")
            return None # V případě chyby vracíme také None

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