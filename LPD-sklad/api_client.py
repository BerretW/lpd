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
    def get_audit_logs(
        self, 
        limit: int = 1000, 
        item_id: Optional[int] = None,
        user_id: Optional[int] = None,
        action: Optional[str] = None, # NOVÝ PARAMETR
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Optional[List[Dict[str, Any]]]:
        """Získá historii pohybů s možností filtrování."""
        try:
            params = {'limit': limit}
            if item_id is not None and item_id != -1:
                params['item_id'] = item_id
            if user_id is not None and user_id != -1:
                params['user_id'] = user_id
            if action: # NOVÁ PODMÍNKA
                params['action'] = action
            if start_date:
                params['start_date'] = start_date
            if end_date:
                params['end_date'] = end_date

            endpoint = f"/companies/{self.company_id}/audit-logs"
            response = self._make_request("GET", endpoint, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání auditních logů: {e}")
            return None
            
    # --- LOCATIONS ---
    def get_locations(self) -> Optional[List[Dict[str, Any]]]:
        try:
            endpoint = f"/companies/{self.company_id}/locations"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání lokací: {e}")
            return None
            
    def create_location(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/locations"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření lokace: {e}")
            return None
            
    def update_location(self, location_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/locations/{location_id}"
            response = self._make_request("PATCH", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při aktualizaci lokace {location_id}: {e}")
            return None

    def delete_location(self, location_id: int) -> bool:
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
        try:
            endpoint = f"/companies/{self.company_id}/inventory/movements/place"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při naskladňování: {e}")
            return None

    def transfer_stock(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/inventory/movements/transfer"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při přesunu: {e}")
            return None
            
    def write_off_stock(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/inventory/movements/write-off"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při odepisování položky: {e}")
            return None
        

    def get_picking_orders(self, status: Optional[str] = None) -> Optional[List[Dict[str, Any]]]:
        """Získá seznam požadavků na materiál, volitelně filtrovaný podle stavu."""
        try:
            endpoint = f"/companies/{self.company_id}/picking-orders"
            params = {}
            if status and status != "all":
                params['status'] = status
            response = self._make_request("GET", endpoint, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání požadavků: {e}")
            return None

    def create_picking_order(self, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Vytvoří nový požadavek na materiál."""
        try:
            endpoint = f"/companies/{self.company_id}/picking-orders"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření požadavku: {e}")
            return None

    def fulfill_picking_order(self, order_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Splní (vychystá) požadavek na materiál."""
        try:
            endpoint = f"/companies/{self.company_id}/picking-orders/{order_id}/fulfill"
            response = self._make_request("POST", endpoint, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při plnění požadavku: {e}")
            # Zkusíme parsovat chybovou hlášku z API
            try:
                error_detail = response.json().get('detail')
                print(f"Detail chyby z API: {error_detail}")
                return {"error": error_detail} # Vrátíme slovník s chybou
            except:
                return None