# API Dokumentace pro Sklad a Zakázky

**Vítejte v dokumentaci k backendu! Toto API vám umožní spravovat firmy, uživatele, skladové hospodářství, klienty a zakázky.**

**Základní URL:** **Všechny cesty v této dokumentaci vycházejí z base URL vaší aplikace. Pro lokální vývoj to bude typicky** **http://localhost:8020**.

## 1. Začínáme: Autentizace

 **Každý požadavek (kromě registrace a přihlášení) musí být** **autentizovaný**. To znamená, že musí obsahovat speciální **Authorization** **hlavičku s tokenem, který získáte po přihlášení.**

### 1.1. První krok: Registrace firmy a admina

**Tento endpoint je potřeba zavolat jen jednou na začátku, aby se vytvořila první firma a její hlavní administrátor.**

* **Endpoint:** **POST /auth/register_company**
* **Popis:** **Vytvoří novou společnost a jejího prvního uživatele s rolí "owner".**
* **Autorizace:** **Není potřeba.**
* **Tělo požadavku (Payload):**

  **code**JSON

  ```
  {
    "company_name": "Moje Nová Firma",
    "slug": "moje-nova-firma",
    "admin_email": "admin@mojefirma.cz",
    "admin_password": "SuperSilneHeslo123",
    "logo_url": "http://example.com/logo.png"
  }
  ```
* **Odpověď (201 Created):** **Detail vytvořené firmy.**

### 1.2. Přihlášení a získání tokenu

 **Jakmile existuje uživatel, může se přihlásit a získat** **přístupový token (JWT)**.

* **Endpoint:** **POST /auth/login**
* **Popis:** **Ověří e-mail a heslo a vrátí přístupový token.**
* **Autorizace:** **Není potřeba.**
* **Tělo požadavku (Payload):**

  **code**JSON

  ```
  {
    "email": "admin@mojefirma.cz",
    "password": "SuperSilneHeslo123"
  }
  ```
* **Odpověď (200 OK):**

  **code**JSON

  ```
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
  ```

### 1.3. Použití Access Tokenu

**Token z pole** **access_token** **si uložte (např. v local storage). Každý další požadavek na chráněné části API musí tento token obsahovat v** **Authorization** **hlavičce.**

**Příklad hlavičky:**

**code**Code

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Pokud token nepošlete nebo je neplatný, API vrátí chybu** **401 Unauthorized**.

## 2. Obecné koncepty

* **Chybové stavy:**

  * **401 Unauthorized**: Chybí platný **Authorization** **token.**
  * **403 Forbidden**: Jste přihlášení, ale snažíte se přistoupit k datům cizí firmy.
  * **404 Not Found**: Položka (klient, zakázka, ...), kterou hledáte, neexistuje.
  * **422 Unprocessable Entity**: Poslali jste nevalidní data (např. e-mail bez zavináče). V odpovědi bude detail, co je špatně.
* **{company_id}** **v URL:** **Většina cest obsahuje** **{company_id}**. Toto ID určuje, ve které firmě právě pracujete a musíte ho do URL vždy správně dosadit. Získáte ho například z detailu přihlášeného uživatele.

---

## 3. Moduly API (Endpointy)

**Následuje seznam všech dostupných endpointů, seskupených podle funkčnosti.**

### 3.1. Správa Klientů

**Evidence zákazníků, pro které se dělají zakázky.**

| **Metoda** | **Endpoint**                                    | **Popis**                                         |
| ---------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| **GET**    | **/companies/{company_id}/clients**             | **Získá seznam všech klientů dané firmy.**   |
| **POST**   | **/companies/{company_id}/clients**             | **Vytvoří nového klienta.**                    |
| **GET**    | **/companies/{company_id}/clients/{client_id}** | **Získá detail jednoho konkrétního klienta.** |
| **PATCH**  | **/companies/{company_id}/clients/{client_id}** | **Upraví existujícího klienta.**               |
| **DELETE** | **/companies/{company_id}/clients/{client_id}** | **Smaže klienta.**                               |

### 3.2. Správa Zakázek (Work Orders)

**Hlavní modul pro řízení práce.**

| **Metoda** | **Endpoint**                                                   | **Popis**                                                        |
| ---------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **POST**   | **/companies/{company_id}/work-orders**                        | **Vytvoří novou zakázku.**                                    |
| **GET**    | **/companies/{company_id}/work-orders**                        | **Získá seznam všech zakázek firmy.**                        |
| **GET**    | **/companies/{company_id}/work-orders/{work_order_id}**        | **Získá detail zakázky, včetně seznamu jejích úkolů.**   |
| **PATCH**  | **/companies/{company_id}/work-orders/{work_order_id}**        | **Upraví základní údaje zakázky.**                          |
| **POST**   | **/companies/{company_id}/work-orders/{work_order_id}/status** | **Změní stav zakázky (uzavření/znovuotevření).**          |
| **POST**   | **/companies/{company_id}/work-orders/{work_order_id}/copy**   | **Vytvoří kompletní kopii zakázky včetně všech úkolů.** |

### 3.3. Správa Úkolů (Tasks) a Práce

**Práce s konkrétními úkoly v rámci zakázky.**

