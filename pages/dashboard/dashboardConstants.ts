/**
 * @file dashboardConstants.ts
 * @description Costanti e helper condivisi dalle card della dashboard.
 */

// --- Colori Centralizzati per la Dashboard ---
export const DASHBOARD_COLORS = {
  attention: {
    background: 'bg-yellow-container',
    hoverBackground: 'hover:bg-yellow-container/80',
    text: 'text-on-yellow-container',
    strongText: 'text-on-yellow-container font-semibold',
    icon: 'text-3xl opacity-50 text-on-yellow-container',
  },
  utilization: {
    over: 'text-error font-bold',
    high: 'text-tertiary font-semibold',
    normal: 'text-secondary',
    zero: 'text-on-surface-variant',
  },
  variance: {
    positive: 'text-tertiary',
    negative: 'text-error',
  },
  link: 'text-primary hover:underline',
  chart: {
    primary: '#006493',
    secondary: '#50606e',
    tertiary: '#64597b',
    threshold: '#ba1a1a',
    fixed: '#e67c73', // Light red for fixed price
    tm: '#5b9bd5',    // Light blue for T&M
  },
};

export const getAvgAllocationColor = (avg: number): string => {
    if (avg > 100) return DASHBOARD_COLORS.utilization.over;
    if (avg > 95) return DASHBOARD_COLORS.utilization.high;
    if (avg > 0) return DASHBOARD_COLORS.utilization.normal;
    return DASHBOARD_COLORS.utilization.zero;
};
