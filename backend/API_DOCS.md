
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
* [Požadavky na materiál (**.../picking-orders**)](https://www.google.com/url?sa=E&q=#po%C5%BEadavky-na-materi%C3%A1l-picking-orders)
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
    "admin_password": "silneheslo123"
  }
  ```

### Přihlášení a získání tokenu

* **Metoda:** **POST**
* **URL:** **/auth/login**
* **Účel:** **Ověří přihlašovací údaje a vrátí JWT Bearer token.**
* **Oprávnění:** **Žádné.**
* **Vstup (Form Data):** **username=admin@fir.ma&password=silneheslo123**
* **Výstup (při úspěchu** **200 OK**):

  **code**JSON

  ```
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer"
  }
  ```

---

## Firmy (**/companies**)

### Získání detailu firmy

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}**
* **Účel:** **Vrátí základní a fakturační údaje o firmě.**
* **Oprávnění:** **Člen firmy.**

### Aktualizace fakturačních údajů firmy

* **Metoda:** **PATCH**
* **URL:** **/companies/{company_id}/billing**
* **Účel:** **Umožňuje aktualizovat fakturační údaje firmy.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):** **{"ico": "87654321", "address": "Nová Adresa 2, Brno"}**

---

## Členové (**/companies//members**)

**Obsahuje standardní CRUD operace pro správu členů firmy (**GET**,** **POST**, **PATCH /{id}**, **DELETE /{id}**).

### Získání úkolů přiřazených členovi

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/members/{user_id}/tasks**
* **Účel:** **Zobrazí seznam všech úkolů přiřazených danému uživateli.**
* **Oprávnění:** **Admin vidí úkoly všech, běžný člen jen své.**

---

## Klienti (**/companies//clients**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **GET /{id}**, **PATCH /{id}**, **DELETE /{id}**).

### Získání podkladů pro fakturaci za období

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/clients/{client_id}/billing-report**
* **Účel:** **Agreguje veškerou práci a materiál pro klienta v daném období.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Parametry (Query):** **start_date** **(YYYY-MM-DD),** **end_date** **(YYYY-MM-DD).**

---

## Lokace (**/companies//locations**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **PATCH /{id}**, **DELETE /{id}**).

### Získání mých přístupných lokací

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/locations/my-locations**
* **Účel:** **Vrátí seznam lokací, ke kterým má přihlášený uživatel přístup.**
* **Oprávnění:** **Člen firmy. (Admin vidí všechny, člen jen ty s oprávněním).**

### Získání seznamu položek na lokaci

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/locations/{location_id}/inventory**
* **Účel:** **Zobrazí seznam položek a jejich množství na konkrétní lokaci.**
* **Oprávnění:** **Admin nebo člen s oprávněním k dané lokaci.**

### Správa oprávnění k lokaci (**.../locations//permissions**)

* **GET /**: Získá seznam uživatelů s přístupem k lokaci (Admin).
* **POST /**: Přidá uživateli oprávnění k lokaci (Admin).

  * **Vstup (JSON):** **{"user_email": "uzivatel@fir.ma"}**
* **DELETE /{user_id}**: Odebere uživateli oprávnění k lokaci (Admin).

---

## Sklad (**/companies//inventory**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **GET /{id}**, **PATCH /{id}**, **DELETE /{id}**).

### Nahrání obrázku k položce

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory/{item_id}/upload-image**
* **Účel:** **Nahraje a přiřadí obrázek ke skladové položce.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (Multipart Form Data):** **Soubor s obrázkem.**

---

## Skladové Pohyby (**.../inventory/movements**)

### Naskladnění položky na lokaci

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory/movements/place**
* **Účel:** **Přidá zadané množství položky na konkrétní lokaci.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):** **{"inventory_item_id": 1, "location_id": 1, "quantity": 100}**

### Přesun položky mezi lokacemi

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory/movements/transfer**
* **Účel:** **Přesune zadané množství položky z jedné lokace na druhou.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):** **{"inventory_item_id": 1, "from_location_id": 1, "to_location_id": 2, "quantity": 10}**

### Odpis položky ze skladu

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/inventory/movements/write-off**
* **Účel:** **Odebere (odepíše) položku ze skladu z důvodu poškození, ztráty atd.**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Vstup (JSON):** **{"inventory_item_id": 1, "location_id": 1, "quantity": 5, "details": "Poškozeno"}**

---

## Požadavky na materiál (**.../picking-orders**)

### Vytvoření požadavku na materiál

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/picking-orders**
* **Účel:** **Umožňuje uživateli vytvořit požadavek na přípravu materiálu.**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "source_location_id": 1,
    "destination_location_id": 2,
    "items": [
      { "inventory_item_id": 1, "requested_quantity": 10 },
      { "requested_item_description": "Nová svorka", "requested_quantity": 5 }
    ]
  }
  ```

### Získání seznamu požadavků

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/picking-orders**
* **Účel:** **Zobrazí seznam všech požadavků na materiál.**
* **Oprávnění:** **Člen firmy.**
* **Parametry (Query):** **status** **(nepovinné, filtruje podle stavu).**

