/**
 * @file DashboardPage.tsx
 * @description Pagina della dashboard che visualizza varie metriche e analisi aggregate sui dati di staffing.
 */

import React, { useMemo, useState } from 'react';
import { useEntitiesContext, useAllocationsContext } from '../context/AppContext';
import { getWorkingDaysBetween, isHoliday } from '../utils/dateUtils';
import SearchableSelect from '../components/SearchableSelect';
import { useNavigate, Link } from 'react-router-dom';

// --- Tipi e Hook per l'Ordinamento ---

type SortDirection = 'ascending' | 'descending';

interface SortConfig<T> {
  key: keyof T | string;
  direction: SortDirection;
}

const useSortableData = <T extends object>(items: T[], initialConfig: SortConfig<T> | null = null) => {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialConfig);

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const getNestedValue = (obj: any, path: string) =>
          path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);

        const aValue = getNestedValue(a, sortConfig.key as string);
        const bValue = getNestedValue(b, sortConfig.key as string);

        if (aValue == null) return 1;
        if (bValue == null) return -1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'ascending' ? aValue - bValue : bValue - aValue;
        }
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortConfig.direction === 'ascending'
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: keyof T | string) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

/**
 * Formatta un valore numerico o stringa come valuta EUR in formato italiano.
 * @param {number | string} value - Il valore da formattare.
 * @returns {string} La stringa formattata (es. "€ 1.234,56").
 */
const formatCurrency = (value: number | string): string => {
  const numValue = Number(value) || 0;
  return numValue.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
};

// Cache semplice per le date ISO, per evitare new Date(...) ripetuti
const dateCache = new Map<string, Date>();
const parseISODate = (s: string): Date => {
  const cached = dateCache.get(s);
  if (cached) return cached;
  const d = new Date(s);
  dateCache.set(s, d);
  return d;
};

/**
 * Componente per la pagina Dashboard.
 * Mostra una serie di "card" con analisi dei dati, come allocazione media,
 * FTE per progetto, analisi dei budget e altro, ora dotate di filtri individuali.
 * @returns {React.ReactElement} La pagina della dashboard.
 */
