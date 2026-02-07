"use client";
import React, { useState, useEffect } from "react";
import { RefreshCcw, Newspaper } from "lucide-react";

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
    <div className="min-h-screen bg-[#05070f] text-white p-8">
      <header className="flex justify-between items-center mb-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Newspaper /> Mercosur News</h1>
        <button onClick={() => fetchNews(country)} className="bg-white text-black px-4 py-2 rounded-lg flex items-center gap-2">
          <RefreshCcw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <div className="max-w-6xl mx-auto mb-8">
        <select value={country} onChange={(e) => setCountry(e.target.value)} className="bg-[#0b1224] border border-white/10 p-2 rounded w-48">
          <option value="uruguay">Uruguay</option>
          <option value="argentina">Argentina</option>
          <option value="paraguay">Paraguay</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {articles.map((a: any, i) => (
          <div key={i} className="bg-[#0b1020]/60 border border-white/10 p-4 rounded-xl flex flex-col">
            <span className="text-blue-400 text-xs font-bold mb-2 uppercase">{a.source}</span>
            <h3 className="font-bold mb-2">{a.title}</h3>
            <p className="text-sm text-gray-400 mb-4 line-clamp-3">{a.summary}</p>
            <a href={a.link} target="_blank" className="mt-auto text-center py-2 bg-white/5 rounded text-sm">Read Original</a>
          </div>
        ))}
      </div>
    </div>
  );
}