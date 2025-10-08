
---

### API Dokumentace pro Sklad a Zakázky

Vítejte v dokumentaci k backendu! Toto API vám umožní spravovat firmy, uživatele, skladové hospodářství, klienty a zakázky.

#### Základní URL:

- Při lokálním spuštění: `http://localhost:8000`
- Při spuštění přes Docker: `http://localhost:8020`

Pro automaticky generovanou interaktivní dokumentaci navštivte na vaší base URL cestu `/docs` (např. `http://localhost:8020/docs`).

### 1. Začínáme: Autentizace

Každý požadavek (kromě registrace a přihlášení) musí být autentizovaný. To znamená, že musí obsahovat `Authorization` hlavičku s tokenem, který získáte po přihlášení.

#### 1.1. První krok: Registrace firmy a admina

- **Endpoint:** `POST /auth/register_company`
- **Autorizace:** Není potřeba.
- **Tělo požadavku (Payload):**
  ```json
  {
    "company_name": "Moje Nová Firma",
    "slug": "moje-nova-firma",
    "admin_email": "admin@mojefirma.cz",
    "admin_password": "SuperSilneHeslo123",
    "logo_url": "http://example.com/logo.png"
  }
  ```

#### 1.2. Přihlášení a získání tokenu

- **Endpoint:** `POST /auth/login`
- **Autorizace:** Není potřeba.
- **Tělo požadavku (Payload):** Toto je `application/x-www-form-urlencoded`, nikoliv JSON.
  ```
  username=admin@mojefirma.cz&password=SuperSilneHeslo123
  ```
