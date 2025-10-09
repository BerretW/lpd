# API Dokumentace - Appartus

**Toto je kompletní referenční dokumentace pro API systému Appartus.**

**Základní URL:** **http://127.0.0.1:8000**

**Autorizace:** **Většina endpointů vyžaduje autorizaci pomocí Bearer tokenu, který je získán z endpointu** **/auth/login**. Token musí být poslán v **Authorization** **hlavičce.**

**code**Code

```
Authorization: Bearer <váš_access_token>
```

## Obsah

* [Autentizace (**/auth**)](https://www.google.com/url?sa=E&q=#autentizace-auth)
* [Firmy (**/companies**)](https://www.google.com/url?sa=E&q=#firmy-companies)
* [Členové (**/companies/{id}/members**)](https://www.google.com/url?sa=E&q=#%C4%8Dlenov%C3%A9-companiesidmembers)
* [Klienti (**/companies/{id}/clients**)](https://www.google.com/url?sa=E&q=#klienti-companiesidclients)
* [Lokace (**/companies/{id}/locations**)](https://www.google.com/url?sa=E&q=#lokace-companiesidlocations)
* [Sklad (**/companies/{id}/inventory**)](https://www.google.com/url?sa=E&q=#sklad-companiesidinventory)
* [Skladové Pohyby (**.../inventory/movements**)](https://www.google.com/url?sa=E&q=#skladov%C3%A9-pohyby-inventorymovements)
* [Kategorie Skladu (**.../categories**)](https://www.google.com/url?sa=E&q=#kategorie-skladu-categories)
* [Zakázky (**/companies/{id}/work-orders**)](https://www.google.com/url?sa=E&q=#zak%C3%A1zky-companiesidwork-orders)
* [Úkoly (**.../work-orders/{id}/tasks**)](https://www.google.com/url?sa=E&q=#%C3%BAkoly-work-ordersidtasks)
* [Typy Práce (**/companies/{id}/work-types**)](https://www.google.com/url?sa=E&q=#typy-pr%C3%A1ce-companiesidwork-types)
* [Pozvánky (**/invites**)](https://www.google.com/url?sa=E&q=#pozv%C3%A1nky-invites)
* [Docházka (**/companies/{id}/time-logs**)](https://www.google.com/url?sa=E&q=#doch%C3%A1zka-companiesidtime-logs)
* [Auditní Záznamy (**.../audit-logs**)](https://www.google.com/url?sa=E&q=#auditn%C3%AD-z%C3%A1znamy-audit-logs)
* [SMTP Nastavení (**.../smtp-settings**)](https://www.google.com/url?sa=E&q=#smtp-nastaven%C3%AD-smtp-settings)
* [Notifikační Triggery (**.../triggers**)](https://www.google.com/url?sa=E&q=#notifika%C4%8Dn%C3%AD-triggery-triggers)

---

## Autentizace (**/auth**)

### Registrace nové firmy a administrátora

* **Metoda:** **POST**
* **URL:** **/auth/register_company**
* **Účel:** **Založí novou firmu a vytvoří jejího prvního uživatele s rolí** **owner**.
* **Oprávnění:** **Žádné.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "company_name": "Moje Nová Firma",
    "slug": "moje-nova-firma",
    "admin_email": "admin@fir.ma",
    "admin_password": "silneheslo123",
    "logo_url": "http://example.com/logo.png"
  }
  ```
* **Výstup (při úspěchu** **201 Created**):

  **code**JSON

  ```
  {
    "id": 1,
    "name": "Moje Nová Firma",
    "slug": "moje-nova-firma",
    "logo_url": "http://example.com/logo.png"
  }
  ```

### Přihlášení a získání tokenu

* **Metoda:** **POST**
* **URL:** **/auth/login**
* **Účel:** **Ověří přihlašovací údaje a vrátí JWT Bearer token pro autorizaci dalších požadavků.**
* **Oprávnění:** **Žádné.**
* **Vstup (Form Data):**

  **code**Code

  ```
  username=admin@fir.ma&password=silneheslo123
  ```- **Výstup (při úspěchu `200 OK`):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
  ```
* **Možné chyby:**

  * **401 Unauthorized**: Neplatné přihlašovací údaje.

---

## Firmy (**/companies**)

### Získání detailu firmy

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}**
* **Účel:** **Vrátí základní a fakturační údaje o firmě.**
* **Oprávnění:** **Člen firmy.**
* **Výstup (při úspěchu** **200 OK**):

  **code**JSON

  ```
  {
    "id": 1,
    "name": "Moje Firma",
    "slug": "moje-firma",
    "logo_url": null,
    "legal_name": "Moje Firma s.r.o.",
    "address": "Hlavní 1, Praha",
    "ico": "12345678",
    "dic": "CZ12345678",
    "executive": "Jan Novák",
    "bank_account": "123456/0100",
    "iban": null
  }
  ```
* **Možné chyby:**

  * **403 Forbidden**: Uživatel nemá přístup do této firmy.
  * **404 Not Found**: Firma neexistuje.

### Aktualizace fakturačních údajů firmy

* **Metoda:** **PATCH**
* **URL:** **/companies/{company_id}/billing**
* **Účel:** **Umožňuje aktualizovat fakturační údaje firmy.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "ico": "87654321",
    "address": "Nová Adresa 2, Brno"
  }
  ```- **Výstup (při úspěchu `200 OK`):** Kompletní aktualizovaný objekt firmy.
  ```
* **Možné chyby:**

  * **403 Forbidden**: Uživatel není admin.
  * **404 Not Found**: Firma neexistuje.

---

## Členové (**/companies//members**)

### Získání seznamu členů firmy

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/members**
* **Účel:** **Vrátí seznam všech uživatelů a jejich rolí v dané firmě.**
* **Oprávnění:** **Člen firmy.**
* **Výstup (při úspěchu** **200 OK**):

  **code**JSON

  ```
  [
    {
      "user": { "id": 1, "email": "owner@fir.ma" },
      "role": "owner"
    },
    {
      "user": { "id": 2, "email": "member@fir.ma" },
      "role": "member"
    }
  ]
  ```

### Přidání nového člena do firmy

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/members**
* **Účel:** **Vytvoří nového uživatele (pokud neexistuje) a rovnou ho přidá do firmy.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "email": "novy.clen@fir.ma",
    "password": "heslo-pro-noveho-clena",
    "role": "member"
  }
  ```
* **Výstup (při úspěchu** **201 Created**): **Objekt nově vytvořeného členství.**
* **Možné chyby:**

  * **409 Conflict**: Uživatel s tímto e-mailem již je členem firmy.

### Změna role člena

* **Metoda:** **PATCH**
* **URL:** **/companies/{company_id}/members/{user_id}**
* **Účel:** **Změní roli existujícího člena firmy.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "role": "admin"
  }
  ```
* **Výstup (při úspěchu** **200 OK**): **Aktualizovaný objekt členství.**
* **Možné chyby:**

  * **404 Not Found**: Člen s daným **user_id** **v této firmě neexistuje.**

### Odebrání člena z firmy

* **Metoda:** **DELETE**
* **URL:** **/companies/{company_id}/members/{user_id}**
* **Účel:** **Odebere uživatele z firmy.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Výstup (při úspěchu** **204 No Content**): **Žádné tělo odpovědi.**

### Získání úkolů přiřazených členovi

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/members/{user_id}/tasks**
* **Účel:** **Zobrazí seznam všech úkolů přiřazených danému uživateli.**
* **Oprávnění:**

  * **Administrátor / Vlastník: Může zobrazit úkoly libovolného člena.**
  * **Běžný člen: Může zobrazit pouze své vlastní úkoly.**
* **Výstup (při úspěchu** **200 OK**): **Seznam objektů úkolů.**

---

## Klienti (**/companies//clients**)

**Tato sekce obsahuje standardní CRUD operace (**POST **pro vytvoření,** **GET** **pro seznam,** **GET /{id}** **pro detail,** **PATCH /{id}** **pro úpravu,** **DELETE /{id}** **pro smazání).**

### Získání podkladů pro fakturaci za období

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/clients/{client_id}/billing-report**
* **Účel:** **Agreguje veškerou práci a materiál pro klienta napříč všemi jeho zakázkami v daném časovém období.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Parametry (Query):**

  * **start_date**: **YYYY-MM-DD** **(povinné)**
  * **end_date**: **YYYY-MM-DD** **(povinné)**
* **Výstup (při úspěchu** **200 OK**): **Detailní report s rozpisem práce a materiálu.**
* **Možné chyby:**

  * **404 Not Found**: Klient neexistuje.

---

## Lokace (**/companies//locations**)

### Získání seznamu lokací

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/locations**
* **Účel:** **Vrátí seznam všech skladových lokací ve firmě.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Výstup (při úspěchu** **200 OK**):

  **code**JSON

  ```
  [
    {
      "name": "Hlavní sklad",
      "description": "Centrální sklad",
      "id": 1,
      "authorized_users": [
        { "id": 1, "email": "admin@fir.ma" }
      ]
    }
  ]
  ```

### Vytvoření nové lokace

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/locations**
* **Účel:** **Vytvoří novou skladovou lokaci.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "name": "Vozidlo 1 - Technik Novák",
    "description": "VW Transporter RZ 1AB 2345"
  }
  ```
* **Výstup (při úspěchu** **201 Created**): **Objekt nově vytvořené lokace.**

### Získání mých přístupných lokací

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/my-locations**
* **Účel:** **Vrátí seznam lokací, ke kterým má přihlášený uživatel přístup.**
* **Oprávnění:** **Člen firmy. (Admin vidí všechny, člen jen ty s oprávněním).**
* **Výstup (při úspěchu** **200 OK**): **Seznam objektů lokací.**

### Získání seznamu položek na lokaci

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/locations/{location_id}/inventory**
* **Účel:** **Zobrazí seznam položek a jejich množství na konkrétní lokaci.**
* **Oprávnění:** **Administrátor / Vlastník nebo člen s oprávněním k dané lokaci.**
* **Výstup (při úspěchu** **200 OK**):

  **code**JSON

  ```
  [
    {
      "quantity": 10,
      "inventory_item": {
        "id": 5,
        "name": "Položka A",
        "sku": "SKU-A"
      }
    }
  ]
  ```

### Správa oprávnění k lokaci (**.../locations//permissions**)

* **GET /**: Získá seznam uživatelů s přístupem k lokaci. (Admin)
* **POST /**: Přidá uživateli oprávnění k lokaci. (Admin)

  * **Vstup (JSON):** **{"user_email": "uzivatel@fir.ma"}**
* **DELETE /{user_id}**: Odebere uživateli oprávnění k lokaci. (Admin)

---

## Sklad (**/companies//inventory**)

### Získání seznamu skladových položek

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/inventory**
* **Účel:** **Vrátí stránkovaný seznam všech položek ve skladu.**
* **Oprávnění:** **Člen firmy.**
* **Parametry (Query):**

  * **category_id**: **integer** **(nepovinné) - filtruje položky v dané kategorii a jejích podkategoriích.**
  * **skip**: **integer** **(nepovinné, default 0)**
  * **limit**: **integer** **(nepovinné, default 100)**
* **Výstup (při úspěchu** **200 OK**): **Seznam skladových položek s celkovým množstvím a rozpisem po lokacích.**

### Vytvoření nové skladové položky

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory**
* **Účel:** **Vytvoří novou položku ve skladu s nulovým počátečním stavem.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):** **Objekt** **InventoryItemCreateIn**.
* **Výstup (při úspěchu** **201 Created**): **Objekt nově vytvořené položky.**

### Nahrání obrázku k položce

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory/{item_id}/upload-image**
* **Účel:** **Nahraje a přiřadí obrázek ke skladové položce.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (Multipart Form Data):** **Soubor s obrázkem.**
* **Výstup (při úspěchu** **200 OK**): **Aktualizovaný objekt skladové položky.**

---

## Skladové Pohyby (**.../inventory/movements**)

### Naskladnění položky na lokaci

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory/movements/place**
* **Účel:** **Přidá zadané množství položky na konkrétní lokaci.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "inventory_item_id": 1,
    "location_id": 1,
    "quantity": 100,
    "details": "Naskladnění od dodavatele XYZ"
  }
  ```
* **Výstup (při úspěchu** **200 OK**): **Kompletní aktualizovaný objekt skladové položky.**

### Přesun položky mezi lokacemi

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory/movements/transfer**
* **Účel:** **Přesune zadané množství položky z jedné lokace na druhou.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "inventory_item_id": 1,
    "from_location_id": 1,
    "to_location_id": 2,
    "quantity": 10
  }
  ```
* **Výstup (při úspěchu** **200 OK**): **Kompletní aktualizovaný objekt skladové položky.**

---

## Kategorie Skladu (**.../categories**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **PATCH /{id}**, **DELETE /{id}**) pro správu stromové struktury kategorií. Vyžaduje oprávnění člena firmy.

---

## Zakázky (**/companies//work-orders**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **GET /{id}**, **PATCH /{id}**).

### Změna stavu zakázky

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/work-orders/{work_order_id}/status**
* **Účel:** **Změní stav zakázky (např. na 'in_progress', 'completed').**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):** **{"status": "completed"}**

### Kopírování zakázky

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/work-orders/{work_order_id}/copy**
* **Účel:** **Vytvoří novou zakázku jako kopii existující, včetně jejích úkolů.**
* **Oprávnění:** **Člen firmy.**
* **Výstup (při úspěchu** **201 Created**): **Objekt nově vytvořené zakázky.**

### Získání podkladů pro fakturaci zakázky

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/work-orders/{work_order_id}/billing-report**
* **Účel:** **Vytvoří podklady pro fakturaci pro jednu konkrétní zakázku.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Parametry (Query):**

  * **start_date**: **YYYY-MM-DD** **(nepovinné)**
  * **end_date**: **YYYY-MM-DD** **(nepovinné)**

---

## Úkoly (**.../work-orders//tasks**)

**Obsahuje standardní CRUD operace pro úkoly v rámci zakázky.**

### Přiřazení úkolu zaměstnanci

* **Metoda:** **POST**
* **URL:** **.../tasks/{task_id}/assign**
* **Účel:** **Přiřadí úkol konkrétnímu členovi firmy.**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):** **{"assignee_id": 5}** **(pro od-přiřazení** **{"assignee_id": null}**)

### Zapsání použitého materiálu k úkolu

* **Metoda:** **POST**
* **URL:** **.../tasks/{task_id}/inventory**
* **Účel:** **Zaznamená spotřebu materiálu na úkolu a sníží jeho stav na dané lokaci.**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "inventory_item_id": 1,
    "quantity": 2,
    "from_location_id": 2
  }
  ```

### Získání celkového počtu odpracovaných hodin

* **Metoda:** **GET**
* **URL:** **.../tasks/{task_id}/total-hours**
* **Účel:** **Sečte všechny odpracované hodiny na daném úkolu.**
* **Oprávnění:** **Člen firmy.**

### Získání záznamů docházky (activity feed)

* **Metoda:** **GET**
* **URL:** **.../tasks/{task_id}/time-logs**
* **Účel:** **Vrátí chronologický seznam všech záznamů z docházky pro daný úkol.**
* **Oprávnění:** **Člen firmy.**

---

## Typy Práce (**/companies//work-types**)

**Obsahuje** **GET** **pro získání seznamu a** **POST** **pro vytvoření nového typu práce (např. "Programování", "Montáž") a jeho hodinové sazby. Vyžaduje administrátorská oprávnění.**

---

## Pozvánky (**/invites**)

### Vytvoření pozvánky do firmy

* **Metoda:** **POST**
* **URL:** **/invites/companies/{company_id}**
* **Účel:** **Vygeneruje unikátní token pro pozvání nového člena e-mailem.**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "email": "pozvany.uzivatel@email.com",
    "role": "member"
  }
  ```

### Přijetí pozvánky

* **Metoda:** **POST**
* **URL:** **/invites/accept**
* **Účel:** **Přijme pozvánku pomocí tokenu. Vytvoří uživatele, pokud neexistuje, a přidá ho do firmy.**
* **Oprávnění:** **Žádné.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "token": "unikátní_token_z_pozvánky",
    "password": "pokud-je-uzivatel-novy-nastavi-si-heslo"
  }
  ```

---

## Docházka (**/companies//time-logs**)

### Vytvoření záznamu do docházky

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/time-logs**
* **Účel:** **Vytvoří nový záznam v docházce (práce, dovolená, nemoc atd.).**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):** **Objekt** **TimeLogCreateIn**. Pro typ **work** **je nutné uvést** **task_id** **a** **work_type_id**.

  **code**JSON

  ```
  {
    "start_time": "2025-10-20T08:00:00Z",
    "end_time": "2025-10-20T16:30:00Z",
    "entry_type": "work",
    "work_type_id": 1,
    "task_id": 1,
    "break_duration_minutes": 30
  }
  ```

---

## Auditní Záznamy (**.../audit-logs**)

### Získání historie skladových pohybů

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/audit-logs**
* **Účel:** **Vrátí seznam všech záznamů o pohybech a změnách na skladu.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Parametry (Query):** **Filtry pro** **item_id**, **user_id**, **start_date**, **end_date**, **skip**, **limit**.

---

## SMTP Nastavení (**.../smtp-settings**)

**Obsahuje** **GET** **pro získání,** **PUT** **pro vytvoření/aktualizaci a** **POST /test** **pro odeslání testovacího e-mailu. Slouží k nastavení odchozího e-mailového serveru pro notifikace. Vyžaduje administrátorská oprávnění.**

---

## Notifikační Triggery (**.../triggers**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **PATCH /{id}**, **DELETE /{id}**) pro správu automatických notifikací (např. upozornění na nízký stav zásob, překročení rozpočtu zakázky). Vyžaduje administrátorská oprávnění.
