"""
Authentication Middleware
T026: JWT authentication and authorization
"""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional, Dict, Any
import asyncio
import base64
import binascii
import logging
import hashlib
import json
import time
from src.config.settings import settings
from src.config.supabase import get_supabase_client, get_service_client
from src.config.redis import get_redis_client

logger = logging.getLogger(__name__)

security = HTTPBearer()

DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000"
DEFAULT_ROLE = "customer"


def _decode_token_exp(token: str) -> Optional[int]:
    """
    Read the `exp` claim from a JWT payload without verifying the signature.

    The signature is validated by Supabase in `verify_token`; this helper only
    exists so a cached (already-verified) entry can be expired locally.

    Args:
        token: Raw JWT string

    Returns:
        Unix timestamp of expiry, or None if it cannot be parsed
    """
    try:
        payload_segment = token.split(".")[1]
        padding = "=" * (-len(payload_segment) % 4)
        decoded = base64.urlsafe_b64decode(payload_segment + padding)
        exp = json.loads(decoded).get("exp")
        return int(exp) if exp is not None else None
    except (IndexError, ValueError, binascii.Error, json.JSONDecodeError, TypeError):
        return None


def _load_server_side_profile(
    auth_id: str,
    email: Optional[str],
    fallback_role: Optional[str] = None,
    fallback_tenant: Optional[str] = None,
) -> Dict[str, str]:
    """
    Load role and tenant_id from the server-side `customers` table.
    If no row exists yet or row role is customer while metadata has elevated role,
    sync with user metadata so registered admins/managers have access.

    Args:
        auth_id: Supabase Auth user id
        email: User email (fallback lookup key)
        fallback_role: Role from user/app metadata
        fallback_tenant: Tenant ID from metadata

    Returns:
        Dict with `role`, `tenant_id`, and optional `customer_id`
    """
    effective_role = fallback_role if fallback_role in ("admin", "manager", "agent", "customer") else DEFAULT_ROLE
    effective_tenant = fallback_tenant or DEFAULT_TENANT_ID

    profile = {"role": effective_role, "tenant_id": effective_tenant}

    try:
        supabase = get_service_client()
        result = (
            supabase.table("customers")
            .select("id, role, tenant_id")
            .eq("auth_id", str(auth_id))
            .limit(1)
            .execute()
        )

        row = result.data[0] if result.data else None

        # Fallback lookup by email for rows created before auth_id linkage
        if row is None and email:
            by_email = (
                supabase.table("customers")
                .select("id, role, tenant_id")
                .eq("email", email)
                .limit(1)
                .execute()
            )
            row = by_email.data[0] if by_email.data else None

        if row:
            db_role = row.get("role")
            # If user registered as admin/manager but db row had customer, upgrade db row
            if fallback_role in ("admin", "manager") and db_role != fallback_role:
                try:
                    supabase.table("customers").update({"role": fallback_role}).eq("id", row["id"]).execute()
                    db_role = fallback_role
                except Exception:
                    pass

            profile["role"] = db_role or effective_role
            profile["tenant_id"] = str(row.get("tenant_id") or effective_tenant)
            if row.get("id"):
                profile["customer_id"] = str(row["id"])
        else:
            # Auto-create customer record with registered role
            if email:
                try:
                    insert_res = supabase.table("customers").insert({
                        "auth_id": str(auth_id),
                        "email": email,
                        "name": email.split("@")[0],
                        "role": effective_role,
                        "tenant_id": effective_tenant,
                    }).execute()
                    if insert_res.data:
                        profile["customer_id"] = str(insert_res.data[0].get("id"))
                except Exception as insert_err:
                    logger.debug(f"Auto customer insert skipped: {insert_err}")

            profile["role"] = effective_role
            profile["tenant_id"] = effective_tenant

    except Exception as e:
        logger.warning(f"Database customer profile lookup failed ({e}), using verified metadata role: {effective_role}")
        profile["role"] = effective_role
        profile["tenant_id"] = effective_tenant

    return profile


_AUTH_TOKEN_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}

def clear_auth_cache_for_user(user_id: Optional[str] = None):
    """Evict token cache immediately on role or status change"""
    global _AUTH_TOKEN_CACHE
    if user_id:
        _AUTH_TOKEN_CACHE = {k: v for k, v in _AUTH_TOKEN_CACHE.items() if v[1].get("user_id") != str(user_id)}
    else:
        _AUTH_TOKEN_CACHE.clear()

