from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "InterMate Resume Analyzer"
    app_version: str = "2.0.0"
    cors_origins_raw: str = Field(default="*", alias="CORS_ORIGINS")

    llm_provider: str = Field(default="none", alias="LLM_PROVIDER")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4.1-mini", alias="OPENAI_MODEL")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    anthropic_model: str = Field(default="claude-3-5-sonnet-latest", alias="ANTHROPIC_MODEL")

    spacy_model: str = Field(default="en_core_web_sm", alias="SPACY_MODEL")
    embedding_model: str = Field(default="all-MiniLM-L6-v2", alias="EMBEDDING_MODEL")
    enable_embeddings: bool = Field(default=True, alias="ENABLE_EMBEDDINGS")
    max_pdf_pages: int = Field(default=10, alias="MAX_PDF_PAGES")
    min_text_length: int = Field(default=50, alias="MIN_TEXT_LENGTH")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
