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
 * @interface TableLayoutProps
 * @description Configurazione layout "in stile ReUI" per la tabella.
 */
interface TableLayoutProps {
    /** Riduce il padding verticale delle celle (stile "dense"). */
    dense?: boolean;
    /** Mostra i bordi tra le righe. */
    rowBorder?: boolean;
    /** Applica uno stile a righe alternate (striped). */
    striped?: boolean;
    /** Rende l'header sticky rispetto al contenitore scrollabile. */
    headerSticky?: boolean;
    /** Applica background all'header. */
    headerBackground?: boolean;
    /** Applica un bordo inferiore all'header. */
    headerBorder?: boolean;
    /** Larghezza tabella: layout fixed o auto. */
    width?: 'auto' | 'fixed';
}

/**
 * @interface TableClassNames
 * @description Classi personalizzabili per le principali parti della tabella.
 */
interface TableClassNames {
    base?: string;
    header?: string;
    headerRow?: string;
    headerCell?: string;
    body?: string;
    bodyRow?: string;
}

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

    // --- Nuove prop “in stile ReUI”, tutte opzionali ---

    /**
     * Indica se i dati sono in fase di caricamento.
     * Se true, vengono mostrati skeleton rows al posto dei dati.
     */
    isLoading?: boolean;

    /** Messaggio personalizzato da mostrare in fase di caricamento (fallback: "Caricamento..."). */
    loadingMessage?: React.ReactNode;

    /** Messaggio da mostrare quando non ci sono dati (fallback: "Nessun dato trovato."). */
    emptyMessage?: React.ReactNode;

    /**
     * Configurazione layout tabella (dense, striped, sticky header, ecc.),
     * ispirata alla prop `tableLayout` di ReUI.
     */
    tableLayout?: TableLayoutProps;

    /**
     * Classi CSS personalizzabili per le parti principali della tabella,
     * ispirata alla prop `tableClassNames` di ReUI.
     */
    tableClassNames?: TableClassNames;
}