### Získání detailu požadavku

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/picking-orders/{order_id}**
* **Účel:** **Vrátí kompletní detail jednoho požadavku na materiál.**
* **Oprávnění:** **Člen firmy.**

### Změna stavu požadavku

* **Metoda:** **PATCH**
* **URL:** **/companies/{company_id}/picking-orders/{order_id}/status**
* **Účel:** **Umožňuje změnit stav požadavku (např. na** **in_progress** **nebo** **cancelled**).
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):** **{"status": "in_progress"}**

### Splnění požadavku na materiál

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/picking-orders/{order_id}/fulfill**
* **Účel:** **Umožňuje skladníkovi potvrdit vychystání materiálu a provést skladové přesuny.**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):**

  **code**JSON

  ```
  {
    "items": [
      { "picking_order_item_id": 1, "picked_quantity": 10 },
      { "picking_order_item_id": 2, "picked_quantity": 5, "inventory_item_id": 15 }
    ]
  }
  ```

---

## Kategorie Skladu (**.../categories**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **PATCH /{id}**, **DELETE /{id}**) pro správu kategorií.

---

## Zakázky (**/companies//work-orders**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **GET /{id}**, **PATCH /{id}**).

### Změna stavu zakázky

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/work-orders/{work_order_id}/status**
* **Vstup (JSON):** **{"status": "completed"}**

### Kopírování zakázky

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/work-orders/{work_order_id}/copy**

### Získání podkladů pro fakturaci zakázky

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/work-orders/{work_order_id}/billing-report**
* **Oprávnění:** **Administrátor / Vlastník.**

---

## Úkoly (**.../work-orders//tasks**)

**Obsahuje standardní CRUD operace pro úkoly v rámci zakázky.**

### Přiřazení úkolu zaměstnanci

* **Metoda:** **POST**
* **URL:** **.../tasks/{task_id}/assign**
* **Vstup (JSON):** **{"assignee_id": 5}**

### Zapsání použitého materiálu k úkolu

* **Metoda:** **POST**
* **URL:** **.../tasks/{task_id}/inventory**
* **Vstup (JSON):** **{"inventory_item_id": 1, "quantity": 2, "from_location_id": 2}**

### Naskladnění a vyskladnění materiálu přímo na úkol

* **Metoda:** **POST**
* **URL:** **.../tasks/{task_id}/inventory/direct-assign**
* **Účel:** **Zaznamená spotřebu materiálu, který přišel přímo na stavbu (mimo sklad).**
* **Vstup (JSON):** **{"inventory_item_id": 1, "quantity": 1, "details": "Koupeno na místě"}**

### Odebrání použitého materiálu z úkolu

* **Metoda:** **DELETE**
* **URL:** **.../tasks/{task_id}/inventory/{used_item_id}**
* **Účel:** **Odebere záznam o spotřebě. Pokud byl materiál ze skladu, vrátí ho na původní lokaci. Pokud byl z přímého nákupu, naskladní ho na výchozí sklad firmy.**

### Získání celkového počtu odpracovaných hodin

* **Metoda:** **GET**
* **URL:** **.../tasks/{task_id}/total-hours**

### Získání záznamů docházky (activity feed)

* **Metoda:** **GET**
* **URL:** **.../tasks/{task_id}/time-logs**

---

## Typy Práce (**/companies//work-types**)

**Obsahuje** **GET** **pro získání seznamu a** **POST** **pro vytvoření typu práce a jeho sazby (Admin).**

---

## Pozvánky (**/invites**)

### Vytvoření pozvánky do firmy

* **Metoda:** **POST**
* **URL:** **/invites/companies/{company_id}**
* **Vstup (JSON):** **{"email": "pozvany@email.com", "role": "member"}**

### Přijetí pozvánky

* **Metoda:** **POST**
* **URL:** **/invites/accept**
* **Vstup (JSON):** **{"token": "...", "password": "..."}**

---

## Docházka (**/companies//time-logs**)

### Vytvoření záznamu do docházky

* **Metoda:** **POST**
* **URL:** **/companies/{company_id}/time-logs**
* **Oprávnění:** **Člen firmy.**
* **Vstup (JSON):** **Objekt** **TimeLogCreateIn**. Pro typ **work** **je nutné uvést** **task_id** **a** **work_type_id**.

---

## Auditní Záznamy (**.../audit-logs**)

### Získání historie skladových pohybů

* **Metoda:** **GET**
* **URL:** **/companies/{company_id}/audit-logs**
* **Oprávnění:** **Administrátor / Vlastník.**
* **Parametry (Query):** **Filtry pro** **item_id**, **user_id**, **start_date**, **end_date**, atd.

---

## SMTP Nastavení (**.../smtp-settings**)

**Obsahuje** **GET**, **PUT** **a** **POST /test** **pro nastavení odchozího e-mailového serveru (Admin).**

---

## Notifikační Triggery (**.../triggers**)

**Obsahuje standardní CRUD operace (**POST**,** **GET**, **PATCH /{id}**, **DELETE /{id}**) pro správu automatických notifikací (Admin).
