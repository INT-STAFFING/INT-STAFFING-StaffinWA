/**
 * @file DataTable.tsx
 * @description Componente generico e riutilizzabile per visualizzare dati in una tabella con ordinamento, filtri e layout responsive.
 */

import React, { useState, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
import { EmptyState } from './FeedbackState';
import { ArrowRightIcon } from './icons';

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
    const containerRef = useRef<HTMLDivElement | null>(null);
    const headerBlockRef = useRef<HTMLDivElement | null>(null);
    const filtersContainerRef = useRef<HTMLDivElement | null>(null);
    const tableHeadRef = useRef<HTMLTableSectionElement | null>(null);

    const [stickyOffsets, setStickyOffsets] = useState({
        filtersTop: 0,
        tableHeadTop: 0,
    });

    useLayoutEffect(() => {
        if (typeof window === 'undefined') return;
        const container = containerRef.current;
        const headerEl = headerBlockRef.current;
        const filtersEl = filtersContainerRef.current;
        const tableHeadEl = tableHeadRef.current;

        if (!container) return;

        const computeOffsets = () => {
            const containerOffset = container.offsetTop;
            const headerHeight = headerEl?.offsetHeight ?? 0;
            const filtersOffset = filtersEl ? filtersEl.offsetTop - containerOffset : headerHeight;
            const filtersHeight = filtersEl?.offsetHeight ?? 0;
            const tableHeadOffset = tableHeadEl ? tableHeadEl.offsetTop - containerOffset : filtersOffset + filtersHeight;

            const nextFiltersTop = Math.max(filtersOffset, headerHeight);
            const nextTableHeadTop = Math.max(tableHeadOffset, nextFiltersTop + filtersHeight);

            setStickyOffsets(prev => {
                if (prev.filtersTop === nextFiltersTop && prev.tableHeadTop === nextTableHeadTop) {
                    return prev;
                }
                return {
                    filtersTop: nextFiltersTop,
                    tableHeadTop: nextTableHeadTop,
                };
            });
        };

        computeOffsets();

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(computeOffsets)
            : null;

        headerEl && resizeObserver?.observe(headerEl);
        filtersEl && resizeObserver?.observe(filtersEl);
        tableHeadEl && resizeObserver?.observe(tableHeadEl);
        window.addEventListener('resize', computeOffsets);

        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', computeOffsets);
        };
    }, [data.length, columns.length]);

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
            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider">
                {colKey ? (
                    <button type="button" onClick={() => requestSort(colKey)} className="flex items-center space-x-1 hover:text-foreground dark:hover:text-dark-foreground">
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
            </th>
        );
    };

    return (
        <div ref={containerRef} className="flex flex-col gap-6">
            <div
                ref={headerBlockRef}
                className="sticky top-0 z-40 flex flex-col gap-4 rounded-3xl border border-border/60 bg-muted/95 px-6 py-5 shadow-soft backdrop-blur md:flex-row md:items-center md:justify-between dark:border-dark-border/60 dark:bg-dark-muted/95"
            >
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground">{title}</h1>
                    <p className="text-sm text-muted-foreground dark:text-dark-muted-foreground">Gestisci e filtra rapidamente i dati in vista tabellare o mobile.</p>
                </div>
                <button
                    onClick={onAddNew}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform hover:scale-[1.02] hover:bg-primary-darker"
                >
                    {addNewButtonLabel}
                    <ArrowRightIcon className="w-4 h-4" aria-hidden />
                </button>
            </div>

            <div
                ref={filtersContainerRef}
                className="surface-card sticky z-30 p-5"
                style={{ top: `${stickyOffsets.filtersTop}px` }}
            >
                {filtersNode}
            </div>

            <div className="rounded-3xl border border-border/70 dark:border-dark-border/70 bg-card dark:bg-dark-card shadow-soft">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
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
                            <col style={{ width: '120px' }} />
                        </colgroup>
                        <thead
                            ref={tableHeadRef}
                            className="sticky z-20 bg-muted/95 backdrop-blur dark:bg-dark-muted/95 shadow-soft"
                            style={{ top: `${stickyOffsets.tableHeadTop}px` }}
                        >
                            <tr className="text-left text-xs font-semibold uppercase text-muted-foreground dark:text-dark-muted-foreground">
                                {columns.map(col => getSortableHeader(col.header, col.sortKey))}
                                <th className="px-6 py-4 text-right tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60 dark:divide-dark-border/60 text-sm">
                            {sortedData.map((item, index) => (
                                <React.Fragment key={(item as any).id ?? index}>
                                    {renderRow(item)}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    {sortedData.length === 0 && (
                        <div className="px-6 py-10">
                            <EmptyState
                                title="Nessun dato disponibile"
                                description="Modifica i filtri o aggiungi un nuovo elemento per iniziare a popolare questa sezione."
                            />
                        </div>
                    )}
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden p-4 space-y-4">
                    {sortedData.map(item => renderMobileCard(item))}
                    {sortedData.length === 0 && (
                        <EmptyState
                            title="Nessun dato disponibile"
                            description="Modifica i filtri o aggiungi un nuovo elemento per iniziare a popolare questa sezione."
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
