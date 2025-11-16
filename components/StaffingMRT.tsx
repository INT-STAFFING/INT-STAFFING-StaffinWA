/**
 * @file StaffingMRT.tsx
 * @description A Material React Table v3 implementation for the staffing grid, designed as a standalone component.
 */

/*
  How to use this component in StaffingPage.tsx:

  1. Import the component:
     import StaffingMRT from '../components/StaffingMRT';

  2. In StaffingPage.tsx, find the main return statement.
     Locate and remove the entire block containing the controls and the <table>.
     This includes the time controls, filters, and the main table rendering logic.

  3. Replace that entire block with this single component instance, passing down the
     necessary props from StaffingPage.

  Example Usage:
  // Replace the <table> block and all its surrounding controls:
  <StaffingMRT
    currentDate={currentDate}
    viewMode={viewMode}
    onPrev={handlePrev}
    onNext={handleNext}
    onToday={handleToday}
    onChangeViewMode={setViewMode}
    filters={filters}
    onChangeFilter={handleFilterChange}
    onClearFilters={clearFilters}
    onOpenNewAssignmentModal={openNewAssignmentModal}
    onOpenBulkModal={openBulkModal}
    onDeleteAssignment={setAssignmentToDelete}
  />

  No other modifications are required in StaffingPage.tsx.
*/

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import * as MRT from 'material-react-table';
import * as MuiMaterial from '@mui/material';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, Project, Client, Role } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
// FIX: Using namespace import for react-router-dom to address potential module resolution errors.
import * as ReactRouterDOM from 'react-router-dom';
import SearchableSelect from './SearchableSelect'; 

// --- Types for nested table data structure ---

type ViewMode = 'day' | 'week' | 'month';

// FIX: A unified type for both parent and child rows to satisfy MaterialReactTable's TData constraint.
interface TableData {
  kind: 'resource' | 'assignment';
  id: string;
  resource: Resource;

  // Resource-specific properties (for parent rows)
  roleName?: string;
  subRows?: TableData[]; // Now subRows are of the same type

  // Assignment-specific properties (for child rows)
  assignment?: Assignment;
  project?: Project | null;
  client?: Client | null;
  projectName?: string;
  clientName?: string;
  projectManager?: string | null;
}

interface StaffingMRTProps {
    currentDate: Date;
    viewMode: ViewMode;
    onPrev: () => void;
    onNext: () => void;
    onToday: () => void;
    onChangeViewMode: (mode: ViewMode) => void;
    filters: { resourceId: string; projectId: string; clientId: string; projectManager: string; };
    onChangeFilter: (name: string, value: string) => void;
    onClearFilters: () => void;
    onOpenNewAssignmentModal: (resourceId?: string) => void;
    onOpenBulkModal: (assignment: Assignment) => void;
    onDeleteAssignment: (assignment: Assignment) => void;
}

// --- Helper function to build the nested data structure with filtering ---

function buildNestedRows(
    resources: Resource[],
    assignments: Assignment[],
    projects: Project[],
    clients: Client[],
    roles: Role[],
    filters: { resourceId: string; projectId: string; clientId: string; projectManager: string; }
): TableData[] {
    const projectsById = new Map(projects.map(p => [p.id!, p]));
    const clientsById = new Map(clients.map(c => [c.id!, c]));

    let relevantAssignments = assignments;
    if (filters.projectId) {
        relevantAssignments = relevantAssignments.filter(a => a.projectId === filters.projectId);
    }
    if (filters.clientId) {
        const clientProjectIds = new Set(projects.filter(p => p.clientId === filters.clientId).map(p => p.id!));
        relevantAssignments = relevantAssignments.filter(a => clientProjectIds.has(a.projectId));
    }
    if (filters.projectManager) {
        const pmProjectIds = new Set(projects.filter(p => p.projectManager === filters.projectManager).map(p => p.id!));
        relevantAssignments = relevantAssignments.filter(a => pmProjectIds.has(a.projectId));
    }

    const assignmentsByResource = new Map<string, Assignment[]>();
    relevantAssignments.forEach(a => {
        if (!assignmentsByResource.has(a.resourceId)) {
            assignmentsByResource.set(a.resourceId, []);
        }
        assignmentsByResource.get(a.resourceId)!.push(a);
    });

    let visibleResources = resources.filter(r => !r.resigned);

    if (filters.resourceId) {
        visibleResources = visibleResources.filter(r => r.id === filters.resourceId);
    } else if (filters.projectId || filters.clientId || filters.projectManager) {
        const resourceIdsFromAssignments = new Set(relevantAssignments.map(a => a.resourceId));
        visibleResources = visibleResources.filter(r => resourceIdsFromAssignments.has(r.id!));
    }

    const nestedData = visibleResources.map((resource): TableData => {
        const resourceAssignments = assignmentsByResource.get(resource.id!) || [];
        
        const subRows: TableData[] = resourceAssignments.map(assignment => {
            const project = projectsById.get(assignment.projectId) || null;
            const client = project && project.clientId ? clientsById.get(project.clientId) || null : null;
            return {
                kind: 'assignment',
                id: assignment.id!,
                assignment,
                resource,
                project,
                client,
                projectName: project?.name || 'Progetto N/D',
                clientName: client?.name || 'N/A',
                projectManager: project?.projectManager || null,
            };
        });

        return {
            kind: 'resource',
            id: resource.id!,
            resource,
            subRows,
            roleName: roles.find(r => r.id === resource.roleId)?.name || 'N/A',
        };
    });
    
    return nestedData
        .filter(row => {
            if (filters.resourceId) return true;
            return row.subRows!.length > 0;
        })
        .sort((a, b) => a.resource.name.localeCompare(b.resource.name));
}

