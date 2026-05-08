from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from api.v1.routes.profile import router as profile_router
from config import settings
import logging

logging.basicConfig(
    level=settings.LOG_LEVEL,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("Team Behavior Profiler microservice starting on port %s", settings.SERVICE_PORT)
    yield
    logging.info("Team Behavior Profiler microservice shutting down.")

app = FastAPI(
    title="Team Behavior Profiler",
    description="AI microservice for generating team member behavior profiles using Gemma 4.",
    version="1.0.0",
    docs_url="/docs",    # Set to None in production for security
    redoc_url=None,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.NEXT_JS_ORIGIN],
    allow_credentials=True,
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)

app.include_router(profile_router, prefix="/api/v1")

@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "team-behavior-profiler",
        "version": "1.0.0"
    }
