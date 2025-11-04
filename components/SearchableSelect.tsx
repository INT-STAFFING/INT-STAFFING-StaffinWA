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
                className="w-full form-input text-left flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={selectedOption ? 'text-foreground dark:text-dark-foreground' : 'text-muted-foreground'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                <svg className="w-[var(--space-5)] h-[var(--space-5)] text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>
            {/* Hidden input to handle native form submission and validation */}
            <input type="hidden" name={name} value={value} required={required} />

            {isOpen && (
                // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                <div className="absolute z-50 mt-[var(--space-1)] w-full bg-card dark:bg-dark-card shadow-lg rounded-md border border-border dark:border-dark-border">
                    {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                    <div className="p-[var(--space-2)]">
                        <input
                            type="text"
                            placeholder="Cerca..."
                            className="w-full form-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <ul className="max-h-60 overflow-y-auto" role="listbox">
                         {/* Aggiunta dell'opzione placeholder per resettare il filtro */}
                        {/* MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza. */}
                        <li
                            className="px-[var(--space-4)] py-[var(--space-2)] text-[var(--font-size-sm)] text-muted-foreground hover:bg-muted dark:hover:bg-dark-muted cursor-pointer"
                            onClick={() => handleSelect('')}
                        >
                            {placeholder}
                        </li>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                                    className={`px-[var(--space-4)] py-[var(--space-2)] text-[var(--font-size-sm)] text-foreground dark:text-dark-foreground hover:bg-muted dark:hover:bg-dark-muted cursor-pointer ${value === option.value ? 'bg-primary/20' : ''}`}
                                    onClick={() => handleSelect(option.value)}
                                    role="option"
                                    aria-selected={value === option.value}
                                >
                                    {option.label}
                                </li>
                            ))
                        ) : (
                            // MODIFICA: Sostituita utility class con variabile CSS centralizzata per coerenza.
                            <li className="px-[var(--space-4)] py-[var(--space-2)] text-[var(--font-size-sm)] text-muted-foreground">Nessun risultato</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;