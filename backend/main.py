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
    "brasil": "https://g1.globo.com/rss/g1/",
    "paraguay": "https://www.abc.com.py/rss.xml",
    "infobae": "https://www.infobae.com/feeds/rss/politica", 
    "chile": "https://www.emol.com/rss/rss_portada.xml"
}

# --- MEMORY CACHE ---
# Stores data as: { "country": ( [articles], timestamp ) }
news_cache = {}
CACHE_DURATION = 300  # 5 minutes

def extract_image(entry):
    """ Try to find an image in the RSS entry using multiple methods """
    # 1. Try 'media_content' (Standard)
    if 'media_content' in entry:
        return entry.media_content[0]['url']
    
    # 2. Try 'links' (common in some feeds)
    if 'links' in entry:
        for link in entry.links:
            if 'image' in link.get('type', ''):
                return link.href
            
    # 3. Try parsing the HTML summary for an <img> tag
    if 'summary' in entry:
        soup = BeautifulSoup(entry.summary, 'html.parser')
        img = soup.find('img')
        if img and img.get('src'):
            return img['src']
            
    # 4. Fallback image (if nothing found)
    return "https://via.placeholder.com/300x200?text=No+Image"

def clean_html(html_content):
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.get_text()[:200] + "..."

async def fetch_feed(client, country, url):
    """ Helper function to fetch a single feed asynchronously """
    try:
        # Check cache first!
        if country in news_cache:
            data, timestamp = news_cache[country]
            if time.time() - timestamp < CACHE_DURATION:
                print(f"⚡ {country} served from cache")
                return data

        print(f"🌍 Fetching {country}...")
        response = await client.get(url, timeout=10.0)
        feed = feedparser.parse(response.content)
        
        articles = []
        for entry in feed.entries[:8]: # Limit to 8 articles per country
            articles.append({
                "title": entry.title,
                "link": entry.link,
                "summary": clean_html(entry.get('summary', '')),
                "image": extract_image(entry),
                "source": country.upper(),
                "published": entry.get('published', '')
            })
            
        # Save to cache
        news_cache[country] = (articles, time.time())
        return articles
        
    except Exception as e:
        print(f"❌ Error fetching {country}: {e}")
        return []

@app.get("/")
def home():
    return {"status": "ok", "version": "2.1-parallel"}

@app.get("/news")
async def get_news(country: str = "uruguay"):
    country = country.lower()
    
    async with httpx.AsyncClient() as client:
        
        # CASE 1: MERCOSUR (The "All" Tab)
        # We fetch ALL countries at the same time (Parallel)
        if country == "mercosur":
            tasks = []
            for c_name, c_url in RSS_FEEDS.items():
                tasks.append(fetch_feed(client, c_name, c_url))
            
            # This line runs them all at once!
            results = await asyncio.gather(*tasks)
            
            # Combine all lists into one big list
            all_articles = []
            for res in results:
                all_articles.extend(res)
            
            # Return the mix
            return {"country": "mercosur", "articles": all_articles}

        # CASE 2: SINGLE COUNTRY
        if country in RSS_FEEDS:
            articles = await fetch_feed(client, country, RSS_FEEDS[country])
            return {"country": country, "articles": articles}
            
        raise HTTPException(status_code=404, detail="Country not found")