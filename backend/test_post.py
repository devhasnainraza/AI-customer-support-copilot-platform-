import httpx

def test_api():
    # 1. Login to get token
    login_url = "https://rztddoqomvfmhpmcihmo.supabase.co/auth/v1/token?grant_type=password"
    payload = {
        "email": "admin@example.com",
        "password": "password"
    }
    headers = {
        "apikey": "sb_publishable_ItrAfsO-HPQce2sprrZfag_NCDucfjq",
        "Content-Type": "application/json"
    }
    
    with httpx.Client() as client:
        res = client.post(login_url, json=payload, headers=headers)
        if res.status_code != 200:
            print("Failed to login:", res.status_code, res.text)
            return
            
        token = res.json()["access_token"]
        print("Logged in successfully.")
        
        # 2. Make POST conversations request
        headers_api = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        # What the frontend sends
        payload_api = {
            "initial_message": None,
            "language": None
        }
        
        res_api = client.post("http://127.0.0.1:8000/v1/chat/conversations", json=payload_api, headers=headers_api)
        print("API Response:", res_api.status_code)
        print(res_api.text)

if __name__ == "__main__":
    test_api()
