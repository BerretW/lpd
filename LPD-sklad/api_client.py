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
            payload = {"username": email, "password": password}
            response = requests.post(f"{API_BASE_URL}/auth/login", data=payload)

            if response.status_code == 200:
                self._token = response.json()["access_token"]
                decoded_token = jwt.decode(self._token, options={"verify_signature": False})
                
                tenants = decoded_token.get("tenants")
                if not tenants:
                    print("Chyba: Token neobsahuje informace o firmě (tenants).")
                    return False
                
                self.company_id = tenants[0]
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

    # --- INVENTORY ITEMS ---
    def get_inventory_items(self, category_id: Optional[int] = None) -> Optional[List[Dict[str, Any]]]:
        """Získá všechny položky skladu, volitelně filtrované podle kategorie."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory?limit=1000"
            if category_id is not None and category_id != -1:
                endpoint += f"&category_id={category_id}"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání skladu: {e}")
            return None

    def find_item_by_ean(self, ean: str) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/inventory/by-ean/{ean}"
            response = self._make_request("GET", endpoint)
            if response.status_code == 404: return None
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při hledání EAN {ean}: {e}")
            return None

    def create_inventory_item(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/inventory"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření položky: {e}")
            return None

    def update_inventory_item(self, item_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/inventory/{item_id}"
            response = self._make_request("PATCH", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při aktualizaci položky {item_id}: {e}")
            return None

    # --- CATEGORIES ---
    def get_categories(self) -> Optional[List[Dict[str, Any]]]:
        try:
            endpoint = f"/companies/{self.company_id}/categories"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání kategorií: {e}")
            return None

    def create_category(self, name: str, parent_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/categories"
            payload = {"name": name, "parent_id": parent_id}
            response = self._make_request("POST", endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření kategorie: {e}")
            return None
    
    # --- AUDIT LOGS ---
    def get_audit_logs(self, limit: int = 5000) -> Optional[List[Dict[str, Any]]]:
        try:
            endpoint = f"/companies/{self.company_id}/audit-logs?limit={limit}"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání auditních logů: {e}")
            return None
            
    # --- LOCATIONS ---
    def get_locations(self) -> Optional[List[Dict[str, Any]]]:
        """Získá seznam všech skladových lokací včetně oprávněných uživatelů."""
        try:
            endpoint = f"/companies/{self.company_id}/locations"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání lokací: {e}")
            return None
            
    def create_location(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Vytvoří novou skladovou lokaci."""
        try:
            endpoint = f"/companies/{self.company_id}/locations"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření lokace: {e}")
            return None
            
    def update_location(self, location_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Aktualizuje existující skladovou lokaci."""
        try:
            endpoint = f"/companies/{self.company_id}/locations/{location_id}"
            response = self._make_request("PATCH", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při aktualizaci lokace {location_id}: {e}")
            return None

    def delete_location(self, location_id: int) -> bool:
        """Smaže skladovou lokaci."""
        try:
            endpoint = f"/companies/{self.company_id}/locations/{location_id}"
            response = self._make_request("DELETE", endpoint)
            response.raise_for_status()
            return response.status_code == 204
        except requests.exceptions.RequestException as e:
            print(f"Chyba při mazání lokace {location_id}: {e}")
            return False

    # --- LOCATION PERMISSIONS ---
    def add_location_permission(self, location_id: int, user_email: str) -> Optional[List[Dict[str, Any]]]:
        """Přidá uživateli oprávnění pro danou lokaci."""
        try:
            endpoint = f"/companies/{self.company_id}/locations/{location_id}/permissions"
            payload = {"user_email": user_email}
            response = self._make_request("POST", endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při přidávání oprávnění: {e}")
            return None

    def remove_location_permission(self, location_id: int, user_id: int) -> bool:
        """Odebere uživateli oprávnění pro danou lokaci."""
        try:
            endpoint = f"/companies/{self.company_id}/locations/{location_id}/permissions/{user_id}"
            response = self._make_request("DELETE", endpoint)
            response.raise_for_status()
            return response.status_code == 204
        except requests.exceptions.RequestException as e:
            print(f"Chyba při odebírání oprávnění: {e}")
            return False

    # --- MEMBERS ---
    def get_company_members(self) -> Optional[List[Dict[str, Any]]]:
        """Získá seznam všech členů (uživatelů) ve firmě."""
        try:
            endpoint = f"/companies/{self.company_id}/members"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání členů firmy: {e}")
            return None

    # --- MOVEMENTS ---
    def place_stock(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Naskladní položku na lokaci."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory/movements/place"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při naskladňování: {e}")
            return None

    def transfer_stock(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Přesune položku mezi lokacemi."""
        try:
            endpoint = f"/companies/{self.company_id}/inventory/movements/transfer"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při přesunu: {e}")
            return None