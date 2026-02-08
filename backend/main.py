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

def clean_text(html):
    if not html: return ""
    try:
        soup = BeautifulSoup(html, "lxml")
        return soup.get_text().strip()[:200]
    except:
        return str(html)[:200]

async def fetch_feed(client, source_name, url):
    try:
        response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10.0)
        feed = feedparser.parse(response.text)
        return [{
            "title": e.get("title", ""),
            "link": e.get("link", ""),
            "source": source_name,
            "published": e.get("published", datetime.now().isoformat()),
            "summary": clean_text(e.get("summary", ""))
        } for e in feed.entries[:10]]
    except: return []

@app.get("/news")
async def get_news(country: str = "uruguay"):
    country_key = country.lower()
    sources = SOURCE_CONFIG.get(country_key, [])
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [fetch_feed(client, s["name"], s["url"]) for s in sources]
        results = await asyncio.gather(*tasks)
    all_articles = [item for sublist in results for item in sublist]
    return {"ok": True, "articles": all_articles}

@app.get("/")
def home(): return {"status": "online"}