/** Utility per combinare classNames senza dipendenze esterne. */
const combineClassNames = (...classes: Array<string | undefined | false>) =>
    classes.filter(Boolean).join(' ');

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
    initialSortKey,
    isLoading,
    loadingMessage,
    emptyMessage,
    tableLayout,
    tableClassNames,
}: DataTableProps<T>) {
    const [sortConfig, setSortConfig] = useState<SortConfig<T>>(
        initialSortKey ? { key: initialSortKey, direction: 'ascending' } : null
    );

    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const resizerRef = useRef<Record<string, HTMLDivElement | null>>({});

    // Default layout in stile ReUI
    const layout: Required<TableLayoutProps> = {
        dense: tableLayout?.dense ?? false,
        rowBorder: tableLayout?.rowBorder ?? true,
        striped: tableLayout?.striped ?? false,
        headerSticky: tableLayout?.headerSticky ?? true,
        headerBackground: tableLayout?.headerBackground ?? true,
        headerBorder: tableLayout?.headerBorder ?? true,
        width: tableLayout?.width ?? 'fixed',
    };

    // Classi base ispirate a ReUI, ma compatibili con il tuo tema esistente
    const classes: Required<TableClassNames> = {
        base: tableClassNames?.base ?? 'w-full',
        header: tableClassNames?.header ?? '',
        headerRow: tableClassNames?.headerRow ?? '',
        headerCell: tableClassNames?.headerCell ?? '',
        body: tableClassNames?.body ?? combineClassNames(
            layout.rowBorder ? 'divide-y divide-border dark:divide-dark-border' : '',
            layout.striped
                ? '[&>tr:nth-child(odd)]:bg-muted/40 dark:[&>tr:nth-child(odd)]:bg-dark-muted/40'
                : ''
        ),
        bodyRow: tableClassNames?.bodyRow ?? '',
    };

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
                return sortConfig.direction === 'ascending'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            }
            return 0;
        });
    }, [data, sortConfig]);

    const getSortableHeader = (label: string, colKey?: string) => {
        const key = colKey || label;
        const isSorted = sortConfig?.key === colKey;
        const sortIcon =
            sortConfig && sortConfig.key === colKey
                ? sortConfig.direction === 'ascending'
                    ? '▲'
                    : '▼'
                : '↕️';

        return (
            <th
                className={combineClassNames(
                    layout.headerSticky && 'sticky top-0 z-20',
                    'px-6',
                    layout.dense ? 'py-2' : 'py-3',
                    layout.headerBackground && 'bg-card dark:bg-dark-card',
                    layout.headerBorder && 'border-b border-border dark:border-dark-border',
                    'text-left text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider shadow-sm',
                    classes.headerCell
                )}
            >
                <div className="relative pr-4">
                    {colKey ? (
                        <button
                            type="button"
                            onClick={() => requestSort(colKey)}
                            className="flex items-center space-x-1 hover:text-foreground dark:hover:text-dark-foreground"
                        >
                            <span
                                className={
                                    isSorted
                                        ? 'font-bold text-foreground dark:text-dark-foreground'
                                        : ''
                                }
                            >
                                {label}
                            </span>
                            <span className="text-gray-400">{sortIcon}</span>
                        </button>
                    ) : (
                        <span>{label}</span>
                    )}
                    <div
                        ref={el => {
                            resizerRef.current[key] = el;
                        }}
                        className="resize-handle"
                        onMouseDown={e => handleMouseDown(key, e)}
                    />
                </div>
            </th>
        );
    };

    const desktopEmptyMessage = emptyMessage ?? 'Nessun dato trovato.';
    const loadingLabel = loadingMessage ?? 'Caricamento...';

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-foreground dark:text-dark-foreground self-start">
                    {title}
                </h1>
                <button
                    onClick={onAddNew}
                    className="w-full md:w-auto px-4 py-2 bg-primary text-white font-semibold rounded-md shadow-sm hover:bg-primary-darker"
                >
                    {addNewButtonLabel}
                </button>
            </div>

            <div className="mb-6 p-4 bg-card dark:bg-dark-card rounded-lg shadow">
                {filtersNode}
            </div>

            <div className="bg-card dark:bg-dark-card rounded-lg shadow">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <div className="max-h-[65vh] overflow-x-auto overflow-y-auto">
                        <table
                            className={classes.base}
                            style={{ tableLayout: layout.width === 'fixed' ? 'fixed' : 'auto' }}
                        >
                            <colgroup>
                                {columns.map(col => {
                                    const key = col.sortKey || col.header;
                                    return (
                                        <col
                                            key={key}
                                            style={
                                                columnWidths[key]
                                                    ? { width: `${columnWidths[key]}px` }
                                                    : undefined
                                            }
                                        />
                                    );
                                })}
                                <col style={{ width: '120px' }} /> {/* colonna Azioni */}
                            </colgroup>

                            <thead className={combineClassNames('bg-card dark:bg-dark-card', classes.header)}>
                                <tr className={classes.headerRow}>
                                    {columns.map(col =>
                                        getSortableHeader(col.header, col.sortKey)
                                    )}
                                    <th
                                        className={combineClassNames(
                                            layout.headerSticky && 'sticky top-0 z-20',
                                            'px-6',
                                            layout.dense ? 'py-2' : 'py-3',
                                            layout.headerBackground &&
                                                'bg-card dark:bg-dark-card',
                                            layout.headerBorder &&
                                                'border-b border-border dark:border-dark-border',
                                            'text-right text-xs font-medium text-muted-foreground dark:text-dark-muted-foreground uppercase tracking-wider shadow-sm',
                                            classes.headerCell
                                        )}
                                    >
                                        Azioni
                                    </th>
                                </tr>
                            </thead>

                            <tbody className={classes.body}>
                                {isLoading ? (
                                    // Skeleton rows stile ReUI loading skeleton
                                    Array.from({ length: 5 }).map((_, rowIndex) => (
                                        <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                                            {columns.map((col, colIndex) => (
                                                <td
                                                    key={`skeleton-cell-${rowIndex}-${colIndex}`}
                                                    className={combineClassNames(
                                                        'px-6',
                                                        layout.dense ? 'py-2' : 'py-3'
                                                    )}
                                                >
                                                    <div className="h-4 rounded bg-muted dark:bg-dark-muted" />
                                                </td>
                                            ))}
                                            <td
                                                className={combineClassNames(
                                                    'px-6 text-right',
                                                    layout.dense ? 'py-2' : 'py-3'
                                                )}
                                            >
                                                <div className="h-4 w-16 rounded bg-muted dark:bg-dark-muted" />
                                            </td>
                                        </tr>
                                    ))
                                ) : sortedData.length > 0 ? (
                                    sortedData.map(item => renderRow(item))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={columns.length + 1}
                                            className="px-6 py-8 text-center text-muted-foreground"
                                        >
                                            {desktopEmptyMessage}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden p-4 space-y-4">
                    {isLoading ? (
                        <>
                            <p className="text-center text-muted-foreground mb-2">
                                {loadingLabel}
                            </p>
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <div
                                    key={`mobile-skeleton-${idx}`}
                                    className="p-4 rounded-lg bg-muted dark:bg-dark-muted animate-pulse space-y-2"
                                >
                                    <div className="h-4 rounded bg-background dark:bg-dark-card" />
                                    <div className="h-4 rounded bg-background dark:bg-dark-card" />
                                    <div className="h-4 rounded bg-background dark:bg-dark-card w-1/2" />
                                </div>
                            ))}
                        </>
                    ) : sortedData.length > 0 ? (
                        sortedData.map(item => renderMobileCard(item))
                    ) : (
                        <p className="text-center py-8 text-muted-foreground">
                            {desktopEmptyMessage}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
