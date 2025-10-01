from fastapi import FastAPI
from app.core.config import settings
from app.db.database import engine, Base
from app.routers import auth, companies, invites

app = FastAPI(title=settings.PROJECT_NAME)

# POZOR: v produkci použij Alembic migrace. Tohle je jen na rychlé rozjetí.
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(invites.router)

@app.get("/healthz")
async def health():
    return {"ok": True}
