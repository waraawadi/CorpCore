from __future__ import annotations

import urllib.parse

import jwt
from django.conf import settings
from django.core import signing


PROJECT_FILE_SALT = "projects.file.preview.v1"


def project_file_token(kind: str, attachment_id: str, schema_name: str) -> str:
    return signing.dumps({"k": kind, "a": str(attachment_id), "s": schema_name}, salt=PROJECT_FILE_SALT)


def project_file_token_parse(token: str) -> tuple[str, str, str]:
    data = signing.loads(token, salt=PROJECT_FILE_SALT, max_age=60 * 60)
    return data["k"], data["a"], data["s"]


def extension_from_name_mime(name: str, mime: str) -> str:
    n = (name or "").strip()
    if "." in n:
        ext = n.rsplit(".", 1)[-1].lower()
        if len(ext) <= 12:
            return ext
    m = (mime or "").lower()
    if m == "application/pdf":
        return "pdf"
    if m == "text/csv":
        return "csv"
    return "bin"


def onlyoffice_document_type_for_ext(ext: str) -> str | None:
    ext = ext.lower().lstrip(".")
    word_like = {"doc", "docm", "docx", "dot", "dotx", "odt", "ott", "rtf", "txt", "pdf", "htm", "html", "mht"}
    cell_like = {"csv", "fods", "ods", "ots", "xls", "xlsm", "xlsx", "xlt", "xltm", "xltx"}
    slide_like = {"fodp", "odp", "otp", "pot", "potm", "potx", "pps", "ppsm", "ppsx", "ppt", "pptm", "pptx"}
    if ext in word_like:
        return "word"
    if ext in cell_like:
        return "cell"
    if ext in slide_like:
        return "slide"
    return None


def build_onlyoffice_config_for_attachment(
    *,
    kind: str,
    attachment_id: str,
    schema_name: str,
    title: str,
    mime_type: str,
    updated_ts: int,
    user,
    internal_download_base: str,
    can_edit: bool,
) -> dict:
    ext = extension_from_name_mime(title, mime_type)
    doc_type = onlyoffice_document_type_for_ext(ext)
    if not doc_type:
        raise ValueError("unsupported_ext")
    raw_token = project_file_token(kind, attachment_id, schema_name)
    q = urllib.parse.urlencode({"t": raw_token})
    file_url = f"{internal_download_base.rstrip('/')}/api/projects/file-preview/?{q}"
    callback_url = f"{internal_download_base.rstrip('/')}/api/projects/file-callback/?{q}"
    key = f"{kind}_{str(attachment_id).replace('-', '')}_{updated_ts}"
    return {
        "document": {
            "fileType": ext,
            "key": key,
            "title": title or "document",
            "url": file_url,
            "permissions": {"edit": bool(can_edit), "download": True, "print": True},
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
