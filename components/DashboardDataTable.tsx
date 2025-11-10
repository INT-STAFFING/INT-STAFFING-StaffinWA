/**
 * @file DashboardDataTable.tsx
 * @description Componente tabella specializzato e "headless" per la dashboard.
 */

import React, { useState, useMemo } from 'react';
import { ColumnDef } from './DataTable'; // Riusiamo la definizione delle colonne

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
}

/**
 * Hook per la gestione dell'ordinamento dei dati.
 */
const useSortableData = <T extends object>(
    items: T[],
    initialKey?: string
) => {
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
 * Componente DashboardDataTable.
 */
export function DashboardDataTable<T extends { id?: string }>({
    data,
    columns,
    initialSortKey,
    isLoading,
    footerNode,
}: DashboardDataTableProps<T>) {

    const { items: sortedData, requestSort, sortConfig } = useSortableData(data, initialSortKey);

    return (
        <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-container dark:bg-dark-card">
                <tr>
                    {columns.map(col => (
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
                                    <span className={sortConfig?.key === col.sortKey ? 'font-bold text-foreground' : ''}>
                                        {col.header}
                                    </span>
                                    <span className="text-gray-400">↕️</span>
                                </button>
                            ) : (
                                <span>{col.header}</span>
                            )}
                        </th>
                    ))}
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
                            {columns.map(col => (
                                <td key={`${item.id}-${col.header}`} className="px-4 py-2 text-muted-foreground">
                                    {col.cell(item)}
                                </td>
                            ))}
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                            Nessun dato trovato.
                        </td>
                    </tr>
                )}
            </tbody>
            {footerNode && (
                <tfoot className="border-t-2 border-outline font-bold">
                    {footerNode}
                </tfoot>
            )}
        </table>
    );
}
