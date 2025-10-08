Jasně, tady je nová, podrobná API dokumentace vygenerovaná na základě poskytnutých souborů. Dokumentace je strukturovaná, aby byla přehledná a snadno použitelná pro vývojáře.

---

# API Dokumentace - Appartus Company Management

Tato dokumentace popisuje REST API pro aplikaci Appartus, která slouží ke správě firem, zaměstnanců, skladových zásob, zakázek a docházky.

**Base URL:** `http://127.0.0.1:8000`

## 1. Autentizace

API používá **Bearer tokeny** (JWT) pro autentizaci. Pro přístup k chráněným endpointům je nutné v hlavičce každého požadavku zaslat token.

**Hlavička:** `Authorization: Bearer <váš_access_token>`

### Získání tokenu

Token získáte přihlášením existujícího uživatele.

#### `POST /auth/login`

Přihlásí uživatele a vrátí JWT token. Endpoint očekává data ve formátu `application/x-www-form-urlencoded`, nikoliv JSON.

**Request Body (`x-www-form-urlencoded`):**
*   `username` (string, required): E-mailová adresa uživatele.
*   `password` (string, required): Heslo uživatele.

**Success Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Error Response (401 Unauthorized):**
*   Pokud jsou přihlašovací údaje neplatné.

---

## 2. Správa Uživatelů a Firem

### 2.1. Registrace a Přihlášení (`/auth`)

#### `POST /auth/register_company`
Založí novou firmu a jejího prvního uživatele s rolí "owner".

*   **Status Code:** `201 Created`
*   **Request Body:** `RegisterCompanyIn`
*   **Response Body:** `CompanyOut`

### 2.2. Firmy (`/companies`)

#### `GET /companies/{company_id}`
Získá detailní informace o firmě.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Path Parameters:**
    *   `company_id` (integer): ID firmy.
*   **Response Body:** `CompanyOut`

#### `PATCH /companies/{company_id}/billing`
Aktualizuje fakturační údaje firmy.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Path Parameters:**
    *   `company_id` (integer): ID firmy.
*   **Request Body:** `CompanyBillingInfoIn`
*   **Response Body:** `CompanyOut`

### 2.3. Členové (`/companies/{company_id}/members`)

#### `GET /companies/{company_id}/members`
Získá seznam všech členů (uživatelů) v dané firmě.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `List[MemberOut]`

#### `POST /companies/{company_id}/members`
Přidá nového člena do firmy. Pokud uživatel s daným e-mailem neexistuje, vytvoří ho. Pokud existuje, pouze ho přidá do firmy.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Status Code:** `201 Created`
*   **Request Body:** `MemberCreateIn`
*   **Response Body:** `MemberOut`

#### `PATCH /companies/{company_id}/members/{user_id}`
Změní roli člena ve firmě.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Path Parameters:**
    *   `user_id` (integer): ID uživatele, kterému se mění role.
*   **Request Body:** `MemberUpdateIn`
*   **Response Body:** `MemberOut`

#### `DELETE /companies/{company_id}/members/{user_id}`
Odebere člena z firmy.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Status Code:** `204 No Content`

#### `GET /companies/{company_id}/members/{user_id}/tasks`
Získá seznam všech úkolů přiřazených konkrétnímu členovi. Běžný uživatel vidí jen své úkoly, admin vidí úkoly kohokoliv.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `List[AssignedTaskOut]`

#### `GET /companies/{company_id}/members/{user_id}/hours-summary`
Získá měsíční souhrn odpracovaných (a neodpracovaných) hodin pro daného člena.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Query Parameters:**
    *   `year` (integer, required)
    *   `month` (integer, required)
*   **Response Body:** `MonthlyHoursSummaryOut`

### 2.4. Pozvánky (`/invites`)

#### `POST /invites/companies/{company_id}`
Vytvoří a odešle pozvánku pro nového člena na zadaný e-mail.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Status Code:** `201 Created`
*   **Request Body:** `InviteCreateIn`
*   **Response Body:** `InviteOut`

