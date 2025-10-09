import asyncio # Přidat import
import logging # Přidat import
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.db.database import engine, Base, async_session_factory
# --- PŘIDÁNÍ NOVÝCH ROUTERŮ ---
from app.routers import (
    auth, companies, clients, invites, members, inventory, categories,
    work_types, work_orders, tasks, time_logs, audit_logs,
    locations, inventory_movements, smtp, triggers, internal, picking_orders
)
from app.services.trigger_service import check_all_triggers


async def periodic_trigger_check():
    """Periodicky spouští kontrolu triggerů."""
    while True:
        # Počkáme 60 minut (3600 sekund)
        await asyncio.sleep(10)
        async with async_session_factory() as session:
            try:
                await check_all_triggers(session)
            except Exception as e:
                logging.error(f"Periodic trigger check failed: {e}")


Path("static/images/inventory").mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.PROJECT_NAME)

origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    asyncio.create_task(periodic_trigger_check())

# Registrace všech API routerů
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(clients.router)
app.include_router(invites.router)
app.include_router(members.router)
app.include_router(inventory.router)
app.include_router(categories.router)
app.include_router(work_types.router)
app.include_router(work_orders.router)
app.include_router(tasks.router)
app.include_router(time_logs.router)
app.include_router(audit_logs.router)
# --- PŘIDAT NOVÉ ROUTERY ---
app.include_router(locations.router)
app.include_router(inventory_movements.router)
app.include_router(smtp.router)
app.include_router(triggers.router) # Přidat registraci
app.include_router(internal.router)
app.include_router(picking_orders.router)

@app.get("/healthz")
async def health():
    """Endpoint pro kontrolu stavu služby."""
    return {"status": "ok"}