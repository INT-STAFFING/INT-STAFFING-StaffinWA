/**
 * @file DataTable.tsx
 * @description Componente generico e riutilizzabile per visualizzare dati in una tabella con ordinamento, filtri e layout responsive.
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';

/**
 * @interface ColumnDef
 * @description Definisce la struttura di una colonna per il DataTable.
 * @template T - Il tipo di dato di una riga.
 */
export interface ColumnDef<T> {
    /** @property {string} header - Il testo da visualizzare nell'intestazione della colonna. */
    header: string;
    /** @property {(item: T) => React.ReactNode} cell - Funzione che renderizza il contenuto della cella per una data riga. */
    cell: (item: T) => React.ReactNode;
    /** @property {string} [sortKey] - La chiave dell'oggetto da usare per l'ordinamento. */
    sortKey?: string;
    /** @property {string} [className] - Classi CSS opzionali per la cella (es. 'text-right'). */
    className?: string;
}

/** @type SortDirection - Le direzioni possibili per l'ordinamento. */
type SortDirection = 'ascending' | 'descending';

/**
 * @type SortConfig
 * @description Configurazione dell'ordinamento.
 * @template T - Il tipo di dato della riga.
 */
type SortConfig<T> = { key: keyof T | string; direction: SortDirection } | null;

/**
 * @interface DataTableProps
 * @description Prop per il componente DataTable.
 * @template T - Il tipo di dato di una riga, deve avere una proprietà 'id'.
 */
interface DataTableProps<T extends { id?: string }> {
    /** @property {string} title - Il titolo principale della pagina (es. "Gestione Clienti"). */
    title: string;
    /** @property {string} addNewButtonLabel - Il testo per il pulsante di aggiunta (es. "Aggiungi Cliente"). */
    addNewButtonLabel: string;
    /** @property {T[]} data - L'array di dati da visualizzare, già filtrato. */
    data: T[];
    /** @property {ColumnDef<T>[]} columns - La definizione delle colonne per la tabella desktop. */
    columns: ColumnDef<T>[];
    /** @property {React.ReactNode} filtersNode - Il componente React che contiene i controlli di filtro. */
    filtersNode: React.ReactNode;
    /** @property {() => void} onAddNew - Callback per il click sul pulsante di aggiunta. */
    onAddNew: () => void;
    /** @property {(item: T) => React.ReactNode} renderRow - Funzione che renderizza una riga completa della tabella (`<tr>`). */
    renderRow: (item: T) => React.ReactNode;
    /** @property {(item: T) => React.ReactNode} renderMobileCard - Funzione che renderizza la card per la visualizzazione mobile. */
    renderMobileCard: (item: T) => React.ReactNode;
    /** @property {string} [initialSortKey] - La chiave per l'ordinamento iniziale. */
    initialSortKey?: string;
}

/**
 * Componente DataTable generico.
 * @template T
 * @param {DataTableProps<T>} props - Le prop del componente.
 * @returns {React.ReactElement}
 */
export function DataTable<T extends { id?: string }>({
    title,
    addNewButtonLabel,
    data,
    columns,
    filtersNode,
    onAddNew,
    renderRow,
    renderMobileCard,
    initialSortKey
}: DataTableProps<T>) {

    const [sortConfig, setSortConfig] = useState<SortConfig<T>>(initialSortKey ? { key: initialSortKey, direction: 'ascending' } : null);
    
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const resizerRef = useRef<Record<string, HTMLDivElement | null>>({});

    const handleMouseDown = useCallback((key: string, e: React.MouseEvent) => {
        const startX = e.clientX;
        const th = (e.target as HTMLElement).closest('th');
        if (!th) return;
        const startWidth = th.offsetWidth;
        
        const handle = resizerRef.current[key];
        if (handle) handle.classList.add('resizing');

        const handleMouseMove = (event: MouseEvent) => {
            const deltaX = event.clientX - startX;
            const newWidth = Math.max(startWidth + deltaX, 80); // Min width 80px
            setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
        };

        const handleMouseUp = () => {
            if (handle) handle.classList.remove('resizing');
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, []);


    const requestSort = (key: string) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = useMemo(() => {
        if (!sortConfig) return data;
        
        return [...data].sort((a, b) => {
            const aValue = (a as any)[sortConfig.key];
            const bValue = (b as any)[sortConfig.key];

            if (aValue == null) return 1;
            if (bValue == null) return -1;
            
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return sortConfig.direction === 'ascending' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            return 0;
        });
    }, [data, sortConfig]);

    const getSortableHeader = (label: string, colKey?: string) => {
        const key = colKey || label;
        return (
            <th className="sticky top-0 z-20 bg-card dark:bg-dark-card px-[var(--space-6)] py-[var(--space-3)] text-left text-[var(--font-size-xs)] font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider shadow-sm">
                <div className="relative pr-[var(--space-4)]">
                    {colKey ? (
                        <button
                            type="button"
                            onClick={() => requestSort(colKey)}
                            className="flex items-center space-x-[var(--space-1)] hover:text-foreground dark:hover:text-dark-foreground"
                        >
                            <span className={sortConfig?.key === colKey ? 'font-bold text-foreground dark:text-dark-foreground' : ''}>{label}</span>
                            <span className="text-gray-400">↕️</span>
                        </button>
                    ) : (
                        <span>{label}</span>
                    )}
                    <div
                        ref={el => { resizerRef.current[key] = el; }}
                        className="resize-handle"
                        onMouseDown={(e) => handleMouseDown(key, e)}
                    />
                </div>
            </th>
        );
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-[var(--space-6)] gap-[var(--space-4)]">
                <h1 className="text-[var(--font-size-3xl)] font-bold text-foreground dark:text-dark-foreground self-start">{title}</h1>
                <button onClick={onAddNew} className="w-full md:w-auto px-[var(--space-4)] py-[var(--space-2)] bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-darker">{addNewButtonLabel}</button>
            </div>

            <div className="mb-[var(--space-6)] p-[var(--space-4)] bg-card dark:bg-dark-card rounded-lg shadow">
                {filtersNode}
            </div>

            <div className="bg-card dark:bg-dark-card rounded-lg shadow">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <div className="max-h-[65vh] overflow-x-auto overflow-y-auto">
                        <table className="w-full" style={{ tableLayout: 'fixed' }}>
                            <colgroup>
                                {columns.map(col => {
                                    const key = col.sortKey || col.header;
                                    return (
                                        <col
                                            key={key}
                                            style={columnWidths[key] ? { width: `${columnWidths[key]}px` } : undefined}
                                        />
                                    );
                                })}
                                <col style={{ width: '120px' }} /> {/* for actions column */}
                            </colgroup>
                            <thead className="border-b border-border dark:border-dark-border">
                                <tr>
                                    {columns.map(col => getSortableHeader(col.header, col.sortKey))}
                                    <th className="sticky top-0 z-20 bg-card dark:bg-dark-card px-[var(--space-6)] py-[var(--space-3)] text-right text-[var(--font-size-xs)] font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider shadow-sm">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border dark:divide-dark-border">
                                {sortedData.map(item => renderRow(item))}
                            </tbody>
                        </table>
                        {sortedData.length === 0 && <p className="text-center py-[var(--space-8)] text-muted-foreground">Nessun dato trovato.</p>}
                    </div>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden p-[var(--space-4)] space-y-[var(--space-4)]">
                    {sortedData.map(item => renderMobileCard(item))}
                    {sortedData.length === 0 && <p className="text-center py-[var(--space-8)] text-muted-foreground">Nessun dato trovato.</p>}
                </div>
            </div>
        </div>
    );
}