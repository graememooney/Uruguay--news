from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import feedparser
from bs4 import BeautifulSoup
import httpx
import time
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CONFIGURATION (UPDATED LINKS) ---
RSS_FEEDS = {
    "uruguay": "https://www.elpais.com.uy/rss",
    # Infobae changed their URL structure, switching to "Argentina-General"
    "argentina": "https://www.clarin.com/rss/lo-ultimo/", 
    "infobae": "https://www.infobae.com/arc/outboundfeeds/rss/",
    "brasil": "https://g1.globo.com/rss/g1/",
    # ABC Color is 404ing, switching to Ultima Hora for reliability
    "paraguay": "https://www.ultimahora.com/rss", 
    "chile": "https://www.emol.com/rss/rss_portada.xml"
}

# --- BROWSER DISGUISE (User-Agent) ---
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

# --- MEMORY CACHE ---
news_cache = {}
CACHE_DURATION = 300  # 5 minutes

def extract_image(entry):
    # Safe extraction that won't crash
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
        # Check cache
        if country in news_cache:
            data, timestamp = news_cache[country]
            if time.time() - timestamp < CACHE_DURATION:
                print(f"⚡ {country} from cache")
                return data

        print(f"🌍 Fetching {country}...")
        response = await client.get(url, headers=HEADERS, timeout=15.0, follow_redirects=True)
        
        if response.status_code != 200:
            print(f"❌ {country} blocked/error: {response.status_code}")
            return []

        feed = feedparser.parse(response.content)
        
        articles = []
        for entry in feed.entries[:10]:
            # --- THE FIX FOR THE CRASH ---
            # We use .get() instead of .title directly.
            # If title is missing, we use "No Title" or skip it.
            title = entry.get('title', '')
            if not title: 
                continue # Skip broken items
                
            articles.append({
                "title": title,
                "link": entry.get('link', '#'),
                "summary": clean_html(entry.get('summary', '')),
                "image": extract_image(entry),
                "source": country.upper(),
                "published": entry.get('published', '')
            })
            
        news_cache[country] = (articles, time.time())
        return articles
        
    except Exception as e:
        print(f"❌ Error fetching {country}: {e}")
        return []

@app.get("/")
def home():
    return {"status": "ok", "version": "2.3-bulletproof"}

@app.get("/news")
async def get_news(country: str = "uruguay"):
    country = country.lower()
    
    async with httpx.AsyncClient(verify=False) as client: # verify=False helps with some strict SSL issues
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