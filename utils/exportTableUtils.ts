/**
 * @file exportTableUtils.ts
 * @description Utility per generare output clipboard-friendly (TSV + HTML table).
 */

import { ExportableCell, ExportableData, ExportableInput, ExportablePrimitive } from '../types';

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

const toExportablePrimitive = (value: unknown): ExportablePrimitive => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'symbol') return value.toString();
  if (typeof value === 'function') return '[Function]';
  return JSON.stringify(value);
};

const toExportableCell = (value: unknown): ExportableCell => {
  if (Array.isArray(value)) {
    return value.map((item) => toExportablePrimitive(item));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return toExportablePrimitive(value);
};

export const normalizeExportData = (data: ExportableInput[]): ExportableData[] =>
  data.map((row) => {
    const normalized: ExportableData = {};
    Object.entries(row as Record<string, unknown>).forEach(([key, value]) => {
      normalized[key] = toExportableCell(value);
    });
    return normalized;
  });

export const getExportColumns = (data: ExportableInput[]): string[] => {
  const normalized = normalizeExportData(data);
  const columns: string[] = [];
  const seen = new Set<string>();

  normalized.forEach((row) => {
    Object.keys(row).forEach((key) => {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    });
  });

  return columns;
};

export const buildTsv = (data: ExportableInput[]): string => {
  if (data.length === 0) return '';
  const normalized = normalizeExportData(data);
  const columns = getExportColumns(data);
  const header = columns.join('\t');
  const rows = normalized.map((row) =>
    columns
      .map((column) => normalizeText(formatCell(row[column])))
      .join('\t')
  );
  return [header, ...rows].join('\n');
};

export const buildHtmlTable = (data: ExportableInput[], options: ExportTableOptions = {}): string => {
  const normalized = normalizeExportData(data);
  const columns = getExportColumns(data);
  const title = options.title ? escapeHtml(options.title) : undefined;
  const tableStyle = 'border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;';
  const headerCellStyle = 'border:1px solid #D0D5DD;background:#F9FAFB;padding:6px 8px;text-align:left;font-weight:600;';
  const cellStyle = 'border:1px solid #D0D5DD;padding:6px 8px;text-align:left;vertical-align:top;';

  const headerRow = columns
    .map((column) => `<th style="${headerCellStyle}">${escapeHtml(column)}</th>`)
    .join('');

  const bodyRows = normalized
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
