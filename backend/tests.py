import requests
import random
import time
from datetime import datetime

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
        # Ukončíme skript při první chybě
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
    
    # 2. Správa členů (pozvání a přijetí zaměstnance)
    print_step("Admin invites a new employee")
    invite_payload = {"email": EMPLOYEE_EMAIL, "role": "member"}
    response = requests.post(f"{BASE_URL}/invites/companies/{company_id}", json=invite_payload, headers=get_headers(admin_token))
    invite_data = print_result(response, 201)
    invite_token = invite_data["token"]
    
    print_step("New employee accepts the invite")
    accept_payload = {"token": invite_token, "password": ADMIN_PASSWORD} # Použijeme stejné heslo pro jednoduchost
    response = requests.post(f"{BASE_URL}/invites/accept", json=accept_payload)
    employee_data = print_result(response, 200)
    employee_user_id = employee_data["id"]

    # 3. Správa klientů
    print_step("Creating a new client")
    client_payload = {"name": "Test Client Alpha", "email": "alpha@test.com"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers(admin_token))
    client_data = print_result(response, 201)
    client_id = client_data["id"]

    # 4. Sklad a kategorie
    print_step("Creating an inventory category and item")
    category_payload = {"name": "Senzory"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/categories", json=category_payload, headers=get_headers(admin_token))
    category_data = print_result(response, 201)
    category_id = category_data["id"]
    item_payload = {"name": "PIR Sensor", "sku": f"PIR-{timestamp}", "quantity": 50, "price": 120.50, "vat_rate": 21.0, "category_id": category_id}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers(admin_token))
    item_data = print_result(response, 201)
    item_id = item_data["id"]

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
    
    print_step("Listing tasks to verify creation")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", headers=get_headers(admin_token))
    print_result(response, 200)

    print_step("Updating the task")
    update_payload = {"name": "Montáž a zapojení centrální jednotky"}
    response = requests.patch(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}", json=update_payload, headers=get_headers(admin_token))
    print_result(response, 200)
    
    print_step("Assigning the task to the employee")
    assign_payload = {"assignee_id": employee_user_id}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/assign", json=assign_payload, headers=get_headers(admin_token))
    print_result(response, 200)

    print_step("Un-assigning the task")
    unassign_payload = {"assignee_id": None}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/assign", json=unassign_payload, headers=get_headers(admin_token))
    print_result(response, 200)

    # 7. Workflow odpracovaných hodin
    print_step("Employee logs time for the task")
    log_payload = {"task_id": task_id, "work_type_id": work_type_id, "hours": 3.5, "work_date": datetime.now().strftime('%Y-%m-%d')}
    # Potřebujeme token zaměstnance, přihlásíme ho
    employee_login_payload = {"email": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    response = requests.post(f"{BASE_URL}/auth/login", json=employee_login_payload)
    employee_token_data = print_result(response, 200)
    employee_token = employee_token_data["access_token"]
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=log_payload, headers=get_headers(employee_token))
    time_log_data = print_result(response, 201)
    time_log_id = time_log_data["id"]
    
    print_step("Employee updates their time log")
    update_log_payload = {"notes": "Práce šla dobře."}
    response = requests.patch(f"{BASE_URL}/companies/{company_id}/time-logs/{time_log_id}", json=update_log_payload, headers=get_headers(employee_token))
    print_result(response, 200)
    
    print_step("Admin approves the time log")
    status_payload = {"status": "approved"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs/{time_log_id}/status", json=status_payload, headers=get_headers(admin_token))
    print_result(response, 200)
    
    print_step("Employee creates another log and then deletes it")
    another_log_payload = {"task_id": task_id, "work_type_id": work_type_id, "hours": 1.0, "work_date": datetime.now().strftime('%Y-%m-%d')}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=another_log_payload, headers=get_headers(employee_token))
    another_log_data = print_result(response, 201)
    another_log_id = another_log_data["id"]
    response = requests.delete(f"{BASE_URL}/companies/{company_id}/time-logs/{another_log_id}", headers=get_headers(employee_token))
    print_result(response, 204)

    # 8. Použití materiálu
    print_step("Logging used inventory for the task")
    inventory_payload = {"inventory_item_id": item_id, "quantity": 2}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory", json=inventory_payload, headers=get_headers(admin_token))
    print_result(response, 200)
    
    # 9. Úklid
    print_step("Cleaning up: Deleting the task and the client")
    response = requests.delete(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}", headers=get_headers(admin_token))
    print_result(response, 204)
    response = requests.delete(f"{BASE_URL}/companies/{company_id}/clients/{client_id}", headers=get_headers(admin_token))
    print_result(response, 204)

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
        # Chybová zpráva je již vypsána v print_result
    except Exception as e:
        print(f"\n\033[91mAn unexpected error occurred: {e}\033[0m")