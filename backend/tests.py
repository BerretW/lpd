import sys
import os
import requests
import time
from datetime import datetime, date

# --- Konfigurace testu ---
BASE_URL = "http://127.0.0.1:8000"
timestamp = int(time.time())
ADMIN_EMAIL = f"test.admin.{timestamp}@example.com"
EMPLOYEE_EMAIL = f"test.employee.{timestamp}@example.com"
ADMIN_PASSWORD = "1234"

# Globální proměnné
admin_token, employee_token = None, None
company_id, employee_user_id = None, None

# --- Pomocné funkce (beze změny) ---
def print_step(title):
    print("\n" + "="*50)
    print(f" STEP: {title}")
    print("="*50)

def print_result(response, expected_status_code=None):
    status_code = response.status_code
    is_success = (expected_status_code is not None and status_code == expected_status_code) or \
                 (expected_status_code is None and 200 <= status_code < 300)
    
    try:
        data = response.json() if response.text and response.status_code != 204 else None
    except requests.exceptions.JSONDecodeError:
        data = response.text

    if is_success:
        print(f"  \033[92mSUCCESS (Status: {status_code})\033[0m")
        return data
    else:
        print(f"  \033[91mFAILURE (Status: {status_code})\033[0m")
        print(f"  Error: {data}")
        raise AssertionError(f"Test failed at step '{response.request.method} {response.request.url}' with status {status_code}")

def get_headers(token_type="admin"):
    token = admin_token if token_type == "admin" else employee_token
    if not token: raise ValueError(f"{token_type} token not available.")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def find_item_in_location(item_data, location_id):
    """Pomocná funkce pro nalezení množství položky na konkrétní lokaci."""
    for loc_stock in item_data.get('locations', []):
        if loc_stock['location']['id'] == location_id:
            return loc_stock['quantity']
    return 0

