from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import feedparser
from bs4 import BeautifulSoup
import httpx
import time
import asyncio
from datetime import datetime

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION ---
RSS_FEEDS = {
    "uruguay": "https://www.elpais.com.uy/rss",
    "argentina": "https://www.clarin.com/rss/lo-ultimo/",
    "infobae": "https://www.infobae.com/arc/outboundfeeds/rss/",
    "brasil": "https://g1.globo.com/rss/g1/",
    "chile": "https://www.emol.com/rss/rss_portada.xml"
    # Paraguay removed temporarily (All feeds are 404/Dead)
}

# --- BROWSER DISGUISE ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# --- MEMORY CACHE ---
news_cache = {}
CACHE_DURATION = 300  # 5 minutes

def parse_date(entry):
    """Ensure the date is readable by the frontend"""
    try:
        if 'published_parsed' in entry and entry.published_parsed:
            return datetime.fromtimestamp(time.mktime(entry.published_parsed)).isoformat()
        if 'updated_parsed' in entry and entry.updated_parsed:
            return datetime.fromtimestamp(time.mktime(entry.updated_parsed)).isoformat()
    except:
        pass
    # If date fails, return NOW so it appears at the top
    return datetime.now().isoformat()

def extract_image(entry):
    try:
        if 'media_content' in entry:
            return entry.media_content[0]['url']
        if 'links' in entry:
            for link in entry.links:
                if 'image' in link.get('type', ''):
                    return link.href
        if 'summary' in entry:
            soup = BeautifulSoup(entry.summary, 'html.parser')
            img = soup.find('img')
            if img and img.get('src'):
                return img['src']
    except:
        pass
    return "https://via.placeholder.com/300x200?text=News"

def clean_html(html_content):
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.get_text()[:200] + "..."

async def fetch_feed(client, country, url):
    try:
        # 1. Check Cache
        if country in news_cache:
            data, timestamp = news_cache[country]
            if time.time() - timestamp < CACHE_DURATION:
                print(f"⚡ {country} from cache")
                return data

        # 2. Download
        print(f"🌍 Fetching {country}...")
        response = await client.get(url, headers=HEADERS, timeout=15.0, follow_redirects=True)
        
        if response.status_code != 200:
            print(f"❌ {country} error: {response.status_code}")
            return []

        # 3. Parse
        feed = feedparser.parse(response.content)
        articles = []
        
        # Determine the display name for the source (Title Case)
        # "uruguay" -> "Uruguay" (Matches Frontend expectation)
        source_display = country.title() 

        for entry in feed.entries[:10]:
            title = entry.get('title', '')
            if not title: continue
                
            articles.append({
                "title": title,
                "link": entry.get('link', '#'),
                "summary": clean_html(entry.get('summary', '')),
                "image": extract_image(entry),
                "source": source_display,  # <--- FIXED: Now sends "Uruguay" instead of "URUGUAY"
                "published": parse_date(entry)
            })
            
        news_cache[country] = (articles, time.time())
        return articles
        
    except Exception as e:
        print(f"❌ Error fetching {country}: {e}")
        return []

@app.get("/")
def home():
    return {"status": "ok", "version": "2.5-fixed-case"}

@app.get("/news")
async def get_news(country: str = "uruguay"):
    country = country.lower()
    
    async with httpx.AsyncClient(verify=False) as client:
        if country == "mercosur":
            tasks = [fetch_feed(client, c, u) for c, u in RSS_FEEDS.items()]
            results = await asyncio.gather(*tasks)
            all_articles = []
            for res in results:
                all_articles.extend(res)
            return {"country": "mercosur", "articles": all_articles}

        if country in RSS_FEEDS:
            articles = await fetch_feed(client, country, RSS_FEEDS[country])
            return {"country": country, "articles": articles}
            
        raise HTTPException(status_code=404, detail="Country not found")