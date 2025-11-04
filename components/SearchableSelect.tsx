/**
 * @file SearchableSelect.tsx
 * @description Componente dropdown ricercabile per form.
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Check, ChevronDown, Search } from './IconLibrary';

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

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (optionValue: string) => {
        onChange(name, optionValue);
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2 text-left shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-dark-border dark:bg-dark-card"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                {selectedOption ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {selectedOption.label}
                    </span>
                ) : (
                    <span className="text-sm text-muted-foreground">{placeholder}</span>
                )}
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>
            {/* Hidden input to handle native form submission and validation */}
            <input type="hidden" name={name} value={value} required={required} />

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl dark:border-dark-border dark:bg-dark-card">
                    <div className="relative px-3 py-2">
                        <Search className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cerca..."
                            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground shadow-inner focus:outline-none focus:ring-2 focus:ring-primary dark:border-dark-border dark:bg-dark-card dark:text-dark-foreground"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <ul className="max-h-64 overflow-y-auto py-2" role="listbox">
                        <li
                            className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleSelect('')}
                            role="option"
                            aria-selected={value === ''}
                        >
                            <span>{placeholder}</span>
                            {value === '' && <Check className="h-4 w-4" />}
                        </li>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm transition-colors ${
                                        value === option.value
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-foreground dark:text-dark-foreground hover:bg-primary/10 hover:text-primary'
                                    }`}
                                    onClick={() => handleSelect(option.value)}
                                    role="option"
                                    aria-selected={value === option.value}
                                >
                                    <span>{option.label}</span>
                                    {value === option.value && <Check className="h-4 w-4" />}
                                </li>
                            ))
                        ) : (
                            <li className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                                <AlertCircle className="h-4 w-4" />
                                Nessun risultato
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;