# --- Hlavní testovací funkce ---
def run_tests():
    global admin_token, employee_token, company_id, employee_user_id

    # 1. Registrace a přihlášení
    print_step("1. User & Company Setup")
    reg_payload = {"company_name": f"Test Co {timestamp}", "slug": f"test-co-{timestamp}", "admin_email": ADMIN_EMAIL, "admin_password": ADMIN_PASSWORD}
    company_data = print_result(requests.post(f"{BASE_URL}/auth/register_company", json=reg_payload), 201)
    company_id = company_data["id"]

    login_payload = {"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    admin_token = print_result(requests.post(f"{BASE_URL}/auth/login", data=login_payload), 200)["access_token"]
    
    # 2. Vytvoření zaměstnance
    print_step("2. Employee Setup")
    member_payload = {"email": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD, "role": "member"}
    employee_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/members", json=member_payload, headers=get_headers()), 201)
    employee_user_id = employee_data["user"]["id"]
    
    employee_login_payload = {"username": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    employee_token = print_result(requests.post(f"{BASE_URL}/auth/login", data=employee_login_payload), 200)["access_token"]
        
    # 3. Správa lokací a oprávnění
    print_step("3. Location and Permission Management")
    loc_main_payload = {"name": "Hlavní sklad"}
    loc_main_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/locations", json=loc_main_payload, headers=get_headers()), 201)
    loc_main_id = loc_main_data["id"]

    loc_vehicle_payload = {"name": "Vozidlo Technika"}
    loc_vehicle_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/locations", json=loc_vehicle_payload, headers=get_headers()), 201)
    loc_vehicle_id = loc_vehicle_data["id"]

    print("  - Verifying employee initially sees 0 locations...")
    # --- OPRAVA URL ---
    my_locations = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/locations/my-locations", headers=get_headers("employee")), 200)
    assert len(my_locations) == 0

    print(f"  - Granting employee access to location 'Vozidlo Technika' (ID: {loc_vehicle_id})...")
    perm_payload = {"user_email": EMPLOYEE_EMAIL}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/locations/{loc_vehicle_id}/permissions", json=perm_payload, headers=get_headers()), 201)

    print("  - Verifying employee now sees 1 location...")
    # --- OPRAVA URL ---
    my_locations = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/locations/my-locations", headers=get_headers("employee")), 200)
    assert len(my_locations) == 1
    assert my_locations[0]['id'] == loc_vehicle_id

    print(f"  - Revoking employee access from location 'Vozidlo Technika'...")
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/locations/{loc_vehicle_id}/permissions/{employee_user_id}", headers=get_headers()), 204)

    print("  - Verifying employee sees 0 locations again...")
    # --- OPRAVA URL ---
    my_locations = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/locations/my-locations", headers=get_headers("employee")), 200)
    assert len(my_locations) == 0

    # 4. Základní nastavení skladu
    print_step("4. Initial Inventory Setup")
    item_a_payload = {"name": "Čidlo A", "sku": f"CIDLO-A-{timestamp}", "price": 150.0}
    item_a_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_a_payload, headers=get_headers()), 201)
    item_a_id = item_a_data["id"]
    
    item_b_payload = {"name": "Kabel B", "sku": f"KABEL-B-{timestamp}", "price": 25.0}
    item_b_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_b_payload, headers=get_headers()), 201)
    item_b_id = item_b_data["id"]

    print("  - Placing items into Main Warehouse...")
    place_a_payload = {"inventory_item_id": item_a_id, "location_id": loc_main_id, "quantity": 50}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory/movements/place", json=place_a_payload, headers=get_headers()), 200)
    
    place_b_payload = {"inventory_item_id": item_b_id, "location_id": loc_main_id, "quantity": 100}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory/movements/place", json=place_b_payload, headers=get_headers()), 200)

    print("  - Writing off damaged items...")
    write_off_payload = {"inventory_item_id": item_a_id, "location_id": loc_main_id, "quantity": 5, "details": "Poškozeno při přepravě"}
    item_a_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory/movements/write-off", json=write_off_payload, headers=get_headers()), 200)
    assert find_item_in_location(item_a_data, loc_main_id) == 45 # 50 - 5

    # 5. Testování Požadavků na materiál (Picking Orders)
    print_step("5. Testing Picking Orders")
    print("  - Employee requests items for their vehicle...")
    picking_order_payload = {
        "source_location_id": loc_main_id,
        "destination_location_id": loc_vehicle_id,
        "items": [
            {"inventory_item_id": item_a_id, "requested_quantity": 10},
            {"requested_item_description": "Nová svorka, 5mm", "requested_quantity": 5}
        ]
    }
    order_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/picking-orders", json=picking_order_payload, headers=get_headers("employee")), 201)
    order_id = order_data["id"]
    requested_svorka_item_id = order_data['items'][1]['id']

    print("  - Admin creates a new inventory item for 'Nová svorka'...")
    item_c_payload = {"name": "Nová svorka, 5mm", "sku": f"SVORKA-C-{timestamp}", "price": 5.0}
    item_c_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_c_payload, headers=get_headers()), 201)
    item_c_id = item_c_data["id"]

    # --- LOGICKÁ OPRAVA: Admin musí položku nejprve naskladnit, než ji může vydat ---
    print("  - Admin places the new item into the warehouse...")
    place_c_payload = {"inventory_item_id": item_c_id, "location_id": loc_main_id, "quantity": 20}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory/movements/place", json=place_c_payload, headers=get_headers()), 200)

    print("  - Admin fulfills the picking order...")
    fulfill_payload = {
        "items": [
            {"picking_order_item_id": order_data['items'][0]['id'], "picked_quantity": 10},
            {"picking_order_item_id": requested_svorka_item_id, "picked_quantity": 5, "inventory_item_id": item_c_id}
        ]
    }
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/picking-orders/{order_id}/fulfill", json=fulfill_payload, headers=get_headers()), 200)

    print("  - Verifying stock levels after fulfillment...")
    item_a_data = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/inventory/{item_a_id}", headers=get_headers()), 200)
    assert find_item_in_location(item_a_data, loc_main_id) == 35 # 45 - 10
    assert find_item_in_location(item_a_data, loc_vehicle_id) == 10

    item_c_data = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/inventory/{item_c_id}", headers=get_headers()), 200)
    assert find_item_in_location(item_c_data, loc_main_id) == 15 # 20 - 5
    assert find_item_in_location(item_c_data, loc_vehicle_id) == 5

    # 6. Testování Přímého přiřazení a vratky
    print_step("6. Testing Direct Assignment and Return Logic")
    client_payload = {"name": "Direct Assign Client"}
    client_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers()), 201)
    client_id = client_data["id"]
    
    wo_payload = {"name": "Direct Assign Work Order", "client_id": client_id}
    wo_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=wo_payload, headers=get_headers()), 201)
    work_order_id = wo_data["id"]
    
    task_payload = {"name": "Direct Assign Task"}
    task_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers()), 201)
    task_id = task_data["id"]

    print("  - Directly assigning an item to a task (simulating direct purchase)...")
    direct_assign_payload = {"inventory_item_id": item_b_id, "quantity": 15, "details": "Zakoupeno přímo na stavbě"}
    task_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory/direct-assign", json=direct_assign_payload, headers=get_headers()), 200)
    used_item_id = task_data['used_items'][0]['id']

    item_b_data_before = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/inventory/{item_b_id}", headers=get_headers()), 200)
    assert find_item_in_location(item_b_data_before, loc_main_id) == 100 # Stav se nezměnil

    print("  - Removing the directly assigned item...")
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory/{used_item_id}", headers=get_headers()), 200)

    print("  - Verifying the item was returned to the main warehouse...")
    item_b_data_after = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/inventory/{item_b_id}", headers=get_headers()), 200)
    assert find_item_in_location(item_b_data_after, loc_main_id) == 115 # 100 + 15

    print("\n" + "="*50)
    print("\033[92mAll tests completed successfully!\033[0m")
    print("="*50)

if __name__ == "__main__":
    try:
        run_tests()
    except requests.exceptions.ConnectionError:
        print("\n\033[91mFATAL ERROR: Could not connect to the API server.\033[0m")
        print(f"Please make sure the backend is running at {BASE_URL}")
    except AssertionError as e:
        print(f"\n\033[91m--- TEST FAILED: {e} ---\033[0m")
    except Exception as e:
        print(f"\n\033[91mAn unexpected error occurred: {e}\033[0m")
        import traceback
        traceback.print_exc()