#### `POST /invites/accept`
Přijme pozvánku pomocí tokenu. Pokud uživatel neexistuje, vytvoří ho.
*   **Auth:** Nevyžaduje se.
*   **Request Body:** `InviteAcceptIn`
*   **Response Body:** `UserOut`

---

## 3. Sklad a Inventář

### 3.1. Skladové položky (`/companies/{company_id}/inventory`)

#### `GET /companies/{company_id}/inventory`
Získá seznam všech položek ve skladu.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Query Parameters:**
    *   `category_id` (integer, optional): Filtruje položky podle kategorie (včetně podkategorií).
    *   `skip` (integer, optional, default: 0)
    *   `limit` (integer, optional, default: 100)
*   **Response Body:** `List[InventoryItemOut]`

#### `POST /companies/{company_id}/inventory`
Vytvoří novou položku ve skladu s nulovým množstvím.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Status Code:** `201 Created`
*   **Request Body:** `InventoryItemCreateIn`
*   **Response Body:** `InventoryItemOut`

#### `GET /companies/{company_id}/inventory/{item_id}`
Získá detail konkrétní skladové položky.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `InventoryItemOut`

#### `PATCH /companies/{company_id}/inventory/{item_id}`
Aktualizuje vlastnosti skladové položky (název, SKU, cena atd.). Množství se mění přes endpointy pro pohyby.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Request Body:** `InventoryItemUpdateIn`
*   **Response Body:** `InventoryItemOut`

#### `DELETE /companies/{company_id}/inventory/{item_id}`
Smaže skladovou položku. Lze smazat pouze položku s nulovým celkovým stavem.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Status Code:** `204 No Content`

#### `POST /companies/{company_id}/inventory/{item_id}/upload-image`
Nahraje obrázek k položce. Očekává `multipart/form-data`.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Request Body (`form-data`):**
    *   `file` (file, required): Obrázek k nahrání.
*   **Response Body:** `InventoryItemOut`

#### `GET /companies/{company_id}/inventory/by-ean/{ean}`
Získá skladovou položku podle jejího EAN kódu.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `InventoryItemOut`

### 3.2. Skladové lokace (`/companies/{company_id}/locations`)

#### `GET /companies/{company_id}/locations`
Získá seznam všech definovaných skladových lokací.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Response Body:** `List[LocationOut]`

#### `POST /companies/{company_id}/locations`
Vytvoří novou skladovou lokaci.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Status Code:** `201 Created`
*   **Request Body:** `LocationCreateIn`
*   **Response Body:** `LocationOut`

#### `PATCH /companies/{company_id}/locations/{location_id}`
Upraví název nebo popis lokace.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Request Body:** `LocationUpdateIn`
*   **Response Body:** `LocationOut`

#### `DELETE /companies/{company_id}/locations/{location_id}`
Smaže lokaci. Lze smazat pouze lokaci, na které není žádné zboží.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Status Code:** `204 No Content`

### 3.3. Skladové pohyby (`/companies/{company_id}/inventory/movements`)

#### `POST /companies/{company_id}/inventory/movements/place`
Naskladní zadané množství položky na konkrétní lokaci.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Request Body:** `PlaceStockIn`
*   **Response Body:** `InventoryItemOut` (vrací aktualizovaný stav celé položky)

#### `POST /companies/{company_id}/inventory/movements/transfer`
Přesune zadané množství položky z jedné lokace na druhou.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Request Body:** `TransferStockIn`
*   **Response Body:** `InventoryItemOut` (vrací aktualizovaný stav celé položky)

### 3.4. Kategorie (`/companies/{company_id}/categories`)
Standardní CRUD operace pro správu stromové struktury kategorií skladových položek.

### 3.5. Auditní log (`/companies/{company_id}/audit-logs`)

