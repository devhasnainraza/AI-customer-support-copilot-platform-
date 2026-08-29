"""
Authentication Middleware
T026: JWT authentication and authorization
"""
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from typing import Optional, Dict, Any
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


def _load_server_side_profile(auth_id: str, email: Optional[str]) -> Dict[str, str]:
    """
    Load role and tenant_id from the server-side `customers` table.

    Client-writable `user_metadata` must never be trusted for authorization,
    so the authoritative values come from the database row linked by auth_id.

    Args:
        auth_id: Supabase Auth user id
        email: User email (fallback lookup key)

    Returns:
        Dict with `role` and `tenant_id` (defaults if no row exists)
    """
    profile = {"role": DEFAULT_ROLE, "tenant_id": DEFAULT_TENANT_ID}

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
            profile["role"] = row.get("role") or DEFAULT_ROLE
            profile["tenant_id"] = str(row.get("tenant_id") or DEFAULT_TENANT_ID)
            if row.get("id"):
                profile["customer_id"] = str(row["id"])
        else:
            logger.warning(
                f"No customers row for auth_id={auth_id}; defaulting to role "
                f"'{DEFAULT_ROLE}' and tenant {DEFAULT_TENANT_ID}"
            )

    except Exception as e:
        # Fail closed on privileges: keep the least-privileged defaults
        logger.error(f"Failed to load customer profile for {auth_id}: {e}")

    return profile


async def verify_token(credentials: HTTPAuthorizationCredentials) -> Dict[str, Any]:
    """
    Verify JWT token from Supabase Auth with Redis caching

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        Decoded token payload

    Raises:
        HTTPException: If token is invalid or expired
    """
    token = credentials.credentials
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    cache_key = f"auth_token_cache:{token_hash}"

    # Try to retrieve from Redis cache
    redis_client = None
    try:
        redis_client = await get_redis_client()
        cached_user = await redis_client.get(cache_key)
        if cached_user:
            cached_data = json.loads(cached_user)
            token_exp = cached_data.get("exp")
            if token_exp is not None and time.time() >= token_exp:
                # Token expired since it was cached - drop it and re-verify
                logger.info("Cached auth token expired; re-verifying with Supabase")
                try:
                    await redis_client.delete(cache_key)
                except Exception as re:
                    logger.warning(f"Failed to evict expired auth cache entry: {re}")
            else:
                return cached_data
    except Exception as re:
        logger.warning(f"Redis auth cache lookup failed: {re}")

    try:
        # Verify token with Supabase
        supabase = get_supabase_client()
        user = supabase.auth.get_user(token)

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Authorization attributes MUST come from the server-side customers
        # table, never from client-writable user_metadata.
        profile = _load_server_side_profile(user.user.id, user.user.email)

        user_data = {
            "user_id": user.user.id,
            "email": user.user.email,
            "role": profile["role"],
            "tenant_id": profile["tenant_id"],
            "exp": _decode_token_exp(token),
        }
        if "customer_id" in profile:
            user_data["customer_id"] = profile["customer_id"]

        # Cache in Redis with 5 minutes TTL
        if redis_client:
            try:
                await redis_client.setex(cache_key, 300, json.dumps(user_data))
            except Exception as re:
                logger.warning(f"Failed to cache token in Redis: {re}")

        return user_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
