import requests
import random
import time
from datetime import datetime, timedelta, date

# --- Konfigurace ---
BASE_URL = "http://127.0.0.1:8000"
timestamp = int(time.time())
ADMIN_EMAIL = f"test.admin.{timestamp}@example.com"
EMPLOYEE_EMAIL = f"test.employee.{timestamp}@example.com"
ADMIN_PASSWORD = "1234"

# Globální proměnné pro uložení stavu
admin_token, employee_token = None, None
company_id, employee_user_id = None, None

# --- Pomocné funkce ---

def print_step(title):
    print("\n" + "="*50)
    print(f" STEP: {title}")
    print("="*50)

def print_result(response, expected_status_code=None):
    try:
        data = response.json() if response.status_code != 204 else None
    except requests.exceptions.JSONDecodeError:
        data = response.text

    status_code = response.status_code
    is_success = (status_code == expected_status_code) if expected_status_code else (200 <= status_code < 300)

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

    # 1. Registrace a přihlášení
    print_step("1. User & Company Management")
    print("  - Registering company and admin...")
    reg_payload = {"company_name": f"Test Co {timestamp}", "slug": f"test-co-{timestamp}", "admin_email": ADMIN_EMAIL, "admin_password": ADMIN_PASSWORD}
    company_data = print_result(requests.post(f"{BASE_URL}/auth/register_company", json=reg_payload), 201)
    company_id = company_data["id"]

    print("  - Logging in as admin...")
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    admin_token = print_result(requests.post(f"{BASE_URL}/auth/login", json=login_payload), 200)["access_token"]
    
    print("  - Inviting and accepting employee...")
    invite_payload = {"email": EMPLOYEE_EMAIL, "role": "member"}
    invite_data = print_result(requests.post(f"{BASE_URL}/invites/companies/{company_id}", json=invite_payload, headers=get_headers()), 201)
    accept_payload = {"token": invite_data["token"], "password": ADMIN_PASSWORD}
    employee_data = print_result(requests.post(f"{BASE_URL}/invites/accept", json=accept_payload), 200)
    employee_user_id = employee_data["id"]
    employee_login_payload = {"email": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    employee_token = print_result(requests.post(f"{BASE_URL}/auth/login", json=employee_login_payload), 200)["access_token"]

    # 2. Plný CRUD pro Klienty
    print_step("2. Client Management (Full CRUD)")
    client_payload = {"name": "Initial Client"}
    client_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers()), 201)
    client_id = client_data["id"]
    print_result(requests.get(f"{BASE_URL}/companies/{company_id}/clients", headers=get_headers()), 200)
    print_result(requests.get(f"{BASE_URL}/companies/{company_id}/clients/{client_id}", headers=get_headers()), 200)
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/clients/{client_id}", json={"name": "Updated Client Name"}, headers=get_headers()), 200)
    
    # 3. Sklad, Zakázky, Úkoly
    print_step("3. Setting up Work Order and Task context")
    item_payload = {"name": "Test Item", "sku": f"ITEM-{timestamp}", "quantity": 100, "price": 150.0}
    item_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers()), 201)
    item_id = item_data["id"]
    work_type_payload = {"name": "Test Work", "rate": 1000.0}
    work_type_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-types", json=work_type_payload, headers=get_headers()), 201)
    work_type_id = work_type_data["id"]
    wo_payload = {"name": "Test Work Order", "client_id": client_id}
    wo_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=wo_payload, headers=get_headers()), 201)
    work_order_id = wo_data["id"]
    task_payload = {"name": "Test Task"}
    task_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers()), 201)
    task_id = task_data["id"]

    # 4. Pokročilé testování Docházky
    print_step("4. Advanced Timesheet Testing")
    test_date = date.today()
    
    print("  - Logging full day of work (8:00 - 16:00)...")
    start_work = datetime.combine(test_date, datetime.min.time()).replace(hour=8)
    end_work = start_work.replace(hour=16)
    work_payload = {"start_time": start_work.isoformat(), "end_time": end_work.isoformat(), "entry_type": "work", "work_type_id": work_type_id, "task_id": task_id}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=work_payload, headers=get_headers("employee")), 201)

    print("  - Logging doctor's visit (10:00 - 11:00) to split the block...")
    start_doctor = start_work.replace(hour=10)
    end_doctor = start_work.replace(hour=11)
    doctor_payload = {"start_time": start_doctor.isoformat(), "end_time": end_doctor.isoformat(), "entry_type": "doctor"}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=doctor_payload, headers=get_headers("employee")), 201)
    
    print("  - Verifying the schedule was split into 3 blocks...")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/time-logs?work_date={test_date.isoformat()}", headers=get_headers("employee"))
    day_logs = print_result(response, 200)
    assert len(day_logs) == 3, f"Block splitting failed: Expected 3 blocks, found {len(day_logs)}."
    
    day_logs.sort(key=lambda x: x['start_time'])
    work_log_to_process = next((log for log in day_logs if log['entry_type'] == 'work'), None)
    assert work_log_to_process is not None, "Failed to find a 'work' log for processing."
    log_to_process_id = work_log_to_process['id']

    print("  - Admin approves a WORK time log...")
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs/{log_to_process_id}/status", json={"status": "approved"}, headers=get_headers()), 200)
    
    # 5. Reporty
    print_step("5. Reports")
    print("  - Generating Service Report from a WORK log...")
    service_report_data = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/time-logs/{log_to_process_id}/service-report-data", headers=get_headers()), 200)
    assert service_report_data['work_order']['id'] == work_order_id, "Service report returned wrong work order."
    assert service_report_data['task']['id'] == task_id, "Service report returned wrong task."
    
    print("  - Generating Billing Report...")
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory", json={"inventory_item_id": item_id, "quantity": 5}, headers=get_headers()), 200)
    report_data = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/billing-report", headers=get_headers()), 200)
    assert "total_price_work" in report_data

    # 6. Úklid
    print_step("6. Cleaning up")
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/clients/{client_id}", headers=get_headers()), 204)
    # Smazáním klienta se zakázka odpojila, ale stále existuje. Smažeme i ji.
    print_result(requests.delete(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}", headers=get_headers()), 204)
    
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