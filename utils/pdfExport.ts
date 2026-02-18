/**
 * @file utils/pdfExport.ts
 * @description Utilità per la generazione di URL QuickChart.io e l'esportazione in PDF delle card della dashboard.
 * Fornisce `buildQuickChartUrl` per costruire URL di grafici e `exportCardToPdf` per aprire
 * una finestra di stampa contenente tabella e grafico.
 */
 
const getNestedValue = (obj: any, key: string): any =>
    key.split('.').reduce((o: any, k: string) => (o != null ? o[k] : undefined), obj);
 
const PIE_COLORS = [
    '#006493', '#50606e', '#64597b', '#ba1a1a',
    '#006d2e', '#b97600', '#007580', '#7c4e7e',
    '#8b5000', '#3a6ea5',
];
 
/**
 * Costruisce un URL QuickChart.io per un grafico semplice a serie singola.
 * Supporta tipo bar, line e pie. Le chiavi xKey/yKey supportano la notazione punto
 * per valori nidificati (es. 'resource.name').
 */
export const buildQuickChartUrl = (
    data: any[],
    type: 'bar' | 'line' | 'pie',
    xKey: string,
    yKey: string,
    width = 800,
    height = 400,
): string => {
    if (!data.length) return '';
 
    const labels = data.map(d => String(getNestedValue(d, xKey) ?? ''));
    const values = data.map(d => {
        const v = getNestedValue(d, yKey);
        return typeof v === 'number' ? v : Number(v) || 0;
    });
 
    let chartCfg: object;
 
    if (type === 'pie') {
        chartCfg = {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: PIE_COLORS.slice(0, labels.length),
                }],
            },
            options: { plugins: { legend: { position: 'right' } } },
        };
    } else {
        chartCfg = {
            type,
            data: {
                labels,
                datasets: [{
                    label: yKey,
                    data: values,
                    backgroundColor: type === 'bar' ? 'rgba(0,100,147,0.85)' : 'rgba(0,100,147,0.15)',
                    borderColor: '#006493',
                    borderWidth: type === 'line' ? 2 : 0,
                    borderRadius: type === 'bar' ? 4 : 0,
                    fill: type === 'line',
                    pointRadius: type === 'line' ? 3 : 0,
                }],
            },
            options: {
                scales: { y: { beginAtZero: true } },
                plugins: { legend: { display: false } },
            },
        };
    }
 
    const encoded = encodeURIComponent(JSON.stringify(chartCfg));
    return `https://quickchart.io/chart?c=${encoded}&w=${width}&h=${height}&bkg=white`;
};
 
/**
 * Apre una nuova finestra del browser contenente la tabella dei dati e il grafico
 * (se fornito l'URL QuickChart) e avvia la stampa come PDF.
 */
export const exportCardToPdf = (
    title: string,
    tableData: Record<string, any>[],
    chartUrl?: string,
): void => {
    const headers = tableData.length > 0 ? Object.keys(tableData[0]) : [];
    const tableRows = tableData
        .map(row => `<tr>${headers.map(h => `<td>${row[h] ?? ''}</td>`).join('')}</tr>`)
        .join('');
 
    const now = new Date();
    const dateStr = now.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
 
    const tableHtml = tableData.length > 0
        ? `<table>
    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>`
        : `<p class="no-data">Nessun dato disponibile.</p>`;
 
    const chartHtml = chartUrl
        ? `<div class="chart-container"><img src="${chartUrl}" alt="Grafico" /></div>`
        : '';
 
    const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 24px; font-size: 12px; }
    h1 { font-size: 16px; margin-bottom: 16px; color: #006493; border-bottom: 2px solid #006493; padding-bottom: 8px; }
    .chart-container { margin-bottom: 20px; text-align: center; page-break-inside: avoid; }
    .chart-container img { max-width: 100%; height: auto; border: 1px solid #e8edf2; border-radius: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; }
    th { background: #e8f1f8; padding: 8px 10px; text-align: left; border: 1px solid #c8d8e4; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #006493; }
    td { padding: 6px 10px; border: 1px solid #e8edf2; vertical-align: top; }
    tr:nth-child(even) td { background: #f7fafc; }
    .no-data { color: #888; font-style: italic; }
    .footer { margin-top: 20px; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 8px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${chartHtml}
  ${tableHtml}
  <div class="footer">Esportato il ${dateStr} alle ${timeStr}</div>
  <script>
    (function () {
      var img = document.querySelector('.chart-container img');
      if (img) {
        img.onload = function () { window.print(); };
        img.onerror = function () { window.print(); };
      } else {
        window.onload = function () { window.print(); };
      }
    })();
  </script>
</body>
</html>`;
 
    const w = window.open('', '_blank', 'width=1000,height=750');
    if (w) {
        w.document.write(html);
        w.document.close();
    }
};
