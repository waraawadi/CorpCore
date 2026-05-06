import os
from datetime import timedelta
from pathlib import Path
from celery.schedules import crontab


BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me-in-production")
DEBUG = env_bool("DJANGO_DEBUG", "0")
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "*").split(",") if h.strip()]

SITE_BASE_DOMAIN = os.getenv("SITE_BASE_DOMAIN", "corpcore.localhost")
PUBLIC_FRONTEND_BASE_URL = os.getenv("PUBLIC_FRONTEND_BASE_URL", "http://localhost:3000")

SHARED_APPS = [
    "django_tenants",
    "tenants",
    "subscriptions",
    "worlddata",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.admin",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "corsheaders",
    "rest_framework",
    "drf_spectacular",
]

TENANT_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.admin",
    "rest_framework",
    "drf_spectacular",
    "projects",
    "employees",
    "ged",
    "inventory",
    "crm",
    "finance",
    "api",
]

INSTALLED_APPS = SHARED_APPS + [app for app in TENANT_APPS if app not in SHARED_APPS]

MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"
PUBLIC_SCHEMA_URLCONF = "core.urls_public"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "core.wsgi.application"
ASGI_APPLICATION = "core.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": os.getenv("POSTGRES_DB", "corpcore"),
        "USER": os.getenv("POSTGRES_USER", "corpcore"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "corpcore"),
        "HOST": os.getenv("POSTGRES_HOST", "db"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}


DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)
TENANT_MODEL = "tenants.Client"
TENANT_DOMAIN_MODEL = "tenants.Domain"
# django-tenants uses SHOW_PUBLIC_IF_NO_TENANT_FOUND for fallback
# when hostname does not match a tenant (ex: localhost in dev).
SHOW_PUBLIC_IF_NO_TENANT_FOUND = True
SHOW_PUBLIC_IF_NO_TENANT = True

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "fr"
LANGUAGES = [
    ("fr", "Francais"),
    ("en", "English"),
]
TIME_ZONE = os.getenv("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# GED / uploads (ajustable via env en production, ex. derriere Nginx client_max_body_size)
DATA_UPLOAD_MAX_MEMORY_SIZE = int(os.getenv("DATA_UPLOAD_MAX_MEMORY_SIZE", str(25 * 1024 * 1024)))
FILE_UPLOAD_MAX_MEMORY_SIZE = DATA_UPLOAD_MAX_MEMORY_SIZE

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
SITE_ID = 1

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "CorpCore ERP API",
    "DESCRIPTION": "API multi-tenant CorpCore ERP SaaS",
    "VERSION": "1.0.0",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.getenv("JWT_ACCESS_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.getenv("JWT_REFRESH_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60
CELERY_BEAT_SCHEDULE = {
    "subscriptions-enforce-grace-periods-hourly": {
        "task": "subscriptions.tasks.enforce_subscription_grace_periods",
        "schedule": crontab(minute=0),
    },
    "subscriptions-expire-trials-daily": {
        "task": "subscriptions.tasks.expire_trial_subscriptions",
        "schedule": crontab(minute=10, hour=0),
    },
    "subscriptions-send-expiry-reminders-daily": {
        "task": "subscriptions.tasks.send_subscription_expiry_reminders",
        "schedule": crontab(minute=20, hour=8),
    },
}

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "noreply@corpcore.app")
EMAIL_NOTIFICATIONS_ENABLED = env_bool("EMAIL_NOTIFICATIONS_ENABLED", "1")

EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "sendgrid_backend.SendgridBackend" if SENDGRID_API_KEY else "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.sendgrid.net")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "apikey")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
if "gmail.com" in EMAIL_HOST.lower():
    # Gmail app passwords are 16 chars and users often paste them with separators.
    EMAIL_HOST_PASSWORD = EMAIL_HOST_PASSWORD.replace(" ", "").replace("_", "").replace("-", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", "1")
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", "0")

WHATSAPP_API_BASE_URL = os.getenv("WHATSAPP_API_BASE_URL", "")
WHATSAPP_API_TOKEN = os.getenv("WHATSAPP_API_TOKEN", "")

FEDAPAY_API_KEY = os.getenv("FEDAPAY_API_KEY", "")
FEDAPAY_ENV = os.getenv("FEDAPAY_ENV", "sandbox")
FEDAPAY_WEBHOOK_SECRET = os.getenv("FEDAPAY_WEBHOOK_SECRET", "")

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "")
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL", "")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ONLYOFFICE Document Server (JWT identique au conteneur onlyoffice ; a changer en production)
ONLYOFFICE_JWT_SECRET = os.getenv("ONLYOFFICE_JWT_SECRET", "onlyoffice-dev-secret")
ONLYOFFICE_DOCUMENT_SERVER_URL = os.getenv("ONLYOFFICE_DOCUMENT_SERVER_URL", "http://localhost:8089")
# URL que ONLYOFFICE utilise pour telecharger le fichier (Docker: http://backend:8000)
OFFICE_FILE_DOWNLOAD_BASE = os.getenv("OFFICE_FILE_DOWNLOAD_BASE", "http://backend:8000")

CORS_ALLOWED_ORIGINS = [u.strip() for u in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",") if u.strip()]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://([a-z0-9-]+\.)?localhost:3000$",
    r"^http://([a-z0-9-]+\.)?127\.0\.0\.1:3000$",
    r"^https?://([a-z0-9-]+\.)?corpcore\.local$",
]
