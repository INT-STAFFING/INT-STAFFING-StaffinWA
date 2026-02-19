/**
 * @file pdfExportUtils.ts
 * @description Utilità per l'esportazione in PDF con grafici QuickChart.io e tabelle tramite jsPDF + jspdf-autotable.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Tipi Pubblici ---

export interface ChartConfig {
  /** Titolo del grafico (visualizzato nel PDF) */
  title: string;
  /** Configurazione Chart.js (compatibile con QuickChart.io API) */
  chartJs: {
    type: string;
    data: {
      labels?: (string | number)[];
      datasets: Array<{
        label?: string;
        data: (number | null | undefined)[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
        borderWidth?: number;
        [key: string]: unknown;
      }>;
    };
    options?: Record<string, unknown>;
  };
}

export interface TableConfig {
  /** Titolo della tabella (visualizzato nel PDF) */
  title: string;
  /** Intestazioni colonne (array di array per supportare più livelli) */
  head: string[][];
  /** Dati tabella */
  body: (string | number)[][];
}

export interface PdfExportConfig {
  /** Titolo principale del documento */
  title: string;
  /** Sottotitolo opzionale */
  subtitle?: string;
  /** Sezione grafici */
  charts: ChartConfig[];
  /** Sezione tabelle */
  tables: TableConfig[];
}

// --- Palette colori ---

/** Colori MD3-inspired per i grafici */
export const CHART_COLORS = {
  primary: '#6750A4',
  secondary: '#625B71',
  tertiary: '#7D5260',
  error: '#B3261E',
  blue: '#1565C0',
  green: '#2E7D32',
  orange: '#E65100',
  teal: '#00695C',
  amber: '#F57F17',
  purple: '#4A148C',
  indigo: '#283593',
  pink: '#880E4F',
};

export const CHART_PALETTE = [
  '#6750A4',
  '#1565C0',
  '#2E7D32',
  '#E65100',
  '#00695C',
  '#F57F17',
  '#4A148C',
  '#880E4F',
  '#283593',
  '#B3261E',
  '#625B71',
  '#7D5260',
];

export const CHART_PALETTE_ALPHA = CHART_PALETTE.map((c) => c + 'CC');

// --- Funzioni interne ---

/**
 * Recupera un'immagine PNG del grafico tramite QuickChart.io e la converte in base64.
 */
async function fetchChartImageBase64(
  chartConfig: ChartConfig['chartJs'],
  width = 800,
  height = 400
): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(JSON.stringify(chartConfig));
    const url = `https://quickchart.io/chart?c=${encoded}&w=${width}&h=${height}&format=png&bkg=white`;
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Aggiunge l'intestazione del documento (titolo, sottotitolo, data).
 */
function addDocHeader(
  doc: jsPDF,
  title: string,
  subtitle: string | undefined,
  pageWidth: number,
  margin: number
): number {
  let y = margin;

  // Sfondo header
  doc.setFillColor(103, 80, 164); // primary color
  doc.rect(0, 0, pageWidth, 22, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, margin, 14);

  // Data in alto a destra
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Generato il ${new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
    pageWidth - margin,
    14,
    { align: 'right' }
  );

  y = 26;

  if (subtitle) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text(subtitle, margin, y);
    y += 6;
  }

  doc.setTextColor(0, 0, 0);
  return y;
}

/**
 * Aggiunge i numeri di pagina in calce.
 */
function addPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Pagina ${i} di ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    doc.setTextColor(0, 0, 0);
  }
}

// --- Funzione principale pubblica ---

/**
 * Genera ed esegue il download di un PDF con grafici (QuickChart.io) e tabelle.
 * @param config Configurazione del documento PDF
 */
export async function generatePdf(config: PdfExportConfig): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  let y = addDocHeader(doc, config.title, config.subtitle, pageWidth, margin);

  // ---- SEZIONE GRAFICI ----
  if (config.charts.length > 0) {
    // Titolo sezione
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(103, 80, 164);
    doc.text('Grafici', margin, y + 2);
    doc.setTextColor(0, 0, 0);
    y += 8;

    // Separatore
    doc.setDrawColor(200, 190, 220);
    doc.line(margin, y - 1, pageWidth - margin, y - 1);
    y += 3;

    const chartsPerRow = Math.min(config.charts.length, 2);
    const chartW = (pageWidth - margin * 2 - (chartsPerRow - 1) * 8) / chartsPerRow;
    const chartH = 72;

    // Fetch tutte le immagini in parallelo
    const imageResults = await Promise.all(
      config.charts.map((c) => fetchChartImageBase64(c.chartJs))
    );

    let rowStartY = y;
    for (let i = 0; i < config.charts.length; i++) {
      const col = i % chartsPerRow;
      const chartX = margin + col * (chartW + 8);

      // Nuova riga
      if (i > 0 && col === 0) {
        rowStartY += chartH + 14;
      }

      // Controlla overflow pagina
      if (rowStartY + chartH + 6 > pageHeight - 10) {
        doc.addPage();
        rowStartY = margin + 4;
        y = rowStartY;
        addDocHeader(doc, config.title, undefined, pageWidth, margin);
      }

      // Sfondo card
      doc.setFillColor(248, 246, 255);
      doc.setDrawColor(220, 210, 240);
      doc.roundedRect(chartX - 2, rowStartY - 2, chartW + 4, chartH + 6, 2, 2, 'FD');

      // Titolo grafico
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(60, 40, 100);
      doc.text(config.charts[i].title, chartX + 1, rowStartY + 5);
      doc.setTextColor(0, 0, 0);

      const imgData = imageResults[i];
      if (imgData) {
        doc.addImage(imgData, 'PNG', chartX, rowStartY + 7, chartW, chartH - 10);
      } else {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(180, 180, 180);
        doc.text('Grafico non disponibile', chartX + chartW / 2, rowStartY + chartH / 2, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
    }

    y = rowStartY + chartH + 14;
  }

  // ---- SEZIONE TABELLE ----
  if (config.tables.length > 0) {
    if (y + 30 > pageHeight - 10) {
      doc.addPage();
      y = margin + 4;
      addDocHeader(doc, config.title, undefined, pageWidth, margin);
      y += 10;
    }

    for (const table of config.tables) {
      if (y + 30 > pageHeight - 10) {
        doc.addPage();
        y = margin + 4;
        addDocHeader(doc, config.title, undefined, pageWidth, margin);
        y += 10;
      }

      // Titolo tabella
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(103, 80, 164);
      doc.text(table.title, margin, y);
      doc.setTextColor(0, 0, 0);
      y += 4;

      autoTable(doc, {
        head: table.head,
        body: table.body,
        startY: y,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 8,
          cellPadding: { top: 2, right: 4, bottom: 2, left: 4 },
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [103, 80, 164],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [248, 246, 255],
        },
        tableLineColor: [220, 210, 240],
        tableLineWidth: 0.2,
      });

      const lastAutoTable = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable;
      y = lastAutoTable.finalY + 12;
    }
  }

  addPageNumbers(doc);

  const safeName = config.title.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, '_').replace(/_+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`${safeName}_${dateStr}.pdf`);
}
