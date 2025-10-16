/**
 * @file DataTable.tsx
 * @description Componente generico e riutilizzabile per visualizzare dati in una tabella con ordinamento, filtri e layout responsive.
 */

import React, { useState, useMemo } from 'react';
import { ArrowsUpDownIcon } from './icons';

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

    const getSortableHeader = (label: string, key?: string) => (
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
            {key ? (
                <button type="button" onClick={() => requestSort(key)} className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white">
                    <span className={sortConfig?.key === key ? 'font-bold text-primary-dark dark:text-primary-light' : ''}>{label}</span>
                    <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
                </button>
            ) : (
                <span>{label}</span>
            )}
        </th>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-primary-dark dark:text-primary-light self-start">{title}</h1>
                <button onClick={onAddNew} className="w-full md:w-auto px-4 py-2 bg-accent-teal text-primary-dark font-semibold rounded-md shadow-sm hover:opacity-90">{addNewButtonLabel}</button>
            </div>

            <div className="mb-6 p-4 bg-primary-light dark:bg-primary-dark rounded-lg shadow">
                {filtersNode}
            </div>

            <div className="bg-primary-light dark:bg-primary-dark rounded-lg shadow">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="border-b border-gray-200 dark:border-white/20">
                            <tr>
                                {columns.map(col => getSortableHeader(col.header, col.sortKey))}
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Azioni</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-white/20">
                            {sortedData.map(item => renderRow(item))}
                        </tbody>
                    </table>
                     {sortedData.length === 0 && <p className="text-center py-8 text-gray-500">Nessun dato trovato.</p>}
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden p-4 space-y-4">
                    {sortedData.map(item => renderMobileCard(item))}
                    {sortedData.length === 0 && <p className="text-center py-8 text-gray-500">Nessun dato trovato.</p>}
                </div>
            </div>
        </div>
    );
}