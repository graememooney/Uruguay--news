"use client";
import React, { useState, useEffect } from "react";

export default function MercosurNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("uruguay");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("cards");

  const fetchNews = async (target: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?country=${target}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchNews(country); }, [country]);

  const filtered = articles.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#050714] text-white p-4 md:p-12 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 flex justify-between items-start">
          <div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-2 italic">Mercosur News</h1>
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Real-time Regional Intelligence</p>
          </div>
          <div className="flex gap-4 items-center">
            <div className="text-right hidden md:block">
              <span className="block text-[10px] font-black text-gray-600 uppercase tracking-widest">Theme</span>
              <span className="text-xs font-bold text-yellow-500">☀️ LIGHT/DARK</span>
            </div>
          </div>
        </header>

        {/* FULL DASHBOARD FILTER BAR */}
        <div className="bg-[#0b1224] border border-white/5 p-8 rounded-[2rem] mb-12 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black text-gray-600">Region</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none font-bold">
                <option value="uruguay">🇺🇾 Uruguay</option>
                <option value="argentina">🇦🇷 Argentina</option>
                <option value="paraguay">🇵🇾 Paraguay</option>
                <option value="mercosur">🌎 Mercosur (All)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black text-gray-600">Range</label>
              <select className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none">
                <option>Last 3 Days</option>
                <option>Last 24 Hours</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black text-gray-600">Per Feed</label>
              <select className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none font-bold">
                <option>10 Items</option>
                <option>20 Items</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black text-gray-600">Source</label>
              <select className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none font-bold italic text-gray-400">
                <option>All Sources</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black text-gray-600">Search</label>
              <input type="text" placeholder="Filter headlines..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none italic" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-10 border-t border-white/5 pt-8">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black text-gray-600">Translation</label>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                <button className="px-6 py-2 bg-white/10 rounded-lg text-xs font-black tracking-widest">ENGLISH</button>
                <button className="px-6 py-2 text-xs font-black tracking-widest text-gray-600">NONE</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-black text-gray-600">View</label>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                <button onClick={() => setView("cards")} className={`px-6 py-2 rounded-lg text-xs font-black tracking-widest ${view === 'cards' ? 'bg-white/10 text-white' : 'text-gray-600'}`}>CARDS</button>
                <button onClick={() => setView("compact")} className={`px-6 py-2 rounded-lg text-xs font-black tracking-widest ${view === 'compact' ? 'bg-white/10 text-white' : 'text-gray-600'}`}>COMPACT</button>
              </div>
            </div>
            <div className="flex items-end flex-1">
              <button onClick={() => fetchNews(country)} className="bg-white text-black font-black text-xs tracking-[0.2em] px-10 py-3 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-xl uppercase">
                {loading ? "⌛ Refreshing..." : "🔄 Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* NEWS GRID */}
        <div className={view === "cards" ? "grid grid-cols-1 md:grid-cols-3 gap-10" : "flex flex-col gap-4"}>
          {filtered.map((a: any, i: number) => (
            <div key={i} className="bg-[#0b1224]/40 border border-white/5 p-8 rounded-[2.5rem] hover:border-blue-500/40 transition-all group relative overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20">{a.source}</span>
                <span className="text-[10px] text-gray-700 font-bold italic">ES → EN</span>
              </div>
              <h3 className="text-2xl font-black mb-6 leading-[1.15] group-hover:text-blue-400 transition-colors tracking-tight">{a.title}</h3>
              <p className="text-sm text-gray-500 font-medium leading-relaxed mb-10 line-clamp-4 italic italic-serif">"{a.summary}"</p>
              <a href={a.link} target="_blank" className="block text-center py-3 bg-white/5 hover:bg-blue-500 hover:text-white rounded-2xl text-[10px] font-black tracking-[0.2em] transition-all border border-white/5 uppercase">Read Full Intel</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}