- **Odpověď (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
  ```

#### 1.3. Použití Access Tokenu

Token z pole `access_token` si uložte. Každý další požadavek na chráněné části API musí tento token obsahovat v `Authorization` hlavičce.
**Příklad hlavičky:** `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 2. Obecné koncepty

- **Chybové stavy:**
  - `401 Unauthorized`: Chybí platný `Authorization` token.
  - `403 Forbidden`: Jste přihlášení, ale nemáte oprávnění pro danou operaci nebo přístup k datům cizí firmy.
  - `404 Not Found`: Položka (klient, zakázka, ...), kterou hledáte, neexistuje.
  - `422 Unprocessable Entity`: Poslali jste nevalidní data. V odpovědi bude detail, co je špatně.
- **`{company_id}` v URL:** Většina cest obsahuje `{company_id}`. Toto ID určuje, ve které firmě právě pracujete a musíte ho do URL vždy správně dosadit. Získáte ho z JWT tokenu po přihlášení.
- **Stav zásob (`quantity`):** Množství u skladových položek se již neupravuje přímo. Celkový stav je součtem stavů na jednotlivých lokacích. Pro změnu množství použijte *Skladové Pohyby*.

### 3. Moduly API (Endpointy)

#### 3.1. Správa Klientů

| Metoda     | Endpoint                                                       | Popis                                                                                                                                                  |
| :--------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/companies/{company_id}/clients`                            | Získá seznam všech klientů dané firmy.                                                                                                            |
| `POST`   | `/companies/{company_id}/clients`                            | Vytvoří nového klienta.                                                                                                                             |
| `GET`    | `/companies/{company_id}/clients/{client_id}`                | Získá detail jednoho konkrétního klienta.                                                                                                          |
| `PATCH`  | `/companies/{company_id}/clients/{client_id}`                | Upraví existujícího klienta.                                                                                                                        |
| `DELETE` | `/companies/{company_id}/clients/{client_id}`                | Smaže klienta.                                                                                                                                        |
| `GET`    | `/companies/{company_id}/clients/{client_id}/billing-report` | Získá agregované podklady pro fakturaci pro klienta za dané období. Vyžaduje query parametry `start_date` a `end_date` (formát YYYY-MM-DD). |

#### 3.2. Správa Zakázek (Work Orders)

| Metoda    | Endpoint                                                               | Popis                                                                                   |
| :-------- | :--------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| `POST`  | `/companies/{company_id}/work-orders`                                | Vytvoří novou zakázku. Může obsahovat volitelné `budget_hours`.                 |
| `GET`   | `/companies/{company_id}/work-orders`                                | Získá seznam všech zakázek firmy.                                                   |
| `GET`   | `/companies/{company_id}/work-orders/{work_order_id}`                | Získá detail zakázky, včetně seznamu jejích úkolů.                              |
| `GET`   | `/companies/{company_id}/work-orders/{work_order_id}/billing-report` | Získá agregované podklady pro fakturaci. Lze filtrovat (`?start_date=YYYY-MM-DD`). |
| `PATCH` | `/companies/{company_id}/work-orders/{work_order_id}`                | Upraví základní údaje zakázky (včetně `budget_hours`).                         |
| `POST`  | `/companies/{company_id}/work-orders/{work_order_id}/status`         | Změní stav zakázky (např. na "uzavřená").                                         |
| `POST`  | `/companies/{company_id}/work-orders/{work_order_id}/copy`           | Vytvoří kompletní kopii zakázky včetně všech úkolů.                            |

#### 3.3. Správa Úkolů (Tasks)

| Metoda     | Endpoint                                                                          | Popis                                                          |
| :--------- | :-------------------------------------------------------------------------------- | :------------------------------------------------------------- |
| `POST`   | `/companies/{company_id}/work-orders/{work_order_id}/tasks`                     | Vytvoří nový úkol v rámci existující zakázky.          |
| `GET`    | `/companies/{company_id}/work-orders/{work_order_id}/tasks`                     | Získá seznam všech úkolů v zakázce.                      |
| `GET`    | `/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}`           | Získá detail jednoho konkrétního úkolu.                   |
| `PATCH`  | `/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}`           | Aktualizuje název, popis nebo status úkolu.                  |
| `DELETE` | `/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}`           | Smaže úkol (včetně jeho záznamů o práci a materiálu).  |
| `POST`   | `/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/assign`    | Přiřadí nebo odebere zaměstnance z úkolu.                 |
| `POST`   | `/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory` | Zapíše použitý materiál. Sníží stav na zadané lokaci. |

#### 3.4. Správa Skladu (Inventory)

| Metoda    | Endpoint                                                     | Popis                                                                                                                                                 |
| :-------- | :----------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`  | `/companies/{company_id}/inventory`                        | Vytvoří novou položku ve skladu (s nulovým počátečním stavem).                                                                                |
| `GET`   | `/companies/{company_id}/inventory`                        | Získá seznam položek. Lze filtrovat (`?category_id=X`).                                                                                          |
| `GET`   | `/companies/{company_id}/inventory/by-ean/{ean}`           | Najde jednu položku podle EAN kódu.                                                                                                                 |
| `GET`   | `/companies/{company_id}/inventory/{item_id}`              | Získá detail položky vč. rozpadu stavů na lokacích.                                                                                             |
| `PATCH` | `/companies/{company_id}/inventory/{item_id}`              | Upraví popisné údaje položky.**Nově umožňuje nastavit i hlídání stavu zásob (`is_monitored_for_stock`, `low_stock_threshold`).** |
| `POST`  | `/companies/{company_id}/inventory/{item_id}/upload-image` | Nahraje obrázek k položce (vyžaduje `multipart/form-data`).                                                                                      |

- **Příklad `PATCH` pro nastavení hlídání stavu zásob:**
  ```json
  {
    "is_monitored_for_stock": true,
    "low_stock_threshold": 10
  }
  ```

  - `is_monitored_for_stock: true` - Zapne hlídání pro tuto položku.
  - `low_stock_threshold: 10` - Určuje, že alert se má poslat, když množství klesne na 10 kusů nebo méně.

#### 3.5. Skladové Lokace

