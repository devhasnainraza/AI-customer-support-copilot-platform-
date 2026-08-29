"""
Create & Auto-Confirm Customer Account in Supabase Auth
Bypasses Supabase SMTP email rate limits using the Service Role Admin API.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from src.config.supabase import get_service_client
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_customer_account(email: str, password: str, full_name: str, role: str = "customer"):
    supabase = get_service_client()
    logger.info(f"Creating & auto-confirming account for {email} ({role})...")

    try:
        # Check if user already exists
        users_resp = supabase.auth.admin.list_users()
        existing_user = None
        for u in users_resp:
            if u.email.lower() == email.lower():
                existing_user = u
                break

        if existing_user:
            logger.info(f"User {email} already exists in Supabase Auth (ID: {existing_user.id}). Updating password & metadata...")
            supabase.auth.admin.update_user_by_id(
                existing_user.id,
                {
                    "password": password,
                    "email_confirm": True,
                    "user_metadata": {
                        "full_name": full_name,
                        "role": role,
                        "email_verified": True
                    }
                }
            )
            user_id = existing_user.id
        else:
            res = supabase.auth.admin.create_user({
                "email": email,
                "password": password,
                "email_confirm": True,
                "user_metadata": {
                    "full_name": full_name,
                    "role": role,
                    "email_verified": True
                }
            })
            user_id = res.user.id
            logger.info(f"Successfully created user {email} (ID: {user_id})!")

        # Sync customer record in DB
        cust_res = supabase.table("customers").select("*").eq("auth_id", user_id).execute()
        if not cust_res.data:
            logger.info("Creating customer DB record...")
            supabase.table("customers").insert({
                "auth_id": user_id,
                "email": email,
                "name": full_name,
                "role": role,
                "tenant_id": "00000000-0000-0000-0000-000000000000"
            }).execute()
        else:
            logger.info("Updating customer DB record...")
            supabase.table("customers").update({
                "email": email,
                "name": full_name,
                "role": role
            }).eq("auth_id", user_id).execute()

        logger.info(f"✅ Account {email} is READY! Password set to: {password}")
        return True

    except Exception as e:
        logger.error(f"Failed to create customer account: {e}")
        return False

if __name__ == "__main__":
    email = sys.argv[1] if len(sys.argv) > 1 else "chat.hasnain@gmail.com"
    password = sys.argv[2] if len(sys.argv) > 2 else "Hasnain123!"
    full_name = sys.argv[3] if len(sys.argv) > 3 else "Muhammad Hasnain"
    create_customer_account(email, password, full_name)
