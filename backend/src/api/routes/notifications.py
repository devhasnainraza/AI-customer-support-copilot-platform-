"""Notification API Routes - In-App, Push, Email"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import logging

from src.services.notification_service import notification_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/v1/notifications", tags=["notifications"])

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict

# User Notifications
@router.get("/user/{user_id}")
async def get_user_notifications(user_id: str, unread_only: bool = False, limit: int = 50):
    notifications = await notification_service.get_user_notifications(
        user_id, unread_only=unread_only, limit=limit
    )
    return {"notifications": notifications, "total": len(notifications)}

@router.get("/user/{user_id}/unread-count")
async def get_unread_count(user_id: str):
    count = await notification_service.get_unread_count(user_id)
    return {"count": count}

@router.post("/user/{user_id}/mark-read/{notification_id}")
async def mark_read(user_id: str, notification_id: str):
    success = await notification_service.mark_read(notification_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "read"}

@router.post("/user/{user_id}/mark-all-read")
async def mark_all_read(user_id: str):
    count = await notification_service.mark_all_read(user_id)
    return {"marked": count}

# Push Notifications
@router.post("/push/subscribe/{user_id}")
async def subscribe_push(user_id: str, payload: PushSubscription):
    await notification_service.subscribe_push(user_id, payload.model_dump())
    return {"status": "subscribed"}

@router.post("/push/unsubscribe/{user_id}")
async def unsubscribe_push(user_id: str):
    await notification_service.unsubscribe_push(user_id)
    return {"status": "unsubscribed"}