#### `GET /companies/{company_id}/audit-logs`
Získá historii všech skladových pohybů a změn.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Query Parameters:**
    *   `item_id` (integer, optional): Filtruje historii pro konkrétní položku.
    *   `user_id` (integer, optional): Filtruje akce provedené konkrétním uživatelem.
    *   `start_date` (date, optional): Formát `YYYY-MM-DD`.
    *   `end_date` (date, optional): Formát `YYYY-MM-DD`.
    *   `skip` (integer, optional, default: 0)
    *   `limit` (integer, optional, default: 100)
*   **Response Body:** `List[AuditLogOut]`

---

## 4. Zakázky a Úkoly

### 4.1. Klienti (`/companies/{company_id}/clients`)
Standardní CRUD operace pro správu klientů.

#### `GET /companies/{company_id}/clients/{client_id}/billing-report`
Agreguje veškerou práci a materiál pro klienta napříč všemi jeho zakázkami za dané období.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Query Parameters:**
    *   `start_date` (date, required)
    *   `end_date` (date, required)
*   **Response Body:** `ClientBillingReportOut`

### 4.2. Druhy práce (`/companies/{company_id}/work-types`)
Standardní CRUD operace pro správu druhů práce a jejich sazeb.

### 4.3. Zakázky (`/companies/{company_id}/work-orders`)

#### `GET /companies/{company_id}/work-orders`
Získá seznam všech zakázek.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `List[WorkOrderOut]`

#### `POST /companies/{company_id}/work-orders`
Vytvoří novou zakázku.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Status Code:** `201 Created`
*   **Request Body:** `WorkOrderCreateIn`
*   **Response Body:** `WorkOrderOut`

#### `GET /companies/{company_id}/work-orders/{work_order_id}`
Získá detail jedné zakázky.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `WorkOrderOut`

#### `PATCH /companies/{company_id}/work-orders/{work_order_id}`
Upraví zakázku.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Request Body:** `WorkOrderUpdateIn`
*   **Response Body:** `WorkOrderOut`

#### `POST /companies/{company_id}/work-orders/{work_order_id}/status`
Změní stav zakázky.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Request Body:** `WorkOrderStatusUpdateIn`
*   **Response Body:** `WorkOrderOut`

#### `POST /companies/{company_id}/work-orders/{work_order_id}/copy`
Vytvoří kopii zakázky včetně jejích úkolů.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Status Code:** `201 Created`
*   **Response Body:** `WorkOrderOut`

#### `GET /companies/{company_id}/work-orders/{work_order_id}/billing-report`
Vygeneruje podklady pro fakturaci pro jednu konkrétní zakázku.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Query Parameters:**
    *   `start_date` (date, optional)
    *   `end_date` (date, optional)
*   **Response Body:** `BillingReportOut`

### 4.4. Úkoly (`/companies/{company_id}/work-orders/{work_order_id}/tasks`)
Standardní CRUD operace pro správu úkolů v rámci zakázky.

#### `POST /companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/assign`
Přiřadí úkol konkrétnímu zaměstnanci.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Request Body:** `TaskAssignIn`
*   **Response Body:** `TaskOut`

#### `POST /companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory`
Zaznamená spotřebovaný materiál k úkolu a sníží jeho stav na dané lokaci.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Request Body:** `UsedItemCreateIn`
*   **Response Body:** `TaskOut`

#### `GET /companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/total-hours`
Vrátí celkový počet odpracovaných hodin na úkolu.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `TaskTotalHoursOut`

#### `GET /companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/time-logs`
Vrátí chronologický seznam všech záznamů docházky (aktivit) pro daný úkol.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Response Body:** `List[TimeLogOut]`

---

## 5. Docházka

### `GET /companies/{company_id}/time-logs`
Získá seznam záznamů docházky s možností filtrování.
*   **Auth:** Vyžaduje přístup k firmě (admin vidí vše, člen jen své).
*   **Query Parameters:**
    *   `user_id` (integer, optional)
    *   `start_date` (date, optional)
    *   `end_date` (date, optional)
*   **Response Body:** `List[TimeLogOut]`

