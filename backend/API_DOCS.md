
## Detailní Technická Dokumentace API: Appartus Company Management v1.0

**Poslední aktualizace:** **24. 5. 2024**

### Obsah

* **Klíčové Koncepty**

  * **Autentizace a Autorizace**
  * **Role Uživatelů**
  * **Multi-Tenancy (Oddělení firem)**
* **Základní Nastavení a Spuštění**
* **Referenční Příručka Endpointů**

  * **Auth** **- Autentizace**
  * **Companies** **- Správa firem**
  * **Members** **- Správa členů týmu**
  * **Invites** **- Pozvánky**
  * **Clients** **- Správa klientů**
  * **Inventory & Stock** **- Skladové hospodářství**
  * **Work Orders & Tasks** **- Zakázky a úkoly**
  * **Time Logs** **- Evidence docházky**
  * **System & Notifications** **- SMTP, Triggery, Audit**
* **Datové Modely (Schémata)**

  * **Přehled klíčových Pydantic schémat**

---

### 1. Klíčové Koncepty

#### 1.1. Autentizace a Autorizace

* **Autentizace:** **Probíhá pomocí JWT (JSON Web Tokens) standardu. Každý chráněný požadavek musí obsahovat hlavičku** **Authorization: Bearer <váš_token>**. Token získáte na endpointe **POST /auth/login**.
* **Autorizace:** **Je řízena na dvou úrovních:**

  * **Přístup k firmě (Company Access):** **JWT token obsahuje pole** **tenants**, což je seznam ID firem, ke kterým má uživatel přístup. Každý endpoint, který obsahuje **{company_id}** **v URL, ověřuje, zda se dané ID nachází v tomto seznamu.**
  * **Role (Admin Access):** **Některé operace (mazání, změna nastavení, správa členů) vyžadují vyšší oprávnění. Tyto endpointy dodatečně ověřují, zda má uživatel v dané firmě roli** **owner** **nebo** **admin**.

#### 1.2. Role Uživatelů

* **owner**: Vlastník firmy. Má nejvyšší oprávnění. Vytváří se při registraci firmy.
* **admin**: Administrátor. Má téměř stejná práva jako **owner**, může spravovat většinu aspektů firmy.
* **member**: Běžný člen týmu. Má přístup k základním funkcím, jako je logování práce a prohlížení přiřazených úkolů.

#### 1.3. Multi-Tenancy (Oddělení firem)

**Systém je navržen tak, aby jeden uživatel (jedna e-mailová adresa) mohl být členem více firem. Všechny datové entity jsou striktně odděleny pomocí** **company_id**. Uživatel po přihlášení získá token s přístupem ke všem svým firmám a při každém požadavku specifikuje, v kontextu které firmy (**company_id**) operaci provádí.

---

### 2. Základní Nastavení a Spuštění

**(Tato sekce je shodná s předchozí verzí dokumentace a popisuje, jak aplikaci spustit lokálně.)**

---

### 3. Referenční Příručka Endpointů

#### Auth **- Autentizace**

---

* **Popis:** **Vytvoří novou firmu a k ní přidružený účet s rolí** **owner**.
* **Oprávnění:** **Veřejný.**
* **Tělo požadavku (**RegisterCompanyIn**):**

  **code**JSON

  ```
  {
    "company_name": "Nová Firma s.r.o.",
    "slug": "nova-firma",
    "admin_email": "owner@novafirma.cz",
    "admin_password": "Heslo1234!"
  }
  ```
* **Úspěšná odpověď (**201 Created **-** **CompanyOut**):

  **code**JSON

  ```
  { "id": 1, "name": "Nová Firma s.r.o.", "slug": "nova-firma", "logo_url": null, ... }
  ```

---

* **Popis:** **Ověří přihlašovací údaje a vrátí JWT token.**
* **Oprávnění:** **Veřejný.**
* **Tělo požadavku (**x-www-form-urlencoded**):**

  * **username**: **owner@novafirma.cz**
  * **password**: **Heslo1234!**
* **Úspěšná odpověď (**200 OK **-** **TokenOut**):

  **code**JSON

  ```
  { "access_token": "eyJhbGciOiJI...", "token_type": "bearer" }
  ```
* **Chybové odpovědi:**

  * **401 Unauthorized**: Neplatné přihlašovací údaje.

#### Companies **- Správa firem**

---

* **Popis:** **Získá veřejné a fakturační údaje o firmě.**
* **Oprávnění:** **Člen firmy (**member**,** **admin**, **owner**).
* **Parametry cesty:**

  * **company_id** **(**int**): ID firmy.**
