
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalSearch, SearchResult } from '../hooks/useGlobalSearch';

const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) => 
                regex.test(part) ? <span key={i} className="bg-yellow-200 text-black font-semibold rounded-sm px-0.5">{part}</span> : <span key={i}>{part}</span>
            )}
        </span>
    );
};

const GlobalSearchPage: React.FC = () => {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();
    const results = useGlobalSearch(query);

    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.type]) acc[result.type] = [];
        acc[result.type].push(result);
        return acc;
    }, {} as Record<string, SearchResult[]>);

    const handleNavigate = (link: string) => {
        navigate(link);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
             <div className="flex flex-col gap-4 bg-surface p-6 rounded-3xl shadow-sm border border-outline-variant sticky top-0 z-20">
                <h1 className="text-3xl font-bold text-on-surface flex items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-primary">search</span>
                    Ricerca Globale
                </h1>
                <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Cerca risorse, progetti, clienti, competenze..."
                        className="w-full bg-surface-container-high border-2 border-transparent focus:border-primary rounded-2xl px-12 py-4 text-lg shadow-inner transition-all outline-none text-on-surface"
                        autoFocus
                    />
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-2xl">search</span>
                    {query && (
                        <button 
                            onClick={() => setQuery('')}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                        >
                            <span className="material-symbols-outlined text-2xl">close</span>
                        </button>
                    )}
                </div>
                <p className="text-sm text-on-surface-variant ml-2">
                    {query.length > 1 ? `Trovati ${results.length} risultati` : 'Digita almeno 2 caratteri per cercare'}
                </p>
            </div>

            <div className="space-y-8 animate-fade-in">
                {Object.entries(groupedResults).map(([type, items]) => {
                    // Explicit cast to resolve type inference issue
                    const searchItems = items as SearchResult[];
                    return (
                        <div key={type} className="bg-surface rounded-2xl border border-outline-variant overflow-hidden shadow-sm">
                            <div className="bg-surface-container px-6 py-3 border-b border-outline-variant flex justify-between items-center">
                                <h3 className="text-sm font-black text-on-surface-variant uppercase tracking-widest">{type}</h3>
                                <span className="bg-surface text-on-surface text-xs font-bold px-2 py-0.5 rounded-full border border-outline-variant">{searchItems.length}</span>
                            </div>
                            <div className="divide-y divide-outline-variant">
                                {searchItems.map(item => (
                                    <div 
                                        key={`${item.type}-${item.id}`}
                                        onClick={() => handleNavigate(item.link)}
                                        className="p-4 flex items-center gap-4 hover:bg-surface-container-low cursor-pointer transition-colors group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition-colors">
                                            <span className="material-symbols-outlined">{item.icon}</span>
                                        </div>
                                        <div className="flex-grow">
                                            <h4 className="text-lg font-semibold text-on-surface">
                                                <HighlightedText text={item.title} highlight={query} />
                                            </h4>
                                            <p className="text-sm text-on-surface-variant">
                                                <HighlightedText text={item.subtitle} highlight={query} />
                                            </p>
                                        </div>
                                        <span className="material-symbols-outlined text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity">
                                            arrow_forward
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
                
                {query.length > 1 && results.length === 0 && (
                     <div className="text-center py-20 opacity-50">
                        <span className="material-symbols-outlined text-6xl mb-4">search_off</span>
                        <p className="text-xl font-medium">Nessun risultato trovato per "{query}"</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GlobalSearchPage;
