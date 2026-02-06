"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

// --- Types ---

type Country = "uruguay" | "argentina" | "brazil" | "paraguay" | "bolivia" | "mercosur";
type RangeKey = "24h" | "3d" | "7d" | "14d" | "30d" | "all";
type TranslateMode = "en" | "none";
type ViewMode = "cards" | "compact";
type Theme = "dark" | "light";

type NewsItem = {
  source: string;
  feed_url?: string;
  title: string;
  summary: string;
  url: string;
  published_at?: string;

  title_en?: string | null;
  summary_en?: string | null;

  translated_via?: string | null;
  translation_note?: string | null;
};

type NewsResponse = {
  ok: boolean;
  country: string;
  count: number;
  params: {
    per_feed: number;
    range: string;
    translate: string;
    force_refresh: number;
  };
  translation_stats?: { cache: number; openai: number; error: number; skipped?: number };
  items: NewsItem[];
  feed_errors?: Array<{ source: string; error: string }>;
};

// --- Helpers ---

function stripHtml(s: string) {
  const input = (s || "").trim();
  if (!input) return "";
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  
  if (isToday) {
    return `Today • ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr} • ${timeStr}`;
}

function getGoogleTranslateUrl(url: string) {
  return `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(url)}`;
}

function getHostname(url: string) {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch (e) {
    return "";
  }
}

// --- NEW: Returns an Image URL instead of an Emoji ---
function getFlagUrl(url: string) {
  const host = getHostname(url).toLowerCase();
  
  // We use flagcdn.com for consistent images
  const baseUrl = "https://flagcdn.com/48x36"; // 48px wide images

  if (host.includes(".br") || host.includes("folha") || host.includes("globo") || host.includes("estadao") || host.includes("cnnbrasil")) return `${baseUrl}/br.png`;
  if (host.includes(".py") || host.includes("abc.com.py") || host.includes("ultimahora")) return `${baseUrl}/py.png`;
  if (host.includes(".bo") || host.includes("eldeber") || host.includes("larazon") || host.includes("lostiempos") || host.includes("erbol")) return `${baseUrl}/bo.png`;
  if (host.includes(".ar") || host.includes("clarin") || host.includes("cronista") || host.includes("ambito") || host.includes("perfil") || host.includes("infobae") || host.includes("lanacion")) return `${baseUrl}/ar.png`;
  if (host.includes(".uy") || host.includes("elpais") || host.includes("elobservador") || host.includes("montevideo") || host.includes("ladiaria") || host.includes("subrayado") || host.includes("teledoce")) return `${baseUrl}/uy.png`;

  // Fallback: UN flag for generic/unknown
  return "https://flagcdn.com/48x36/un.png"; 
}

function getFaviconUrl(url: string) {
  const host = getHostname(url);
  if (!host) return "";
  return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
}

// --- Main Component ---

export default function Page() {
  const [theme, setTheme] = useState<Theme>("dark");

  const [country, setCountry] = useState<Country>("mercosur");
  const [range, setRange] = useState<RangeKey>("3d");
  const [perFeed, setPerFeed] = useState<number>(10);
  const [source, setSource] = useState<string>("all");
  const [q, setQ] = useState<string>("");

  const [translateMode, setTranslateMode] = useState<TranslateMode>("en"); 
  const [view, setView] = useState<ViewMode>("cards");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<NewsResponse | null>(null);
  const [error, setError] = useState<string>("");

  const [controlsExpanded, setControlsExpanded] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  
  // Install Logic
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const requestIdRef = useRef(0);

  // Load theme
  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  };

  // Check if running in "App Mode" (Standalone)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const checkStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      setIsStandalone(!!checkStandalone);
    }
  }, []);

  // Listen for PWA Install Event (Android/Chrome)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      });
    } else {
      setShowInstallModal(true);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setControlsExpanded(false);
    }
  }, []);

  const sources = useMemo(() => {
    const items = data?.items || [];
    const set = new Set<string>();
    for (const it of items) set.add(it.source || "");
    return Array.from(set).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filteredItems = useMemo(() => {
    const items = data?.items || [];
    const qq = q.trim().toLowerCase();
    const chosenSource = source.toLowerCase();

    return items.filter((it) => {
      if (chosenSource !== "all" && (it.source || "").toLowerCase() !== chosenSource) {
        return false;
      }
      if (!qq) return true;
      const t = stripHtml((it.title_en || it.title || "").toLowerCase());
      const s = stripHtml((it.summary_en || it.summary || "").toLowerCase());
      const src = (it.source || "").toLowerCase();
      return t.includes(qq) || s.includes(qq) || src.includes(qq);
    });
  }, [data, q, source]);

  async function load(forceRefresh: boolean) {
    const myId = ++requestIdRef.current;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      params.set("country", country);
      params.set("range", range);
      params.set("per_feed", String(perFeed));
      params.set("translate", translateMode === "en" ? "en" : "0");
      params.set("force_refresh", forceRefresh ? "1" : "0");

      const res = await fetch(`/api/news?${params.toString()}`, { cache: "no-store" });
      
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Fetch failed (${res.status}): ${txt.slice(0, 100)}`);
      }

      const json = (await res.json()) as NewsResponse;
      if (myId !== requestIdRef.current) return;
      setData(json);
    } catch (e: any) {
      if (myId !== requestIdRef.current) return;
      console.error(e);
      setError(e?.message || "Unknown error");
      if (!data) setData(null); 
    } finally {
      if (myId === requestIdRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, range, perFeed, translateMode]);

  function displayTitle(it: NewsItem) {
    return stripHtml((it.title_en || it.title || "").trim());
  }
  function displaySummary(it: NewsItem) {
    return stripHtml((it.summary_en || it.summary || "").trim());
  }

  // --- STATS LOGIC ---
  const tStats = data?.translation_stats || { cache: 0, openai: 0, error: 0, skipped: 0 };
  const totalReceived = data?.items?.length || 0;
  const totalShown = filteredItems.length;

  const s = getStyles(theme);

  return (
    <div style={s.page}>
      
      {/* --- HERO / CONTROLS --- */}
      <div style={s.hero}>
        <div style={s.heroInner}>
          <div style={s.headerStack}>
             <div style={s.titleRow}>
               <h1 style={s.h1}>Mercosur News</h1>
             </div>
             
             <div style={s.metaRow}>
               <div style={s.sub}>Real-time Regional Intelligence.</div>
               <div style={s.headerActions}>
                  <button onClick={() => setShowAbout(true)} style={s.aboutBtn}>?</button>
                  <button onClick={toggleTheme} style={s.themeBtn}>
                    <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{theme === "dark" ? "☀️" : "🌑"}</span>
                    <span style={s.themeText}>LIGHT/DARK</span>
                  </button>
                  
                  {!isStandalone && (
                    <button onClick={handleInstallClick} style={s.themeBtn}>
                      <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>📲</span>
                      <span style={s.themeText}>GET APP</span>
                    </button>
                  )}
               </div>
             </div>
          </div>

          <div style={s.panel}>
            {!controlsExpanded && (
              <div style={s.collapsedBar}>
                <div style={s.collapsedRow}>
                  <select 
                    value={country} 
                    onChange={(e) => setCountry(e.target.value as Country)} 
                    style={{ ...s.selectCompact, flex: 2 }} 
                  >
                    <option value="mercosur">🌎 Mercosur</option>
                    <option value="uruguay">🇺🇾 Uruguay</option>
                    <option value="argentina">🇦🇷 Argentina</option>
                    <option value="brazil">🇧🇷 Brazil</option>
                    <option value="paraguay">🇵🇾 Paraguay</option>
                    <option value="bolivia">🇧🇴 Bolivia</option>
                  </select>

                  <select 
                    value={range} 
                    onChange={(e) => setRange(e.target.value as RangeKey)} 
                    style={{ ...s.selectCompactSmall, flex: 1 }}
                  >
                    <option value="24h">24h</option>
                    <option value="3d">3d</option>
                    <option value="7d">7d</option>
                    <option value="14d">14d</option>
                    <option value="30d">30d</option>
                  </select>
                </div>

                <div style={s.collapsedRow}>
                   <button 
                      onClick={() => setControlsExpanded(true)}
                      style={s.tuneBtn}
                    >
                      Filters ⚙️
                    </button>

                    <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
                       <div style={s.segmentedCompact}>
                        <button
                          type="button"
                          style={s.segBtnCompact(translateMode === "en")}
                          onClick={() => setTranslateMode("en")}
                          disabled={loading}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          style={s.segBtnCompact(translateMode === "none")}
                          onClick={() => setTranslateMode("none")}
                          disabled={loading}
                        >
                          Off
                        </button>
                      </div>

                      <button 
                        onClick={() => load(true)} 
                        style={s.primaryBtnCompact} 
                        disabled={loading}
                      >
                        {loading ? "..." : "Refresh"}
                      </button>
                    </div>
                </div>
              </div>
            )}

            {controlsExpanded && (
              <>
                <div style={s.rowTop}>
                  <div style={s.field}>
                    <div style={s.label}>Region</div>
                    <select 
                      value={country} 
                      onChange={(e) => setCountry(e.target.value as Country)} 
                      style={s.select}
                    >
                      <option value="mercosur">🌎 Mercosur (All)</option>
                      <option value="uruguay">🇺🇾 Uruguay</option>
                      <option value="argentina">🇦🇷 Argentina</option>
                      <option value="brazil">🇧🇷 Brazil</option>
                      <option value="paraguay">🇵🇾 Paraguay</option>
                      <option value="bolivia">🇧🇴 Bolivia</option>
                    </select>
                  </div>

                  <div style={s.field}>
                    <div style={s.label}>Range</div>
                    <select 
                      value={range} 
                      onChange={(e) => setRange(e.target.value as RangeKey)} 
                      style={s.select}
                    >
                      <option value="24h">Last 24 Hours</option>
                      <option value="3d">Last 3 Days</option>
                      <option value="7d">Last 7 Days</option>
                      <option value="14d">Last 14 Days</option>
                      <option value="30d">Last 30 Days</option>
                      <option value="all">All Time</option>
                    </select>
                  </div>

                  <div style={s.field}>
                    <div style={s.label}>Per Feed</div>
                    <select 
                      value={perFeed} 
                      onChange={(e) => setPerFeed(Number(e.target.value))} 
                      style={s.select}
                    >
                      <option value={5}>5 items</option>
                      <option value={10}>10 items</option>
                      <option value={20}>20 items</option>
                    </select>
                  </div>

                  <div style={{ ...s.field, minWidth: 200 }}>
                    <div style={s.label}>Source</div>
                    <select 
                      value={source} 
                      onChange={(e) => setSource(e.target.value)} 
                      style={s.select}
                    >
                      <option value="all">All Sources</option>
                      {sources.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ ...s.field, flex: 1, minWidth: 260 }}>
                    <div style={s.label}>Search</div>
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Filter headlines..."
                      style={s.input}
                    />
                  </div>
                </div>

                <div style={s.rowBot}>
                  <div style={s.fieldInline}>
                    <div style={s.label}>Translation</div>
                    <div style={s.segmented}>
                      <button
                        type="button"
                        style={s.segBtn(translateMode === "en")}
                        onClick={() => setTranslateMode("en")}
                        disabled={loading}
                      >
                        English
                      </button>
                      <button
                        type="button"
                        style={s.segBtn(translateMode === "none")}
                        onClick={() => setTranslateMode("none")}
                        disabled={loading}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  <div style={s.fieldInline}>
                    <div style={s.label}>View</div>
                    <div style={s.segmented}>
                      <button
                        type="button"
                        style={s.segBtn(view === "cards")}
                        onClick={() => setView("cards")}
                      >
                        Cards
                      </button>
                      <button
                        type="button"
                        style={s.segBtn(view === "compact")}
                        onClick={() => setView("compact")}
                      >
                        Compact
                      </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => load(true)} 
                    style={s.primaryBtn} 
                    disabled={loading}
                  >
                    {loading ? "Refreshing..." : "Refresh"}
                  </button>

                  <button 
                    onClick={() => load(false)} 
                    style={s.ghostBtn} 
                    disabled={loading}
                  >
                    Soft Refresh
                  </button>

                  <div style={s.metaRight}>
                    <button 
                      onClick={() => setControlsExpanded(false)}
                      style={s.hideBtn}
                    >
                      Hide Filters ▲
                    </button>
                  </div>
                </div>
                
                <div style={s.statsRow}>
                   <div style={s.pillStats}>
                      {sources.length} sources
                    </div>
                    {translateMode === "en" && (
                      <div style={s.pillStats}>
                        cache {tStats.cache} / openai {tStats.openai} / err {tStats.error}
                        {tStats.skipped ? ` / skip ${tStats.skipped}` : ""}
                      </div>
                    )}
                    <div style={{ opacity: 0.7, fontSize: '0.8rem' }}>
                       {totalShown} shown / {totalReceived} total
                    </div>
                </div>
              </>
            )}

            {error && (
              <div style={s.errorBox}>
                <strong>Error:</strong> {error}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <div style={s.content}>
        
        {!loading && filteredItems.length === 0 && !error && (
          <div style={s.emptyState}>
            No stories found. Try changing filters or range.
          </div>
        )}

        {view === "cards" ? (
          <div style={s.cardGrid}>
            {filteredItems.map((it) => (
              <div key={it.url} style={s.card}>
                <div style={s.cardHeader}>
                  <div style={s.sourceRow}>
                    {/* --- REPLACED EMOJI WITH IMAGE --- */}
                    <img 
                      src={getFlagUrl(it.feed_url || it.url)} 
                      alt="" 
                      style={s.flagIcon} 
                    />
                    <img 
                      src={getFaviconUrl(it.feed_url || it.url)} 
                      alt="" 
                      style={s.favicon} 
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span style={s.sourceName}>{it.source}</span>
                  </div>
                  <span style={s.age}>{formatTime(it.published_at)}</span>
                </div>
                <div style={s.cardTitle}>{displayTitle(it)}</div>
                <div style={s.cardSummary}>{displaySummary(it)}</div>
                
                <div style={s.cardFooter}>
                  <a href={getGoogleTranslateUrl(it.url)} target="_blank" rel="noreferrer" style={s.cardBtnPrimary}>
                    Read in English
                  </a>
                  <a href={it.url} target="_blank" rel="noreferrer" style={s.cardBtnSecondary}>
                    Read Original
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={s.compactList}>
            {filteredItems.map((it) => (
              <div key={it.url} style={s.compactRow}>
                <div style={{ flex: 1 }}>
                  <div style={s.compactTitle}>
                    {displayTitle(it)}
                  </div>
                  <div style={s.compactMeta}>
                    {/* --- REPLACED EMOJI WITH IMAGE --- */}
                    <img 
                      src={getFlagUrl(it.feed_url || it.url)} 
                      alt="" 
                      style={s.flagIconSmall} 
                    />
                    <img 
                      src={getFaviconUrl(it.feed_url || it.url)} 
                      alt="" 
                      style={s.faviconSmall} 
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span style={s.sourceNameSmall}>{it.source}</span>
                    <span style={s.dotSeparator}>•</span>
                    <span>{formatTime(it.published_at)}</span>
                  </div>
                </div>
                <div style={s.compactActions}>
                  <a href={getGoogleTranslateUrl(it.url)} target="_blank" rel="noreferrer" style={s.link}>
                    Read in English
                  </a>
                  <span style={{ opacity: 0.35 }}>•</span>
                  <a href={it.url} target="_blank" rel="noreferrer" style={s.linkSecondary}>
                    Original
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- ABOUT MODAL --- */}
      {showAbout && (
        <div style={s.modalOverlay} onClick={() => setShowAbout(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>About Mercosur News</h2>
            <div style={s.modalBody}>
              <p>This application is a real-time news aggregator that organizes public RSS feeds from Uruguay, Argentina, Brazil, Paraguay, and Bolivia.</p>
              
              <h3>How it works</h3>
              <ul>
                <li>We fetch headlines from public sources.</li>
                <li>We optionally translate headlines to English for accessibility.</li>
                <li><strong>We do not host content.</strong> All articles link directly to the original publisher.</li>
              </ul>
              
              <div style={s.modalFooter}>
                <button style={s.primaryBtnCompact} onClick={() => setShowAbout(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- INSTALL MODAL (iOS) --- */}
      {showInstallModal && (
        <div style={s.modalOverlay} onClick={() => setShowInstallModal(false)}>
          <div style={s.modalContent} onClick={e => e.stopPropagation()}>
            <h2 style={s.modalTitle}>Install App</h2>
            <div style={s.modalBody}>
              <p>To install this app on your home screen:</p>
              <ol style={{ paddingLeft: 20, lineHeight: 2 }}>
                <li>Tap the <strong>Share</strong> button (usually at the bottom or top of your browser).</li>
                <li>Scroll down and select <strong>"Add to Home Screen"</strong> (⊞).</li>
                <li>Tap <strong>Add</strong>.</li>
              </ol>
              <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>Note: If you are on Android/Chrome, looking for the "Install App" option in your browser menu usually works best!</p>
              
              <div style={s.modalFooter}>
                <button style={s.primaryBtnCompact} onClick={() => setShowInstallModal(false)}>Got it</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// --- Styles Generator ---

function getStyles(theme: Theme): Record<string, any> {
  const isDark = theme === "dark";

  // Colors
  const bgMain = isDark ? "radial-gradient(1200px 800px at 15% 0%, rgba(120,140,255,0.15), rgba(0,0,0,0) 60%), #05070f" : "#f3f4f6";
  const textMain = isDark ? "#EAF0FF" : "#111827";
  const textSub = isDark ? "#A8B3CF" : "#4b5563";
  const textMuted = isDark ? "#6F7A95" : "#9ca3af";
  
  const panelBg = isDark ? "rgba(11, 16, 32, 0.65)" : "rgba(255, 255, 255, 0.9)";
  const panelBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)";
  const panelShadow = isDark ? "0 20px 50px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.05)";

  const cardBg = isDark ? "rgba(20, 25, 40, 0.6)" : "#ffffff";
  const cardBorder = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  
  const inputBg = isDark ? "#0B1020" : "#ffffff";
  const inputBorder = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)";
  
  const btnPrimaryBg = isDark ? "#EAF0FF" : "#111827";
  const btnPrimaryText = isDark ? "#05070f" : "#ffffff";

  return {
    page: {
      minHeight: "100vh",
      background: bgMain,
      color: textMain,
      fontFamily: "sans-serif",
      transition: "background 0.3s ease, color 0.3s ease",
    },
    hero: {
      padding: "30px 20px 10px", 
      background: isDark ? "linear-gradient(to bottom, rgba(0,0,0,0.2), transparent)" : "none",
    },
    heroInner: {
      maxWidth: 1200,
      margin: "0 auto",
    },
    headerStack: {
      display: "flex",
      flexDirection: "column",
      marginBottom: 10,
    },
    titleRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    },
    metaRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 5,
    },
    headerActions: {
      display: "flex",
      gap: 12,
      alignItems: "center",
    },
    aboutBtn: {
      background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
      border: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.1)",
      borderRadius: "50%",
      width: 24,
      height: 24,
      color: textSub,
      cursor: "pointer",
      fontSize: "0.8rem",
      fontWeight: "bold",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    themeBtn: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      padding: 0,
      marginLeft: 4,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
    },
    themeText: {
      fontSize: "0.6rem",
      color: textSub,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    },
    tuneBtn: {
      background: isDark ? "rgba(255,255,255,0.1)" : "#fff",
      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb",
      borderRadius: 8,
      color: textMain,
      padding: "0px 12px", 
      height: 32, 
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: "0.75rem", 
      boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.1)",
    },
    h1: {
      fontSize: "clamp(2.5rem, 5vw, 3.5rem)", 
      fontWeight: 800,
      letterSpacing: "-0.02em",
      margin: 0,
      color: textMain,
      width: "100%",
    },
    sub: {
      fontSize: "0.95rem",
      color: textSub,
      flex: 1, 
    },
    panel: {
      marginTop: 20,
      background: panelBg,
      border: `1px solid ${panelBorder}`,
      backdropFilter: "blur(12px)",
      borderRadius: 20,
      padding: 24,
      boxShadow: panelShadow,
      transition: "all 0.3s ease",
    },
    collapsedBar: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    collapsedRow: {
      display: "flex",
      gap: 10,
      alignItems: "center",
    },
    selectCompact: { 
      height: 48, 
      background: inputBg,
      border: `1px solid ${inputBorder}`,
      borderRadius: 12,
      padding: "0 12px",
      color: textMain,
      fontSize: "1.05rem",
      fontWeight: 600,
      outline: "none",
    },
    selectCompactSmall: { 
      height: 48, 
      background: inputBg,
      border: `1px solid ${inputBorder}`,
      borderRadius: 12,
      padding: "0 12px",
      color: textMain,
      fontSize: "1.05rem", 
      fontWeight: 600,
      outline: "none",
    },
    primaryBtnCompact: { 
      height: 32,
      padding: "0 14px",
      borderRadius: 8,
      background: btnPrimaryBg,
      color: btnPrimaryText,
      border: "none",
      fontWeight: 800,
      fontSize: "0.8rem",
      cursor: "pointer",
    },
    segmentedCompact: { 
      display: "flex",
      background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
      padding: 2,
      borderRadius: 8,
      border: `1px solid ${panelBorder}`,
      height: 32,
      alignItems: "center",
    },
    segBtnCompact: (active: boolean) => ({
      padding: "0 10px",
      height: 28,
      borderRadius: 6,
      border: "none",
      background: active ? (isDark ? "rgba(255,255,255,0.2)" : "#fff") : "transparent",
      color: active ? textMain : textMuted,
      fontSize: "0.75rem",
      fontWeight: 700,
      cursor: "pointer",
      boxShadow: active && !isDark ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    }),
    rowTop: {
      display: "flex",
      gap: 16,
      flexWrap: "wrap",
      alignItems: "flex-end",
    },
    rowBot: {
      display: "flex",
      gap: 16,
      flexWrap: "wrap",
      alignItems: "flex-end",
      marginTop: 20,
      paddingTop: 20,
      borderTop: `1px solid ${panelBorder}`,
    },
    statsRow: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      marginTop: 16,
      paddingTop: 16,
      borderTop: `1px solid ${panelBorder}`,
      flexWrap: "wrap",
    },
    field: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    fieldInline: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
    },
    label: {
      fontSize: "0.75rem",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: textMuted,
      fontWeight: 700,
    },
    select: {
      height: 44, 
      background: inputBg,
      border: `1px solid ${inputBorder}`,
      borderRadius: 10,
      padding: "0 12px",
      color: textMain,
      fontSize: "0.95rem",
      outline: "none",
      minWidth: 100,
    },
    input: {
      height: 44, 
      background: inputBg,
      border: `1px solid ${inputBorder}`,
      borderRadius: 10,
      padding: "0 14px",
      color: textMain,
      fontSize: "0.95rem",
      outline: "none",
      width: "100%", 
    },
    segmented: {
      display: "flex",
      background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
      padding: 4,
      borderRadius: 12,
      border: `1px solid ${panelBorder}`,
      height: 44, 
      alignItems: "center",
    },
    segBtn: (active: boolean) => ({
      padding: "0 16px",
      height: 34,
      borderRadius: 9,
      border: "none",
      background: active ? (isDark ? "rgba(255,255,255,0.15)" : "#ffffff") : "transparent",
      color: active ? textMain : textMuted,
      fontSize: "0.85rem",
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.2s",
      boxShadow: active && !isDark ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
    }),
    primaryBtn: {
      height: 44,
      padding: "0 24px",
      borderRadius: 12,
      background: btnPrimaryBg,
      color: btnPrimaryText,
      border: "none",
      fontWeight: 800,
      fontSize: "0.95rem",
      cursor: "pointer",
    },
    ghostBtn: {
      height: 44,
      padding: "0 20px",
      borderRadius: 12,
      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      color: textSub,
      border: `1px solid ${panelBorder}`,
      fontWeight: 700,
      fontSize: "0.95rem",
      cursor: "pointer",
    },
    hideBtn: {
      background: "transparent",
      border: "none",
      color: textMuted,
      fontSize: "0.85rem",
      cursor: "pointer",
      fontWeight: 600,
    },
    metaRight: {
      marginLeft: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: 4,
      fontSize: "0.8rem",
      color: textMuted,
    },
    pillStats: {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 6,
      background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
      border: `1px solid ${panelBorder}`,
      fontSize: "0.75rem",
      color: textSub,
      fontWeight: 600,
      fontFamily: "monospace",
    },
    content: {
      maxWidth: 1200,
      margin: "0 auto",
      padding: "20px 20px 80px",
    },
    emptyState: {
      textAlign: "center",
      padding: 60,
      fontSize: "1.2rem",
      opacity: 0.5,
    },
    cardGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
      gap: 20,
    },
    card: {
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderRadius: 16,
      padding: 20,
      display: "flex",
      flexDirection: "column",
      transition: "transform 0.2s",
      boxShadow: isDark ? "none" : "0 2px 10px rgba(0,0,0,0.03)",
    },
    cardHeader: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    sourceRow: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    // --- NEW STYLES FOR FLAGS ---
    flagIcon: {
      width: 24,
      height: 18,
      objectFit: "cover",
      borderRadius: 3,
      border: "1px solid rgba(128,128,128,0.2)"
    },
    favicon: {
      width: 16,
      height: 16,
      borderRadius: 2,
      objectFit: "contain",
    },
    sourceName: {
      fontSize: "0.85rem",
      fontWeight: 700,
      color: isDark ? "#dce3f1" : "#111827",
      letterSpacing: "0.02em",
    },
    age: {
      fontSize: "0.8rem",
      color: textMuted,
    },
    cardTitle: {
      fontSize: "1.2rem",
      fontWeight: 700,
      lineHeight: 1.3,
      marginBottom: 10,
      color: textMain,
    },
    cardSummary: {
      fontSize: "0.95rem",
      lineHeight: 1.5,
      color: textSub,
      marginBottom: 16,
      flex: 1, 
    },
    cardFooter: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      borderTop: `1px solid ${panelBorder}`,
      paddingTop: 12,
    },
    link: {
      color: "#60a5fa",
      textDecoration: "none",
      fontWeight: 600,
      fontSize: "0.9rem",
    },
    linkSecondary: {
      color: textSub,
      textDecoration: "none",
      fontWeight: 600,
      fontSize: "0.8rem",
      opacity: 0.8,
    },
    cardBtnPrimary: {
      background: "#60a5fa", 
      color: "#ffffff",
      padding: "6px 12px",
      borderRadius: 8,
      textDecoration: "none",
      fontWeight: 700,
      fontSize: "0.85rem",
      display: "inline-block",
    },
    cardBtnSecondary: {
      color: textSub,
      textDecoration: "none",
      fontWeight: 600,
      fontSize: "0.85rem",
      padding: "6px 8px",
      border: "1px solid transparent", 
    },
    compactList: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    compactRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 20,
      padding: "16px 20px",
      background: isDark ? "rgba(20, 25, 40, 0.4)" : "#ffffff",
      border: `1px solid ${panelBorder}`,
      borderRadius: 12,
      boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.05)",
    },
    compactTitle: {
      fontSize: "1rem",
      fontWeight: 700,
      color: textMain,
      marginBottom: 4,
    },
    compactMeta: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      fontSize: "0.8rem",
      color: textMuted,
    },
    // --- NEW STYLES FOR SMALL FLAGS ---
    flagIconSmall: {
      width: 20,
      height: 15,
      objectFit: "cover",
      borderRadius: 2,
      border: "1px solid rgba(128,128,128,0.2)"
    },
    faviconSmall: {
      width: 14,
      height: 14,
    },
    sourceNameSmall: {
      color: isDark ? "#dce3f1" : "#111827",
      fontWeight: 700,
    },
    dotSeparator: {
      opacity: 0.3,
    },
    compactActions: {
      display: "flex",
      gap: 10,
      alignItems: "center",
      fontSize: "0.9rem",
      fontWeight: 600,
    },
    errorBox: {
      marginTop: 20,
      padding: 16,
      background: "rgba(255, 80, 80, 0.15)",
      border: "1px solid rgba(255, 80, 80, 0.3)",
      borderRadius: 12,
      color: "#ffcccc",
      fontSize: "0.9rem",
    },
    modalOverlay: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.8)",
      backdropFilter: "blur(4px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 20,
    },
    modalContent: {
      background: isDark ? "#0B1020" : "#ffffff",
      border: `1px solid ${panelBorder}`,
      borderRadius: 20,
      padding: 30,
      maxWidth: 500,
      width: "100%",
      boxShadow: "0 25px 80px rgba(0,0,0,0.8)",
    },
    modalTitle: {
      marginTop: 0,
      fontSize: "1.5rem",
      color: textMain,
    },
    modalBody: {
      color: textSub,
      lineHeight: 1.6,
    },
    modalFooter: {
      marginTop: 20,
      textAlign: "right",
    },
  };
}