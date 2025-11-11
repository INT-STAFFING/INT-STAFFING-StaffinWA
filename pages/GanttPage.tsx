/**
 * @file GanttPage.tsx
 * @description Pagina con vista Gantt interattiva per i progetti, implementata con la libreria @svar-widgets/react-gantt.
 */

import React, { useState, useMemo } from 'react';
import { Gantt, Task, ViewMode as GanttViewMode } from '@svar-widgets/react-gantt';
import { useEntitiesContext } from '../context/AppContext';
import { Resource } from '../types';
import SearchableSelect from '../components/SearchableSelect';

// Mappa la nostra modalità di visualizzazione locale a quella della libreria Gantt
type ViewMode = 'day' | 'week' | 'month';
const viewModeMap: Record<ViewMode, GanttViewMode> = {
    day: 'Day',
    week: 'Week',
    month: 'Month',
};

const GanttPage: React.FC = () => {
    const { projects, assignments, resources, clients } = useEntitiesContext();
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
    const [filters, setFilters] = useState({ name: '', clientId: '' });
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFilterSelectChange = (name: string, value: string) => {
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ name: '', clientId: '' });
    };

    const handleExpanderClick = (task: Task) => {
        if (task.type === 'project') {
            const projectId = task.id.replace('p_', '');
            setExpandedProjects(prev => {
                const newSet = new Set(prev);
                if (newSet.has(projectId)) {
                    newSet.delete(projectId);
                } else {
                    newSet.add(projectId);
                }
                return newSet;
            });
        }
    };

    const tasks: Task[] = useMemo(() => {
        const filtered = projects.filter(project =>
            project.name.toLowerCase().includes(filters.name.toLowerCase()) &&
            (!filters.clientId || project.clientId === filters.clientId) &&
            project.startDate && project.endDate
        );

        const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

        const ganttTasks: Task[] = [];
        sorted.forEach(project => {
            ganttTasks.push({
                id: `p_${project.id}`,
                name: project.name,
                type: 'project',
                start: new Date(project.startDate!),
                end: new Date(project.endDate!),
                progress: 0, // Nessun dato sulla progressione disponibile
                isDisabled: true, // La barra del progetto non è interattiva
                hideChildren: !expandedProjects.has(project.id!),
            });

            const projectResources = assignments
                .filter(a => a.projectId === project.id)
                .map(a => resources.find(r => r.id === a.resourceId))
                .filter(Boolean) as Resource[];
            
            projectResources.forEach(resource => {
                ganttTasks.push({
                    id: `r_${project.id}_${resource.id}`,
                    name: resource.name,
                    type: 'task',
                    start: new Date(project.startDate!),
                    end: new Date(project.endDate!),
                    progress: 0,
                    project: `p_${project.id}`,
                    isDisabled: true,
                });
            });
        });

        return ganttTasks;
    }, [projects, assignments, resources, filters, expandedProjects]);

    const clientOptions = useMemo(
        () => clients.sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })),
        [clients]
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header e controlli */}
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl font-bold text-on-background">Gantt Progetti</h1>
                    <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                        {(['day', 'week', 'month'] as ViewMode[]).map(level => (
                            <button
                                key={level}
                                onClick={() => setViewMode(level)}
                                className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
                                    viewMode === level
                                        ? 'bg-secondary-container text-on-secondary-container shadow'
                                        : 'text-on-surface-variant'
                                }`}
                            >
                                {level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-4 p-4 bg-surface-container rounded-2xl shadow relative z-20">
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
                            className="px-4 py-2 bg-surface-container-high text-on-surface-variant rounded-full hover:bg-surface-container-highest w-full"
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* Corpo Gantt */}
            <div className="flex-grow mt-4 rounded-2xl shadow overflow-hidden">
                {tasks.length > 0 ? (
                    <Gantt
                        data={tasks}
                        viewMode={viewModeMap[viewMode]}
                        onExpanderClick={handleExpanderClick}
                        columns={[{ name: 'name', title: 'Progetto / Risorsa', width: 320 }]}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full bg-surface-container text-on-surface-variant">
                        Nessun progetto trovato con i filtri correnti o nessun progetto con date valide.
                    </div>
                )}
            </div>

            {/* Override stili per il theming */}
            <style>{`
                :root {
                    --gantt-background-color: var(--color-surface);
                    --gantt-header-background-color: var(--color-surface-container);
                    --gantt-column-background-color: var(--color-surface-container-low);
                    --gantt-border-color: var(--color-outline-variant);
                    --gantt-text-color: var(--color-on-surface);
                    --gantt-text-secondary-color: var(--color-on-surface-variant);
                    --gantt-bar-background-color: var(--color-secondary);
                    --gantt-bar-background-progress-color: var(--color-secondary-container);
                    --gantt-bar-project-background-color: var(--color-primary);
                    --gantt-bar-project-background-progress-color: var(--color-primary-container);
                    --gantt-bar-milestone-background-color: var(--color-tertiary);
                    --gantt-today-color: var(--color-error);
                    --gantt-expander-color: var(--color-primary);
                }
                .form-input {
                    display: block; width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-outline);
                    background-color: var(--color-surface-container-highest); padding: 0.5rem 0.75rem; font-size: 0.875rem;
                }
            `}</style>
        </div>
    );
};

export default GanttPage;
