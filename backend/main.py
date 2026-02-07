from __future__ import annotations

import os
import re
import json
import time
import calendar
import html
import sqlite3
import asyncio
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import feedparser
import httpx
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

# -----------------------------
# App Configuration
# -----------------------------

app = FastAPI(title="News Aggregator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Constants & Feeds
# -----------------------------

FEED_TIMEOUT_SECS = float(os.getenv("FEED_TIMEOUT_SECS", "10.0"))
MAX_OPENAI_CONCURRENT = 5
MAX_TRANSLATIONS_PER_REQUEST = int(os.getenv("MAX_OPENAI_TRANSLATIONS_PER_REQUEST", "100"))

@dataclass(frozen=True)
class Feed:
    name: str
    url: str

FEEDS_BY_COUNTRY: Dict[str, List[Feed]] = {
    "uruguay": [
        Feed("Montevideo Portal", "https://www.montevideo.com.uy/anxml.aspx?59"),
        Feed("El País", "https://www.elpais.com.uy/rss/ultimo-momento"),
        Feed("El Observador", "https://www.elobservador.com.uy/rss/pages/ultimo-momento.xml"),
        Feed("La Diaria", "https://ladiaria.com.uy/feeds/articulos"),
        Feed("Subrayado", "https://www.subrayado.com.uy/rss/pages/home.xml"),
        Feed("Teledoce", "https://www.teledoce.com/feed/"),
    ],
    "argentina": [
        Feed("Clarín", "https://www.clarin.com/rss/lo-ultimo/"),
        Feed("La Nación", "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml"),
        Feed("Infobae", "https://www.infobae.com/feeds/rss/politica"),
        Feed("Ámbito", "https://www.ambito.com/rss/pages/home.xml"),
        Feed("El Cronista", "https://www.cronista.com/files/rss/news.xml"),
    ],
    "brazil": [
        Feed("Folha de S.Paulo", "https://feeds.folha.uol.com.br/emcimadahora/rss091.xml"),
        Feed("O Globo", "https://oglobo.globo.com/rss/plantao.xml"),
        Feed("Estadão", "https://www.estadao.com.br/rss/ultimas"),
        Feed("CNN Brasil", "https://www.cnnbrasil.com.br/feed/"),
    ],
    "paraguay": [
        Feed("ABC Color", "https://www.abc.com.py/rss.xml"),
        Feed("Última Hora", "https://www.ultimahora.com/rss.xml"),
        Feed("La Nación (PY)", "https://www.lanacion.com.py/rss"),
    ],
    "bolivia": [
        Feed("El Deber", "https://eldeber.com.bo/rss"),
        Feed("La Razón", "https://www.larazon.com/rss/feed.html"), # Fallback or main
        Feed("Los Tiempos", "https://www.lostiempos.com/rss/ultimas"),
        Feed("Erbol", "https://erbol.com.bo/rss.xml"),
    ]
}

# -----------------------------
# Database (SQLite)
# -----------------------------

DB_PATH = os.path.join(os.path.dirname(__file__), "cache.db")
TRANSLATION_TABLE = "translation_cache"

def db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_db_schema() -> None:
    conn = db_connect()
    cur = conn.cursor()
    
    cur.execute(f"""
        CREATE TABLE IF NOT EXISTS {TRANSLATION_TABLE} (
            url TEXT PRIMARY KEY,
            title_src TEXT,
            summary_src TEXT,
            title_en TEXT,
            summary_en TEXT,
            translated_via TEXT,
            translation_note TEXT,
            payload TEXT,
            updated_at INTEGER
        );
    """)
    conn.commit()

    expected_columns = {
        "title_en": "TEXT",
        "summary_en": "TEXT",
        "translated_via": "TEXT",
        "translation_note": "TEXT",
        "payload": "TEXT"
    }
    
    cur.execute(f"PRAGMA table_info({TRANSLATION_TABLE});")
    existing_cols = {row["name"] for row in cur.fetchall()}

    for col, dtype in expected_columns.items():
        if col not in existing_cols:
            try:
                cur.execute(f"ALTER TABLE {TRANSLATION_TABLE} ADD COLUMN {col} {dtype};")
            except sqlite3.OperationalError:
                pass 
    
    conn.commit()
    conn.close()

ensure_db_schema()

# -----------------------------
# Helpers
# -----------------------------

UA = "Mozilla/5.0 (NewsAggregator/1.0; +http://localhost) AppleWebKit/537.36"
_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")

def clean_text(text: str, limit: Optional[int] = None) -> str:
    if not text:
        return ""
    text = html.unescape(text)
    text = _TAG_RE.sub(" ", text)
    text = _WHITESPACE_RE.sub(" ", text).strip()
    
    if limit and len(text) > limit:
        return text[:limit].rstrip() + "..."
    return text

def parse_date(entry: Any) -> Optional[datetime]:
    # 1. Try parsing standard RSS fields
    dt = None
    for key in ("published_parsed", "updated_parsed"):
        st = entry.get(key)
        if st:
            try:
                ts = calendar.timegm(st)
                dt = datetime.fromtimestamp(ts, tz=timezone.utc)
                break
            except Exception:
                continue
    
    # 2. Safety Check: If date is in the future, clamp it to NOW.
    if dt:
        now = datetime.now(timezone.utc)
        if dt > (now + timedelta(minutes=5)):
            dt = now
            
    return dt

def get_db_stats() -> int:
    try:
        conn = db_connect()
        cur = conn.cursor()
        cur.execute(f"SELECT COUNT(*) as c FROM {TRANSLATION_TABLE}")
        count = cur.fetchone()["c"]
        conn.close()
        return int(count)
    except Exception:
        return 0

# -----------------------------
# Async Translation Logic
# -----------------------------

async def translate_text_async(title: str, summary: str) -> Tuple[Optional[str], Optional[str], str]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return None, None, "missing_api_key"

    # UPDATED PROMPT: Now handles Portuguese explicitly
    system_prompt = (
        "You are a precise news translator for the Mercosur region. "
        "Translate the input (which may be Spanish or Portuguese) "
        "into clear, professional English. Do not add commentary. Return JSON: "
        '{"title_en": "...", "summary_en": "..."}'
    )
    user_content = json.dumps({"title": title, "summary": summary}, ensure_ascii=False)

    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=api_key)
        
        response = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            timeout=10.0
        )
        
        raw_json = response.choices[0].message.content or "{}"
        data = json.loads(raw_json)
        return data.get("title_en"), data.get("summary_en"), "openai"
        
    except Exception as e:
        error_type = type(e).__name__
        print(f"[Translation Error] {error_type}: {e}")
        return None, None, f"error_{error_type}"

