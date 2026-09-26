from pydantic_settings import BaseSettings, SettingsConfigDict

# Значения-заглушки для JWT_SECRET: из кода по умолчанию и из .env.example
_PLACEHOLDER_SECRETS = {"dev-secret-change-me", "замени_меня_на_случайную_строку"}


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./dev.db"  # запасной вариант для локальной разработки
    JWT_SECRET: str = "dev-secret-change-me"
    JWT_EXPIRE_MINUTES: int = 1440
    JWT_ALGORITHM: str = "HS256"
    # адреса веб-фронта в интернете через запятую, например https://bulhub.vercel.app
    ALLOWED_ORIGINS: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()

# С настоящей базой не стартуем с секретом-заглушкой: им подписываются токены
# входа, и любой, кто знает заглушку, смог бы подделать токен любого пользователя.
# Локальная SQLite-разработка — исключение.
if not settings.DATABASE_URL.startswith("sqlite") and (
    settings.JWT_SECRET in _PLACEHOLDER_SECRETS or len(settings.JWT_SECRET) < 32
):
    raise RuntimeError(
        "JWT_SECRET не задан или слишком короткий. Сгенерируй: "
        'python -c "import secrets; print(secrets.token_hex(32))"'
    )
