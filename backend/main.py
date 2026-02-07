import asyncio
import httpx
import feedparser
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from bs4 import BeautifulSoup
from datetime import datetime
import time

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# This list matches exactly what the frontend dropdowns send
SOURCE_CONFIG = {
    "uruguay": [
        {"name": "El Pais", "url": "https://www.elpais.com.uy/rss"},
        {"name": "El Observador", "url": "https://www.elobservador.com.uy/rss/home.xml"},
        {"name": "Montevideo Portal", "url": "https://www.montevideo.com.uy/anxml.aspx?59"}
    ],
    "argentina": [
        {"name": "La Nacion", "url": "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml"},
        {"name": "Clarin", "url": "https://www.clarin.com/rss/lo-ultimo/"}
    ],
    "paraguay": [
        {"name": "ABC Color", "url": "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml"}
    ],
    "mercosur": [
        {"name": "El Pais", "url": "https://www.elpais.com.uy/rss"},
        {"name": "La Nacion", "url": "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml"},
        {"name": "ABC Color", "url": "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml"}
    ]
}

news_cache = {}
CACHE_EXPIRATION = 300 

def clean_text(html_content):
    if not html_content: return ""
    try:
        soup = BeautifulSoup(html_content, "lxml")
        return soup.get_text().strip()[:200]
    except:
        return str(html_content)[:200]

async def fetch_feed(client, source_name, url):
    headers = {"User-Agent": "Mozilla/5.0 Chrome/120.0.0.0"}
    try:
        response = await client.get(url, headers=headers, timeout=10.0)
        feed = feedparser.parse(response.text)
        articles = []
        for entry in feed.entries[:10]:
            articles.append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "source": source_name,
                "published": entry.get("published", datetime.now().isoformat()),
                "summary": clean_text(entry.get("summary", ""))
            })
        return articles
    except Exception as e:
        return []

@app.get("/news")
async def get_news(country: str = "uruguay"):
    now = time.time()
    country_key = country.lower()
    
    if country_key in news_cache:
        ts, data = news_cache[country_key]
        if now - ts < CACHE_EXPIRATION:
            return {"ok": True, "articles": data, "cached": True}

    sources = SOURCE_CONFIG.get(country_key, [])
    if not sources:
        return {"ok": False, "error": f"No feeds configured for {country_key}"}

    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [fetch_feed(client, s["name"], s["url"]) for s in sources]
        results = await asyncio.gather(*tasks)
    
    all_articles = [item for sublist in results for item in sublist]
    all_articles.sort(key=lambda x: x['published'], reverse=True)
    
    news_cache[country_key] = (now, all_articles)
    return {"ok": True, "articles": all_articles, "cached": False}

@app.get("/")
def home():
    return {"status": "online", "message": "Mercosur API is active"}