def get_cached_translation(url: str) -> Optional[Dict[str, Any]]:
    conn = db_connect()
    cur = conn.cursor()
    cur.execute(f"SELECT title_en, summary_en, translation_note FROM {TRANSLATION_TABLE} WHERE url = ?", (url,))
    row = cur.fetchone()
    conn.close()
    if row and (row["title_en"] or row["summary_en"]):
        return {
            "title_en": row["title_en"],
            "summary_en": row["summary_en"],
            "via": "cache",
            "note": row["translation_note"] or "cache"
        }
    return None

def save_translation(url: str, src_t: str, src_s: str, en_t: str, en_s: str, via: str, note: str):
    conn = db_connect()
    payload = json.dumps({
        "title_src": src_t, "summary_src": src_s, 
        "title_en": en_t, "summary_en": en_s
    }, ensure_ascii=False)
    
    conn.execute(
        f"""
        INSERT INTO {TRANSLATION_TABLE} 
        (url, title_src, summary_src, title_en, summary_en, translated_via, translation_note, payload, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(url) DO UPDATE SET
            title_en=excluded.title_en,
            summary_en=excluded.summary_en,
            translated_via=excluded.translated_via,
            updated_at=excluded.updated_at
        """,
        (url, src_t, src_s, en_t, en_s, via, note, payload, int(time.time()))
    )
    conn.commit()
    conn.close()

