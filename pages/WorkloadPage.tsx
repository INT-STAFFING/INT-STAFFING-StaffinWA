/**
 * @file WorkloadPage.tsx
 * @description Pagina di visualizzazione del carico totale per risorsa (sola lettura).
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { Resource } from '../types';
import { getCalendarDays, formatDate, addDays, isHoliday, getWorkingDaysBetween } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { useSearchParams } from 'react-router-dom';

type ViewMode = 'day' | 'week' | 'month';

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
 * Componente per la cella che mostra il carico totale giornaliero di una risorsa (sola lettura).
 * Cambia colore in base al livello di carico.
 * @param {DailyTotalCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const ReadonlyDailyTotalCell: React.FC<DailyTotalCellProps> = ({ resource, date, isNonWorkingDay }) => {
  const { assignments } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  if (resource.lastDayOfWork && date > resource.lastDayOfWork) {
    isNonWorkingDay = true;
  }

  if (isNonWorkingDay) {
    return (
      <td className="border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold bg-surface-container text-on-surface-variant">
        -
      </td>
    );
  }

  const total = useMemo(() => {
    const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
    return resourceAssignments.reduce((sum, a) => {
      return sum + (allocations[a.id]?.[date] || 0);
    }, 0);
  }, [assignments, allocations, resource.id, date]);

  // Logica colori unificata
  const cellColor = useMemo(() => {
    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    if (total > maxPercentage) return 'bg-error-container text-on-error-container';
    if (total === maxPercentage) return 'bg-tertiary-container text-on-tertiary-container';
    if (total > 0 && total < maxPercentage) return 'bg-yellow-container text-on-yellow-container';
    return 'bg-transparent';
  }, [total, resource.maxStaffingPercentage]);

  return (
    <td
      className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
    >
      {total > 0 ? `${total}%` : '-'}
    </td>
  );
};

/**
 * @interface AggregatedWorkloadCellProps
 * @description Prop per la cella di carico aggregato (settimana/mese).
 */
interface AggregatedWorkloadCellProps {
  resource: Resource;
  startDate: Date;
  endDate: Date;
}

/**
 * Componente cella per visualizzare il carico di lavoro medio aggregato su un periodo (settimana o mese).
 * @param {AggregatedWorkloadCellProps} props - Le prop del componente.
 * @returns {React.ReactElement} L'elemento `<td>` della cella.
 */
const ReadonlyAggregatedWorkloadCell: React.FC<AggregatedWorkloadCellProps> = ({
  resource,
  startDate,
  endDate,
}) => {
  const { assignments, companyCalendar } = useEntitiesContext();
  const { allocations } = useAllocationsContext();

  const averageAllocation = useMemo(() => {
    const effectiveEndDate =
      resource.lastDayOfWork && new Date(resource.lastDayOfWork) < endDate
        ? new Date(resource.lastDayOfWork)
        : endDate;
    if (startDate > effectiveEndDate) return 0;

    const workingDays = getWorkingDaysBetween(startDate, effectiveEndDate, companyCalendar, resource.location);
    if (workingDays === 0) return 0;

    const resourceAssignments = assignments.filter((a) => a.resourceId === resource.id);
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
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    });

    return (totalPersonDays / workingDays) * 100;
  }, [resource, startDate, endDate, assignments, allocations, companyCalendar]);

  // Logica colori unificata con arrotondamento
  const cellColor = useMemo(() => {
    const maxPercentage = resource.maxStaffingPercentage ?? 100;
    const roundedAverage = Math.round(averageAllocation);
    if (roundedAverage > maxPercentage)
      return 'bg-error-container text-on-error-container';
    if (roundedAverage === maxPercentage)
      return 'bg-tertiary-container text-on-tertiary-container';
    if (roundedAverage > 0 && roundedAverage < maxPercentage)
      return 'bg-yellow-container text-on-yellow-container';
    return 'bg-transparent';
  }, [averageAllocation, resource.maxStaffingPercentage]);

  return (
    <td
      className={`border-t border-outline-variant px-2 py-3 text-center text-sm font-semibold ${cellColor}`}
    >
      {averageAllocation > 0 ? `${averageAllocation.toFixed(0)}%` : '-'}
    </td>
  );
};

