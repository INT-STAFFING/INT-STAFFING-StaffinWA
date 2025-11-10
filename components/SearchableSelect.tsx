/**
 * @file SearchableSelect.tsx
 * @description Componente dropdown ricercabile per form.
 */

import React, { useState, useEffect, useRef } from 'react';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (name: string, value: string) => void;
    name: string;
    placeholder?: string;
    required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, name, placeholder = 'Seleziona...', required }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(option => option.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Fix: Define filteredOptions by filtering options based on the search term.
    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                className="w-full text-left flex justify-between items-center px-3 py-2 text-sm bg-transparent border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={selectedOption ? 'text-on-surface' : 'text-on-surface-variant'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant">unfold_more</span>
            </button>
            {/* Hidden input to handle native form submission and validation */}
            <input type="hidden" name={name} value={value} required={required} />

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-surface-container-high shadow-lg rounded-md border border-outline-variant">
                    <div className="p-2">
                        <input
                            type="text"
                            placeholder="Cerca..."
                            className="w-full px-3 py-2 text-sm bg-transparent border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <ul className="max-h-60 overflow-y-auto" role="listbox">
                         {/* Aggiunta dell'opzione placeholder per resettare il filtro */}
                        <li
                            className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container cursor-pointer"
                            onClick={() => { onChange(name, ''); setIsOpen(false); }}
                        >
                            {placeholder}
                        </li>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    className={`px-4 py-2 text-sm text-on-surface hover:bg-surface-container cursor-pointer ${value === option.value ? 'bg-primary-container text-on-primary-container' : ''}`}
                                    onClick={() => { onChange(name, option.value); setIsOpen(false); }}
                                    role="option"
                                    aria-selected={value === option.value}
                                >
                                    {option.label}
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-2 text-sm text-on-surface-variant">Nessun risultato</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;