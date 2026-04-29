import secrets
from typing import Any

import requests
from django.conf import settings


def fedapay_base_url() -> str:
    env = (settings.FEDAPAY_ENV or "sandbox").lower()
    return "https://api.fedapay.com/v1" if env == "live" else "https://sandbox-api.fedapay.com/v1"


def fedapay_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.FEDAPAY_API_KEY}",
        "Content-Type": "application/json",
    }


def create_module_transaction(
    *,
    amount: int,
    description: str,
    callback_url: str,
    customer_email: str,
    customer_firstname: str,
    customer_lastname: str,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "description": description,
        "amount": int(amount),
        "currency": {"iso": "XOF"},
        "callback_url": callback_url,
        "customer": {
            "email": customer_email,
            "firstname": customer_firstname or "Client",
            "lastname": customer_lastname or "Client",
        },
        "merchant_reference": f"corpcore-{secrets.token_hex(12)}",
        "custom_metadata": metadata or {},
    }
    response = requests.post(
        f"{fedapay_base_url()}/transactions",
        json=payload,
        headers=fedapay_headers(),
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    if isinstance(data, dict):
        return data
    if isinstance(data, list) and data:
        return data[0]
    raise ValueError("Unexpected FedaPay transaction payload")


def unwrap_fedapay_resource(payload: dict) -> dict:
    if not isinstance(payload, dict):
        return {}
    if len(payload) == 1:
        (only_key, only_val), *_ = payload.items()
        if isinstance(only_key, str) and "transaction" in only_key.lower() and isinstance(only_val, dict):
            return only_val
    for key in ("transaction", "v1", "data"):
        val = payload.get(key)
        if isinstance(val, dict):
            if "transaction" in val and isinstance(val["transaction"], dict):
                return val["transaction"]
            if val.get("id") is not None:
                return val
    return payload


def extract_transaction_id(payload: dict) -> str | None:
    tx = unwrap_fedapay_resource(payload)
    transaction_id = tx.get("id") if isinstance(tx, dict) else None
    if transaction_id is None and isinstance(payload, dict):
        transaction_id = payload.get("id")
    return str(transaction_id) if transaction_id is not None else None


def extract_transaction_status(payload: dict) -> str:
    tx = unwrap_fedapay_resource(payload)
    if isinstance(tx, dict) and tx.get("status"):
        return str(tx["status"])
    if isinstance(payload, dict) and payload.get("status"):
        return str(payload["status"])
    return "pending"


def get_transaction(token_or_id: str | int) -> dict:
    response = requests.get(
        f"{fedapay_base_url()}/transactions/{token_or_id}",
        headers=fedapay_headers(),
        timeout=20,
    )
    response.raise_for_status()
    body = response.json()
    if isinstance(body, dict):
        return body
    if isinstance(body, list) and body:
        return body[0]
    raise ValueError("Unexpected FedaPay payload")


def get_transaction_payment_url(transaction_id: str | int) -> str | None:
    response = requests.post(
        f"{fedapay_base_url()}/transactions/{transaction_id}/token",
        json={},
        headers=fedapay_headers(),
        timeout=20,
    )
    if response.status_code not in (200, 201):
        return None
    body = response.json()
    payload = body[0] if isinstance(body, list) and body else body
    if not isinstance(payload, dict):
        return None
    return (
        payload.get("url")
        or payload.get("payment_url")
        or payload.get("invoice_url")
        or (payload.get("data") or {}).get("url")
    )
