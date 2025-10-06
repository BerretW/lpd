# Backend pro Správu Skladu a Zakázek

Robustní backendový systém postavený na frameworku FastAPI, navržený pro efektivní správu firem, klientů, skladových zásob, zakázek a sledování času zaměstnanců.

## Klíčové vlastnosti

*   **Multi-tenancy architektura:** Systém je navržen pro správu více oddělených firem.
*   **Autentizace a Autorizace:** Zabezpečení pomocí JWT tokenů s rolemi (vlastník, admin, člen).
*   **Správa Skladu:** Tvorba a správa skladových položek, vnořených kategorií a sledování stavu zásob.
*   **Řízení Zakázek:** Kompletní životní cyklus od správy klientů po tvorbu zakázek a jejich úkolů.
*   **Sledování Času (Timesheety):** Zaměstnanci mohou zaznamenávat odpracovaný čas k jednotlivým úkolům, včetně rozlišení typů práce (práce, lékař, dovolená...).
*   **Fakturační Podklady:** Automatické generování agregovaných reportů pro fakturaci na úrovni zakázky i klienta za zvolené období.
*   **Auditní Log:** Detailní sledování všech změn ve skladu (vytvoření, úpravy, smazání) pro zajištění plné transparentnosti a dohledatelnosti.

## Použité technologie

*   **Backend:** Python 3.12, FastAPI
*   **Databáze:** MySQL 8 (s asynchronním ovladačem `asyncmy`)
*   **ORM:** SQLAlchemy 2.0 (v asynchronním režimu)
*   **Kontejnerizace:** Docker, Docker Compose

## Předpoklady pro spuštění

*   Nainstalovaný Python 3.12+
*   Nainstalovaný Docker a Docker Compose

---

## Instalace a spuštění

Máte dvě možnosti, jak aplikaci spustit: pomocí Dockeru (doporučeno pro jednoduchost a produkční nasazení) nebo lokálně (ideální pro vývoj).

### 1. Spuštění pomocí Dockeru (doporučeno)

1.  **Klonujte repozitář:**
    ```bash
    git clone <URL_VASEHO_REPOZITARE>
    cd backend
    ```

2.  **Vytvořte a nastavte `.env` soubor:**
    Zkopírujte soubor `.env.example` jako `.env`. V souboru `.env` je potřeba nastavit správný `DATABASE_URL` pro komunikaci s databází v Dockeru. Použijte hodnoty z `docker-compose.yml`:
    ```env
    DATABASE_URL=mysql+asyncmy://root:775695905@db:3306/database3
    JWT_SECRET=zmente-toto-tajemstvi-v-produkci
    JWT_EXPIRE_MINUTES=120
    ```

3.  **Spusťte kontejnery:**
    ```bash
    docker-compose up --build -d
    ```

4.  **Hotovo!** API je nyní dostupné na adrese `http://localhost:8020`. Interaktivní dokumentace (Swagger UI) je na `http://localhost:8020/docs`.

### 2. Lokální spuštění (pro vývoj)

Tato metoda vyžaduje lokálně běžící instanci MySQL databáze.

1.  **Spusťte lokální MySQL server** a vytvořte v něm databázi (např. s názvem `database`).

2.  **Spusťte `start.bat` (pro Windows):**
    Tento skript se postará o vytvoření virtuálního prostředí, instalaci závislostí a spuštění vývojového serveru. Před spuštěním si v něm upravte proměnnou `DATABASE_URL` tak, aby odpovídala vaší lokální databázi.

3.  **Manuální postup (pro Linux/macOS):**
    ```bash
    # Vytvoření a aktivace virtuálního prostředí
    python3 -m venv venv
    source venv/bin/activate

    # Instalace závislostí
    pip install -r requirements.txt

    # Nastavení proměnných prostředí
    export DATABASE_URL="mysql+asyncmy://UZIVATEL:HESLO@localhost:3306/NAZEV_DB"
    export JWT_SECRET="super-tajny-klic-pro-lokalni-vyvoj"
    export JWT_EXPIRE_MINUTES=120

    # Spuštění vývojového serveru
    uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
    ```

4.  **Hotovo!** API je nyní dostupné na `http://localhost:8000`. Interaktivní dokumentace je na `http://localhost:8000/docs`.

---

## Testování

Projekt obsahuje integrační testy v souboru `tests.py`, které ověřují klíčové scénáře.

1.  Ujistěte se, že backendový server běží (buď lokálně nebo v Dockeru).
2.  Pokud testujete proti Dockeru, upravte `BASE_URL` v `tests.py` na `http://127.0.0.1:8020`.
3.  Spusťte testy:
    ```bash
    python tests.py
    ```

## Dokumentace API

Detailní popis všech dostupných API endpointů, včetně příkladů, naleznete v souboru **`API_DOCS.md`**.