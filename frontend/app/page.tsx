"use client";
import React, { useState, useEffect } from "react";
import { RefreshCcw, Newspaper, Globe, Calendar } from "lucide-react";

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
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchNews(country); }, [country]);

  return (
    <div className="min-h-screen bg-[#05070f] text-white p-4 md:p-8">
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
          <Newspaper className="text-blue-500" /> Mercosur News
        </h1>
        <button 
          onClick={() => fetchNews(country)} 
          className="bg-white text-black px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200 transition-colors shrink-0"
        >
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          <span className="text-[10px] md:text-sm font-bold whitespace-nowrap">
            {loading ? "Refreshing..." : "Refresh"}
          </span>
        </button>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {/* Region Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Select Region</label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <select 
              value={country} 
              onChange={(e) => setCountry(e.target.value)} 
              className="w-full bg-[#0b1224] border border-white/10 p-3 pl-10 rounded-xl appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
            >
              <option value="uruguay">Uruguay</option>
              <option value="argentina">Argentina</option>
              <option value="paraguay">Paraguay</option>
            </select>
          </div>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Date Range</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
            <select className="w-full bg-[#0b1224] border border-white/10 p-3 pl-10 rounded-xl appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm">
              <option>Last 24 Hours</option>
              <option>Last 3 Days</option>
              <option>Last 7 Days</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {articles.length > 0 ? (
          articles.map((a: any, i) => (
            <div key={i} className="bg-[#0b1020]/60 border border-white/10 p-5 rounded-2xl flex flex-col hover:border-blue-500/30 transition-all">
              <span className="text-blue-400 text-[10px] font-bold mb-3 uppercase tracking-tighter">{a.source}</span>
              <h3 className="font-bold text-base md:text-lg mb-3 leading-tight">{a.title}</h3>
              <p className="text-sm text-gray-400 mb-6 line-clamp-3 leading-relaxed">{a.summary}</p>
              <a href={a.link} target="_blank" className="mt-auto text-center py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-medium">
                Read Original
              </a>
            </div>
          ))
        ) : (
          !loading && <div className="col-span-full text-center py-20 text-gray-500">No stories found. Try a different region.</div>
        )}
      </div>
    </div>
  );
}