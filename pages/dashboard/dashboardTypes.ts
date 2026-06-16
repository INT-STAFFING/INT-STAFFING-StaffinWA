/**
 * @file dashboardTypes.ts
 * @description Interfacce TypeScript per le props dei componenti card della Dashboard
 * (estratte da DashboardCards.tsx) e per le righe dati visualizzate.
 *
 * I tipi qui definiti sono volutamente "ampi" abbastanza da accettare i valori
 * (loosely typed) prodotti dai useMemo di DashboardPage.tsx, senza modificare
 * la logica del componente padre.
 */

import { Option } from '../../components/forms/types';
import { Resource, Project, Contract } from '../../types';

// --- Tipi riusabili ---

/** Opzioni accettate da SearchableSelect (riuso del tipo Option dei form). */
export type SelectOption = Option;

/** Filtro per risorsa (es. AverageAllocationCard, SaturationTrend). */
export interface ResourceFilter {
    resourceId: string;
}

/** Filtro per cliente (FTE, Budget). */
export interface ClientFilter {
    clientId: string;
}

/** Filtro per cliente con intervallo di date (Budget Temporale, Tariffa Media). */
export interface ClientDateRangeFilter {
    clientId: string;
    startDate: string;
    endDate: string;
}

/** Funzione di navigazione condivisa tra le card. */
export type NavigateFn = (path: string) => void;

// --- KPI / Attention ---

export interface OverallKPIs {
    totalBudget: number;
    unassignedResources: Resource[];
    totalActiveResources: number;
    unstaffedProjects: Project[];
    totalActiveProjects: number;
}

export interface ClientCostEntry {
    id: string;
    name: string;
    cost: number;
}

export interface CurrentMonthKPIs {
    totalCost: number;
    totalPersonDays: number;
    clientCostArray: ClientCostEntry[];
    unallocatedFTE: number;
    totalAvailableFTE: number;
}

export interface KpiHeaderCardsProps {
    overallKPIs: OverallKPIs;
    currentMonthKPIs: CurrentMonthKPIs;
}

export interface AttentionCardsProps {
    overallKPIs: OverallKPIs;
    navigate: NavigateFn;
}

export interface UnallocatedFteCardProps {
    kpis: CurrentMonthKPIs;
}

export interface NoWbsLeakageCardProps {
    leakageAmount: number;
    navigate: NavigateFn;
}

export interface LeavesOverviewCardProps {
    navigate: NavigateFn;
}

// --- Righe dati ---

export interface AverageAllocationRow {
    id?: string;
    resource: Resource;
    currentMonth: number;
    nextMonth: number;
}

export interface AverageAllocationTotals {
    currentMonth: number;
    nextMonth: number;
}

/** Riga FTE per progetto: progetto completo + metriche derivate. */
export type FtePerProjectRow = Project & {
    totalPersonDays: number;
    fte: number;
};

export interface FtePerProjectTotals {
    totalDays: number;
    totalFte: number;
}

/** Riga analisi budget: progetto completo + metriche derivate. */
export type BudgetAnalysisRow = Project & {
    budget: number;
    estimatedCost: number;
    variance: number;
};

export interface BudgetAnalysisTotals {
    budget: number;
    cost: number;
    variance: number;
}

/** Riga analisi budget temporale. */
export type TemporalBudgetAnalysisRow = Project & {
    periodBudget: number;
    estimatedCost: number;
    variance: number;
};

export interface AverageDailyRateRow {
    id?: string;
    name: string;
    clientName: string;
    totalPersonDays: number;
    totalCost: number;
    avgDailyRate: number;
}

export interface AverageDailyRateTotals {
    totalDays: number;
    totalCost: number;
    weightedAverage: number;
}

export interface UnderutilizedResourceRow {
    id?: string;
    resource: Resource;
    avgAllocation: number;
}

export interface NamedValueRow {
    id?: string;
    name: string;
    value: number;
}

export interface EffortRow {
    id?: string;
    name: string;
    totalPersonDays: number;
}

export interface LocationAnalysisRow {
    id?: string;
    name: string;
    resourceCount: number;
    allocatedDays: number;
    avgUtilization: number;
}

export interface SaturationTrendPoint {
    month: Date;
    value: number;
}

