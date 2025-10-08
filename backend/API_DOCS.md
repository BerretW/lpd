API Dokumentace pro Sklad a Zakázky
Vítejte v dokumentaci k backendu! Toto API vám umožní spravovat firmy, uživatele, skladové hospodářství, klienty a zakázky.
Základní URL:
Při lokálním spuštění: http://localhost:8000
Při spuštění přes Docker: http://localhost:8020
Pro automaticky generovanou interaktivní dokumentaci navštivte na vaší base URL cestu /docs (např. http://localhost:8020/docs).
1. Začínáme: Autentizace
Každý požadavek (kromě registrace a přihlášení) musí být autentizovaný. To znamená, že musí obsahovat Authorization hlavičku s tokenem, který získáte po přihlášení.
1.1. První krok: Registrace firmy a admina
Tento endpoint je potřeba zavolat jen jednou na začátku, aby se vytvořila první firma a její hlavní administrátor.
Endpoint: POST /auth/register_company
Autorizace: Není potřeba.
Tělo požadavku (Payload):
code
JSON
{
  "company_name": "Moje Nová Firma",
  "slug": "moje-nova-firma",
  "admin_email": "admin@mojefirma.cz",
  "admin_password": "SuperSilneHeslo123",
  "logo_url": "http://example.com/logo.png"
}
1.2. Přihlášení a získání tokenu
Jakmile existuje uživatel, může se přihlásit a získat přístupový token (JWT).
Endpoint: POST /auth/login
Autorizace: Není potřeba.
Tělo požadavku (Payload): Toto je application/x-www-form-urlencoded, nikoliv JSON.
code
Code
username=admin@mojefirma.cz&password=SuperSilneHeslo123
Odpověď (200 OK):
code
JSON
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
1.3. Použití Access Tokenu
Token z pole access_token si uložte. Každý další požadavek na chráněné části API musí tento token obsahovat v Authorization hlavičce.
Příklad hlavičky: Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
2. Obecné koncepty
Chybové stavy:
401 Unauthorized: Chybí platný Authorization token.
403 Forbidden: Jste přihlášení, ale nemáte oprávnění pro danou operaci nebo přístup k datům cizí firmy.
404 Not Found: Položka (klient, zakázka, ...), kterou hledáte, neexistuje.
422 Unprocessable Entity: Poslali jste nevalidní data. V odpovědi bude detail, co je špatně.
{company_id} v URL: Většina cest obsahuje {company_id}. Toto ID určuje, ve které firmě právě pracujete a musíte ho do URL vždy správně dosadit. Získáte ho z JWT tokenu po přihlášení.
Stav zásob (quantity): Množství u skladových položek se již neupravuje přímo. Celkový stav je součtem stavů na jednotlivých lokacích. Pro změnu množství použijte Skladové Pohyby.
3. Moduly API (Endpointy)
3.1. Správa Klientů
Metoda	Endpoint	Popis
GET	/companies/{company_id}/clients	Získá seznam všech klientů dané firmy.
POST	/companies/{company_id}/clients	Vytvoří nového klienta.
GET	/companies/{company_id}/clients/{client_id}	Získá detail jednoho konkrétního klienta.
PATCH	/companies/{company_id}/clients/{client_id}	Upraví existujícího klienta.
DELETE	/companies/{company_id}/clients/{client_id}	Smaže klienta.
GET	/companies/{company_id}/clients/{client_id}/billing-report	Získá agregované podklady pro fakturaci pro klienta za dané období. Vyžaduje query parametry start_date a end_date (formát YYYY-MM-DD).
Příklad POST /companies/{company_id}/clients:
code
JSON
{
  "name": "Spokojený Zákazník a.s.",
  "email": "nakup@zakaznik.cz",
  "phone": "+420 777 123 456",
  "address": "Obchodní 123, 110 00 Praha 1",
  "ico": "12345678",
  "dic": "CZ12345678"
}
3.2. Správa Zakázek (Work Orders)
Metoda	Endpoint	Popis
POST	/companies/{company_id}/work-orders	Vytvoří novou zakázku.
GET	/companies/{company_id}/work-orders	Získá seznam všech zakázek firmy.
GET	/companies/{company_id}/work-orders/{work_order_id}	Získá detail zakázky, včetně seznamu jejích úkolů.
GET	/companies/{company_id}/work-orders/{work_order_id}/billing-report	Získá agregované podklady pro fakturaci. Lze filtrovat (?start_date=YYYY-MM-DD).
PATCH	/companies/{company_id}/work-orders/{work_order_id}	Upraví základní údaje zakázky.
POST	/companies/{company_id}/work-orders/{work_order_id}/status	Změní stav zakázky (např. na "uzavřená").
POST	/companies/{company_id}/work-orders/{work_order_id}/copy	Vytvoří kompletní kopii zakázky včetně všech úkolů.
Příklad POST /companies/{company_id}/work-orders:
code
JSON
{
  "name": "Oprava střechy - Zákazník a.s.",
  "description": "Kompletní oprava a nátěr střechy na budově A.",
  "client_id": 123
}
3.3. Správa Úkolů (Tasks)
Úkoly jsou vždy podřízené konkrétní zakázce.
Metoda	Endpoint	Popis
POST	/companies/{company_id}/work-orders/{work_order_id}/tasks	Vytvoří nový úkol v rámci existující zakázky.
GET	/companies/{company_id}/work-orders/{work_order_id}/tasks	Získá seznam všech úkolů v zakázce.
GET	/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}	Získá detail jednoho konkrétního úkolu.
PATCH	/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}	Aktualizuje název, popis nebo status úkolu.
DELETE	/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}	Smaže úkol (včetně jeho záznamů o práci a materiálu).
POST	/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/assign	Přiřadí nebo odebere zaměstnance z úkolu.
POST	/companies/{company_id}/work-orders/{work_order_id}/tasks/{task_id}/inventory	(Změna) Zapíše použitý materiál. Sníží stav na zadané lokaci!
Příklad POST .../tasks/{task_id}/inventory:
code
JSON
{
  "inventory_item_id": 15,
  "quantity": 1,
  "from_location_id": 2 
}
3.4. Správa Skladu (Inventory)
Metoda	Endpoint	Popis
POST	/companies/{company_id}/inventory	Vytvoří novou položku ve skladu (s nulovým počátečním stavem).
GET	/companies/{company_id}/inventory	Získá seznam položek. Lze filtrovat (?category_id=X).
GET	/companies/{company_id}/inventory/by-ean/{ean}	Najde jednu položku podle EAN kódu.
GET	/companies/{company_id}/inventory/{item_id}	Získá detail položky vč. rozpadu stavů na lokacích.
PATCH	/companies/{company_id}/inventory/{item_id}	Upraví popisné údaje položky (název, SKU, cena...). Nemění množství!
POST	/companies/{company_id}/inventory/{item_id}/upload-image	Nahraje obrázek k položce (vyžaduje multipart/form-data).
Příklad POST /companies/{company_id}/inventory (bez quantity):
code
JSON
{
  "name": "Střešní taška Bramac Classic",
  "sku": "BRAMAC-CLS-01",
  "ean": "8590000123456",
  "price": 25.50,
  "description": "Klasická betonová střešní taška, barva cihlová.",
  "category_id": 10
}
Příklad odpovědi GET /companies/{company_id}/inventory/{item_id}:
code
JSON
{
  "id": 15,
  "name": "Střešní taška Bramac Classic",
  "sku": "BRAMAC-CLS-01",
  // ... další pole
  "total_quantity": 450, // Dynamicky spočítaný součet
  "locations": [
    {
      "quantity": 400,
      "location": { "id": 1, "name": "Hlavní sklad", "description": null }
    },
    {
      "quantity": 50,
      "location": { "id": 3, "name": "Regál A-5", "description": "Horní police" }
    }
  ]
}
3.5. Skladové Lokace (NOVÉ)
Umožňuje definovat fyzická nebo logická místa, kde se skladové položky nacházejí (např. regály, vozidla, sklady).
Metoda	Endpoint	Popis
GET	/companies/{company_id}/locations	Získá seznam všech definovaných lokací.
POST	/companies/{company_id}/locations	Vytvoří novou skladovou lokaci.
PATCH	/companies/{company_id}/locations/{location_id}	Upraví název nebo popis lokace.
DELETE	/companies/{company_id}/locations/{location_id}	Smaže lokaci (pouze pokud je prázdná).
Příklad POST /companies/{company_id}/locations:
code
JSON
{
  "name": "Vozidlo 1 - RZ 1AB 2345",
  "description": "Ford Transit, přiděleno Janu Novákovi"
}
3.6. Skladové Pohyby (NOVÉ)
Tyto endpointy slouží k fyzické změně počtu kusů na jednotlivých lokacích.
Metoda	Endpoint	Popis
POST	/companies/{company_id}/inventory/movements/place	Naskladnění. Přidá nové kusy na konkrétní lokaci.
POST	/companies/{company_id}/inventory/movements/transfer	Přesun. Přesune existující kusy z jedné lokace na druhou.
Příklad Naskladnění (/place):
code
JSON
{
  "inventory_item_id": 15,
  "location_id": 1,
  "quantity": 100,
  "details": "Příjemka P-2025-052"
}
Příklad Přesunu (/transfer):
code
JSON
{
  "inventory_item_id": 15,
  "from_location_id": 1,
  "to_location_id": 2,
  "quantity": 5,
  "details": "Výdejka pro technika Nováka"
}
3.7. Skladové Kategorie
Metoda	Endpoint	Popis
GET	/companies/{company_id}/categories	Získá stromovou strukturu kategorií.
POST	/companies/{company_id}/categories	Vytvoří novou kategorii (i jako podkategorii).
DELETE	/companies/{company_id}/categories/{category_id}	Smaže kategorii (pouze pokud je prázdná).
3.8. Druhy Práce (Work Types)
Nastavení ceníku prací pro firmu.
Metoda	Endpoint	Popis
GET	/companies/{company_id}/work-types	Získá seznam všech druhů práce a jejich sazeb.
POST	/companies/{company_id}/work-types	Vytvoří nový druh práce.
3.9. Správa Odpracovaných Hodin (Timesheets)
Endpointy pro zaměstnance a manažery ke správě a schvalování odpracovaného času.
Metoda	Endpoint	Popis
POST	/companies/{company_id}/time-logs	Vytvoří nový záznam času (práce, dovolená, lékař...).
GET	/companies/{company_id}/time-logs	Získá seznam záznamů (lze filtrovat ?work_date=YYYY-MM-DD).
GET	/companies/{company_id}/time-logs/{time_log_id}/service-report-data	Získá kompletní kontext (zakázka, úkol) pro servisní list.
PATCH	/companies/{company_id}/time-logs/{time_log_id}	Umožní uživateli upravit svůj neschválený záznam.
DELETE	/companies/{company_id}/time-logs/{time_log_id}	Umožní uživateli smazat svůj neschválený záznam.
POST	/companies/{company_id}/time-logs/{time_log_id}/status	(Pro adminy) Změní stav záznamu (schváleno/zamítnuto).
3.10. Auditní Log Skladu
Endpoint pro zobrazení historie všech změn ve skladu. Přístupný pouze pro administrátory.
Metoda	Endpoint	Popis
GET	/companies/{company_id}/audit-logs	Získá seznam záznamů z historie. Výsledky jsou stránkované (?skip=0&limit=100).
Dostupné filtry (Query Parametry):
Všechny filtry lze kombinovat.
?item_id=int: Zobrazí historii pouze pro jednu konkrétní skladovou položku.
?user_id=int: Zobrazí všechny akce provedené jedním konkrétním uživatelem.
?start_date=YYYY-MM-DD: Filtruje záznamy od tohoto data včetně.
?end_date=YYYY-MM-DD: Filtruje záznamy do tohoto data včetně.
Příklad použití:
GET /companies/1/audit-logs?item_id=42&start_date=2025-10-01
Tento požadavek vrátí všechny pohyby na položce s ID 42, které se staly od 1. října 2025.