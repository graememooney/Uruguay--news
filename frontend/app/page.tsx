"use client";
import React, { useState, useEffect } from "react";

export default function MercosurNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("uruguay");

  const fetchNews = async (target: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?country=${target}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (e) { console.error("Fetch error:", e); }
    setLoading(false);
  };

  useEffect(() => { fetchNews(country); }, [country]);

  return (
    <div className="min-h-screen bg-[#05070f] text-white p-4 md:p-8 font-sans">
      {/* Header Section */}
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto border-b border-white/5 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-blue-500">Mercosur News</h1>
          <p className="text-gray-500 text-xs mt-1">Real-time Regional Intelligence</p>
        </div>
        <button 
          onClick={() => fetchNews(country)} 
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold hover:bg-blue-400 hover:text-white transition-all transform active:scale-95 shadow-lg shadow-white/5"
        >
          <span className="text-[11px] md:text-sm uppercase font-bold tracking-tighter">
            {loading ? "⌛ Refreshing..." : "🔄 Refresh"}
          </span>
        </button>
      </header>

      {/* Selectors Section */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        {/* Region Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black ml-1">Select Region</label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2">🌎</span>
            <select 
              value={country} 
              onChange={(e) => setCountry(e.target.value)} 
              className="w-full bg-[#0b1224] border border-white/10 p-4 pl-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm appearance-none cursor-pointer transition-all hover:border-white/20"
            >
              <option value="uruguay">🇺🇾 Uruguay</option>
              <option value="argentina">🇦🇷 Argentina</option>
              <option value="paraguay">🇵🇾 Paraguay</option>
            </select>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-black ml-1">Date Range</label>
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2">📅</span>
            <select className="w-full bg-[#0b1224] border border-white/10 p-4 pl-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm appearance-none cursor-pointer transition-all hover:border-white/20">
              <option>Last 24 Hours</option>
              <option>Last 3 Days</option>
              <option>Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Article Grid Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {articles.length > 0 ? (
          articles.map((a: any, i: number) => (
            <div key={i} className="bg-[#0b1020]/60 border border-white/5 p-6 rounded-[2rem] flex flex-col hover:border-blue-500/40 hover:bg-[#0b1020]/80 transition-all duration-300 group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="flex justify-between items-start mb-4">
                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-blue-500/20">
                  {a.source}
                </span>
                <span className="text-[10px] text-gray-600 font-medium">ES → EN</span>
              </div>

              <h3 className="font-bold text-lg md:text-xl mb-4 leading-tight group-hover:text-blue-400 transition-colors">
                {a.title}
              </h3>
              
              <p className="text-sm text-gray-400 mb-8 line-clamp-4 leading-relaxed font-light italic">
                "{a.summary}"
              </p>
              
              <a 
                href={a.link} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-auto text-center py-3 bg-white/5 hover:bg-blue-500 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/5"
              >
                Read Original Article
              </a>
            </div>
          ))
        ) : (
          !loading && (
            <div className="col-span-full text-center py-32 border-2 border-dashed border-white/5 rounded-[3rem]">
              <p className="text-gray-500 text-lg font-light">No intelligence gathered for this region yet.</p>
              <button onClick={() => fetchNews(country)} className="mt-4 text-blue-500 text-sm font-bold hover:underline">Retry Connection</button>
            </div>
          )
        )}
      </div>
    </div>
  );
}