
import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Resource, Assignment, LeaveRequest, LeaveType } from '../types';
import { useAllocationsContext, useEntitiesContext } from '../context/AppContext';
import { isHoliday, formatDate } from '../utils/dateUtils';
import { Link } from 'react-router-dom';

// --- CELL COMPONENTS (Internal) ---

const PERCENTAGE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5);

const AllocationCell: React.FC<{
  assignment: Assignment;
  date: string;
  isNonWorkingDay: boolean;
}> = React.memo(({ assignment, date, isNonWorkingDay }) => {
  const { allocations, updateAllocation } = useAllocationsContext();
  const percentage = allocations[assignment.id!]?.[date] || 0;

  if (isNonWorkingDay) {
    return (
        <div className="w-full h-full flex items-center justify-center bg-surface-container text-on-surface-variant text-xs cursor-default">
            -
        </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAllocation(assignment.id!, date, parseInt(e.target.value, 10));
  };

  return (
    <div className="w-full h-full flex items-center justify-center">
        <select
            value={percentage}
            onChange={handleChange}
            className="w-full h-full bg-transparent border-0 text-center appearance-none text-sm focus:ring-0 focus:outline-none text-on-surface cursor-pointer"
            onClick={(e) => e.stopPropagation()}
        >
        {PERCENTAGE_OPTIONS.map((p) => (
            <option key={p} value={p}>
            {p > 0 ? `${p}%` : '-'}
            </option>
        ))}
        </select>
    </div>
  );
});

const DailyTotalCell: React.FC<{ resource: Resource; date: string; isNonWorkingDay: boolean; resourceAssignments: Assignment[] }> = React.memo(({ resource, date, isNonWorkingDay, resourceAssignments }) => {
  const { allocations } = useAllocationsContext();
  const total = useMemo(() => resourceAssignments.reduce((sum, a) => sum + (allocations[a.id!]?.[date] || 0), 0), [resourceAssignments, allocations, date]);
  const maxPercentage = resource.maxStaffingPercentage ?? 100;
  
  let cellColor: string;
  if (isNonWorkingDay) cellColor = 'bg-surface-container text-on-surface-variant';
  else if (total > maxPercentage) cellColor = 'bg-error-container text-on-error-container';
  else if (total === maxPercentage) cellColor = 'bg-tertiary-container text-on-tertiary-container';
  else if (total > 0) cellColor = 'bg-yellow-container text-on-yellow-container';
  else cellColor = 'bg-transparent';
  
  return (
    <div className={`w-full h-full flex items-center justify-center text-sm font-semibold ${cellColor}`}>
        {isNonWorkingDay ? '-' : total > 0 ? `${total}%` : '-'}
    </div>
  );
});

// --- GRID COMPONENT ---

interface TimeColumn {
    label: string;
    subLabel: string;
    startDate: Date;
    endDate: Date;
    isNonWorkingDay: boolean;
    dateIso: string;
}

interface VirtualStaffingGridProps {
    resources: Resource[];
    timeColumns: TimeColumn[];
    assignments: Assignment[];
    viewMode: 'day' | 'week' | 'month';
    projectsById: Map<string, any>;
    clientsById: Map<string, any>;
    rolesById: Map<string, any>;
    onAddAssignment: (resourceId: string) => void;
    onBulkEdit: (assignment: Assignment) => void;
    onDeleteAssignment: (assignment: Assignment) => void;
}

type VirtualRow = 
    | { type: 'RESOURCE'; resource: Resource; key: string }
    | { type: 'ASSIGNMENT'; resource: Resource; assignment: Assignment; key: string };

const VirtualStaffingGrid: React.FC<VirtualStaffingGridProps> = ({
    resources,
    timeColumns,
    assignments,
    viewMode,
    projectsById,
    clientsById,
    rolesById,
    onAddAssignment,
    onBulkEdit,
    onDeleteAssignment
}) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const { companyCalendar } = useEntitiesContext();

    // 1. Flatten Data Structure for Virtualization
    const { flatRows, assignmentsByResource } = useMemo(() => {
        const rows: VirtualRow[] = [];
        const map = new Map<string, Assignment[]>();

        // Pre-group assignments
        assignments.forEach(a => {
            if (!map.has(a.resourceId)) map.set(a.resourceId, []);
            map.get(a.resourceId)!.push(a);
        });

        resources.forEach(resource => {
            rows.push({ type: 'RESOURCE', resource, key: `res-${resource.id}` });
            const resAssignments = map.get(resource.id!) || [];
            resAssignments.forEach(assignment => {
                rows.push({ type: 'ASSIGNMENT', resource, assignment, key: `asg-${assignment.id}` });
            });
        });
        return { flatRows: rows, assignmentsByResource: map };
    }, [resources, assignments]);

    // 2. Setup Virtualizers
    const rowVirtualizer = useVirtualizer({
        count: flatRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => 50, // Fixed height for rows
        overscan: 10,
    });

    // Total columns = 1 (Info) + Time Columns
    const columnVirtualizer = useVirtualizer({
        horizontal: true,
        count: 1 + timeColumns.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => index === 0 ? 300 : (viewMode === 'day' ? 70 : 120),
        overscan: 5,
    });

    const INFO_COL_WIDTH = 300;

    return (
        <div 
            ref={parentRef} 
            className="h-full w-full overflow-auto bg-surface rounded-2xl shadow border border-outline-variant relative"
            style={{ contain: 'strict' }}
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: `${columnVirtualizer.getTotalSize()}px`,
                    position: 'relative',
                }}
            >
                {/* --- HEADER ROW (Sticky Top) --- */}
                <div className="sticky top-0 z-30 h-[56px] flex bg-surface-container-low border-b border-outline-variant shadow-sm w-full">
                     {/* Info Header (Sticky Left & Top) */}
                     <div 
                        className="sticky left-0 z-40 h-full flex items-center justify-between px-4 bg-surface-container-low border-r border-outline-variant font-semibold text-sm text-on-surface"
                        style={{ width: `${INFO_COL_WIDTH}px`, minWidth: `${INFO_COL_WIDTH}px` }}
                     >
                         <span>Risorsa / Progetto</span>
                     </div>
                     
                     {/* Date Headers (Virtual) */}
                     {columnVirtualizer.getVirtualItems().map((virtualCol) => {
                         if (virtualCol.index === 0) return null; // Skip info column, handled manually above
                         const dateCol = timeColumns[virtualCol.index - 1];
                         return (
                             <div
                                 key={virtualCol.key}
                                 style={{
                                     position: 'absolute',
                                     top: 0,
                                     left: 0,
                                     width: `${virtualCol.size}px`,
                                     height: '56px',
                                     transform: `translateX(${virtualCol.start}px)`,
                                 }}
                                 className={`
                                     flex flex-col items-center justify-center border-r border-outline-variant px-1 text-center
                                     ${dateCol.isNonWorkingDay ? 'bg-surface-container/50' : 'bg-surface-container-low'}
                                 `}
                             >
                                 <span className={`text-sm font-medium ${dateCol.isNonWorkingDay ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                                     {dateCol.label}
                                 </span>
                                 {dateCol.subLabel && (
                                     <span className="text-[10px] text-on-surface-variant leading-none mt-0.5">
                                         {dateCol.subLabel}
                                     </span>
                                 )}
                             </div>
                         );
                     })}
                </div>

                {/* --- DATA ROWS --- */}
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = flatRows[virtualRow.index];
                    const isResourceRow = row.type === 'RESOURCE';

                    return (
                        <React.Fragment key={virtualRow.key}>
                            {/* Row Container: We need a container for absolute positioning of cells relative to the row top? 
                                No, with 2D virtualization, cells are positioned absolute relative to the BIG grid container.
                                But we want to process row by row to easily handle the "Resource Info" cell.
                            */}
                            
                            {/* 1. Resource/Project Info Cell (Sticky Left) */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: `${INFO_COL_WIDTH}px`,
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                className={`
                                    sticky left-0 z-20 flex items-center px-4 border-r border-b border-outline-variant
                                    ${isResourceRow ? 'bg-surface-container font-medium' : 'bg-surface hover:bg-surface-container-low pl-8'}
                                `}
                            >
                                {isResourceRow ? (
                                    <div className="flex items-center justify-between w-full overflow-hidden">
                                        <div className="flex flex-col min-w-0">
                                            <Link to={`/workload?resourceId=${row.resource.id}`} className="text-primary hover:underline truncate text-sm">
                                                {row.resource.name}
                                            </Link>
                                            <span className="text-[11px] font-normal text-on-surface-variant truncate">
                                                {rolesById.get(row.resource.roleId)?.name}
                                            </span>
                                        </div>
                                        <button onClick={() => onAddAssignment(row.resource.id!)} className="p-1 rounded-full hover:bg-surface-container-high text-primary flex-shrink-0 ml-2" title="Assegna Progetto">
                                            <span className="material-symbols-outlined text-lg">add_circle</span>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between w-full overflow-hidden">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-sm text-on-surface truncate" title={projectsById.get(row.assignment.projectId)?.name}>
                                                {projectsById.get(row.assignment.projectId)?.name || 'N/D'}
                                            </span>
                                            <span className="text-[10px] text-on-surface-variant truncate">
                                                {clientsById.get(projectsById.get(row.assignment.projectId)?.clientId || '')?.name}
                                            </span>
                                        </div>
                                        <div className="flex space-x-1 flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => onBulkEdit(row.assignment)} className="text-primary hover:bg-surface-container p-1 rounded" title="Modifica Massiva">
                                                <span className="material-symbols-outlined text-sm">calendar_month</span>
                                            </button>
                                            <button onClick={() => onDeleteAssignment(row.assignment)} className="text-error hover:bg-surface-container p-1 rounded" title="Rimuovi">
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 2. Time Cells */}
                            {columnVirtualizer.getVirtualItems().map((virtualCol) => {
                                if (virtualCol.index === 0) return null; // Skip Info Col
                                const dateCol = timeColumns[virtualCol.index - 1];
                                if (!dateCol) return null;

                                return (
                                    <div
                                        key={virtualCol.key}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: `${virtualCol.size}px`,
                                            height: `${virtualRow.size}px`,
                                            transform: `translateX(${virtualCol.start}px) translateY(${virtualRow.start}px)`,
                                        }}
                                        className={`
                                            border-b border-r border-outline-variant flex items-center justify-center
                                            ${isResourceRow ? 'bg-surface-container-low' : 'bg-surface hover:bg-surface-container-low'}
                                        `}
                                    >
                                        {isResourceRow ? (
                                            viewMode === 'day' ? (
                                                <DailyTotalCell 
                                                    resource={row.resource} 
                                                    date={dateCol.dateIso} 
                                                    isNonWorkingDay={dateCol.isNonWorkingDay || isHoliday(dateCol.startDate, row.resource.location, companyCalendar)} 
                                                    resourceAssignments={assignmentsByResource.get(row.resource.id!) || []} 
                                                />
                                            ) : (
                                                // Simplified aggregated view for resource row if needed
                                                <span className="text-xs text-on-surface-variant">-</span>
                                            )
                                        ) : (
                                            viewMode === 'day' ? (
                                                <AllocationCell 
                                                    assignment={row.assignment} 
                                                    date={dateCol.dateIso} 
                                                    isNonWorkingDay={dateCol.isNonWorkingDay || isHoliday(dateCol.startDate, row.resource.location, companyCalendar)} 
                                                />
                                            ) : (
                                                <span className="text-xs text-on-surface-variant">-</span>
                                            )
                                        )}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

export default VirtualStaffingGrid;
