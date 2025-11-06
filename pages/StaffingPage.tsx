/**
 * @file StaffingPage.tsx
 * @description Pagina principale per la visualizzazione e la gestione dello staffing delle risorse sui progetti.
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource, Project, Assignment } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import ConfirmationModal from '../components/ConfirmationModal';
import { Link } from 'react-router-dom';

/**
 * @type ViewMode
 * @description Definisce i possibili valori per la modalità di visualizzazione della griglia temporale.
 */
type ViewMode = 'day' | 'week' | 'month';

// --- Virtualization Constants ---
const MASTER_ROW_HEIGHT = 61; // Estimated height of the main resource row
const ASSIGNMENT_ROW_HEIGHT = 68; // Estimated height of a single project assignment row
const OVERSCAN_COUNT = 5; // Number of items to render above and below the visible area

/**
 * @interface AllocationCellProps
 * @description Prop per il componente AllocationCell.
 */
interface AllocationCellProps {
  /** @property {Assignment} assignment - L'assegnazione a cui si riferisce la cella. */
  assignment: Assignment;
  /** @property {string} date - La data (YYYY-MM-DD) per questa cella di allocazione. */
  date: string;
  /** @property {boolean} isNonWorkingDay - Indica se la data corrisponde a un giorno non lavorativo (weekend o festività). */
  isNonWorkingDay: boolean;
}

/**
 * Componente per una singola cella di allocazione nella griglia di staffing.
 * Mostra un menu a tendina per modificare la percentuale di allocazione.
 * @param {AllocationCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const AllocationCell: React.FC<AllocationCellProps> = React.memo(
  ({ assignment, date, isNonWorkingDay }) => {
    const { allocations, updateAllocation } = useAllocationsContext();
    const percentage = allocations[assignment.id]?.[date] || 0;

    // Se è un giorno non lavorativo, mostra una cella disabilitata con sfondo grigio.
    if (isNonWorkingDay) {
      return (
        <td className="border-t border-gray-200 dark:border-gray-700 p-0 text-center bg-gray-50 dark:bg-gray-800/50">
          <span className="text-sm text-gray-400">-</span>
        </td>
      );
    }
    /**
     * Gestisce la modifica del valore nel menu a tendina e chiama l'aggiornamento del contesto.
     * @param {React.ChangeEvent<HTMLSelectElement>} e - L'evento di modifica.
     */
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAllocation(assignment.id, date, parseInt(e.target.value));
    };

    const percentageOptions = Array.from({ length: 21 }, (_, i) => i * 5);

    return (
      <td className="border-t border-gray-200 dark:border-gray-700 p-0 text-center">
        <select
          value={percentage}
          onChange={handleChange}
          className="w-full h-full bg-transparent border-0 text-center appearance-none text-sm focus:ring-0 focus:outline-none dark:text-gray-300"
        >
          {percentageOptions.map((p) => (
            <option key={p} value={p}>
              {p > 0 ? `${p}%` : '-'}
            </option>
          ))}
        </select>
      </td>
    );
  },
);

/**
 * Componente per la cella di carico aggregato di una singola assegnazione (settimana/mese).
 * Mostra la percentuale di allocazione media in sola lettura per il periodo specificato.
 * Il colore della cella indica il livello di carico medio.
 * @param {object} props - Le prop del componente.
 * @param {Assignment} props.assignment - L'assegnazione a cui si riferisce la cella.
 * @param {Date} props.startDate - La data di inizio del periodo aggregato.
 * @param {Date} props.endDate - La data di fine del periodo aggregato.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const ReadonlyAggregatedAllocationCell: React.FC<{
  assignment: Assignment;
  startDate: Date;
  endDate: Date;
}> = React.memo(({ assignment, startDate, endDate }) => {
  const { companyCalendar, resources } = useEntitiesContext();
  const { allocations } = useAllocationsContext();
  const resource = resources.find((r) => r.id === assignment.resourceId);

  // Calcola l'allocazione media come (totale giorni/uomo) / (totale giorni lavorativi).
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
      resource.location,
    );
    if (workingDays === 0) return 0;

    let totalPersonDays = 0;
    const assignmentAllocations = allocations[assignment.id];
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

  // Determina il colore della cella in base al carico medio.
  const cellColor = useMemo(() => {
    if (averageAllocation > 100)
      return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
    if (averageAllocation >= 95 && averageAllocation <= 100)
      return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (averageAllocation > 0 && averageAllocation < 95)
      return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
    return 'bg-transparent';
  }, [averageAllocation]);

  return (
    <td
      className={`border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
    >
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </td>
  );
});

/**
 * @interface DailyTotalCellProps
 * @description Prop per il componente DailyTotalCell.
 */
