/**
 * @file TestStaffingPage.tsx
 * @description Pagina di test per la visualizzazione dello staffing con Responsive Layout Switching.
 * Desktop: Material React Table v3.
 * Mobile: Resource Cards View (Agenda).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, Role } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import { Link } from 'react-router-dom';
// @ts-ignore
import { MaterialReactTable, useMaterialReactTable } from 'https://aistudiocdn.com/material-react-table@^3.2.1';
// @ts-ignore
import type { MRT_ColumnDef, MRT_Row, MrtRowData } from 'https://aistudiocdn.com/material-react-table@^3.2.1';
// @ts-ignore
import { MRT_Localization_IT } from 'https://aistudiocdn.com/material-react-table@^3.2.1/locales/it';
// @ts-ignore
import { mkConfig, generateCsv, download } from 'https://aistudiocdn.com/export-to-csv@^1.4.0';

type ViewMode = 'day' | 'week' | 'month';

const PERCENTAGE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5);

// --- Componenti Cella Riutilizzati ---

const AllocationCell: React.FC<{
  assignment: Assignment;
  date: string;
  isNonWorkingDay: boolean;
}> = React.memo(({ assignment, date, isNonWorkingDay }) => {
  const { allocations, updateAllocation } = useAllocationsContext();
  const percentage = allocations[assignment.id!]?.[date] || 0;

  if (isNonWorkingDay) {
    return <span className="text-sm text-on-surface-variant">-</span>;
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAllocation(assignment.id!, date, parseInt(e.target.value, 10));
  };

  return (
    <select
      value={percentage}
      onChange={handleChange}
      className="w-full h-full bg-transparent border-0 text-center appearance-none text-sm focus:ring-0 focus:outline-none text-on-surface"
      onClick={(e) => e.stopPropagation()}
    >
      {PERCENTAGE_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {p > 0 ? `${p}%` : '-'}
        </option>
      ))}
    </select>
  );
});

// --- Tipi per i dati ---
type EnrichedAssignment = Assignment & {
  projectName?: string;
  clientName?: string;
  projectManager?: string;
};

type MrtRowDataType = Resource & {
  subRows?: MrtRowData[];
};

type MobileRowData = {
  resource: Resource;
  roleName: string;
  totalLoad: number;
  assignments: {
      assignment: Assignment;
      projectName: string;
      clientName: string;
      avgLoad: number;
  }[];
};


// --- MOBILE COMPONENTS ---

// Modale per la modifica giornaliera su mobile
const MobileAssignmentEditor: React.FC<{
    assignment: Assignment;
    projectName: string;
    dates: { dateIso: string; label: string; isNonWorkingDay: boolean }[];
    onClose: () => void;
}> = ({ assignment, projectName, dates, onClose }) => {
    const { allocations, updateAllocation } = useAllocationsContext();

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-outline-variant bg-surface">
                <h3 className="text-lg font-bold truncate pr-4">{projectName}</h3>
                <button onClick={onClose} className="p-2 rounded-full bg-surface-container text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {dates.map(d => {
                    const currentVal = allocations[assignment.id!]?.[d.dateIso] || 0;
                    return (
                        <div key={d.dateIso} className={`flex items-center justify-between p-3 rounded-lg border ${d.isNonWorkingDay ? 'bg-surface-container/50 border-transparent' : 'bg-surface border-outline-variant'}`}>
                            <div className="flex flex-col">
                                <span className={`font-medium ${d.isNonWorkingDay ? 'text-on-surface-variant' : 'text-on-surface'}`}>{d.label}</span>
                                {d.isNonWorkingDay && <span className="text-xs text-on-surface-variant">Non lavorativo</span>}
                            </div>
                            {!d.isNonWorkingDay ? (
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" 
                                        min="0" max="100" step="5" 
                                        value={currentVal}
                                        onChange={(e) => updateAllocation(assignment.id!, d.dateIso, parseInt(e.target.value, 10))}
                                        className="w-32 accent-primary"
                                    />
                                    <span className="w-10 text-right font-bold text-primary">{currentVal}%</span>
                                </div>
                            ) : (
                                <span className="text-on-surface-variant">-</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const MobileResourceCard: React.FC<{
    data: MobileRowData;
    dates: { dateIso: string; label: string; isNonWorkingDay: boolean }[];
}> = React.memo(({ data, dates }) => {
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
    const [editingProjectName, setEditingProjectName] = useState('');

    const getLoadColor = (load: number) => {
        const max = data.resource.maxStaffingPercentage;
        if (load > max) return 'bg-error text-on-error';
        if (load === max) return 'bg-tertiary text-on-tertiary';
        if (load > 0) return 'bg-yellow-container text-on-yellow-container'; // Using simpler colors for bar
        return 'bg-surface-variant text-on-surface-variant';
    };
    
    const getBarColor = (load: number) => {
        const max = data.resource.maxStaffingPercentage;
        if (load > max) return 'bg-error';
        if (load >= max * 0.9) return 'bg-tertiary'; 
        return 'bg-primary';
    };

    return (
        <>
            <div className="bg-surface rounded-2xl shadow p-4 mb-4 border-l-4 border-primary flex flex-col gap-3">
                {/* Header Card */}
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-on-surface">{data.resource.name}</h3>
                        <p className="text-sm text-on-surface-variant">{data.roleName}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-bold ${getLoadColor(data.totalLoad)}`}>
                        {data.totalLoad.toFixed(0)}% Avg
                    </div>
                </div>

                {/* Visual Load Indicator */}
                <div className="w-full bg-surface-container-highest rounded-full h-2.5">
                    <div 
                        className={`h-2.5 rounded-full ${getBarColor(data.totalLoad)}`} 
                        style={{ width: `${Math.min(data.totalLoad, 100)}%` }}
                    ></div>
                </div>

                {/* Assignments List */}
                <div className="space-y-2 mt-1">
                    {data.assignments.length > 0 ? (
                        data.assignments.map(a => (
                            <div 
                                key={a.assignment.id} 
                                onClick={() => {
                                    setEditingAssignment(a.assignment);
                                    setEditingProjectName(a.projectName);
                                }}
                                className="flex justify-between items-center p-3 bg-surface-container-low rounded-lg border border-transparent active:bg-surface-container-high active:border-outline-variant transition-colors cursor-pointer"
                            >
                                <div className="flex flex-col truncate pr-2">
                                    <span className="font-medium text-sm text-on-surface truncate">{a.projectName}</span>
                                    <span className="text-xs text-on-surface-variant truncate">{a.clientName}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm font-semibold text-primary">{a.avgLoad.toFixed(0)}%</span>
                                    <span className="material-symbols-outlined text-on-surface-variant text-sm">chevron_right</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-on-surface-variant italic text-center py-2">Nessuna assegnazione nel periodo.</p>
                    )}
                </div>
            </div>

            {editingAssignment && (
                <MobileAssignmentEditor 
                    assignment={editingAssignment} 
                    projectName={editingProjectName} 
                    dates={dates} 
                    onClose={() => setEditingAssignment(null)} 
                />
            )}
        </>
    );
});


// --- Pagina Principale ---
const TestStaffingPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  // Mobile defaults to 'week', desktop to 'day' usually, but let's sync them or handle separately.
  // For mobile "Agenda" view, 'week' is a good default.
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const {
    resources,
    projects,
    assignments,
    roles,
    clients,
    addMultipleAssignments,
    deleteAssignment,
    companyCalendar,
    isActionLoading,
  } = useEntitiesContext();
  const { allocations, bulkUpdateAllocations } = useAllocationsContext();

  // Modali Desktop
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [bulkFormData, setBulkFormData] = useState({ startDate: '', endDate: '', percentage: 50 });
  const [newAssignmentData, setNewAssignmentData] = useState<{ resourceId: string; projectIds: string[] }>({ resourceId: '', projectIds: [] });

  const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '', projectManager: '' });

  const projectsById = useMemo(() => new Map(projects.map((p: any) => [p.id, p])), [projects]);
  const clientsById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const rolesById = useMemo(() => new Map(roles.map((r: any) => [r.id, r])), [roles]);

  // --- Time Calculation ---
  const timeColumns = useMemo(() => {
    const cols: { label: string; subLabel: string; startDate: Date; endDate: Date; isNonWorkingDay: boolean; dateIso: string; }[] = [];
    let d = new Date(currentDate);

    if (isMobile) {
        // Mobile Logic: Always show days for the selected period (Day/Week/Month) to allow editing
        // If 'week', show 7 days. If 'day', 1 day. If 'month', all days in month.
        // To keep mobile performant and usable, let's force 'week' view mostly, or 'day'.
        // 'Month' on mobile agenda might be too long list, but manageable.
        
        let daysToGenerate = 1;
        if (viewMode === 'week') {
             d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
             daysToGenerate = 7;
        } else if (viewMode === 'month') {
             d.setDate(1);
             daysToGenerate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        }

        for (let i = 0; i < daysToGenerate; i++) {
            const day = new Date(d);
            day.setDate(d.getDate() + i);
            const dayOfWeek = day.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const dateIso = formatDate(day, 'iso');
            const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
            cols.push({ 
                label: formatDate(day, 'day') + ' ' + formatDate(day, 'short'), 
                subLabel: '', 
                startDate: day, 
                endDate: day, 
                isNonWorkingDay: isWeekend || !!holiday, 
                dateIso 
            });
        }
        return cols;
    }

    // Desktop Logic (Standard)
    if (viewMode === 'day') {
      return getCalendarDays(d, 14).map((day) => {
        const dayOfWeek = day.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateIso = formatDate(day, 'iso');
        const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
        return { label: formatDate(day, 'short'), subLabel: formatDate(day, 'day'), startDate: day, endDate: day, isNonWorkingDay: isWeekend || !!holiday, dateIso };
      });
    }
    if (viewMode === 'week') {
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
      for (let i = 0; i < 12; i++) {
        const startOfWeek = new Date(d);
        const endOfWeek = addDays(new Date(d), 6);
        cols.push({ label: `${formatDate(startOfWeek, 'short')} - ${formatDate(endOfWeek, 'short')}`, subLabel: '', startDate: startOfWeek, endDate: endOfWeek, isNonWorkingDay: false, dateIso: '' });
        d.setDate(d.getDate() + 7);
      }
    } else {
      d.setDate(1);
      for (let i = 0; i < 12; i++) {
        const startOfMonth = new Date(d);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        cols.push({ label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }), subLabel: '', startDate: startOfMonth, endDate: endOfMonth, isNonWorkingDay: false, dateIso: '' });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return cols;
  }, [currentDate, viewMode, companyCalendar, isMobile]);

  const handlePrev = useCallback(() => setCurrentDate(prev => {
    const newDate = new Date(prev);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setDate(newDate.getDate() - 1); // Day view
    return newDate;
  }), [viewMode]);

  const handleNext = useCallback(() => setCurrentDate(prev => {
    const newDate = new Date(prev);
    if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7);
    else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setDate(newDate.getDate() + 1);
    return newDate;
  }), [viewMode]);

  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  const openBulkModal = useCallback((assignment: Assignment) => { setSelectedAssignment(assignment); setBulkFormData({ startDate: '', endDate: '', percentage: 50 }); setBulkModalOpen(true); }, []);
  const openNewAssignmentModal = useCallback((resourceId: string = '') => { setNewAssignmentData({ resourceId, projectIds: [] }); setAssignmentModalOpen(true); }, []);

  const handleBulkSubmit = (e: React.FormEvent) => { e.preventDefault(); if (selectedAssignment) { bulkUpdateAllocations(selectedAssignment.id!, bulkFormData.startDate, bulkFormData.endDate, bulkFormData.percentage); setBulkModalOpen(false); } };
  const handleNewAssignmentSubmit = (e: React.FormEvent) => { e.preventDefault(); if (newAssignmentData.resourceId && newAssignmentData.projectIds.length > 0) { const assignmentsToCreate = newAssignmentData.projectIds.map(projectId => ({ resourceId: newAssignmentData.resourceId, projectId })); addMultipleAssignments(assignmentsToCreate); setAssignmentModalOpen(false); } };
  
  const handleFilterChange = useCallback((name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value })), []);
  const clearFilters = useCallback(() => setFilters({ resourceId: '', projectId: '', clientId: '', projectManager: '' }), []);

  const getResourceById = useCallback((id: string) => resources.find((r) => r.id === id), [resources]);
  const getProjectById = useCallback((id: string) => projectsById.get(id), [projectsById]);

  // --- Data Processing for Views ---
  const commonDataProcessing = useMemo(() => {
    const filteredAssignments = assignments.filter(a =>
      (!filters.projectId || a.projectId === filters.projectId) &&
      (!filters.clientId || projectsById.get(a.projectId)?.clientId === filters.clientId) &&
      (!filters.projectManager || projectsById.get(a.projectId)?.projectManager === filters.projectManager)
    );

    const assignmentsByResource = new Map<string, Assignment[]>();
    filteredAssignments.forEach(a => {
      if (!assignmentsByResource.has(a.resourceId)) assignmentsByResource.set(a.resourceId, []);
      assignmentsByResource.get(a.resourceId)!.push(a);
    });

    let visibleResources = resources.filter(r => !r.resigned);
    if (filters.resourceId) visibleResources = visibleResources.filter(r => r.id === filters.resourceId);
    if (filters.projectId || filters.clientId || filters.projectManager) {
        const resourceIdsFromAssignments = new Set(filteredAssignments.map(a => a.resourceId));
        visibleResources = visibleResources.filter(r => resourceIdsFromAssignments.has(r.id!));
    }
    return { visibleResources, assignmentsByResource };
  }, [assignments, projectsById, resources, filters]);

  // --- Mobile Data Preparation ---
  const mobileDisplayData = useMemo<MobileRowData[]>(() => {
      if (!isMobile) return [];
      
      return commonDataProcessing.visibleResources.map(resource => {
          const resAssignments = commonDataProcessing.assignmentsByResource.get(resource.id!) || [];
          
          // Calculate load for the visible period (timeColumns)
          let totalLoadSum = 0;
          let workingDaysCount = 0;

          // Prepare assignment details
          const assignmentsDetails = resAssignments.map(assignment => {
              let assignmentLoadSum = 0;
              
              timeColumns.forEach(col => {
                   if (!col.isNonWorkingDay && col.dateIso) {
                       assignmentLoadSum += allocations[assignment.id!]?.[col.dateIso] || 0;
                   }
              });

              // Count working days only once per resource logic, but for assignment avg we use same period
              // Simple average over the period
              const avgLoad = timeColumns.filter(c => !c.isNonWorkingDay).length > 0 
                ? assignmentLoadSum / timeColumns.filter(c => !c.isNonWorkingDay).length 
                : 0;
              
              return {
                  assignment,
                  projectName: projectsById.get(assignment.projectId)?.name || 'Unknown',
                  clientName: clientsById.get(projectsById.get(assignment.projectId)?.clientId)?.name || 'Unknown',
                  avgLoad
              };
          });

          // Calculate Total Resource Load
          timeColumns.forEach(col => {
              if (!col.isNonWorkingDay && col.dateIso) {
                  workingDaysCount++;
                  resAssignments.forEach(a => {
                      totalLoadSum += allocations[a.id!]?.[col.dateIso] || 0;
                  });
              }
          });

          const totalAvgLoad = workingDaysCount > 0 ? totalLoadSum / workingDaysCount : 0;

          return {
              resource,
              roleName: rolesById.get(resource.roleId)?.name || '',
              totalLoad: totalAvgLoad,
              assignments: assignmentsDetails
          };
      });
  }, [isMobile, commonDataProcessing, timeColumns, allocations, projectsById, clientsById, rolesById]);

  // --- Desktop Data Preparation (MRT) ---
  const mrtDisplayData = useMemo<MrtRowDataType[]>(() => {
    if (isMobile) return [];

    return commonDataProcessing.visibleResources
      .map(resource => {
        const resourceAssignments = commonDataProcessing.assignmentsByResource.get(resource.id!) || [];
        const enrichedAssignments: EnrichedAssignment[] = resourceAssignments.map(assignment => ({
            ...assignment,
            projectName: projectsById.get(assignment.projectId)?.name,
            clientName: clientsById.get(projectsById.get(assignment.projectId)?.clientId)?.name,
            projectManager: projectsById.get(assignment.projectId)?.projectManager,
        }));
        return { ...resource, subRows: enrichedAssignments as unknown as MrtRowData[] };
      })
      .filter(item => filters.resourceId ? true : item.subRows!.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isMobile, commonDataProcessing, projectsById, clientsById, filters]);

  // --- MRT Columns Definition (Desktop Only) ---
  const columns = useMemo<MRT_ColumnDef<MrtRowDataType>[]>(() => {
    if (isMobile) return [];

    const staticColumns: MRT_ColumnDef<MrtRowDataType>[] = [
      {
        id: 'resourceProject',
        header: 'Risorsa / Progetto',
        minSize: 280,
        size: 280,
        Cell: ({ row }) => {
          if (row.getCanExpand()) { // Riga Risorsa
            const resource = row.original;
            const role = rolesById.get(resource.roleId) as Role | undefined;
            return (
              <div className="flex items-center justify-between gap-2 font-bold">
                <div className="flex flex-col min-w-0">
                  <Link to={`/workload?resourceId=${resource.id}`} className="text-primary hover:underline truncate" title={resource.name}>{resource.name}</Link>
                  <span className="text-xs font-normal text-on-surface-variant truncate" title={`${role?.name} (Max: ${resource.maxStaffingPercentage}%)`}>{role?.name} (Max: {resource.maxStaffingPercentage}%)</span>
                </div>
                <button onClick={() => openNewAssignmentModal(resource.id!)} title={`Aggiungi per ${resource.name}`} className="flex-shrink-0 text-primary hover:opacity-80"><span className="material-symbols-outlined">add_circle</span></button>
              </div>
            );
          }
          // Riga Assegnazione
          const assignment = row.original as unknown as EnrichedAssignment;
          return <Link to={`/projects?projectId=${assignment.projectId}`} className="text-primary hover:underline block truncate pl-4" title={assignment.projectName}>{assignment.projectName}</Link>;
        },
      },
      { accessorFn: (row) => (row.subRows ? null : (row as any).clientName), id: 'client', header: 'Cliente', size: 150 },
      { accessorFn: (row) => (row.subRows ? null : (row as any).projectManager), id: 'pm', header: 'PM', size: 150 },
    ];

    const dynamicTimeColumns: MRT_ColumnDef<MrtRowDataType>[] = timeColumns.map((col) => ({
      id: col.dateIso || col.label,
      header: col.label,
      // @ts-ignore
      subHeader: col.subLabel,
      size: viewMode === 'day' ? 90 : 120,
      muiTableHeadCellProps: { align: 'center', className: `${col.isNonWorkingDay ? 'bg-surface-container' : ''}` },
      muiTableBodyCellProps: { align: 'center' },
      Cell: ({ row }) => {
        const resource = row.getCanExpand() ? row.original : row.getParentRow()?.original;
        if (!resource) return null;

        if (row.getCanExpand()) { // Riga Risorsa (Totale)
          if (viewMode === 'day') {
            const isDayHoliday = isHoliday(col.startDate, resource.location, companyCalendar);
            return React.createElement(DailyTotalCell, { resource, date: col.dateIso!, isNonWorkingDay: !!col.isNonWorkingDay || isDayHoliday, resourceAssignments: row.original.subRows! as unknown as Assignment[] });
          }
          return React.createElement(ReadonlyAggregatedTotalCell, { resource, startDate: col.startDate, endDate: col.endDate });
        } else { // Riga Assegnazione
          const assignment = row.original as unknown as EnrichedAssignment;
          if (viewMode === 'day') {
            const isDayHoliday = isHoliday(col.startDate, resource.location, companyCalendar);
            return <AllocationCell assignment={assignment} date={col.dateIso!} isNonWorkingDay={!!col.isNonWorkingDay || isDayHoliday} />;
          }
          return React.createElement(ReadonlyAggregatedAllocationCell, { assignment, startDate: col.startDate, endDate: col.endDate });
        }
      },
    }));

    return [ ...staticColumns, ...dynamicTimeColumns ];
  }, [isMobile, timeColumns, rolesById, companyCalendar, openNewAssignmentModal, viewMode]);

  const table = useMaterialReactTable({
    columns,
    data: mrtDisplayData,
    localization: MRT_Localization_IT,
    enableExpanding: true,
    enablePagination: false,
    enableRowVirtualization: true,
    enableColumnVirtualization: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enablePinning: true,
    enableStickyHeader: true,
    layoutMode: 'grid',
    muiTableContainerProps: { sx: { maxHeight: '660px' } },
    initialState: {
        columnPinning: { left: ['mrt-row-expand', 'resourceProject'], right: ['actions'] },
        density: 'compact',
        expanded: true,
    },
    getSubRows: (row) => row.subRows,
    renderRowActions: ({ row }) => {
        if (row.getCanExpand()) return null;
        const assignment = row.original as unknown as EnrichedAssignment;
        const isDeleting = isActionLoading(`deleteAssignment-${assignment.id}`);
        return (
            <div className={`flex items-center justify-center space-x-2 ${isDeleting ? 'opacity-50' : ''}`}>
                <button onClick={() => openBulkModal(assignment)} title="Assegnazione Massiva" className="text-primary hover:opacity-80"><span className="material-symbols-outlined">calendar_add_on</span></button>
                <button onClick={() => setAssignmentToDelete(assignment)} title="Rimuovi Assegnazione" className="text-error hover:opacity-80" disabled={isDeleting}><span className="material-symbols-outlined">delete</span></button>
            </div>
        );
    },
    displayColumnDefOptions: { 'mrt-row-actions': { header: 'Azioni', size: 100, muiTableHeadCellProps: { align: 'center' } } },
    renderTopToolbarCustomActions: () => {
        const handleExportData = () => {
             const csvConfig = mkConfig({ fieldSeparator: ',', decimalSeparator: '.', useKeysAsHeaders: true });
            const flatData = mrtDisplayData.flatMap(resource =>
                resource.subRows && resource.subRows.length > 0
                ? (resource.subRows as unknown as EnrichedAssignment[]).map(assignment => {
                    const row: any = { Risorsa: resource.name, Progetto: assignment.projectName, Cliente: assignment.clientName, PM: assignment.projectManager };
                    timeColumns.forEach(col => {
                        if (col.dateIso) { row[col.dateIso] = allocations[assignment.id!]?.[col.dateIso!] || 0; }
                    });
                    return row;
                    })
                : []
            );
            const csv = generateCsv(csvConfig)(flatData);
            download(csvConfig)(csv);
        };
        return <button onClick={handleExportData} className="px-4 py-1 bg-secondary-container text-on-secondary-container rounded-full text-sm font-semibold">Esporta CSV</button>
    },
  });

  // --- JSX ---

  const resourceOptions = useMemo(() => resources.filter((r) => !r.resigned).map((r) => ({ value: r.id!, label: r.name })), [resources]);
  const projectOptions = useMemo(() => projects.map((p: any) => ({ value: p.id!, label: p.name })), [projects]);
  const clientOptions = useMemo(() => clients.map((c: any) => ({ value: c.id!, label: c.name })), [clients]);
  const projectManagerOptions = useMemo(() => { const managers = [...new Set(projects.map((p: any) => p.projectManager).filter(Boolean) as string[])]; return managers.sort().map((pm) => ({ value: pm, label: pm })); }, [projects]);

  return (
    <div className="flex flex-col h-full">
      {/* Controlli + Filtri */}
      <div className="flex-shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center justify-center md:justify-start space-x-2">
              <button onClick={handlePrev} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm">← Prec.</button>
              <button onClick={handleToday} className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full shadow-sm font-semibold hover:opacity-90">Oggi</button>
              <button onClick={handleNext} className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm">Succ. →</button>
              {isMobile && <span className="ml-2 text-sm font-semibold text-on-surface">{viewMode === 'week' ? 'Settimana Corrente' : viewMode === 'day' ? 'Giorno' : 'Mese'}</span>}
          </div>
          
          <div className="flex items-center justify-center md:justify-start space-x-1 bg-surface-container p-1 rounded-full">
              {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
                  <button key={level} onClick={() => setViewMode(level)} className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${viewMode === level ? 'bg-surface text-primary shadow' : 'text-on-surface-variant'}`}>
                      {level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}
                  </button>
              ))}
          </div>
          <button onClick={() => openNewAssignmentModal()} className="flex items-center justify-center w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm"><span className="material-symbols-outlined mr-2 text-xl">add</span>Assegna Risorsa</button>
        </div>
        
        {/* Filters - Simplified for Mobile? No, keep powerful */}
        <div className="p-4 bg-surface rounded-2xl shadow">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte le Risorse"/></div>
                {!isMobile && (
                    <>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Cliente</label><SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/></div>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Project Manager</label><SearchableSelect name="projectManager" value={filters.projectManager} onChange={handleFilterChange} options={projectManagerOptions} placeholder="Tutti i PM"/></div>
                        <div><label className="block text-sm font-medium text-on-surface-variant">Progetto</label><SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/></div>
                    </>
                )}
                <button onClick={clearFilters} className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto">Reset Filtri</button>
            </div>
        </div>
      </div>

      {/* MAIN CONTENT: RESPONSIVE SWITCH */}
      <div className="flex-grow mt-4">
          {isMobile ? (
              <div className="space-y-4 pb-20">
                  {mobileDisplayData.map(data => (
                      <MobileResourceCard key={data.resource.id} data={data} dates={timeColumns.map(c => ({ dateIso: c.dateIso || '', label: c.label, isNonWorkingDay: !!c.isNonWorkingDay }))} />
                  ))}
                  {mobileDisplayData.length === 0 && (
                      <div className="text-center p-10 text-on-surface-variant bg-surface rounded-2xl border border-dashed border-outline">
                          Nessuna risorsa da visualizzare.
                      </div>
                  )}
              </div>
          ) : (
              <MaterialReactTable table={table} />
          )}
      </div>

      {/* Modali Comuni */}
      {assignmentToDelete && <ConfirmationModal isOpen={!!assignmentToDelete} onClose={() => setAssignmentToDelete(null)} onConfirm={() => { if (assignmentToDelete) { deleteAssignment(assignmentToDelete.id!); setAssignmentToDelete(null); } }} title="Conferma Rimozione" message={<>Sei sicuro di voler rimuovere l'assegnazione di <strong>{getResourceById(assignmentToDelete.resourceId)?.name}</strong> dal progetto <strong>{getProjectById(assignmentToDelete.projectId)?.name}</strong>?</>} isConfirming={isActionLoading(`deleteAssignment-${assignmentToDelete.id}`)} />}
      <Modal isOpen={isBulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Assegnazione Massiva"><form onSubmit={handleBulkSubmit}><div className="space-y-4"><div><label className="block text-sm font-medium text-on-surface-variant">Data Inizio</label><input type="date" required value={bulkFormData.startDate} onChange={(e) => setBulkFormData(f => ({ ...f, startDate: e.target.value }))} className="mt-1 block w-full form-input"/></div><div><label className="block text-sm font-medium text-on-surface-variant">Data Fine</label><input type="date" required value={bulkFormData.endDate} onChange={(e) => setBulkFormData(f => ({ ...f, endDate: e.target.value }))} className="mt-1 block w-full form-input"/></div><div><label className="block text-sm font-medium text-on-surface-variant">Percentuale ({bulkFormData.percentage}%)</label><input type="range" min="0" max="100" step="5" value={bulkFormData.percentage} onChange={(e) => setBulkFormData(f => ({ ...f, percentage: parseInt(e.target.value, 10) }))} className="mt-1 block w-full accent-primary"/></div></div><div className="mt-6 flex justify-end space-x-2"><button type="button" onClick={() => setBulkModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button><button type="submit" className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold">Salva</button></div></form></Modal>
      <Modal isOpen={isAssignmentModalOpen} onClose={() => setAssignmentModalOpen(false)} title="Assegna Risorsa a Progetto"><form onSubmit={handleNewAssignmentSubmit} className="flex flex-col h-96"><div className="space-y-4 flex-grow"><div><label className="block text-sm font-medium text-on-surface-variant">Risorsa</label><SearchableSelect name="resourceId" value={newAssignmentData.resourceId} onChange={(name, value) => setNewAssignmentData(d => ({ ...d, [name]: value }))} options={resourceOptions} placeholder="Seleziona una risorsa" required/></div><div><label className="block text-sm font-medium text-on-surface-variant">Progetto/i</label><MultiSelectDropdown name="projectIds" selectedValues={newAssignmentData.projectIds} onChange={(name, values) => setNewAssignmentData(d => ({ ...d, [name]: values }))} options={projects.filter((p: any) => p.status !== 'Completato').map((p: any) => ({ value: p.id!, label: p.name }))} placeholder="Seleziona uno o più progetti"/></div></div><div className="mt-6 flex justify-end space-x-2"><button type="button" onClick={() => setAssignmentModalOpen(false)} className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold">Annulla</button><button type="submit" className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold">Aggiungi</button></div></form></Modal>
    </div>
  );
};

// --- Componenti Cella MRT (definiti fuori per leggibilità) ---
const DailyTotalCell: React.FC<{ resource: Resource; date: string; isNonWorkingDay: boolean; resourceAssignments: Assignment[] }> = React.memo(({ resource, date, isNonWorkingDay, resourceAssignments }) => {
  const { allocations } = useAllocationsContext();
  const total = useMemo(() => resourceAssignments.reduce((sum, a) => sum + (allocations[a.id!]?.[date] || 0), 0), [resourceAssignments, allocations, date]);
  const maxPercentage = resource.maxStaffingPercentage ?? 100;
  let cellColor: string;
  if (isNonWorkingDay) cellColor = 'bg-surface-container text-on-surface-variant';
  else if (total > maxPercentage) cellColor = 'bg-error-container text-on-error-container';
  else if (total === maxPercentage) cellColor = 'bg-tertiary-container text-on-tertiary-container';
  else if (total > 0) cellColor = 'bg-yellow-container text-on-yellow-container';
  else cellColor = 'bg-surface-container-low';
  return <div className={`w-full h-full flex items-center justify-center font-semibold text-sm ${cellColor}`}>{isNonWorkingDay ? '-' : total > 0 ? `${total}%` : '-'}</div>;
});

const ReadonlyAggregatedTotalCell: React.FC<{ resource: Resource; startDate: Date; endDate: Date }> = React.memo(({ resource, startDate, endDate }) => {
  const { assignments, companyCalendar } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  const { averageAllocation, cellColor } = useMemo(() => {
    const effectiveEndDate =
      resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
        ? new Date(resource.lastDayOfWork)
        : endDate;
    if (startDate > effectiveEndDate) return { averageAllocation: 0, cellColor: 'bg-surface-container-low' };

    const workingDays = getWorkingDaysBetween(
      startDate,
      effectiveEndDate,
      companyCalendar,
      resource.location
    );
    if (workingDays === 0) return { averageAllocation: 0, cellColor: 'bg-surface-container-low' };

    const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
    let totalPersonDays = 0;

    resourceAssignments.forEach((assignment) => {
      const assignmentAllocations = allocations[assignment.id!];
      if (assignmentAllocations) {
        let currentDate = new Date(startDate);
        while (currentDate <= effectiveEndDate) {
          const dateStr = formatDate(currentDate, 'iso');
          if (assignmentAllocations[dateStr]) {
            if (
              !isHoliday(currentDate, resource.location, companyCalendar) &&
              currentDate.getDay() !== 0 &&
              currentDate.getDay() !== 6
            ) {
              totalPersonDays += assignmentAllocations[dateStr] / 100;
            }
          }
          currentDate = addDays(currentDate, 1);
        }
      }
    });

    const averageAllocation = (totalPersonDays / workingDays) * 100;
    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    const roundedAverage = Math.round(averageAllocation);
    let cellColor = 'bg-surface-container-low';
    if (roundedAverage > maxPercentage) cellColor = 'bg-error-container text-on-error-container';
    else if (roundedAverage === maxPercentage) cellColor = 'bg-tertiary-container text-on-tertiary-container';
    else if (roundedAverage > 0) cellColor = 'bg-yellow-container text-on-yellow-container';
    
    return { averageAllocation, cellColor };
  }, [resource, startDate, endDate, assignments, allocations, companyCalendar]);

  return <div className={`w-full h-full flex items-center justify-center font-semibold text-sm ${cellColor}`}>{averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}</div>;
});


const ReadonlyAggregatedAllocationCell: React.FC<{ assignment: Assignment; startDate: Date; endDate: Date }> = React.memo(({ assignment, startDate, endDate }) => {
    const { companyCalendar, resources } = useEntitiesContext();
    const { allocations } = useAllocationsContext();
    const resource = resources.find((r) => r.id === assignment.resourceId);

    const { averageAllocation, cellColor } = useMemo(() => {
        if (!resource) return { averageAllocation: 0, cellColor: 'bg-transparent' };

        const effectiveEndDate =
          resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
            ? new Date(resource.lastDayOfWork)
            : endDate;
        if (startDate > effectiveEndDate) return { averageAllocation: 0, cellColor: 'bg-transparent' };

        const workingDays = getWorkingDaysBetween(
          startDate,
          effectiveEndDate,
          companyCalendar,
          resource.location
        );
        if (workingDays === 0) return { averageAllocation: 0, cellColor: 'bg-transparent' };

        let totalPersonDays = 0;
        const assignmentAllocations = allocations[assignment.id!];

        if (assignmentAllocations) {
          let currentDate = new Date(startDate);
          while (currentDate <= effectiveEndDate) {
            const dateStr = formatDate(currentDate, 'iso');
            if (assignmentAllocations[dateStr]) {
              if (
                !isHoliday(currentDate, resource.location, companyCalendar) &&
                currentDate.getDay() !== 0 &&
                currentDate.getDay() !== 6
              ) {
                totalPersonDays += assignmentAllocations[dateStr] / 100;
              }
            }
            currentDate = addDays(currentDate, 1);
          }
        }
        
        const averageAllocation = (totalPersonDays / workingDays) * 100;
        let cellColor = 'bg-transparent';
        if (averageAllocation > 100) cellColor = 'bg-error-container text-on-error-container';
        else if (averageAllocation >= 95 && averageAllocation <= 100) cellColor = 'bg-tertiary-container text-on-tertiary-container';
        else if (averageAllocation > 0) cellColor = 'bg-yellow-container text-on-yellow-container';
        
        return { averageAllocation, cellColor };
    }, [assignment.id, startDate, endDate, allocations, companyCalendar, resource]);

    return <div className={`w-full h-full flex items-center justify-center font-semibold text-sm ${cellColor}`}>{averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}</div>;
});

export default TestStaffingPage;