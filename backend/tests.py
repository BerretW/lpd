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
    is_success = (status_code == expected_status_code) if expected_status_code else (200 <= status_code < 300)
    
    try:
        data = response.json() if response.status_code != 204 else None
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

    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    admin_token = print_result(requests.post(f"{BASE_URL}/auth/login", json=login_payload), 200)["access_token"]
    
    invite_payload = {"email": EMPLOYEE_EMAIL, "role": "member"}
    invite_data = print_result(requests.post(f"{BASE_URL}/invites/companies/{company_id}", json=invite_payload, headers=get_headers()), 201)
    accept_payload = {"token": invite_data["token"], "password": ADMIN_PASSWORD}
    employee_data = print_result(requests.post(f"{BASE_URL}/invites/accept", json=accept_payload), 200)
    employee_user_id = employee_data["id"]
    employee_login_payload = {"email": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    employee_token = print_result(requests.post(f"{BASE_URL}/auth/login", json=employee_login_payload), 200)["access_token"]

    # 2. Nastavení fakturačních údajů
    print_step("2. Setting Billing Information")
    print("  - Updating company billing info...")
    company_billing_payload = {"ico": "12345678", "dic": "CZ12345678", "address": "Testovací 1, Praha"}
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/billing", json=company_billing_payload, headers=get_headers()), 200)

    print("  - Creating client...")
    client_payload = {"name": "Billing Client", "ico": "87654321"}
    client_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers()), 201)
    client_id = client_data["id"]
    
    # 3. Nastavení skladu a práce
    print_step("3. Setting up Inventory and Work Types")
    item_payload = {"name": "Test Item", "sku": f"ITEM-{timestamp}", "quantity": 100, "price": 150.0}
    item_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers()), 201)
    item_id = item_data["id"]
    work_type_payload = {"name": "Test Work", "rate": 1000.0}
    work_type_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-types", json=work_type_payload, headers=get_headers()), 201)
    work_type_id = work_type_data["id"]

    # --- NOVÁ SEKCE ---
    # 4. Testování správy kategorií
    print_step("4. Category Management Testing")
    print("  - Creating top-level category...")
    top_cat_payload = {"name": "Top Category"}
    top_cat_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/categories", json=top_cat_payload, headers=get_headers()), 201)
    top_cat_id = top_cat_data["id"]

    print("  - Creating sub-category...")
    sub_cat_payload = {"name": "Sub Category", "parent_id": top_cat_id}
    sub_cat_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/categories", json=sub_cat_payload, headers=get_headers()), 201)
    sub_cat_id = sub_cat_data["id"]
    
    print("  - Verifying category tree structure...")
    categories_tree = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/categories", headers=get_headers()), 200)
    assert len(categories_tree) == 1, "Should be one top-level category"
    assert categories_tree[0]['id'] == top_cat_id, "Top category ID mismatch"
    assert len(categories_tree[0]['children']) == 1, "Should have one sub-category"
    assert categories_tree[0]['children'][0]['id'] == sub_cat_id, "Sub-category ID mismatch"
    
    print("  - Attempting to delete non-empty category (should fail)...")
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/categories/{top_cat_id}", headers=get_headers()), 400)
    
    print("  - Assigning item to a category...")
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/inventory/{item_id}", json={"category_id": sub_cat_id}, headers=get_headers()), 200)
    
    print("  - Attempting to delete category with an item (should fail)...")
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/categories/{sub_cat_id}", headers=get_headers()), 400)

    print("  - Unassigning item from category...")
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/inventory/{item_id}", json={"category_id": None}, headers=get_headers()), 200)

    print("  - Deleting categories in correct order...")
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/categories/{sub_cat_id}", headers=get_headers()), 204)
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/categories/{top_cat_id}", headers=get_headers()), 204)
    # --- KONEC NOVÉ SEKCE ---

    # 5. Vytvoření zakázky a úkolu
    print_step("5. Creating Work Order and Task")
    wo_payload = {"name": "Test Work Order", "client_id": client_id}
    wo_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=wo_payload, headers=get_headers()), 201)
    work_order_id = wo_data["id"]
    task_payload = {"name": "Test Task"}
    task_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers()), 201)
    task_id = task_data["id"]

    # 6. Testování Docházky
    print_step("6. Advanced Timesheet Testing")
    test_date = date.today()
    print("  - Logging and splitting a work block...")
    start_work = datetime.combine(test_date, datetime.min.time()).replace(hour=8)
    end_work = start_work.replace(hour=16)
    work_payload = {"start_time": start_work.isoformat(), "end_time": end_work.isoformat(), "entry_type": "work", "work_type_id": work_type_id, "task_id": task_id, "notes": "Původní poznámka"}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=work_payload, headers=get_headers("employee")), 201)
    start_doctor = start_work.replace(hour=10)
    end_doctor = start_work.replace(hour=11)
    doctor_payload = {"start_time": start_doctor.isoformat(), "end_time": end_doctor.isoformat(), "entry_type": "doctor"}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=doctor_payload, headers=get_headers("employee")), 201)
    
    print("  - Verifying the schedule was split correctly...")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/time-logs?work_date={test_date.isoformat()}", headers=get_headers("employee"))
    day_logs = print_result(response, 200)
    assert len(day_logs) == 3, f"Block splitting failed: Expected 3 blocks, found {len(day_logs)}."
    day_logs.sort(key=lambda x: x['start_time'])
    log_to_process_id = day_logs[0]['id']

    # 7. Testování Reportů
    print_step("7. Reports Testing")
    print("  - Generating Service Report...")
    service_report = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/time-logs/{log_to_process_id}/service-report-data", headers=get_headers()), 200)
    assert service_report['work_order']['id'] == work_order_id

    print("  - Adding material and generating Work Order Billing Report...")
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory", json={"inventory_item_id": item_id, "quantity": 5}, headers=get_headers()), 200)
    wo_report = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/billing-report", headers=get_headers()), 200)
    # Celkem 7 hodin práce (8-10 a 11-16)
    assert wo_report["total_hours"] == 7.0, f"Expected 7.0 hours, got {wo_report['total_hours']}"
    assert wo_report["total_price_work"] == 7000.0, f"Expected 7000.0 for work, got {wo_report['total_price_work']}"
    assert wo_report["total_price_inventory"] == 750.0, f"Expected 750.0 for inventory, got {wo_report['total_price_inventory']}"

    print("  - Generating Client Billing Report...")
    start_date_str = test_date.isoformat()
    end_date_str = (test_date + timedelta(days=1)).isoformat()
    client_report = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/clients/{client_id}/billing-report?start_date={start_date_str}&end_date={end_date_str}", headers=get_headers()), 200)
    assert client_report["grand_total"] == wo_report["grand_total"], "Client report total should match work order total."
    
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