# -----------------------------
# RSS Fetching
# -----------------------------

async def fetch_feed(client: httpx.AsyncClient, feed: Feed) -> Dict[str, Any]:
    try:
        resp = await client.get(feed.url, follow_redirects=True)
        resp.raise_for_status()
        
        parsed = feedparser.parse(resp.content)
        entries = parsed.get("entries", [])
        
        items = []
        for e in entries:
            link = e.get("link", "") or e.get("id", "")
            if not link:
                continue
                
            title = clean_text(e.get("title", ""))
            summary = clean_text(e.get("summary", "") or e.get("description", ""), limit=300)
            dt = parse_date(e)
            
            if title or summary:
                items.append({
                    "source": feed.name,
                    "feed_url": feed.url,
                    "title": title,
                    "summary": summary,
                    "url": link,
                    "published_at": dt.isoformat() if dt else None,
                    "_dt": dt
                })
                
        return {
            "status": "OK", 
            "feed": feed.name, 
            "url": feed.url,
            "items": items,
            "http_code": resp.status_code
        }
    except Exception as e:
        return {
            "status": "FAIL", 
            "feed": feed.name,
            "url": feed.url,
            "error": str(e),
            "items": [],
            "http_code": 0
        }

# -----------------------------
# Routes
# -----------------------------

@app.get("/")
def health_check():
    return {"status": "ok", "service": "backend-news-aggregator"}

@app.get("/news")
async def get_news(
    country: str = Query("uruguay"),
    range: str = Query("3d"),
    per_feed: int = Query(10, ge=1, le=50),
    translate: str = Query("0"),
    force_refresh: int = Query(0)
):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=7) 
    
    if range == "24h": cutoff = now - timedelta(hours=24)
    elif range == "3d": cutoff = now - timedelta(days=3)
    elif range == "14d": cutoff = now - timedelta(days=14)
    elif range == "30d": cutoff = now - timedelta(days=30)
    elif range == "all": cutoff = None

    target_feeds = []
    
    # 1. Specific Country Request
    if country.lower() in FEEDS_BY_COUNTRY:
        target_feeds = FEEDS_BY_COUNTRY[country.lower()]
    
    # 2. "Mercosur" or "All" Request -> Load ALL countries
    elif country.lower() in ["mercosur", "all"]:
        for c_feeds in FEEDS_BY_COUNTRY.values():
            target_feeds.extend(c_feeds)
            
    # 3. Default fallback
    else:
        target_feeds = FEEDS_BY_COUNTRY["uruguay"]
    
    async with httpx.AsyncClient(timeout=FEED_TIMEOUT_SECS, headers={"User-Agent": UA}) as client:
        tasks = [fetch_feed(client, f) for f in target_feeds]
        results = await asyncio.gather(*tasks)

    all_items = []
    feed_errors = []

    for res in results:
        if res["status"] != "OK":
            feed_errors.append({"source": res["feed"], "error": str(res.get("error", "unknown"))})
            continue
            
        feed_items = res["items"]
        if cutoff:
            feed_items = [i for i in feed_items if i.get("_dt") and i["_dt"] >= cutoff]
        
        feed_items = feed_items[:per_feed]
        all_items.extend(feed_items)

    seen_urls = set()
    deduped_items = []
    for it in all_items:
        if it["url"] not in seen_urls:
            deduped_items.append(it)
            seen_urls.add(it["url"])
    
    deduped_items.sort(key=lambda x: x.get("published_at") or "", reverse=True)

    stats = {"cache": 0, "openai": 0, "error": 0, "skipped": 0}
    
    if translate == "en":
        budget = MAX_TRANSLATIONS_PER_REQUEST
        
        tasks = []
        indices_needing_translation = []
        
        for idx, item in enumerate(deduped_items):
            cached = get_cached_translation(item["url"]) if not force_refresh else None
            
            if cached:
                item.update(cached)
                stats["cache"] += 1
            elif budget > 0:
                budget -= 1
                indices_needing_translation.append(idx)
                tasks.append(translate_text_async(item["title"], item["summary"]))
            else:
                item["translated_via"] = "skipped"
                item["translation_note"] = "budget_limit"
                stats["skipped"] += 1

        if tasks:
            sem = asyncio.Semaphore(MAX_OPENAI_CONCURRENT)
            
            async def limited_task(t):
                async with sem:
                    return await t

            translations = await asyncio.gather(*(limited_task(t) for t in tasks))
            
            for i, (t_en, s_en, via) in enumerate(translations):
                original_idx = indices_needing_translation[i]
                item = deduped_items[original_idx]
                
                item["title_en"] = t_en
                item["summary_en"] = s_en
                item["translated_via"] = via
                
                if via == "openai":
                    stats["openai"] += 1
                    save_translation(item["url"], item["title"], item["summary"], t_en, s_en, via, "openai")
                else:
                    stats["error"] += 1

    for i in deduped_items:
        i.pop("_dt", None)

    return {
        "ok": True,
        "country": country,
        "count": len(deduped_items),
        "params": {"range": range, "per_feed": per_feed, "translate": translate},
        "translation_stats": stats if translate == "en" else None,
        "items": deduped_items,
        "feed_errors": feed_errors
    }

