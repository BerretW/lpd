from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles # <-- Nový import
from pathlib import Path # <-- Nový import
from app.core.config import settings
from app.db.database import engine, Base
from app.routers import auth, companies, invites, members, inventory, categories, work_types, work_orders, tasks, clients

app = FastAPI(title=settings.PROJECT_NAME)
# Vytvoření složky pro nahrávání, pokud neexistuje
Path("static/images/inventory").mkdir(parents=True, exist_ok=True)


# POZOR: v produkci použij Alembic migrace. Tohle je jen na rychlé rozjetí.
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        # Vytvoří tabulky, pokud neexistují.
        # Včetně nových tabulek inventory_items, inventory_categories, inventory_audit_logs.
        await conn.run_sync(Base.metadata.create_all)

# Registrace všech API routerů
# Připojení statických souborů (pro obrázky)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(clients.router) # <-- Přidat router pro klienty
app.include_router(invites.router)
app.include_router(members.router)
app.include_router(inventory.router)
app.include_router(categories.router)
app.include_router(work_types.router)
app.include_router(work_orders.router)
app.include_router(tasks.router)

@app.get("/healthz")
async def health():
    """Endpoint pro kontrolu stavu služby."""
    return {"status": "ok"}