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
                className="w-full text-left flex justify-between items-center px-3 py-2 text-sm bg-transparent border border-outline rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className={selectedValues.length > 0 ? 'text-on-surface' : 'text-on-surface-variant'}>
                    {getButtonLabel()}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant">unfold_more</span>
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-surface-container-high shadow-lg rounded-md border border-outline-variant">
                    <div className="p-2 border-b border-outline-variant">
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
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <li
                                    key={option.value}
                                    className="px-4 py-2 text-sm text-on-surface hover:bg-surface-container cursor-pointer flex items-center"
                                    onClick={() => handleSelect(option.value)}
                                    role="option"
                                    aria-selected={selectedValues.includes(option.value)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedValues.includes(option.value)}
                                        readOnly
                                        className="h-4 w-4 rounded border-outline text-primary focus:ring-primary mr-3 pointer-events-none"
                                    />
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

export default MultiSelectDropdown;
