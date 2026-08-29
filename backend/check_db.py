import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from src.config.supabase import get_service_client

supabase = get_service_client()
print("Checking tables...")

# Check public.users
try:
    res = supabase.table("users").select("*").execute()
    print("users table records:", len(res.data))
    for u in res.data:
        if u.get("email") == "developerhasnainraza@gmail.com":
            print("Found in public.users. Deleting...")
            del_res = supabase.table("users").delete().eq("email", "developerhasnainraza@gmail.com").execute()
            print("Deleted from public.users:", del_res.data)
except Exception as e:
    print("users table check error:", e)

# Check public.profiles
try:
    res = supabase.table("profiles").select("*").execute()
    print("profiles table records:", len(res.data))
    for p in res.data:
        if p.get("email") == "developerhasnainraza@gmail.com":
            print("Found in public.profiles. Deleting...")
            del_res = supabase.table("profiles").delete().eq("email", "developerhasnainraza@gmail.com").execute()
            print("Deleted from public.profiles:", del_res.data)
except Exception as e:
    print("profiles table check error:", e)
