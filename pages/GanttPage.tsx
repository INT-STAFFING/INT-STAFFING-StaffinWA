/**
 * @file GanttPage.tsx
 * @description Pagina con vista Gantt interattiva per i progetti.
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource } from '../types';
import SearchableSelect from '../components/SearchableSelect';

type ZoomLevel = 'month' | 'quarter' | 'year';

const GANTT_COLUMN_WIDTH = 80; // Larghezza in pixel per ogni colonna della timeline

const GanttPage: React.FC = () => {
    const { projects, assignments, resources, clients } = useStaffingContext();
    const [zoom, setZoom] = useState<ZoomLevel>('month');
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

    const toggleProjectExpansion = (projectId: string) => {
        setExpandedProjects(prev => {
            const newSet = new Set(prev);
            if (newSet.has(projectId)) {
                newSet.delete(projectId);
            } else {
                newSet.add(projectId);
            }
            return newSet;
        });
    };

    const getProjectResources = (projectId: string): Resource[] => {
        const projectAssignments = assignments.filter(a => a.projectId === projectId);
        return projectAssignments.map(a => resources.find(r => r.id === a.resourceId)).filter(Boolean) as Resource[];
    };
    
    // La scala temporale viene calcolata su TUTTI i progetti, non solo quelli filtrati,
    // per mantenere una timeline consistente.
    const { timeScale, ganttStartDate, totalDays } = useMemo(() => {
        const validProjects = projects.filter(p => p.startDate && p.endDate);
        if (validProjects.length === 0) {
            const now = new Date();
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            return { timeScale: Array.from({length: 12}).map((_, i) => ({ label: new Date(now.getFullYear(), i, 1).toLocaleString('it-IT', { month: 'short', year: 'numeric' }), date: new Date(now.getFullYear(), i, 1)})), ganttStartDate: startOfYear, totalDays: 365 };
        }

        const allDates = validProjects.flatMap(p => [new Date(p.startDate!), new Date(p.endDate!)]);
        let minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        let maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

        minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0); // Aggiunge un po' di margine

        const scale = [];
        let currentDate = new Date(minDate);

        const getHeader = (date: Date) => {
            if (zoom === 'month') return date.toLocaleString('it-IT', { month: 'short', year: '2-digit' });
            if (zoom === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
            return date.getFullYear().toString();
        };

        const incrementDate = (date: Date) => {
            if (zoom === 'month') date.setMonth(date.getMonth() + 1);
            else if (zoom === 'quarter') date.setMonth(date.getMonth() + 3);
            else date.setFullYear(date.getFullYear() + 1);
        };
        
        while (currentDate <= maxDate) {
            scale.push({ label: getHeader(currentDate), date: new Date(currentDate) });
            incrementDate(currentDate);
        }
        
        const days = (maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24);

        return { timeScale: scale, ganttStartDate: minDate, totalDays: days };
    }, [projects, zoom]);
    
    const getBarPosition = (startDateStr: string | null, endDateStr: string | null) => {
        if (!startDateStr || !endDateStr) return { left: '0%', width: '0%' };
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        const startOffset = (startDate.getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
        const duration = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

        const left = (startOffset / totalDays) * 100;
        const width = (duration / totalDays) * 100;
        
        return { left: `${left}%`, width: `${width}%` };
    };

    const todayPosition = useMemo(() => {
         if (totalDays <= 0) return -1;
         const startOffset = (new Date().getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
         return (startOffset / totalDays) * 100;
    }, [ganttStartDate, totalDays]);

    const sortedAndFilteredProjects = useMemo(() => {
        const filtered = projects.filter(project => {
            const nameMatch = project.name.toLowerCase().includes(filters.name.toLowerCase());
            const clientMatch = filters.clientId ? project.clientId === filters.clientId : true;
            return nameMatch && clientMatch;
        });

        return [...filtered].sort((a,b) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
    }, [projects, filters]);
    
    const clientOptions = useMemo(() => clients.sort((a,b)=>a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Gantt Progetti</h1>
                 <div className="flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                    {(['month', 'quarter', 'year'] as ZoomLevel[]).map(level => (
                        <button key={level} onClick={() => setZoom(level)}
                            className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${zoom === level ? 'bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                            {level === 'month' ? 'Mese' : level === 'quarter' ? 'Trim.' : 'Anno'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per progetto..."/>
                    <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti"/>
                    <button onClick={resetFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
                <div style={{ minWidth: `calc(300px + ${timeScale.length * GANTT_COLUMN_WIDTH}px)` }}>
                    {/* Header */}
                    <div className="grid grid-cols-[300px_1fr] sticky top-0 z-20 bg-gray-50 dark:bg-gray-700 h-16">
                        <div className="p-3 font-semibold border-r border-b border-gray-200 dark:border-gray-700 sticky left-0 bg-gray-50 dark:bg-gray-700 z-30 flex items-center">
                            Progetto
                        </div>
                        <div className="relative border-b border-gray-200 dark:border-gray-700">
                            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${timeScale.length}, ${GANTT_COLUMN_WIDTH}px)` }}>
                                {timeScale.map((ts, i) => (
                                    <div key={i} className="flex items-center justify-center p-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                                        <span>{ts.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="relative">
                        {sortedAndFilteredProjects.map(project => {
                            const projectResources = getProjectResources(project.id!);
                            const isExpanded = expandedProjects.has(project.id!);
                            const barStyle = getBarPosition(project.startDate, project.endDate);
                            
                            return (
                                <div key={project.id} className="grid grid-cols-[300px_1fr] border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
                                    <div className="p-3 border-r border-gray-200 dark:border-gray-700 sticky left-0 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 z-10">
                                        <button onClick={() => toggleProjectExpansion(project.id!)} className="flex items-center w-full text-left">
                                            <svg className={`w-4 h-4 mr-2 flex-shrink-0 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                            <span className="font-medium text-sm text-gray-800 dark:text-white truncate">{project.name}</span>
                                        </button>
                                        {isExpanded && (
                                            <ul className="mt-2 pl-6 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                {projectResources.length > 0 ? projectResources.map(r => <li key={r.id}>{r.name}</li>) : <li>Nessuna risorsa assegnata</li>}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="relative">
                                        <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${timeScale.length}, ${GANTT_COLUMN_WIDTH}px)` }}>
                                            {Array.from({ length: timeScale.length }).map((_, i) => (
                                                <div key={i} className={`h-full border-r border-gray-200 dark:border-gray-700 ${isExpanded ? 'min-h-[60px]' : 'min-h-[48px]'}`}></div>
                                            ))}
                                        </div>
                                        {project.startDate && project.endDate && (
                                            <div className="absolute h-3/5 top-1/2 -translate-y-1/2 rounded-md bg-blue-500 hover:bg-blue-600 group/bar" style={barStyle}>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                                    {new Date(project.startDate).toLocaleDateString('it-IT')} - {new Date(project.endDate).toLocaleDateString('it-IT')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        {todayPosition >= 0 && todayPosition <= 100 && (
                            <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: `calc(300px + ${todayPosition}%)` }} title="Oggi"></div>
                        )}
                    </div>
                </div>
            </div>
             <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default GanttPage;