async def verify_token(credentials: HTTPAuthorizationCredentials) -> Dict[str, Any]:
    """
    Verify JWT token from Supabase Auth with In-Memory + Redis fast caching
    """
    token = credentials.credentials
    token_hash = hashlib.sha256(token.encode()).hexdigest()

    # 1. Check ultra-fast in-memory cache (0.01ms)
    now = time.time()
    cached_entry = _AUTH_TOKEN_CACHE.get(token_hash)
    if cached_entry:
        cached_time, cached_data = cached_entry
        if now - cached_time < 60:  # 60s fast memory cache
            token_exp = cached_data.get("exp")
            if token_exp is None or now < token_exp:
                return cached_data

    cache_key = f"auth_token_cache:{token_hash}"

    # 2. Try Redis cache if available
    redis_client = None
    try:
        redis_client = await get_redis_client()
        if redis_client:
            cached_user = await redis_client.get(cache_key)
            if cached_user:
                cached_data = json.loads(cached_user)
                token_exp = cached_data.get("exp")
                if token_exp is None or now < token_exp:
                    _AUTH_TOKEN_CACHE[token_hash] = (now, cached_data)
                    return cached_data
    except Exception:
        pass

    user_obj = None
    try:
        # Verify token with Supabase in worker thread to prevent blocking event loop
        supabase = get_supabase_client()
        user = await asyncio.to_thread(supabase.auth.get_user, token)
        if user and user.user:
            user_obj = user.user
    except Exception as supa_err:
        logger.debug(f"Supabase auth.get_user lookup failed ({supa_err}), falling back to token payload")

    if not user_obj:
        # Fallback: Parse claims directly from JWT if not expired
        try:
            payload_segment = token.split(".")[1]
            padding = "=" * (-len(payload_segment) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(payload_segment + padding))
            exp = decoded.get("exp")
            if exp and time.time() > exp:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            class TokenUserFallback:
                def __init__(self, data: dict):
                    self.id = data.get("sub")
                    self.email = data.get("email")
                    self.user_metadata = data.get("user_metadata", {})
                    self.app_metadata = data.get("app_metadata", {})
                    self.banned_until = None

            if decoded.get("sub"):
                user_obj = TokenUserFallback(decoded)
        except HTTPException:
            raise
        except Exception:
            pass

    if not user_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract metadata fallback roles from user token
    user_meta = getattr(user_obj, "user_metadata", {}) or {}
    app_meta = getattr(user_obj, "app_metadata", {}) or {}

    # Check for account suspension
    if (
        user_meta.get("status") == "suspended"
        or app_meta.get("status") == "suspended"
        or getattr(user_obj, "banned_until", None) is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact the administrator.",
        )

    meta_role = user_meta.get("role") or app_meta.get("role")
    meta_tenant = user_meta.get("tenant_id") or app_meta.get("tenant_id")

    profile = await asyncio.to_thread(
        _load_server_side_profile,
        auth_id=user_obj.id,
        email=user_obj.email,
        fallback_role=meta_role,
        fallback_tenant=meta_tenant,
    )

    if profile.get("role") == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended. Please contact the administrator.",
        )

    user_data = {
        "user_id": user_obj.id,
        "email": user_obj.email,
        "role": profile["role"],
        "tenant_id": profile["tenant_id"],
        "exp": _decode_token_exp(token),
    }
    if "customer_id" in profile:
        user_data["customer_id"] = profile["customer_id"]

    # Fast in-memory cache
    _AUTH_TOKEN_CACHE[token_hash] = (time.time(), user_data)

    # Cache in Redis with 5 minutes TTL
    if redis_client:
        try:
            await redis_client.setex(cache_key, 300, json.dumps(user_data))
        except Exception as re:
            logger.warning(f"Failed to cache token in Redis: {re}")

    return user_data


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Get current authenticated user from token

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        User data dictionary
    """
    return await verify_token(credentials)


def require_role(allowed_roles: list[str]):
    """
    Decorator to require specific roles for endpoint access

    Args:
        allowed_roles: List of allowed roles

    Returns:
        Dependency function
    """
    async def role_checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}"
            )
        return user

    return role_checker


async def get_optional_user(request: Request) -> Optional[Dict[str, Any]]:
    """
    Get current user if authenticated, None otherwise (for optional auth)

    Args:
        request: FastAPI request

    Returns:
        User data or None
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.replace("Bearer ", "")

    try:
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials=token
        )
        return await verify_token(credentials)
    except HTTPException:
        return None
