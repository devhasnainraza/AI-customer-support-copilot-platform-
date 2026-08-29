import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.config.supabase import get_service_client

def create_admin_user():
    supabase = get_service_client()
    try:
        # Search for existing user to delete
        users_response = supabase.auth.admin.list_users()
        user_id = None
        for user in users_response:
            if user.email == "developerhasnainraza@gmail.com":
                user_id = user.id
                break
        
        if user_id:
            print(f"Found existing user with ID {user_id}. Deleting...")
            supabase.auth.admin.delete_user(user_id)
            print("User deleted.")
            
        # Create user through admin API
        res = supabase.auth.admin.create_user({
            "email": "developerhasnainraza@gmail.com",
            "password": "Password123!",
            "email_confirm": True,
            "user_metadata": {
                "full_name": "Developer Hasnain Raza"
            }
        })
        print("SUCCESS: User created successfully.")
        print(res)
    except Exception as e:
        print("ERROR:", e)

if __name__ == "__main__":
    create_admin_user()
