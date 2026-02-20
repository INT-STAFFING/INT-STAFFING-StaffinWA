
/**
 * @file GanttPage.tsx
 * @description Pagina con vista Gantt interattiva per i progetti, con legenda e righe di riepilogo.
 */

import React, { useState, useMemo } from 'react';
import { useResourcesContext } from '../context/ResourcesContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { Resource } from '../types';
import SearchableSelect from '../components/SearchableSelect';
import ExportButton from '../components/ExportButton';
import { formatDateFull } from '../utils/dateUtils';

type ZoomLevel = 'month' | 'quarter' | 'year';
type SortDirection = 'ascending' | 'descending';

// Colonne temporali più strette ma leggibili
const GANTT_COLUMN_WIDTH = 64; // ~64px per mese/trimestre/anno
const LEFT_COLUMN_WIDTH = 320; // Larghezza della colonna dei progetti

interface TimeScaleSegment {
    label: string;
    start: Date;
    end: Date;
}

const GanttPage: React.FC = () => {
    const { projects, assignments, clients } = useProjectsContext();
    const { resources } = useResourcesContext();
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
        return projectAssignments
            .map(a => resources.find(r => r.id === a.resourceId))
            .filter(Boolean) as Resource[];
    };

    const clientMap = useMemo(
        () => new Map(clients.map(c => [c.id!, c.name])),
        [clients]
    );

    const getGanttBarClass = (status: string | null): string => {
        switch (status) {
            case 'In corso':
                return 'bg-primary text-on-primary';
            case 'Completato':
                return 'bg-tertiary-container text-on-tertiary-container';
            case 'In pausa':
                return 'bg-yellow-container text-on-yellow-container';
            default:
                return 'bg-surface-variant text-on-surface-variant';
        }
    };

    // Scala temporale (segmenti) calcolata su TUTTI i progetti, estesa per includere sempre "oggi"
    const { timeScale, ganttStartDate, totalDays } = useMemo(() => {
        const validProjects = projects.filter(p => p.startDate && p.endDate);
        const today = new Date();

        const buildScale = (
            minDate: Date,
            maxDate: Date,
            zoomLevel: ZoomLevel
        ): { scale: TimeScaleSegment[]; days: number } => {
            const scale: TimeScaleSegment[] = [];

            const getHeader = (date: Date) => {
                if (zoomLevel === 'month') {
                    return date.toLocaleString('it-IT', {
                        month: 'short',
                        year: '2-digit',
                        timeZone: 'UTC' // Important: Format date in UTC
                    });
                }
                if (zoomLevel === 'quarter') {
                    return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
                }
                return date.getUTCFullYear().toString();
            };

            const incrementDate = (date: Date) => {
                if (zoomLevel === 'month') date.setUTCMonth(date.getUTCMonth() + 1);
                else if (zoomLevel === 'quarter') date.setUTCMonth(date.getUTCMonth() + 3);
                else date.setUTCFullYear(date.getUTCFullYear() + 1);
            };

            let currentStart = new Date(minDate);
            while (currentStart <= maxDate) {
                const currentEnd = new Date(currentStart);
                incrementDate(currentEnd);

                scale.push({
                    label: getHeader(currentStart),
                    start: new Date(currentStart),
                    end: new Date(currentEnd),
                });

                currentStart = currentEnd;
            }

            const lastEnd = scale.length > 0 ? scale[scale.length - 1].end : minDate;
            const days =
                (lastEnd.getTime() - minDate.getTime()) / (1000 * 3600 * 24) + 1;

            return { scale, days };
        };

        if (validProjects.length === 0) {
            const startOfYear = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
            const endOfYear = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
            const { scale, days } = buildScale(startOfYear, endOfYear, 'month');
            return {
                timeScale: scale,
                ganttStartDate: startOfYear,
                totalDays: days,
            };
        }

        const allDates = validProjects.flatMap(p => [
            new Date(p.startDate!),
            new Date(p.endDate!),
        ]);
        let minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        let maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));

        // allineo a inizio mese / margine usando UTC
        minDate = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
        maxDate = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 2, 0)); // margine

        // estendo per includere sempre "oggi"
        const todayUTC = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

        if (todayUTC.getTime() < minDate.getTime()) {
            const extendedMin = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() - 1, 1));
            if (extendedMin < minDate) {
                minDate = extendedMin;
            }
        }
        if (todayUTC.getTime() > maxDate.getTime()) {
            const extendedMax = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() + 2, 0));
            if (extendedMax > maxDate) {
                maxDate = extendedMax;
            }
        }

        const { scale, days } = buildScale(minDate, maxDate, zoom);

        return { timeScale: scale, ganttStartDate: minDate, totalDays: days };
    }, [projects, zoom]);

    const ganttChartWidth = timeScale.length * GANTT_COLUMN_WIDTH;
    const pixelsPerDay = totalDays > 0 ? ganttChartWidth / totalDays : 0;

    const getBarPosition = (startDateStr: string | null, endDateStr: string | null) => {
        if (!startDateStr || !endDateStr || totalDays <= 0) {
            return { left: 0, width: 0 };
        }
        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        // Use getTime for safe numeric operation
        const diffStart = (start.getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
        const duration = (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1; // inclusive

        return {
            left: Math.max(0, diffStart * pixelsPerDay),
            width: Math.max(0, duration * pixelsPerDay)
        };
    };

    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);

    const filteredProjects = useMemo(() => {
        return projects
            .filter(p => {
                const nameMatch = p.name.toLowerCase().includes(filters.name.toLowerCase());
                const clientMatch = !filters.clientId || p.clientId === filters.clientId;
                return nameMatch && clientMatch;
            })
            .sort((a, b) => {
                const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                return sortDirection === 'ascending' ? dateA - dateB : dateB - dateA;
            });
    }, [projects, filters, sortDirection]);

    const exportData = useMemo(() => {
        return filteredProjects.map(p => ({
            'Nome Progetto': p.name,
            'Cliente': clientMap.get(p.clientId || '') || 'N/A',
            'Stato': p.status || '',
            'Data Inizio': formatDateFull(p.startDate),
            'Data Fine': formatDateFull(p.endDate)
        }));
    }, [filteredProjects, clientMap]);

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-2xl shadow border border-outline-variant">
                <h1 className="text-2xl sm:text-3xl font-bold text-on-surface">Gantt di Progetto</h1>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                    <div className="flex items-center bg-surface-container p-1 rounded-full">
                        {(['month', 'quarter', 'year'] as ZoomLevel[]).map((level) => (
                            <button
                                key={level}
                                onClick={() => setZoom(level)}
                                className={`px-3 py-1 text-sm font-medium rounded-full capitalize transition-all ${
                                    zoom === level ? 'bg-surface text-primary shadow' : 'text-on-surface-variant hover:text-on-surface'
                                }`}
                            >
                                {level === 'month' ? 'Mese' : level === 'quarter' ? 'Trimestre' : 'Anno'}
                            </button>
                        ))}
                    </div>
                     <ExportButton data={exportData} title="Gantt Progetti" />
                </div>
            </div>

            {/* Filters */}
            <div className="bg-surface rounded-2xl shadow p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                    <input 
                        type="text" 
                        name="name" 
                        value={filters.name} 
                        onChange={handleFilterChange} 
                        placeholder="Cerca progetto..." 
                        className="form-input w-full" 
                    />
                </div>
                <div className="md:col-span-1">
                    <SearchableSelect 
                        name="clientId" 
                        value={filters.clientId} 
                        onChange={handleFilterSelectChange} 
                        options={clientOptions} 
                        placeholder="Tutti i Clienti" 
                    />
                </div>
                <div className="flex gap-2">
                    <button onClick={toggleSortDirection} className="px-4 py-2 bg-surface-container text-on-surface rounded-full hover:bg-surface-container-high border border-outline-variant flex items-center gap-2" title="Ordina per Data Inizio">
                        <span className="material-symbols-outlined">{sortDirection === 'ascending' ? 'arrow_upward' : 'arrow_downward'}</span> Data
                    </button>
                    <button onClick={resetFilters} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full hover:opacity-90">Reset</button>
                </div>
            </div>

            {/* Gantt Chart Container */}
            <div className="flex-grow bg-surface rounded-2xl shadow border border-outline-variant overflow-hidden flex flex-col relative">
                <div className="flex-grow overflow-auto relative">
                    <div style={{ minWidth: LEFT_COLUMN_WIDTH + ganttChartWidth, position: 'relative' }}>
                        
                        {/* Header Row */}
                        <div className="sticky top-0 z-20 flex bg-surface-container-low border-b border-outline-variant h-10">
                            <div className="sticky left-0 z-30 w-[320px] min-w-[320px] bg-surface-container-low border-r border-outline-variant px-4 flex items-center font-bold text-sm text-on-surface-variant uppercase tracking-wider">
                                Progetto
                            </div>
                            {timeScale.map((segment, index) => (
                                <div 
                                    key={index} 
                                    className="flex items-center justify-center text-xs font-medium text-on-surface-variant border-r border-outline-variant/50"
                                    style={{ width: GANTT_COLUMN_WIDTH }}
                                >
                                    {segment.label}
                                </div>
                            ))}
                        </div>

                        {/* Project Rows */}
                        <div className="divide-y divide-outline-variant">
                            {filteredProjects.map(project => {
                                const { left, width } = getBarPosition(project.startDate, project.endDate);
                                const isExpanded = expandedProjects.has(project.id!);
                                const resources = getProjectResources(project.id!);

                                return (
                                    <React.Fragment key={project.id}>
                                        <div className="flex group hover:bg-surface-container-low transition-colors h-12 relative">
                                            {/* Left Column (Sticky) */}
                                            <div className="sticky left-0 z-10 w-[320px] min-w-[320px] bg-surface group-hover:bg-surface-container-low border-r border-outline-variant px-4 flex items-center justify-between">
                                                <div className="truncate font-medium text-sm text-on-surface" title={project.name}>
                                                    {project.name}
                                                </div>
                                                {resources.length > 0 && (
                                                    <button onClick={() => toggleProjectExpansion(project.id!)} className="p-1 rounded hover:bg-surface-variant text-on-surface-variant">
                                                        <span className={`material-symbols-outlined text-base transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Gantt Bar Area */}
                                            <div className="relative flex-grow h-full bg-surface-container-lowest/20">
                                                {/* Vertical Grid Lines */}
                                                {timeScale.map((_, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className="absolute top-0 bottom-0 border-r border-outline-variant/20" 
                                                        style={{ left: (idx + 1) * GANTT_COLUMN_WIDTH }} 
                                                    />
                                                ))}

                                                {/* Today Line */}
                                                {(() => {
                                                    const todayPos = getBarPosition(new Date().toISOString(), new Date().toISOString());
                                                    if (todayPos.left > 0) {
                                                        return (
                                                            <div 
                                                                className="absolute top-0 bottom-0 border-l-2 border-error z-0 pointer-events-none opacity-50"
                                                                style={{ left: todayPos.left }}
                                                                title="Oggi"
                                                            />
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                {/* The Bar */}
                                                {width > 0 && (
                                                    <div
                                                        className={`absolute top-2 h-8 rounded-md shadow-sm flex items-center px-2 text-xs font-bold whitespace-nowrap overflow-hidden ${getGanttBarClass(project.status)}`}
                                                        style={{ left, width }}
                                                        title={`${project.name} (${formatDateFull(project.startDate)} - ${formatDateFull(project.endDate)})`}
                                                    >
                                                        {width > 60 && project.name}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded Resources */}
                                        {isExpanded && resources.map(res => (
                                            <div key={`${project.id}-${res.id}`} className="flex bg-surface-container-lowest/50 h-10 border-b border-outline-variant/30">
                                                 <div className="sticky left-0 z-10 w-[320px] min-w-[320px] bg-surface-container-lowest/50 border-r border-outline-variant px-4 pl-10 flex items-center">
                                                    <div className="text-xs text-on-surface-variant flex items-center gap-2">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                                                        {res.name}
                                                    </div>
                                                 </div>
                                                 <div className="relative flex-grow h-full">
                                                     {/* Optional: Show resource allocation bars if data allows */}
                                                 </div>
                                            </div>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GanttPage;
