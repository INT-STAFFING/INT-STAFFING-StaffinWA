/**
 * @file StaffingPage.tsx
 * @description Pagina principale per la visualizzazione e la gestione dello staffing delle risorse sui progetti.
 */

// Fix: Augment react-window module to add missing instance methods without redeclaring existing types.
// The import within the 'declare module' block was removed as it's not allowed.
// The 'ListOnScrollProps' type was also removed as it is imported from the library, preventing a duplicate identifier error.
declare module 'react-window' {
    export class VariableSizeList extends React.Component<any> {
        resetAfterIndex(index: number, shouldForceUpdate?: boolean): void;
        scrollTo(scrollOffset: number): void;
        scrollToItem(index: number, align?: 'auto' | 'start' | 'center' | 'end'): void;
    }
}


import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { VariableSizeList, ListOnScrollProps } from 'react-window';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Assignment, Project, Role, Client } from '../types';
import {
  getCalendarDays,
  formatDate,
  addDays,
  isHoliday,
  getWorkingDaysBetween,
} from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import { Link } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month';

const PERCENTAGE_OPTIONS = Array.from({ length: 21 }, (_, i) => i * 5);
const MASTER_ROW_HEIGHT = 68;
const ASSIGNMENT_ROW_HEIGHT = 68;

// --- Cell Components (Refactored to render divs) ---

