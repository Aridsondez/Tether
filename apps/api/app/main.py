# apps/api/app/main.py

import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import database
from app.routers import calendar, finance, health, partner_notes, places, preferences, relationships, timelines, users

load_dotenv()


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.open()
    try:
        yield
    finally:
        database.close()


app = FastAPI(lifespan=lifespan)


def configured_origins() -> list[str]:
    origins = os.getenv("CORS_ORIGINS", "")
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(users.router)
app.include_router(relationships.router)
app.include_router(preferences.router)
app.include_router(partner_notes.router)
app.include_router(places.router)
app.include_router(timelines.router)
app.include_router(calendar.router)
app.include_router(finance.router)
