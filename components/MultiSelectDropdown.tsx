/**
 * @file MultiSelectDropdown.tsx
 * @description Componente dropdown con checkbox per selezioni multiple.
 */

import React, { useState, useEffect, useRef } from 'react';

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

    const getButtonLabel = () => {
        if (selectedValues.length === 0) {
            return placeholder;
        }
        if (selectedValues.length === 1) {
            return options.find(o => o.value === selectedValues[0])?.label || placeholder;
        }
        return `${selectedValues.length} elementi selezionati`;
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
                <span className={selectedValues.length > 0 ? 'text-foreground dark:text-dark-foreground' : 'text-muted-foreground'}>
                    {getButtonLabel()}
                </span>
                <svg className="w-[var(--space-5)] h-[var(--space-5)] text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-[var(--space-1)] w-full bg-card dark:bg-dark-card shadow-lg rounded-md border border-border dark:border-dark-border">
                    <div className="p-[var(--space-2)] border-b border-border dark:border-dark-border">
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
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    className="px-[var(--space-4)] py-[var(--space-2)] text-[var(--font-size-sm)] text-foreground dark:text-dark-foreground hover:bg-muted dark:hover:bg-dark-muted cursor-pointer flex items-center"
                                    onClick={() => handleSelect(option.value)}
                                    role="option"
                                    aria-selected={selectedValues.includes(option.value)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedValues.includes(option.value)}
                                        readOnly
                                        className="h-[var(--space-4)] w-[var(--space-4)] rounded border-gray-300 text-primary focus:ring-primary mr-[var(--space-3)] pointer-events-none"
                                    />
                                    {option.label}
                                </li>
                            ))
                        ) : (
                            <li className="px-[var(--space-4)] py-[var(--space-2)] text-[var(--font-size-sm)] text-muted-foreground">Nessun risultato</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;