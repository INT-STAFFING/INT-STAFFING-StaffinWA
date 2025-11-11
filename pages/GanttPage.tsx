/**
 * @file GanttPage.tsx
 * @description Pagina con vista Gantt interattiva per i progetti, implementata con la libreria @svar-widgets/react-gantt.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import SearchableSelect from '../components/SearchableSelect';
import Gantt from '@svar-widgets/react-gantt';

type ZoomLevel = 'month' | 'quarter' | 'year';
type SortDirection = 'ascending' | 'descending';

const GanttPage: React.FC = () => {
    const { projects, clients } = useEntitiesContext();
    const [zoom, setZoom] = useState<ZoomLevel>('month');
    const [filters, setFilters] = useState({ name: '', clientId: '' });
    const [sortDirection, setSortDirection] = useState<SortDirection>('ascending');

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFilterSelectChange = (name: string, value: string) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', clientId: '' });
    };

    const toggleSortDirection = () => {
        setSortDirection(prev => (prev === 'ascending' ? 'descending' : 'ascending'));
    };

    const clientMap = useMemo(
        () => new Map(clients.map(c => [c.id!, c.name])),
        [clients]
    );

    const sortedAndFilteredProjects = useMemo(() => {
        const filtered = projects.filter(project => {
            const nameMatch = project.name
                .toLowerCase()
                .includes(filters.name.toLowerCase());
            const clientMatch = filters.clientId
                ? project.clientId === filters.clientId
                : true;
            return nameMatch && clientMatch;
        });

        return [...filtered].sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (nameA < nameB)
                return sortDirection === 'ascending' ? -1 : 1;
            if (nameA > nameB)
                return sortDirection === 'ascending' ? 1 : -1;
            return 0;
        });
    }, [projects, filters, sortDirection]);

    const tasksForGantt = useMemo(() => {
        return sortedAndFilteredProjects
            .filter(p => p.startDate && p.endDate)
            .map(project => ({
                id: project.id!,
                name: project.name,
                start: new Date(project.startDate!),
                end: new Date(project.endDate!),
                type: 'project' as const,
                // Aggiungiamo una descrizione per il tooltip
                description: `${clientMap.get(project.clientId!)}`,
            }));
    }, [sortedAndFilteredProjects, clientMap]);

    const clientOptions = useMemo(
        () =>
            clients
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(c => ({ value: c.id!, label: c.name })),
        [clients]
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header e controlli */}
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                        Gantt Progetti
                    </h1>
                    <div className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                        {(['month', 'quarter', 'year'] as ZoomLevel[]).map(level => (
                            <button
                                key={level}
                                onClick={() => setZoom(level)}
                                className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${
                                    zoom === level
                                        ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow'
                                        : 'text-gray-600 dark:text-gray-300'
                                }`}
                            >
                                {level === 'month'
                                    ? 'Mese'
                                    : level === 'quarter'
                                    ? 'Trim.'
                                    : 'Anno'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow relative z-20">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <input
                            type="text"
                            name="name"
                            value={filters.name}
                            onChange={handleFilterChange}
                            className="w-full form-input"
                            placeholder="Cerca per progetto..."
                        />
                        <SearchableSelect
                            name="clientId"
                            value={filters.clientId}
                            onChange={handleFilterSelectChange}
                            options={clientOptions}
                            placeholder="Tutti i clienti"
                        />
                        <button
                            onClick={resetFilters}
                            className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Corpo Gantt */}
            <div className="flex-grow mt-4 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                 {tasksForGantt.length > 0 ? (
                    <div className="p-4">
                        <Gantt
                            tasks={tasksForGantt}
                            viewMode={zoom}
                            listCellWidth="320px"
                            ganttHeight={600}
                            columnWidth={zoom === 'month' ? 100 : zoom === 'quarter' ? 150 : 200}
                            locale="it-IT"
                            todayColor="rgba(239, 68, 68, 0.5)"
                        />
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                        Nessun progetto trovato per i filtri correnti o nessun progetto con date valide.
                    </div>
                )}
            </div>

            <style>{`
                .form-input, .form-select {
                    display: block;
                    width: 100%;
                    border-radius: 0.375rem;
                    border: 1px solid #D1D5DB;
                    background-color: #FFFFFF;
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                }
                .dark .form-input, .dark .form-select {
                    border-color: #4B5563;
                    background-color: #374151;
                    color: #F9FAFB;
                }
                /* Stili per sovrascrivere il tema di default di react-gantt se necessario */
                .gantt-container {
                    font-family: 'Manrope', sans-serif;
                }
                .gantt-container .bar-wrapper {
                    background-color: var(--color-primary-container);
                    border: 1px solid var(--color-primary);
                }
                 .gantt-container .bar-progress {
                    background-color: var(--color-primary);
                 }
                .grid-header, .calendar-header {
                    background: var(--color-surface-container-low) !important;
                }
                 .grid-row, .calendar-row {
                     background: var(--color-surface) !important;
                 }
                 .grid-row:nth-child(even), .calendar-row:nth-child(even) {
                      background: var(--color-surface-container-low) !important;
                 }
            `}</style>
        </div>
    );
};

export default GanttPage;
