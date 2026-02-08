"use client";
import React, { useState, useEffect } from "react";

export default function UruguayNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (e) { console.error("Error:", e); }
    setLoading(false);
  };

  useEffect(() => { fetchNews(); }, []);

  // Creates a link that opens the article inside Google Translate
  const getTranslateLink = (url) => {
    return `https://translate.google.com/translate?sl=es&tl=en&u=${encodeURIComponent(url)}`;
  };

  return (
    <div className="min-h-screen bg-[#05070a] text-white p-6 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-end mb-12 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-blue-500 italic">Mercosur Intel</h1>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-1">Uruguay Phase 1.0</p>
          </div>
          <button 
            onClick={fetchNews}
            className="bg-white text-black px-6 py-2 rounded-lg font-bold hover:bg-blue-500 hover:text-white transition-all text-xs uppercase"
          >
            {loading ? "Syncing..." : "Refresh Feed"}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {articles.map((item, i) => (
            <div key={i} className="bg-[#0f1117] border border-white/5 p-6 rounded-2xl hover:border-blue-500/50 transition-all group">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 block">{item.source}</span>
              <h2 className="text-xl font-bold mb-4 leading-tight group-hover:text-blue-400 transition-colors">{item.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed mb-6">{item.summary}</p>
              <div className="flex gap-4">
                <a 
                  href={getTranslateLink(item.link)} 
                  target="_blank" 
                  className="flex-1 text-center py-2 bg-blue-600 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                >
                  Read in English
                </a>
                <a 
                  href={item.link} 
                  target="_blank" 
                  className="flex-1 text-center py-2 bg-white/5 rounded-lg text-xs font-bold hover:bg-white/10 transition-colors text-gray-400 border border-white/5"
                >
                  Original (ES)
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}