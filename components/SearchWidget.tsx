
/**
 * @file SearchWidget.tsx
 * @description Command Palette di ricerca globale Material 3 con shortcut Cmd+K / Ctrl+K.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppContext';
import { useUIConfigContext } from '../context/UIConfigContext';
import { useGlobalSearch, SearchResult } from '../hooks/useGlobalSearch';

const SearchWidget: React.FC = () => {
    const { isSearchOpen, setSearchOpen } = useAppState();
    const { quickActions } = useUIConfigContext();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const results = useGlobalSearch(query);
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Gestione shortcut Cmd+K / Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(!isSearchOpen);
            }
            if (e.key === 'Escape' && isSearchOpen) {
                setSearchOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen, setSearchOpen]);

    // Focus input quando si apre
    useEffect(() => {
        if (isSearchOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isSearchOpen]);

    const handleNavigate = useCallback((link: string) => {
        setSearchOpen(false);
        navigate(link);
    }, [navigate, setSearchOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isSearchOpen) return;

        const maxIndex = results.length > 0 ? results.length - 1 : 0;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < maxIndex ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
                break;
            case 'Enter':
                e.preventDefault();
                if (results[selectedIndex]) {
                    handleNavigate(results[selectedIndex].link);
                }
                break;
        }
    };

    // Scroll automatico per mantenere la selezione visibile
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);

    if (!isSearchOpen) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-fade-in"
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-scrim/40 backdrop-blur-sm" 
                onClick={() => setSearchOpen(false)}
            />

            {/* Main Palette Container */}
            <div className="relative w-full max-w-2xl bg-surface-container-highest rounded-[2rem] shadow-2xl border border-outline-variant overflow-hidden flex flex-col animate-scale-in">
                {/* Search Header */}
                <div className="flex items-center px-6 py-4 border-b border-outline-variant gap-4">
                    <span className="material-symbols-outlined text-primary text-2xl">search</span>
                    <input 
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Cerca risorse, progetti, contratti..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-lg text-on-surface placeholder:text-on-surface-variant"
                    />
                    <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-surface-container rounded-lg border border-outline-variant">
                        <span className="text-[10px] font-black text-on-surface-variant uppercase">ESC</span>
                    </div>
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-y-auto max-h-[50vh] custom-scrollbar">
                    {query.length < 2 ? (
                        <div className="p-4">
                            <p className="px-4 py-2 text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Azioni Rapide</p>
                            <div className="space-y-1">
                                {(quickActions || []).map((action) => (
                                    <button
                                        key={action.link}
                                        onClick={() => handleNavigate(action.link)}
                                        className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl hover:bg-surface-container transition-colors text-left group"
                                    >
                                        <div 
                                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-primary/10 text-primary group-hover:bg-primary group-hover:text-on-primary"
                                            style={action.color ? { backgroundColor: action.color.startsWith('#') ? `${action.color}20` : undefined, color: action.color } : undefined}
                                        >
                                            <span className="material-symbols-outlined text-xl">{action.icon}</span>
                                        </div>
                                        <span className="font-bold text-on-surface">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="p-2" ref={listRef}>
                            {results.map((result, idx) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleNavigate(result.link)}
                                    className={`
                                        w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-left
                                        ${selectedIndex === idx ? 'bg-primary text-on-primary shadow-lg scale-[1.02]' : 'hover:bg-surface-container text-on-surface'}
                                    `}
                                >
                                    <div className={`
                                        w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                                        ${selectedIndex === idx ? 'bg-on-primary/20 text-on-primary' : 'bg-primary/10 text-primary'}
                                    `}>
                                        <span className="material-symbols-outlined text-xl">{result.icon}</span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold truncate">{result.title}</span>
                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${selectedIndex === idx ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                                                {result.type}
                                            </span>
                                        </div>
                                        <p className={`text-xs truncate ${selectedIndex === idx ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                                            {result.subtitle}
                                        </p>
                                    </div>
                                    {selectedIndex === idx && (
                                        <span className="material-symbols-outlined text-on-primary animate-pulse">keyboard_return</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-on-surface-variant opacity-60">
                            <span className="material-symbols-outlined text-5xl mb-2">search_off</span>
                            <p className="text-sm font-medium">Nessun risultato per "{query}"</p>
                        </div>
                    )}
                </div>

                {/* Footer Guide */}
                <div className="px-6 py-3 bg-surface-container-high border-t border-outline-variant flex justify-between items-center text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">arrow_upward</span>
                            <span className="material-symbols-outlined text-sm">arrow_downward</span>
                            per navigare
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">keyboard_return</span>
                            per selezionare
                        </span>
                    </div>
                    <span>Scrivi almeno 2 caratteri</span>
                </div>
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 10px; }
            `}</style>
        </div>,
        document.body
    );
};

export default SearchWidget;
