from fastapi import FastAPI
from .router import router

def setup(app: FastAPI):
    # Registrace routeru do hlavní aplikace
    app.include_router(router)