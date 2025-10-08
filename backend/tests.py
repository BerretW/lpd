import requests
import time
from datetime import datetime, timedelta, date

# --- Konfigurace ---
BASE_URL = "http://127.0.0.1:8000"
timestamp = int(time.time())
ADMIN_EMAIL = f"test.admin.{timestamp}@example.com"
EMPLOYEE_EMAIL = f"test.employee.{timestamp}@example.com"
ADMIN_PASSWORD = "1234"

# Globální proměnné
admin_token, employee_token = None, None
company_id, employee_user_id = None, None

# --- Pomocné funkce ---

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

# --- Testovací scénář ---

def run_tests():
    global admin_token, employee_token, company_id, employee_user_id

    # 1. Registrace, přihlášení, pozvání
    print_step("1. User & Company Setup")
    reg_payload = {"company_name": f"Test Co {timestamp}", "slug": f"test-co-{timestamp}", "admin_email": ADMIN_EMAIL, "admin_password": ADMIN_PASSWORD}
    company_data = print_result(requests.post(f"{BASE_URL}/auth/register_company", json=reg_payload), 201)
    company_id = company_data["id"]

    login_payload = {"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    admin_token = print_result(requests.post(f"{BASE_URL}/auth/login", data=login_payload), 200)["access_token"]
    
    invite_payload = {"email": EMPLOYEE_EMAIL, "role": "member"}
    invite_data = print_result(requests.post(f"{BASE_URL}/invites/companies/{company_id}", json=invite_payload, headers=get_headers()), 201)
    accept_payload = {"token": invite_data["token"], "password": ADMIN_PASSWORD}
    employee_data = print_result(requests.post(f"{BASE_URL}/invites/accept", json=accept_payload), 200)
    employee_user_id = employee_data["id"]
    employee_login_payload = {"username": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    employee_token = print_result(requests.post(f"{BASE_URL}/auth/login", data=employee_login_payload), 200)["access_token"]

    # 2. Nastavení fakturačních údajů
    print_step("2. Setting Billing Information")
    company_billing_payload = {"ico": "12345678", "dic": "CZ12345678", "address": "Testovací 1, Praha"}
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/billing", json=company_billing_payload, headers=get_headers()), 200)
    client_payload = {"name": "Billing Client", "ico": "87654321"}
    client_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers()), 201)
    client_id = client_data["id"]
    
    # 3. Nastavení skladu a práce
    print_step("3. Setting up Work Types and Initial Inventory")
    # --- ZMĚNA: Položka se vytváří s 0 kusy ---
    item_payload = {"name": "Test Item", "sku": f"ITEM-{timestamp}", "price": 150.0}
    item_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers()), 201)
    item_id = item_data["id"]
    assert item_data["total_quantity"] == 0, "New item should have 0 quantity"
    work_type_payload = {"name": "Test Work", "rate": 1000.0}
    work_type_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-types", json=work_type_payload, headers=get_headers()), 201)
    work_type_id = work_type_data["id"]

    # 4. Správa kategorií
    print_step("4. Category Management")
    top_cat_payload = {"name": "Top Category"}
    top_cat_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/categories", json=top_cat_payload, headers=get_headers()), 201)
    top_cat_id = top_cat_data["id"]
    sub_cat_payload = {"name": "Sub Category", "parent_id": top_cat_id}
    sub_cat_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/categories", json=sub_cat_payload, headers=get_headers()), 201)
    sub_cat_id = sub_cat_data["id"]
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/inventory/{item_id}", json={"category_id": sub_cat_id}, headers=get_headers()), 200)
    print("  - Deleting categories...")
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/inventory/{item_id}", json={"category_id": None}, headers=get_headers()), 200)
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/categories/{sub_cat_id}", headers=get_headers()), 204)
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/categories/{top_cat_id}", headers=get_headers()), 204)

    # --- NOVÁ SEKCE PRO TESTOVÁNÍ LOKACÍ ---
    print_step("5. Inventory Location Management")
    print("  - Creating locations...")
    loc_a_payload = {"name": "Regál A-1"}
    loc_a_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/locations", json=loc_a_payload, headers=get_headers()), 201)
    loc_a_id = loc_a_data["id"]
    loc_b_payload = {"name": "Vozidlo 1"}
    loc_b_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/locations", json=loc_b_payload, headers=get_headers()), 201)
    loc_b_id = loc_b_data["id"]

    print("  - Placing initial stock...")
    place_payload = {"inventory_item_id": item_id, "location_id": loc_a_id, "quantity": 100}
    item_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory/movements/place", json=place_payload, headers=get_headers()), 200)
    assert item_data["total_quantity"] == 100, f"Expected 100 items, got {item_data['total_quantity']}"
    assert item_data["locations"][0]["quantity"] == 100, "Quantity in location A-1 mismatch"
    assert item_data["locations"][0]["location"]["id"] == loc_a_id, "Location ID mismatch"

    print("  - Attempting to delete non-empty location (should fail)...")
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/locations/{loc_a_id}", headers=get_headers()), 400)

    print("  - Transferring stock between locations...")
    transfer_payload = {"inventory_item_id": item_id, "from_location_id": loc_a_id, "to_location_id": loc_b_id, "quantity": 30}
    item_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory/movements/transfer", json=transfer_payload, headers=get_headers()), 200)
    assert item_data["total_quantity"] == 100, "Total quantity should not change after transfer"
    
    # Najdeme stavy na lokacích
    loc_a_stock = next((loc for loc in item_data["locations"] if loc["location"]["id"] == loc_a_id), None)
    loc_b_stock = next((loc for loc in item_data["locations"] if loc["location"]["id"] == loc_b_id), None)
    assert loc_a_stock and loc_a_stock["quantity"] == 70, f"Expected 70 in location A, got {loc_a_stock['quantity'] if loc_a_stock else 'None'}"
    assert loc_b_stock and loc_b_stock["quantity"] == 30, f"Expected 30 in location B, got {loc_b_stock['quantity'] if loc_b_stock else 'None'}"

    # 6. Vytvoření zakázky a úkolu
    print_step("6. Creating Work Order and Task")
    wo_payload = {"name": "Test Work Order", "client_id": client_id}
    wo_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=wo_payload, headers=get_headers()), 201)
    work_order_id = wo_data["id"]
    task_payload = {"name": "Test Task"}
    task_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers()), 201)
    task_id = task_data["id"]

    # 7. Testování Docházky
    print_step("7. Advanced Timesheet Testing")
    test_date = date.today()
    start_work = datetime.combine(test_date, datetime.min.time()).replace(hour=8)
    end_work = start_work.replace(hour=16)
    work_payload = {"start_time": start_work.isoformat(), "end_time": end_work.isoformat(), "entry_type": "work", "work_type_id": work_type_id, "task_id": task_id}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=work_payload, headers=get_headers("employee")), 201)
    start_doctor = start_work.replace(hour=10)
    end_doctor = start_work.replace(hour=11)
    doctor_payload = {"start_time": start_doctor.isoformat(), "end_time": end_doctor.isoformat(), "entry_type": "doctor"}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=doctor_payload, headers=get_headers("employee")), 201)
    
    response = requests.get(f"{BASE_URL}/companies/{company_id}/time-logs?work_date={test_date.isoformat()}", headers=get_headers("employee"))
    day_logs = print_result(response, 200)
    day_logs.sort(key=lambda x: x['start_time'])
    log_to_process_id = day_logs[0]['id']

    # 8. Testování Reportů
    print_step("8. Reports Testing")
    print("  - Generating Service Report...")
    print_result(requests.get(f"{BASE_URL}/companies/{company_id}/time-logs/{log_to_process_id}/service-report-data", headers=get_headers()), 200)

    print("  - Adding material from a specific location...")
    # --- ZMĚNA: Přidáváme from_location_id ---
    use_item_payload = {"inventory_item_id": item_id, "quantity": 5, "from_location_id": loc_b_id}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory", json=use_item_payload, headers=get_headers()), 200)

    print("  - Verifying stock quantity was reduced correctly...")
    item_data = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/inventory/{item_id}", headers=get_headers()), 200)
    assert item_data["total_quantity"] == 95, f"Expected 95 items total, got {item_data['total_quantity']}"
    loc_b_stock = next((loc for loc in item_data["locations"] if loc["location"]["id"] == loc_b_id), None)
    assert loc_b_stock and loc_b_stock["quantity"] == 25, f"Expected 25 in location B, got {loc_b_stock['quantity'] if loc_b_stock else 'None'}"

    print("  - Generating Work Order Billing Report...")
    wo_report = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/billing-report", headers=get_headers()), 200)
    assert wo_report["total_hours"] == 7.0, f"Expected 7.0 hours, got {wo_report['total_hours']}"
    assert wo_report["total_price_inventory"] == 750.0, f"Expected 750.0 for inventory, got {wo_report['total_price_inventory']}"
    
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