/**
 * @file GanttPage.tsx
 * @description Pagina con vista Gantt interattiva per i progetti.
 */

import React, { useState, useMemo } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Resource } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import { ArrowsUpDownIcon } from '../components/icons';

type ZoomLevel = 'month' | 'quarter' | 'year';
type SortDirection = 'ascending' | 'descending';

const GANTT_COLUMN_WIDTH = 80; // Larghezza in pixel per ogni colonna della timeline

const GanttPage: React.FC = () => {
    const { projects, assignments, resources, clients } = useEntitiesContext();
    const [zoom, setZoom] = useState<ZoomLevel>('month');
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
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
        
        const days = (maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24) + 1;

        return { timeScale: scale, ganttStartDate: minDate, totalDays: days };
    }, [projects, zoom]);

    const ganttChartWidth = timeScale.length * GANTT_COLUMN_WIDTH;
    const pixelsPerDay = totalDays > 0 ? ganttChartWidth / totalDays : 0;
    
    const getBarPosition = (startDateStr: string | null, endDateStr: string | null) => {
        if (!startDateStr || !endDateStr || totalDays <= 0) return { left: '0px', width: '0px' };
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        const startOffset = (startDate.getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
        const duration = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));

        const left = startOffset * pixelsPerDay;
        const width = duration * pixelsPerDay;
        
        return { left: `${left}px`, width: `${width}px` };
    };

    const todayPosition = useMemo(() => {
         if (totalDays <= 0) return -1;
         const startOffset = (new Date().getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
         return startOffset * pixelsPerDay;
    }, [ganttStartDate, totalDays, pixelsPerDay]);

    const sortedAndFilteredProjects = useMemo(() => {
        const filtered = projects.filter(project => {
            const nameMatch = project.name.toLowerCase().includes(filters.name.toLowerCase());
            const clientMatch = filters.clientId ? project.clientId === filters.clientId : true;
            return nameMatch && clientMatch;
        });

        return [...filtered].sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (nameA < nameB) return sortDirection === 'ascending' ? -1 : 1;
            if (nameA > nameB) return sortDirection === 'ascending' ? 1 : -1;
            return 0;
        });
    }, [projects, filters, sortDirection]);
    
    const clientOptions = useMemo(() => clients.sort((a,b)=>a.name.localeCompare(b.name)).map(c => ({ value: c.id!, label: c.name })), [clients]);

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl font-bold text-primary-dark dark:text-primary-light">Gantt Progetti</h1>
                    <div className="flex items-center space-x-1 bg-gray-200 dark:bg-white/5 p-1 rounded-md">
                        {(['month', 'quarter', 'year'] as ZoomLevel[]).map(level => (
                            <button key={level} onClick={() => setZoom(level)}
                                className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${zoom === level ? 'bg-primary-light dark:bg-primary-dark text-accent-teal shadow' : 'text-gray-600 dark:text-gray-300'}`}>
                                {level === 'month' ? 'Mese' : level === 'quarter' ? 'Trim.' : 'Anno'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-6 p-4 bg-primary-light dark:bg-primary-dark rounded-lg shadow relative z-30">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <input type="text" name="name" value={filters.name} onChange={handleFilterChange} className="w-full form-input" placeholder="Cerca per progetto..."/>
                        <SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterSelectChange} options={clientOptions} placeholder="Tutti i clienti"/>
                        <button onClick={resetFilters} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full md:w-auto">Reset</button>
                    </div>
                </div>
            </div>

            <div className="flex-grow overflow-auto bg-primary-light dark:bg-primary-dark rounded-lg shadow">
                <div className="relative" style={{ minWidth: `calc(300px + ${ganttChartWidth}px)` }}>
                    {/* Header */}
                    <div className="grid grid-cols-[300px_1fr] sticky top-0 z-20 bg-gray-50 dark:bg-white/5 h-16">
                        <div className="p-3 font-semibold border-r border-b border-gray-200 dark:border-white/20 sticky left-0 bg-gray-50 dark:bg-white/5 z-30 flex items-center">
                            <button onClick={toggleSortDirection} className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white">
                                <span>Progetto</span>
                                <ArrowsUpDownIcon className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                        <div className="relative border-b border-gray-200 dark:border-white/20">
                            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${timeScale.length}, ${GANTT_COLUMN_WIDTH}px)` }}>
                                {timeScale.map((ts, i) => (
                                    <div key={i} className="flex items-center justify-center p-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-white/20">
                                        <span>{ts.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div>
                        {sortedAndFilteredProjects.map(project => {
                            const projectResources = getProjectResources(project.id!);
                            const isExpanded = expandedProjects.has(project.id!);
                            const barStyle = getBarPosition(project.startDate, project.endDate);
                            
                            return (
                                <div key={project.id} className="grid grid-cols-[300px_1fr] border-b border-gray-200 dark:border-white/20 group">
                                    <div className="p-3 border-r border-gray-200 dark:border-white/20 sticky left-0 bg-primary-light dark:bg-primary-dark z-10 group-hover:bg-gray-50 dark:group-hover:bg-white/5">
                                        <button onClick={() => toggleProjectExpansion(project.id!)} className="flex items-center w-full text-left">
                                            <svg className={`w-4 h-4 mr-2 flex-shrink-0 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                            <span className="font-medium text-sm text-primary-dark dark:text-primary-light truncate">{project.name}</span>
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
                                                <div key={i} className={`h-full border-r border-gray-200 dark:border-white/20 ${isExpanded ? 'min-h-[60px]' : 'min-h-[48px]'}`}></div>
                                            ))}
                                        </div>
                                        {project.startDate && project.endDate && (
                                            <div className="absolute h-3/5 top-1/2 -translate-y-1/2 rounded-md bg-accent-teal hover:opacity-90 group/bar" style={barStyle}>
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                                    {new Date(project.startDate).toLocaleDateString('it-IT')} - {new Date(project.endDate).toLocaleDateString('it-IT')}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                     {/* Today Marker */}
                     {todayPosition >= 0 && todayPosition <= ganttChartWidth && (
                        <div className="absolute top-0 bottom-0 w-0.5 bg-accent-red z-5" style={{ left: `calc(300px + ${todayPosition}px)` }} title="Oggi"></div>
                    )}
                </div>
            </div>
             <style>{`
                .form-input, .form-select {
                    border-color: #D1D5DB; 
                    background-color: #FDFFFC;
                }
                .dark .form-input, .dark .form-select {
                    border-color: #4B5563;
                    background-color: #011627;
                    color: #FDFFFC;
                }
                .form-input:focus, .form-select:focus {
                    --tw-ring-color: #2EC4B6;
                    border-color: #2EC4B6;
                }
             `}</style>
        </div>
    );
};

export default GanttPage;