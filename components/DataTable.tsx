/**
 * @file DataTable.tsx
 * @description Componente generico e riutilizzabile per visualizzare dati in una tabella con ordinamento, filtri, layout responsive e colonne ridimensionabili/fisse.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';

export interface ColumnDef<T> {
    header: string;
    cell: (item: T) => React.ReactNode;
    sortKey?: string;
    className?: string;
    minWidth?: number; // Opzionale: larghezza minima in px
}

type SortDirection = 'ascending' | 'descending';
type SortConfig<T> = { key: keyof T | string; direction: SortDirection } | null;

interface TableLayoutProps {
    dense?: boolean;
    rowBorder?: boolean;
    striped?: boolean;
    headerSticky?: boolean;
    headerBackground?: boolean;
    headerBorder?: boolean;
}

interface TableClassNames {
    base?: string;
    header?: string;
    headerRow?: string;
    headerCell?: string;
    body?: string;
    bodyRow?: string;
}

interface DataTableProps<T extends { id?: string }> {
    title: string;
    addNewButtonLabel: string;
    data: T[];
    columns: ColumnDef<T>[];
    filtersNode: React.ReactNode;
    onAddNew: () => void;
    renderRow: (item: T) => React.ReactNode;
    renderMobileCard: (item: T) => React.ReactNode;
    initialSortKey?: string;
    isLoading?: boolean;
    loadingMessage?: React.ReactNode;
    emptyMessage?: React.ReactNode;
    tableLayout?: TableLayoutProps;
    tableClassNames?: TableClassNames;
    actionsWidth?: number; // Opzionale: larghezza personalizzata manuale
    numActions?: number;   // Opzionale: numero di pulsanti azione per calcolo automatico larghezza
}

/** Utility per combinare classNames */
const combineClassNames = (...classes: Array<string | undefined | false>) =>
    classes.filter(Boolean).join(' ');

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
    actionsWidth,
    numActions,
}: DataTableProps<T>) {
    const [sortConfig, setSortConfig] = useState<SortConfig<T>>(
        initialSortKey ? { key: initialSortKey, direction: 'ascending' } : null
    );

    const [filters, setFilters] = useState<Record<string, string>>({});
    const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
    const tableRef = useRef<HTMLTableElement>(null);

    // Costanti per il calcolo della larghezza
    const BUTTON_WIDTH = 45; // Larghezza stimata per un pulsante icona (con padding e gap)
    const BASE_PADDING = 24; // Padding cella (px-2 + borders) o margine di sicurezza

    // Calcolo larghezza colonna azioni
    const finalActionsWidth = useMemo(() => {
        if (actionsWidth) return actionsWidth;
        if (numActions !== undefined) {
            return Math.max((numActions * BUTTON_WIDTH) + BASE_PADDING, 100);
        }
        return 130; // Default storico
    }, [actionsWidth, numActions]);

    // Inizializza le larghezze delle colonne se non settate
    useEffect(() => {
        if (tableRef.current && Object.keys(columnWidths).length === 0) {
            const initialWidths: Record<string, number> = {};
            // Distribuzione equa iniziale o basata su minWidth
            const totalWidth = tableRef.current.offsetWidth - finalActionsWidth; 
            const defaultWidth = Math.max(150, totalWidth / columns.length);
            
            columns.forEach(col => {
                initialWidths[col.header] = col.minWidth || defaultWidth;
            });
            setColumnWidths(initialWidths);
        }
    }, [columns, finalActionsWidth]);

    const layout: Required<TableLayoutProps> = {
        dense: tableLayout?.dense ?? false,
        rowBorder: tableLayout?.rowBorder ?? true,
        striped: tableLayout?.striped ?? false,
        headerSticky: tableLayout?.headerSticky ?? true,
        headerBackground: tableLayout?.headerBackground ?? true,
        headerBorder: tableLayout?.headerBorder ?? true,
    };

    const classes: Required<TableClassNames> = {
        base: tableClassNames?.base ?? 'w-full',
        header: tableClassNames?.header ?? '',
        headerRow: tableClassNames?.headerRow ?? '',
        headerCell: tableClassNames?.headerCell ?? '',
        body: tableClassNames?.body ?? combineClassNames(
            layout.rowBorder ? 'divide-y divide-outline-variant' : '',
            layout.striped
                ? '[&>tr:nth-child(odd)]:bg-surface-container-low'
                : ''
        ),
        bodyRow: tableClassNames?.bodyRow ?? '',
    };

    const handleMouseDown = useCallback((key: string, e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = columnWidths[key] || 150;

        const handleMouseMove = (event: MouseEvent) => {
            const deltaX = event.clientX - startX;
            const newWidth = Math.max(startWidth + deltaX, 80); // Minimo 80px
            setColumnWidths(prev => ({ ...prev, [key]: newWidth }));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [columnWidths]);

    const requestSort = (key: string) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handleColumnFilterChange = (key: string, value: string) => {
        setFilters(prev => ({
            ...prev,
            [key]: value
        }));
    };

    /** 🔍 Filtro client-side */
    const filteredData = useMemo(() => {
        if (!data) return [];
        return data.filter((item) => {
            return columns.every((col) => {
                const key = col.sortKey || col.header;
                const filterValue = filters[key];
                if (!filterValue) return true;
                const cellValue = (item as any)[key];
                if (cellValue == null) return false;
                return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }, [data, filters, columns]);

    /** 🔽 Ordinamento */
    const sortedData = useMemo(() => {
        const base = filteredData;
        if (!sortConfig) return base;
        return [...base].sort((a, b) => {
            const aValue = (a as any)[sortConfig.key];
            const bValue = (b as any)[sortConfig.key];
            if (aValue == null) return 1;
            if (bValue == null) return -1;
            if (typeof aValue === 'number' && typeof bValue === 'number')
                return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
            if (typeof aValue === 'string' && typeof bValue === 'string')
                return sortConfig.direction === 'ascending'
                    ? aValue.localeCompare(bValue)
                    : bValue.localeCompare(aValue);
            return 0;
        });
    }, [filteredData, sortConfig]);

    const getSortableHeader = (label: string, colKey?: string, index?: number) => {
        const key = label; 
        const isSorted = sortConfig?.key === colKey;
        const sortIcon =
            sortConfig && sortConfig.key === colKey
                ? sortConfig.direction === 'ascending'
                    ? '▲'
                    : '▼'
                : '↕️';

        const width = columnWidths[key];
        
        // Logica Sticky per header
        const isFirstDataCol = index === 0;
        const stickyClass = isFirstDataCol 
            ? `sticky left-[${finalActionsWidth}px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-outline-variant` 
            : 'relative'; 

        const bgClass = layout.headerBackground ? 'bg-surface-container-low' : 'bg-surface';

        return (
            <th
                key={label}
                style={{ width: width ? `${width}px` : 'auto' }}
                className={combineClassNames(
                    layout.headerSticky && 'sticky top-0 z-20',
                    layout.dense ? 'py-2' : 'py-3',
                    'px-4',
                    bgClass,
                    layout.headerBorder && 'border-b border-outline-variant',
                    'text-left text-xs font-medium text-on-surface-variant uppercase tracking-wider',
                    stickyClass,
                    classes.headerCell,
                    'group'
                )}
            >
                <div className="flex items-center justify-between h-full w-full truncate">
                    {colKey ? (
                        <button
                            type="button"
                            onClick={() => requestSort(colKey)}
                            className="flex items-center space-x-1 hover:text-on-surface truncate w-full"
                        >
                            <span className={`truncate ${isSorted ? 'font-bold text-on-surface' : ''}`}>
                                {label}
                            </span>
                            <span className="text-gray-400 text-[10px]">{sortIcon}</span>
                        </button>
                    ) : (
                        <span className="truncate">{label}</span>
                    )}
                    
                    {/* Resizer Handle */}
                    <div
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary group-hover:bg-outline-variant"
                        onMouseDown={(e) => handleMouseDown(key, e)}
                        onClick={(e) => e.stopPropagation()}
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
                <h1 className="text-3xl font-bold text-on-surface self-start">
                    {title}
                </h1>
                {title && addNewButtonLabel && (
                    <button
                        onClick={onAddNew}
                        className="w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm hover:opacity-90"
                    >
                        {addNewButtonLabel}
                    </button>
                )}
            </div>

            <div className="mb-6 p-4 bg-surface rounded-2xl shadow">
                {filtersNode}
            </div>

            <div className="bg-surface rounded-2xl shadow overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block">
                    <div className="max-h-[70vh] overflow-x-auto overflow-y-auto relative">
                        <table
                            ref={tableRef}
                            className="w-full table-fixed border-collapse"
                        >
                            <thead className={combineClassNames('bg-surface-container-low', classes.header)}>
                                {/* RIGA 1: INTESTAZIONI */}
                                <tr className={classes.headerRow}>
                                    {/* 1. Colonna Azioni (Fissa a Sinistra) */}
                                    <th
                                        className={combineClassNames(
                                            'sticky left-0 z-40 px-2',
                                            layout.headerSticky && 'sticky top-0',
                                            layout.dense ? 'py-2' : 'py-3',
                                            layout.headerBackground ? 'bg-surface-container-low' : 'bg-surface',
                                            layout.headerBorder && 'border-b border-outline-variant',
                                            'text-center text-xs font-medium text-on-surface-variant uppercase tracking-wider border-r border-outline-variant shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]'
                                        )}
                                        style={{ minWidth: `${finalActionsWidth}px`, width: `${finalActionsWidth}px` }}
                                    >
                                        Azioni
                                    </th>

                                    {/* 2. Colonne Dati */}
                                    {columns.map((col, index) => getSortableHeader(col.header, col.sortKey, index))}
                                </tr>

                                {/* RIGA 2: FILTRI COLONNA */}
                                <tr className="bg-surface-container-low">
                                    {/* 1. Filtro Azioni (Vuoto ma fisso) */}
                                    <th
                                        className={combineClassNames(
                                            'sticky left-0 z-30 px-2 py-1 bg-surface-container-low border-b border-r border-outline-variant shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]',
                                            layout.headerSticky && 'sticky top-[45px]' // Offset approssimativo dell'header sopra
                                        )}
                                        style={{ minWidth: `${finalActionsWidth}px`, width: `${finalActionsWidth}px` }}
                                    >
                                        {/* Placeholder */}
                                    </th>

                                    {/* 2. Filtri Dati */}
                                    {columns.map((col, index) => {
                                        const key = col.sortKey || col.header;
                                        const isFirstDataCol = index === 0;
                                        const stickyClass = isFirstDataCol 
                                            ? `sticky left-[${finalActionsWidth}px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] border-r border-outline-variant` 
                                            : 'relative z-10';
                                        
                                        return (
                                            <th 
                                                key={`filter-${key}`} 
                                                className={combineClassNames(
                                                    "px-2 py-1 bg-surface-container-low border-b border-outline-variant",
                                                    layout.headerSticky && 'sticky top-[45px]',
                                                    stickyClass
                                                )}
                                            >
                                                <input
                                                    type="text"
                                                    placeholder="Filtra..."
                                                    className="w-full text-xs form-input py-1 px-2 h-7 bg-surface border-outline-variant focus:border-primary rounded"
                                                    value={filters[key] || ''}
                                                    onChange={(e) => handleColumnFilterChange(key, e.target.value)}
                                                />
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>

                            <tbody className={classes.body}>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, rowIndex) => (
                                        <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                                            <td className="sticky left-0 z-10 bg-surface px-4 py-3 border-r border-outline-variant">
                                                <div className="h-4 w-8 rounded bg-surface-variant mx-auto" />
                                            </td>
                                            {columns.map((_, colIndex) => (
                                                <td key={`skeleton-cell-${colIndex}`} className="px-4 py-3">
                                                    <div className="h-4 rounded bg-surface-variant" />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : sortedData.length > 0 ? (
                                    sortedData.map((item, rowIndex) => {
                                        const renderedRow = renderRow(item);
                                        
                                        if (React.isValidElement(renderedRow) && renderedRow.type === 'tr') {
                                            // Explicit cast to access props
                                            const element = renderedRow as React.ReactElement<any>;
                                            
                                            const children = React.Children.toArray(element.props.children) as React.ReactElement<any>[];
                                            
                                            const actionCell = children[children.length - 1];
                                            const dataCells = children.slice(0, children.length - 1);
                                            
                                            const rowProps = element.props;

                                            return (
                                                <tr {...rowProps} className={combineClassNames(rowProps.className, classes.bodyRow, 'hover:bg-surface-container-low group')}>
                                                    {/* 1. Cella Azioni (Sticky Left) */}
                                                    <td 
                                                        className={combineClassNames(
                                                            "sticky left-0 z-10 px-2 py-3 text-center border-r border-outline-variant bg-surface group-hover:bg-surface-container-low",
                                                            "whitespace-nowrap"
                                                        )}
                                                        style={{ width: `${finalActionsWidth}px`, minWidth: `${finalActionsWidth}px` }}
                                                    >
                                                        {actionCell && actionCell.props.children}
                                                    </td>

                                                    {/* 2. Celle Dati */}
                                                    {dataCells.map((cell, cellIndex) => {
                                                        const isFirstDataCol = cellIndex === 0;
                                                        const stickyClass = isFirstDataCol 
                                                            ? `sticky left-[${finalActionsWidth}px] z-10 bg-surface group-hover:bg-surface-container-low border-r border-outline-variant shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`
                                                            : '';
                                                        
                                                        const safeCell = cell as React.ReactElement<any>;

                                                        return React.cloneElement(safeCell, {
                                                            className: combineClassNames(
                                                                safeCell.props.className,
                                                                stickyClass,
                                                                "truncate px-4 py-3 text-sm text-on-surface-variant overflow-hidden text-ellipsis whitespace-nowrap max-w-xs"
                                                            ),
                                                            style: { ...safeCell.props.style, maxWidth: '100%' }
                                                        });
                                                    })}
                                                </tr>
                                            );
                                        }
                                        
                                        return renderedRow;
                                    })
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={columns.length + 1}
                                            className="px-6 py-8 text-center text-on-surface-variant"
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
                            <p className="text-center text-on-surface-variant mb-2">
                                {loadingLabel}
                            </p>
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <div
                                    key={`mobile-skeleton-${idx}`}
                                    className="p-4 rounded-lg bg-surface-variant animate-pulse space-y-2"
                                >
                                    <div className="h-4 rounded bg-surface" />
                                    <div className="h-4 rounded bg-surface" />
                                    <div className="h-4 rounded bg-surface w-1/2" />
                                </div>
                            ))}
                        </>
                    ) : sortedData.length > 0 ? (
                        sortedData.map(item => renderMobileCard(item))
                    ) : (
                        <p className="text-center py-8 text-on-surface-variant">
                            {desktopEmptyMessage}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}