# backend/tests.py
import sys
import os
import requests
import time
from datetime import datetime, date

# --- NAČTENÍ KONFIGURACE Z PROSTŘEDÍ ---
try:
    from dotenv import load_dotenv
    load_dotenv()
    print("Loaded environment variables from .env file.")
except ImportError:
    print("python-dotenv not found, reading variables from OS environment.")

# --- Konfigurace pro SKUTEČNÝ SMTP server ---
TEST_SMTP_HOST = os.getenv("TEST_SMTP_HOST")
TEST_SMTP_PORT = int(os.getenv("TEST_SMTP_PORT", 587))
TEST_SMTP_USER = os.getenv("TEST_SMTP_USER")
TEST_SMTP_PASSWORD = os.getenv("TEST_SMTP_PASSWORD")
TEST_SMTP_SENDER = os.getenv("TEST_SMTP_SENDER")
TEST_SMTP_RECIPIENT = os.getenv("TEST_SMTP_RECIPIENT")

SMTP_CONFIGURED = all([TEST_SMTP_HOST, TEST_SMTP_USER, TEST_SMTP_PASSWORD, TEST_SMTP_SENDER, TEST_SMTP_RECIPIENT])

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


# --- Hlavní testovací funkce ---
def run_tests():
    global admin_token, employee_token, company_id, employee_user_id

    # 1. Registrace, přihlášení
    print_step("1. User & Company Setup")
    reg_payload = {"company_name": f"Test Co {timestamp}", "slug": f"test-co-{timestamp}", "admin_email": ADMIN_EMAIL, "admin_password": ADMIN_PASSWORD}
    company_data = print_result(requests.post(f"{BASE_URL}/auth/register_company", json=reg_payload), 201)
    company_id = company_data["id"]

    login_payload = {"username": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    admin_token = print_result(requests.post(f"{BASE_URL}/auth/login", data=login_payload), 200)["access_token"]
    
    # 2. SMTP Konfigurace a test
    print_step("2. SMTP Configuration and Testing")
    
    if not SMTP_CONFIGURED:
        print("  \033[93mWARNING: SMTP environment variables not set. Skipping email tests.\033[0m")
    else:
        print(f"  - Setting up SMTP to point to {TEST_SMTP_HOST}:{TEST_SMTP_PORT}...")
        smtp_payload = {
            "is_enabled": True, "smtp_host": TEST_SMTP_HOST, "smtp_port": TEST_SMTP_PORT,
            "smtp_user": TEST_SMTP_USER, "smtp_password": TEST_SMTP_PASSWORD,
            "sender_email": TEST_SMTP_SENDER, 
            "security_protocol": "tls", 
            "notification_settings": {
                "on_invite_created": True,
                "on_budget_alert": True,
                "on_low_stock_alert": True
            }
        }
        print_result(requests.put(f"{BASE_URL}/companies/{company_id}/smtp-settings", json=smtp_payload, headers=get_headers()), 200)
        print("  - Sending a test email...")
        test_email_payload = {"recipient_email": TEST_SMTP_RECIPIENT}
        print_result(requests.post(f"{BASE_URL}/companies/{company_id}/smtp-settings/test", json=test_email_payload, headers=get_headers()), 200)
        print(f"  \033[94mINFO: Test email should have been sent to {TEST_SMTP_RECIPIENT}. Please verify manually.\033[0m")

    # 3. Pozvání zaměstnance
    print_step("3. Inviting Employee")
    invite_payload = {"email": EMPLOYEE_EMAIL, "role": "member"}
    invite_data = print_result(requests.post(f"{BASE_URL}/invites/companies/{company_id}", json=invite_payload, headers=get_headers()), 201)
    
    if SMTP_CONFIGURED:
        print(f"  \033[94mINFO: Invitation email for {EMPLOYEE_EMAIL} should have been sent. Please verify manually.\033[0m")
    
    accept_payload = {"token": invite_data["token"], "password": ADMIN_PASSWORD}
    employee_data = print_result(requests.post(f"{BASE_URL}/invites/accept", json=accept_payload), 200)
    employee_user_id = employee_data["id"]
    employee_login_payload = {"username": EMPLOYEE_EMAIL, "password": ADMIN_PASSWORD}
    employee_token = print_result(requests.post(f"{BASE_URL}/auth/login", data=employee_login_payload), 200)["access_token"]
        
    # 4. Nastavení fakturačních údajů
    print_step("4. Setting Billing Information")
    company_billing_payload = {"ico": "12345678", "dic": "CZ12345678", "address": "Testovací 1, Praha"}
    print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/billing", json=company_billing_payload, headers=get_headers()), 200)
    client_payload = {"name": "Billing Client", "ico": "87654321"}
    client_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/clients", json=client_payload, headers=get_headers()), 201)
    client_id = client_data["id"]
        
    # 5. Nastavení skladu a práce
    print_step("5. Setting up Work Types and Inventory")
    item_payload = {"name": "Monitorable Item", "sku": f"MON-{timestamp}", "price": 500.0}
    item_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory", json=item_payload, headers=get_headers()), 201)
    item_id = item_data["id"]
    work_type_payload = {"name": "Test Work", "rate": 1000.0}
    work_type_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-types", json=work_type_payload, headers=get_headers()), 201)
    work_type_id = work_type_data["id"]

    # 6. Inventory a Location Management
    print_step("6. Inventory and Location Management")
    loc_a_payload = {"name": "Main Warehouse"}
    loc_a_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/locations", json=loc_a_payload, headers=get_headers()), 201)
    loc_a_id = loc_a_data["id"]
    place_payload = {"inventory_item_id": item_id, "location_id": loc_a_id, "quantity": 15}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/inventory/movements/place", json=place_payload, headers=get_headers()), 200)
    
    # 7. Nastavení triggerů
    print_step("7. Setting up Notification Triggers")
    if SMTP_CONFIGURED and TEST_SMTP_RECIPIENT:
        print("  - Creating low stock trigger...")
        stock_trigger_payload = {
            "is_active": True, "trigger_type": "inventory_low_stock",
            "condition": "quantity_below", "threshold_value": 10,
            "recipient_emails": [TEST_SMTP_RECIPIENT]
        }
        print_result(requests.post(f"{BASE_URL}/companies/{company_id}/triggers", json=stock_trigger_payload, headers=get_headers()), 201)

        print("  - Creating work order budget trigger...")
        budget_trigger_payload = {
            "is_active": True, "trigger_type": "work_order_budget",
            "condition": "percentage_reached", "threshold_value": 80,
            "recipient_emails": [TEST_SMTP_RECIPIENT]
        }
        print_result(requests.post(f"{BASE_URL}/companies/{company_id}/triggers", json=budget_trigger_payload, headers=get_headers()), 201)

        print("  - Enabling stock monitoring for the item...")
        monitor_payload = {"is_monitored_for_stock": True, "low_stock_threshold": 10}
        print_result(requests.patch(f"{BASE_URL}/companies/{company_id}/inventory/{item_id}", json=monitor_payload, headers=get_headers()), 200)

    # 8. Vytvoření zakázky a úkolu pro test triggerů
    print_step("8. Creating Work Order and Task for Trigger Test")
    wo_payload = {"name": "Budget Test Work Order", "client_id": client_id, "budget_hours": 10.0}
    wo_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders", json=wo_payload, headers=get_headers()), 201)
    work_order_id = wo_data["id"]
    
    task_payload = {"name": "Budget Test Task"}
    task_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks", json=task_payload, headers=get_headers()), 201)
    task_id = task_data["id"]

     # 9. Překročení prahů a záznam docházky
    print_step("9. Exceeding Thresholds & Logging Time")
    print("  - Logging work to exceed 80% of budget...")
    test_date = date.today()
    start_work = datetime.combine(test_date, datetime.min.time()).replace(hour=8)
    end_work = start_work.replace(hour=16, minute=30) # 8.5 hodiny > 80% z 10h
    work_payload = {"start_time": start_work.isoformat(), "end_time": end_work.isoformat(), "entry_type": "work", "work_type_id": work_type_id, "task_id": task_id}
    # --- ZMĚNA: Uložíme si odpověď pro pozdější kontrolu ---
    work_log_data = print_result(requests.post(f"{BASE_URL}/companies/{company_id}/time-logs", json=work_payload, headers=get_headers("employee")), 201)
    work_log_id = work_log_data['id']

    print("  - Using inventory to go below stock threshold...")
    use_item_payload = {"inventory_item_id": item_id, "quantity": 6, "from_location_id": loc_a_id} # 15 - 6 = 9 < 10
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory", json=use_item_payload, headers=get_headers()), 200)
    
    # 10. Přiřazení úkolů a ověření nových endpointů
    print_step("10. Assigning tasks and verifying new endpoints")
    print("  - Assigning task to the employee...")
    assign_payload = {"assignee_id": employee_user_id}
    print_result(requests.post(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/assign", json=assign_payload, headers=get_headers()), 200)

    print("  - Verifying employee can see their own tasks...")
    assigned_tasks_response = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/members/{employee_user_id}/tasks", headers=get_headers("employee")), 200)
    assert len(assigned_tasks_response) == 1
    assert assigned_tasks_response[0]["id"] == task_id

    print("  - Verifying total hours for the task...")
    total_hours_response = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/total-hours", headers=get_headers()), 200)
    assert total_hours_response["total_hours"] == 8.5
    assert total_hours_response["task_id"] == task_id

    # --- NOVÝ TEST ---
    print("  - Verifying activity feed for the task...")
    activity_feed_response = print_result(requests.get(f"{BASE_URL}/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/time-logs", headers=get_headers()), 200)
    assert len(activity_feed_response) == 1
    assert activity_feed_response[0]['id'] == work_log_id
    assert activity_feed_response[0]['entry_type'] == 'work'
    assert activity_feed_response[0]['user']['email'] == EMPLOYEE_EMAIL

    # 11. Manuální spuštění a ověření triggerů
    print_step("11. Manually Running and Verifying Triggers")
    if SMTP_CONFIGURED:
        print("  - Running trigger check via internal endpoint...")
        print_result(requests.post(f"{BASE_URL}/internal/run-triggers?company_id={company_id}", headers=get_headers()), 200)
        print(f"  \033[94mINFO: Two alert emails (low stock, budget) should have been sent to {TEST_SMTP_RECIPIENT}. Please verify manually.\033[0m")
        time.sleep(2)
        
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