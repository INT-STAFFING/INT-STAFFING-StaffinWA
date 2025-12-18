/**
 * @file MultiSelectDropdown.tsx
 * @description Componente dropdown con checkbox per selezioni multiple.
 */

import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import { Option } from './forms/types';

interface MultiSelectDropdownProps {
    options: Option[];
    selectedValues: string[];
    onChange: (name: string, selected: string[]) => void;
    name: string;
    placeholder?: string;
    loadOptions?: (query: string) => Promise<Option[]>;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
    options,
    selectedValues,
    onChange,
    name,
    placeholder = 'Seleziona...',
    loadOptions,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [availableOptions, setAvailableOptions] = useState<Option[]>(options || []);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const baseId = useId();
    const listboxId = `${baseId}-listbox`;
    const getOptionId = (index: number) => `${baseId}-option-${index}`.replace(/:/g, '-');

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        setAvailableOptions(options || []);
    }, [options]);

    useEffect(() => {
        if (!loadOptions || !isOpen) return;

        let isActive = true;
        setIsLoading(true);
        setFetchError(null);

        loadOptions(searchTerm)
            .then((fetched) => {
                if (!isActive) return;
                setAvailableOptions(fetched);
            })
            .catch((error: unknown) => {
                console.error('Errore nel caricamento delle opzioni', error);
                if (!isActive) return;
                setFetchError('Impossibile caricare le opzioni');
                setAvailableOptions([]);
            })
            .finally(() => {
                if (isActive) {
                    setIsLoading(false);
                }
            });

        return () => {
            isActive = false;
        };
    }, [isOpen, searchTerm, loadOptions]);

    const filteredOptions = (availableOptions || []).filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggleSelection = useCallback((value: string) => {
        const newSelectedValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(name, newSelectedValues);
    }, [selectedValues, onChange, name]);
    
    const openMenu = () => setIsOpen(true);
    const closeMenu = () => {
        setIsOpen(false);
        setSearchTerm(''); // Reset search on close
        buttonRef.current?.focus();
    };

    const handleButtonKeyDown = (e: React.KeyboardEvent) => {
        if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            openMenu();
        }
    };
    
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        if (filteredOptions.length === 0) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeMenu();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(prev => (prev + 1) % filteredOptions.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredOptions[activeIndex]) {
                    handleToggleSelection(filteredOptions[activeIndex].value);
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
            setActiveIndex(0);
        }
    }, [isOpen, searchTerm]);

    useEffect(() => {
        if (isOpen && activeIndex >= 0 && listRef.current) {
            const activeElement = document.getElementById(getOptionId(activeIndex));
            activeElement?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, isOpen]);

    const getButtonLabel = () => {
        if (selectedValues.length === 0) {
            return placeholder;
        }
        if (selectedValues.length === 1) {
            return (availableOptions || []).find(o => o.value === selectedValues[0])?.label || placeholder;
        }
        return `${selectedValues.length} elementi selezionati`;
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                ref={buttonRef}
                type="button"
                className="w-full text-left flex justify-between items-center form-input focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                onClick={openMenu}
                onKeyDown={handleButtonKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                aria-label={selectedValues.length > 0 ? `Selezioni correnti: ${selectedValues.length}` : `Apri selettore multiplo: ${placeholder}`}
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
                            aria-activedescendant={filteredOptions.length > 0 ? getOptionId(activeIndex) : undefined}
                            aria-label="Filtra le opzioni"
                        />
                    </div>
                    <ul 
                        ref={listRef}
                        id={listboxId}
                        className="max-h-60 overflow-y-auto" 
                        role="listbox" 
                        aria-multiselectable="true" 
                        tabIndex={-1}
                    >
                        {isLoading && (
                            <li className="px-4 py-2 text-sm text-on-surface-variant" role="option" aria-live="polite">
                                Caricamento opzioni...
                            </li>
                        )}
                        {fetchError && !isLoading && (
                            <li className="px-4 py-2 text-sm text-error" role="option" aria-live="assertive">
                                {fetchError}
                            </li>
                        )}
                        {!isLoading && filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => (
                                <li
                                    key={option.value}
                                    id={getOptionId(index)}
                                    role="option"
                                    aria-selected={selectedValues.includes(option.value)}
                                    className={`px-4 py-2 text-sm text-on-surface hover:bg-surface-container cursor-pointer flex items-center ${activeIndex === index ? 'bg-surface-container' : ''}`}
                                    onClick={() => handleToggleSelection(option.value)}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedValues.includes(option.value)}
                                        readOnly
                                        tabIndex={-1}
                                        className="form-checkbox mr-3 pointer-events-none"
                                    />
                                    {option.label}
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-2 text-sm text-on-surface-variant" role="option" aria-live="polite">Nessun risultato</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;