interface DailyTotalCellProps {
  /** @property {Resource} resource - La risorsa per cui calcolare il totale. */
  resource: Resource;
  /** @property {string} date - La data (YYYY-MM-DD) per cui calcolare il totale. */
  date: string;
  /** @property {boolean} isNonWorkingDay - Indica se la data corrisponde a un giorno non lavorativo. */
  isNonWorkingDay: boolean;
}

/**
 * Componente per la cella che mostra il carico totale giornaliero di una risorsa.
 * Cambia colore in base al livello di carico (sottoutilizzo, pieno, sovraccarico).
 * @param {DailyTotalCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const DailyTotalCell: React.FC<DailyTotalCellProps> = React.memo(
  ({ resource, date, isNonWorkingDay }) => {
    const { assignments } = useEntitiesContext();
    const { allocations } = useAllocationsContext();

    if (resource.lastDayOfWork && date > resource.lastDayOfWork) {
      isNonWorkingDay = true;
    }

    // Se è un giorno non lavorativo, il totale è 0 e la cella è stilizzata di conseguenza.
    if (isNonWorkingDay) {
      return (
        <td className="border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold bg-gray-100 dark:bg-gray-900/50 text-gray-400">
          -
        </td>
      );
    }

    // Calcola il totale giornaliero per la risorsa sommando tutte le sue allocazioni.
    const total = useMemo(() => {
      const resourceAssignments = assignments.filter(
        (a) => a.resourceId === resource.id,
      );
      return resourceAssignments.reduce((sum, a) => {
        return sum + (allocations[a.id]?.[date] || 0);
      }, 0);
    }, [assignments, allocations, resource.id, date]);

    // Determina il colore di sfondo della cella in base al carico totale e alla percentuale massima di staffing della risorsa.
    const cellColor = useMemo(() => {
      const maxPercentage = resource.maxStaffingPercentage ?? 100;
      if (total > maxPercentage)
        return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
      if (total === maxPercentage)
        return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
      if (total > 0 && total < maxPercentage)
        return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
      return 'bg-gray-100 dark:bg-gray-800';
    }, [total, resource.maxStaffingPercentage]);

    return (
      <td
        className={`border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
      >
        {total > 0 ? `${total}%` : '-'}
      </td>
    );
  },
);

/**
 * Componente per la cella di carico totale aggregato di una risorsa (settimana/mese).
 * Mostra l'utilizzo medio totale della risorsa in sola lettura per il periodo specificato.
 * Il colore della cella indica il livello di carico medio.
 * @param {object} props - Le prop del componente.
 * @param {Resource} props.resource - La risorsa per cui calcolare il totale.
 * @param {Date} props.startDate - La data di inizio del periodo aggregato.
 * @param {Date} props.endDate - La data di fine del periodo aggregato.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
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
      resource.location,
    );
    if (workingDays === 0) return 0;

    const resourceAssignments = assignments.filter(
      (a) => a.resourceId === resource.id,
    );
    let totalPersonDays = 0;

    resourceAssignments.forEach((assignment) => {
      const assignmentAllocations = allocations[assignment.id];
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
      return 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200';
    if (roundedAverage === maxPercentage)
      return 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200';
    if (roundedAverage > 0 && roundedAverage < maxPercentage)
      return 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200';
    return 'bg-gray-100 dark:bg-gray-800';
  }, [averageAllocation, resource.maxStaffingPercentage]);

  return (
    <td
      className={`border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
    >
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </td>
  );
});

/**
 * Componente principale della pagina di Staffing.
 * Gestisce la navigazione temporale, i filtri, l'apertura delle modali e il rendering della griglia di allocazione.
 * @returns {React.ReactElement} La pagina di Staffing.
 */
