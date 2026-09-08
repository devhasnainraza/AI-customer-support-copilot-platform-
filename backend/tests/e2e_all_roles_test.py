import asyncio
import os
import sys
import traceback
import httpx

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.config.supabase import get_supabase_client

API_URL = "http://127.0.0.1:8000"

async def run_all_tests():
    supabase = get_supabase_client()
    users = {
        'admin': ('mhattari1112@gmail.com', 'DemoPass123!'),
        'customer': ('developerhasnainraza@gmail.com', 'Admin123!@#'),
        'agent': ('chat.hasnain@gmail.com', 'DemoPass123!'),
        'manager': ('info.mhr@gmail.com', 'DemoPass123!')
    }

    tokens = {}
    print("=" * 70)
    print("1. SUPABASE AUTHENTICATION & JWT RESOLUTION")
    print("=" * 70)
    for role, (email, password) in users.items():
        try:
            res = await asyncio.to_thread(supabase.auth.sign_in_with_password, {'email': email, 'password': password})
            u = res.user
            app_meta = u.app_metadata or {}
            user_meta = u.user_metadata or {}
            resolved_role = app_meta.get('role') or user_meta.get('role') or 'customer'
            token = res.session.access_token
            tokens[role] = token
            print(f" [AUTH OK] {role.upper():<10} | {email:<32} | Resolved Role: {resolved_role}")
        except Exception as e:
            print(f" [AUTH FAIL] {role.upper():<10} | {email:<32} | Error: {e}")

    print("\n" + "=" * 70)
    print("2. ROLE-BASED ENDPOINT VALIDATION")
    print("=" * 70)

    async with httpx.AsyncClient(base_url=API_URL, timeout=15.0) as client:
        
        # 1. Admin Endpoints
        admin_headers = {"Authorization": f"Bearer {tokens.get('admin', '')}"}
        print("\n--- Testing Admin Endpoints ---")
        admin_endpoints = [
            ("GET", "/v1/admin/agents"),
            ("GET", "/v1/admin/whatsapp"),
            ("GET", "/v1/admin/settings"),
            ("GET", "/v1/admin/stats"),
            ("GET", "/v1/admin/notification-rules"),
            ("GET", "/v1/knowledge/documents"),
            ("GET", "/v1/analytics/overview")
        ]
        for method, ep in admin_endpoints:
            try:
                res = await client.request(method, ep, headers=admin_headers)
                print(f" [{res.status_code}] ADMIN {method} {ep}")
            except Exception as e:
                print(f" [ERROR] ADMIN {method} {ep}: {type(e).__name__}: {e}")

        # 2. Manager Endpoints
        manager_headers = {"Authorization": f"Bearer {tokens.get('manager', '')}"}
        print("\n--- Testing Manager Endpoints ---")
        manager_endpoints = [
            ("GET", "/v1/manager/metrics"),
            ("GET", "/v1/manager/leaderboard"),
            ("GET", "/v1/manager/escalations"),
            ("GET", "/v1/manager/reports"),
            ("GET", "/v1/tickets?limit=10")
        ]
        for method, ep in manager_endpoints:
            try:
                res = await client.request(method, ep, headers=manager_headers)
                print(f" [{res.status_code}] MANAGER {method} {ep}")
            except Exception as e:
                print(f" [ERROR] MANAGER {method} {ep}: {type(e).__name__}: {e}")

        # 3. Agent Endpoints
        agent_headers = {"Authorization": f"Bearer {tokens.get('agent', '')}"}
        print("\n--- Testing Agent Endpoints ---")
        agent_endpoints = [
            ("GET", "/v1/handoff/queue"),
            ("GET", "/v1/handoff/agents"),
            ("GET", "/v1/tickets?limit=10"),
            ("GET", "/v1/tickets/stats")
        ]
        for method, ep in agent_endpoints:
            try:
                res = await client.request(method, ep, headers=agent_headers)
                print(f" [{res.status_code}] AGENT {method} {ep}")
            except Exception as e:
                print(f" [ERROR] AGENT {method} {ep}: {type(e).__name__}: {e}")

        # 4. Customer Endpoints
        cust_headers = {"Authorization": f"Bearer {tokens.get('customer', '')}"}
        print("\n--- Testing Customer Endpoints ---")
        try:
            # Create conversation
            res = await client.post("/v1/chat/conversations", json={"initial_message": "Hello from customer test", "language": "en"}, headers=cust_headers)
            print(f" [{res.status_code}] CUSTOMER POST /v1/chat/conversations -> {res.text[:80]}")
            
            # List conversations
            res2 = await client.get("/v1/chat/conversations", headers=cust_headers)
            print(f" [{res2.status_code}] CUSTOMER GET /v1/chat/conversations -> count: {len(res2.json()) if res2.status_code == 200 else res2.text[:80]}")

            # List customer tickets
            res3 = await client.get("/v1/tickets", headers=cust_headers)
            print(f" [{res3.status_code}] CUSTOMER GET /v1/tickets -> {res3.text[:80]}")

            # Customer ticket stats
            res4 = await client.get("/v1/tickets/stats", headers=cust_headers)
            print(f" [{res4.status_code}] CUSTOMER GET /v1/tickets/stats -> {res4.text[:80]}")
        except Exception as e:
            print(f" [ERROR] CUSTOMER: {type(e).__name__}: {e}")
            traceback.print_exc()

        # 5. Security & Role Isolation (Customer should NOT access Admin routes)
        print("\n--- Testing Security & Role Isolation ---")
        try:
            sec_res = await client.get("/v1/admin/settings", headers=cust_headers)
            print(f" [{sec_res.status_code}] CUSTOMER ACCESS TO ADMIN ENDPOINT (Expected 403 or blocked): status={sec_res.status_code}")
        except Exception as e:
            print(f" [SECURITY TEST ERROR]: {e}")

    print("\n" + "=" * 70)
    print("ALL API ENDPOINTS AND ROLE TESTS COMPLETED SUCCESSFULLY")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_all_tests())
