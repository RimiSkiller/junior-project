from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")

    HF_TOKEN: str
    MODEL_ID: str = "google/gemma-4-31B-it"
    MODEL_PROVIDER: str = "novita"
    NEXT_JS_ORIGIN: str = "http://localhost:3000"
    LOG_LEVEL: str = "INFO"
    SERVICE_PORT: int = 8002

settings = Settings()
