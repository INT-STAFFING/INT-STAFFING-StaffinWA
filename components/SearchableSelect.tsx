/**
 * @file SearchableSelect.tsx
 * @description Componente dropdown ricercabile per form.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SpinnerIcon } from './icons';

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
    isLoading?: boolean;
    loadingMessage?: string;
    noResultsMessage?: string;
}

type InternalOption = Option & { isPlaceholder?: boolean };

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    name,
    placeholder = 'Seleziona...',
    required,
    isLoading = false,
    loadingMessage = 'Caricamento in corso…',
    noResultsMessage = 'Nessun risultato',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

    const listboxId = `${name}-listbox`;
    const buttonId = `${name}-combobox-button`;

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

    const filteredOptions = useMemo(
        () =>
            options.filter(option =>
                option.label.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [options, searchTerm]
    );

    const optionsWithPlaceholder: InternalOption[] = useMemo(() => {
        const placeholderOption: InternalOption = {
            value: '',
            label: placeholder,
            isPlaceholder: true,
        };
        return [placeholderOption, ...filteredOptions];
    }, [filteredOptions, placeholder]);

    const totalOptions = optionsWithPlaceholder.length;

    useEffect(() => {
        if (isOpen) {
            const selectedIndex = optionsWithPlaceholder.findIndex(option => option.value === value);
            if (selectedIndex >= 0) {
                setHighlightedIndex(selectedIndex);
            } else if (optionsWithPlaceholder.length > 0) {
                setHighlightedIndex(0);
            } else {
                setHighlightedIndex(-1);
            }
        } else {
            setHighlightedIndex(-1);
            setSearchTerm('');
        }
    }, [isOpen, optionsWithPlaceholder, value]);

    useEffect(() => {
        if (highlightedIndex >= 0) {
            optionRefs.current[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    const handleSelect = (optionValue: string) => {
        onChange(name, optionValue);
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        buttonRef.current?.focus();
    };

    const handleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!isOpen) {
                setIsOpen(true);
                setHighlightedIndex(event.key === 'ArrowDown' ? 0 : totalOptions - 1);
            } else if (totalOptions > 0) {
                setHighlightedIndex(prev => {
                    if (prev < 0) {
                        return event.key === 'ArrowDown' ? 0 : totalOptions - 1;
                    }
                    const nextIndex = event.key === 'ArrowDown' ? prev + 1 : prev - 1;
                    if (nextIndex < 0) {
                        return totalOptions - 1;
                    }
                    if (nextIndex >= totalOptions) {
                        return 0;
                    }
                    return nextIndex;
                });
            }
        }

        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (isOpen && highlightedIndex >= 0) {
                handleSelect(optionsWithPlaceholder[highlightedIndex].value);
            } else {
                setIsOpen(prev => !prev);
            }
        }

        if (event.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (totalOptions > 0) {
                setHighlightedIndex(prev => {
                    const initialIndex = prev < 0 ? (event.key === 'ArrowDown' ? 0 : totalOptions - 1) : prev;
                    const nextIndex = event.key === 'ArrowDown' ? initialIndex + 1 : initialIndex - 1;
                    if (nextIndex < 0) {
                        return totalOptions - 1;
                    }
                    if (nextIndex >= totalOptions) {
                        return 0;
                    }
                    return nextIndex;
                });
            }
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (highlightedIndex >= 0) {
                handleSelect(optionsWithPlaceholder[highlightedIndex].value);
            }
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            setIsOpen(false);
            buttonRef.current?.focus();
        }

        if (event.key === 'Tab') {
            setIsOpen(false);
        }
    };

    optionRefs.current = optionRefs.current.slice(0, totalOptions);

    const activeDescendant = highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined;

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                id={buttonId}
                className="w-full form-input text-left flex justify-between items-center gap-2"
                onClick={() => setIsOpen(!isOpen)}
                onKeyDown={handleButtonKeyDown}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={listboxId}
                ref={buttonRef}
            >
                <span className="flex-1 min-w-0">
                    {selectedOption ? (
                        <span className="inline-flex max-w-full items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
                            <span className="truncate">{selectedOption.label}</span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground truncate">{placeholder}</span>
                    )}
                </span>
                <span
                    className={`ml-2 inline-flex items-center text-lg text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                >
                    ⌄
                </span>
            </button>
            {/* Hidden input to handle native form submission and validation */}
            <input type="hidden" name={name} value={value} required={required} />

            {isOpen && (
                <div
                    className="absolute z-10 mt-1 w-full bg-card dark:bg-dark-card shadow-lg rounded-md border border-border dark:border-dark-border animate-fade-in"
                    role="presentation"
                >
                    <div className="p-2">
                        <input
                            type="text"
                            placeholder="Cerca..."
                            className="w-full form-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            onKeyDown={handleInputKeyDown}
                            aria-controls={listboxId}
                            aria-activedescendant={activeDescendant}
                            role="combobox"
                            aria-expanded={isOpen}
                            aria-autocomplete="list"
                            aria-haspopup="listbox"
                            aria-labelledby={buttonId}
                            aria-label="Filtra opzioni"
                        />
                    </div>
                    <ul
                        className="max-h-60 overflow-y-auto focus-visible:outline-none"
                        role="listbox"
                        id={listboxId}
                        aria-labelledby={buttonId}
                    >
                        {optionsWithPlaceholder.map((option, index) => {
                            const isHighlighted = highlightedIndex === index;
                            const isSelected = value === option.value;
                            const optionClasses = [
                                'px-4 py-2 text-sm flex items-center justify-between cursor-pointer transition-colors select-none focus-visible:outline-none',
                                isHighlighted ? 'bg-primary/15 text-primary' : 'text-foreground dark:text-dark-foreground',
                                option.isPlaceholder
                                    ? `${isHighlighted ? '' : 'text-muted-foreground '}hover:bg-muted/80 dark:hover:bg-dark-muted/80`.trim()
                                    : 'hover:bg-muted dark:hover:bg-dark-muted',
                                isSelected && !option.isPlaceholder ? 'font-medium' : '',
                            ]
                                .filter(Boolean)
                                .join(' ');

                            return (
                                <li
                                    key={`${option.value}-${option.label}-${index}`}
                                    id={`${listboxId}-option-${index}`}
                                    ref={element => {
                                        optionRefs.current[index] = element;
                                    }}
                                    className={optionClasses}
                                    onClick={() => handleSelect(option.value)}
                                    onMouseEnter={() => setHighlightedIndex(index)}
                                    onMouseDown={(event) => event.preventDefault()}
                                    role="option"
                                    aria-selected={isSelected}
                                    tabIndex={-1}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {isSelected && !option.isPlaceholder && (
                                        <span className="ml-2 text-xs text-primary">✔️</span>
                                    )}
                                </li>
                            );
                        })}
                        {isLoading ? (
                            <li className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2" role="status">
                                <SpinnerIcon className="w-4 h-4 text-primary" aria-hidden="true" />
                                <span>{loadingMessage}</span>
                            </li>
                        ) : (
                            filteredOptions.length === 0 && (
                                <li className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2" role="status">
                                    <span aria-hidden="true">ℹ️</span>
                                    <span>{noResultsMessage}</span>
                                </li>
                            )
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
