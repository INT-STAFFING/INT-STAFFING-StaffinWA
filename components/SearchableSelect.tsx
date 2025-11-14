/**
 * @file SearchableSelect.tsx
 * @description Componente dropdown ricercabile per form.
 */

import React, { useState, useEffect, useRef, useId } from 'react';

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
    const [activeIndex, setActiveIndex] = useState(-1);
    
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const baseId = useId();
    const listboxId = `${baseId}-listbox`;
    // FIX: Ensure ID generation is safe for query selectors by cleaning the baseId
    const getOptionId = (index: number) => `${baseId}-option-${index}`.replace(/:/g, '-');


    const selectedOption = (options || []).find(option => option.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = (options || []).filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const openMenu = () => setIsOpen(true);
    const closeMenu = () => {
        setIsOpen(false);
        setSearchTerm(''); // Reset search on close
        buttonRef.current?.focus();
    };

    const handleSelect = (newValue: string) => {
        onChange(name, newValue);
        closeMenu();
    };

    const handleButtonKeyDown = (e: React.KeyboardEvent) => {
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            openMenu();
        }
    };
    
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        const optionsCount = filteredOptions.length + 1; // +1 for placeholder
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % optionsCount);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + optionsCount) % optionsCount);
                break;
            case 'Enter':
                e.preventDefault();
                if (activeIndex === 0) {
                    handleSelect('');
                } else if (filteredOptions[activeIndex - 1]) {
                    handleSelect(filteredOptions[activeIndex - 1].value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                closeMenu();
                break;
        }
    };

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setActiveIndex(value ? filteredOptions.findIndex(o => o.value === value) + 1 : 0);
        }
    }, [isOpen, searchTerm]);

    useEffect(() => {
        if (isOpen && activeIndex >= 0 && listRef.current) {
            // FIX: Use getElementById which handles special characters in IDs from useId
            const activeElement = document.getElementById(getOptionId(activeIndex));
            activeElement?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);
    
    return (
        <div className="relative" ref={wrapperRef}>
            <button
                ref={buttonRef}
                type="button"
                className="w-full text-left flex justify-between items-center form-input"
                onClick={openMenu}
                onKeyDown={handleButtonKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
            >
                <span className={selectedOption ? 'text-on-surface' : 'text-on-surface-variant'}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="material-symbols-outlined text-on-surface-variant">unfold_more</span>
            </button>
            <input type="hidden" name={name} value={value} required={required} />

            {isOpen && (
                <div className="absolute z-50 mt-1 w-full bg-surface-container-high shadow-lg rounded-md border border-outline-variant">
                    <div className="p-2">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Cerca..."
                            className="form-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleInputKeyDown}
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded="true"
                            aria-controls={listboxId}
                            aria-activedescendant={getOptionId(activeIndex)}
                        />
                    </div>
                    <ul ref={listRef} id={listboxId} className="max-h-60 overflow-y-auto" role="listbox" tabIndex={-1}>
                        <li
                            id={getOptionId(0)}
                            role="option"
                            aria-selected={activeIndex === 0}
                            className={`px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container cursor-pointer ${activeIndex === 0 ? 'bg-surface-container' : ''}`}
                            onClick={() => handleSelect('')}
                        >
                            {placeholder}
                        </li>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => {
                                const optionIndex = index + 1;
                                return (
                                <li
                                    key={option.value}
                                    id={getOptionId(optionIndex)}
                                    role="option"
                                    aria-selected={value === option.value}
                                    className={`px-4 py-2 text-sm text-on-surface hover:bg-surface-container cursor-pointer ${value === option.value ? 'bg-primary-container text-on-primary-container' : ''} ${activeIndex === optionIndex ? 'bg-surface-container' : ''}`}
                                    onClick={() => handleSelect(option.value)}
                                >
                                    {option.label}
                                </li>
                            )})
                        ) : (
                            <li className="px-4 py-2 text-sm text-on-surface-variant" role="option" aria-live="polite">Nessun risultato</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;