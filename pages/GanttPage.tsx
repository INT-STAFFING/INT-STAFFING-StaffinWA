/**
 * @file GanttPage.tsx
 * @description Pagina con vista Gantt interattiva per i progetti.
 */

import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { Resource } from '../types';

type ZoomLevel = 'month' | 'quarter' | 'year';

const GanttPage: React.FC = () => {
    const { projects, assignments, resources } = useStaffingContext();
    const [zoom, setZoom] = useState<ZoomLevel>('month');
    const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

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
    
    const { timeScale, gridColumns, ganttStartDate, totalDays } = useMemo(() => {
        const validProjects = projects.filter(p => p.startDate && p.endDate);
        if (validProjects.length === 0) {
            const now = new Date();
            return { timeScale: [], gridColumns: 12, ganttStartDate: new Date(now.getFullYear(), 0, 1), totalDays: 365 };
        }

        const allDates = validProjects.flatMap(p => [new Date(p.startDate!), new Date(p.endDate!)]);
        let minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        let maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

        minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 1, 0);

        const timeScale = [];
        let currentDate = new Date(minDate);

        const getHeader = (date: Date) => {
            if (zoom === 'month') return date.toLocaleString('it-IT', { month: 'short', year: 'numeric' });
            if (zoom === 'quarter') return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
            return date.getFullYear().toString();
        };

        const incrementDate = (date: Date) => {
            if (zoom === 'month') date.setMonth(date.getMonth() + 1);
            else if (zoom === 'quarter') date.setMonth(date.getMonth() + 3);
            else date.setFullYear(date.getFullYear() + 1);
        };
        
        while (currentDate <= maxDate) {
            timeScale.push({ label: getHeader(currentDate), date: new Date(currentDate) });
            incrementDate(currentDate);
        }
        
        const totalDays = (maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24);

        return { timeScale, gridColumns: timeScale.length, ganttStartDate: minDate, totalDays };
    }, [projects, zoom]);
    
    const getBarPosition = (startDateStr: string | null, endDateStr: string | null) => {
        if (!startDateStr || !endDateStr) return { gridColumnStart: 1, gridColumnEnd: 2 };
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        const startOffset = (startDate.getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
        const duration = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);

        const left = (startOffset / totalDays) * 100;
        const width = (duration / totalDays) * 100;
        
        return { left: `${left}%`, width: `${width}%` };
    };

    const todayPosition = useMemo(() => {
         const startOffset = (new Date().getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
         return (startOffset / totalDays) * 100;
    }, [ganttStartDate, totalDays]);

    const sortedProjects = useMemo(() => {
        return [...projects].sort((a,b) => {
            if (!a.startDate) return 1;
            if (!b.startDate) return -1;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });
    }, [projects]);

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

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                 <div className="grid grid-cols-[300px_1fr] border-b border-gray-200 dark:border-gray-700">
                    <div className="p-3 font-semibold border-r border-gray-200 dark:border-gray-700">Progetto</div>
                    <div className="relative grid" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
                        {timeScale.map((ts, i) => (
                            <div key={i} className="p-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 border-r border-gray-200 dark:border-gray-700">
                                {ts.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="max-h-[70vh] overflow-y-auto">
                    {sortedProjects.map(project => {
                        const projectResources = getProjectResources(project.id!);
                        const isExpanded = expandedProjects.has(project.id!);
                        const barStyle = getBarPosition(project.startDate, project.endDate);
                        
                        return (
                            <div key={project.id} className="grid grid-cols-[300px_1fr] border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <div className="p-3 border-r border-gray-200 dark:border-gray-700">
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
                                <div className="relative grid" style={{ gridTemplateColumns: `repeat(${gridColumns}, 1fr)` }}>
                                    {Array.from({ length: gridColumns }).map((_, i) => (
                                        <div key={i} className="h-full border-r border-gray-200 dark:border-gray-700"></div>
                                    ))}
                                    {project.startDate && project.endDate && (
                                         <div className="absolute h-3/5 top-1/2 -translate-y-1/2 rounded-md bg-blue-500 hover:bg-blue-600 group" style={barStyle}>
                                             <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                                 {new Date(project.startDate).toLocaleDateString()} - {new Date(project.endDate).toLocaleDateString()}
                                            </div>
                                         </div>
                                    )}
                                    {todayPosition >= 0 && todayPosition <= 100 && (
                                        <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10" style={{ left: `${todayPosition}%` }} title="Oggi"></div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

export default GanttPage;