@app.get("/feeds-status", response_class=HTMLResponse)
async def feeds_status_html(country: str = "uruguay", per_feed: int = 5):
    target_feeds = []
    if country.lower() == "mercosur":
        for c_feeds in FEEDS_BY_COUNTRY.values():
            target_feeds.extend(c_feeds)
    else:
        target_feeds = FEEDS_BY_COUNTRY.get(country.lower(), FEEDS_BY_COUNTRY["uruguay"])

    async with httpx.AsyncClient(timeout=FEED_TIMEOUT_SECS, headers={"User-Agent": UA}) as client:
        tasks = [fetch_feed(client, f) for f in target_feeds]
        results = await asyncio.gather(*tasks)
    
    rows = ""
    for r in results:
        color = "#d4edda" if r["status"] == "OK" else "#f8d7da"
        status_text = "OK" if r["status"] == "OK" else "FAIL"
        rows += f"""
        <tr style="background-color: {color};">
            <td style="padding:8px;"><b>{r['feed']}</b><br><small>{r['url']}</small></td>
            <td style="padding:8px;">{status_text}</td>
            <td style="padding:8px;">{r['http_code']}</td>
            <td style="padding:8px;">{len(r['items'])}</td>
            <td style="padding:8px;">{r.get('error', '')}</td>
        </tr>
        """
    
    return f"""
    <html>
    <body style="font-family: sans-serif; padding: 20px;">
        <h1>Feed Status: {country.title()}</h1>
        <p>Cache Rows: {get_db_stats()} | <a href="/feeds-status?country=uruguay">Uruguay</a> | <a href="/feeds-status?country=argentina">Argentina</a> | <a href="/feeds-status?country=mercosur">Mercosur (All)</a></p>
        <table border="1" cellspacing="0" style="width:100%; text-align:left;">
            <tr><th>Feed</th><th>Status</th><th>HTTP</th><th>Items</th><th>Error</th></tr>
            {rows}
        </table>
    </body>
    </html>
    """

@app.get("/feeds-status.json")
async def feeds_status_json(country: str = "uruguay"):
    target_feeds = []
    if country.lower() == "mercosur":
        for c_feeds in FEEDS_BY_COUNTRY.values():
            target_feeds.extend(c_feeds)
    else:
        target_feeds = FEEDS_BY_COUNTRY.get(country.lower(), FEEDS_BY_COUNTRY["uruguay"])
        
    async with httpx.AsyncClient(timeout=FEED_TIMEOUT_SECS) as client:
        tasks = [fetch_feed(client, f) for f in target_feeds]
        results = await asyncio.gather(*tasks)
    return {"country": country, "feeds": results}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)