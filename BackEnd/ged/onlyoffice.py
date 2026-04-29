"""Helpers ONLYOFFICE (JWT config, jeton de telechargement multi-tenant)."""

from __future__ import annotations

import urllib.parse

import jwt
from django.conf import settings
from django.core import signing

from .models import Document

OFFICE_FILE_SALT = "ged.office.file.v1"


def office_file_token(document_id: str, schema_name: str) -> str:
    return signing.dumps({"d": str(document_id), "s": schema_name}, salt=OFFICE_FILE_SALT)


def office_file_token_parse(token: str) -> tuple[str, str]:
    data = signing.loads(token, salt=OFFICE_FILE_SALT, max_age=60 * 60)
    return data["d"], data["s"]


def extension_from_document(doc: Document) -> str:
    name = (doc.original_filename or doc.title or "").strip()
    if "." in name:
        ext = name.rsplit(".", 1)[-1].lower()
        if len(ext) <= 12:
            return ext
    mime = (doc.mime_type or "").lower()
    if mime == "application/pdf":
        return "pdf"
    if mime == "text/csv":
        return "csv"
    return "bin"


def onlyoffice_document_type_for_ext(ext: str) -> str | None:
    ext = ext.lower().lstrip(".")
    word_like = {
        "doc",
        "docm",
        "docx",
        "dot",
        "dotx",
        "epub",
        "fb2",
        "fodt",
        "htm",
        "html",
        "mht",
        "odt",
        "ott",
        "pdf",
        "rtf",
        "txt",
        "djvu",
        "xps",
    }
    cell_like = {"csv", "fods", "ods", "ots", "xls", "xlsm", "xlsx", "xlt", "xltm", "xltx"}
    slide_like = {"fodp", "odp", "otp", "pot", "potm", "potx", "pps", "ppsm", "ppsx", "ppt", "pptm", "pptx"}
    if ext in word_like:
        return "word"
    if ext in cell_like:
        return "cell"
    if ext in slide_like:
        return "slide"
    return None


def build_onlyoffice_config(
    doc: Document,
    schema_name: str,
    user,
    internal_download_base: str,
    *,
    can_edit: bool = False,
) -> dict:
    ext = extension_from_document(doc)
    doc_type = onlyoffice_document_type_for_ext(ext)
    if not doc_type:
        raise ValueError("unsupported_ext")
    raw_token = office_file_token(str(doc.pk), schema_name)
    q = urllib.parse.urlencode({"t": raw_token})
    file_url = f"{internal_download_base.rstrip('/')}/api/ged/office-file/?{q}"
    callback_url = f"{internal_download_base.rstrip('/')}/api/ged/office-callback/?{q}"
    # Cle document ONLYOFFICE : uniquement [0-9a-zA-Z_-] (pas de point ni deux-points)
    key = f"{str(doc.id).replace('-', '')}_{int(doc.updated_at.timestamp())}"
    display_name = (doc.title or doc.original_filename or "document").strip() or "document"
    return {
        "document": {
            "fileType": ext,
            "key": key,
            "title": display_name,
            "url": file_url,
            "permissions": {
                "edit": bool(can_edit),
                "download": True,
                "print": True,
            },
        },
        "documentType": doc_type,
        "editorConfig": {
            "mode": "edit" if can_edit else "view",
            "lang": "fr",
            "callbackUrl": callback_url,
            "user": {
                "id": str(user.id),
                "name": user.get_full_name() or user.get_username() or str(user.pk),
            },
        },
    }


def jwt_sign_onlyoffice_config(config: dict) -> str:
    secret = (settings.ONLYOFFICE_JWT_SECRET or "").strip()
    if not secret:
        raise ValueError("missing_jwt_secret")
    raw = jwt.encode(config, secret, algorithm="HS256")
    return raw if isinstance(raw, str) else raw.decode("ascii")
