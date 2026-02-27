from fastapi import FastAPI
from .router import router
from .service import init_scheduler

def setup(app: FastAPI):
    # 1. Registrace routeru
    app.include_router(router)
    
    # 2. Inicializace plánovaných úloh (pokud je scheduler spuštěn)
    if hasattr(app.state, "scheduler"):
        init_scheduler(app.state.scheduler)