const StaffingPage: React.FC = () => {
  // Stato per la data di inizio della finestra temporale visualizzata.
  const [currentDate, setCurrentDate] = useState(new Date());
  /**
   * @state {ViewMode} viewMode - Controlla la vista corrente della griglia (giornaliera, settimanale, mensile).
   */
  const [viewMode, setViewMode] = useState<ViewMode>('day');
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
  const { bulkUpdateAllocations } = useAllocationsContext();

  // Stati per la gestione delle modali.
  const [isBulkModalOpen, setBulkModalOpen] = useState(false);
  const [isAssignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(
    null,
  );
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(
    null,
  );
  const [bulkFormData, setBulkFormData] = useState({
    startDate: '',
    endDate: '',
    percentage: 50,
  });
  const [newAssignmentData, setNewAssignmentData] = useState<{
    resourceId: string;
    projectIds: string[];
  }>({ resourceId: '', projectIds: [] });

  /**
   * @state {object} filters - Contiene i valori correnti dei filtri applicati alla griglia.
   * @property {string} resourceId - ID della risorsa selezionata.
   * @property {string} projectId - ID del progetto selezionato.
   * @property {string} clientId - ID del cliente selezionato.
   * @property {string} projectManager - Nome del Project Manager selezionato.
   */
  const [filters, setFilters] = useState({
    resourceId: '',
    projectId: '',
    clientId: '',
    projectManager: '',
  });

  // --- Virtualization State and Refs ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const measureHeight = () => setContainerHeight(container.clientHeight);
    measureHeight(); // Initial measurement

    const handleScroll = () => setScrollTop(container.scrollTop);

    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', measureHeight); // Re-measure on resize

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', measureHeight);
    };
  }, []);

  /**
   * @description Memoizza e calcola le colonne temporali da visualizzare nella griglia.
   */
  const timeColumns = useMemo(() => {
    const cols: {
      label: string;
      subLabel: string;
      startDate: Date;
      endDate: Date;
      isNonWorkingDay: boolean;
    }[] = [];
    let d = new Date(currentDate);

    if (viewMode === 'day') {
      return getCalendarDays(d, 35).map((day) => {
        const dayOfWeek = day.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const holiday = companyCalendar.find(
          (e) => e.date === formatDate(day, 'iso') && e.type !== 'LOCAL_HOLIDAY',
        );
        return {
          label: formatDate(day, 'short'),
          subLabel: formatDate(day, 'day'),
          startDate: day,
          endDate: day,
          isNonWorkingDay: isWeekend || !!holiday,
        };
      });
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); // Start from Monday
      for (let i = 0; i < 12; i++) {
        const startOfWeek = new Date(d);
        const endOfWeek = addDays(new Date(d), 6);
        cols.push({
          label: `${formatDate(startOfWeek, 'short')} - ${formatDate(
            endOfWeek,
            'short',
          )}`,
          subLabel: '',
          startDate: startOfWeek,
          endDate: endOfWeek,
          isNonWorkingDay: false,
        });
        d.setDate(d.getDate() + 7);
      }
    } else {
      // month
      d.setDate(1); // Start from first day of month
      for (let i = 0; i < 12; i++) {
        const startOfMonth = new Date(d);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        cols.push({
          label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
          subLabel: '',
          startDate: startOfMonth,
          endDate: endOfMonth,
          isNonWorkingDay: false,
        });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return cols;
  }, [currentDate, viewMode, companyCalendar]);

  // Progetti a cui è possibile assegnare risorse (esclusi quelli completati).
  const assignableProjects = useMemo(
    () => projects.filter((p) => p.status !== 'Completato'),
    [projects],
  );

  const handlePrev = useCallback(
    () =>
      setCurrentDate((prev) => {
        const newDate = new Date(prev);
        if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7 * 12);
        else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 12);
        else newDate.setDate(newDate.getDate() - 7);
        return newDate;
      }),
    [viewMode],
  );

  const handleNext = useCallback(
    () =>
      setCurrentDate((prev) => {
        const newDate = new Date(prev);
        if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7 * 12);
        else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 12);
        else newDate.setDate(newDate.getDate() + 7);
        return newDate;
      }),
    [viewMode],
  );

  const handleToday = () => setCurrentDate(new Date());

  const openBulkModal = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setBulkModalOpen(true);
  };

  const openNewAssignmentModal = (resourceId: string = '') => {
    setNewAssignmentData({ resourceId: resourceId, projectIds: [] });
    setAssignmentModalOpen(true);
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAssignment && bulkFormData.startDate && bulkFormData.endDate) {
      bulkUpdateAllocations(
        selectedAssignment.id,
        bulkFormData.startDate,
        bulkFormData.endDate,
        bulkFormData.percentage,
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
        projectId: projectId,
      }));
      addMultipleAssignments(assignmentsToCreate);
      setAssignmentModalOpen(false);
      setNewAssignmentData({ resourceId: '', projectIds: [] });
    }
  };

  const handleNewAssignmentChange = (name: string, value: string) => {
    setNewAssignmentData((d) => ({ ...d, [name]: value }));
  };

  const handleNewAssignmentMultiSelectChange = (
    name: string,
    values: string[],
  ) => {
    setNewAssignmentData((d) => ({ ...d, [name]: values }));
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({
      resourceId: '',
      projectId: '',
      clientId: '',
      projectManager: '',
    });
  };

  const getResourceById = useCallback(
    (id: string) => resources.find((r) => r.id === id),
    [resources],
  );
  const getProjectById = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );
  const getRoleById = useCallback(
    (id: string) => roles.find((r) => r.id === id),
    [roles],
  );
  const getClientById = useCallback(
    (id: string) => clients.find((c) => c.id === id),
    [clients],
  );

  const displayData = useMemo(() => {
    const activeResources = resources.filter((r) => !r.resigned);

    let visibleResources = [...activeResources];
    if (filters.resourceId) {
      visibleResources = visibleResources.filter((r) => r.id === filters.resourceId);
    }

    let relevantAssignments = [...assignments];
    if (filters.projectId) {
      relevantAssignments = relevantAssignments.filter(
        (a) => a.projectId === filters.projectId,
      );
    }
    if (filters.clientId) {
      const clientProjectIds = new Set(
        projects.filter((p) => p.clientId === filters.clientId).map((p) => p.id),
      );
      relevantAssignments = relevantAssignments.filter((a) =>
        clientProjectIds.has(a.projectId),
      );
    }
    if (filters.projectManager) {
      const projectIdsForPm = new Set(
        projects
          .filter((p) => p.projectManager === filters.projectManager)
          .map((p) => p.id),
      );
      relevantAssignments = relevantAssignments.filter((a) =>
        projectIdsForPm.has(a.projectId),
      );
    }

    const resourceIdsFromAssignments = new Set(
      relevantAssignments.map((a) => a.resourceId),
    );
    if (filters.projectId || filters.clientId || filters.projectManager) {
      visibleResources = visibleResources.filter((r) =>
        resourceIdsFromAssignments.has(r.id!),
      );
    }

    return visibleResources
      .map((resource) => ({
        resource,
        assignments: relevantAssignments.filter(
          (a) => a.resourceId === resource.id,
        ),
      }))
      .filter((item) => {
        if (filters.resourceId) return true;
        return item.assignments.length > 0;
      })
      .sort((a, b) => a.resource.name.localeCompare(b.resource.name));
  }, [assignments, resources, filters, projects]);

  const { virtualItems, paddingTop, paddingBottom } = useMemo(() => {
    if (containerHeight === 0) {
      const initialItems = displayData.slice(0, 15);
      return { virtualItems: initialItems, paddingTop: 0, paddingBottom: 0 };
    }

    let accumulatedHeight = 0;
    const rowMetadata = displayData.map((item) => {
      const height = MASTER_ROW_HEIGHT + item.assignments.length * ASSIGNMENT_ROW_HEIGHT;
      const meta = { height, offsetTop: accumulatedHeight };
      accumulatedHeight += height;
      return meta;
    });
    const totalHeight = accumulatedHeight;

    const viewTop = scrollTop;
    const viewBottom = scrollTop + containerHeight;

    let startIndex = 0;
    for (let i = 0; i < rowMetadata.length; i++) {
      if (rowMetadata[i].offsetTop + rowMetadata[i].height > viewTop) {
        startIndex = i;
        break;
      }
    }

    let endIndex = startIndex;
    for (let i = startIndex; i < rowMetadata.length; i++) {
      endIndex = i;
      if (rowMetadata[i].offsetTop > viewBottom) {
        break;
      }
    }

    startIndex = Math.max(0, startIndex - OVERSCAN_COUNT);
    endIndex = Math.min(rowMetadata.length - 1, endIndex + OVERSCAN_COUNT);

    const virtualItemsSlice = displayData.slice(startIndex, endIndex + 1);

    const calculatedPaddingTop = rowMetadata[startIndex]?.offsetTop || 0;
    const calculatedPaddingBottom =
      totalHeight -
        (rowMetadata[endIndex]?.offsetTop + rowMetadata[endIndex]?.height || 0) || 0;

    return {
      virtualItems: virtualItemsSlice,
      paddingTop: calculatedPaddingTop,
      paddingBottom: calculatedPaddingBottom,
    };
  }, [displayData, scrollTop, containerHeight]);

  const resourceOptions = useMemo(
    () =>
      resources
        .filter((r) => !r.resigned)
        .map((r) => ({ value: r.id!, label: r.name })),
    [resources],
  );
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id!, label: p.name })),
    [projects],
  );
  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id!, label: c.name })),
    [clients],
  );

  const projectManagerOptions = useMemo(() => {
    const managers = [
      ...new Set(projects.map((p) => p.projectManager).filter(Boolean) as string[]),
    ];
    return managers.sort().map((pm) => ({ value: pm, label: pm }));
  }, [projects]);

  return (
    <div className="flex flex-col h-full">
      {/* Contenitore fisso per controlli e filtri */}
      <div className="flex-shrink-0">
        {/* Barra dei controlli */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={handlePrev}
              className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              ← Prec.
            </button>
            <button
              onClick={handleToday}
              className="px-4 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm font-semibold text-primary dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Oggi
            </button>
            <button
              onClick={handleNext}
              className="px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-sm"
            >
              Succ. →
            </button>
          </div>
          <div className="flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-md">
            {(['day', 'week', 'month'] as ViewMode[]).map((level) => (
              <button
                key={level}
                onClick={() => setViewMode(level)}
                className={`px-3 py-1 text-sm font-medium rounded-md capitalize ${
                  viewMode === level
                    ? 'bg-white dark:bg-gray-900 text-primary dark:text-blue-400 shadow'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {level === 'day'
                  ? 'Giorno'
                  : level === 'week'
                  ? 'Settimana'
                  : 'Mese'}
              </button>
            ))}
          </div>
          <button
            onClick={() => openNewAssignmentModal()}
            className="flex items-center justify-center w-full md:w-auto px-4 py-2 bg-primary text-white rounded-md shadow-sm hover:bg-primary-darker"
          >
            <span className="mr-2 text-xl">➕</span>
            Assegna Risorsa
          </button>
        </div>

        {/* Sezione Filtri */}
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow relative z-30">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 w-full md:w-auto"
            >
              Reset Filtri
            </button>
          </div>
        </div>
      </div>

      {/* AREA TABELLA WRAPPATA (wrapper punto 4) */}
      <div className="flex-1 min-h-0">
        {/* Griglia di Staffing scrollabile */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-auto bg-white dark:bg-gray-800 rounded-lg shadow"
        >
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-20">
              <tr>
                <th
                  className="sticky left-0 bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white z-30"
                  style={{ minWidth: '300px' }}
                >
                  Risorsa / Progetto
                </th>
                <th
                  className="hidden md:table-cell sticky left-[300px] bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white z-30"
                  style={{ minWidth: '150px' }}
                >
                  Cliente
                </th>
                <th
                  className="hidden md:table-cell sticky left-[450px] bg-gray-50 dark:bg-gray-700 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white z-30"
                  style={{ minWidth: '150px' }}
                >
                  Project Manager
                </th>
                <th
                  className="sticky left-[600px] bg-gray-50 dark:bg-gray-700 px-2 py-3.5 text-center text-sm font-semibold text-gray-900 dark:text-white z-30"
                  style={{ minWidth: '120px' }}
                >
                  Azioni
                </th>
                {timeColumns.map((col, index) => (
                  <th
                    key={index}
                    className={`px-2 py-3.5 text-center text-sm font-semibold w-24 md:w-28 ${
                      col.isNonWorkingDay ? 'bg-gray-100 dark:bg-gray-700/50' : ''
                    }`}
                  >
                    <div className="flex flex-col items-center">
                      <span
                        className={
                          col.isNonWorkingDay
                            ? 'text-gray-500'
                            : 'text-gray-900 dark:text-white'
                        }
                      >
                        {col.label}
                      </span>
                      {col.subLabel && (
                        <span className="text-xs text-gray-500">{col.subLabel}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paddingTop > 0 && (
                <tr>
                  <td
                    colSpan={4 + timeColumns.length}
                    style={{ height: paddingTop, padding: 0 }}
                  />
                </tr>
              )}

              {virtualItems.map(({ resource, assignments: resourceAssignments }) => {
                const role = getRoleById(resource.roleId);
                return (
                  <React.Fragment key={resource.id}>
                    {/* Master row per risorsa */}
                    <tr className="bg-gray-100 dark:bg-gray-900 font-bold sticky top-16 z-[5]">
                      <td
                        className="sticky left-0 bg-gray-100 dark:bg-gray-900 px-3 py-3 text-left text-sm z-10"
                        colSpan={3}
                      >
                        <div className="flex flex-col">
                          <Link
                            to={`/workload?resourceId=${resource.id}`}
                            className="text-primary hover:text-primary-darker hover:underline dark:text-blue-400 dark:hover:text-blue-300 truncate"
                            title={resource.name}
                          >
                            {resource.name}
                          </Link>
                          <span
                            className="text-xs font-normal text-gray-500 truncate"
                            title={`${role?.name} (Max: ${resource.maxStaffingPercentage}%)`}
                          >
                            {role?.name} (Max: {resource.maxStaffingPercentage}%)
                          </span>
                        </div>
                      </td>
                      <td className="sticky left-[600px] bg-gray-100 dark:bg-gray-900 px-2 py-3 text-center z-10">
                        <button
                          onClick={() => openNewAssignmentModal(resource.id!)}
                          title={`Aggiungi assegnazione per ${resource.name}`}
                          className="text-primary hover:text-primary-darker dark:hover:text-blue-300"
                        >
                          <span className="text-xl">➕</span>
                        </button>
                      </td>
                      {timeColumns.map((col, index) => {
                        if (viewMode === 'day') {
                          const day = col.startDate;
                          const isDayHoliday = isHoliday(
                            day,
                            resource.location,
                            companyCalendar,
                          );
                          return (
                            <DailyTotalCell
                              key={index}
                              resource={resource}
                              date={formatDate(day, 'iso')}
                              isNonWorkingDay={col.isNonWorkingDay || isDayHoliday}
                            />
                          );
                        } else {
                          return (
                            <ReadonlyAggregatedTotalCell
                              key={index}
                              resource={resource}
                              startDate={col.startDate}
                              endDate={col.endDate}
                            />
                          );
                        }
                      })}
                    </tr>

                    {/* Righe assegnazioni */}
                    {resourceAssignments.length > 0 ? (
                      resourceAssignments.map((assignment) => {
                        const project = getProjectById(assignment.projectId)!;
                        const client = getClientById(project.clientId);
                        const isDeleting = isActionLoading(
                          `deleteAssignment-${assignment.id}`,
                        );
                        return (
                          <tr
                            key={assignment.id}
                            className="group hover:bg-gray-50 dark:hover:bg-gray-700/50"
                          >
                            <td
                              className="sticky left-0 bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 px-3 py-4 text-sm font-medium pl-8 z-10"
                              style={{ minWidth: '300px' }}
                            >
                              <Link
                                to={`/projects?projectId=${project.id}`}
                                className="text-primary hover:text-primary-darker hover:underline dark:text-blue-400 dark:hover:text-blue-300 block truncate"
                                title={project.name}
                              >
                                {project.name}
                              </Link>
                            </td>
                            <td
                              className="hidden md:table-cell sticky left-[300px] bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 px-3 py-4 text-sm text-gray-500 dark:text-gray-400 truncate z-10"
                              title={client?.name || 'N/A'}
                            >
                              {client?.name || 'N/A'}
                            </td>
                            <td
                              className="hidden md:table-cell sticky left-[450px] bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 px-3 py-4 text-sm text-gray-500 dark:text-gray-400 truncate z-10"
                              title={project.projectManager || 'N/A'}
                            >
                              {project.projectManager || 'N/A'}
                            </td>
                            <td
                              className={`sticky left-[600px] bg-white dark:bg-gray-800 group-hover:bg-gray-50 dark:group-hover:bg-gray-700/50 px-2 py-3 text-center z-10 ${
                                isDeleting ? 'opacity-50 pointer-events-none' : ''
                              }`}
                            >
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={() => openBulkModal(assignment)}
                                  title="Assegnazione Massiva"
                                  className="text-primary hover:text-primary-darker dark:hover:text-blue-300"
                                >
                                  <span className="text-xl">🗓️</span>
                                </button>
                                <button
                                  onClick={() => setAssignmentToDelete(assignment)}
                                  title="Rimuovi Assegnazione"
                                  className="text-red-500 hover:text-red-700 dark:hover:text-red-300"
                                >
                                  <span className="text-xl">❌</span>
                                </button>
                              </div>
                            </td>
                            {timeColumns.map((col, index) => {
                              if (viewMode === 'day') {
                                const day = col.startDate;
                                const isDayHoliday = isHoliday(
                                  day,
                                  resource.location,
                                  companyCalendar,
                                );
                                return (
                                  <AllocationCell
                                    key={index}
                                    assignment={assignment}
                                    date={formatDate(day, 'iso')}
                                    isNonWorkingDay={
                                      col.isNonWorkingDay || isDayHoliday
                                    }
                                  />
                                );
                              } else {
                                return (
                                  <ReadonlyAggregatedAllocationCell
                                    key={index}
                                    assignment={assignment}
                                    startDate={col.startDate}
                                    endDate={col.endDate}
                                  />
                                );
                              }
                            })}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={4 + timeColumns.length}
                          className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 italic pl-8"
                        >
                          Nessuna assegnazione trovata per i filtri correnti.
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {paddingBottom > 0 && (
                <tr>
                  <td
                    colSpan={4 + timeColumns.length}
                    style={{ height: paddingBottom, padding: 0 }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modale di Conferma Eliminazione */}
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
              Sei sicuro di voler rimuovere l'assegnazione di{' '}
              <strong>{getResourceById(assignmentToDelete.resourceId)?.name}</strong> dal
              progetto{' '}
              <strong>
                {getProjectById(assignmentToDelete.projectId)?.name}
              </strong>
              ?
              <br />
              Tutte le allocazioni associate verranno eliminate.
            </>
          }
          isConfirming={isActionLoading(
            `deleteAssignment-${assignmentToDelete.id}`,
          )}
        />
      )}

      {/* Modale per Assegnazione Massiva */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="Assegnazione Massiva"
      >
        <form onSubmit={handleBulkSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data Inizio
              </label>
              <input
                type="date"
                required
                value={bulkFormData.startDate}
                onChange={(e) =>
                  setBulkFormData((f) => ({ ...f, startDate: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Data Fine
              </label>
              <input
                type="date"
                required
                value={bulkFormData.endDate}
                onChange={(e) =>
                  setBulkFormData((f) => ({ ...f, endDate: e.target.value }))
                }
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-gray-700 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                    percentage: parseInt(e.target.value),
                  }))
                }
                className="mt-1 block w-full"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setBulkModalOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker"
            >
              Salva
            </button>
          </div>
        </form>
      </Modal>

      {/* Modale per Nuova Assegnazione */}
      <Modal
        isOpen={isAssignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        title="Assegna Risorsa a Progetto"
      >
        <form onSubmit={handleNewAssignmentSubmit} className="flex flex-col h-96">
          <div className="space-y-4 flex-grow">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Progetto/i
              </label>
              <MultiSelectDropdown
                name="projectIds"
                selectedValues={newAssignmentData.projectIds}
                onChange={handleNewAssignmentMultiSelectChange}
                options={assignableProjects.map((p) => ({
                  value: p.id!,
                  label: p.name,
                }))}
                placeholder="Seleziona uno o più progetti"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setAssignmentModalOpen(false)}
              className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Annulla
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-darker"
            >
              Aggiungi Assegnazioni
            </button>
          </div>
        </form>
      </Modal>

      <style>{`
        .form-select {
          display: block;
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #D1D5DB;
          background-color: #FFFFFF;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
        }
        .dark .form-select {
          border-color: #4B5563;
          background-color: #374151;
          color: #F9FAFB;
        }
        .form-input {
          display: block;
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #D1D5DB;
          background-color: #FFFFFF;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          line-height: 1.25rem;
        }
        .dark .form-input {
          border-color: #4B5563;
          background-color: #374151;
          color: #F9FAFB;
        }
      `}</style>
    </div>
  );
};

export default StaffingPage;
