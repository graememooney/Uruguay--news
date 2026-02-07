from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import feedparser
from bs4 import BeautifulSoup
import httpx
import time

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
    "chile": "https://www.emol.com/rss/rss_portada.xml",
    "mercosur": "https://www.mercopress.com/rss"
}

# --- MEMORY CACHE ---
# This stores the news so we don't have to scrape every single time
news_cache = {}
CACHE_DURATION = 600  # 10 minutes (in seconds)

def clean_html(html_content):
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, "html.parser")
    return soup.get_text()[:300] + "..."

@app.get("/")
def home():
    return {"message": "Mercosur News Backend 2.0 (Cached) is running"}

@app.get("/news")
async def get_news(country: str = "uruguay"):
    country_key = country.lower()
    
    # 1. CHECK THE CACHE FIRST (Speed check!)
    current_time = time.time()
    if country_key in news_cache:
        saved_data, timestamp = news_cache[country_key]
        if current_time - timestamp < CACHE_DURATION:
            print(f"⚡ Serving {country} from cache (Instant)")
            return saved_data

    # 2. IF NOT IN CACHE, DOWNLOAD IT (Slow check)
    feed_url = RSS_FEEDS.get(country_key)
    
    if not feed_url:
        # If looking for 'mercosur', combine all feeds (simplified for speed)
        if country_key == "mercosur":
            # Just return a quick message for now to prevent timeouts on the big scrape
            return {"country": "mercosur", "articles": []} 
        raise HTTPException(status_code=404, detail="Country not found")

    print(f"🐢 Scraping {country} from web...")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(feed_url, timeout=10.0)
            feed = feedparser.parse(response.content)
            
            articles = []
            for entry in feed.entries[:10]:
                image = None
                if 'media_content' in entry:
                    image = entry.media_content[0]['url']
                elif 'links' in entry:
                    for link in entry.links:
                        if 'image' in link.type:
                            image = link.href
                
                articles.append({
                    "title": entry.title,
                    "link": entry.link,
                    "summary": clean_html(entry.get('summary', '')),
                    "image": image,
                    "published": entry.get('published', '')
                })
            
            result = {"country": country, "articles": articles}
            
            # 3. SAVE TO CACHE
            news_cache[country_key] = (result, current_time)
            
            return result
            
    except Exception as e:
        print(f"Error fetching news: {e}")
        # If scrape fails, try to return old cache if it exists
        if country_key in news_cache:
             return news_cache[country_key][0]
        raise HTTPException(status_code=500, detail=str(e))