* **Úspěšná odpověď (**200 OK **-** **CompanyOut**):

  **code**JSON

  ```
  { "id": 1, "name": "Nová Firma s.r.o.", "slug": "nova-firma", "ico": "12345678", ... }
  ```
* **Chybové odpovědi:**

  * **403 Forbidden**: Uživatel není členem dané firmy.
  * **404 Not Found**: Firma neexistuje.

---

* **Popis:** **Aktualizuje fakturační údaje firmy.**
* **Oprávnění:** **Administrátor firmy (**admin**,** **owner**).
* **Tělo požadavku (**CompanyBillingInfoIn**):**

  **code**JSON

  ```
  {
    "ico": "12345678",
    "dic": "CZ12345678",
    "address": "Testovací 1, Praha"
  }
  ```
* **Úspěšná odpověď (**200 OK **-** **CompanyOut**): **Aktualizovaná data firmy.**

#### Members **- Správa členů týmu**

---

* **Popis:** **Získá seznam všech členů firmy a jejich rolí.**
* **Oprávnění:** **Člen firmy.**
* **Úspěšná odpověď (**200 OK **-** **List[MemberOut]**):

  **code**JSON

  ```
  [
    {
      "user": { "id": 1, "email": "owner@novafirma.cz" },
      "role": "owner"
    }
  ]
  ```

---

* **Popis:** **Přidá nového člena. Pokud uživatel s daným e-mailem neexistuje, vytvoří se.**
* **Oprávnění:** **Administrátor firmy.**
* **Tělo požadavku (**MemberCreateIn**):**

  **code**JSON

  ```
  {
    "email": "novy.zamestnanec@firma.cz",
    "password": "StartovniHeslo123",
    "role": "member"
  }
  ```
* **Úspěšná odpověď (**201 Created **-** **MemberOut**): **Detail nově vytvořeného členství.**
* **Chybové odpovědi:**

  * **409 Conflict**: Uživatel je již členem této firmy.

#### Invites **- Pozvánky**

---

* **Popis:** **Vytvoří a odešle e-mailovou pozvánku pro nového člena.**
* **Oprávnění:** **Člen firmy.**
* **Tělo požadavku (**InviteCreateIn**):**

  **code**JSON

  ```
  { "email": "zamestnanec@email.cz", "role": "member" }
  ```
* **Úspěšná odpověď (**201 Created **-** **InviteOut**):

  **code**JSON

  ```
  { "id": 1, "email": "zamestnanec@email.cz", "role": "member", "token": "...", "expires_at": "..." }
  ```

---

* **Popis:** **Přijme pozvánku pomocí tokenu. Pokud uživatel neexistuje, vytvoří se s poskytnutým heslem.**
* **Oprávnění:** **Veřejný.**
* **Tělo požadavku (**InviteAcceptIn**):**

  **code**JSON

  ```
  { "token": "...", "password": "MojeNoveHeslo123" }
  ```
* **Úspěšná odpověď (**200 OK **-** **UserOut**): **Detail uživatele, který pozvánku přijal.**
* **Chybové odpovědi:**

  * **400 Bad Request**: Token je neplatný nebo vypršel.

#### Inventory & Stock **- Skladové hospodářství**

**Tato sekce obsahuje endpointy pro správu položek, kategorií, lokací a pohybů.**

---

* **Popis:** **Vytvoří novou skladovou položku.**
* **Oprávnění:** **Administrátor firmy.**
* **Tělo požadavku (**InventoryItemCreateIn**):**

  **code**JSON

  ```
  {
    "name": "Herní Monitor 27 palců",
    "sku": "MON-GAM-27-XYZ",
    "price": 8500.0,
    "category_id": 5
  }
  ```
* **Úspěšná odpověď (**201 Created **-** **InventoryItemOut**): **Detail vytvořené položky.**
* **Chybové odpovědi:**

  * **409 Conflict**: Položka s daným SKU již existuje.

---

* **Popis:** **Získá seznam skladových položek.**
* **Oprávnění:** **Člen firmy.**
* **Parametry dotazu:**

  * **category_id** **(**Optional[int]**): Filtruje položky patřící do dané kategorie a jejích podkategorií.**
  * **skip** **(**int**, default:** **0**): Počet záznamů k přeskočení (pro stránkování).
  * **limit** **(**int**, default:** **100**): Maximální počet záznamů k vrácení.
