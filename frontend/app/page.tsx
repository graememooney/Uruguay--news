"use client";
import React, { useState, useEffect } from "react";

export default function MercosurNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("uruguay");

  // This function fetches the news from your backend
  const fetchNews = async (target: string) => {
    setLoading(true);
    try {
      // This calls your Vercel proxy which talks to your Render backend
      const res = await fetch(`/api/news?country=${target}`);
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (e) { 
      console.error("Fetch error:", e); 
    }
    setLoading(false);
  };

  // This triggers a refresh whenever the country is changed
  useEffect(() => { 
    fetchNews(country); 
  }, [country]);

  return (
    <div className="min-h-screen bg-[#05070f] text-white p-4 md:p-8 font-sans">
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-blue-500">Mercosur News</h1>
        <button 
          onClick={() => fetchNews(country)} 
          className="bg-white text-black px-4 py-2 rounded-lg font-bold hover:bg-gray-200 transition-colors"
        >
          <span className="text-[10px] md:text-sm uppercase font-bold">
            {loading ? "Refreshing..." : "Refresh"}
          </span>
        </button>
      </header>

      {/* Selectors Section */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {/* Region Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Select Region</label>
          <select 
            value={country} 
            onChange={(e) => setCountry(e.target.value)} 
            className="w-full bg-[#0b1224] border border-white/10 p-3 rounded-xl focus:outline-none text-sm appearance-none cursor-pointer"
          >
            <option value="uruguay">Uruguay</option>
            <option value="argentina">Argentina</option>
            <option value="paraguay">Paraguay</option>
          </select>
        </div>

        {/* Date Range Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Date Range</label>
          <select className="w-full bg-[#0b1224] border border-white/10 p-3 rounded-xl focus:outline-none text-sm appearance-none cursor-pointer">
            <option>Last 24 Hours</option>
            <option>Last 3 Days</option>
            <option>Last 7 Days</option>
          </select>
        </div>
      </div>

      {/* Article Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {articles.length > 0 ? (
          articles.map((a: any, i: number) => (
            <div key={i} className="bg-[#0b1020]/60 border border-white/10 p-5 rounded-2xl flex flex-col hover:border-blue-500/30 transition-all group">
              <span className="text-blue-400 text-[10px] font-bold mb-3 uppercase tracking-tighter">{a.source}</span>
              <h3 className="font-bold text-base md:text-lg mb-3 leading-tight group-hover:text-blue-400 transition-colors">{a.title}</h3>
              <p className="text-sm text-gray-400 mb-6 line-clamp-3 leading-relaxed">{a.summary}</p>
              <a href={a.link} target="_blank" rel="noopener noreferrer" className="mt-auto text-center py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-medium transition-colors">
                Read Original
              </a>
            </div>
          ))
        ) : (
          !loading && (
            <div className="col-span-full text-center py-20 text-gray-500 italic">
              No stories found. Please click the Refresh button above.
            </div>
          )
        )}
      </div>
    </div>
  );
}