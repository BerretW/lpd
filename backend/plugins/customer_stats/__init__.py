from fastapi import FastAPI
from .router import router

def setup(app: FastAPI):
    app.include_router(router)