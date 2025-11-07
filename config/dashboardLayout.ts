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
  | 'temporalBudgetAnalysis'
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
  description: string;
  icon: string;
  // 'group' helps DashboardPage render cards in the correct layout (e.g., top KPIs vs main grid vs full-width).
  group: 'kpi' | 'main' | 'full-width';
}

// A constant array defining all available cards and their properties.
export const DASHBOARD_CARDS_CONFIG: DashboardCardConfig[] = [
  { id: 'kpiHeader', label: 'KPI Principali', description: 'Mostra i totali di budget, costo stimato e giorni allocati.', icon: '🏆', group: 'kpi' },
  { id: 'attentionCards', label: 'Card di Attenzione', description: 'Evidenzia risorse non allocate e progetti senza staff.', icon: '⚠️', group: 'kpi' },
  { id: 'averageAllocation', label: 'Allocazione Media Risorse', description: 'Analizza il carico di lavoro medio per risorsa nel tempo.', icon: '📊', group: 'main' },
  { id: 'ftePerProject', label: 'FTE per Progetto', description: 'Calcola l\'equivalente a tempo pieno delle risorse per progetto.', icon: '👥', group: 'main' },
  { id: 'budgetAnalysis', label: 'Analisi Budget', description: 'Confronta budget, costi stimati totali e varianza per progetto.', icon: '💰', group: 'main' },
  { id: 'temporalBudgetAnalysis', label: 'Analisi Budget Temporale', description: 'Analizza budget e costi in un intervallo di date personalizzato.', icon: '📅', group: 'main' },
  { id: 'underutilizedResources', label: 'Risorse Sottoutilizzate', description: 'Elenca le risorse con un carico di lavoro inferiore al 100%.', icon: '📉', group: 'main' },
  { id: 'monthlyClientCost', label: 'Costo Mensile per Cliente', description: 'Mostra il costo stimato per cliente nel mese corrente.', icon: '🏢', group: 'main' },
  { id: 'effortByHorizontal', label: 'Sforzo per Horizontal', description: 'Visualizza i giorni/uomo totali suddivisi per area di competenza.', icon: '🛠️', group: 'main' },
  { id: 'locationAnalysis', label: 'Analisi per Sede', description: 'Analizza l\'utilizzo e le risorse per ogni sede di lavoro.', icon: '📍', group: 'main' },
  { id: 'saturationTrend', label: 'Trend Saturazione Risorsa', description: 'Grafico dell\'andamento del carico per una singola risorsa.', icon: '📈', group: 'full-width' },
  { id: 'costForecast', label: 'Forecast Costo Mensile', description: 'Previsione dei costi totali per i prossimi mesi.', icon: '🔮', group: 'full-width' },
];


// The default order in which cards should appear if no configuration is saved.
export const DEFAULT_DASHBOARD_CARD_ORDER: DashboardCardId[] = [
  'kpiHeader',
  'attentionCards',
  'averageAllocation',
  'ftePerProject',
  'budgetAnalysis',
  'temporalBudgetAnalysis',
  'underutilizedResources',
  'monthlyClientCost',
  'effortByHorizontal',
  'locationAnalysis',
  'saturationTrend',
  'costForecast',
];

// The key used to save the custom card order in localStorage.
export const DASHBOARD_CARD_ORDER_STORAGE_KEY = 'dashboardCardOrder';