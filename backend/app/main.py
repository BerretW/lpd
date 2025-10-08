from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.db.database import engine, Base
# --- PŘIDÁNÍ NOVÝCH ROUTERŮ ---
from app.routers import (
    auth, companies, clients, invites, members, inventory, categories,
    work_types, work_orders, tasks, time_logs, audit_logs,
    locations, inventory_movements
)

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


@app.get("/healthz")
async def health():
    """Endpoint pro kontrolu stavu služby."""
    return {"status": "ok"}