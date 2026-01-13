/**
 * @file exportTableUtils.ts
 * @description Utility per generare output clipboard-friendly (TSV + HTML table).
 */

import { ExportableCell, ExportableData } from '../types';

interface ExportTableOptions {
  title?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const normalizeText = (value: string): string =>
  value.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');

const formatCell = (value: ExportableCell): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => formatCell(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const getExportColumns = (data: ExportableData[]): string[] => {
  const columns: string[] = [];
  const seen = new Set<string>();

  data.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });

  return columns;
};

export const buildTsv = (data: ExportableData[]): string => {
  if (data.length === 0) return '';
  const columns = getExportColumns(data);
  const header = columns.join('\t');
  const rows = data.map((row) =>
    columns
      .map((column) => normalizeText(formatCell(row[column])))
      .join('\t')
  );
  return [header, ...rows].join('\n');
};

export const buildHtmlTable = (data: ExportableData[], options: ExportTableOptions = {}): string => {
  const columns = getExportColumns(data);
  const title = options.title ? escapeHtml(options.title) : undefined;
  const tableStyle = 'border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;';
  const headerCellStyle = 'border:1px solid #D0D5DD;background:#F9FAFB;padding:6px 8px;text-align:left;font-weight:600;';
  const cellStyle = 'border:1px solid #D0D5DD;padding:6px 8px;text-align:left;vertical-align:top;';

  const headerRow = columns
    .map((column) => `<th style="${headerCellStyle}">${escapeHtml(column)}</th>`)
    .join('');

  const bodyRows = data
    .map((row) => {
      const cells = columns
        .map((column) => `<td style="${cellStyle}">${escapeHtml(formatCell(row[column]))}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const caption = title ? `<caption style="caption-side:top;text-align:left;font-weight:600;padding:4px 0 8px;">${title}</caption>` : '';

  if (columns.length === 0) {
    return `
      <table style="${tableStyle}">
        ${caption}
        <tbody>
          <tr>
            <td style="${cellStyle}">No data</td>
          </tr>
        </tbody>
      </table>
    `.trim();
  }

  return `
    <table style="${tableStyle}">
      ${caption}
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `.trim();
};
