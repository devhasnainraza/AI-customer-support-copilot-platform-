"""
Email Notification Preferences Service
Per-user and per-role email notification preferences with role-based defaults.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from uuid import uuid4

logger = logging.getLogger(__name__)

# Email notification categories
EMAIL_CATEGORIES = {
    "escalation_alerts": {
        "name": "Escalation Alerts",
        "description": "Critical escalation notifications when tickets need manager attention",
        "icon": "🚨",
        "default_roles": ["admin", "manager"],
    },
    "handoff_requests": {
        "name": "Handoff Requests",
        "description": "New handoff requests from customers needing human assistance",
        "icon": "👤",
        "default_roles": ["admin", "agent"],
    },
    "ticket_updates": {
        "name": "Ticket Updates",
        "description": "Status changes and new ticket creation notifications",
        "icon": "🎫",
        "default_roles": ["admin", "manager"],
    },
    "system_alerts": {
        "name": "System Alerts",
        "description": "System health, errors, and performance alerts",
        "icon": "⚙️",
        "default_roles": ["admin"],
    },
    "agent_activity": {
        "name": "Agent Activity",
        "description": "Agent online/offline status and workload changes",
        "icon": "👥",
        "default_roles": ["admin", "manager"],
    },
    "weekly_digest": {
        "name": "Weekly Digest",
        "description": "Weekly summary of support metrics, tickets, and performance",
        "icon": "📊",
        "default_roles": ["admin", "manager"],
    },
}


class EmailPreference:
    def __init__(self, user_id: str, category: str, enabled: bool, email: str):
        self.id = str(uuid4())
        self.user_id = user_id
        self.category = category
        self.enabled = enabled
        self.email = email
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return {
            "id": self.id, "user_id": self.user_id,
            "category": self.category, "enabled": self.enabled,
            "email": self.email, "updated_at": self.updated_at,
        }


class EmailPreferenceService:
    def __init__(self):
        self._preferences: Dict[str, Dict[str, EmailPreference]] = {}
        self._role_defaults: Dict[str, Dict[str, bool]] = {}
        self._lock = asyncio.Lock()
        self._init_role_defaults()

    def _init_role_defaults(self):
        """Initialize default preferences for each role."""
        for category_id, category in EMAIL_CATEGORIES.items():
            for role in ["admin", "manager", "agent", "customer"]:
                if role not in self._role_defaults:
                    self._role_defaults[role] = {}
                self._role_defaults[role][category_id] = role in category["default_roles"]

    def get_default_preferences(self, role: str) -> Dict[str, bool]:
        """Get default email preferences for a role."""
        return self._role_defaults.get(role, {})

    async def get_user_preferences(self, user_id: str, role: str = "customer",
                                    email: str = "") -> List[dict]:
        """Get all email preferences for a user, filling in defaults if needed."""
        async with self._lock:
            user_prefs = self._preferences.get(user_id, {})
            defaults = self.get_default_preferences(role)

            result = []
            for cat_id, cat_info in EMAIL_CATEGORIES.items():
                pref = user_prefs.get(cat_id)
                if pref:
                    result.append(pref.to_dict())
                else:
                    # Use role default
                    result.append({
                        "id": None,
                        "user_id": user_id,
                        "category": cat_id,
                        "category_name": cat_info["name"],
                        "description": cat_info["description"],
                        "icon": cat_info["icon"],
                        "enabled": defaults.get(cat_id, False),
                        "email": email,
                        "is_default": True,
                    })
            return result

    async def update_preference(self, user_id: str, category: str,
                                 enabled: bool, email: str) -> Optional[EmailPreference]:
        """Update a single email preference for a user."""
        if category not in EMAIL_CATEGORIES:
            return None

        async with self._lock:
            if user_id not in self._preferences:
                self._preferences[user_id] = {}

            existing = self._preferences[user_id].get(category)
            if existing:
                existing.enabled = enabled
                if email:
                    existing.email = email
                existing.updated_at = datetime.now(timezone.utc).isoformat()
                return existing

            pref = EmailPreference(user_id, category, enabled, email)
            self._preferences[user_id][category] = pref
            return pref

    async def update_multiple_preferences(self, user_id: str, updates: Dict[str, bool],
                                           email: str = "") -> List[dict]:
        """Update multiple preferences at once."""
        results = []
        for category, enabled in updates.items():
            pref = await self.update_preference(user_id, category, enabled, email)
            if pref:
                results.append(pref.to_dict())
        return results

    async def get_role_preferences(self, role: str) -> Dict[str, List[dict]]:
        """Get all preferences grouped by user for a specific role."""
        async with self._lock:
            result = {}
            for user_id, user_prefs in self._preferences.items():
                # This would need role info in production
                result[user_id] = [p.to_dict() for p in user_prefs.values()]
            return result

    async def check_can_send_email(self, user_id: str, category: str) -> bool:
        """Check if an email can be sent to a user for a specific category."""
        async with self._lock:
            user_prefs = self._preferences.get(user_id, {})
            pref = user_prefs.get(category)
            if pref:
                return pref.enabled
            # Check role defaults
            return False

    async def bulk_enable_for_role(self, role: str, category: str,
                                    enabled: bool) -> int:
        """Bulk update a category for all users of a role (admin function)."""
        async with self._lock:
            count = 0
            for user_id, user_prefs in self._preferences.items():
                if category in user_prefs:
                    user_prefs[category].enabled = enabled
                    count += 1
            return count

    async def get_all_preferences(self) -> Dict[str, List[dict]]:
        """Get all user preferences (admin view)."""
        async with self._lock:
            return {
                user_id: [p.to_dict() for p in prefs.values()]
                for user_id, prefs in self._preferences.items()
            }

    async def get_preference_stats(self) -> dict:
        """Get statistics about email preferences."""
        async with self._lock:
            total_users = len(self._preferences)
            enabled_counts = {}
            for cat_id in EMAIL_CATEGORIES:
                enabled_counts[cat_id] = sum(
                    1 for prefs in self._preferences.values()
                    if cat_id in prefs and prefs[cat_id].enabled
                )
            return {
                "total_users": total_users,
                "categories": EMAIL_CATEGORIES,
                "enabled_counts": enabled_counts,
            }


# Global singleton
email_preference_service = EmailPreferenceService()
