from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from datetime import datetime, timezone

# Supabase Bilgilerin
SUPABASE_URL = "https://txyrzmgxenlwkccjexzt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4eXJ6bWd4ZW5sd2tjY2pleHp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODQ4MjksImV4cCI6MjA5MzY2MDgyOX0.uU0lxbEqYwCD01HXOZiDJWnPdZNaiSt4NqYRBdKmkp4"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Tokatla API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SlapRequest(BaseModel):
    nickname: str
    clicks: int

@app.get("/leaderboard")
async def get_leaderboard():
    # En çok tokat atanları çek
    response = supabase.table("leaderboard").select("nickname, score, last_slap_at").order("score", desc=True).limit(20).execute()
    return response.data

@app.post("/slap")
async def add_slap(data: SlapRequest):
    # Şu anki zamanı evrensel formatta (UTC) alıyoruz
    current_time = datetime.now(timezone.utc).isoformat()
    
    user_check = supabase.table("leaderboard").select("score").eq("nickname", data.nickname).execute()
    
    if len(user_check.data) > 0:
        # Kullanıcı varsa, mevcut skorun üzerine ekle ve son tokat zamanını güncelle
        current_score = user_check.data[0]['score']
        new_score = current_score + data.clicks
        supabase.table("leaderboard").update({
            "score": new_score,
            "last_slap_at": current_time
        }).eq("nickname", data.nickname).execute()
    else:
        # Kullanıcı yoksa sıfırdan oluştur
        supabase.table("leaderboard").insert({
            "nickname": data.nickname, 
            "score": data.clicks,
            "last_slap_at": current_time
        }).execute()
        
    return {"message": f"{data.nickname} icin {data.clicks} tokat eklendi! Son tokat: {current_time}"}