export interface CostForecastPoint {
    month: Date;
    historic: number;
    forecast: number;
}

export interface AllocationMatrixData {
    matrix: Record<string, Record<string, number>>;
    functions: string[];
    industries: string[];
}

/** Riga saturazione WBS: contratto completo + metriche derivate. */
export type WbsSaturationRow = Contract & {
    consumed: number;
    saturation: number;
};

/** Riga scadenzario contratti: contratto completo. */
export type ContractExpirationRow = Contract;

export interface RevenueMixPoint {
    month: string;
    tm: number;
    fixed: number;
}

export interface BillingPipelinePoint {
    month: string;
    amount: number;
}

export interface TopMarginProjectRow {
    id?: string;
    name: string;
    revenue: number;
    cost: number;
    margin: number;
    marginPct: number;
}

// --- Props delle card con dati / filtri ---

export interface AverageAllocationCardProps {
    data: AverageAllocationRow[];
    filter: ResourceFilter;
    setFilter: (filter: ResourceFilter) => void;
    resourceOptions: SelectOption[];
    totals: AverageAllocationTotals;
    isLoading: boolean;
}

export interface FtePerProjectCardProps {
    data: FtePerProjectRow[];
    filter: ClientFilter;
    setFilter: (filter: ClientFilter) => void;
    clientOptions: SelectOption[];
    totals: FtePerProjectTotals;
    isLoading: boolean;
}

export interface BudgetAnalysisCardProps {
    data: BudgetAnalysisRow[];
    filter: ClientFilter;
    setFilter: (filter: ClientFilter) => void;
    clientOptions: SelectOption[];
    totals: BudgetAnalysisTotals;
    isLoading: boolean;
}

export interface TemporalBudgetAnalysisCardProps {
    data: TemporalBudgetAnalysisRow[];
    filter: ClientDateRangeFilter;
    setFilter: (filter: ClientDateRangeFilter) => void;
    clientOptions: SelectOption[];
    totals: BudgetAnalysisTotals;
    isLoading: boolean;
}

export interface AverageDailyRateCardProps {
    data: AverageDailyRateRow[];
    filter: ClientDateRangeFilter;
    setFilter: (filter: ClientDateRangeFilter) => void;
    clientOptions: SelectOption[];
    totals: AverageDailyRateTotals;
    isLoading: boolean;
}

export interface UnderutilizedResourcesCardProps {
    data: UnderutilizedResourceRow[];
    month: string;
    setMonth: (month: string) => void;
    isLoading: boolean;
}

export interface MonthlyClientCostCardProps {
    data: ClientCostEntry[];
    navigate: NavigateFn;
    isLoading: boolean;
}

export interface EffortByFunctionCardProps {
    data: EffortRow[];
    total: number;
    isLoading: boolean;
}

export interface EffortByIndustryCardProps {
    data: EffortRow[];
    total: number;
    isLoading: boolean;
}

export interface LocationAnalysisCardProps {
    data: LocationAnalysisRow[];
    isLoading: boolean;
}

export interface SaturationTrendCardProps {
    trendResource: string;
    setTrendResource: (value: string) => void;
    resourceOptions: SelectOption[];
    data: SaturationTrendPoint[];
}

export interface CostForecastCardProps {
    data: CostForecastPoint[];
}

export interface AllocationMatrixCardProps {
    data: AllocationMatrixData;
    isLoading: boolean;
}

export interface RevenueByIndustryCardProps {
    data: NamedValueRow[];
    isLoading: boolean;
}

export interface BenchByFunctionCardProps {
    data: NamedValueRow[];
    isLoading: boolean;
}

export interface BenchByIndustryCardProps {
    data: NamedValueRow[];
    isLoading: boolean;
}

export interface WbsSaturationCardProps {
    data: WbsSaturationRow[];
    isLoading: boolean;
}

export interface ContractExpirationsCardProps {
    data: ContractExpirationRow[];
    isLoading: boolean;
}

export interface RevenueMixCardProps {
    data: RevenueMixPoint[];
    isLoading: boolean;
}

export interface BillingPipelineCardProps {
    data: BillingPipelinePoint[];
    isLoading: boolean;
}

export interface TopMarginProjectsCardProps {
    data: TopMarginProjectRow[];
    isLoading: boolean;
}
