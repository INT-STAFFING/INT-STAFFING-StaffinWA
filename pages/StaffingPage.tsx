
/**
 * @file StaffingPage.tsx
 * @description Pagina principale per la visualizzazione e la gestione dello staffing delle risorse sui progetti.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAllocationsContext, useAppState } from '../context/AppContext';
import { useResourcesContext } from '../context/ResourcesContext';
import { useProjectsContext } from '../context/ProjectsContext';
import { useLookupContext } from '../context/LookupContext';
import { useHRContext } from '../context/HRContext';
import { Resource, Assignment, LeaveRequest, LeaveType, Project, Client, Role } from '../types';
import {
  getCalendarDays,
  formatDate,
  addDays,
  isHoliday,
  getWorkingDaysBetween,
  formatDateFull,
  formatDateSynthetic
} from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import ConfirmationModal from '../components/ConfirmationModal';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';
import ExportButton from '../components/ExportButton';
import {
  FormDialog,
  FormFieldDefinition,
  Option,
  assignmentSchema,
  bulkAssignmentSchema,
  bulkFormFields,
  buildAssignmentFormFields,
  AssignmentFormValues,
  BulkAssignmentFormValues,
} from '../components/forms';

type ViewMode = 'day' | 'week' | 'month';

// Helper per generare chiave lookup assenze
const getLeaveKey = (resourceId: string, dateStr: string) => `${resourceId}_${dateStr}`;

// Constant empty array for stable reference
const EMPTY_ASSIGNMENTS: Assignment[] = [];

// Helper per icona
const getLeaveIcon = (typeName: string) => {
    const lower = typeName.toLowerCase();
    if (lower.includes('ferie')) return 'beach_access';
    if (lower.includes('malattia')) return 'medical_services';
    if (lower.includes('permesso')) return 'schedule';
    if (lower.includes('studio')) return 'school';
    if (lower.includes('smart')) return 'home_work'; 
    return 'block'; 
};

/**
 * Celle di allocazione giornaliera modificabile (per singola assegnazione).
 */
interface AllocationCellProps {
  assignment: Assignment;
  date: string; // YYYY-MM-DD
  isNonWorkingDay: boolean;
  activeLeave?: LeaveRequest;
  leaveType?: LeaveType;
}

