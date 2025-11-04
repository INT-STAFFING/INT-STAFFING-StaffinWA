import React, { useMemo, useState } from 'react';

type SortDirection = 'asc' | 'desc';

type SortAccessor<T> = keyof T | string | ((item: T) => string | number | null | undefined);

export interface DataTableColumn<T> {
    /** Unique identifier for the column */
    key: string;
    /** Header label */
    header: React.ReactNode;
    /** Render function for the cell */
    render: (item: T) => React.ReactNode;
    /** Optional classes applied to the cell */
    className?: string;
    /** Enable sorting for the column */
    sortable?: boolean;
    /** Accessor used when sorting the column */
    sortAccessor?: SortAccessor<T>;
    /** Alignment for header cells */
    headerClassName?: string;
}

export interface DataTableProps<T> {
    data: T[];
    columns: DataTableColumn<T>[];
    rowKey?: (item: T, index: number) => React.Key;
    emptyMessage?: React.ReactNode;
    footer?: React.ReactNode;
    initialSort?: { columnKey: string; direction?: SortDirection };
    scrollContainerClassName?: string;
    tableClassName?: string;
}

interface SortState {
    columnKey: string;
    direction: SortDirection;
}

const getValueFromPath = <T,>(item: T, path: string): any => {
    return path.split('.').reduce<any>((acc, key) => {
        if (acc == null) return undefined;
        return (acc as any)[key];
    }, item as any);
};

const getSortableValue = <T,>(item: T, column: DataTableColumn<T>): string | number | null | undefined => {
    if (!column.sortable) return undefined;
    const accessor = column.sortAccessor ?? column.key;

    if (typeof accessor === 'function') {
        return accessor(item);
    }

    if (typeof accessor === 'string') {
        return getValueFromPath(item, accessor);
    }

    return (item as any)[accessor as keyof T];
};

const DataTable = <T,>({
    data,
    columns,
    rowKey,
    emptyMessage = 'Nessun dato disponibile',
    footer,
    initialSort,
    scrollContainerClassName = 'max-h-96 overflow-y-auto',
    tableClassName = ''
}: DataTableProps<T>) => {
    const [sortState, setSortState] = useState<SortState | null>(initialSort ? {
        columnKey: initialSort.columnKey,
        direction: initialSort.direction ?? 'asc'
    } : null);

    const sortedData = useMemo(() => {
        if (!sortState) return data;
        const column = columns.find(col => col.key === sortState.columnKey && col.sortable);
        if (!column) return data;

        const directionMultiplier = sortState.direction === 'asc' ? 1 : -1;

        return [...data].sort((a, b) => {
            const aValue = getSortableValue(a, column);
            const bValue = getSortableValue(b, column);

            if (aValue == null && bValue == null) return 0;
            if (aValue == null) return 1 * directionMultiplier;
            if (bValue == null) return -1 * directionMultiplier;

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return (aValue - bValue) * directionMultiplier;
            }

            const aString = String(aValue);
            const bString = String(bValue);
            return aString.localeCompare(bString, 'it', { sensitivity: 'base' }) * directionMultiplier;
        });
    }, [data, columns, sortState]);

    const handleSort = (column: DataTableColumn<T>) => {
        if (!column.sortable) return;
        setSortState(prev => {
            if (prev?.columnKey === column.key) {
                return {
                    columnKey: column.key,
                    direction: prev.direction === 'asc' ? 'desc' : 'asc'
                };
            }
            return { columnKey: column.key, direction: 'asc' };
        });
    };

    return (
        <div className={`overflow-x-auto ${scrollContainerClassName}`}>
            <table className={`min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm ${tableClassName}`}>
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                    <tr>
                        {columns.map(column => {
                            const isSorted = sortState?.columnKey === column.key;
                            return (
                                <th
                                    key={column.key}
                                    scope="col"
                                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300 ${column.headerClassName ?? ''}`}
                                >
                                    {column.sortable ? (
                                        <button
                                            type="button"
                                            onClick={() => handleSort(column)}
                                            className={`flex items-center gap-1 hover:text-gray-900 dark:hover:text-white ${isSorted ? 'text-gray-900 dark:text-white' : ''}`}
                                        >
                                            <span>{column.header}</span>
                                            <span className="text-xs">
                                                {isSorted ? (sortState?.direction === 'asc' ? '▲' : '▼') : '↕'}
                                            </span>
                                        </button>
                                    ) : (
                                        <span>{column.header}</span>
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sortedData.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-300">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((item, index) => (
                            <tr
                                key={rowKey ? rowKey(item, index) : index}
                                className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-800/60"
                            >
                                {columns.map(column => (
                                    <td
                                        key={column.key}
                                        className={`px-4 py-3 align-top text-sm text-gray-700 dark:text-gray-100 ${column.className ?? ''}`}
                                    >
                                        {column.render(item)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
                {footer ? (
                    <tfoot className="bg-gray-100 dark:bg-gray-700 text-sm text-gray-800 dark:text-gray-100">
                        {footer}
                    </tfoot>
                ) : null}
            </table>
        </div>
    );
};

export default DataTable;
