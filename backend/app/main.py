from fastapi import FastAPI
from app.core.config import settings
from app.db.database import engine, Base
from app.routers import auth, companies, invites, members, inventory, categories

app = FastAPI(title=settings.PROJECT_NAME)

# POZOR: v produkci použij Alembic migrace. Tohle je jen na rychlé rozjetí.
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        # Vytvoří tabulky, pokud neexistují.
        # Včetně nových tabulek inventory_items, inventory_categories, inventory_audit_logs.
        await conn.run_sync(Base.metadata.create_all)

# Registrace všech API routerů
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(invites.router)
app.include_router(members.router)
app.include_router(inventory.router)
app.include_router(categories.router)

@app.get("/healthz")
async def health():
    """Endpoint pro kontrolu stavu služby."""
    return {"status": "ok"}