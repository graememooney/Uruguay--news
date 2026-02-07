"use client";

import React, { useState, useEffect } from "react";
import { RefreshCcw, Search, ExternalLink, Newspaper } from "lucide-react";

export default function MercosurNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState("uruguay");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("All");

  // Fetch news from our 93-line backend
  const fetchNews = async (targetCountry: string) => {
    setLoading(true);
    try {
      // Points to your Render backend via the Next.js API proxy
      const response = await fetch(`/api/news?country=${targetCountry}`);
      const data = await response.json();
      setArticles(data.articles || []);
    } catch (error) {
      console.error("Failed to fetch news:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews(country);
  }, [country]);

  // Filter logic for search and source dropdown
  const filteredArticles = articles.filter((article: any) => {
    const matchesSearch = 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSource = selectedSource === "All" || article.source === selectedSource;
    
    return matchesSearch && matchesSource;
  });

  // Get unique sources for the dropdown based on current articles
  const sources = ["All", ...Array.from(new Set(articles.map((a: any) => a.source)))];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <Newspaper className="text-blue-500" />
              Mercosur News
            </h1>
            <p className="text-[#A8B3CF] text-sm mt-1">Regional Intelligence Dashboard</p>
          </div>
          
          <button 
            onClick={() => fetchNews(country)}
            className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </header>

        {/* Controls Panel */}
        <div className="glass-panel p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Country Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase font-semibold text-[#6F7A95]">Region</label>
              <select 
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="bg-[#0B1224] border border-white/10 rounded-md px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="uruguay">Uruguay</option>
                <option value="argentina">Argentina</option>
                <option value="paraguay">Paraguay</option>
              </select>
            </div>

            {/* Source Selector */}
            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase font-semibold text-[#6F7A95]">Source</label>
              <select 
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-[#0B1224] border border-white/10 rounded-md px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="flex flex-col gap-2 md:col-span-2">
              <label className="text-xs uppercase font-semibold text-[#6F7A95]">Search Headlines</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6F7A95]" size={18} />
                <input 
                  type="text"
                  placeholder="Filter news..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0B1224] border border-white/10 rounded-md pl-10 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article: any, index) => (
              <div key={index} className="glass-panel p-5 flex flex-col hover:border-blue-500/50 transition-colors group">
                <div className="flex justify-between items-start mb-3">
                  <span className="bg-blue-500/10 text-blue-400 text-[10px] uppercase font-bold px-2 py-1 rounded">
                    {article.source}
                  </span>
                </div>
                <h3 className="text-lg font-bold leading-tight mb-3 group-hover:text-blue-400 transition-colors">
                  {article.title}
                </h3>
                <p className="text-[#A8B3CF] text-sm line-clamp-3 mb-4 flex-grow">
                  {article.summary}
                </p>
                <a 
                  href={article.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center justify-center gap-2 w-full py-2 bg-white/5 hover:bg-white/10 rounded text-sm font-medium transition-colors"
                >
                  Read Original <ExternalLink size={14} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}