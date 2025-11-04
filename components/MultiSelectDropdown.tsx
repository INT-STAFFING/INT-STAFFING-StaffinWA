/**
 * @file MultiSelectDropdown.tsx
 * @description Componente dropdown con checkbox per selezioni multiple.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, Check, ChevronDown, Search } from './IconLibrary';

interface Option {
    value: string;
    label: string;
}

interface MultiSelectDropdownProps {
    options: Option[];
    selectedValues: string[];
    onChange: (name: string, selected: string[]) => void;
    name: string;
    placeholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ options, selectedValues, onChange, name, placeholder = 'Seleziona...' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

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

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const handleSelect = (value: string) => {
        const newSelectedValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(name, newSelectedValues);
    };

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedLabelMap = useMemo(() => {
        return selectedValues
            .map(value => options.find(option => option.value === value)?.label)
            .filter((label): label is string => Boolean(label));
    }, [options, selectedValues]);

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2 text-left shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-dark-border dark:bg-dark-card"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                    {selectedLabelMap.length > 0 ? (
                        selectedLabelMap.map(label => (
                            <span
                                key={label}
                                className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                            >
                                {label}
                            </span>
                        ))
                    ) : (
                        <span className="text-muted-foreground">{placeholder}</span>
                    )}
                </div>
                <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-card shadow-xl dark:border-dark-border dark:bg-dark-card">
                    <div className="relative border-b border-border px-3 py-2 dark:border-dark-border">
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
                            onClick={() => onChange(name, [])}
                            role="option"
                            aria-selected={selectedValues.length === 0}
                        >
                            <span>Deseleziona tutti</span>
                            {selectedValues.length === 0 && <Check className="h-4 w-4" />}
                        </li>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    className={`flex cursor-pointer items-center justify-between px-4 py-2 text-sm transition-colors ${
                                        selectedValues.includes(option.value)
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-foreground dark:text-dark-foreground hover:bg-primary/10 hover:text-primary'
                                    }`}
                                    onClick={() => handleSelect(option.value)}
                                    role="option"
                                    aria-selected={selectedValues.includes(option.value)}
                                >
                                    <span>{option.label}</span>
                                    {selectedValues.includes(option.value) && <Check className="h-4 w-4" />}
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

export default MultiSelectDropdown;