/**
 * Componente principale della pagina Carico Risorse.
 * Gestisce la navigazione temporale, i filtri e il rendering della griglia di carico.
 */
const WorkloadPage: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const { resources, projects, assignments, clients, companyCalendar, roles } = useEntitiesContext();

  const [filters, setFilters] = useState({
    resourceId: '',
    projectId: '',
    clientId: '',
    roleIds: [] as string[],
  });
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const resourceId = searchParams.get('resourceId');
    if (resourceId) {
      setFilters((prev) => ({ ...prev, resourceId }));
      // Rimuovi il parametro dall'URL dopo averlo applicato per non confondere l'utente
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const timeColumns = useMemo(() => {
    const cols: {
      label: string;
      subLabel: string;
      startDate: Date;
      endDate: Date;
      isNonWorkingHeader?: boolean;
    }[] = [];
    let d = new Date(currentDate);

    if (viewMode === 'day') {
      return getCalendarDays(d, 28).map((day) => {
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
          isNonWorkingHeader: isWeekend || !!holiday,
        };
      });
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1)); // Start from Monday
      for (let i = 0; i < 8; i++) {
        const startOfWeek = new Date(d);
        const endOfWeek = addDays(new Date(d), 6);
        cols.push({
          label: `${formatDate(startOfWeek, 'short')} - ${formatDate(endOfWeek, 'short')}`,
          subLabel: `Settimana ${i + 1}`,
          startDate: startOfWeek,
          endDate: endOfWeek,
        });
        d.setDate(d.getDate() + 7);
      }
    } else {
      // month
      d.setDate(1); // Start from first day of month
      for (let i = 0; i < 6; i++) {
        const startOfMonth = new Date(d);
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        cols.push({
          label: d.toLocaleString('it-IT', { month: 'long', year: 'numeric' }),
          subLabel: ``,
          startDate: startOfMonth,
          endDate: endOfMonth,
        });
        d.setMonth(d.getMonth() + 1);
      }
    }
    return cols;
  }, [currentDate, viewMode, companyCalendar]);

  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() - 7 * 8);
      else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() - 6);
      else newDate.setDate(newDate.getDate() - 35);
      return newDate;
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === 'week') newDate.setDate(newDate.getDate() + 7 * 8);
      else if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + 6);
      else newDate.setDate(newDate.getDate() + 35);
      return newDate;
    });
  }, [viewMode]);

  const handleToday = () => setCurrentDate(new Date());

  const handleFilterChange = (name: string, value: string) => {
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleMultiSelectFilterChange = (name: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [name]: values }));
  };

  const clearFilters = () => {
    setFilters({ resourceId: '', projectId: '', clientId: '', roleIds: [] });
  };

  // Calcola e memoizza le risorse da visualizzare, applicando i filtri.
  const displayResources = useMemo(() => {
    const activeResources = resources.filter((r) => !r.resigned);
    let finalResources = [...activeResources];

    if (filters.roleIds.length > 0) {
      finalResources = finalResources.filter((r) => filters.roleIds.includes(r.roleId));
    }

    if (filters.resourceId) {
      finalResources = finalResources.filter((r) => r.id === filters.resourceId);
    }

    if (filters.projectId || filters.clientId) {
      let relevantResourceIds: Set<string>;

      if (filters.projectId) {
        relevantResourceIds = new Set(
          assignments.filter((a) => a.projectId === filters.projectId).map((a) => a.resourceId),
        );
      } else {
        // filters.clientId
        const clientProjectIds = new Set(
          projects.filter((p) => p.clientId === filters.clientId).map((p) => p.id),
        );
        relevantResourceIds = new Set(
          assignments.filter((a) => clientProjectIds.has(a.projectId)).map((a) => a.resourceId),
        );
      }
      finalResources = finalResources.filter((r) => relevantResourceIds.has(r.id!));
    }

    return finalResources.sort((a, b) => a.name.localeCompare(b.name));
  }, [resources, assignments, projects, filters]);

  const resourceOptions = useMemo(
    () => resources.filter((r) => !r.resigned).map((r) => ({ value: r.id!, label: r.name })),
    [resources],
  );
  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.id!, label: r.name })),
    [roles],
  );
  const projectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id!, label: p.name })),
    [projects],
  );
  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id!, label: c.name })),
    [clients],
  );

  return (
    <div className="flex flex-col w-full max-w-full">
      {/* Barra controlli + info */}
      <div className="flex-shrink-0">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 gap-4">
          <div className="flex items-center justify-start space-x-2">
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
          </div>
          <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-full">
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
          <div className="text-sm text-on-surface-variant text-right">
            Vista di sola lettura.{' '}
            <a href="/staffing" className="text-primary hover:underline">
              Vai a Staffing per modifiche
            </a>
            .
          </div>
        </div>

        {/* Sezione Filtri */}
        <div className="mb-4 p-4 bg-surface rounded-2xl shadow relative z-30">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
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
            <div>
              <label className="block text-sm font-medium text-on-surface-variant">
                Ruolo
              </label>
              <MultiSelectDropdown
                name="roleIds"
                selectedValues={filters.roleIds}
                onChange={handleMultiSelectFilterChange}
                options={roleOptions}
                placeholder="Tutti i Ruoli"
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
            <button
              onClick={clearFilters}
              className="px-6 py-2 bg-secondary-container text-on-secondary-container font-semibold rounded-full hover:opacity-90 w-full md:w-auto"
            >
              Reset Filtri
            </button>
          </div>
        </div>
      </div>

      {/* Griglia Carico - con max height come Staffing */}
      <div className="flex-grow overflow-auto bg-surface rounded-2xl shadow max-h-[660px]">
        <table className="min-w-full divide-y divide-outline-variant">
          <thead className="bg-surface-container-low sticky top-0 z-20">
            <tr>
              <th
                className="sticky left-0 bg-surface-container-low px-3 py-3.5 text-left text-sm font-semibold text-on-surface z-30"
                style={{ minWidth: '200px' }}
              >
                Carico Totale Risorsa
              </th>
              {timeColumns.map((col, index) => (
                <th
                  key={index}
                  className={`px-2 py-3.5 text-center text-sm font-semibold w-28 md:w-32 ${
                    col.isNonWorkingHeader ? 'bg-surface-container' : ''
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span
                      className={
                        col.isNonWorkingHeader ? 'text-on-surface-variant' : 'text-on-surface'
                      }
                    >
                      {col.label}
                    </span>
                    {col.subLabel && <span className="text-xs text-on-surface-variant">{col.subLabel}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {displayResources.map((resource) => (
              <tr
                key={resource.id}
                className="bg-surface-container/50 font-bold"
              >
                <td className="sticky left-0 bg-surface-container px-3 py-3 text-left text-sm text-on-surface-variant z-10">
                  {resource.name} (Max: {resource.maxStaffingPercentage}%)
                </td>
                {timeColumns.map((col, index) => {
                  if (viewMode === 'day') {
                    const day = col.startDate;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isDayHoliday = isHoliday(day, resource.location, companyCalendar);
                    return (
                      <ReadonlyDailyTotalCell
                        key={index}
                        resource={resource}
                        date={formatDate(day, 'iso')}
                        isNonWorkingDay={isWeekend || isDayHoliday}
                      />
                    );
                  } else {
                    return (
                      <ReadonlyAggregatedWorkloadCell
                        key={index}
                        resource={resource}
                        startDate={col.startDate}
                        endDate={col.endDate}
                      />
                    );
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {displayResources.length === 0 && (
          <div className="text-center py-8 text-on-surface-variant">
            Nessuna risorsa trovata con i filtri correnti.
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkloadPage;