import requests
import random
import time
from datetime import datetime, timedelta, date

# --- Konfigurace ---
BASE_URL = "http://127.0.0.1:8000"
# Unikátní emaily, aby test mohl běžet vícekrát
timestamp = int(time.time())
ADMIN_EMAIL = f"test.admin.{timestamp}@example.com"
EMPLOYEE_EMAIL = f"test.employee.{timestamp}@example.com"
ADMIN_PASSWORD = "1234"

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
        raise AssertionError(f"Test failed at step with status {status_code}")

def get_headers(token):
    if not token: raise ValueError("Access token not available.")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# --- Testovací scénář ---

def run_tests():
    global admin_token, company_id, employee_user_id

    # --- KROKY 1-6: REGISTRACE, KLIENTI, SKLAD, ZAKÁZKY ---
    # (Tato část zůstává stejná jako v předchozí verzi)
    print_step("Registering company and admin")
    reg_payload = {"company_name": f"Test Co {timestamp}", "slug": f"test-co-{timestamp}", "admin_email": ADMIN_EMAIL, "admin_password": ADMIN_PASSWORD}
    company_data = print_result(requests.post(f"{BASE_URL}/auth/register_company", json=reg_payload), 201)
    company_id = company_data["id"]

    print_step("Logging in as admin")
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    admin_token = print_result(requests.post(f"{BASE_URL}/auth/login", json=login_payload), 200)["access_token"]
    
    print_step("Inviting and accepting employee")
    invite_payload = {"email": EMPLOYEE_EMAIL, "role": "member"}
    invite_data = print_result(requests.post(f"{BASE_URL}/invites/companies/{company_id}", json=invite_payload, headers=get_headers(admin_token)), 201)
    accept_payload = {"token": invite_data["token"], "password": ADMIN_PASSWORD}
    employee_data = print_result(requests.post(f"{BASE_URL}/invites/accept", json=accept_payload), 200)
    employee_user_id = employee_data["id"]

    print_step("Creating client, inventory, work type, work order, and task")
    client_payload = {"name": "Test Client Alpha"}
    client_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers(admin_token)), 201)
    client_id = client_data["id"]
    item_payload = {"name": "PIR Sensor", "sku": f"PIR-{timestamp}", "quantity": 50}
    item_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers(admin_token)), 201)
    work_type_payload = {"name": "Standardní instalace", "rate": 450.0}
    work_type_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-types", json=work_type_payload, headers=get_headers(admin_token)), 201)
    work_type_id = work_type_data["id"]
    wo_payload = {"name": "Instalace v objektu A", "client_id": client_id}
    wo_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=wo_payload, headers=get_headers(admin_token)), 201)
    work_order_id = wo_data["id"]
    task_payload = {"name": "Montáž centrální jednotky"}
    task_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers(admin_token)), 201)
    task_id = task_data["id"]

    # --- KROK 7: POKROČILÉ TESTOVÁNÍ DOCHÁZKY ---
    print_step("Logging in as Employee")
    employee_login_payload = {"email": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    employee_token = print_result(requests.post(f"{BASE_URL}/auth/login", json=employee_login_payload), 200)["access_token"]
    
    # Dnešní datum pro testování
    test_date = date.today()
    
    print_step("Employee logs a full day of work (8:00 - 16:00)")
    start_work = datetime.combine(test_date, datetime.min.time()).replace(hour=8)
    end_work = start_work.replace(hour=16)
    work_payload = {
        "start_time": start_work.isoformat(), "end_time": end_work.isoformat(),
        "entry_type": "work", "work_type_id": work_type_id, "task_id": task_id
    }
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=work_payload, headers=get_headers(employee_token)), 201)

    print_step("Employee logs a doctor's visit (10:00 - 11:00) -> should split the work block")
    start_doctor = start_work.replace(hour=10)
    end_doctor = start_work.replace(hour=11)
    doctor_payload = {
        "start_time": start_doctor.isoformat(), "end_time": end_doctor.isoformat(),
        "entry_type": "doctor"
    }
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=doctor_payload, headers=get_headers(employee_token)), 201)
    
    print_step("Verifying the day's schedule was split into 3 blocks")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/time-logs?work_date={test_date.isoformat()}", headers=get_headers(employee_token))
    day_logs = print_result(response, 200)
    
    if len(day_logs) == 3:
        print("  \033[92mVERIFICATION SUCCESS: Found 3 time blocks as expected.\033[0m")
    else:
        print(f"  \033[91mVERIFICATION FAILED: Expected 3 time blocks, but found {len(day_logs)}.\033[0m")
        raise AssertionError("Block splitting logic failed.")

    print_step("Employee requests a vacation for tomorrow")
    tomorrow = test_date + timedelta(days=1)
    start_vacation = datetime.combine(tomorrow, datetime.min.time())
    end_vacation = datetime.combine(tomorrow, datetime.max.time())
    vacation_payload = {
        "start_time": start_vacation.isoformat(), "end_time": end_vacation.isoformat(),
        "entry_type": "vacation", "notes": "Plánovaná dovolená"
    }
    vacation_log = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=vacation_payload, headers=get_headers(employee_token)), 201)
    
    print_step("Admin approves the vacation request")
    status_payload = {"status": "approved"}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs/{vacation_log['id']}/status", json=status_payload, headers=get_headers(admin_token)), 200)

    print("\n" + "="*50)
    print("\033[92mAll tests completed successfully!\033[0m")
    print("="*50)


if __name__ == "__main__":
    try:
        run_tests()
    except requests.exceptions.ConnectionError:
        print("\n\033[91mFATAL ERROR: Could not connect to the API server.\033[0m")
        print(f"Please make sure the backend is running at {BASE_URL}")
    except AssertionError:
        print(f"\n\033[91m--- TEST FAILED ---\033[0m")
    except Exception as e:
        print(f"\n\033[91mAn unexpected error occurred: {e}\033[0m")