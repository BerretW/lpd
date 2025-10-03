import requests
import random
import time

# --- Konfigurace ---
BASE_URL = "http://127.0.0.1:8000"
# Unikátní email, aby test mohl běžet vícekrát
ADMIN_EMAIL = f"test.admin.{int(time.time())}@example.com"
ADMIN_PASSWORD = "TestPassword123!"

# Globální proměnné pro uložení stavu
access_token = None
company_id = None

# --- Pomocné funkce ---

def print_step(title):
    print("\n" + "="*50)
    print(f" STEP: {title}")
    print("="*50)

def print_result(response):
    try:
        data = response.json()
        status_code = response.status_code
        if 200 <= status_code < 300:
            print(f"  \033[92mSUCCESS (Status: {status_code})\033[0m")
            # print("  Response:", data) # Odkomentujte pro detailní výpis
            return data
        else:
            print(f"  \033[91mFAILURE (Status: {status_code})\033[0m")
            print("  Error:", data)
            return None
    except requests.exceptions.JSONDecodeError:
        print(f"  \033[91mFAILURE (Status: {response.status_code})\033[0m")
        print("  Error: Response is not valid JSON.")
        return None

def get_headers():
    if not access_token:
        raise ValueError("Access token not available. Please login first.")
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

# --- Testovací scénář ---

def run_tests():
    global access_token, company_id

    # 1. Registrace společnosti
    print_step("Registering a new company and admin user")
    reg_payload = {
        "company_name": f"Test Company {random.randint(100, 999)}",
        "slug": f"test-company-{int(time.time())}",
        "admin_email": ADMIN_EMAIL,
        "admin_password": ADMIN_PASSWORD,
    }
    response = requests.post(f"{BASE_URL}/auth/register_company", json=reg_payload)
    company_data = print_result(response)
    if not company_data: return
    company_id = company_data["id"]

    # 2. Přihlášení
    print_step("Logging in as the new admin")
    login_payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    response = requests.post(f"{BASE_URL}/auth/login", json=login_payload)
    login_data = print_result(response)
    if not login_data: return
    access_token = login_data["access_token"]
    
    # --- Správa klientů ---
    print_step("Creating a new client")
    client_payload = {"name": "Test Client Alpha", "email": "alpha@test.com"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers())
    client_data = print_result(response)
    if not client_data: return
    client_id = client_data["id"]

    print_step("Listing all clients")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/clients", headers=get_headers())
    print_result(response)
    
    # --- Správa skladu a kategorií ---
    print_step("Creating an inventory category")
    category_payload = {"name": "PZTS"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/categories", json=category_payload, headers=get_headers())
    category_data = print_result(response)
    if not category_data: return
    category_id = category_data["id"]

    print_step("Creating an inventory item")
    item_payload = {
        "name": "PIR Sensor", "sku": f"PIR-{random.randint(1000, 9999)}",
        "quantity": 50, "price": 120.50, "vat_rate": 21.0,
        "category_id": category_id,
    }
    response = requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers())
    item_data = print_result(response)
    if not item_data: return
    item_id = item_data["id"]

    print_step("Listing all inventory items")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/inventory", headers=get_headers())
    print_result(response)
    
    # --- Správa druhů práce ---
    print_step("Creating a work type")
    work_type_payload = {"name": "Standardní instalace", "rate": 450.0}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-types", json=work_type_payload, headers=get_headers())
    work_type_data = print_result(response)
    if not work_type_data: return
    work_type_id = work_type_data["id"]

    # --- Správa zakázek a úkolů ---
    print_step("Creating a work order for the client")
    work_order_payload = {"name": "Instalace v objektu A", "client_id": client_id}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=work_order_payload, headers=get_headers())
    work_order_data = print_result(response)
    if not work_order_data: return

    print_step("Creating a work order for the client")
    work_order_payload = {"name": "Instalace v objektu A", "client_id": client_id}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=work_order_payload, headers=get_headers())
    work_order_data = print_result(response)
    if not work_order_data: return
    work_order_id = work_order_data["id"]

    print_step("Creating a new task inside the work order")
    task_payload = {"name": "Montáž centrální jednotky", "description": "Umístit na zeď dle projektu."}
    # Používáme novou cestu k endpointu
    response = requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers())
    task_data = print_result(response)
    if not task_data: return
    task_id = task_data["id"]

    # --- Správa odpracovaných hodin ---
    print_step("Logging time for the new task")
    time_log_payload = {
        "task_id": task_id,
        "work_type_id": work_type_id,
        "hours": 3.5,
        "work_date": "2025-10-26",
        "notes": "Montáž a zapojení senzorů."
    }
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=time_log_payload, headers=get_headers())
    time_log_data = print_result(response)
    if not time_log_data: return
    time_log_id = time_log_data["id"]
    
    print_step("Listing my time logs")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/time-logs", headers=get_headers())
    print_result(response)
    
    print_step("Admin approves the time log")
    status_payload = {"status": "approved"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs/{time_log_id}/status", json=status_payload, headers=get_headers())
    print_result(response)
    
    # --- Správa odpracovaných hodin ---
    print_step("Logging time for a task")
    time_log_payload = {
        "task_id": task_id,
        "work_type_id": work_type_id,
        "hours": 3.5,
        "work_date": "2025-10-26",
        "notes": "Montáž a zapojení senzorů."
    }
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=time_log_payload, headers=get_headers())
    time_log_data = print_result(response)
    if not time_log_data: return
    time_log_id = time_log_data["id"]
    
    print_step("Listing my time logs")
    response = requests.get(f"{BASE_URL}/companies/{company_id}/time-logs", headers=get_headers())
    print_result(response)
    
    print_step("Admin approves the time log")
    status_payload = {"status": "approved"}
    response = requests.post(f"{BASE_URL}/companies/{company_id}/time-logs/{time_log_id}/status", json=status_payload, headers=get_headers())
    print_result(response)

    # --- Závěr ---
    print("\n" + "="*50)
    print("\033[92mAll tests completed successfully!\033[0m")
    print("="*50)


if __name__ == "__main__":
    try:
        run_tests()
    except requests.exceptions.ConnectionError:
        print("\n\033[91mFATAL ERROR: Could not connect to the API server.\033[0m")
        print(f"Please make sure the backend is running at {BASE_URL}")
    except Exception as e:
        print(f"\n\033[91mAn unexpected error occurred: {e}\033[0m")