// --- Cell Components (adapted for MRT) ---

const PERCENTAGE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5);

const AllocationCell: React.FC<{ row: MRT.MRT_Row<TableData>; date: string; isNonWorkingDay: boolean; }> = ({ row, date, isNonWorkingDay }) => {
    // FIX: Access `assignment` property from the unified `TableData` type, using non-null assertion as this cell is only for assignment rows.
    const { assignment } = row.original;
    const { allocations, updateAllocation } = useAllocationsContext();
    const percentage = allocations[assignment!.id!]?.[date] || 0;

    if (isNonWorkingDay) return <MuiMaterial.Box sx={{ p: 1, textAlign: 'center', color: 'text.secondary' }}>-</MuiMaterial.Box>;
    
    return (
      <select
        value={percentage}
        onChange={(e) => updateAllocation(assignment!.id!, date, parseInt(e.target.value, 10))}
        className="w-full h-full bg-transparent border-0 text-center appearance-none text-sm focus:ring-0 focus:outline-none text-on-surface"
      >
        {PERCENTAGE_OPTIONS.map((p) => <option key={p} value={p}>{p > 0 ? `${p}%` : '-'}</option>)}
      </select>
    );
};

const ReadonlyAggregatedCell: React.FC<{ row: MRT.MRT_Row<TableData>; startDate: Date; endDate: Date; }> = ({ row, startDate, endDate }) => {
    const { companyCalendar, assignments } = useEntitiesContext();
    const { allocations } = useAllocationsContext();

    const isResourceRow = row.depth === 0;
    const { resource } = row.original;
    
    const averageAllocation = useMemo(() => {
        const effectiveEndDate = resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate ? new Date(resource.lastDayOfWork) : endDate;
        if (startDate > effectiveEndDate) return 0;
        
        const workingDays = getWorkingDaysBetween(startDate, effectiveEndDate, companyCalendar, resource.location);
        if (workingDays === 0) return 0;

        let totalPersonDays = 0;
        // FIX: Use non-null assertion for `assignment` on sub-rows.
        const assignmentsToCalc = isResourceRow ? assignments.filter(a => a.resourceId === resource.id) : [row.original.assignment!];

        assignmentsToCalc.forEach((assignment) => {
            const assignmentAllocations = allocations[assignment.id!];
            if (assignmentAllocations) {
                let currentDate = new Date(startDate);
                while (currentDate <= effectiveEndDate) {
                    const dateStr = formatDate(currentDate, 'iso');
                    if (assignmentAllocations[dateStr] && !isHoliday(currentDate, resource.location, companyCalendar) && currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                        totalPersonDays += assignmentAllocations[dateStr] / 100;
                    }
                    currentDate = addDays(currentDate, 1);
                }
            }
        });
        return (totalPersonDays / workingDays) * 100;
    }, [isResourceRow, row.original, startDate, endDate, allocations, companyCalendar, resource, assignments]);

    const cellColor = useMemo(() => {
        const max = resource.maxStaffingPercentage ?? 100;
        const avg = Math.round(averageAllocation);
        if (avg > (isResourceRow ? max : 100)) return 'bg-error-container text-on-error-container';
        if (avg === (isResourceRow ? max : 100)) return 'bg-tertiary-container text-on-tertiary-container';
        if (avg > 0) return 'bg-yellow-container text-on-yellow-container';
        return isResourceRow ? 'bg-surface-container-low' : 'bg-transparent';
    }, [averageAllocation, resource.maxStaffingPercentage, isResourceRow]);

    return <MuiMaterial.Box className={`w-full h-full flex items-center justify-center font-semibold text-sm ${cellColor}`}>{averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}</MuiMaterial.Box>;
};

