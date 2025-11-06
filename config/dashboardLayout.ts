/**
 * @file config/dashboardLayout.ts
 * @description Shared configuration for the dashboard layout.
 */

// A stable identifier for each card or card group on the dashboard.
export type DashboardCardId =
  | 'kpiHeader'
  | 'attentionCards'
  | 'averageAllocation'
  | 'ftePerProject'
  | 'budgetAnalysis'
  | 'underutilizedResources'
  | 'monthlyClientCost'
  | 'effortByHorizontal'
  | 'locationAnalysis'
  | 'saturationTrend'
  | 'costForecast';

// Interface defining the metadata for each dashboard card.
export interface DashboardCardConfig {
  id: DashboardCardId;
  label: string;
  // 'group' helps DashboardPage render cards in the correct layout (e.g., top KPIs vs main grid vs full-width).
  group: 'kpi' | 'main' | 'full-width';
}

// A constant array defining all available cards and their properties.
export const DASHBOARD_CARDS_CONFIG: DashboardCardConfig[] = [
  { id: 'kpiHeader', label: 'KPI Header (Budget, Costo, Giorni)', group: 'kpi' },
  { id: 'attentionCards', label: 'Avvisi (Risorse non allocate, Progetti senza staff)', group: 'kpi' },
  { id: 'averageAllocation', label: 'Allocazione Media', group: 'main' },
  { id: 'ftePerProject', label: 'FTE per Progetto', group: 'main' },
  { id: 'budgetAnalysis', label: 'Analisi Budget', group: 'main' },
  { id: 'underutilizedResources', label: 'Risorse Sottoutilizzate', group: 'main' },
  { id: 'monthlyClientCost', label: 'Costo Mensile per Cliente', group: 'main' },
  { id: 'effortByHorizontal', label: 'Sforzo per Horizontal', group: 'main' },
  { id: 'locationAnalysis', label: 'Analisi per Sede', group: 'main' },
  { id: 'saturationTrend', label: 'Trend Saturazione Risorsa', group: 'full-width' },
  { id: 'costForecast', label: 'Forecast Costo Mensile', group: 'full-width' },
];


// The default order in which cards should appear if no configuration is saved.
export const DEFAULT_DASHBOARD_CARD_ORDER: DashboardCardId[] = [
  'kpiHeader',
  'attentionCards',
  'averageAllocation',
  'ftePerProject',
  'budgetAnalysis',
  'underutilizedResources',
  'monthlyClientCost',
  'effortByHorizontal',
  'locationAnalysis',
  'saturationTrend',
  'costForecast',
];

// The key used to save the custom card order in localStorage.
export const DASHBOARD_CARD_ORDER_STORAGE_KEY = 'dashboardCardOrder';
