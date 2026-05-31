"""
ERPNext proxy endpoints — used only for password-mode logins from the web
preview where the browser hides the session cookie from JavaScript. Native
clients (Expo Go / iOS / Android) talk to ERPNext directly and never need
this proxy. Token-mode requests are also direct — no state stored here.
"""
from typing import Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

router = APIRouter(prefix="/erpnext", tags=["erpnext"])


def _normalize_base_url(url: str) -> str:
    trimmed = (url or "").strip().rstrip("/")
    if not trimmed:
        raise HTTPException(status_code=400, detail="baseUrl is required")
    if not (trimmed.startswith("http://") or trimmed.startswith("https://")):
        trimmed = f"https://{trimmed}"
    return trimmed


class LoginRequest(BaseModel):
    base_url: str
    usr: str
    pwd: str


class LoginResponse(BaseModel):
    sid: str
    user: str


class CallRequest(BaseModel):
    base_url: str
    method: str
    path: str
    body: Optional[Any] = None
    # Auth — caller supplies either a session id or a (usr, pwd) pair which
    # we lazily re-use to re-login if the sid has expired.
    sid: Optional[str] = None
    usr: Optional[str] = None
    pwd: Optional[str] = None


class CallResponse(BaseModel):
    status: int
    body: Any
    sid: Optional[str] = None


async def _do_login(client: httpx.AsyncClient, base_url: str, usr: str, pwd: str) -> tuple[str, dict]:
    res = await client.post(
        f"{base_url}/api/method/login",
        data={"usr": usr, "pwd": pwd},
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
        },
    )
    if res.status_code != 200:
        # Surface ERPNext's own error message
        msg = res.text or "Login failed"
        try:
            j = res.json()
            msg = j.get("message") or j.get("exception") or msg
        except Exception:
            pass
        raise HTTPException(status_code=res.status_code, detail=str(msg)[:500])
    sid = res.cookies.get("sid")
    if not sid:
        raise HTTPException(
            status_code=500,
            detail="ERPNext login succeeded but did not return a session id.",
        )
    try:
        body = res.json()
    except Exception:
        body = {}
    return sid, body


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest) -> LoginResponse:
    base_url = _normalize_base_url(payload.base_url)
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
            sid, body = await _do_login(client, base_url, payload.usr, payload.pwd)
    except HTTPException:
        raise
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach ERPNext: {e}")
    user = (
        (isinstance(body, dict) and (body.get("full_name") or body.get("message")))
        or payload.usr
    )
    return LoginResponse(sid=sid, user=str(user))


@router.post("/call", response_model=CallResponse)
async def call(payload: CallRequest) -> CallResponse:
    base_url = _normalize_base_url(payload.base_url)
    method = (payload.method or "GET").upper()
    if method not in {"GET", "POST", "PUT", "PATCH", "DELETE"}:
        raise HTTPException(status_code=400, detail=f"Unsupported method {method}")
    path = payload.path or "/"
    if not path.startswith("/"):
        path = "/" + path
    url = f"{base_url}{path}"

    async def _do_call(client: httpx.AsyncClient, cookies: dict) -> httpx.Response:
        return await client.request(
            method,
            url,
            cookies=cookies,
            json=payload.body if method in {"POST", "PUT", "PATCH"} else None,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        )

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=False) as client:
            sid = payload.sid
            # If no sid yet but we have credentials, login first. Without
            # this, calls fall back to ERPNext's anonymous Guest user.
            if not sid and payload.usr and payload.pwd:
                sid, _ = await _do_login(
                    client, base_url, payload.usr, payload.pwd
                )
            cookies = {"sid": sid} if sid else {}
            res = await _do_call(client, cookies)

            # If unauthorized and we have a usr/pwd, try a fresh login + retry once.
            if res.status_code in (401, 403) and payload.usr and payload.pwd:
                try:
                    sid, _ = await _do_login(
                        client, base_url, payload.usr, payload.pwd
                    )
                    res = await _do_call(client, {"sid": sid})
                except HTTPException:
                    raise

            try:
                body = res.json()
            except Exception:
                body = {"raw": res.text}

            return CallResponse(status=res.status_code, body=body, sid=sid)
    except HTTPException:
        raise
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Could not reach ERPNext: {e}")
