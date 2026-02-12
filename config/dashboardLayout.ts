/**
 * @file config/dashboardLayout.ts
 * @description Shared configuration for the dashboard layout.
 */

// A stable identifier for each card or card group on the dashboard.
export type DashboardCardId =
  | 'kpiHeader'
  | 'attentionCards'
  | 'unallocatedFte'
  | 'averageAllocation'
  | 'ftePerProject'
  | 'budgetAnalysis'
  | 'temporalBudgetAnalysis'
  | 'underutilizedResources'
  | 'monthlyClientCost'
  | 'effortByFunction'
  | 'effortByIndustry'
  | 'locationAnalysis'
  | 'saturationTrend'
  | 'costForecast'
  | 'averageDailyRate'
  | 'leavesOverview'
  | 'allocationMatrix'
  | 'revenueByIndustry'
  | 'benchByFunction'
  | 'benchByIndustry'
  | 'wbsSaturation'
  | 'noWbsLeakage'
  | 'contractExpirations'
  | 'revenueMix'
  | 'billingPipeline'
  | 'topMarginProjects';

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
  { id: 'unallocatedFte', label: 'FTE Non Allocati', description: 'Mostra gli FTE non allocati sul totale disponibile per il mese corrente.', icon: 'person_search', group: 'kpi' },
  { id: 'noWbsLeakage', label: 'Leakage "No WBS"', description: 'Costo stimato delle allocazioni su progetti non coperti da contratto (Mese Corrente).', icon: 'money_off', group: 'kpi' },
  { id: 'leavesOverview', label: 'Panoramica Assenze', description: 'Mostra assenze odierne, prossime e richieste in attesa.', icon: 'event_busy', group: 'kpi' },
  { id: 'averageAllocation', label: 'Allocazione Media Risorse', description: 'Analizza il carico di lavoro medio per risorsa nel tempo.', icon: '📊', group: 'main' },
  { id: 'ftePerProject', label: 'FTE per Progetto', description: 'Calcola l\'equivalente a tempo pieno delle risorse per progetto.', icon: '👥', group: 'main' },
  { id: 'budgetAnalysis', label: 'Analisi Budget', description: 'Confronta budget, costi stimati totali e varianza per progetto.', icon: '💰', group: 'main' },
  { id: 'temporalBudgetAnalysis', label: 'Analisi Budget Temporale', description: 'Analizza budget e costi in un intervallo di date personalizzato.', icon: '📅', group: 'main' },
  { id: 'averageDailyRate', label: 'Tariffa Media Giornaliera', description: 'Calcola il costo medio giornaliero effettivo per ogni progetto.', icon: '💶', group: 'main' },
  { id: 'underutilizedResources', label: 'Risorse Sottoutilizzate', description: 'Elenca le risorse con un carico di lavoro inferiore al 100%.', icon: '📉', group: 'main' },
  { id: 'monthlyClientCost', label: 'Costo Mensile per Cliente', description: 'Mostra il costo stimato per cliente nel mese corrente.', icon: '🏢', group: 'main' },
  { id: 'effortByFunction', label: 'Sforzo per Function', description: 'Visualizza i giorni/uomo totali suddivisi per area funzionale delle risorse.', icon: '🛠️', group: 'main' },
  { id: 'effortByIndustry', label: 'Sforzo per Industry', description: 'Visualizza i giorni/uomo totali suddivisi per settore (Industry) delle risorse.', icon: 'factory', group: 'main' },
  { id: 'locationAnalysis', label: 'Analisi per Sede', description: 'Analizza l\'utilizzo e le risorse per ogni sede di lavoro.', icon: '📍', group: 'main' },
  { id: 'allocationMatrix', label: 'Matrice Allocazione (Ind x Func)', description: 'Heatmap che incrocia Industry e Function mostrando gli FTE allocati.', icon: 'grid_on', group: 'full-width' },
  { id: 'revenueByIndustry', label: 'Revenue per Industry', description: 'Fatturato stimato raggruppato per settore di mercato del cliente.', icon: 'pie_chart', group: 'main' },
  { id: 'benchByFunction', label: 'Bench per Function', description: 'Percentuale di capacità non utilizzata suddivisa per Function.', icon: 'person_off', group: 'main' },
  { id: 'benchByIndustry', label: 'Bench per Industry', description: 'Percentuale di capacità non utilizzata suddivisa per Industry.', icon: 'domain_disabled', group: 'main' },
  { id: 'wbsSaturation', label: 'Saturazione WBS (Top Rischi)', description: 'Contratti vicini all\'esaurimento del budget (>80% consumato).', icon: 'battery_alert', group: 'main' },
  { id: 'contractExpirations', label: 'Scadenzario Contratti', description: 'Contratti in scadenza nei prossimi 90 giorni.', icon: 'event_upcoming', group: 'main' },
  { id: 'revenueMix', label: 'Revenue Mix (T&M vs Fixed)', description: 'Confronto mensile tra fatturato Time & Material e Fixed Price.', icon: 'stacked_bar_chart', group: 'main' },
  { id: 'billingPipeline', label: 'Pipeline Fatturazione (Cashflow)', description: 'Previsione fatturato basata sulle milestone pianificate.', icon: 'payments', group: 'main' },
  { id: 'topMarginProjects', label: 'Top Progetti per Margine', description: 'Classifica progetti per redditività assoluta e percentuale.', icon: 'leaderboard', group: 'full-width' },
  { id: 'saturationTrend', label: 'Trend Saturazione Risorsa', description: 'Grafico dell\'andamento del carico per una singola risorsa.', icon: '📈', group: 'full-width' },
  { id: 'costForecast', label: 'Forecast Costo Mensile', description: 'Previsione dei costi totali per i prossimi mesi.', icon: '🔮', group: 'full-width' },
];


// The default order in which cards should appear if no configuration is saved.
export const DEFAULT_DASHBOARD_CARD_ORDER: DashboardCardId[] = [
  'kpiHeader',
  'attentionCards',
  'noWbsLeakage',
  'leavesOverview',
  'revenueMix',
  'billingPipeline',
  'topMarginProjects',
  'unallocatedFte',
  'wbsSaturation',
  'contractExpirations',
  'revenueByIndustry',
  'benchByFunction',
  'averageAllocation',
  'ftePerProject',
  'budgetAnalysis',
  'allocationMatrix',
  'temporalBudgetAnalysis',
  'averageDailyRate',
  'underutilizedResources',
  'monthlyClientCost',
  'effortByFunction',
  'effortByIndustry',
  'benchByIndustry',
  'locationAnalysis',
  'saturationTrend',
  'costForecast',
];

// The key used to save the custom card order in localStorage.
export const DASHBOARD_CARD_ORDER_STORAGE_KEY = 'dashboardCardOrder';
