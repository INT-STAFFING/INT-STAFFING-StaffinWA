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
  // Colori letterali della palette Intellera (teal/lilac/ruby), usati sia dai grafici
  // D3 in pagina sia dalle immagini generate da quickchart.io per l'export PDF: questi
  // ultimi vengono renderizzati da un servizio esterno che non ha accesso alle CSS var.
  chart: {
    primary: '#06414a',   // teal-900
    secondary: '#0a5560', // teal-700
    tertiary: '#9f95be',  // lilac
    threshold: '#9f3c59', // ruby (soglia critica)
    fixed: '#9f95be',     // lilac per "Fixed Price"
    tm: '#0a5560',        // teal-700 per "Time & Material"
  },
};

export const getAvgAllocationColor = (avg: number): string => {
    if (avg > 100) return DASHBOARD_COLORS.utilization.over;
    if (avg > 95) return DASHBOARD_COLORS.utilization.high;
    if (avg > 0) return DASHBOARD_COLORS.utilization.normal;
    return DASHBOARD_COLORS.utilization.zero;
};
