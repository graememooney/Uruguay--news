"use client";
import React, { useState, useEffect } from "react";

export default function MercosurNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("uruguay");
  const [view, setView] = useState("cards");
  const [search, setSearch] = useState("");

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
        <header className="mb-12">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-2">Mercosur News</h1>
          <p className="text-gray-500 font-medium">Real-time Regional Intelligence.</p>
        </header>

        {/* RESTORED FULL FILTER BAR */}
        <div className="bg-[#0b1224] border border-white/5 p-6 rounded-3xl mb-12 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Region</label>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none">
                <option value="uruguay">🇺🇾 Uruguay</option>
                <option value="argentina">🇦🇷 Argentina</option>
                <option value="paraguay">🇵🇾 Paraguay</option>
                <option value="mercosur">🌎 Mercosur (All)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Range</label>
              <select className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none">
                <option>Last 24 Hours</option>
                <option>Last 3 Days</option>
                <option>Last 7 Days</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Search Intelligence</label>
              <input type="text" placeholder="Filter headlines..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-black/40 border border-white/10 p-3 rounded-xl text-sm outline-none" />
            </div>
            <div className="flex items-end">
              <button onClick={() => fetchNews(country)} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-blue-500 hover:text-white transition-all">
                {loading ? "Refreshing..." : "Refresh Feed"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-8 border-t border-white/5 pt-6">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Translation</label>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                <button className="px-4 py-1.5 bg-white/10 rounded-lg text-xs font-bold">English</button>
                <button className="px-4 py-1.5 text-xs font-bold text-gray-500">None</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">View Mode</label>
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
                <button onClick={() => setView("cards")} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${view === 'cards' ? 'bg-white/10' : 'text-gray-500'}`}>Cards</button>
                <button onClick={() => setView("compact")} className={`px-4 py-1.5 rounded-lg text-xs font-bold ${view === 'compact' ? 'bg-white/10' : 'text-gray-500'}`}>Compact</button>
              </div>
            </div>
          </div>
        </div>

        {/* RESTORED NEWS GRID */}
        <div className={view === "cards" ? "grid grid-cols-1 md:grid-cols-3 gap-8" : "flex flex-col gap-4"}>
          {filtered.map((a: any, i: number) => (
            <div key={i} className="bg-[#0b1224]/50 border border-white/5 p-6 rounded-[2rem] hover:border-blue-500/30 transition-all group">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full">{a.source}</span>
                <span className="text-[10px] text-gray-600 font-bold italic">Spanish → English</span>
              </div>
              <h3 className="text-xl font-bold mb-4 leading-tight group-hover:text-blue-400 transition-colors">{a.title}</h3>
              <p className="text-sm text-gray-400 font-light leading-relaxed mb-6 line-clamp-3">"{a.summary}"</p>
              <a href={a.link} target="_blank" className="block text-center py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold transition-all border border-white/5">Read Full Intel</a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}