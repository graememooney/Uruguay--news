import asyncio
import httpx
import feedparser
from fastapi import FastAPI
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

SOURCE_CONFIG = {
    "uruguay": [{"name": "Uruguay", "url": "https://www.elpais.com.uy/rss"}],
    "argentina": [{"name": "Argentina", "url": "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml"}],
    "paraguay": [{"name": "Paraguay", "url": "https://www.abc.com.py/arc/outboundfeeds/rss/?outputType=xml"}]
}

news_cache = {}

def clean_text(html):
    if not html: return ""
    return BeautifulSoup(html, "lxml").get_text().strip()[:200]

async def fetch_feed(client, source_name, url):
    try:
        response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0)
        feed = feedparser.parse(response.text)
        return [{
            "title": e.get("title", ""),
            "link": e.get("link", ""),
            "source": source_name, # This will now match the region name exactly
            "published": e.get("published", datetime.now().isoformat()),
            "summary": clean_text(e.get("summary", ""))
        } for e in feed.entries[:10]]
    except: return []

@app.get("/news")
async def get_news(country: str = "uruguay"):
    now = time.time()
    if country in news_cache:
        ts, data = news_cache[country]
        if now - ts < 300: return {"ok": True, "articles": data}

    sources = SOURCE_CONFIG.get(country.lower(), [])
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [fetch_feed(client, s["name"], s["url"]) for s in sources]
        results = await asyncio.gather(*tasks)
    
    all_articles = [item for sublist in results for item in sublist]
    news_cache[country] = (now, all_articles)
    return {"ok": True, "articles": all_articles}

@app.get("/")
def home(): return {"ok": True}