| Metoda     | Endpoint                                            | Popis                                        |
| :--------- | :-------------------------------------------------- | :------------------------------------------- |
| `GET`    | `/companies/{company_id}/locations`               | Získá seznam všech definovaných lokací. |
| `POST`   | `/companies/{company_id}/locations`               | Vytvoří novou skladovou lokaci.            |
| `PATCH`  | `/companies/{company_id}/locations/{location_id}` | Upraví název nebo popis lokace.            |
| `DELETE` | `/companies/{company_id}/locations/{location_id}` | Smaže lokaci (pouze pokud je prázdná).    |

#### 3.6. Skladové Pohyby

| Metoda   | Endpoint                                                 | Popis                                                                    |
| :------- | :------------------------------------------------------- | :----------------------------------------------------------------------- |
| `POST` | `/companies/{company_id}/inventory/movements/place`    | **Naskladnění.** Přidá nové kusy na konkrétní lokaci.       |
| `POST` | `/companies/{company_id}/inventory/movements/transfer` | **Přesun.** Přesune existující kusy z jedné lokace na druhou. |

#### 3.7. Skladové Kategorie

| Metoda     | Endpoint                                             | Popis                                            |
| :--------- | :--------------------------------------------------- | :----------------------------------------------- |
| `GET`    | `/companies/{company_id}/categories`               | Získá stromovou strukturu kategorií.          |
| `POST`   | `/companies/{company_id}/categories`               | Vytvoří novou kategorii (i jako podkategorii). |
| `DELETE` | `/companies/{company_id}/categories/{category_id}` | Smaže kategorii (pouze pokud je prázdná).     |

#### 3.8. Druhy Práce (Work Types)

| Metoda   | Endpoint                               | Popis                                               |
| :------- | :------------------------------------- | :-------------------------------------------------- |
| `GET`  | `/companies/{company_id}/work-types` | Získá seznam všech druhů práce a jejich sazeb. |
| `POST` | `/companies/{company_id}/work-types` | Vytvoří nový druh práce.                        |

#### 3.9. Správa Odpracovaných Hodin (Timesheets)

| Metoda     | Endpoint                                                                | Popis                                                               |
| :--------- | :---------------------------------------------------------------------- | :------------------------------------------------------------------ |
| `POST`   | `/companies/{company_id}/time-logs`                                   | Vytvoří nový záznam času (práce, dovolená, lékař...).      |
| `GET`    | `/companies/{company_id}/time-logs`                                   | Získá seznam záznamů (lze filtrovat `?work_date=YYYY-MM-DD`). |
| `GET`    | `/companies/{company_id}/time-logs/{time_log_id}/service-report-data` | Získá kompletní kontext (zakázka, úkol) pro servisní list.    |
| `PATCH`  | `/companies/{company_id}/time-logs/{time_log_id}`                     | Umožní uživateli upravit svůj neschválený záznam.            |
| `DELETE` | `/companies/{company_id}/time-logs/{time_log_id}`                     | Umožní uživateli smazat svůj neschválený záznam.             |
| `POST`   | `/companies/{company_id}/time-logs/{time_log_id}/status`              | (Pro adminy) Změní stav záznamu (schváleno/zamítnuto).         |

#### 3.10. Auditní Log Skladu

| Metoda  | Endpoint                               | Popis                                                                                      |
| :------ | :------------------------------------- | :----------------------------------------------------------------------------------------- |
| `GET` | `/companies/{company_id}/audit-logs` | Získá seznam záznamů z historie. Výsledky jsou stránkované (`?skip=0&limit=100`). |

#### 3.11. Nastavení E-mailů (SMTP)

Tyto endpointy umožňují administrátorům nastavit SMTP server pro odchozí e-maily firmy a spravovat, které automatické notifikace se mají odesílat.

