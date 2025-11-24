
/**
 * @file StaffingPage.tsx
 * @description Pagina principale per la visualizzazione e la gestione dello staffing delle risorse sui progetti.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, LeaveRequest, LeaveType } from '../types';
import {
  getCalendarDays,
  formatDate,
  addDays,
  isHoliday,
  getWorkingDaysBetween,
  formatDateFull,
  formatDateSynthetic
} from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import { Link } from 'react-router-dom';
import Pagination from '../components/Pagination';

type ViewMode = 'day' | 'week' | 'month';

/**
 * Opzioni percentuali per le celle di allocazione (0–100% step 5).
 */
const PERCENTAGE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5);

// Helper per trovare l'assenza in una data specifica
const getActiveLeave = (resourceId: string, dateStr: string, leaves: LeaveRequest[]) => {
    return leaves.find(l => {
        return l.resourceId === resourceId && 
               l.status === 'APPROVED' &&
               dateStr >= l.startDate && 
               dateStr <= l.endDate;
    });
};

// Helper per icona
const getLeaveIcon = (typeName: string) => {
    const lower = typeName.toLowerCase();
    if (lower.includes('ferie')) return 'beach_access';
    if (lower.includes('malattia')) return 'medical_services';
    if (lower.includes('permesso')) return 'schedule';
    if (lower.includes('studio')) return 'school';
    if (lower.includes('smart')) return 'home_work'; // Smart working might not affect capacity, but if it does...
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
    const percentage = allocations[assignment.id!]?.[date] || 0;

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

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAllocation(assignment.id!, date, parseInt(e.target.value, 10));
    };

    return (
      <td className="border-t border-outline-variant p-0 text-center relative">
        {activeLeave && activeLeave.isHalfDay && leaveType && (
            <div 
                className="absolute top-0 right-0 w-3 h-3 rounded-bl bg-opacity-50 pointer-events-none z-10"
                style={{ backgroundColor: leaveType.color }}
                title="Mezza giornata di assenza"
            />
        )}
        <select
          value={percentage}
          onChange={handleChange}
          className="w-full h-full bg-transparent border-0 text-center appearance-none text-sm focus:ring-0 focus:outline-none text-on-surface"
        >
          {PERCENTAGE_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p > 0 ? `${p}%` : '-'}
            </option>
          ))}
        </select>
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
  const { companyCalendar, resources, leaveRequests, leaveTypes } = useEntitiesContext();
  const { allocations } = useAllocationsContext();
  const resource = resources.find((r) => r.id === assignment.resourceId);

  const averageAllocation = useMemo(() => {
    if (!resource) return 0;

    const effectiveEndDate =
      resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
        ? new Date(resource.lastDayOfWork)
        : endDate;
    if (startDate > effectiveEndDate) return 0;

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
  const { assignments, companyCalendar } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  const averageAllocation = useMemo(() => {
    const effectiveEndDate =
      resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
        ? new Date(resource.lastDayOfWork)
        : endDate;
    if (startDate > effectiveEndDate) return 0;

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
  resource: Resource;
  roleName: string;
  assignments: Assignment[];
  allocations: any;
  projectsById: Map<string, any>;
  clientsById: Map<string, any>;
  timeColumns: TimeColumn[];
}> = React.memo(({ resource, roleName, assignments, allocations, projectsById, clientsById, timeColumns }) => {
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');

  // Calculate Load
  let totalLoadSum = 0;
  let workingDaysCount = 0;

  const assignmentDetails = assignments.map(assignment => {
      let assignmentLoadSum = 0;
      timeColumns.forEach(col => {
           if (!col.isNonWorkingDay && col.dateIso) {
               assignmentLoadSum += allocations[assignment.id!]?.[col.dateIso] || 0;
           }
      });
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

  timeColumns.forEach(col => {
      if (!col.isNonWorkingDay && col.dateIso) {
          workingDaysCount++;
          assignments.forEach(a => {
              totalLoadSum += allocations[a.id!]?.[col.dateIso] || 0;
          });
      }
  });
  const totalAvgLoad = workingDaysCount > 0 ? totalLoadSum / workingDaysCount : 0;

  const getLoadColor = (load: number) => {
      const max = resource.maxStaffingPercentage;
      if (load > max) return 'bg-error text-on-error';
      if (load === max) return 'bg-tertiary text-on-tertiary';
      if (load > 0) return 'bg-yellow-container text-on-yellow-container';
      return 'bg-surface-variant text-on-surface-variant';
  };
  
  const getBarColor = (load: number) => {
      const max = resource.maxStaffingPercentage;
      if (load > max) return 'bg-error';
      if (load >= max * 0.9) return 'bg-tertiary'; 
      return 'bg-primary';
  };

  return (
      <>
          <div className="bg-surface rounded-2xl shadow p-4 mb-4 border-l-4 border-primary flex flex-col gap-3">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="font-bold text-lg text-on-surface">{resource.name}</h3>
                      <p className="text-sm text-on-surface-variant">{roleName}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-bold ${getLoadColor(totalAvgLoad)}`}>
                      {totalAvgLoad.toFixed(0)}% Avg
                  </div>
              </div>

              <div className="w-full bg-surface-container-highest rounded-full h-2.5">
                  <div 
                      className={`h-2.5 rounded-full ${getBarColor(totalAvgLoad)}`} 
                      style={{ width: `${Math.min(totalAvgLoad, 100)}%` }}
                  ></div>
              </div>

              <div className="space-y-2 mt-1">
                  {assignmentDetails.length > 0 ? (
                      assignmentDetails.map(a => (
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
                  dates={timeColumns.map(c => ({ dateIso: c.dateIso || '', label: c.label, isNonWorkingDay: !!c.isNonWorkingDay }))} 
                  onClose={() => setEditingAssignment(null)} 
              />
          )}
      </>
  );
});


/**
 * Pagina principale Staffing.
 */
const StaffingPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Force 'week' view on mobile to have a sensible default for the card view
  useEffect(() => {
      if (isMobile && viewMode === 'day') {
          setViewMode('week');
      }
  }, [isMobile]);

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
    leaveRequests,
    leaveTypes
  } = useEntitiesContext();
  const { allocations, bulkUpdateAllocations } = useAllocationsContext();

  // Modali
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);

  const [bulkFormData, setBulkFormData] = useState({
    startDate: '',
    endDate: '',
    percentage: 50,
  });

  const [newAssignmentData, setNewAssignmentData] = useState<{
    resourceId: string;
    projectIds: string[];
  }>({
    resourceId: '',
    projectIds: [],
  });

  // Filtri
  const [filters, setFilters] = useState({
    resourceId: '',
    projectId: '',
    clientId: '',
    projectManager: '',
  });

  const projectsById = useMemo(() => {
    const map = new Map<string, any>();
    projects.forEach((p: any) => {
      if (p.id) map.set(p.id, p);
    });
    return map;
  }, [projects]);

  const clientsById = useMemo(() => {
    const map = new Map<string, any>();
    clients.forEach((c: any) => {
      if (c.id) map.set(c.id, c);
    });
    return map;
  }, [clients]);

  const rolesById = useMemo(() => {
    const map = new Map<string, any>();
    roles.forEach((r: any) => {
      if (r.id) map.set(r.id, r);
    });
    return map;
  }, [roles]);

  const leaveTypeMap = useMemo(() => {
      const map = new Map<string, LeaveType>();
      leaveTypes.forEach(t => {
          if (t.id) map.set(t.id, t);
      });
      return map;
  }, [leaveTypes]);

  /**
   * Colonne temporali in base alla view (day/week/month).
   */
  const timeColumns: TimeColumn[] = useMemo(() => {
    const cols: TimeColumn[] = [];
    let d = new Date(currentDate);

    if (isMobile) {
        let daysToGenerate = 1;
        if (viewMode === 'week') {
             d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
             daysToGenerate = 7;
        } else if (viewMode === 'month') {
             d.setDate(1);
             daysToGenerate = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        } else {
             // Fallback to 7 days for day view on mobile if forced
             daysToGenerate = 7;
        }

        for (let i = 0; i < daysToGenerate; i++) {
            const day = new Date(d);
            day.setDate(d.getDate() + i);
            const dayOfWeek = day.getDay();
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
        const dayOfWeek = day.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const dateIso = formatDate(day, 'iso');
        const holiday = companyCalendar.find(
          (e) => e.date === dateIso && e.type !== 'LOCAL_HOLIDAY'
        );
        return {
          label: formatDateSynthetic(day), 
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
      for (let i = 0; i < 12; i++) {
        const startOfWeek = new Date(d);
        const endOfWeek = addDays(new Date(d), 6);
        cols.push({
          label: `${formatDate(startOfWeek, 'short')} - ${formatDate(endOfWeek, 'short')}`,
          subLabel: '',
          startDate: startOfWeek,
          endDate: endOfWeek,
        });
        d.setDate(d.getDate() + 7);
      }
    } else {
      // month
      d.setDate(1);
      for (let i = 0; i < 12; i++) {
        const startOfMonth = new Date(d);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        cols.push({
          label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
          subLabel: '',
          startDate: startOfMonth,
          endDate: endOfMonth,
        });
        d.setMonth(d.getMonth() + 1);
      }
    }

    return cols;
  }, [currentDate, viewMode, companyCalendar, isMobile]);

  const assignableProjects = useMemo(
    () => projects.filter((p: any) => p.status !== 'Completato'),
    [projects]
  );

  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() - 7);
      } else if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setDate(newDate.getDate() - 1); // Day view change
      }
      return newDate;
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'week') {
        newDate.setDate(newDate.getDate() + 7);
      } else if (viewMode === 'month') {
        newDate.setMonth(newDate.getMonth() + 1);
      } else {
        newDate.setDate(newDate.getDate() + 1);
      }
      return newDate;
    });
  }, [viewMode]);

  const handleToday = useCallback(() => setCurrentDate(new Date()), []);

  const openBulkModal = useCallback((assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setBulkFormData({ startDate: '', endDate: '', percentage: 50 });
    setBulkModalOpen(true);
  }, []);

  const openNewAssignmentModal = useCallback((resourceId: string = '') => {
    setNewAssignmentData({ resourceId, projectIds: [] });
    setAssignmentModalOpen(true);
  }, []);

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssignment && bulkFormData.startDate && bulkFormData.endDate) {
      bulkUpdateAllocations(
        selectedAssignment.id!,
        bulkFormData.startDate,
        bulkFormData.endDate,
        bulkFormData.percentage
      );
      setBulkModalOpen(false);
      setSelectedAssignment(null);
    }
  };

  const handleNewAssignmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAssignmentData.resourceId && newAssignmentData.projectIds.length > 0) {
      const assignmentsToCreate = newAssignmentData.projectIds.map((projectId) => ({
        resourceId: newAssignmentData.resourceId,
        projectId,
      }));
      addMultipleAssignments(assignmentsToCreate);
      setAssignmentModalOpen(false);
      setNewAssignmentData({ resourceId: '', projectIds: [] });
    }
  };

  const handleNewAssignmentChange = useCallback((name: string, value: string) => {
    setNewAssignmentData((d) => ({ ...d, [name]: value }));
  }, []);

  const handleNewAssignmentMultiSelectChange = useCallback(
    (name: string, values: string[]) => {
      setNewAssignmentData((d) => ({ ...d, [name]: values }));
    },
    []
  );

  const handleFilterChange = useCallback((name: string, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1); // Reset page on filter change
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ resourceId: '', projectId: '', clientId: '', projectManager: '' });
    setCurrentPage(1);
  }, []);

  const getResourceById = useCallback(
    (id: string) => resources.find((r) => r.id === id),
    [resources]
  );
  const getProjectById = useCallback(
    (id: string) => projectsById.get(id),
    [projectsById]
  );

  // Costruzione dati visualizzati
  const displayData = useMemo(() => {
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

    let visibleResources = resources.filter((r) => !r.resigned);

    if (filters.resourceId) {
      visibleResources = visibleResources.filter((r) => r.id === filters.resourceId);
    }

    if (filters.projectId || filters.clientId || filters.projectManager) {
      const resourceIdsFromAssignments = new Set(filteredAssignments.map(a => a.resourceId));
      visibleResources = visibleResources.filter((r) => resourceIdsFromAssignments.has(r.id!));
    }
    
    // Filter out resources with no assignments if filters are active to avoid empty rows clutter
    if (filters.resourceId || filters.projectId || filters.clientId || filters.projectManager) {
         visibleResources = visibleResources.filter(r => assignmentsByResource.has(r.id!) && assignmentsByResource.get(r.id!)!.length > 0);
    }

    return visibleResources
      .map((resource) => ({
        resource,
        assignments: assignmentsByResource.get(resource.id!) || [],
      }))
      .sort((a, b) => a.resource.name.localeCompare(b.resource.name));
  }, [resources, filters, assignments, projectsById]);

  // Data for current page
  const paginatedData = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return displayData.slice(startIndex, startIndex + itemsPerPage);
  }, [displayData, currentPage, itemsPerPage]);

  const resourceOptions = useMemo(
    () => resources.filter((r) => !r.resigned).map((r) => ({ value: r.id!, label: r.name })),
    [resources]
  );
  const projectOptions = useMemo(
    () => projects.map((p: any) => ({ value: p.id!, label: p.name })),
    [projects]
  );
  const clientOptions = useMemo(
    () => clients.map((c: any) => ({ value: c.id!, label: c.name })),
    [clients]
  );
  const projectManagerOptions = useMemo(() => {
    const managers = [...new Set(projects.map((p: any) => p.projectManager).filter(Boolean) as string[])];
    return managers.sort().map((pm) => ({ value: pm, label: pm }));
  }, [projects]);

  return (
    <div className="flex flex-col h-full">
      {/* Controlli + Filtri */}
      <div className="flex-shrink-0 space-y-4">
        {/* Barra controlli tempo */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <div className="flex items-center justify-center md:justify-start space-x-2">
            <button
              onClick={handlePrev}
              className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm"
            >
              ← Prec.
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full shadow-sm font-semibold hover:opacity-90"
            >
              Oggi
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-surface border border-outline text-on-surface rounded-full shadow-sm hover:bg-surface-container-low text-sm"
            >
              Succ. →
            </button>
            {isMobile && <span className="ml-2 text-sm font-semibold text-on-surface">{viewMode === 'week' ? 'Settimana Corrente' : viewMode === 'day' ? 'Giorno' : 'Mese'}</span>}
          </div>

          <div className="flex items-center justify-center md:justify-start space-x-1 bg-surface-container p-1 rounded-full">
            {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
              <button
                key={level}
                onClick={() => setViewMode(level)}
                className={`px-3 py-1 text-sm font-medium rounded-full capitalize ${
                  viewMode === level
                    ? 'bg-surface text-primary shadow'
                    : 'text-on-surface-variant'
                }`}
              >
                {level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}
              </button>
            ))}
          </div>

          <button
            onClick={() => openNewAssignmentModal()}
            className="flex items-center justify-center w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-semibold rounded-full shadow-sm"
          >
            <span className="material-symbols-outlined mr-2 text-xl">add</span>
            Assegna Risorsa
          </button>
        </div>

        {/* Filtri */}
        <div className="p-4 bg-surface rounded-2xl shadow">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Risorsa
              </label>
              <SearchableSelect
                name="resourceId"
                value={filters.resourceId}
                onChange={handleFilterChange}
                options={resourceOptions}
                placeholder="Tutte le Risorse"
              />
            </div>
            {!isMobile && (
              <>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant">
                    Cliente
                  </label>
                  <SearchableSelect
                    name="clientId"
                    value={filters.clientId}
                    onChange={handleFilterChange}
                    options={clientOptions}
                    placeholder="Tutti i Clienti"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant">
                    Project Manager
                  </label>
                  <SearchableSelect
                    name="projectManager"
                    value={filters.projectManager}
                    onChange={handleFilterChange}
                    options={projectManagerOptions}
                    placeholder="Tutti i PM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-on-surface-variant">
                    Progetto
                  </label>
                  <SearchableSelect
                    name="projectId"
                    value={filters.projectId}
                    onChange={handleFilterChange}
                    options={projectOptions}
                    placeholder="Tutti i Progetti"
                  />
                </div>
              </>
            )}
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto"
            >
              Reset Filtri
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-grow mt-4">
        {isMobile ? (
            <div className="space-y-4 pb-20">
                {paginatedData.map(({ resource, assignments: resourceAssignments }) => (
                    <MobileResourceCard 
                      key={resource.id} 
                      resource={resource} 
                      roleName={rolesById.get(resource.roleId)?.name || ''}
                      assignments={resourceAssignments}
                      allocations={useAllocationsContext().allocations}
                      projectsById={projectsById}
                      clientsById={clientsById}
                      timeColumns={timeColumns}
                    />
                ))}
                {displayData.length === 0 && (
                    <div className="text-center p-10 text-on-surface-variant bg-surface rounded-2xl border border-dashed border-outline">
                        Nessuna risorsa da visualizzare.
                    </div>
                )}
            </div>
        ) : (
        <div className="bg-surface rounded-2xl shadow overflow-x-auto">
          {/* Altezza massima ~20 righe + header */}
          <div className="max-h-[660px] overflow-y-auto">
            <table className="min-w-full divide-y divide-outline-variant">
              <thead className="bg-surface-container-low sticky top-0 z-10">
                <tr>
                  <th
                    className="sticky left-0 bg-surface-container-low px-3 py-3.5 text-left text-sm font-semibold text-on-surface z-20"
                    style={{ minWidth: '260px' }}
                  >
                    Risorsa / Progetto
                  </th>
                  <th className="hidden md:table-cell px-3 py-3.5 text-left text-sm font-semibold text-on-surface">
                    Cliente
                  </th>
                  <th className="hidden md:table-cell px-3 py-3.5 text-left text-sm font-semibold text-on-surface">
                    Project Manager
                  </th>
                  <th className="px-2 py-3.5 text-center text-sm font-semibold text-on-surface">
                    Azioni
                  </th>
                  {timeColumns.map((col, index) => (
                    <th
                      key={index}
                      className={`px-2 py-3.5 text-center text-sm font-semibold w-24 md:w-28 ${
                        col.isNonWorkingDay ? 'bg-surface-container' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center">
                        <span
                          className={
                            col.isNonWorkingDay
                              ? 'text-on-surface-variant'
                              : 'text-on-surface'
                          }
                        >
                          {col.label}
                        </span>
                        {col.subLabel && (
                          <span className="text-xs text-on-surface-variant">{col.subLabel}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {paginatedData.map(({ resource, assignments: resourceAssignments }) => {
                  const role = rolesById.get(resource.roleId);

                  return (
                    <React.Fragment key={resource.id}>
                      {/* Riga master risorsa */}
                      <tr className="bg-surface-container font-bold">
                        <td
                          className="sticky left-0 bg-surface-container px-3 py-3 text-left text-sm z-9"
                          colSpan={4}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col min-w-0">
                              <Link
                                to={`/workload?resourceId=${resource.id}`}
                                className="text-primary hover:underline truncate"
                                title={resource.name}
                              >
                                {resource.name}
                              </Link>
                              <span
                                className="text-xs font-normal text-on-surface-variant truncate"
                                title={`${role?.name} (Max: ${resource.maxStaffingPercentage}%)`}
                              >
                                {role?.name} (Max: {resource.maxStaffingPercentage}%)
                              </span>
                            </div>
                            <button
                              onClick={() => openNewAssignmentModal(resource.id!)}
                              title={`Aggiungi assegnazione per ${resource.name}`}
                              className="flex-shrink-0 text-primary hover:opacity-80"
                            >
                              <span className="material-symbols-outlined">add_circle</span>
                            </button>
                          </div>
                        </td>
                        {timeColumns.map((col, index) => {
                          if (viewMode === 'day') {
                            const day = col.startDate;
                            const isDayHoliday = isHoliday(
                              day,
                              resource.location,
                              companyCalendar
                            );
                            const activeLeave = getActiveLeave(resource.id!, col.dateIso!, leaveRequests);
                            const leaveType = activeLeave ? leaveTypeMap.get(activeLeave.typeId) : undefined;

                            return (
                              <DailyTotalCell
                                key={index}
                                resource={resource}
                                date={col.dateIso!}
                                isNonWorkingDay={!!col.isNonWorkingDay || isDayHoliday}
                                resourceAssignments={resourceAssignments}
                                activeLeave={activeLeave}
                                leaveType={leaveType}
                              />
                            );
                          }
                          return (
                            <ReadonlyAggregatedTotalCell
                              key={index}
                              resource={resource}
                              startDate={col.startDate}
                              endDate={col.endDate}
                            />
                          );
                        })}
                      </tr>

                      {/* Righe assegnazioni */}
                      {resourceAssignments.length > 0 ? (
                        resourceAssignments.map((assignment) => {
                          const project = projectsById.get(assignment.projectId);
                          const client = project ? clientsById.get(project.clientId) : undefined;
                          const isDeleting = isActionLoading(
                            `deleteAssignment-${assignment.id}`
                          );

                          return (
                            <tr
                              key={assignment.id}
                              className="group hover:bg-surface-container-low"
                            >
                              <td
                                className="sticky left-0 bg-surface group-hover:bg-surface-container-low px-3 py-4 text-sm font-medium pl-8 z-9"
                                style={{ minWidth: '260px' }}
                              >
                                {project ? (
                                  <Link
                                    to={`/projects?projectId=${project.id}`}
                                    className="text-primary hover:underline block truncate"
                                    title={project.name}
                                  >
                                    {project.name}
                                  </Link>
                                ) : (
                                  <span className="text-on-surface-variant italic">Progetto N/D</span>
                                )}
                              </td>
                              <td className="hidden md:table-cell px-3 py-4 text-sm text-on-surface-variant truncate">
                                {client?.name || 'N/A'}
                              </td>
                              <td className="hidden md:table-cell px-3 py-4 text-sm text-on-surface-variant truncate">
                                {project?.projectManager || 'N/A'}
                              </td>
                              <td
                                className={`px-2 py-3 text-center ${
                                  isDeleting ? 'opacity-50 pointer-events-none' : ''
                                }`}
                              >
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => openBulkModal(assignment)}
                                    title="Assegnazione Massiva"
                                    className="text-primary hover:opacity-80"
                                  >
                                    <span className="material-symbols-outlined">calendar_add_on</span>
                                  </button>
                                  <button
                                    onClick={() => setAssignmentToDelete(assignment)}
                                    title="Rimuovi Assegnazione"
                                    className="text-error hover:opacity-80"
                                  >
                                    <span className="material-symbols-outlined">delete</span>
                                  </button>
                                </div>
                              </td>
                              {timeColumns.map((col, index) => {
                                if (viewMode === 'day') {
                                  const day = col.startDate;
                                  const isDayHoliday = isHoliday(
                                    day,
                                    resource.location,
                                    companyCalendar
                                  );
                                  const activeLeave = getActiveLeave(resource.id!, col.dateIso!, leaveRequests);
                                  const leaveType = activeLeave ? leaveTypeMap.get(activeLeave.typeId) : undefined;

                                  return (
                                    <AllocationCell
                                      key={index}
                                      assignment={assignment}
                                      date={col.dateIso!}
                                      isNonWorkingDay={
                                        !!col.isNonWorkingDay || isDayHoliday
                                      }
                                      activeLeave={activeLeave}
                                      leaveType={leaveType}
                                    />
                                  );
                                }
                                return (
                                  <ReadonlyAggregatedAllocationCell
                                    key={index}
                                    assignment={assignment}
                                    startDate={col.startDate}
                                    endDate={col.endDate}
                                  />
                                );
                              })}
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={4 + timeColumns.length}
                            className="px-3 py-4 text-sm text-on-surface-variant italic pl-8"
                          >
                            Nessuna assegnazione trovata per i filtri correnti.
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
                currentPage={currentPage}
                totalItems={displayData.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
            />
        </div>
        )}
      </div>

      {/* Modale Conferma Eliminazione */}
      {assignmentToDelete && (
        <ConfirmationModal
          isOpen={!!assignmentToDelete}
          onClose={() => setAssignmentToDelete(null)}
          onConfirm={() => {
            if (assignmentToDelete) {
              deleteAssignment(assignmentToDelete.id!);
              setAssignmentToDelete(null);
            }
          }}
          title="Conferma Rimozione Assegnazione"
          message={
            <>
              Sei sicuro di voler rimuovere l&apos;assegnazione di{' '}
              <strong>{getResourceById(assignmentToDelete.resourceId)?.name}</strong>{' '}
              dal progetto{' '}
              <strong>{getProjectById(assignmentToDelete.projectId)?.name}</strong>?
              <br />
              Tutte le allocazioni associate verranno eliminate.
            </>
          }
          isConfirming={isActionLoading(`deleteAssignment-${assignmentToDelete.id}`)}
        />
      )}

      {/* Modale Assegnazione Massiva */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Assegnazione Massiva"
      >
        <form onSubmit={handleBulkSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Data Inizio
              </label>
              <input
                type="date"
                required
                value={bulkFormData.startDate}
                onChange={(e) =>
                  setBulkFormData((f) => ({ ...f, startDate: e.target.value }))
                }
                className="mt-1 block w-full form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Data Fine
              </label>
              <input
                type="date"
                required
                value={bulkFormData.endDate}
                onChange={(e) =>
                  setBulkFormData((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1 block w-full form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Percentuale ({bulkFormData.percentage}%)
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={bulkFormData.percentage}
                onChange={(e) =>
                  setBulkFormData((f) => ({
                    ...f,
                    percentage: parseInt(e.target.value, 10),
                  }))
                }
                className="mt-1 block w-full accent-primary"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setBulkModalOpen(false)}
              className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold"
            >
              Salva
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale Nuova Assegnazione */}
      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        title="Assegna Risorsa a Progetto"
      >
        <form onSubmit={handleNewAssignmentSubmit} className="flex flex-col h-96">
          <div className="space-y-4 flex-grow">
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Risorsa
              </label>
              <SearchableSelect
                name="resourceId"
                value={newAssignmentData.resourceId}
                onChange={handleNewAssignmentChange}
                options={resources
                  .filter((r) => !r.resigned)
                  .map((r) => ({ value: r.id!, label: r.name }))}
                placeholder="Seleziona una risorsa"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Progetto/i
              </label>
              <MultiSelectDropdown
                name="projectIds"
                selectedValues={newAssignmentData.projectIds}
                onChange={handleNewAssignmentMultiSelectChange}
                options={assignableProjects.map((p: any) => ({
                  value: p.id!,
                  label: p.name,
                }))}
                placeholder="Seleziona uno o più progetti"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => setAssignmentModalOpen(false)}
              className="px-6 py-2 border border-outline rounded-full hover:bg-surface-container-low text-primary font-semibold"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-on-primary rounded-full font-semibold"
            >
              Aggiungi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StaffingPage;