const DashboardPage: React.FC = () => {
  const {
    resources,
    roles,
    projects,
    clients,
    assignments,
    clientSectors,
    locations,
    companyCalendar,
  } = useEntitiesContext();
  const { allocations } = useAllocationsContext();
  const navigate = useNavigate();

  // Stati dei filtri per ogni card
  const [avgAllocFilter, setAvgAllocFilter] = useState({ resourceId: '' });
  const [fteFilter, setFteFilter] = useState({ clientId: '' });
  const [budgetFilter, setBudgetFilter] = useState({ clientId: '' });
  const [underutilizedFilter, setUnderutilizedFilter] = useState(
    new Date().toISOString().slice(0, 7),
  ); // Formato YYYY-MM
  const [effortByClientFilter, setEffortByClientFilter] = useState({ sector: '' });

  // --- Lookup veloci e raggruppamenti ---

  const activeResources = useMemo(
    () => resources.filter((r) => !r.resigned),
    [resources],
  );

  const resourceById = useMemo(() => {
    const map: Record<string, (typeof resources)[number]> = {};
    resources.forEach((r) => {
      if (r.id != null) map[String(r.id)] = r;
    });
    return map;
  }, [resources]);

  const roleById = useMemo(() => {
    const map: Record<string, (typeof roles)[number]> = {};
    roles.forEach((r) => {
      if (r.id != null) map[String(r.id)] = r;
    });
    return map;
  }, [roles]);

  const projectById = useMemo(() => {
    const map: Record<string, (typeof projects)[number]> = {};
    projects.forEach((p) => {
      if (p.id != null) map[String(p.id)] = p;
    });
    return map;
  }, [projects]);

  const clientById = useMemo(() => {
    const map: Record<string, (typeof clients)[number]> = {};
    clients.forEach((c) => {
      if (c.id != null) map[String(c.id)] = c;
    });
    return map;
  }, [clients]);

  const assignmentById = useMemo(() => {
    const map: Record<string, (typeof assignments)[number]> = {};
    assignments.forEach((a) => {
      if (a.id != null) map[String(a.id)] = a;
    });
    return map;
  }, [assignments]);

  const assignmentsByResource = useMemo(() => {
    const map: Record<string, (typeof assignments)> = {};
    assignments.forEach((a) => {
      if (!a.resourceId) return;
      const key = String(a.resourceId);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [assignments]);

  const assignmentsByProject = useMemo(() => {
    const map: Record<string, (typeof assignments)> = {};
    assignments.forEach((a) => {
      if (!a.projectId) return;
      const key = String(a.projectId);
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    return map;
  }, [assignments]);

  // --- Calcoli per le Card Aggregate in Cima ---

  /**
   * @description Calcola i KPI aggregati: budget totale, giorni-uomo totali, risorse non allocate, progetti senza staff.
   */
  const overallKPIs = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);

    let totalPersonDays = 0;

    for (const assignmentId in allocations) {
      const assignment = assignmentById[assignmentId];
      if (!assignment) continue;

      const resource = assignment.resourceId ? resourceById[String(assignment.resourceId)] : undefined;
      if (!resource) continue;

      const allocMap = allocations[assignmentId];
      const lastDayTs = resource.lastDayOfWork
        ? new Date(resource.lastDayOfWork).getTime()
        : null;

      for (const dateStr in allocMap) {
        const allocDate = parseISODate(dateStr);
        const ts = allocDate.getTime();
        if (lastDayTs && ts > lastDayTs) continue;

        const day = allocDate.getDay();
        if (day === 0 || day === 6) continue;
        if (isHoliday(allocDate, resource.location ?? null, companyCalendar)) continue;

        totalPersonDays += allocMap[dateStr] / 100;
      }
    }

    const assignedResourceIds = new Set(assignments.map((a) => a.resourceId));
    const unassignedResources = activeResources.filter(
      (r) => r.id && !assignedResourceIds.has(r.id),
    );

    const staffedProjectIds = new Set(assignments.map((a) => a.projectId));
    const unstaffedProjects = projects.filter(
      (p) => p.status === 'In corso' && p.id && !staffedProjectIds.has(p.id),
    );

    return { totalBudget, totalPersonDays, unassignedResources, unstaffedProjects };
  }, [projects, allocations, assignmentById, resourceById, assignments, activeResources, companyCalendar]);

  /**
   * @description Calcola i KPI per il mese corrente: costo stimato, giorni-uomo allocati, e costo per cliente.
   */
  const currentMonthKPIs = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    let totalCost = 0;
    let totalPersonDays = 0;
    const costByClient: { [clientId: string]: { id: string; name: string; cost: number } } = {};

    clients.forEach((c) => {
      if (c.id) costByClient[String(c.id)] = { id: String(c.id), name: c.name, cost: 0 };
    });

    for (const assignmentId in allocations) {
      const assignment = assignmentById[assignmentId];
      if (!assignment) continue;

      const resource = assignment.resourceId ? resourceById[String(assignment.resourceId)] : undefined;
      if (!resource || resource.resigned) continue;

      const role = resource.roleId ? roleById[String(resource.roleId)] : undefined;
      const dailyRate = role?.dailyCost || 0;
      const project = assignment.projectId ? projectById[String(assignment.projectId)] : undefined;

      const allocMap = allocations[assignmentId];
      const lastDayTs = resource.lastDayOfWork
        ? new Date(resource.lastDayOfWork).getTime()
        : null;

      for (const dateStr in allocMap) {
        const allocDate = parseISODate(dateStr);
        const ts = allocDate.getTime();
        if (lastDayTs && ts > lastDayTs) continue;

        if (allocDate < firstDay || allocDate > lastDay) continue;

        const day = allocDate.getDay();
        if (day === 0 || day === 6) continue;
        if (isHoliday(allocDate, resource.location ?? null, companyCalendar)) continue;

        const percentage = allocMap[dateStr];
        const personDayFraction = percentage / 100;
        const dailyCost = personDayFraction * dailyRate;

        totalCost += dailyCost;
        totalPersonDays += personDayFraction;

        const clientId = project?.clientId ? String(project.clientId) : null;
        if (clientId && costByClient[clientId]) {
          costByClient[clientId].cost += dailyCost;
        }
      }
    }

    const clientCostArray = Object.values(costByClient)
      .filter((c) => c.cost > 0)
      .sort((a, b) => b.cost - a.cost);

    return { totalCost, totalPersonDays, clientCostArray };
  }, [
    allocations,
    assignmentById,
    resourceById,
    roleById,
    projectById,
    clients,
    companyCalendar,
  ]);

  // --- Calcoli per le Card di Analisi Dettagliata ---

  /**
   * @description Calcola l'allocazione media per risorsa per il mese corrente e il mese prossimo.
   */
  const averageAllocationData = useMemo(() => {
    const now = new Date();

    let results = activeResources.map((resource) => {
      // Mese corrente
      const currentMonthFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const currentMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const effectiveCurrentEnd =
        resource.lastDayOfWork &&
        new Date(resource.lastDayOfWork) < currentMonthLastDay
          ? new Date(resource.lastDayOfWork)
          : currentMonthLastDay;
      const workingDaysCurrentMonth = getWorkingDaysBetween(
        currentMonthFirstDay,
        effectiveCurrentEnd,
        companyCalendar,
        resource.location,
      );

      // Mese prossimo
      const nextMonthFirstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthLastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const effectiveNextEnd =
        resource.lastDayOfWork && new Date(resource.lastDayOfWork) < nextMonthLastDay
          ? new Date(resource.lastDayOfWork)
          : nextMonthLastDay;
      const workingDaysNextMonth = getWorkingDaysBetween(
        nextMonthFirstDay,
        effectiveNextEnd,
        companyCalendar,
        resource.location,
      );

      const resourceAssignments = resource.id
        ? assignmentsByResource[String(resource.id)] ?? []
        : [];

      let totalPersonDaysCurrentMonth = 0;
      let totalPersonDaysNextMonth = 0;

      const lastDayTs = resource.lastDayOfWork
        ? new Date(resource.lastDayOfWork).getTime()
        : null;

      resourceAssignments.forEach((assignment) => {
        const allocMap = assignment.id ? allocations[assignment.id] : undefined;
        if (!allocMap) return;

        for (const dateStr in allocMap) {
          const allocDate = parseISODate(dateStr);
          const ts = allocDate.getTime();
          if (lastDayTs && ts > lastDayTs) continue;
          if (isHoliday(allocDate, resource.location, companyCalendar)) continue;

          const percentage = allocMap[dateStr];
          const personDayFraction = percentage / 100;

          if (allocDate >= currentMonthFirstDay && allocDate <= currentMonthLastDay) {
            totalPersonDaysCurrentMonth += personDayFraction;
          }

          if (allocDate >= nextMonthFirstDay && allocDate <= nextMonthLastDay) {
            totalPersonDaysNextMonth += personDayFraction;
          }
        }
      });

      const avgCurrentMonth =
        workingDaysCurrentMonth > 0
          ? (totalPersonDaysCurrentMonth / workingDaysCurrentMonth) * 100
          : 0;
      const avgNextMonth =
        workingDaysNextMonth > 0
          ? (totalPersonDaysNextMonth / workingDaysNextMonth) * 100
          : 0;

      const role = resource.roleId ? roleById[String(resource.roleId)] : undefined;

      return { resource, role, avgCurrentMonth, avgNextMonth };
    });

    if (avgAllocFilter.resourceId) {
      results = results.filter(
        (item) => item.resource?.id === avgAllocFilter.resourceId,
      );
    }

    return results.sort((a, b) =>
      a.resource!.name.localeCompare(b.resource!.name),
    );
  }, [
    activeResources,
    assignmentsByResource,
    allocations,
    roleById,
    companyCalendar,
    avgAllocFilter,
  ]);

  /**
   * @description Calcola il Full-Time Equivalent (FTE) per progetto, filtrabile per cliente.
   */
  const fteData = useMemo(() => {
    return projects
      .filter((project) => !fteFilter.clientId || project.clientId === fteFilter.clientId)
      .map((project) => {
        if (!project.id || !project.startDate || !project.endDate) return null;

        const client = project.clientId
          ? clientById[String(project.clientId)]
          : undefined;
        const projectStartDate = new Date(project.startDate);
        const projectEndDate = new Date(project.endDate);

        const projectAssignments = assignmentsByProject[String(project.id)] ?? [];
        let totalAllocatedDays = 0;
        let projectWorkingDays = 0;

        projectAssignments.forEach((assignment) => {
          const resource = assignment.resourceId
            ? resourceById[String(assignment.resourceId)]
            : undefined;
          if (!resource) return;

          const effectiveStartDate =
            resource.hireDate && new Date(resource.hireDate) > projectStartDate
              ? new Date(resource.hireDate)
              : projectStartDate;
          const effectiveEndDate =
            resource.lastDayOfWork &&
            new Date(resource.lastDayOfWork) < projectEndDate
              ? new Date(resource.lastDayOfWork)
              : projectEndDate;

          if (effectiveStartDate > effectiveEndDate) return;

          projectWorkingDays += getWorkingDaysBetween(
            effectiveStartDate,
            effectiveEndDate,
            companyCalendar,
            resource.location,
          );

          const allocMap = assignment.id ? allocations[assignment.id] : undefined;
          if (allocMap) {
            const lastDayTs = resource.lastDayOfWork
              ? new Date(resource.lastDayOfWork).getTime()
              : null;

            for (const dateStr in allocMap) {
              const allocDate = parseISODate(dateStr);
              const ts = allocDate.getTime();
              if (lastDayTs && ts > lastDayTs) continue;

              if (
                !isHoliday(allocDate, resource.location ?? null, companyCalendar) &&
                allocDate.getDay() !== 0 &&
                allocDate.getDay() !== 6 &&
                allocDate >= projectStartDate &&
                allocDate <= projectEndDate
              ) {
                totalAllocatedDays += allocMap[dateStr] / 100;
              }
            }
          }
        });

        const fte =
          projectWorkingDays > 0 ? totalAllocatedDays / projectWorkingDays : 0;

        return {
          ...project,
          clientName: client?.name || 'N/A',
          fte,
          totalAllocatedDays,
          projectWorkingDays,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      name: string;
      clientName: string;
      fte: number;
      totalAllocatedDays: number;
      projectWorkingDays: number;
    }>;
  }, [
    projects,
    fteFilter,
    clientById,
    assignmentsByProject,
    resourceById,
    allocations,
    companyCalendar,
  ]);

  /**
   * @description Esegue un'analisi dei costi per progetto, filtrabile per cliente.
   */
  const budgetAnalysisData = useMemo(() => {
    return projects
      .filter((project) => !budgetFilter.clientId || project.clientId === budgetFilter.clientId)
      .map((project) => {
        if (!project.id) {
          return {
            ...project,
            fullBudget: Number(project.budget || 0),
            estimatedCost: 0,
            variance: Number(project.budget || 0),
          };
        }

        let rawEstimatedCost = 0;
        const projectAssignments = assignmentsByProject[String(project.id)] ?? [];

        projectAssignments.forEach((assignment) => {
          const resource = assignment.resourceId
            ? resourceById[String(assignment.resourceId)]
            : undefined;
          if (!resource) return;

          const role = resource.roleId
            ? roleById[String(resource.roleId)]
            : undefined;
          const dailyRate = role?.dailyCost || 0;

          const allocMap = assignment.id ? allocations[assignment.id] : undefined;
          let allocatedPersonDays = 0;
          if (allocMap) {
            const lastDayTs = resource.lastDayOfWork
              ? new Date(resource.lastDayOfWork).getTime()
              : null;

            for (const dateStr in allocMap) {
              const allocDate = parseISODate(dateStr);
              const ts = allocDate.getTime();
              if (lastDayTs && ts > lastDayTs) continue;

              const day = allocDate.getDay();
              if (day === 0 || day === 6) continue;
              if (isHoliday(allocDate, resource.location ?? null, companyCalendar))
                continue;

              allocatedPersonDays += allocMap[dateStr] / 100;
            }
          }
          rawEstimatedCost += allocatedPersonDays * dailyRate;
        });

        const projectBudget = Number(project.budget || 0);
        const estimatedCost =
          rawEstimatedCost *
          (Number(project.realizationPercentage || 100) / 100);
        const variance = projectBudget - estimatedCost;

        return { ...project, fullBudget: projectBudget, estimatedCost, variance };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [
    projects,
    budgetFilter,
    assignmentsByProject,
    resourceById,
    roleById,
    allocations,
    companyCalendar,
  ]);

  /**
   * @description Identifica le risorse sottoutilizzate in un mese specifico (selezionabile).
   */
  const underutilizedResourcesData = useMemo(() => {
    const [year, month] = underutilizedFilter.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    return activeResources
      .map((resource) => {
        const effectiveLastDay =
          resource.lastDayOfWork &&
          new Date(resource.lastDayOfWork) < lastDay
            ? new Date(resource.lastDayOfWork)
            : lastDay;
        if (firstDay > effectiveLastDay) return null;

        const workingDaysInMonth = getWorkingDaysBetween(
          firstDay,
          effectiveLastDay,
          companyCalendar,
          resource.location,
        );
        if (workingDaysInMonth === 0) {
          return {
            ...resource,
            avgAllocation: 0,
            role:
              (resource.roleId
                ? roleById[String(resource.roleId)]?.name
                : 'N/A') || 'N/A',
          };
        }

        const resourceAssignments = resource.id
          ? assignmentsByResource[String(resource.id)] ?? []
          : [];

        let totalPersonDays = 0;
        resourceAssignments.forEach((assignment) => {
          const allocMap = assignment.id ? allocations[assignment.id] : undefined;
          if (!allocMap) return;

          for (const dateStr in allocMap) {
            const allocDate = parseISODate(dateStr);
            if (
              allocDate >= firstDay &&
              allocDate <= effectiveLastDay &&
              !isHoliday(allocDate, resource.location, companyCalendar)
            ) {
              totalPersonDays += allocMap[dateStr] / 100;
            }
          }
        });

        const avgAllocation = Math.round(
          (totalPersonDays / workingDaysInMonth) * 100,
        );
        return {
          ...resource,
          avgAllocation,
          role:
            (resource.roleId
              ? roleById[String(resource.roleId)]?.name
              : 'N/A') || 'N/A',
        };
      })
      .filter(Boolean)
      .filter((r): r is Exclude<typeof r, null> => r !== null)
      .filter((r) => r.avgAllocation < 100)
      .sort((a, b) => a.avgAllocation - b.avgAllocation);
  }, [
    activeResources,
    assignmentsByResource,
    allocations,
    roleById,
    companyCalendar,
    underutilizedFilter,
  ]);

  /**
   * @description Aggrega sforzo e budget per cliente, filtrabile per settore.
   */
  const effortByClientData = useMemo(() => {
    const clientData: {
      [clientId: string]: {
        id: string;
        name: string;
        projectCount: number;
        totalPersonDays: number;
        totalBudget: number;
      };
    } = {};

    clients
      .filter(
        (c) =>
          !effortByClientFilter.sector || c.sector === effortByClientFilter.sector,
      )
      .forEach((client) => {
        if (client.id) {
          clientData[String(client.id)] = {
            id: String(client.id),
            name: client.name,
            projectCount: 0,
            totalPersonDays: 0,
            totalBudget: 0,
          };
        }
      });

    projects.forEach((project) => {
      if (!project.clientId) return;
      const clientKey = String(project.clientId);
      if (!clientData[clientKey]) return;

      if (project.status === 'In corso') clientData[clientKey].projectCount++;
      clientData[clientKey].totalBudget += Number(project.budget || 0);

      const projectAssignments = project.id
        ? assignmentsByProject[String(project.id)] ?? []
        : [];

      let projectPersonDays = 0;
      projectAssignments.forEach((assignment) => {
        const resource = assignment.resourceId
          ? resourceById[String(assignment.resourceId)]
          : undefined;
        if (!resource) return;

        const allocMap = assignment.id ? allocations[assignment.id] : undefined;
        if (!allocMap) return;

        const lastDayTs = resource.lastDayOfWork
          ? new Date(resource.lastDayOfWork).getTime()
          : null;

        for (const dateStr in allocMap) {
          const allocDate = parseISODate(dateStr);
          const ts = allocDate.getTime();
          if (lastDayTs && ts > lastDayTs) continue;

          const day = allocDate.getDay();
          if (day === 0 || day === 6) continue;
          if (isHoliday(allocDate, resource.location ?? null, companyCalendar))
            continue;

          projectPersonDays += allocMap[dateStr] / 100;
        }
      });

      clientData[clientKey].totalPersonDays += projectPersonDays;
    });

    return Object.values(clientData).sort(
      (a, b) => b.totalBudget - a.totalBudget,
    );
  }, [
    clients,
    projects,
    effortByClientFilter,
    assignmentsByProject,
    resourceById,
    allocations,
    companyCalendar,
  ]);

  /**
   * @description Aggrega i dati di sforzo (giorni-uomo) per "horizontal".
   */
  const effortByHorizontalData = useMemo(() => {
    const horizontalData: { [key: string]: number } = {};

    assignments.forEach((assignment) => {
      const resource = assignment.resourceId
        ? resourceById[String(assignment.resourceId)]
        : undefined;
      if (!resource) return;

      const horizontal = resource.horizontal;
      if (!horizontalData[horizontal]) horizontalData[horizontal] = 0;

      const allocMap = assignment.id ? allocations[assignment.id] : undefined;
      if (!allocMap) return;

      const lastDayTs = resource.lastDayOfWork
        ? new Date(resource.lastDayOfWork).getTime()
        : null;

      let personDays = 0;
      for (const dateStr in allocMap) {
        const allocDate = parseISODate(dateStr);
        const ts = allocDate.getTime();
        if (lastDayTs && ts > lastDayTs) continue;

        const day = allocDate.getDay();
        if (day === 0 || day === 6) continue;
        if (isHoliday(allocDate, resource.location, companyCalendar)) continue;

        personDays += allocMap[dateStr] / 100;
      }
      horizontalData[horizontal] += personDays;
    });

    return Object.entries(horizontalData)
      .map(([name, totalPersonDays]) => ({ name, totalPersonDays }))
      .sort((a, b) => b.totalPersonDays - a.totalPersonDays);
  }, [assignments, allocations, resourceById, companyCalendar]);

  /**
   * @description Aggrega i dati di analisi per Sede (Mese Corrente).
   */
  const analysisByLocationData = useMemo(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const locationData: {
      [location: string]: {
        resourceCount: number;
        personDays: number;
        availablePersonDays: number;
      };
    } = {};

    locations.forEach((loc) => {
      locationData[loc.value] = { resourceCount: 0, personDays: 0, availablePersonDays: 0 };
    });

    activeResources.forEach((res) => {
      if (res.location && !locationData[res.location]) {
        locationData[res.location] = {
          resourceCount: 0,
          personDays: 0,
          availablePersonDays: 0,
        };
      }
    });

    activeResources.forEach((resource) => {
      if (resource.location) {
        locationData[resource.location].resourceCount++;
        const effectiveEnd =
          resource.lastDayOfWork &&
          new Date(resource.lastDayOfWork) < lastDay
            ? new Date(resource.lastDayOfWork)
            : lastDay;
        if (firstDay > effectiveEnd) return;

        locationData[resource.location].availablePersonDays += getWorkingDaysBetween(
          firstDay,
          effectiveEnd,
          companyCalendar,
          resource.location,
        );
      }
    });

    assignments.forEach((assignment) => {
      const resource = assignment.resourceId
        ? resourceById[String(assignment.resourceId)]
        : undefined;
      if (!resource || !resource.location) return;

      const allocMap = assignment.id ? allocations[assignment.id] : undefined;
      if (!allocMap) return;

      const lastDayTs = resource.lastDayOfWork
        ? new Date(resource.lastDayOfWork).getTime()
        : null;

      for (const dateStr in allocMap) {
        const allocDate = parseISODate(dateStr);
        const ts = allocDate.getTime();
        if (lastDayTs && ts > lastDayTs) continue;

        if (allocDate < firstDay || allocDate > lastDay) continue;
        if (
          !isHoliday(allocDate, resource.location, companyCalendar) &&
          allocDate.getDay() !== 0 &&
          allocDate.getDay() !== 6
        ) {
          locationData[resource.location].personDays += allocMap[dateStr] / 100;
        }
      }
    });

    return Object.entries(locationData)
      .map(([locationName, data]) => {
        const utilization =
          data.availablePersonDays > 0
            ? (data.personDays / data.availablePersonDays) * 100
            : 0;
        return {
          locationName,
          resourceCount: data.resourceCount,
          personDays: data.personDays,
          utilization,
        };
      })
      .filter((d) => d.resourceCount > 0)
      .sort((a, b) => b.resourceCount - a.resourceCount);
  }, [activeResources, assignments, allocations, locations, companyCalendar, resourceById]);

  // --- Totali per le tabelle ---

  const fteTotals = useMemo(() => {
    const totalDays = fteData.reduce((sum, d) => sum + d.totalAllocatedDays, 0);
    const totalWorkingDays = fteData.reduce(
      (sum, d) => sum + d.projectWorkingDays,
      0,
    );
    const avgFte = totalWorkingDays > 0 ? totalDays / totalWorkingDays : 0;
    return { totalDays, avgFte };
  }, [fteData]);

  const budgetTotals = useMemo(
    () =>
      budgetAnalysisData.reduce(
        (acc, p) => ({
          budget: acc.budget + p.fullBudget,
          cost: acc.cost + p.estimatedCost,
          variance: acc.variance + p.variance,
        }),
        { budget: 0, cost: 0, variance: 0 },
      ),
    [budgetAnalysisData],
  );

  const effortByClientTotals = useMemo(
    () =>
      effortByClientData.reduce(
        (acc, c) => ({
          days: acc.days + c.totalPersonDays,
          budget: acc.budget + c.totalBudget,
        }),
        { days: 0, budget: 0 },
      ),
    [effortByClientData],
  );

  const effortByHorizontalTotal = useMemo(
    () => effortByHorizontalData.reduce((sum, h) => sum + h.totalPersonDays, 0),
    [effortByHorizontalData],
  );

  const avgAllocationTotals = useMemo(() => {
    if (averageAllocationData.length === 0) {
      return { currentMonth: 0, nextMonth: 0 };
    }
    const totalCurrent = averageAllocationData.reduce(
      (sum, d) => sum + d.avgCurrentMonth,
      0,
    );
    const totalNext = averageAllocationData.reduce(
      (sum, d) => sum + d.avgNextMonth,
      0,
    );
    return {
      currentMonth: totalCurrent / averageAllocationData.length,
      nextMonth: totalNext / averageAllocationData.length,
    };
  }, [averageAllocationData]);

  /**
   * Determina il colore del testo per l'allocazione media.
   * @param {number} avg - La percentuale di allocazione.
   * @returns {string} La classe CSS per il colore.
   */
  const getAvgAllocationColor = (avg: number): string => {
    if (avg > 90) return 'text-red-600 dark:text-red-400 font-bold';
    if (avg >= 70) return 'text-yellow-600 dark:text-yellow-400 font-semibold';
    return 'text-green-600 dark:text-green-400';
  };

  const resourceOptions = useMemo(
    () => activeResources.map((r) => ({ value: r.id!, label: r.name })),
    [activeResources],
  );
  const clientOptions = useMemo(
    () => clients.map((c) => ({ value: c.id!, label: c.name })),
    [clients],
  );
  const sectorOptions = useMemo(
    () => clientSectors.map((s) => ({ value: s.value, label: s.value })),
    [clientSectors],
  );

  // Sorting hooks for each table
  const {
    items: sortedAvgAllocation,
    requestSort: requestAvgAllocSort,
    sortConfig: avgAllocSortConfig,
  } = useSortableData(averageAllocationData, {
    key: 'resource.name',
    direction: 'ascending',
  });
  const {
    items: sortedFte,
    requestSort: requestFteSort,
    sortConfig: fteSortConfig,
  } = useSortableData(fteData as any[], { key: 'name', direction: 'ascending' });
  const {
    items: sortedBudget,
    requestSort: requestBudgetSort,
    sortConfig: budgetSortConfig,
  } = useSortableData(budgetAnalysisData, {
    key: 'name',
    direction: 'ascending',
  });
  const {
    items: sortedUnderutilized,
    requestSort: requestUnderutilizedSort,
    sortConfig: underutilizedSortConfig,
  } = useSortableData(underutilizedResourcesData, {
    key: 'avgAllocation',
    direction: 'ascending',
  });
  const {
    items: sortedEffortByClient,
    requestSort: requestEffortClientSort,
    sortConfig: effortClientSortConfig,
  } = useSortableData(effortByClientData, {
    key: 'totalBudget',
    direction: 'descending',
  });
  const {
    items: sortedClientCost,
    requestSort: requestClientCostSort,
    sortConfig: clientCostSortConfig,
  } = useSortableData(currentMonthKPIs.clientCostArray, {
    key: 'cost',
    direction: 'descending',
  });
  const {
    items: sortedEffortByHorizontal,
    requestSort: requestEffortHorizontalSort,
    sortConfig: effortHorizontalSortConfig,
  } = useSortableData(effortByHorizontalData, {
    key: 'totalPersonDays',
    direction: 'descending',
  });
  const {
    items: sortedLocation,
    requestSort: requestLocationSort,
    sortConfig: locationSortConfig,
  } = useSortableData(analysisByLocationData, {
    key: 'resourceCount',
    direction: 'descending',
  });

  const SortableHeader: React.FC<{
    label: string;
    sortKey: string;
    sortConfig: SortConfig<any> | null;
    requestSort: (key: string) => void;
  }> = ({ label, sortKey, sortConfig, requestSort }) => (
    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
      <button
        type="button"
        onClick={() => requestSort(sortKey)}
        className="flex items-center space-x-1 hover:text-gray-900 dark:hover:text-white"
      >
        <span
          className={
            sortConfig?.key === sortKey ? 'font-bold text-gray-800 dark:text-white' : ''
          }
        >
          {label}
        </span>
        <span className="text-gray-400">↕️</span>
      </button>
    </th>
  );

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-8">
        Dashboard
      </h1>

      {/* Nuove Card Aggregate */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Budget Complessivo
          </h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(overallKPIs.totalBudget)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Costo Stimato (Mese Corrente)
          </h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(currentMonthKPIs.totalCost)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Giorni Allocati (Mese Corrente)
          </h3>
          <p className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
            {currentMonthKPIs.totalPersonDays.toLocaleString('it-IT', {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>

        <div
          className="bg-amber-100 dark:bg-amber-900/50 rounded-lg shadow p-5 flex flex-col justify-start cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/80 min-h-[150px]"
          onClick={() => navigate('/resources?filter=unassigned')}
        >
          <div className="flex justify-between items-start w-full">
            <div>
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Risorse Non Allocate
              </h3>
              <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">
                {overallKPIs.unassignedResources.length}
              </p>
            </div>
            <span className="text-3xl opacity-50">👥</span>
          </div>
          {overallKPIs.unassignedResources.length > 0 && (
            <div className="mt-2 text-xs text-amber-800 dark:text-amber-200 overflow-y-auto max-h-20 pr-2 w-full">
              <ul className="list-disc list-inside">
                {overallKPIs.unassignedResources.map((r) => (
                  <li key={r.id} className="truncate">
                    {r.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div
          className="bg-amber-100 dark:bg-amber-900/50 rounded-lg shadow p-5 flex flex-col justify-start cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/80 min-h-[150px]"
          onClick={() => navigate('/projects?filter=unstaffed')}
        >
          <div className="flex justify-between items-start w-full">
            <div>
              <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Progetti Senza Staff
              </h3>
              <p className="mt-1 text-3xl font-semibold text-amber-900 dark:text-amber-100">
                {overallKPIs.unstaffedProjects.length}
              </p>
            </div>
            <span className="text-3xl opacity-50">💼</span>
          </div>
          {overallKPIs.unstaffedProjects.length > 0 && (
            <div className="mt-2 text-xs text-amber-800 dark:text-amber-200 overflow-y-auto max-h-20 pr-2 w-full">
              <ul className="list-disc list-inside">
                {overallKPIs.unstaffedProjects.map((p) => (
                  <li key={p.id} className="truncate">
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Card Allocazione Media */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">Allocazione Media</h2>
            <div className="w-48">
              <SearchableSelect
                name="resourceId"
                value={avgAllocFilter.resourceId}
                onChange={(_, v) => setAvgAllocFilter({ resourceId: v })}
                options={resourceOptions}
                placeholder="Tutte le Risorse"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Risorsa"
                    sortKey="resource.name"
                    sortConfig={avgAllocSortConfig}
                    requestSort={requestAvgAllocSort}
                  />
                  <SortableHeader
                    label="Alloc. Mese Corrente"
                    sortKey="avgCurrentMonth"
                    sortConfig={avgAllocSortConfig}
                    requestSort={requestAvgAllocSort}
                  />
                  <SortableHeader
                    label="Alloc. Mese Prossimo"
                    sortKey="avgNextMonth"
                    sortConfig={avgAllocSortConfig}
                    requestSort={requestAvgAllocSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedAvgAllocation.map((data, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <div>
                        <Link
                          to={`/workload?resourceId=${data.resource.id}`}
                          className="text-primary hover:underline"
                        >
                          {data.resource?.name}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500">{data.role?.name}</div>
                    </td>
                    <td
                      className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(
                        data.avgCurrentMonth,
                      )}`}
                    >
                      {data.avgCurrentMonth.toLocaleString('it-IT', {
                        maximumFractionDigits: 0,
                      })}
                      %
                    </td>
                    <td
                      className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(
                        data.avgNextMonth,
                      )}`}
                    >
                      {data.avgNextMonth.toLocaleString('it-IT', {
                        maximumFractionDigits: 0,
                      })}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="px-4 py-2 text-left text-sm">Media Totale</td>
                  <td
                    className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(
                      avgAllocationTotals.currentMonth,
                    )}`}
                  >
                    {avgAllocationTotals.currentMonth.toLocaleString('it-IT', {
                      maximumFractionDigits: 0,
                    })}
                    %
                  </td>
                  <td
                    className={`px-4 py-2 whitespace-nowrap text-sm ${getAvgAllocationColor(
                      avgAllocationTotals.nextMonth,
                    )}`}
                  >
                    {avgAllocationTotals.nextMonth.toLocaleString('it-IT', {
                      maximumFractionDigits: 0,
                    })}
                    %
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Card FTE per Progetto */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">FTE per Progetto</h2>
            <div className="w-48">
              <SearchableSelect
                name="clientId"
                value={fteFilter.clientId}
                onChange={(_, v) => setFteFilter({ clientId: v })}
                options={clientOptions}
                placeholder="Tutti i Clienti"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Progetto"
                    sortKey="name"
                    sortConfig={fteSortConfig}
                    requestSort={requestFteSort}
                  />
                  <SortableHeader
                    label="Giorni Alloc."
                    sortKey="totalAllocatedDays"
                    sortConfig={fteSortConfig}
                    requestSort={requestFteSort}
                  />
                  <SortableHeader
                    label="FTE"
                    sortKey="fte"
                    sortConfig={fteSortConfig}
                    requestSort={requestFteSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedFte.map(
                  (data) =>
                    data && (
                      <tr key={data.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          <div>
                            <Link
                              to={`/projects?projectId=${data.id}`}
                              className="text-primary hover:underline"
                            >
                              {data.name}
                            </Link>
                          </div>
                          <div className="text-xs text-gray-500">{data.clientName}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                          {data.totalAllocatedDays.toLocaleString('it-IT', {
                            maximumFractionDigits: 1,
                          })}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-center font-bold text-primary dark:text-blue-400">
                          {data.fte.toLocaleString('it-IT', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ),
                )}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="px-4 py-2 text-left text-sm">Totale / Media FTE</td>
                  <td className="px-4 py-2 text-center text-sm">
                    {fteTotals.totalDays.toLocaleString('it-IT', {
                      maximumFractionDigits: 1,
                    })}
                  </td>
                  <td className="px-4 py-2 text-center text-sm">
                    {fteTotals.avgFte.toLocaleString('it-IT', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Card Analisi Budget */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">Analisi Budget</h2>
            <div className="w-48">
              <SearchableSelect
                name="clientId"
                value={budgetFilter.clientId}
                onChange={(_, v) => setBudgetFilter({ clientId: v })}
                options={clientOptions}
                placeholder="Tutti i Clienti"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Progetto"
                    sortKey="name"
                    sortConfig={budgetSortConfig}
                    requestSort={requestBudgetSort}
                  />
                  <SortableHeader
                    label="Budget"
                    sortKey="fullBudget"
                    sortConfig={budgetSortConfig}
                    requestSort={requestBudgetSort}
                  />
                  <SortableHeader
                    label="Costo Stimato"
                    sortKey="estimatedCost"
                    sortConfig={budgetSortConfig}
                    requestSort={requestBudgetSort}
                  />
                  <SortableHeader
                    label="Varianza"
                    sortKey="variance"
                    sortConfig={budgetSortConfig}
                    requestSort={requestBudgetSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedBudget.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/projects?projectId=${p.id}`}
                        className="text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatCurrency(p.fullBudget)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {formatCurrency(p.estimatedCost)}
                    </td>
                    <td
                      className={`px-4 py-2 whitespace-nowrap text-sm font-semibold ${
                        p.variance >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatCurrency(p.variance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="px-4 py-2 text-left text-sm">Totali</td>
                  <td className="px-4 py-2 text-sm">
                    {formatCurrency(budgetTotals.budget)}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatCurrency(budgetTotals.cost)}
                  </td>
                  <td
                    className={`px-4 py-2 text-sm ${
                      budgetTotals.variance >= 0
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {formatCurrency(budgetTotals.variance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Card Risorse Sottoutilizzate */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">Risorse Sottoutilizzate</h2>
            <input
              type="month"
              value={underutilizedFilter}
              onChange={(e) => setUnderutilizedFilter(e.target.value)}
              className="form-input text-sm py-1 w-48"
            />
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Risorsa"
                    sortKey="name"
                    sortConfig={underutilizedSortConfig}
                    requestSort={requestUnderutilizedSort}
                  />
                  <SortableHeader
                    label="Alloc. Media"
                    sortKey="avgAllocation"
                    sortConfig={underutilizedSortConfig}
                    requestSort={requestUnderutilizedSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedUnderutilized.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      <div>
                        <Link
                          to={`/workload?resourceId=${r.id}`}
                          className="text-primary hover:underline"
                        >
                          {r.name}
                        </Link>
                      </div>
                      <div className="text-xs text-gray-500">{r.role}</div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-yellow-600 dark:text-yellow-400 font-semibold">
                      {r.avgAllocation.toLocaleString('it-IT')}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card Sforzo per Cliente */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">Analisi Sforzo per Cliente</h2>
            <div className="w-48">
              <SearchableSelect
                name="sector"
                value={effortByClientFilter.sector}
                onChange={(_, v) => setEffortByClientFilter({ sector: v })}
                options={sectorOptions}
                placeholder="Tutti i Settori"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Cliente"
                    sortKey="name"
                    sortConfig={effortClientSortConfig}
                    requestSort={requestEffortClientSort}
                  />
                  <SortableHeader
                    label="Giorni-Uomo"
                    sortKey="totalPersonDays"
                    sortConfig={effortClientSortConfig}
                    requestSort={requestEffortClientSort}
                  />
                  <SortableHeader
                    label="Valore Budget"
                    sortKey="totalBudget"
                    sortConfig={effortClientSortConfig}
                    requestSort={requestEffortClientSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedEffortByClient.map((c) => (
                  <tr key={c.name}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/projects?clientId=${c.id}`}
                        className="text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                      {c.totalPersonDays.toLocaleString('it-IT', {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {formatCurrency(c.totalBudget)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="px-4 py-2 text-left text-sm">Totali</td>
                  <td className="px-4 py-2 text-center text-sm">
                    {effortByClientTotals.days.toLocaleString('it-IT', {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {formatCurrency(effortByClientTotals.budget)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Card Costo Mensile per Cliente */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Costo Mensile per Cliente</h2>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Cliente"
                    sortKey="name"
                    sortConfig={clientCostSortConfig}
                    requestSort={requestClientCostSort}
                  />
                  <SortableHeader
                    label="Costo Stimato"
                    sortKey="cost"
                    sortConfig={clientCostSortConfig}
                    requestSort={requestClientCostSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedClientCost.map((c) => (
                  <tr key={c.name}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      <Link
                        to={`/projects?clientId=${c.id}`}
                        className="text-primary hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                      {formatCurrency(c.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="px-4 py-2 text-left text-sm">Costo Totale Mese</td>
                  <td className="px-4 py-2 text-sm">
                    {formatCurrency(currentMonthKPIs.totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Card Sforzo per Horizontal */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Analisi Sforzo per Horizontal</h2>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Horizontal"
                    sortKey="name"
                    sortConfig={effortHorizontalSortConfig}
                    requestSort={requestEffortHorizontalSort}
                  />
                  <SortableHeader
                    label="Giorni-Uomo"
                    sortKey="totalPersonDays"
                    sortConfig={effortHorizontalSortConfig}
                    requestSort={requestEffortHorizontalSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedEffortByHorizontal.map((h) => (
                  <tr key={h.name}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      {h.name}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                      {h.totalPersonDays.toLocaleString('it-IT', {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 dark:bg-gray-700 font-bold">
                  <td className="px-4 py-2 text-left text-sm">Totale</td>
                  <td className="px-4 py-2 text-center text-sm">
                    {effortByHorizontalTotal.toLocaleString('it-IT', {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Card Analisi per Sede */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Analisi per Sede (Mese Corrente)
          </h2>
          <div className="overflow-y-auto max-h-96">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <SortableHeader
                    label="Sede"
                    sortKey="locationName"
                    sortConfig={locationSortConfig}
                    requestSort={requestLocationSort}
                  />
                  <SortableHeader
                    label="N. Risorse"
                    sortKey="resourceCount"
                    sortConfig={locationSortConfig}
                    requestSort={requestLocationSort}
                  />
                  <SortableHeader
                    label="G/U Allocati"
                    sortKey="personDays"
                    sortConfig={locationSortConfig}
                    requestSort={requestLocationSort}
                  />
                  <SortableHeader
                    label="Utilizzo Medio"
                    sortKey="utilization"
                    sortConfig={locationSortConfig}
                    requestSort={requestLocationSort}
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sortedLocation.map((loc) => (
                  <tr key={loc.locationName}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium">
                      {loc.locationName}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                      {loc.resourceCount}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-center">
                      {loc.personDays.toFixed(1)}
                    </td>
                    <td
                      className={`px-4 py-2 whitespace-nowrap text-sm text-center font-semibold ${getAvgAllocationColor(
                        loc.utilization,
                      )}`}
                    >
                      {loc.utilization.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`.form-input, .form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-input, .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
    </div>
  );
};

export default DashboardPage;