const DailyTotalCell: React.FC<{ row: MRT.MRT_Row<TableData>; date: string; isNonWorkingDay: boolean; }> = ({ row, date, isNonWorkingDay }) => {
    const { resource, subRows } = row.original;
    const { allocations } = useAllocationsContext();
    const total = useMemo(() => subRows?.reduce((sum, a) => sum + (allocations[a.id!]?.[date] || 0), 0) ?? 0, [subRows, allocations, date]);
    
    const effectiveNonWorking = isNonWorkingDay || (resource.lastDayOfWork && date > resource.lastDayOfWork);
    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    let cellColor: string;
    if (effectiveNonWorking) cellColor = 'bg-surface-container text-on-surface-variant';
    else if (total > maxPercentage) cellColor = 'bg-error-container text-on-error-container';
    else if (total === maxPercentage) cellColor = 'bg-tertiary-container text-on-tertiary-container';
    else if (total > 0) cellColor = 'bg-yellow-container text-on-yellow-container';
    else cellColor = 'bg-surface-container-low';

    return <MuiMaterial.Box className={`w-full h-full flex items-center justify-center font-semibold text-sm ${cellColor}`}>{effectiveNonWorking ? '-' : (total > 0 ? `${total}%` : '-')}</MuiMaterial.Box>;
};

