/**
 * @file DashboardDataTable.tsx
 * @description Componente tabella specializzato e "headless" per la dashboard, ora con filtri sempre attivi.
 */

import React, { useState, useMemo } from 'react';
import { ColumnDef } from './DataTable';

// --- Tipi ---
type SortDirection = 'ascending' | 'descending';
type SortConfig<T> = { key: keyof T | string; direction: SortDirection } | null;

// --- Props ---
interface DashboardDataTableProps<T extends { id?: string }> {
    data: T[];
    columns: ColumnDef<T>[];
    initialSortKey?: string;
    isLoading?: boolean;
    footerNode?: React.ReactNode;
    maxVisibleRows?: number;
}

/**
 * Hook per la gestione dell'ordinamento dei dati.
 */
const useSortableData = <T extends object>(items: T[], initialKey?: string) => {
    const [sortConfig, setSortConfig] = useState<SortConfig<T>>(
        initialKey ? { key: initialKey, direction: 'ascending' } : null
    );

    const sortedItems = useMemo(() => {
        if (!sortConfig) return items;
        return [...items].sort((a, b) => {
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
    }, [items, sortConfig]);

    const requestSort = (key: keyof T | string) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    return { items: sortedItems, requestSort, sortConfig };
};

/**
 * Componente DashboardDataTable con filtri sempre attivi.
 */
export function DashboardDataTable<T extends { id?: string }>({
    data,
    columns,
    initialSortKey,
    isLoading,
    footerNode,
    maxVisibleRows: _maxVisibleRows, // l'altezza è ora gestita dal contenitore CSS (h-full)
}: DashboardDataTableProps<T>) {
    const { items: sortedDataRaw, requestSort, sortConfig } = useSortableData(data, initialSortKey);

    /** 🔍 Stato filtri per colonna */
    const [filters, setFilters] = useState<Record<string, string>>({});

    /** Applica i filtri client-side */
    const filteredData = useMemo(() => {
        return sortedDataRaw.filter((item) =>
            columns.every((col) => {
                const key = col.sortKey || col.header;
                const filterValue = filters[key];
                if (!filterValue) return true;
                const cellValue = (item as any)[key];
                if (cellValue == null) return false;
                return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
            })
        );
    }, [sortedDataRaw, columns, filters]);

    const sortedData = filteredData;

    return (
        <div className="h-full overflow-y-auto">
            <table className="min-w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface-container dark:bg-dark-card">
                    {/* Header principale */}
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col.header}
                                className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                            >
                                {col.sortKey ? (
                                    <button
                                        type="button"
                                        onClick={() => requestSort(col.sortKey!)}
                                        className="flex items-center space-x-1 hover:text-foreground"
                                    >
                                        <span
                                            className={
                                                sortConfig?.key === col.sortKey
                                                    ? 'font-bold text-foreground'
                                                    : ''
                                            }
                                        >
                                            {col.header}
                                        </span>
                                        <span className="text-gray-400">
                                            {sortConfig?.key === col.sortKey
                                                ? sortConfig.direction === 'ascending'
                                                    ? '▲'
                                                    : '▼'
                                                : '↕️'}
                                        </span>
                                    </button>
                                ) : (
                                    <span>{col.header}</span>
                                )}
                            </th>
                        ))}
                    </tr>

                    {/* 🔹 Riga filtri sempre attiva */}
                    <tr className="bg-muted/30 dark:bg-dark-muted/30 text-xs">
                        {columns.map((col) => {
                            const key = col.sortKey || col.header;
                            return (
                                <th key={key} className="px-4 py-2">
                                    <input
                                        type="text"
                                        value={filters[key] || ''}
                                        onChange={(e) =>
                                            setFilters((prev) => ({
                                                ...prev,
                                                [key]: e.target.value,
                                            }))
                                        }
                                        placeholder="Filtra..."
                                        className="w-full border border-border dark:border-dark-border rounded px-2 py-1 text-sm bg-background dark:bg-dark-card focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                </th>
                            );
                        })}
                    </tr>
                </thead>

                <tbody className="divide-y divide-border">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, rowIndex) => (
                            <tr key={`skeleton-${rowIndex}`} className="animate-pulse">
                                {columns.map((_, colIndex) => (
                                    <td key={`skeleton-cell-${colIndex}`} className="px-4 py-2">
                                        <div className="h-4 rounded bg-muted" />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : sortedData.length > 0 ? (
                        sortedData.map((item, index) => (
                            <tr key={item.id || index} className="hover:bg-muted/50">
                                {columns.map((col) => (
                                    <td
                                        key={`${item.id}-${col.header}`}
                                        className="px-4 py-2 text-muted-foreground"
                                    >
                                        {col.cell(item)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-4 py-6 text-center text-muted-foreground"
                            >
                                Nessun dato trovato.
                            </td>
                        </tr>
                    )}
                </tbody>

                {footerNode && (
                    <tfoot className="sticky bottom-0 border-t-2 border-outline font-bold bg-surface-container">
                        {footerNode}
                    </tfoot>
                )}
            </table>
        </div>
    );
}