const AllocationCell: React.FC<{
  assignment: Assignment;
  date: string;
  isNonWorkingDay: boolean;
}> = React.memo(({ assignment, date, isNonWorkingDay }) => {
  const { allocations, updateAllocation } = useAllocationsContext();
  const percentage = allocations[assignment.id!]?.[date] || 0;

  const baseClasses = "flex items-center justify-center h-full w-[112px] text-center text-sm";
  if (isNonWorkingDay) {
    return (
      <div className={`${baseClasses} bg-gray-50 dark:bg-gray-800/50`}>
        <span className="text-gray-400">-</span>
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateAllocation(assignment.id!, date, parseInt(e.target.value, 10));
  };

  return (
    <div className={baseClasses}>
      <select
        value={percentage}
        onChange={handleChange}
        className="w-full h-full bg-transparent border-0 text-center appearance-none focus:ring-0 focus:outline-none dark:text-gray-300"
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

const ReadonlyAggregatedAllocationCell: React.FC<{
  assignment: Assignment;
  startDate: Date;
  endDate: Date;
}> = React.memo(({ assignment, startDate, endDate }) => {
  const { companyCalendar, resources } = useEntitiesContext();
  const { allocations } = useAllocationsContext();
  const resource = resources.find((r) => r.id === assignment.resourceId);

  const averageAllocation = useMemo(() => {
    if (!resource) return 0;
    const workingDays = getWorkingDaysBetween(startDate, endDate, companyCalendar, resource.location);
    if (workingDays === 0) return 0;

    let totalPersonDays = 0;
    const assignmentAllocations = allocations[assignment.id!];

    if (assignmentAllocations) {
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = formatDate(currentDate, 'iso');
        if (assignmentAllocations[dateStr] && !isHoliday(currentDate, resource.location, companyCalendar)) {
          totalPersonDays += assignmentAllocations[dateStr] / 100;
        }
        currentDate = addDays(currentDate, 1);
      }
    }
    return (totalPersonDays / workingDays) * 100;
  }, [assignment.id, startDate, endDate, allocations, companyCalendar, resource]);
  
  const cellColor = useMemo(() => {
    if (averageAllocation > 100) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
    if (averageAllocation >= 95) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (averageAllocation > 0) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
    return 'bg-transparent';
  }, [averageAllocation]);

  return (
    <div className={`flex items-center justify-center h-full w-[112px] text-center text-sm font-semibold ${cellColor}`}>
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </div>
  );
});

const DailyTotalCell: React.FC<{
  resource: Resource;
  date: string;
  isNonWorkingDay: boolean;
  resourceAssignments: Assignment[];
}> = React.memo(({ resource, date, isNonWorkingDay, resourceAssignments }) => {
  const { allocations } = useAllocationsContext();
  const total = useMemo(() => resourceAssignments.reduce((sum, a) => sum + (allocations[a.id!]?.[date] || 0), 0), [resourceAssignments, allocations, date]);

  let effectiveNonWorking = isNonWorkingDay;
  if (resource.lastDayOfWork && date > resource.lastDayOfWork) effectiveNonWorking = true;

  const baseClasses = "flex items-center justify-center h-full w-[112px] text-center text-sm font-semibold";
  if (effectiveNonWorking) {
    return (
      <div className={`${baseClasses} bg-gray-100 dark:bg-gray-900/50 text-gray-400`}>-</div>
    );
  }

  const cellColor = useMemo(() => {
    const max = resource.maxStaffingPercentage ?? 100;
    if (total > max) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
    if (total === max) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (total > 0) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
    return 'bg-gray-100 dark:bg-gray-800';
  }, [total, resource.maxStaffingPercentage]);

  return (
    <div className={`${baseClasses} ${cellColor}`}>
      {total > 0 ? `${total}%` : '-'}
    </div>
  );
});

const ReadonlyAggregatedTotalCell: React.FC<{
  resource: Resource;
  startDate: Date;
  endDate: Date;
}> = React.memo(({ resource, startDate, endDate }) => {
  const { assignments, companyCalendar } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  const averageAllocation = useMemo(() => {
    const workingDays = getWorkingDaysBetween(startDate, endDate, companyCalendar, resource.location);
    if (workingDays === 0) return 0;
    
    const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
    let totalPersonDays = 0;
    
    resourceAssignments.forEach((assignment) => {
        const assignmentAllocations = allocations[assignment.id!];
        if (assignmentAllocations) {
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dateStr = formatDate(currentDate, 'iso');
                if (assignmentAllocations[dateStr] && !isHoliday(currentDate, resource.location, companyCalendar)) {
                    totalPersonDays += assignmentAllocations[dateStr] / 100;
                }
                currentDate = addDays(currentDate, 1);
            }
        }
    });
    return (totalPersonDays / workingDays) * 100;
  }, [resource, startDate, endDate, assignments, allocations, companyCalendar]);
  
  const cellColor = useMemo(() => {
    const max = resource.maxStaffingPercentage ?? 100;
    const roundedAvg = Math.round(averageAllocation);
    if (roundedAvg > max) return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
    if (roundedAvg === max) return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (roundedAvg > 0) return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
    return 'bg-gray-100 dark:bg-gray-800';
  }, [averageAllocation, resource.maxStaffingPercentage]);

  return (
    <div className={`flex items-center justify-center h-full w-[112px] text-center text-sm font-semibold ${cellColor}`}>
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </div>
  );
});


// --- Virtualization Components ---

interface TimeColumn {
  label: string;
  subLabel: string;
  startDate: Date;
  endDate: Date;
  isNonWorkingDay?: boolean;
  dateIso?: string;
}

interface ResourceBlockData {
  displayData: { resource: Resource; assignments: Assignment[] }[];
  timeColumns: TimeColumn[];
  viewMode: ViewMode;
  roles: Role[];
  companyCalendar: any[];
  getClientById: (id: string | null) => Client | undefined;
  getProjectById: (id: string) => Project | undefined;
  openBulkModal: (assignment: Assignment) => void;
  openNewAssignmentModal: (resourceId: string) => void;
  setAssignmentToDelete: (assignment: Assignment | null) => void;
  isActionLoading: (key: string) => boolean;
}

const ResourceBlock = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: ResourceBlockData }) => {
  const {
    displayData, timeColumns, viewMode, roles, companyCalendar,
    getClientById, getProjectById, openBulkModal, openNewAssignmentModal,
    setAssignmentToDelete, isActionLoading
  } = data;
  
  const { resource, assignments: resourceAssignments } = displayData[index];
  const role = roles.find((r) => r.id === resource.roleId);

  return (
    <div style={style}>
      {/* Master Row */}
      <div className="flex h-[68px] bg-gray-100 dark:bg-gray-900 font-bold border-b border-gray-200 dark:border-gray-700">
        <div className="sticky left-0 z-10 flex items-center justify-between gap-2 px-3 py-3 text-left text-sm w-[260px] bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
          <div className="flex flex-col min-w-0">
            <Link to={`/workload?resourceId=${resource.id}`} className="text-primary hover:underline truncate" title={resource.name}>{resource.name}</Link>
            <span className="text-xs font-normal text-gray-500 truncate" title={`${role?.name} (Max: ${resource.maxStaffingPercentage}%)`}>{role?.name} (Max: {resource.maxStaffingPercentage}%)</span>
          </div>
          <button onClick={() => openNewAssignmentModal(resource.id!)} title="Aggiungi assegnazione" className="flex-shrink-0 text-primary">➕</button>
        </div>
        <div className="hidden md:flex w-[150px] border-r border-gray-200 dark:border-gray-700"></div>
        <div className="hidden md:flex w-[150px] border-r border-gray-200 dark:border-gray-700"></div>
        <div className="flex w-[100px] border-r border-gray-200 dark:border-gray-700"></div>
        {timeColumns.map((col, i) => (
          <div key={i} className="border-r border-gray-200 dark:border-gray-700">
            {viewMode === 'day' ? (
              <DailyTotalCell resource={resource} date={col.dateIso!} isNonWorkingDay={!!col.isNonWorkingDay || isHoliday(col.startDate, resource.location, companyCalendar)} resourceAssignments={resourceAssignments} />
            ) : (
              <ReadonlyAggregatedTotalCell resource={resource} startDate={col.startDate} endDate={col.endDate} />
            )}
          </div>
        ))}
      </div>

      {/* Assignment Rows */}
      {resourceAssignments.map((assignment) => {
        const project = getProjectById(assignment.projectId)!;
        const client = getClientById(project.clientId);
        const isDeleting = isActionLoading(`deleteAssignment-${assignment.id}`);
        
        return (
          <div key={assignment.id} className="group flex h-[68px] border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <div className="sticky left-0 z-10 flex items-center px-3 py-4 text-sm font-medium pl-8 w-[260px] bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 border-r border-gray-200 dark:border-gray-700">
              <Link to={`/projects?projectId=${project.id}`} className="text-primary hover:underline block truncate" title={project.name}>{project.name}</Link>
            </div>
            <div className="hidden md:flex items-center px-3 py-4 text-sm w-[150px] text-gray-500 dark:text-gray-400 truncate border-r border-gray-200 dark:border-gray-700">{client?.name || 'N/A'}</div>
            <div className="hidden md:flex items-center px-3 py-4 text-sm w-[150px] text-gray-500 dark:text-gray-400 truncate border-r border-gray-200 dark:border-gray-700">{project.projectManager || 'N/A'}</div>
            <div className={`flex items-center justify-center px-2 py-3 w-[100px] border-r border-gray-200 dark:border-gray-700 ${isDeleting ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-center space-x-2">
                <button onClick={() => openBulkModal(assignment)} title="Assegnazione Massiva" className="text-primary">🗓️</button>
                <button onClick={() => setAssignmentToDelete(assignment)} title="Rimuovi" className="text-red-500">❌</button>
              </div>
            </div>
            {timeColumns.map((col, i) => (
              <div key={i} className="border-r border-gray-200 dark:border-gray-700">
                {viewMode === 'day' ? (
                  <AllocationCell assignment={assignment} date={col.dateIso!} isNonWorkingDay={!!col.isNonWorkingDay || isHoliday(col.startDate, resource.location, companyCalendar)} />
                ) : (
                  <ReadonlyAggregatedAllocationCell assignment={assignment} startDate={col.startDate} endDate={col.endDate} />
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
});

const StaffingPageHeader: React.FC<{ timeColumns: TimeColumn[], scrollRef: React.RefObject<HTMLDivElement> }> = ({ timeColumns, scrollRef }) => (
  <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-700 font-semibold text-sm border-b border-gray-200 dark:border-gray-700">
    <div className="flex">
      <div className="sticky left-0 z-20 flex bg-gray-50 dark:bg-gray-700">
        <div className="flex items-center px-3 py-3.5 w-[260px] border-r border-gray-200 dark:border-gray-700">Risorsa / Progetto</div>
        <div className="hidden md:flex items-center px-3 py-3.5 w-[150px] border-r border-gray-200 dark:border-gray-700">Cliente</div>
        <div className="hidden md:flex items-center px-3 py-3.5 w-[150px] border-r border-gray-200 dark:border-gray-700">Project Manager</div>
        <div className="flex items-center justify-center px-2 py-3.5 w-[100px] border-r border-gray-200 dark:border-gray-700">Azioni</div>
      </div>
      <div className="flex-grow overflow-x-hidden" ref={scrollRef}>
        <div className="flex">
          {timeColumns.map((col, index) => (
            <div key={index} className={`flex flex-col items-center justify-center p-2 w-[112px] border-r border-gray-200 dark:border-gray-700 ${col.isNonWorkingDay ? 'bg-gray-100 dark:bg-gray-700/50' : ''}`}>
              <span className={col.isNonWorkingDay ? 'text-gray-500' : 'text-gray-900 dark:text-white'}>{col.label}</span>
              {col.subLabel && <span className="text-xs text-gray-500">{col.subLabel}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);


const StaffingPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const { resources, projects, assignments, roles, clients, addMultipleAssignments, deleteAssignment, companyCalendar, isActionLoading } = useEntitiesContext();
  const { bulkUpdateAllocations } = useAllocationsContext();

  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);

  const [bulkFormData, setBulkFormData] = useState({ startDate: '', endDate: '', percentage: 50 });
  const [newAssignmentData, setNewAssignmentData] = useState<{ resourceId: string; projectIds: string[] }>({ resourceId: '', projectIds: [] });

  const [filters, setFilters] = useState({ resourceId: '', projectId: '', clientId: '', projectManager: '' });
  
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<VariableSizeList>(null);

  const timeColumns: TimeColumn[] = useMemo(() => {
    let d = new Date(currentDate);
    if (viewMode === 'day') {
      return getCalendarDays(d, 21).map((day) => ({
        label: formatDate(day, 'short'),
        subLabel: formatDate(day, 'day'),
        startDate: day, endDate: day,
        isNonWorkingDay: day.getDay() === 0 || day.getDay() === 6 || !!companyCalendar.find(e => e.date === formatDate(day, 'iso') && e.type !== 'LOCAL_HOLIDAY'),
        dateIso: formatDate(day, 'iso'),
      }));
    }
    // ... week/month logic remains same ...
    const cols: TimeColumn[] = [];
    if (viewMode === 'week') {
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
      for (let i = 0; i < 12; i++) {
        const start = new Date(d);
        const end = addDays(new Date(d), 6);
        cols.push({ label: `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`, subLabel: ``, startDate: start, endDate: end });
        d.setDate(d.getDate() + 7);
      }
    } else {
      d.setDate(1);
      for (let i = 0; i < 12; i++) {
        const start = new Date(d);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        cols.push({ label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }), subLabel: ``, startDate: start, endDate: end });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return cols;
  }, [currentDate, viewMode, companyCalendar]);

  const assignableProjects = useMemo(() => projects.filter((p) => p.status !== 'Completato'), [projects]);

  const handlePrev = useCallback(() => setCurrentDate(prev => addDays(prev, viewMode === 'day' ? -7 : viewMode === 'week' ? -7 * 4 : -365)), [viewMode]);
  const handleNext = useCallback(() => setCurrentDate(prev => addDays(prev, viewMode === 'day' ? 7 : viewMode === 'week' ? 7 * 4 : 365)), [viewMode]);
  const handleToday = () => setCurrentDate(new Date());

  const openBulkModal = useCallback((assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setBulkFormData({ startDate: '', endDate: '', percentage: 50 });
    setBulkModalOpen(true);
  }, []);

  const openNewAssignmentModal = useCallback((resourceId: string = '') => {
    setNewAssignmentData({ resourceId, projectIds: [] });
    setAssignmentModalOpen(true);
  }, []);

  const handleBulkSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssignment && bulkFormData.startDate && bulkFormData.endDate) {
      bulkUpdateAllocations(selectedAssignment.id!, bulkFormData.startDate, bulkFormData.endDate, bulkFormData.percentage);
      setBulkModalOpen(false);
      setSelectedAssignment(null);
    }
  }, [selectedAssignment, bulkFormData, bulkUpdateAllocations]);

  const handleNewAssignmentSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (newAssignmentData.resourceId && newAssignmentData.projectIds.length > 0) {
      addMultipleAssignments(newAssignmentData.projectIds.map(projectId => ({ resourceId: newAssignmentData.resourceId, projectId })));
      setAssignmentModalOpen(false);
    }
  }, [newAssignmentData, addMultipleAssignments]);

  const setAssignmentToDeleteCallback = useCallback((assignment: Assignment | null) => {
    setAssignmentToDelete(assignment);
  }, []);

  const handleFilterChange = (name: string, value: string) => setFilters(prev => ({ ...prev, [name]: value }));
  const clearFilters = () => setFilters({ resourceId: '', projectId: '', clientId: '', projectManager: '' });

  const getResourceById = useCallback((id: string) => resources.find((r) => r.id === id), [resources]);
  const getProjectById = useCallback((id: string) => projects.find((p) => p.id === id), [projects]);
  const getClientById = useCallback((id: string | null) => id ? clients.find((c) => c.id === id) : undefined, [clients]);

  const displayData = useMemo(() => {
    let visibleResources = resources.filter((r) => !r.resigned);
    if (filters.resourceId) visibleResources = visibleResources.filter((r) => r.id === filters.resourceId);

    let relevantAssignments = [...assignments];
    if (filters.projectId) relevantAssignments = relevantAssignments.filter((a) => a.projectId === filters.projectId);
    if (filters.clientId) {
      const clientProjectIds = new Set(projects.filter(p => p.clientId === filters.clientId).map(p => p.id));
      relevantAssignments = relevantAssignments.filter(a => clientProjectIds.has(a.projectId));
    }
    if (filters.projectManager) {
      const pmProjectIds = new Set(projects.filter(p => p.projectManager === filters.projectManager).map(p => p.id));
      relevantAssignments = relevantAssignments.filter(a => pmProjectIds.has(a.projectId));
    }
    
    if (filters.projectId || filters.clientId || filters.projectManager) {
        const resourceIdsFromAssignments = new Set(relevantAssignments.map(a => a.resourceId));
        visibleResources = visibleResources.filter(r => resourceIdsFromAssignments.has(r.id!));
    }

    return visibleResources
      .map(resource => ({ resource, assignments: relevantAssignments.filter(a => a.resourceId === resource.id) }))
      .filter(item => filters.resourceId ? true : item.assignments.length > 0)
      .sort((a, b) => a.resource.name.localeCompare(b.resource.name));
  }, [resources, assignments, projects, filters]);
  
  // Virtualization-related logic
  const itemHeights = useMemo(() => displayData.map(item => MASTER_ROW_HEIGHT + item.assignments.length * ASSIGNMENT_ROW_HEIGHT), [displayData]);
  const getItemSize = (index: number) => itemHeights[index] || 0;

  useEffect(() => { listRef.current?.resetAfterIndex(0); }, [displayData]);

  const handleScroll = useCallback(({ scrollLeft }: ListOnScrollProps) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollLeft;
    }
  }, []);
  
  const itemData = useMemo(() => ({
    displayData, timeColumns, viewMode, roles, companyCalendar, getClientById, getProjectById,
    openBulkModal, openNewAssignmentModal, setAssignmentToDelete: setAssignmentToDeleteCallback, isActionLoading
  }), [displayData, timeColumns, viewMode, roles, companyCalendar, getClientById, getProjectById, openBulkModal, openNewAssignmentModal, setAssignmentToDeleteCallback, isActionLoading]);

  const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map((r) => ({ value: r.id!, label: r.name })), [resources]);
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id!, label: p.name })), [projects]);
  const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id!, label: c.name })), [clients]);
  const projectManagerOptions = useMemo(() => [...new Set(projects.map((p) => p.projectManager).filter(Boolean) as string[])].sort().map(pm => ({ value: pm, label: pm })), [projects]);

  return (
    <div className="flex flex-col h-full">
      {/* Controlli + Filtri */}
      <div className="flex-shrink-0 space-y-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center justify-center md:justify-start space-x-2">
                <button onClick={handlePrev} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">← Prec.</button>
                <button onClick={handleToday} className="px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm font-semibold text-primary dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600">Oggi</button>
                <button onClick={handleNext} className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm">Succ. →</button>
            </div>
            <div className="flex items-center justify-center md:justify-start space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
                {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
                <button key={level} onClick={() => setViewMode(level)} className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${viewMode === level ? 'bg-white dark:bg-gray-900 text-primary dark:text-blue-400 shadow' : 'text-gray-600 dark:text-gray-300'}`}>{level === 'day' ? 'Giorno' : level === 'week' ? 'Settimana' : 'Mese'}</button>
                ))}
            </div>
            <button onClick={() => openNewAssignmentModal()} className="flex items-center justify-center w-full md:w-auto px-4 py-2 bg-primary text-white rounded-md shadow-sm hover:bg-primary-darker">
                <span className="mr-2 text-xl">➕</span> Assegna Risorsa
            </button>
        </div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risorsa</label><SearchableSelect name="resourceId" value={filters.resourceId} onChange={handleFilterChange} options={resourceOptions} placeholder="Tutte le Risorse"/></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cliente</label><SearchableSelect name="clientId" value={filters.clientId} onChange={handleFilterChange} options={clientOptions} placeholder="Tutti i Clienti"/></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Project Manager</label><SearchableSelect name="projectManager" value={filters.projectManager} onChange={handleFilterChange} options={projectManagerOptions} placeholder="Tutti i PM"/></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Progetto</label><SearchableSelect name="projectId" value={filters.projectId} onChange={handleFilterChange} options={projectOptions} placeholder="Tutti i Progetti"/></div>
            <button onClick={clearFilters} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto">Reset Filtri</button>
          </div>
        </div>
      </div>

      {/* VIRTUALIZED TABLE */}
      <div className="flex-grow mt-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden h-[720px] flex flex-col">
          <StaffingPageHeader timeColumns={timeColumns} scrollRef={headerScrollRef} />
          <div className="flex-1 w-full">
            <VariableSizeList
              ref={listRef}
              height={660}
              width="100%"
              itemCount={displayData.length}
              itemSize={getItemSize}
              itemData={itemData}
              onScroll={handleScroll}
            >
              {ResourceBlock}
            </VariableSizeList>
          </div>
        </div>
      </div>

      {/* Modals */}
      {assignmentToDelete && (
        <ConfirmationModal isOpen={!!assignmentToDelete} onClose={() => setAssignmentToDelete(null)} onConfirm={() => { if (assignmentToDelete) { deleteAssignment(assignmentToDelete.id!); setAssignmentToDelete(null); }}} title="Conferma Rimozione" message={<>Sei sicuro di voler rimuovere l&apos;assegnazione di <strong>{getResourceById(assignmentToDelete.resourceId)?.name}</strong> dal progetto <strong>{getProjectById(assignmentToDelete.projectId)?.name}</strong>?<br/>Tutte le allocazioni associate verranno eliminate.</>} isConfirming={isActionLoading(`deleteAssignment-${assignmentToDelete.id}`)}/>
      )}

      <Modal isOpen={isBulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Assegnazione Massiva">
        <form onSubmit={handleBulkSubmit}>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Inizio</label><input type="date" required value={bulkFormData.startDate} onChange={e => setBulkFormData(f => ({ ...f, startDate: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm form-input"/></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Data Fine</label><input type="date" required value={bulkFormData.endDate} onChange={e => setBulkFormData(f => ({ ...f, endDate: e.target.value }))} className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm form-input"/></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Percentuale ({bulkFormData.percentage}%)</label><input type="range" min="0" max="100" step="5" value={bulkFormData.percentage} onChange={e => setBulkFormData(f => ({ ...f, percentage: parseInt(e.target.value, 10) }))} className="mt-1 block w-full"/></div>
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => setBulkModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker">Salva</button></div>
        </form>
      </Modal>

      <Modal isOpen={isAssignmentModalOpen} onClose={() => setAssignmentModalOpen(false)} title="Assegna Risorsa a Progetto">
        <form onSubmit={handleNewAssignmentSubmit} className="flex flex-col h-96">
          <div className="space-y-4 flex-grow">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Risorsa</label><SearchableSelect name="resourceId" value={newAssignmentData.resourceId} onChange={(name, value) => setNewAssignmentData(d => ({...d, [name]: value}))} options={resourceOptions} placeholder="Seleziona una risorsa" required/></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Progetto/i</label><MultiSelectDropdown name="projectIds" selectedValues={newAssignmentData.projectIds} onChange={(name, values) => setNewAssignmentData(d => ({...d, [name]: values}))} options={assignableProjects.map((p) => ({ value: p.id!, label: p.name }))} placeholder="Seleziona uno o più progetti"/></div>
          </div>
          <div className="mt-6 flex justify-end space-x-3"><button type="button" onClick={() => setAssignmentModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500">Annulla</button><button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker">Aggiungi Assegnazioni</button></div>
        </form>
      </Modal>
      <style>{`.form-input{display:block;width:100%;border-radius:0.375rem;border:1px solid #D1D5DB;background-color:#FFFFFF;padding:0.5rem 0.75rem;font-size:0.875rem;line-height:1.25rem}.dark .form-input{border-color:#4B5563;background-color:#374151;color:#F9FAFB}`}</style>
    </div>
  );
};

export default StaffingPage;