| **Metoda** | **Endpoint**                                          | **Popis**                                                            |
| ---------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- |
| **POST**   | **/companies/{company_id}/tasks/{task_id}/time-logs** | **Zapíše odpracovaný čas k úkolu.**                             |
| **POST**   | **/companies/{company_id}/tasks/{task_id}/inventory** | **Zapíše použitý materiál ze skladu.** **Sníží stav!** |

### 3.4. Správa Skladu (Inventory)

**Práce se skladovými položkami.**

| **Metoda** | **Endpoint**                                                 | **Popis**                                                                  |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **POST**   | **/companies/{company_id}/inventory**                        | **Vytvoří novou položku ve skladu.**                                    |
| **GET**    | **/companies/{company_id}/inventory**                        | **Získá seznam položek. Lze filtrovat (**?category_id=X**).**           |
| **GET**    | **/companies/{company_id}/inventory/by-ean/{ean}**           | **Najde jednu položku podle EAN kódu.**                                  |
| **GET**    | **/companies/{company_id}/inventory/{item_id}**              | **Získá detail jedné skladové položky.**                              |
| **PATCH**  | **/companies/{company_id}/inventory/{item_id}**              | **Upraví skladovou položku.**                                            |
| **POST**   | **/companies/{company_id}/inventory/{item_id}/upload-image** | **Nahraje obrázek k položce (vyžaduje** **multipart/form-data**). |

### 3.5. Skladové Kategorie

| **Metoda** | **Endpoint**                                         | **Popis**                                            |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| **GET**    | **/companies/{company_id}/categories**               | **Získá stromovou strukturu kategorií.**          |
| **POST**   | **/companies/{company_id}/categories**               | **Vytvoří novou kategorii (i jako podkategorii).** |
| **DELETE** | **/companies/{company_id}/categories/{category_id}** | **Smaže kategorii (pouze pokud je prázdná).**     |

### 3.6. Druhy Práce (Work Types)

**Nastavení ceníku prací pro firmu.**

| **Metoda** | **Endpoint**                           | **Popis**                                               |
| ---------------- | -------------------------------------------- | ------------------------------------------------------------- |
| **GET**    | **/companies/{company_id}/work-types** | **Získá seznam všech druhů práce a jejich sazeb.** |
| **POST**   | **/companies/{company_id}/work-types** | **Vytvoří nový druh práce.**                        |

### 3.7. Správa Odpracovaných Hodin (Timesheets)

Endpointy pro zaměstnance a manažery ke správě a schvalování odpracovaného času.

| Metoda | Endpoint | Popis |
|---|---|---|
| `POST` | `/companies/{company_id}/time-logs` | Vytvoří nový záznam času pro přihlášeného uživatele. |
| `GET` | `/companies/{company_id}/time-logs` | Získá seznam záznamů. Běžný uživatel vidí jen své. Admin může filtrovat (`?user_id_filter=X`, `?start_date=YYYY-MM-DD`). |
| `PATCH`| `/companies/{company_id}/time-logs/{time_log_id}`| Umožní uživateli upravit **svůj vlastní** záznam, pokud je ve stavu `pending`. |
| `DELETE`| `/companies/{company_id}/time-logs/{time_log_id}`| Umožní uživateli smazat **svůj vlastní** záznam, pokud je ve stavu `pending`. |
| `POST` | `/companies/{company_id}/time-logs/{time_log_id}/status`| **(Pro adminy)** Změní stav záznamu (např. na `approved` nebo `rejected`). |
---
**Workflow:**
1.  Zaměstnanec vytvoří záznam (`POST`). Ten je automaticky ve stavu `pending`.
2.  Pokud se splete, může svůj `pending` záznam upravit (`PATCH`) nebo smazat (`DELETE`).
3.  Manažer si zobrazí všechny `pending` záznamy.
4.  Manažer pomocí `POST /{time_log_id}/status` schválí nebo zamítne záznam.
* **Uživatel se** **přihlásí** **(**/auth/login**) a vy si** **uložíte token**.
* **Získáte seznam** **klientů** **(**/clients**) a** **zakázek** **(**/work-orders**), abyste je mohli zobrazit v přehledu.**
* **Uživatel klikne na "Nová zakázka". Zobrazíte mu formulář, kde si může vybrat z načteného seznamu** **klientů**. Data odešlete na **POST /work-orders**.
* **Uživatel otevře detail zakázky. Získáte ho z** **GET /work-orders/{work_order_id}**. V odpovědi už rovnou budou i úkoly.
* **Uživatel chce k úkolu zapsat práci. Vy mu nejprve načtete a zobrazíte dostupné druhy práce (**GET /work-types**). Po výběru a zadání hodin odešlete data na** **POST /tasks/{task_id}/time-logs**.
* **Uživatel chce k úkolu přidat materiál. Pomocí** **GET /inventory** **(případně s vyhledáváním) mu umožníte najít položku. Po výběru a zadání počtu kusů odešlete data na** **POST /tasks/{task_id}/inventory**.

**Pro detailní informace o datových strukturách (JSON payloady a odpovědi) a pro interaktivní testování doporučujeme použít automaticky generovanou dokumentaci, kterou FastAPI poskytuje na adrese** **/docs**.