* **Úspěšná odpověď (**200 OK **-** **List[InventoryItemOut]**): **Seznam položek.**

---

* **Popis:** **Naskladní zboží na konkrétní lokaci (příjemka).**
* **Oprávnění:** **Administrátor firmy.**
* **Tělo požadavku (**PlaceStockIn**):**

  **code**JSON

  ```
  {
    "inventory_item_id": 10,
    "location_id": 2,
    "quantity": 25,
    "details": "Příjem od dodavatele XYZ, faktura 2024-056"
  }
  ```
* **Úspěšná odpověď (**200 OK **-** **InventoryItemOut**): **Aktualizovaný detail skladové položky.**

---

* **Popis:** **Zaznamená spotřebu materiálu na úkol (výdejka). Sníží stav na zadané lokaci.**
* **Oprávnění:** **Člen firmy.**
* **Tělo požadavku (**UsedItemCreateIn**):**

  **code**JSON

  ```
  {
    "inventory_item_id": 10,
    "quantity": 2,
    "from_location_id": 2
  }
  ```
* **Úspěšná odpověď (**200 OK **-** **TaskOut**): **Aktualizovaný detail úkolu s přidaným materiálem.**
* **Chybové odpovědi:**

  * **400 Bad Request**: Nedostatek kusů na zdrojové lokaci.

#### Work Orders & Tasks **- Zakázky a úkoly**

---

* **Popis:** **Vytvoří novou zakázku.**
* **Oprávnění:** **Člen firmy.**
* **Tělo požadavku (**WorkOrderCreateIn**):**

  **code**JSON

  ```
  {
    "name": "Instalace sítě v budově A",
    "client_id": 15,
    "budget_hours": 40.0
  }
  ```
* **Úspěšná odpověď (**201 Created **-** **WorkOrderOut**): **Detail vytvořené zakázky.**

---

* **Popis:** **Agreguje veškerou práci a materiál pro zakázku a vytvoří podklady pro fakturaci.**
* **Oprávnění:** **Administrátor firmy.**
* **Parametry dotazu:**

  * **start_date** **(**Optional[date]**): Filtruje záznamy od tohoto data (včetně).**
  * **end_date** **(**Optional[date]**): Filtruje záznamy do tohoto data (včetně).**
* **Úspěšná odpověď (**200 OK **-** **BillingReportOut**): **Kompletní report.**

---

* **Popis:** **Vytvoří nový úkol v rámci zakázky.**
* **Oprávnění:** **Člen firmy.**
* **Tělo požadavku (**TaskCreateIn**):**

  **code**JSON

  ```
  {
    "name": "Natažení UTP kabelů v 1. patře"
  }
  ```
* **Úspěšná odpověď (**201 Created **-** **TaskOut**): **Detail vytvořeného úkolu.**

#### Time Logs **- Evidence docházky**

---

* **Popis:** **Vytvoří nový záznam v docházce. Řeší překryvy s existujícími záznamy (rozdělí je nebo smaže).**
* **Oprávnění:** **Člen firmy (pro svůj vlastní účet). Administrátor může spravovat docházku ostatních (není implementováno v poskytnutém kódu, ale je to běžný požadavek).**
* **Tělo požadavku (**TimeLogCreateIn**):**

  * **Příklad pro práci:**

  **code**JSON

  ```
  {
    "start_time": "2024-05-24T08:00:00Z",
    "end_time": "2024-05-24T12:30:00Z",
    "entry_type": "work",
    "work_type_id": 1,
    "task_id": 42,
    "break_duration_minutes": 30
  }
  ```

  * **Příklad pro dovolenou:**

  **code**JSON

  ```
  {
    "start_time": "2024-08-01T00:00:00Z",
    "end_time": "2024-08-07T23:59:59Z",
    "entry_type": "vacation"
  }
  ```
* **Úspěšná odpověď (**201 Created **-** **TimeLogOut**): **Detail vytvořeného záznamu.**
* **Chybové odpovědi:**

  * **400 Bad Request**: Nevalidní data (např. chybí **task_id** **u typu** **work**).

#### System & Notifications **- SMTP, Triggery, Audit**

---

* **Popis:** **Vytvoří nebo aktualizuje nastavení SMTP serveru pro odesílání e-mailů.**
* **Oprávnění:** **Administrátor firmy.**
* **Tělo požadavku (**SmtpSettingsIn**):**

  **code**JSON

  ```
  {
    "is_enabled": true,
    "smtp_host": "smtp.seznam.cz",
    "smtp_port": 465,
    "smtp_user": "muj.email@seznam.cz",
    "smtp_password": "moje-super-tajne-heslo",
    "sender_email": "muj.email@seznam.cz",
    "security_protocol": "ssl",
    "notification_settings": {
      "on_invite_created": true,
      "on_budget_alert": true
    }
  }
  ```
