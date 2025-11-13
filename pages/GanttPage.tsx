/**
 * @file GanttPage.tsx
 * @description Pagina con vista Gantt interattiva per i progetti, con legenda e righe di riepilogo.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Resource } from '../types';
import SearchableSelect from '../components/SearchableSelect';

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
        return projectAssignments
            .map(a => resources.find(r => r.id === a.resourceId))
            .filter(Boolean) as Resource[];
    };

    const clientMap = useMemo(
        () => new Map(clients.map(c => [c.id!, c.name])),
        [clients]
    );

    // Scala temporale (segmenti) calcolata su TUTTI i progetti, estesa per includere sempre "oggi"
    const { timeScale, ganttStartDate, totalDays } = useMemo(() => {
        const validProjects = projects.filter(p => p.startDate && p.endDate);

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
                    });
                }
                if (zoomLevel === 'quarter') {
                    return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
                }
                return date.getFullYear().toString();
            };

            const incrementDate = (date: Date) => {
                if (zoomLevel === 'month') date.setMonth(date.getMonth() + 1);
                else if (zoomLevel === 'quarter') date.setMonth(date.getMonth() + 3);
                else date.setFullYear(date.getFullYear() + 1);
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

        const today = new Date();

        if (validProjects.length === 0) {
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            const endOfYear = new Date(today.getFullYear(), 11, 31);
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

        // allineo a inizio mese / margine
        minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0); // margine

        // estendo per includere sempre "oggi"
        if (today < minDate) {
            const extendedMin = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            if (extendedMin < minDate) {
                minDate = extendedMin;
            }
        }
        if (today > maxDate) {
            const extendedMax = new Date(today.getFullYear(), today.getMonth() + 2, 0);
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
            return { left: '0px', width: '0px' };
        }

        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);

        const startOffset =
            (startDate.getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
        const duration = Math.max(
            1,
            (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
        );

        const left = startOffset * pixelsPerDay;
        const width = duration * pixelsPerDay;

        return { left: `${left}px`, width: `${width}px` };
    };

    const todayPosition = useMemo(() => {
        if (totalDays <= 0) return -1;
        const startOffset =
            (new Date().getTime() - ganttStartDate.getTime()) / (1000 * 3600 * 24);
        return startOffset * pixelsPerDay;
    }, [ganttStartDate, totalDays, pixelsPerDay]);

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

    // Totale progetti attivi per ciascun segmento (usato per la riga di riepilogo per anno)
    const segmentProjectCounts = useMemo(() => {
        if (sortedAndFilteredProjects.length === 0) {
            return timeScale.map(() => 0);
        }

        return timeScale.map(seg => {
            let count = 0;
            for (const project of sortedAndFilteredProjects) {
                if (!project.startDate || !project.endDate) continue;
                const s = new Date(project.startDate);
                const e = new Date(project.endDate);
                if (e >= seg.start && s < seg.end) {
                    count++;
                }
            }
            return count;
        });
    }, [timeScale, sortedAndFilteredProjects]);

    // Totale progetti per cliente (usato come riepilogo quando non si è in vista "Anno")
    const totalByClient = useMemo(() => {
        const counts = new Map<string, number>();

        for (const project of sortedAndFilteredProjects) {
            const key = project.clientId || 'NO_CLIENT';
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        return Array.from(counts.entries()).map(([clientId, count]) => ({
            clientName: clientId === 'NO_CLIENT'
                ? 'Cliente non assegnato'
                : clientMap.get(clientId) ?? 'Cliente non assegnato',
            count,
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

    const timeGridStyle = useMemo(
        () => ({
            gridTemplateColumns: `repeat(${timeScale.length}, ${GANTT_COLUMN_WIDTH}px)`,
        }),
        [timeScale.length]
    );

    // Contenitore scrollabile solo per la "tabella" Gantt (orizzontale + verticale)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    // All'avvio (e al cambio scala) il primo mese visibile è il mese corrente
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        if (timeScale.length === 0) return;

        const today = new Date();

        // Trovo il segmento che contiene "oggi"
        let todaySegmentIndex = timeScale.findIndex(
            seg => today >= seg.start && today < seg.end
        );

        if (todaySegmentIndex < 0) {
            // fallback: uso la posizione continua in pixel
            if (todayPosition >= 0 && GANTT_COLUMN_WIDTH > 0) {
                todaySegmentIndex = Math.floor(todayPosition / GANTT_COLUMN_WIDTH);
            } else {
                todaySegmentIndex = 0;
            }
        }

        // Scroll in modo che la colonna del mese corrente sia la prima visibile a destra del nome progetto
        const desiredScrollLeft = Math.max(0, todaySegmentIndex * GANTT_COLUMN_WIDTH);

        // Limite massimo di scroll (timeline)
        const containerWidth = container.clientWidth;
        const maxScrollLeft = Math.max(
            0,
            ganttChartWidth - Math.max(0, containerWidth - LEFT_COLUMN_WIDTH)
        );

        container.scrollLeft = Math.min(desiredScrollLeft, maxScrollLeft);
    }, [timeScale, todayPosition, ganttChartWidth]);

    return (
        <div className="flex flex-col h-full">
            {/* Header e controlli */}
            <div className="flex-shrink-0">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h1 className="text-3xl font-bold text-on-background">
                        Gantt Progetti
                    </h1>
                    <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
                        {(['month', 'quarter', 'year'] as ZoomLevel[]).map(level => (
                            <button
                                key={level}
                                onClick={() => setZoom(level)}
                                className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
                                    zoom === level
                                        ? 'bg-surface text-primary shadow'
                                        : 'text-on-surface-variant'
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

                <div className="mb-4 p-4 bg-surface rounded-2xl shadow relative z-21">
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
                            className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto"
                        >
                            Reset
                        </button>
                    </div>
                </div>

                {/* Mini legenda colori / zoom */}
                <div className="mb-4 px-1 text-xs text-on-surface-variant flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-6 h-2 rounded-full bg-primary" />
                        <span>Periodo di attività del progetto</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 border border-outline bg-surface-container" />
                        <span>Segmenti temporali (mese / trimestre / anno)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-0.5 h-4 bg-error" />
                        <span>Data odierna</span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="font-semibold">Zoom:</span>
                        <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px]">
                            {zoom === 'month'
                                ? 'Mese'
                                : zoom === 'quarter'
                                ? 'Trimestre'
                                : 'Anno'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Corpo Gantt: card con altezza fissa, scroll orizzontale+verticale SOLO sulla tabella */}
            <div className="flex-grow">
                <div className="bg-surface rounded-2xl shadow">
                    <div
                        ref={scrollContainerRef}
                        className="h-[28rem] overflow-x-auto overflow-y-auto"
                    >
                        <div
                            className="relative"
                            style={{
                                minWidth: `calc(${LEFT_COLUMN_WIDTH}px + ${ganttChartWidth}px)`,
                            }}
                        >
                            {/* Header tabellare (sticky rispetto al contenitore scrollabile) */}
                            <div
                                className="sticky top-0 z-20 bg-surface-container-low h-16 grid"
                                style={{ gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px 1fr` }}
                            >
                                {/* Header colonna progetti */}
                                <div className="p-3 font-semibold border-r border-b border-outline-variant sticky left-0 bg-surface-container-low z-30 flex items-center justify-between">
                                    <button
                                        onClick={toggleSortDirection}
                                        className="flex items-center space-x-1 hover:text-on-surface"
                                    >
                                        <span>Progetto</span>
                                        <span className="text-gray-400">↕️</span>
                                    </button>
                                    <span className="text-xs font-normal text-on-surface-variant">
                                        Cliente · Periodo · Risorse
                                    </span>
                                </div>

                                {/* Header timeline */}
                                <div className="relative border-b border-outline-variant">
                                    <div
                                        className="grid h-full"
                                        style={timeGridStyle}
                                    >
                                        {timeScale.map((ts, i) => (
                                            <div
                                                key={i}
                                                className={`flex flex-col items-center justify-center px-1 text-center text-[10px] font-semibold text-on-surface-variant border-r border-outline-variant whitespace-nowrap ${
                                                    i % 2 === 0
                                                        ? 'bg-surface-container/50'
                                                        : ''
                                                }`}
                                            >
                                                <span className="uppercase tracking-wide">
                                                    {ts.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Body righe + barre */}
                            <div>
                                {sortedAndFilteredProjects.map(project => {
                                    const projectResources = getProjectResources(project.id!);
                                    const isExpanded = expandedProjects.has(project.id!);
                                    const barStyle = getBarPosition(
                                        project.startDate,
                                        project.endDate
                                    );
                                    const clientName =
                                        (project.clientId &&
                                            clientMap.get(project.clientId)) ||
                                        'Cliente non assegnato';

                                    const periodLabel =
                                        project.startDate && project.endDate
                                            ? `${new Date(
                                                  project.startDate
                                              ).toLocaleDateString('it-IT')} – ${new Date(
                                                  project.endDate
                                              ).toLocaleDateString('it-IT')}`
                                            : 'Periodo non definito';

                                    return (
                                        <div
                                            key={project.id}
                                            className="grid border-b border-outline-variant odd:bg-surface-container/30 group hover:bg-surface-container-low transition-colors"
                                            style={{
                                                gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px 1fr`,
                                            }}
                                        >
                                            {/* Colonna info progetto */}
                                            <div className="p-3 border-r border-outline-variant sticky left-0 bg-surface group-odd:bg-surface-container/30 group-hover:bg-surface-container-low z-10">
                                                <button
                                                    onClick={() =>
                                                        toggleProjectExpansion(project.id!)
                                                    }
                                                    className="flex items-start w-full text-left"
                                                >
                                                    <span className={`material-symbols-outlined text-on-surface-variant mr-2 mt-0.5 flex-shrink-0 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-sm text-on-surface truncate">
                                                                {project.name}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1 text-[11px] text-on-surface-variant space-y-0.5">
                                                            <div className="truncate">
                                                                <span className="font-semibold">
                                                                    Cliente:{' '}
                                                                </span>
                                                                <span>{clientName}</span>
                                                            </div>
                                                            <div className="truncate">
                                                                <span className="font-semibold">
                                                                    Periodo:{' '}
                                                                </span>
                                                                <span>{periodLabel}</span>
                                                            </div>
                                                            {projectResources.length > 0 && (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {projectResources
                                                                        .slice(0, 3)
                                                                        .map(r => (
                                                                            <span
                                                                                key={r.id}
                                                                                className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[11px]"
                                                                            >
                                                                                {r.name}
                                                                            </span>
                                                                        ))}
                                                                    {projectResources.length > 3 && (
                                                                        <span className="text-[11px] text-on-surface-variant">
                                                                            +{projectResources.length - 3}{' '}
                                                                            altri
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <ul className="mt-2 pl-6 text-xs text-on-surface-variant space-y-1">
                                                        {projectResources.length > 0 ? (
                                                            projectResources.map(r => (
                                                                <li key={r.id}>{r.name}</li>
                                                            ))
                                                        ) : (
                                                            <li>Nessuna risorsa assegnata</li>
                                                        )}
                                                    </ul>
                                                )}
                                            </div>

                                            {/* Timeline per riga */}
                                            <div className="relative overflow-hidden">
                                                {/* Griglia di sfondo */}
                                                <div
                                                    className="grid h-full"
                                                    style={timeGridStyle}
                                                >
                                                    {timeScale.map((_, i) => (
                                                        <div
                                                            key={i}
                                                            className={`h-full border-r border-outline-variant ${
                                                                isExpanded
                                                                    ? 'min-h-[72px]'
                                                                    : 'min-h-[56px]'
                                                            } ${
                                                                i % 2 === 0
                                                                    ? 'bg-surface-container/20'
                                                                    : ''
                                                            }`}
                                                        />
                                                    ))}
                                                </div>

                                                {/* Barra Gantt */}
                                                {project.startDate && project.endDate && (
                                                    <div
                                                        className="absolute h-2/3 top-1/2 -translate-y-1/2 rounded-full bg-primary hover:opacity-80 shadow-sm group/bar flex items-center px-2 text-[11px] text-on-primary truncate"
                                                        style={barStyle}
                                                    >
                                                        <span className="truncate">
                                                            {project.name}
                                                        </span>
                                                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-[10px] rounded py-1 px-2 opacity-0 group-hover/bar:opacity-100 transition-opacity z-10 whitespace-nowrap">
                                                            {periodLabel}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Riga riepilogo: totale progetti per anno (solo vista "Anno") */}
                                {zoom === 'year' && (
                                    <div
                                        className="grid border-t-2 border-outline bg-primary-container/30"
                                        style={{
                                            gridTemplateColumns: `${LEFT_COLUMN_WIDTH}px 1fr`,
                                        }}
                                    >
                                        <div className="p-3 border-r border-outline sticky left-0 bg-primary-container/40 z-10 text-xs font-semibold text-on-primary-container flex items-center">
                                            Totale progetti per anno (filtrati)
                                        </div>
                                        <div className="relative">
                                            <div
                                                className="grid"
                                                style={timeGridStyle}
                                            >
                                                {timeScale.map((seg, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex flex-col items-center justify-center min-h-[40px] border-r border-outline text-[11px] font-semibold text-on-primary-container"
                                                    >
                                                        <span className="mb-0.5">{seg.label}</span>
                                                        <span>{segmentProjectCounts[i] ?? 0}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Today Marker (banda + linea) */}
                            {todayPosition >= 0 && todayPosition <= ganttChartWidth && (
                                <>
                                    {/* banda leggera */}
                                    <div
                                        className="absolute top-0 bottom-0 w-6 bg-error/5 z-10 pointer-events-none"
                                        style={{
                                            left: `calc(${LEFT_COLUMN_WIDTH}px + ${todayPosition - 3}px)`,
                                        }}
                                    />
                                    {/* linea */}
                                    <div
                                        className="absolute top-0 bottom-0 w-0.5 bg-error z-20 pointer-events-none"
                                        style={{
                                            left: `calc(${LEFT_COLUMN_WIDTH}px + ${todayPosition}px)`,
                                        }}
                                        title="Oggi"
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Riepilogo per cliente (quando non si è in vista Anno) */}
                    {zoom !== 'year' && totalByClient.length > 0 && (
                        <div className="border-t border-outline bg-surface-container px-4 py-3 text-xs text-on-surface-variant">
                            <div className="font-semibold mb-1">
                                Totale progetti per cliente (filtrati)
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                {totalByClient.map(item => (
                                    <span
                                        key={item.clientName}
                                        className="inline-flex items-center gap-1"
                                    >
                                        <span className="inline-block w-2 h-2 rounded-full bg-primary" />
                                        <span>
                                            {item.clientName}: {item.count}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GanttPage;