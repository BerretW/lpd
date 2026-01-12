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
        try:
            print(f"Pokus o přihlášení na: {API_BASE_URL}/auth/login") # LOG
            payload = {"username": email, "password": password}
            
            # PŘIDÁN TIMEOUT 5 SEKUND
            response = requests.post(f"{API_BASE_URL}/auth/login", data=payload, timeout=5)

            if response.status_code == 200:
                self._token = response.json()["access_token"]
                # PŘIDÁNY ALGORITMY (některé verze pyjwt to vyžadují i bez ověření)
                decoded_token = jwt.decode(self._token, options={"verify_signature": False}, algorithms=["HS256"])
                
                print(f"Token dekódován: {decoded_token}") # LOG
                
                tenants = decoded_token.get("tenants")
                if not tenants:
                    print("Chyba: Token neobsahuje firmy.")
                    return False
                
                self.company_id = tenants[0]
                self.user_email = email
                return True
            else:
                print(f"Server vrátil chybu: {response.status_code}")
                return False
        except requests.exceptions.Timeout:
            print("Chyba: Server neodpovídá (timeout).")
            return False
        except Exception as e:
            print(f"KRITICKÁ CHYBA PŘI PŘIHLÁŠENÍ: {str(e)}") # Tohle uvidíte v konzoli
            return False

    def try_login_with_token(self, token: str) -> bool:
        """
        NOVÁ METODA: Pokusí se ověřit existující token a nastavit session.
        Využívá se pro automatické přihlášení.
        """
        try:
            self._token = token
            decoded_token = jwt.decode(self._token, options={"verify_signature": False})
            
            tenants = decoded_token.get("tenants")
            if not tenants:
                print("Chyba: Token neobsahuje informace o firmě (tenants).")
                self._token = None # Zneplatníme token
                return False
            
            self.company_id = tenants[0]
            self.user_email = decoded_token.get("sub") # 'sub' je standard pro subjekt/username v JWT

            # Ověříme token provedením jednoduchého autorizovaného požadavku
            if self.get_company_members() is not None:
                print(f"Automatické přihlášení pro {self.user_email} úspěšné.")
                return True
            else:
                # Požadavek selhal, token je pravděpodobně expirovaný nebo neplatný
                print("Ověření tokenu selhalo. Token je pravděpodobně expirovaný.")
                self._token = None
                self.company_id = None
                self.user_email = None
                return False
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
            print(f"Chyba při dekódování tokenu: {e}")
            self._token = None
            return False
        except Exception as e:
            print(f"Neočekávaná chyba při ověřování tokenu: {e}")
            self._token = None
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
    def upload_inventory_item_image(self, item_id: int, file_path: str) -> Optional[Dict[str, Any]]:
        """
        Nahraje obrázek k položce.
        """
        try:
            url = f"{API_BASE_URL}/companies/{self.company_id}/inventory/{item_id}/upload-image"
            
            # Otevřeme soubor v binárním režimu
            with open(file_path, 'rb') as f:
                files = {'file': (file_path, f, 'image/jpeg')} # MIME type odhadujeme nebo necháme requests
                
                # Zde nepoužíváme _make_request, protože requests si Content-Type pro multipart
                # nastavuje sám (včetně boundary). Jen přidáme auth token.
                headers = {"Authorization": f"Bearer {self._token}"}
                
                print(f"Nahrávám obrázek na: {url}")
                response = requests.post(url, files=files, headers=headers, timeout=30)
                
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Chyba při nahrávání obrázku: {e}")
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
    
    # --- NOVÁ METODA PRO MAZÁNÍ ---
    def delete_picking_order(self, order_id: int) -> bool:
        """Smaže požadavek na materiál."""
        try:
            endpoint = f"/companies/{self.company_id}/picking-orders/{order_id}"
            response = self._make_request("DELETE", endpoint)
            response.raise_for_status()
            # Backend vrací 200 OK s objektem, takže kontrolujeme tento kód
            return response.status_code == 200
        except requests.exceptions.RequestException as e:
            print(f"Chyba při mazání požadavku {order_id}: {e}")
            return False
    # ==========================================
    # --- PARTNERS (Výrobci a Dodavatelé) ---
    # ==========================================
    
    # --- MANUFACTURERS ---
    def get_manufacturers(self) -> Optional[List[Dict[str, Any]]]:
        try:
            endpoint = f"/companies/{self.company_id}/manufacturers"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání výrobců: {e}")
            return None

    def create_manufacturer(self, name: str) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/manufacturers"
            payload = {"name": name}
            response = self._make_request("POST", endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření výrobce: {e}")
            return None

    # --- SUPPLIERS ---
    def get_suppliers(self) -> Optional[List[Dict[str, Any]]]:
        try:
            endpoint = f"/companies/{self.company_id}/suppliers"
            response = self._make_request("GET", endpoint)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při načítání dodavatelů: {e}")
            return None

    def create_supplier(self, name: str) -> Optional[Dict[str, Any]]:
        try:
            endpoint = f"/companies/{self.company_id}/suppliers"
            payload = {"name": name}
            response = self._make_request("POST", endpoint, json=payload)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Chyba při vytváření dodavatele: {e}")
            return None