* **Úspěšná odpověď (**200 OK **-** **SmtpSettingsOut**): **Uložená konfigurace (bez hesla).**

---

* **Popis:** **Vytvoří nový automatický notifikační trigger.**
* **Oprávnění:** **Administrátor firmy.**
* **Tělo požadavku (**NotificationTriggerCreateIn**):**

  **code**JSON

  ```
  {
    "is_active": true,
    "trigger_type": "work_order_budget",
    "condition": "percentage_reached",
    "threshold_value": 80,
    "recipient_emails": ["manager@firma.cz", "ucetni@firma.cz"]
  }
  ```
* **Úspěšná odpověď (**201 Created **-** **NotificationTriggerOut**): **Detail vytvořeného triggeru.**
* **Chybové odpovědi:**

  * **409 Conflict**: Trigger daného typu pro tuto firmu již existuje.

---

* **Popis:** **Získá historii skladových pohybů.**
* **Oprávnění:** **Administrátor firmy.**
* **Parametry dotazu:**

  * **item_id** **(**Optional[int]**): Filtruje historii pro konkrétní položku.**
  * **user_id** **(**Optional[int]**): Filtruje akce provedené konkrétním uživatelem.**
  * **start_date**, **end_date** **(**Optional[date]**): Filtruje záznamy v časovém rozmezí.**
* **Úspěšná odpověď (**200 OK **-** **List[AuditLogOut]**): **Seznam záznamů z auditního logu.**

---

### 4. Datové Modely (Schémata)

**Zde je přehled nejdůležitějších Pydantic schémat, která definují strukturu dat v požadavcích a odpovědích.**

#### InventoryItemOut

* **id** **(**int**): ID položky.**
* **name** **(**str**): Název.**
* **sku** **(**str**): Skladový kód (unikátní v rámci firmy).**
* **price** **(**Optional[float]**): Prodejní cena za jednotku.**
* **category** **(**Optional[CategoryOut]**): Vnořený objekt kategorie.**
* **locations** **(**List[ItemLocationStockOut]**): Seznam lokací a počtu kusů na každé z nich.**
* **total_quantity** **(**int**,** **computed**): Celkový součet kusů napříč všemi lokacemi.
* **is_monitored_for_stock** **(**bool**): Zda se má sledovat nízký stav zásob.**
* **low_stock_threshold** **(**Optional[int]**): Hranice pro upozornění na nízký stav.**

#### TaskOut

* **id** **(**int**): ID úkolu.**
* **name** **(**str**): Název úkolu.**
* **status** **(**str**): Aktuální stav (např. "todo", "in_progress", "done").**
* **work_order_id** **(**int**): ID nadřazené zakázky.**
* **assignee** **(**Optional[UserOut]**): Uživatel, kterému je úkol přiřazen.**
* **used_items** **(**List[UsedItemOut]**): Seznam materiálu spotřebovaného na úkolu.**

#### TimeLogOut

* **id** **(**int**): ID záznamu.**
* **start_time** **(**datetime**): Začátek záznamu.**
* **end_time** **(**datetime**): Konec záznamu.**
* **entry_type** **(**TimeLogEntryType**): Typ záznamu (**work**,** **vacation**, atd.).
* **status** **(**TimeLogStatus**): Stav schválení (**pending**,** **approved**, **rejected**).
* **user** **(**UserOut**): Uživatel, ke kterému se záznam vztahuje.**
* **task** **(**Optional[TaskPreviewForTimeLog]**): Odkaz na úkol (pouze pro typ** **work**).
* **duration_hours** **(**float**,** **computed**): Vypočtená délka záznamu v hodinách.

#### BillingReportOut

* **work_order_name** **(**str**): Název zakázky.**
* **total_hours** **(**float**): Celkový počet odpracovaných hodin.**
* **total_price_work** **(**float**): Celková cena za práci.**
* **total_price_inventory** **(**float**): Celková cena za materiál.**
* **grand_total** **(**float**): Celková cena (práce + materiál).**
* **time_logs** **(**List[BillingReportTimeLogOut]**): Detailní rozpis odpracovaného času.**
* **used_items** **(**List[BillingReportUsedItemOut]**): Detailní rozpis použitého materiálu.**