| Metoda   | Endpoint                                       | Popis                                                                                                                                                                                                     | Oprávnění |
| :------- | :--------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------- |
| `GET`  | `/companies/{company_id}/smtp-settings`      | Získá aktuální SMTP nastavení pro firmu.**Heslo se nikdy nevrací**, místo něj je pole `password_is_set: true/false`.                                                                      | Admin        |
| `PUT`  | `/companies/{company_id}/smtp-settings`      | Vytvoří nebo kompletně aktualizuje SMTP nastavení. Pokud je heslo součástí payloadu, bude nově zašifrováno a uloženo. Pokud heslo v payloadu chybí, použije se stávající uložené heslo. | Admin        |
| `POST` | `/companies/{company_id}/smtp-settings/test` | Odešle testovací e-mail pro ověření funkčnosti nastavení. Pokud není v těle požadavku specifikován `recipient_email`, e-mail se pošle přihlášenému administrátorovi.                   | Admin        |

- **Pole `security_protocol` může mít hodnoty:**

  - `none`: Žádné šifrování (nedoporučeno, pouze pro testování).
  - `tls`: Spojení začne nešifrovaně a povýší se na šifrované pomocí `STARTTLS` (standard pro port 587, např. Gmail).
  - `ssl`: Spojení je šifrované od samého začátku (implicitní SSL/TLS, standard pro port 465, např. Seznam.cz).
- **Pole `notification_settings`:**

  - JSON objekt, kde klíče reprezentují události a hodnoty (`true`/`false`) určují, zda se má odeslat e-mail.
  - Podporované klíče:
    - `on_invite_created`: Při vytvoření nové pozvánky.
    - `on_budget_alert`: Při dosažení prahu rozpočtu na zakázce.
    - `on_low_stock_alert`: Při poklesu stavu zásob pod nastavený práh.

#### 3.12. Správa Notifikačních Triggerů

Triggery definují pravidla, podle kterých systém automaticky odesílá e-mailové alerty (např. při docházejícím materiálu). Pravidla jsou kontrolována periodicky na pozadí.

| Metoda     | Endpoint                                          | Popis                                                                                                            | Oprávnění |
| :--------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------- | :----------- |
| `POST`   | `/companies/{company_id}/triggers`              | Vytvoří nové pravidlo (trigger). Pro každý `trigger_type` může existovat pouze jedno pravidlo na firmu. | Admin        |
| `GET`    | `/companies/{company_id}/triggers`              | Získá seznam všech nastavených pravidel pro danou firmu.                                                     | Admin        |
| `PATCH`  | `/companies/{company_id}/triggers/{trigger_id}` | Aktualizuje existující pravidlo (např. změní práh nebo seznam příjemců).                                | Admin        |
| `DELETE` | `/companies/{company_id}/triggers/{trigger_id}` | Smaže pravidlo.                                                                                                 | Admin        |

- **Příklad `POST` pro vytvoření triggeru na hlídání rozpočtu zakázek:**

  ```json
  {
    "is_active": true,
    "trigger_type": "work_order_budget",
    "condition": "percentage_reached",
    "threshold_value": 85.5,
    "recipient_emails": ["projektovy.manazer@mojefirma.cz"]
  }
  ```

  - **Vysvětlení:** Tento trigger odešle e-mail na zadanou adresu, jakmile odpracované hodiny na *jakékoliv* zakázce (která má nastavený `budget_hours`) přesáhnou 85.5 % jejího rozpočtu.
- **Dostupné typy (`trigger_type`):**

  - `inventory_low_stock`: Hlídání nízkého stavu zásob.
  - `work_order_budget`: Hlídání čerpání rozpočtu hodin na zakázkách.

#### Interní Endpointy (pro testování)

Následující endpointy nejsou určeny pro běžné použití a nejsou viditelné v automatické dokumentaci (`/docs`).

| Metoda   | Endpoint                   | Popis                                                                                                                                                 |
| :------- | :------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/internal/run-triggers` | Manuálně spustí okamžitou kontrolu všech aktivních notifikačních triggerů. Vyžaduje `company_id` jako query parametr (`?company_id=X`). |