const StaffingMRT: React.FC<StaffingMRTProps> = ({
    currentDate,
    viewMode,
    onPrev,
    onNext,
    onToday,
    onChangeViewMode,
    filters,
    onChangeFilter,
    onClearFilters,
    onOpenNewAssignmentModal,
    onOpenBulkModal,
    onDeleteAssignment,
}) => {
    const { resources, projects, clients, assignments, roles, companyCalendar } = useEntitiesContext();
    const [rowExpansion, setRowExpansion] = useState<Record<string, boolean>>({});

    const handleViewChange = (_: any, newView: ViewMode | null) => { if(newView) onChangeViewMode(newView); };

    const timeColumns = useMemo(() => {
        const cols: {
          label: string;
          subLabel: string;
          startDate: Date;
          endDate: Date;
          isNonWorkingDay?: boolean;
          dateIso?: string;
        }[] = [];
        let d = new Date(currentDate);

        if (viewMode === 'day') {
            return getCalendarDays(d, 14).map(day => {
                const dayOfWeek = day.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const dateIso = formatDate(day, 'iso');
                const holiday = companyCalendar.find(e => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
                return {
                    label: formatDate(day, 'short'),
                    subLabel: formatDate(day, 'day'),
                    startDate: day,
                    endDate: day,
                    isNonWorkingDay: isWeekend || !!holiday,
                    dateIso,
                };
            });
        }
        
        if (viewMode === 'week') {
            d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
            for (let i = 0; i < 4; i++) {
                const startOfWeek = new Date(d);
                const endOfWeek = addDays(new Date(d), 6);
                cols.push({ label: `${formatDate(startOfWeek, 'short')} - ${formatDate(endOfWeek, 'short')}`, subLabel: ``, startDate: startOfWeek, endDate: endOfWeek });
                d.setDate(d.getDate() + 7);
            }
        } else {
            d.setDate(1);
            for (let i = 0; i < 3; i++) {
                const startOfMonth = new Date(d);
                const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                cols.push({ label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }), subLabel: '', startDate: startOfMonth, endDate: endOfMonth });
                d.setMonth(d.getMonth() + 1);
            }
        }
        return cols;
    }, [currentDate, viewMode, companyCalendar]);

    const tableData = useMemo(() => buildNestedRows(resources, assignments, projects, clients, roles, filters), [resources, assignments, projects, clients, roles, filters]);
    
    useEffect(() => {
        const expanded: Record<string, boolean> = {};
        tableData.forEach(row => { expanded[row.id] = true; });
        setRowExpansion(expanded);
    }, [tableData]);

    const columns = useMemo<MRT.MRT_ColumnDef<TableData>[]>(() => {
        const dynamicColumns: MRT.MRT_ColumnDef<TableData>[] = timeColumns.map((col, index) => ({
            id: `time-col-${index}`,
            header: col.label,
            Header: () => <MuiMaterial.Box sx={{ textAlign: 'center' }}><div>{col.label}</div><div className="text-xs font-normal">{col.subLabel}</div></MuiMaterial.Box>,
            size: viewMode === 'day' ? 75 : 130,
            muiTableHeadCellProps: { align: 'center', sx: { backgroundColor: col.isNonWorkingDay ? 'var(--color-surface-container)' : 'inherit' }},
            Cell: ({ row }) => {
                const { resource } = row.original;
                const isDayHoliday = isHoliday(col.startDate, resource.location, companyCalendar);
                const isNonWorking = !!col.isNonWorkingDay || isDayHoliday;

                if (viewMode === 'day') {
                    return row.depth === 0 
                        ? <DailyTotalCell row={row} date={col.dateIso!} isNonWorkingDay={isNonWorking} />
                        : <AllocationCell row={row} date={col.dateIso!} isNonWorkingDay={isNonWorking} />;
                }
                return <ReadonlyAggregatedCell row={row} startDate={col.startDate} endDate={col.endDate} />;
            },
        }));

        return [
            {
                accessorKey: 'resource.name', header: 'Risorsa / Progetto', size: 280, id: 'resourceProject',
                Cell: ({ row }) => {
                    if (row.depth === 0) {
                        const { resource, roleName } = row.original;
                        return (
                            <MuiMaterial.Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <ReactRouterDOM.Link to={`/workload?resourceId=${resource.id}`} className="font-bold text-primary hover:underline">{resource.name}</ReactRouterDOM.Link>
                                <span className="text-xs text-on-surface-variant">{roleName} (Max: {resource.maxStaffingPercentage}%)</span>
                            </MuiMaterial.Box>
                        );
                    }
                    // FIX: Access properties safely from unified TableData type.
                    const { project, projectName } = row.original;
                    return <ReactRouterDOM.Link to={`/projects?projectId=${project?.id}`} className="text-primary hover:underline ml-4">{projectName}</ReactRouterDOM.Link>;
                },
            },
            // FIX: Access properties safely from unified TableData type.
            { accessorKey: 'clientName', header: 'Cliente', size: 150, Cell: ({ row }) => row.depth > 0 ? row.original.clientName : null },
            // FIX: Access properties safely from unified TableData type.
            { accessorKey: 'projectManager', header: 'Project Manager', size: 150, Cell: ({ row }) => row.depth > 0 ? row.original.projectManager : null },
            {
                id: 'actions', header: 'Azioni', size: 120,
                Cell: ({ row }) => (
                    <MuiMaterial.Box sx={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        {row.depth === 0 ? (
                            <MuiMaterial.Tooltip title={`Aggiungi assegnazione per ${row.original.resource.name}`}>
                                <MuiMaterial.IconButton size="small" onClick={() => onOpenNewAssignmentModal(row.original.resource.id!)} color="primary">
                                    <span className="material-symbols-outlined text-base">add_circle</span>
                                </MuiMaterial.IconButton>
                            </MuiMaterial.Tooltip>
                        ) : (
                            <>
                                <MuiMaterial.Tooltip title="Assegnazione Massiva">
                                    {/* FIX: Access properties safely from unified TableData type. */}
                                    <MuiMaterial.IconButton size="small" onClick={() => onOpenBulkModal(row.original.assignment!)} color="primary">
                                        <span className="material-symbols-outlined text-base">calendar_add_on</span>
                                    </MuiMaterial.IconButton>
                                </MuiMaterial.Tooltip>
                                <MuiMaterial.Tooltip title="Rimuovi Assegnazione">
                                    {/* FIX: Access properties safely from unified TableData type. */}
                                    <MuiMaterial.IconButton size="small" onClick={() => onDeleteAssignment(row.original.assignment!)} color="error">
                                        <span className="material-symbols-outlined text-base">delete</span>
                                    </MuiMaterial.IconButton>
                                </MuiMaterial.Tooltip>
                            </>
                        )}
                    </MuiMaterial.Box>
                ),
            },
            ...dynamicColumns,
        ];
    }, [timeColumns, viewMode, companyCalendar, onOpenNewAssignmentModal, onOpenBulkModal, onDeleteAssignment]);

    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const projectOptions = useMemo(() => projects.map(p => ({ value: p.id!, label: p.name })), [projects]);
    const clientOptions = useMemo(() => clients.map(c => ({ value: c.id!, label: c.name })), [clients]);
    const projectManagerOptions = useMemo(() => [...new Set(projects.map(p => p.projectManager).filter(Boolean) as string[])].sort().map(pm => ({ value: pm, label: pm })), [projects]);

    return (
        <MRT.MaterialReactTable
            columns={columns}
            data={tableData}
            enableExpanding
            enablePagination={false}
            enableColumnResizing
            enableStickyHeader
            enableRowVirtualization
            enableColumnVirtualization
            enableDensityToggle={false}
            getRowId={(row) => row.id}
            // FIX: The `getSubRows` prop now correctly returns `TableData[] | undefined`, matching the expected type.
            getSubRows={(originalRow) => originalRow.subRows}
            initialState={{ density: 'compact' }}
            // FIX: The `rowExpansion` state now works correctly with the unified `TableData` type.
            state={{ rowExpansion }}
            onRowExpansionChange={setRowExpansion}
            muiTableContainerProps={{ sx: { maxHeight: 660 } }}
            muiTablePaperProps={{ elevation: 2, sx: { borderRadius: '1.75rem' } }}
            renderTopToolbarCustomActions={() => (
                <MuiMaterial.Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '1rem', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
                    <MuiMaterial.Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <MuiMaterial.Button onClick={onPrev} variant="outlined">← Prec.</MuiMaterial.Button>
                        <MuiMaterial.Button onClick={onToday} variant="contained" color="secondary">Oggi</MuiMaterial.Button>
                        <MuiMaterial.Button onClick={onNext} variant="outlined">Succ. →</MuiMaterial.Button>
                    </MuiMaterial.Box>
                    <MuiMaterial.ToggleButtonGroup value={viewMode} exclusive onChange={handleViewChange} size="small">
                        <MuiMaterial.ToggleButton value="day">Giorno</MuiMaterial.ToggleButton>
                        <MuiMaterial.ToggleButton value="week">Settimana</MuiMaterial.ToggleButton>
                        <MuiMaterial.ToggleButton value="month">Mese</MuiMaterial.ToggleButton>
                    </MuiMaterial.ToggleButtonGroup>
                    <MuiMaterial.Button
                        variant="contained"
                        onClick={() => onOpenNewAssignmentModal()}
                        startIcon={<span className="material-symbols-outlined">add</span>}
                    >
                        Assegna Risorsa
                    </MuiMaterial.Button>
                </MuiMaterial.Box>
            )}
            renderBottomToolbar={() => (
                 <MuiMaterial.Box sx={{ p: '1rem', pt: 0, display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
                    <MuiMaterial.Box>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Risorsa</label>
                        <SearchableSelect name="resourceId" value={filters.resourceId} onChange={onChangeFilter} options={resourceOptions} placeholder="Tutte le Risorse" />
                    </MuiMaterial.Box>
                    <MuiMaterial.Box>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Cliente</label>
                        <SearchableSelect name="clientId" value={filters.clientId} onChange={onChangeFilter} options={clientOptions} placeholder="Tutti i Clienti" />
                    </MuiMaterial.Box>
                    <MuiMaterial.Box>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Project Manager</label>
                        <SearchableSelect name="projectManager" value={filters.projectManager} onChange={onChangeFilter} options={projectManagerOptions} placeholder="Tutti i PM" />
                    </MuiMaterial.Box>
                    <MuiMaterial.Box>
                        <label className="block text-sm font-medium text-on-surface-variant mb-1">Progetto</label>
                        <SearchableSelect name="projectId" value={filters.projectId} onChange={onChangeFilter} options={projectOptions} placeholder="Tutti i Progetti" />
                    </MuiMaterial.Box>
                    <MuiMaterial.Button onClick={onClearFilters} variant="contained" color="secondary">Reset Filtri</MuiMaterial.Button>
                </MuiMaterial.Box>
            )}
        />
    );
};

export default StaffingMRT;
