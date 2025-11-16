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
import {
  MaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
} from 'material-react-table';
import { Box, Button, ToggleButton, ToggleButtonGroup, Tooltip, IconButton } from '@mui/material';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, Project, Client, Role } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
import { Link } from 'react-router-dom';
import SearchableSelect from './SearchableSelect'; 

// --- Types for nested table data structure ---

type ViewMode = 'day' | 'week' | 'month';

// Parent row type
interface ResourceRow {
  kind: 'resource';
  id: string;
  resource: Resource;
  subRows: AssignmentRow[];
  roleName: string;
}

// Child row type
interface AssignmentRow {
  kind: 'assignment';
  id: string;
  assignment: Assignment;
  resource: Resource; // Parent resource for context
  project: Project | null;
  client: Client | null;
  projectName: string;
  clientName: string;
  projectManager: string | null;
}

// Data type for the table, which will be the parent row type
type TableData = ResourceRow;

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
): ResourceRow[] {
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

    const nestedData = visibleResources.map((resource): ResourceRow => {
        const resourceAssignments = assignmentsByResource.get(resource.id!) || [];
        
        const subRows: AssignmentRow[] = resourceAssignments.map(assignment => {
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
            return row.subRows.length > 0;
        })
        .sort((a, b) => a.resource.name.localeCompare(b.resource.name));
}

// --- Cell Components (adapted for MRT) ---

const PERCENTAGE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5);

const AllocationCell: React.FC<{ row: MRT_Row<TableData>; date: string; isNonWorkingDay: boolean; }> = ({ row, date, isNonWorkingDay }) => {
    const { assignment } = row.original as AssignmentRow;
    const { allocations, updateAllocation } = useAllocationsContext();
    const percentage = allocations[assignment.id!]?.[date] || 0;

    if (isNonWorkingDay) return <Box sx={{ p: 1, textAlign: 'center', color: 'text.secondary' }}>-</Box>;
    
    return (
      <select
        value={percentage}
        onChange={(e) => updateAllocation(assignment.id!, date, parseInt(e.target.value, 10))}
        className="w-full h-full bg-transparent border-0 text-center appearance-none text-sm focus:ring-0 focus:outline-none"
      >
        {PERCENTAGE_OPTIONS.map((p) => <option key={p} value={p}>{p > 0 ? `${p}%` : '-'}</option>)}
      </select>
    );
};

const ReadonlyAggregatedCell: React.FC<{ row: MRT_Row<TableData>; startDate: Date; endDate: Date; }> = ({ row, startDate, endDate }) => {
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
        const assignmentsToCalc = isResourceRow ? assignments.filter(a => a.resourceId === resource.id) : [(row.original as AssignmentRow).assignment];

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

    return <Box className={`w-full h-full flex items-center justify-center font-semibold text-sm ${cellColor}`}>{averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}</Box>;
};

const DailyTotalCell: React.FC<{ row: MRT_Row<TableData>; date: string; isNonWorkingDay: boolean; }> = ({ row, date, isNonWorkingDay }) => {
    const { resource, subRows } = row.original;
    const { allocations } = useAllocationsContext();
    const total = useMemo(() => subRows.reduce((sum, a) => sum + (allocations[a.id!]?.[date] || 0), 0), [subRows, allocations, date]);
    
    const effectiveNonWorking = isNonWorkingDay || (resource.lastDayOfWork && date > resource.lastDayOfWork);
    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    let cellColor: string;
    if (effectiveNonWorking) cellColor = 'bg-surface-container text-on-surface-variant';
    else if (total > maxPercentage) cellColor = 'bg-error-container text-on-error-container';
    else if (total === maxPercentage) cellColor = 'bg-tertiary-container text-on-tertiary-container';
    else if (total > 0) cellColor = 'bg-yellow-container text-on-yellow-container';
    else cellColor = 'bg-surface-container-low';

    return <Box className={`w-full h-full flex items-center justify-center font-semibold text-sm ${cellColor}`}>{effectiveNonWorking ? '-' : (total > 0 ? `${total}%` : '-')}</Box>;
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

    const columns = useMemo<MRT_ColumnDef<TableData>[]>(() => {
        const dynamicColumns: MRT_ColumnDef<TableData>[] = timeColumns.map((col, index) => ({
            id: `time-col-${index}`,
            header: col.label,
            Header: () => <Box sx={{ textAlign: 'center' }}><div>{col.label}</div><div className="text-xs font-normal">{col.subLabel}</div></Box>,
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
                accessorKey: 'resource.name', header: 'Risorsa / Progetto', size: 280, pinned: 'left',
                Cell: ({ row }) => {
                    if (row.depth === 0) {
                        const { resource, roleName } = row.original;
                        return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <Link to={`/workload?resourceId=${resource.id}`} className="font-bold text-primary hover:underline">{resource.name}</Link>
                                <span className="text-xs text-on-surface-variant">{roleName} (Max: {resource.maxStaffingPercentage}%)</span>
                            </Box>
                        );
                    }
                    const { project, projectName } = row.original as AssignmentRow;
                    return <Link to={`/projects?projectId=${project?.id}`} className="text-primary hover:underline">{projectName}</Link>;
                },
            },
            { accessorKey: 'clientName', header: 'Cliente', size: 150, Cell: ({ row }) => row.depth > 0 ? (row.original as AssignmentRow).clientName : null },
            { accessorKey: 'projectManager', header: 'Project Manager', size: 150, Cell: ({ row }) => row.depth > 0 ? (row.original as AssignmentRow).projectManager : null },
            {
                id: 'actions', header: 'Azioni', size: 120,
                Cell: ({ row }) => (
                    <Box sx={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                        {row.depth === 0 ? (
                            <Tooltip title={`Aggiungi assegnazione per ${row.original.resource.name}`}>
                                <IconButton size="small" onClick={() => onOpenNewAssignmentModal(row.original.resource.id!)} color="primary">
                                    <span className="material-symbols-outlined text-base">add_circle</span>
                                </IconButton>
                            </Tooltip>
                        ) : (
                            <>
                                <Tooltip title="Assegnazione Massiva">
                                    <IconButton size="small" onClick={() => onOpenBulkModal((row.original as AssignmentRow).assignment)} color="primary">
                                        <span className="material-symbols-outlined text-base">calendar_add_on</span>
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Rimuovi Assegnazione">
                                    <IconButton size="small" onClick={() => onDeleteAssignment((row.original as AssignmentRow).assignment)} color="error">
                                        <span className="material-symbols-outlined text-base">delete</span>
                                    </IconButton>
                                </Tooltip>
                            </>
                        )}
                    </Box>
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
        <MaterialReactTable
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
            getSubRows={(originalRow) => originalRow.subRows ?? []}
            initialState={{ density: 'compact' }}
            // FIX: The state property for row expansion in Material React Table is 'expanded', not 'rowExpansion'.
            // The corresponding handler is 'onExpandedChange'.
            state={{ expanded: rowExpansion }}
            onExpandedChange={setRowExpansion}
            muiTableContainerProps={{ sx: { maxHeight: 660 } }}
            renderTopToolbar={() => (
                <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                        <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <Button onClick={onPrev} variant="outlined">← Prec.</Button>
                            <Button onClick={onToday} variant="contained" color="secondary">Oggi</Button>
                            <Button onClick={onNext} variant="outlined">Succ. →</Button>
                        </Box>
                        <ToggleButtonGroup value={viewMode} exclusive onChange={handleViewChange} size="small">
                            <ToggleButton value="day">Giorno</ToggleButton>
                            <ToggleButton value="week">Settimana</ToggleButton>
                            <ToggleButton value="month">Mese</ToggleButton>
                        </ToggleButtonGroup>
                        <Button
                            variant="contained"
                            onClick={() => onOpenNewAssignmentModal()}
                            startIcon={<span className="material-symbols-outlined">add</span>}
                        >
                            Assegna Risorsa
                        </Button>
                    </Box>
            
                    <Box sx={{ p: '1rem', pt: 0, display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', alignItems: 'end' }}>
                        <Box>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Risorsa</label>
                            <SearchableSelect name="resourceId" value={filters.resourceId} onChange={onChangeFilter} options={resourceOptions} placeholder="Tutte le Risorse" />
                        </Box>
                        <Box>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Cliente</label>
                            <SearchableSelect name="clientId" value={filters.clientId} onChange={onChangeFilter} options={clientOptions} placeholder="Tutti i Clienti" />
                        </Box>
                        <Box>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Project Manager</label>
                            <SearchableSelect name="projectManager" value={filters.projectManager} onChange={onChangeFilter} options={projectManagerOptions} placeholder="Tutti i PM" />
                        </Box>
                        <Box>
                            <label className="block text-sm font-medium text-on-surface-variant mb-1">Progetto</label>
                            <SearchableSelect name="projectId" value={filters.projectId} onChange={onChangeFilter} options={projectOptions} placeholder="Tutti i Progetti" />
                        </Box>
                        <Button onClick={onClearFilters} variant="contained" color="secondary">Reset Filtri</Button>
                    </Box>
                </Box>
            )}
        />
    );
};

export default StaffingMRT;
