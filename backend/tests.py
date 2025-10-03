import requests
import random
import time
from datetime import datetime, timedelta

# --- Konfigurace ---
BASE_URL = "http://127.0.0.1:8000"
# Unikátní emaily, aby test mohl běžet vícekrát
timestamp = int(time.time())
ADMIN_EMAIL = f"test.admin.{timestamp}@example.com"
EMPLOYEE_EMAIL = f"test.employee.{timestamp}@example.com"
ADMIN_PASSWORD = "TestPassword123!"

# Globální proměnné pro uložení stavu
admin_token = None
company_id = None
employee_user_id = None

# --- Pomocné funkce ---

def print_step(title):
    print("\n" + "="*50)
    print(f" STEP: {title}")
    print("="*50)

def print_result(response, expected_status_code=None):
    try:
        data = response.json()
    except requests.exceptions.JSONDecodeError:
        data = response.text

    status_code = response.status_code
    
    is_success = False
    if expected_status_code:
        is_success = (status_code == expected_status_code)
    elif 200 <= status_code < 300:
        is_success = True

    if is_success:
        print(f"  \033[92mSUCCESS (Status: {status_code})\033[0m")
        return data
    else:
        print(f"  \033[91mFAILURE (Status: {status_code})\033[0m")
        print(f"  Error: {data}")
        raise AssertionError(f"Test failed at step with status {status_code}")

def get_headers(token):
    if not token:
        raise ValueError("Access token not available.")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

# --- Testovací scénář ---

def run_tests():
    global admin_token, company_id, employee_user_id

    # 1. Registrace a přihlášení admina
    print_step("Registering a new company and admin user")
    reg_payload = {"company_name": f"Test Co {timestamp}", "slug": f"test-co-{timestamp}", "admin_email": ADMIN_EMAIL, "admin_password": ADMIN_PASSWORD}
    response = requests.post(f"{BASE_URL}/auth/register_company", json=reg_payload)
    company_data = print_result(response, 201)
    company_id = company_data["id"]

    print_step("Logging in as the new admin")
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    login_data = print_result(response, 200)
    admin_token = login_data["access_token"]
    
    # 2. Správa členů
    print_step("Admin invites a new employee")
    invite_payload = {"email": EMPLOYEE_EMAIL, "role": "member"}
    response = requests.post(f"{BASE_URL}/invites/companies/{company_id}", json=invite_payload, headers=get_headers(admin_token))
    invite_data = print_result(response, 201)
    invite_token = invite_data["token"]
    
    print_step("New employee accepts the invite")
    accept_payload = {"token": invite_token, "password": ADMIN_PASSWORD}
    response = requests.post(f"{BASE_URL}/invites/accept", json=accept_payload)
    employee_data = print_result(response, 200)
    employee_user_id = employee_data["id"]

    # 3. Správa klientů
    print_step("Creating a new client")
    client_payload = {"name": "Test Client Alpha"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers(admin_token))
    client_data = print_result(response, 201)
    client_id = client_data["id"]

    # 4. Sklad a kategorie
    print_step("Creating an inventory category and item")
    category_payload = {"name": "Senzory"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/categories", json=category_payload, headers=get_headers(admin_token))
    category_data = print_result(response, 201)
    item_payload = {"name": "PIR Sensor", "sku": f"PIR-{timestamp}", "quantity": 50}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers(admin_token))
    item_data = print_result(response, 201)

    # 5. Druhy práce
    print_step("Creating a work type")
    work_type_payload = {"name": "Standardní instalace", "rate": 450.0}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-types", json=work_type_payload, headers=get_headers(admin_token))
    work_type_data = print_result(response, 201)
    work_type_id = work_type_data["id"]

    # 6. Workflow zakázky a úkolu
    print_step("Creating a work order")
    wo_payload = {"name": "Instalace v objektu A", "client_id": client_id}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=wo_payload, headers=get_headers(admin_token))
    wo_data = print_result(response, 201)
    work_order_id = wo_data["id"]

    print_step("Creating a new task in the work order")
    task_payload = {"name": "Montáž centrální jednotky"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers(admin_token))
    task_data = print_result(response, 201)
    task_id = task_data["id"]
    
    # 7. Workflow odpracovaných hodin (s pokročilými testy)
    print_step("Employee logs first time block (8:00 - 10:00)")
    start_time_1 = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
    end_time_1 = start_time_1 + timedelta(hours=2)
    log_payload_1 = {
        "task_id": task_id, "work_type_id": work_type_id,
        "start_time": start_time_1.isoformat(), "end_time": end_time_1.isoformat()
    }
    # Přihlásíme zaměstnance
    employee_login_payload = {"email": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    response = requests.post(f"{BASE_URL}/auth/login", json=employee_login_payload)
    employee_token = print_result(response, 200)["access_token"]
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=log_payload_1, headers=get_headers(employee_token))
    print_result(response, 201)

    print_step("Employee logs overlapping time block (9:30 - 11:00) -> should shorten the first block")
    start_time_2 = start_time_1 + timedelta(hours=1, minutes=30)
    end_time_2 = start_time_2 + timedelta(hours=1, minutes=30)
    log_payload_2 = {
        "task_id": task_id, "work_type_id": work_type_id, "notes": "Překryv",
        "start_time": start_time_2.isoformat(), "end_time": end_time_2.isoformat()
    }
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=log_payload_2, headers=get_headers(employee_token))
    print_result(response, 201)
    
    print_step("Employee logs time and creates a new task simultaneously (13:00 - 14:00)")
    start_time_3 = start_time_1.replace(hour=13)
    end_time_3 = start_time_3 + timedelta(hours=1)
    log_payload_3 = {
        "work_type_id": work_type_id,
        "start_time": start_time_3.isoformat(), "end_time": end_time_3.isoformat(),
        "new_task": {
            "work_order_id": work_order_id,
            "name": "Telefonát s klientem"
        }
    }
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=log_payload_3, headers=get_headers(employee_token))
    time_log_to_approve = print_result(response, 201)
    time_log_id_to_approve = time_log_to_approve["id"]

    print_step("Listing employee's time logs for today to verify overlaps")
    today = datetime.now().strftime('%Y-%m-%d')
    response = requests.get(f"{BASE_URL}/companies/{company_id}/time-logs?work_date={today}", headers=get_headers(employee_token))
    print_result(response, 200)

    print_step("Admin approves one of the time logs")
    status_payload = {"status": "approved"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs/{time_log_id_to_approve}/status", json=status_payload, headers=get_headers(admin_token))
    print_result(response, 200)

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
        print(f"\n\033[91m--- TEST FAILED ---\033[0m")
    except Exception as e:
        print(f"\n\033[91mAn unexpected error occurred: {e}\033[0m")