### `POST /companies/{company_id}/time-logs`
Vytvoří nový záznam v docházce. Systém automaticky řeší překryvy s existujícími záznamy.
*   **Auth:** Vyžaduje přístup k firmě.
*   **Status Code:** `201 Created`
*   **Request Body:** `TimeLogCreateIn`
*   **Response Body:** `TimeLogOut`

---

## 6. Nastavení

### 6.1. SMTP (`/companies/{company_id}/smtp-settings`)

#### `GET /companies/{company_id}/smtp-settings`
Získá aktuální nastavení SMTP serveru pro odesílání e-mailů. Heslo se nevrací.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Response Body:** `SmtpSettingsOut`

#### `PUT /companies/{company_id}/smtp-settings`
Vytvoří nebo aktualizuje nastavení SMTP serveru.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Request Body:** `SmtpSettingsIn`
*   **Response Body:** `SmtpSettingsOut`

#### `POST /companies/{company_id}/smtp-settings/test`
Odešle testovací e-mail pro ověření funkčnosti SMTP nastavení.
*   **Auth:** Vyžaduje oprávnění administrátora.
*   **Request Body:** `SmtpTestIn`
*   **Response Body:** Potvrzující zpráva.

### 6.2. Notifikační triggery (`/companies/{company_id}/triggers`)
Standardní CRUD operace pro správu automatických notifikací (např. při nízkém stavu zásob nebo překročení rozpočtu zakázky).

---

## 7. Datové Modely (Schémata)

(Zde je zkrácený výběr nejdůležitějších modelů pro přehlednost)

<details>
<summary><strong>RegisterCompanyIn</strong> (Request)</summary>

```json
{
  "company_name": "string",
  "slug": "string",
  "admin_email": "user@example.com",
  "admin_password": "string",
  "logo_url": "string" /* optional */
}
```
</details>

<details>
<summary><strong>CompanyOut</strong> (Response)</summary>

```json
{
  "id": 0,
  "name": "string",
  "slug": "string",
  "logo_url": "string", /* optional */
  "legal_name": "string", /* optional */
  "address": "string", /* optional */
  "ico": "string", /* optional */
  "dic": "string", /* optional */
  "executive": "string", /* optional */
  "bank_account": "string", /* optional */
  "iban": "string" /* optional */
}
```
</details>

<details>
<summary><strong>InventoryItemOut</strong> (Response)</summary>

```json
{
  "name": "string",
  "sku": "string",
  "description": "string", /* optional */
  "category_id": 0, /* optional */
  "ean": "string", /* optional */
  "image_url": "string", /* optional */
  "price": 0.0, /* optional */
  "vat_rate": 0.0, /* optional */
  "is_monitored_for_stock": false,
  "low_stock_threshold": 0, /* optional */
  "id": 0,
  "company_id": 0,
  "category": { /* CategoryOut */ }, /* optional */
  "locations": [
    {
      "quantity": 0,
      "location": { /* LocationOut */ }
    }
  ],
  "total_quantity": 0 /* computed field */
}
```
</details>

<details>
<summary><strong>WorkOrderOut</strong> (Response)</summary>

```json
{
  "name": "string",
  "description": "string", /* optional */
  "client_id": 0, /* optional */
  "budget_hours": 0.0, /* optional */
  "id": 0,
  "company_id": 0,
  "status": "string",
  "tasks": [
    {
      "id": 0,
      "name": "string",
      "status": "string"
    }
  ],
  "client": { /* ClientOut */ } /* optional */
}
```
</details>

<details>
<summary><strong>TimeLogCreateIn</strong> (Request)</summary>

```json
{
  "start_time": "2023-10-27T08:00:00Z",
  "end_time": "2023-10-27T16:30:00Z",
  "entry_type": "work", /* "work", "vacation", "sick_day", "doctor", "unpaid_leave" */
  "notes": "string", /* optional */
  
  /* Fields for "work" entry_type only */
  "work_type_id": 1,
  "task_id": 2, /* OR new_task */
  "new_task": { /* optional */
    "work_order_id": 5,
    "name": "Nový úkol vytvořený z docházky"
  },
  "break_duration_minutes": 30,
  "is_overtime": false
}
```
</details>