const AllocationCell: React.FC<AllocationCellProps> = React.memo(
  ({ assignment, date, isNonWorkingDay, activeLeave, leaveType }) => {
    const { allocations, updateAllocation } = useAllocationsContext();
    // Context value (authoritative)
    const contextPercentage = allocations[assignment.id!]?.[date] || 0;
    
    // Local state for immediate UI feedback (Debounced)
    const [localValue, setLocalValue] = useState<number | string>(contextPercentage === 0 ? '' : contextPercentage);

    // Sync local state if context changes externally (e.g. bulk update, initial load)
    useEffect(() => {
        setLocalValue(contextPercentage === 0 ? '' : contextPercentage);
    }, [contextPercentage]);

    // DEBOUNCE LOGIC: Update context only after 400ms of inactivity
    useEffect(() => {
        const numericValue = localValue === '' ? 0 : Number(localValue);
        
        // Avoid triggering update if value hasn't effectively changed
        if (numericValue === contextPercentage) return;

        const timer = setTimeout(() => {
            updateAllocation(assignment.id!, date, numericValue);
        }, 400);

        return () => clearTimeout(timer);
    }, [localValue, assignment.id, date, updateAllocation, contextPercentage]);

    // Logic: If full day leave, block interaction. If half day, show icon but allow edit.
    if (activeLeave && leaveType && !activeLeave.isHalfDay) {
         return (
            <td 
                className="border-t border-outline-variant p-0 text-center relative cursor-not-allowed opacity-70"
                style={{ backgroundColor: `${leaveType.color}20` }} 
                title={`${leaveType.name}: ${activeLeave.notes || ''}`}
            >
                <span className="material-symbols-outlined text-base align-middle" style={{ color: leaveType.color }}>
                    {getLeaveIcon(leaveType.name)}
                </span>
            </td>
        );
    }

    if (isNonWorkingDay) {
      return (
        <td className="border-t border-outline-variant p-0 text-center bg-surface-container">
          <span className="text-sm text-on-surface-variant">-</span>
        </td>
      );
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawVal = e.target.value;
      
      // Allow empty string for better UX while deleting
      if (rawVal === '') {
          setLocalValue('');
          return;
      }

      let val = parseInt(rawVal, 10);
      if (isNaN(val)) val = 0;
      if (val > 100) val = 100;
      if (val < 0) val = 0;
      
      setLocalValue(val);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    return (
      <td className="border-t border-outline-variant p-0 text-center relative h-10">
        {activeLeave && activeLeave.isHalfDay && leaveType && (
            <div 
                className="absolute top-0 right-0 w-3 h-3 rounded-bl bg-opacity-50 pointer-events-none z-10"
                style={{ backgroundColor: leaveType.color }}
                title="Mezza giornata di assenza"
            />
        )}
        <input
          type="number"
          min="0"
          max="100"
          step="5"
          value={localValue}
          placeholder={localValue === '' ? '-' : ''}
          onChange={handleChange}
          onFocus={handleFocus}
          className="w-full h-full bg-transparent border-0 text-center text-sm focus:ring-2 focus:ring-inset focus:ring-primary text-on-surface p-0 m-0 appearance-none"
        />
      </td>
    );
  }
);

/**
 * Cella di allocazione media aggregata (settimana/mese) per una singola assegnazione.
 */
const ReadonlyAggregatedAllocationCell: React.FC<{
  assignment: Assignment;
  startDate: Date;
  endDate: Date;
}> = React.memo(({ assignment, startDate, endDate }) => {
  const { companyCalendar } = useLookupContext();
  const { resources } = useResourcesContext();
  const { allocations } = useAllocationsContext();
  const resource = resources.find((r) => r.id === assignment.resourceId);

  const averageAllocation = useMemo(() => {
    if (!resource) return 0;

    const effectiveEndDate =
      resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
        ? new Date(resource.lastDayOfWork)
        : endDate;
    // Use getTime to compare Date objects accurately
    if (startDate.getTime() > effectiveEndDate.getTime()) return 0;

    const workingDays = getWorkingDaysBetween(
      startDate,
      effectiveEndDate,
      companyCalendar,
      resource.location
    );
    if (workingDays === 0) return 0;

    let totalPersonDays = 0;
    const assignmentAllocations = allocations[assignment.id!];

    if (assignmentAllocations) {
      let currentDate = new Date(startDate.getTime()); // Copy
      while (currentDate.getTime() <= effectiveEndDate.getTime()) {
        const dateStr = formatDate(currentDate, 'iso');
        if (assignmentAllocations[dateStr]) {
          const day = currentDate.getUTCDay();
          if (
            !isHoliday(currentDate, resource.location, companyCalendar) &&
            day !== 0 &&
            day !== 6
          ) {
            totalPersonDays += assignmentAllocations[dateStr] / 100;
          }
        }
        // Iterate safely using UTC
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    return (totalPersonDays / workingDays) * 100;
  }, [assignment.id, startDate, endDate, allocations, companyCalendar, resource]);

  const cellColor = useMemo(() => {
    if (averageAllocation > 100)
      return 'bg-error-container text-on-error-container';
    if (averageAllocation >= 95 && averageAllocation <= 100)
      return 'bg-tertiary-container text-on-tertiary-container';
    if (averageAllocation > 0 && averageAllocation < 95)
      return 'bg-yellow-container text-on-yellow-container';
    return 'bg-transparent';
  }, [averageAllocation]);

  return (
    <td
      className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
    >
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </td>
  );
});

/**
 * Cella totale giornaliera per risorsa (somma di tutte le assegnazioni).
 */
interface DailyTotalCellProps {
  resource: Resource;
  date: string;
  isNonWorkingDay: boolean;
  resourceAssignments: Assignment[];
  activeLeave?: LeaveRequest;
  leaveType?: LeaveType;
}

const DailyTotalCell: React.FC<DailyTotalCellProps> = React.memo(
  ({ resource, date, isNonWorkingDay, resourceAssignments, activeLeave, leaveType }) => {
    const { allocations } = useAllocationsContext();

    const total = useMemo(() => {
      return resourceAssignments.reduce((sum, a) => {
        return sum + (allocations[a.id!]?.[date] || 0);
      }, 0);
    }, [resourceAssignments, allocations, date]);

    // If full day leave, show leave icon only
    if (activeLeave && leaveType && !activeLeave.isHalfDay) {
         return (
            <td 
                className="border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold"
                style={{ backgroundColor: `${leaveType.color}40`, color: leaveType.color }} 
                title={leaveType.name}
            >
                <span className="material-symbols-outlined text-lg align-middle">
                    {getLeaveIcon(leaveType.name)}
                </span>
            </td>
        );
    }

    let effectiveNonWorking = isNonWorkingDay;
    if (resource.lastDayOfWork && date > resource.lastDayOfWork) {
      effectiveNonWorking = true;
    }

    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    
    // Calculate capacity impact for coloring
    let capacityUsed = total;
    if (activeLeave && activeLeave.isHalfDay && leaveType?.affectsCapacity) {
        capacityUsed += 50; // Add 50% load for half day leave
    }

    let cellColor: string;

    if (effectiveNonWorking) {
      cellColor = 'bg-surface-container text-on-surface-variant';
    } else if (capacityUsed > maxPercentage) {
      cellColor = 'bg-error-container text-on-error-container';
    } else if (capacityUsed === maxPercentage) {
      cellColor = 'bg-tertiary-container text-on-tertiary-container';
    } else if (total > 0) {
      cellColor = 'bg-yellow-container text-on-yellow-container';
    } else if (activeLeave && activeLeave.isHalfDay) {
        cellColor = 'bg-surface-container-high'; // Half day leave but no work allocation
    } else {
      cellColor = 'bg-surface-container-low';
    }

    if (effectiveNonWorking) {
      return (
        <td
          className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
        >
          -
        </td>
      );
    }

    return (
      <td
        className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
      >
        {activeLeave && activeLeave.isHalfDay && (
            <span className="material-symbols-outlined text-xs mr-1 align-middle opacity-50">schedule</span>
        )}
        {total > 0 ? `${total}%` : (activeLeave && activeLeave.isHalfDay ? '1/2' : '-')}
      </td>
    );
  }
);

/**
 * Cella totale aggregata (settimana/mese) per risorsa.
 */
const ReadonlyAggregatedTotalCell: React.FC<{
  resource: Resource;
  startDate: Date;
  endDate: Date;
}> = React.memo(({ resource, startDate, endDate }) => {
  const { assignments } = useProjectsContext();
  const { companyCalendar } = useLookupContext();
  const { allocations } = useAllocationsContext();

  const averageAllocation = useMemo(() => {
    const effectiveEndDate =
      resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
        ? new Date(resource.lastDayOfWork)
        : endDate;
    if (startDate.getTime() > effectiveEndDate.getTime()) return 0;

    const workingDays = getWorkingDaysBetween(
      startDate,
      effectiveEndDate,
      companyCalendar,
      resource.location
    );
    if (workingDays === 0) return 0;

    const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
    let totalPersonDays = 0;

    resourceAssignments.forEach((assignment) => {
      const assignmentAllocations = allocations[assignment.id!];
      if (assignmentAllocations) {
        let currentDate = new Date(startDate.getTime()); // Copy for safety
        while (currentDate.getTime() <= effectiveEndDate.getTime()) {
          const dateStr = formatDate(currentDate, 'iso');
          if (assignmentAllocations[dateStr]) {
            const day = currentDate.getUTCDay();
            if (
              !isHoliday(currentDate, resource.location, companyCalendar) &&
              day !== 0 &&
              day !== 6
            ) {
              totalPersonDays += assignmentAllocations[dateStr] / 100;
            }
          }
          currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
      }
    });

    return (totalPersonDays / workingDays) * 100;
  }, [resource, startDate, endDate, assignments, allocations, companyCalendar]);

  const cellColor = useMemo(() => {
    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    const roundedAverage = Math.round(averageAllocation);
    if (roundedAverage > maxPercentage)
      return 'bg-error-container text-on-error-container';
    if (roundedAverage === maxPercentage)
      return 'bg-tertiary-container text-on-tertiary-container';
    if (roundedAverage > 0 && roundedAverage < maxPercentage)
      return 'bg-yellow-container text-on-yellow-container';
    return 'bg-surface-container-low';
  }, [averageAllocation, resource.maxStaffingPercentage]);

  return (
    <td
      className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
    >
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </td>
  );
});

/**
 * Tipo colonna calendario (con dateIso per day-view e mobile).
 */
interface TimeColumn {
  label: string;
  subLabel: string;
  startDate: Date;
  endDate: Date;
  isNonWorkingDay?: boolean;
  dateIso?: string; // valorizzato in viewMode 'day' e sempre su mobile
}

// --- MOBILE COMPONENTS ---

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
                  
                  // Debounce logic specifically for mobile slider to avoid lag
                  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                       const val = parseInt(e.target.value, 10);
                       updateAllocation(assignment.id!, d.dateIso, val);
                  };

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
                                      onChange={handleChange}
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
  data: any;
  dates: { dateIso: string; label: string; isNonWorkingDay: boolean }[];
}> = ({ data, dates }) => {
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  const getLoadColor = (load: number) => {
      const max = data.resource.maxStaffingPercentage;
      if (load > max) return 'bg-error text-on-error';
      if (load === max) return 'bg-tertiary text-on-tertiary';
      if (load > 0) return 'bg-yellow-container text-on-yellow-container';
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
              <div className="w-full bg-surface-container-highest rounded-full h-2.5 mt-1">
                  <div 
                      className={`h-2.5 rounded-full ${getBarColor(data.totalLoad)}`} 
                      style={{ width: `${Math.min(data.totalLoad, 100)}%` }}
                  ></div>
              </div>

              {/* Assignments List */}
              <div className="space-y-2 mt-1">
                  {data.assignments.length > 0 ? (
                      data.assignments.map((a: any) => (
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
};

// --- Pagina Principale ---

export const StaffingPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { resources, roles } = useResourcesContext();
  const { projects, assignments, clients, addMultipleAssignments, deleteAssignment } = useProjectsContext();
  const { companyCalendar } = useLookupContext();
  const { leaveRequests, leaveTypes } = useHRContext();
  const { isActionLoading } = useAppState();
  const { allocations, bulkUpdateAllocations } = useAllocationsContext();

  // Modali Desktop
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [bulkFormData, setBulkFormData] = useState<BulkAssignmentFormValues>({ startDate: '', endDate: '', percentage: 50 });
  const [newAssignmentData, setNewAssignmentData] = useState<AssignmentFormValues>({ resourceId: '', projectIds: [] });

  // Filters State (Input)
  const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '', projectManager: '' });
  // Debounced Filter State (For Logic)
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  // Debounce Effect for Filters
  useEffect(() => {
      const handler = setTimeout(() => {
          setDebouncedFilters(filters);
      }, 400);
      return () => clearTimeout(handler);
  }, [filters]);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const projectsById = useMemo(() => new Map<string, Project>(projects.map((p) => [p.id!, p])), [projects]);
  const clientsById = useMemo(() => new Map<string, Client>(clients.map((c) => [c.id!, c])), [clients]);
  const rolesById = useMemo(() => new Map<string, Role>(roles.map((r) => [r.id!, r])), [roles]);

  // --- Time Calculation ---
  const timeColumns = useMemo(() => {
    const cols: { label: string; subLabel: string; startDate: Date; endDate: Date; isNonWorkingDay: boolean; dateIso: string; }[] = [];
    let d = new Date(currentDate);

    if (isMobile) {
        let daysToGenerate = 1;
        if (viewMode === 'week') {
             const day = d.getUTCDay();
             const diff = day === 0 ? 6 : day - 1;
             d.setUTCDate(d.getUTCDate() - diff);
             daysToGenerate = 7;
        } else if (viewMode === 'month') {
             d.setUTCDate(1);
             daysToGenerate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
        }

        for (let i = 0; i < daysToGenerate; i++) {
            const day = new Date(d);
            day.setUTCDate(d.getUTCDate() + i);
            const dayOfWeek = day.getUTCDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const dateIso = formatDate(day, 'iso');
            const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
            cols.push({ 
                label: formatDate(day, 'day') + ' ' + formatDateSynthetic(day), 
                subLabel: '', 
                startDate: day, 
                endDate: day, 
                isNonWorkingDay: isWeekend || !!holiday, 
                dateIso 
            });
        }
        return cols;
    }

    // Desktop Logic
    if (viewMode === 'day') {
      return getCalendarDays(d, 14).map((day) => {
        const dayOfWeek = day.getUTCDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateIso = formatDate(day, 'iso');
        const holiday = companyCalendar.find((e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY');
        return { label: formatDateSynthetic(day), subLabel: formatDate(day, 'day'), startDate: day, endDate: day, isNonWorkingDay: isWeekend || !!holiday, dateIso };
      });
    }
    if (viewMode === 'week') {
      const day = d.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setUTCDate(d.getUTCDate() - diff);
      
      for (let i = 0; i < 12; i++) {
        const startOfWeek = new Date(d);
        const endOfWeek = addDays(new Date(d), 6);
        cols.push({ label: `${formatDateSynthetic(startOfWeek)} - ${formatDateSynthetic(endOfWeek)}`, subLabel: '', startDate: startOfWeek, endDate: endOfWeek, isNonWorkingDay: false, dateIso: '' });
        d.setUTCDate(d.getUTCDate() + 7);
      }
    } else {
      d.setUTCDate(1);
      for (let i = 0; i < 12; i++) {
        const startOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
        const endOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
        
        // Month name uses local locale but based on UTC date object
        cols.push({ label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }), subLabel: '', startDate: startOfMonth, endDate: endOfMonth, isNonWorkingDay: false, dateIso: '' });
        d.setUTCMonth(d.getUTCMonth() + 1);
      }
    }
    return cols;
  }, [currentDate, viewMode, companyCalendar, isMobile]);

  const handlePrev = useCallback(() => setCurrentDate(prev => {
    const newDate = new Date(prev);
    if (viewMode === 'week') newDate.setUTCDate(newDate.getUTCDate() - 7);
    else if (viewMode === 'month') newDate.setUTCMonth(newDate.getUTCMonth() - 1);
    else newDate.setUTCDate(newDate.getUTCDate() - 1);
    return newDate;
  }), [viewMode]);

  const handleNext = useCallback(() => setCurrentDate(prev => {
    const newDate = new Date(prev);
    if (viewMode === 'week') newDate.setUTCDate(newDate.getUTCDate() + 7);
    else if (viewMode === 'month') newDate.setUTCMonth(newDate.getUTCMonth() + 1);
    else newDate.setUTCDate(newDate.getUTCDate() + 1);
    return newDate;
  }), [viewMode]);

  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  const openBulkModal = useCallback((assignment: Assignment) => { setSelectedAssignment(assignment); setBulkFormData({ startDate: '', endDate: '', percentage: 50 }); setBulkModalOpen(true); }, []);
  const openNewAssignmentModal = useCallback((resourceId: string = '') => { setNewAssignmentData({ resourceId, projectIds: [] }); setAssignmentModalOpen(true); }, []);

  const handleBulkSubmit = (values: BulkAssignmentFormValues) => {
      if (!selectedAssignment) return;
      bulkUpdateAllocations(selectedAssignment.id!, values.startDate, values.endDate, values.percentage);
      setBulkFormData(values);
      setBulkModalOpen(false);
  };
  const handleNewAssignmentSubmit = (values: AssignmentFormValues) => {
      if (values.resourceId && values.projectIds.length > 0) {
          const assignmentsToCreate = values.projectIds.map(projectId => ({ resourceId: values.resourceId, projectId }));
          addMultipleAssignments(assignmentsToCreate);
          setNewAssignmentData(values);
          setAssignmentModalOpen(false);
      }
  };
  
  const handleFilterChange = useCallback((name: string, value: string) => {
      setFilters(prev => ({ ...prev, [name]: value }));
      setCurrentPage(1);
  }, []);
  
  const clearFilters = useCallback(() => {
      setFilters({ resourceId: '', projectId: '', clientId: '', projectManager: '' });
      setCurrentPage(1);
  }, []);

  const getResourceById = useCallback((id: string) => resources.find((r) => r.id === id), [resources]);
  const getProjectById = useCallback((id: string) => projectsById.get(id), [projectsById]);

  // --- Data Processing ---
  
  // 1. Filter Assignments based on Project/Client filters FIRST (Using DEBOUNCED filters)
  const filteredAssignments = useMemo(() => {
      return assignments.filter(a =>
        (!debouncedFilters.projectId || a.projectId === debouncedFilters.projectId) &&
        (!debouncedFilters.clientId || projectsById.get(a.projectId)?.clientId === debouncedFilters.clientId) &&
        (!debouncedFilters.projectManager || projectsById.get(a.projectId)?.projectManager === debouncedFilters.projectManager)
      );
  }, [assignments, debouncedFilters, projectsById]);

  // 2. Determine Relevant Resource IDs (Using DEBOUNCED filters)
  const relevantResourceIds = useMemo(() => {
      if (debouncedFilters.projectId || debouncedFilters.clientId || debouncedFilters.projectManager) {
          return new Set(filteredAssignments.map(a => a.resourceId));
      }
      return null; 
  }, [filteredAssignments, debouncedFilters]);

  // 3. Filter Resources List (Using DEBOUNCED filters)
  const displayResources = useMemo(() => {
      // Explicitly filter out resigned resources (robust check)
      let visible = resources.filter(r => r.resigned !== true);
      
      if (debouncedFilters.resourceId) {
          visible = visible.filter(r => r.id === debouncedFilters.resourceId);
      }
      
      if (relevantResourceIds) {
          visible = visible.filter(r => relevantResourceIds.has(r.id!));
      }
      
      return visible.sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, debouncedFilters.resourceId, relevantResourceIds]);

  // 4. Pagination
  const paginatedResources = useMemo(() => {
      if (isMobile) return displayResources; 
      const start = (currentPage - 1) * itemsPerPage;
      return displayResources.slice(start, start + itemsPerPage);
  }, [displayResources, currentPage, itemsPerPage, isMobile]);

  // 5. Group Assignments by Resource (Only for visible ones)
  const assignmentsByResource = useMemo(() => {
      const map = new Map<string, Assignment[]>();
      const visibleIds = new Set(paginatedResources.map(r => r.id));
      
      filteredAssignments.forEach(a => {
          if (visibleIds.has(a.resourceId)) {
              if (!map.has(a.resourceId)) {
                  map.set(a.resourceId, []);
              }
              map.get(a.resourceId)!.push(a);
          }
      });
      return map;
  }, [filteredAssignments, paginatedResources]);

  // 6. Pre-calculate Leaves Lookup (Only for visible resources & date range)
  const leavesLookup = useMemo(() => {
      const map = new Map<string, { request: LeaveRequest; type: LeaveType }>();
      if (viewMode !== 'day') return map; // Optimization: Only needed for day view

      // Only process approved leaves
      const approvedLeaves = leaveRequests.filter(l => l.status === 'APPROVED');
      
      const rangeStart = timeColumns[0].startDate;
      const rangeEnd = timeColumns[timeColumns.length - 1].endDate;
      const rangeStartStr = formatDate(rangeStart, 'iso');
      const rangeEndStr = formatDate(rangeEnd, 'iso');

      approvedLeaves.forEach(req => {
          // Skip if leave is outside visible range
          if (req.endDate < rangeStartStr || req.startDate > rangeEndStr) return;
          
          // Skip if resource is not visible
          // Note: Ideally we check against paginatedResources, but checking all active resources is fast enough here
          
          const type = leaveTypes.find(t => t.id === req.typeId);
          if (!type) return;

          let d = new Date(req.startDate);
          const end = new Date(req.endDate);
          
          // Optimization: Avoid long loops using date difference logic
          if (d.getTime() < rangeStart.getTime()) d = new Date(rangeStart.getTime());
          const effectiveEnd = end.getTime() > rangeEnd.getTime() ? rangeEnd : end;

          while (d.getTime() <= effectiveEnd.getTime()) {
              const dateStr = d.toISOString().split('T')[0];
              const key = getLeaveKey(req.resourceId, dateStr);
              map.set(key, { request: req, type });
              d.setUTCDate(d.getUTCDate() + 1);
          }
      });
      return map;
  }, [leaveRequests, leaveTypes, viewMode, timeColumns]);


  // --- Mobile Data Prep ---
  const mobileDisplayData = useMemo(() => {
      if (!isMobile) return [];
      
      return paginatedResources.map(resource => {
          const resAssignments = assignmentsByResource.get(resource.id!) || [];
          
          // Calculate load for visible period
          let totalLoadSum = 0;
          let workingDaysCount = 0;

          const assignmentsDetails = resAssignments.map(assignment => {
              let assignmentLoadSum = 0;
              timeColumns.forEach(col => {
                   if (!col.isNonWorkingDay && col.dateIso) {
                       assignmentLoadSum += allocations[assignment.id!]?.[col.dateIso] || 0;
                   }
              });
              // Simple average over visible working days
              const avgLoad = timeColumns.filter(c => !c.isNonWorkingDay).length > 0 
                ? assignmentLoadSum / timeColumns.filter(c => !c.isNonWorkingDay).length 
                : 0;
              
              const project = projectsById.get(assignment.projectId);
              const client = project && project.clientId ? clientsById.get(project.clientId) : undefined;

              return {
                  assignment,
                  projectName: project?.name || 'Unknown',
                  clientName: client?.name || 'Unknown',
                  avgLoad
              };
          });

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
  }, [isMobile, paginatedResources, assignmentsByResource, timeColumns, allocations, projectsById, clientsById, rolesById]);

  // --- Export Data Preparation ---
  const exportData = useMemo(() => {
    return paginatedResources.map(r => {
        const assigned = assignmentsByResource.get(r.id!) || [];
        const projectNames = assigned.map(a => projectsById.get(a.projectId)?.name).filter(Boolean).join(', ');
        
        return {
            Nome: r.name,
            Ruolo: rolesById.get(r.roleId)?.name || 'N/D',
            'Progetti Assegnati': projectNames,
            Sede: r.location,
            'Max %': r.maxStaffingPercentage,
            Email: r.email,
            'Tutor': resources.find(t => t.id === r.tutorId)?.name || '-'
        };
    });
  }, [paginatedResources, rolesById, resources, assignmentsByResource, projectsById]);


  // --- JSX ---

  const resourceOptions: Option[] = useMemo(
      // Ensure dropdown also filters out resigned resources strictly
      () => resources.filter((r) => r.resigned !== true).map((r) => ({ value: r.id!, label: r.name })),
      [resources]
  );
  const projectOptions: Option[] = useMemo(() => projects.map((p) => ({ value: p.id!, label: p.name })), [projects]);
  const activeProjectOptions: Option[] = useMemo(
      () => projects.filter((p) => p.status !== 'Completato').map((p) => ({ value: p.id!, label: p.name })),
      [projects]
  );
  const clientOptions: Option[] = useMemo(() => clients.map((c) => ({ value: c.id!, label: c.name })), [clients]);
  const projectManagerOptions: Option[] = useMemo(() => {
      const managers = [...new Set(projects.map((p) => p.projectManager).filter(Boolean) as string[])];
      return managers.sort().map((pm) => ({ value: pm, label: pm }));
  }, [projects]);

  const asyncResourceLoader = useCallback(
      async (query: string) => {
          const normalized = query.toLowerCase();
          return resourceOptions.filter(option => option.label.toLowerCase().includes(normalized));
      },
      [resourceOptions]
  );

  const asyncProjectLoader = useCallback(
      async (query: string) => {
          const normalized = query.toLowerCase();
          return activeProjectOptions.filter(option => option.label.toLowerCase().includes(normalized));
      },
      [activeProjectOptions]
  );

  const assignmentFormFields = useMemo<FormFieldDefinition[]>(() => {
      const fields = buildAssignmentFormFields(resourceOptions, activeProjectOptions);
      return fields.map((field) => {
          if (field.name === 'resourceId') {
              return { ...field, loadOptions: asyncResourceLoader };
          }
          if (field.name === 'projectIds') {
              return { ...field, loadOptions: asyncProjectLoader };
          }
          return field;
      });
  }, [resourceOptions, activeProjectOptions, asyncResourceLoader, asyncProjectLoader]);

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
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button onClick={() => openNewAssignmentModal()} className="flex items-center justify-center w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm"><span className="material-symbols-outlined mr-2 text-xl">add</span>Assegna Risorsa</button>
              <ExportButton data={exportData} title="Staffing" />
          </div>
        </div>
        
        {/* Filters */}
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
            <div className="bg-surface rounded-2xl shadow overflow-x-auto">
              <div className="max-h-[660px] overflow-y-auto">
                <table className="min-w-full divide-y divide-outline-variant">
                    <thead className="bg-surface-container-low sticky top-0 z-10">
                        <tr>
                            <th className="sticky left-0 bg-surface-container-low px-3 py-3.5 text-left text-sm font-semibold text-on-surface z-20" style={{ minWidth: '260px' }}>Risorsa / Progetto</th>
                            <th className="hidden md:table-cell px-3 py-3.5 text-left text-sm font-semibold text-on-surface">Cliente</th>
                            <th className="hidden md:table-cell px-3 py-3.5 text-left text-sm font-semibold text-on-surface">PM</th>
                            <th className="px-2 py-3.5 text-center text-sm font-semibold text-on-surface">Azioni</th>
                            {timeColumns.map((col, index) => (
                                <th key={index} className={`px-2 py-3.5 text-center text-sm font-semibold w-24 ${col.isNonWorkingDay ? 'bg-surface-container' : ''}`}>
                                    <div className="flex flex-col items-center">
                                        <span className={col.isNonWorkingDay ? 'text-on-surface-variant' : 'text-on-surface'}>{col.label}</span>
                                        {col.subLabel && <span className="text-xs text-on-surface-variant">{col.subLabel}</span>}
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                        {paginatedResources.map(resource => {
                            const role = rolesById.get(resource.roleId);
                            // Use EMPTY_ASSIGNMENTS if undefined to maintain stable reference for empty cases
                            const resourceAssignments = assignmentsByResource.get(resource.id!) || EMPTY_ASSIGNMENTS;
                            
                            return (
                                <React.Fragment key={resource.id}>
                                    {/* Resource Row */}
                                    <tr className="bg-surface-container font-bold">
                                        <td className="sticky left-0 bg-surface-container px-3 py-3 text-left text-sm z-9" colSpan={4}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex flex-col min-w-0">
                                                    <Link to={`/workload?resourceId=${resource.id}`} className="text-primary hover:underline truncate">{resource.name}</Link>
                                                    <span className="text-xs font-normal text-on-surface-variant">{role?.name} (Max: {resource.maxStaffingPercentage}%)</span>
                                                </div>
                                                <button onClick={() => openNewAssignmentModal(resource.id!)} className="p-1 rounded-full hover:bg-surface-container-high text-primary"><span className="material-symbols-outlined">add_circle</span></button>
                                            </div>
                                        </td>
                                        {timeColumns.map((col, index) => {
                                             if (viewMode === 'day') {
                                                const isDayHoliday = isHoliday(col.startDate, resource.location, companyCalendar);
                                                // Get cached leave info
                                                const leaveInfo = leavesLookup.get(getLeaveKey(resource.id!, col.dateIso));
                                                
                                                return (
                                                    <DailyTotalCell 
                                                        key={index} 
                                                        resource={resource} 
                                                        date={col.dateIso!} 
                                                        isNonWorkingDay={!!col.isNonWorkingDay || isDayHoliday} 
                                                        resourceAssignments={resourceAssignments} 
                                                        activeLeave={leaveInfo?.request}
                                                        leaveType={leaveInfo?.type}
                                                    />
                                                );
                                            }
                                            return <ReadonlyAggregatedTotalCell key={index} resource={resource} startDate={col.startDate} endDate={col.endDate} />;
                                        })}
                                    </tr>
                                    {/* Assignment Rows */}
                                    {resourceAssignments.map(assignment => {
                                        const project = projectsById.get(assignment.projectId);
                                        const client = project && project.clientId ? clientsById.get(project.clientId) : undefined;
                                        const isDeleting = isActionLoading(`deleteAssignment-${assignment.id}`);
                                        return (
                                            <tr key={assignment.id} className="group hover:bg-surface-container-low">
                                                 <td className="sticky left-0 bg-surface group-hover:bg-surface-container-low px-3 py-4 text-sm font-medium pl-8 z-9 truncate">
                                                    <Link to={`/projects?projectId=${project?.id}`} className="text-primary hover:underline">{project?.name || 'N/D'}</Link>
                                                 </td>
                                                 <td className="hidden md:table-cell px-3 py-4 text-sm text-on-surface-variant truncate">{client?.name || '-'}</td>
                                                 <td className="hidden md:table-cell px-3 py-4 text-sm text-on-surface-variant truncate">{project?.projectManager || '-'}</td>
                                                 <td className={`px-2 py-3 text-center ${isDeleting ? 'opacity-50' : ''}`}>
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button onClick={() => openBulkModal(assignment)} className="p-1 rounded-full hover:bg-surface-container text-primary"><span className="material-symbols-outlined">calendar_add_on</span></button>
                                                        <button onClick={() => setAssignmentToDelete(assignment)} className="p-1 rounded-full hover:bg-surface-container text-error"><span className="material-symbols-outlined">delete</span></button>
                                                    </div>
                                                 </td>
                                                 {timeColumns.map((col, index) => {
                                                    if (viewMode === 'day') {
                                                        const isDayHoliday = isHoliday(col.startDate, resource.location, companyCalendar);
                                                        // Pass leave info to block editing if needed
                                                        const leaveInfo = leavesLookup.get(getLeaveKey(resource.id!, col.dateIso));
                                                        
                                                        return (
                                                            <AllocationCell 
                                                                key={index} 
                                                                assignment={assignment} 
                                                                date={col.dateIso!} 
                                                                isNonWorkingDay={!!col.isNonWorkingDay || isDayHoliday} 
                                                                activeLeave={leaveInfo?.request}
                                                                leaveType={leaveInfo?.type}
                                                            />
                                                        );
                                                    }
                                                    return <ReadonlyAggregatedAllocationCell key={index} assignment={assignment} startDate={col.startDate} endDate={col.endDate} />;
                                                 })}
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
              </div>
              <Pagination 
                  currentPage={currentPage} 
                  totalItems={displayResources.length} 
                  itemsPerPage={itemsPerPage} 
                  onPageChange={setCurrentPage} 
                  onItemsPerPageChange={setItemsPerPage}
              />
            </div>
          )}
      </div>

      {/* Modali Comuni */}
      {assignmentToDelete && <ConfirmationModal isOpen={!!assignmentToDelete} onClose={() => setAssignmentToDelete(null)} onConfirm={() => { if (assignmentToDelete) { deleteAssignment(assignmentToDelete.id!); setAssignmentToDelete(null); } }} title="Conferma Rimozione" message={<>Sei sicuro di voler rimuovere l'assegnazione di <strong>{getResourceById(assignmentToDelete.resourceId)?.name}</strong> dal progetto <strong>{getProjectById(assignmentToDelete.projectId)?.name}</strong>?</>} isConfirming={isActionLoading(`deleteAssignment-${assignmentToDelete.id}`)} />}
      
      <FormDialog
          isOpen={isBulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
          title="Assegnazione Massiva"
          defaultValues={bulkFormData}
          onSubmit={handleBulkSubmit}
          fields={bulkFormFields}
          schema={bulkAssignmentSchema}
          submitLabel="Salva"
      />
      
      <FormDialog
          isOpen={isAssignmentModalOpen}
          onClose={() => setAssignmentModalOpen(false)}
          title="Assegna Risorsa a Progetto"
          defaultValues={newAssignmentData}
          onSubmit={handleNewAssignmentSubmit}
          fields={assignmentFormFields}
          schema={assignmentSchema}
          submitLabel="Aggiungi"
      />
    </div>
  );
};

export default StaffingPage;