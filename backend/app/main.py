# backend/app/main.py
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, func
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.core.security import hash_password
from app.db.database import engine, Base, async_session_factory
from app.db.models import User, Company, Membership, RoleEnum

# Import Plugin Manageru a pluginů
from app.core.plugin_manager import PluginManager
from plugins import db_backup
from plugins import customer_stats  # Import pluginu pro zákaznické statistiky (příklad)
from plugins import attendance_export  # Import pluginu pro export docházky (příklad)
from plugins import inventory_import  # Import pluginu pro import skladu (příklad)  

# Importy všech API routerů
from app.routers import (
    auth, users, companies, clients, invites, members, inventory, categories,
    work_types, work_orders, tasks, time_logs, audit_logs,
    locations, inventory_movements, smtp, triggers, internal, picking_orders,
    partners, pohoda
)
from app.services.trigger_service import check_all_triggers

# Nastavení logování
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Inicializace plánovače (Scheduler)
scheduler = AsyncIOScheduler()

async def periodic_trigger_check():
    """
    Periodicky spouští kontrolu triggerů (např. nízký stav skladu, rozpočet).
    Toto běží jako nekonečná smyčka na pozadí (legacy způsob).
    V budoucnu lze toto také převést přímo pod APScheduler.
    """
    while True:
        # Počkáme 60 minut
        await asyncio.sleep(3600)
        async with async_session_factory() as session:
            try:
                await check_all_triggers(session)
            except Exception as e:
                logger.error(f"Periodic trigger check failed: {e}")

async def create_default_user():
    """
    Vytvoří výchozího administrátora a demo firmu, pokud je databáze uživatelů prázdná.
    """
    async with async_session_factory() as session:
        # Kontrola, zda již v DB někdo je
        user_count_stmt = select(func.count()).select_from(User)
        result = await session.execute(user_count_stmt)
        count = result.scalar()

        if count == 0:
            logger.info("Databáze uživatelů je prázdná. Probíhá bootstrap výchozího administrátora...")
            try:
                # 1. Vytvoření uživatele
                new_user = User(
                    email=settings.DEFAULT_USER_EMAIL,
                    password_hash=hash_password(settings.DEFAULT_USER_PASSWORD),
                    is_active=True
                )
                session.add(new_user)
                await session.flush()

                # 2. Vytvoření první společnosti
                new_company = Company(
                    name="Hlavní Společnost",
                    slug="hlavni-spolecnost"
                )
                session.add(new_company)
                await session.flush()

                # 3. Nastavení uživatele jako majitele
                new_membership = Membership(
                    user_id=new_user.id,
                    company_id=new_company.id,
                    role=RoleEnum.owner
                )
                session.add(new_membership)
                
                await session.commit()
                logger.info(f"Bootstrap dokončen. Přihlaste se jako: {settings.DEFAULT_USER_EMAIL}")
            except Exception as e:
                await session.rollback()
                logger.error(f"Chyba při bootstrapu databáze: {e}")

# --- LIFESPAN (Životní cyklus aplikace) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. STARTUP
    logger.info("Starting up application...")
    
    # Automatické vytvoření tabulek v DB
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Bootstrap výchozího uživatele
    await create_default_user()
    
    # Spuštění APScheduleru
    scheduler.start()
    # Uložíme scheduler do state, aby byl dostupný v pluginech
    app.state.scheduler = scheduler
    
    # Registrace pluginů
    pm = PluginManager(app)
    # Zde registrujeme jednotlivé pluginy
    pm.register_plugin(db_backup)
    pm.register_plugin(customer_stats)
    pm.register_plugin(attendance_export)
    pm.register_plugin(inventory_import)  # Registrace pluginu pro import skladu (příklad)

    
    # Spuštění staré logiky triggerů na pozadí
    asyncio.create_task(periodic_trigger_check())
    
    yield # Zde aplikace běží a obsluhuje požadavky
    
    # 2. SHUTDOWN
    logger.info("Shutting down application...")
    scheduler.shutdown()

# Zajištění existence složek pro nahrávání obrázků
Path("static/images/inventory").mkdir(parents=True, exist_ok=True)
# Zajištění složky pro zálohy (pro jistotu, i když to řeší Dockerfile/Plugin)
Path("/app/backups").mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# CORS nastavení
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Připojení statických souborů
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Registrace Routerů ---
app.include_router(auth.router)
app.include_router(users.router)
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
app.include_router(locations.router)
app.include_router(inventory_movements.router)
app.include_router(smtp.router)
app.include_router(triggers.router)
app.include_router(internal.router)
app.include_router(picking_orders.router)
app.include_router(partners.router)
app.include_router(pohoda.router)

@app.get("/healthz")
async def health():
    """Endpoint pro kontrolu stavu služby (health check)."""
    return {"status": "ok"}