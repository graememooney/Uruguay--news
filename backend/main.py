import httpx
import feedparser
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup

app = FastAPI()

# Enable connection between frontend and backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def clean_summary(html):
    if not html: return ""
    return BeautifulSoup(html, "lxml").get_text().strip()[:200] + "..."

@app.get("/news")
async def get_uruguay_news():
    url = "https://www.elpais.com.uy/rss"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=10.0)
        feed = feedparser.parse(response.text)
        
    articles = []
    for entry in feed.entries[:10]:
        articles.append({
            "title": entry.get("title", "No Title"),
            "summary": clean_summary(entry.get("summary", "")),
            "link": entry.get("link", ""),
            "source": "El Pais (UY)"
        })
    
    return {"ok": True, "articles": articles}

@app.get("/")
def health_check():
    return {"status": "online", "region": "Uruguay"}