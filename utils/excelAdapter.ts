/**
 * @file utils/excelAdapter.ts
 * @description Adapter che espone il sottoinsieme di API SheetJS usato dall'app
 * (`read`, `writeFile`, `utils.{book_new,json_to_sheet,aoa_to_sheet,book_append_sheet,sheet_to_json}`)
 * implementandolo su ExcelJS (mantenuto, senza le vulnerabilita di `xlsx`).
 *
 * Obiettivo: comportamento identico ai call-site esistenti senza riscriverli.
 * Differenze rispetto a xlsx, tutte irrilevanti per l'app:
 * - le colonne con header vuoto in lettura vengono ignorate (xlsx le chiamava `__EMPTY`);
 * - `read`/`writeFile` sono asincrone (i call-site sono gia in funzioni async).
 */

import ExcelJS from 'exceljs';

/** Larghezza colonna espressa in caratteri (compatibile con l'API SheetJS `ws['!cols']`). */
interface ColInfo {
    wch?: number;
}

/**
 * Stile da applicare al foglio:
 * - `table`  (default): header brand, zebratura, bordi, filtro e riga header bloccata;
 * - `title`: foglio testuale (es. Istruzioni) con solo il titolo evidenziato;
 * - `none`:  nessuno stile, solo larghezze colonna.
 */
type SheetStyle = 'table' | 'title' | 'none';

/** Descrittore di foglio prodotto da json_to_sheet/aoa_to_sheet, materializzato in book_append_sheet. */
type SheetDescriptor =
    | { _kind: 'json'; headers: string[]; rows: Record<string, unknown>[]; '!cols'?: ColInfo[]; '!style'?: SheetStyle }
    | { _kind: 'aoa'; aoa: unknown[][]; '!cols'?: ColInfo[]; '!style'?: SheetStyle };

/** Workbook in lettura, espone i fogli per nome come faceva xlsx (`workbook.Sheets[name]`). */
interface ReadWorkbook {
    Sheets: Record<string, ExcelJS.Worksheet>;
}

/** Calcola l'unione ordinata delle chiavi (ordine di prima apparizione), come json_to_sheet di xlsx. */
const collectHeaders = (rows: Record<string, unknown>[]): string[] => {
    const seen = new Set<string>();
    const headers: string[] = [];
    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (!seen.has(key)) {
                seen.add(key);
                headers.push(key);
            }
        }
    }
    return headers;
};

/** Normalizza un valore in uscita: `undefined` -> cella vuota (null). */
const toCellValue = (v: unknown): ExcelJS.CellValue => {
    if (v === undefined) return null;
    return v as ExcelJS.CellValue;
};

/** Estrae il valore di una cella ExcelJS appiattendo formule/hyperlink/richText. */
const fromCellValue = (raw: ExcelJS.CellValue): unknown => {
    if (raw === null || raw === undefined) return undefined;
    if (raw instanceof Date) return raw;
    if (typeof raw === 'object') {
        const obj = raw as unknown as Record<string, unknown>;
        if ('text' in obj) return obj.text;            // hyperlink { text, hyperlink }
        if ('result' in obj) return obj.result;        // formula { formula, result }
        if ('richText' in obj && Array.isArray(obj.richText)) {
            return (obj.richText as { text: string }[]).map(t => t.text).join('');
        }
        if ('error' in obj) return undefined;          // cella in errore
        return raw;
    }
    return raw;
};

// --- Stile "Brand" (palette dell'app: primario #006493 su testo bianco) -------------------

const BRAND_ARGB = 'FF006493';        // header
const HEADER_TEXT_ARGB = 'FFFFFFFF';  // testo header
const ZEBRA_ARGB = 'FFF2F6F9';        // righe alternate
const BORDER_ARGB = 'FFD9E0E6';       // bordi sottili
const TITLE_TEXT_ARGB = 'FF006493';   // titolo fogli testuali
const INT_FORMAT = '#,##0';           // interi: separatore migliaia, nessun decimale
const DEC_FORMAT = '#,##0.###';       // decimali: separatore migliaia + fino a 3 decimali
const DATE_FORMAT = 'yyyy-mm-dd';     // date in formato AAAA-MM-GG

const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: BORDER_ARGB } },
    left: { style: 'thin', color: { argb: BORDER_ARGB } },
    bottom: { style: 'thin', color: { argb: BORDER_ARGB } },
    right: { style: 'thin', color: { argb: BORDER_ARGB } },
};

/** Lunghezza testuale di una cella, usata per il calcolo automatico delle larghezze. */
const cellTextLength = (value: ExcelJS.CellValue): number => {
    if (value === null || value === undefined) return 0;
    if (value instanceof Date) return 10;                       // yyyy-mm-dd
    if (typeof value === 'object') {
        const obj = value as unknown as Record<string, unknown>;
        return String(obj.text ?? obj.result ?? '').length;
    }
    return String(value).length;
};

/** Imposta le larghezze colonna: usa gli hint `!cols` se presenti, altrimenti si adatta al contenuto. */
const applyColumnWidths = (ws: ExcelJS.Worksheet, colCount: number, hints?: ColInfo[]): void => {
    for (let c = 1; c <= colCount; c++) {
        const hint = hints?.[c - 1]?.wch;
        if (typeof hint === 'number') {
            ws.getColumn(c).width = hint;
            continue;
        }
        let max = 10;
        ws.getColumn(c).eachCell({ includeEmpty: false }, cell => {
            max = Math.max(max, cellTextLength(cell.value) + 2);
        });
        ws.getColumn(c).width = Math.min(max, 60);
    }
};

/** Applica lo stile tabellare "Brand": header colorato, zebratura, bordi, filtro e header bloccato. */
const styleTableSheet = (ws: ExcelJS.Worksheet, colCount: number): void => {
    if (colCount === 0 || ws.rowCount === 0) return;

    const header = ws.getRow(1);
    header.height = 20;
    for (let c = 1; c <= colCount; c++) {
        const cell = header.getCell(c);
        cell.font = { bold: true, color: { argb: HEADER_TEXT_ARGB } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_ARGB } };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = thinBorder;
    }

    for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const zebra = r % 2 === 0;
        for (let c = 1; c <= colCount; c++) {
            const cell = row.getCell(c);
            cell.border = thinBorder;
            if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA_ARGB } };
            const v = cell.value;
            if (typeof v === 'number') {
                // Formato in base al valore: gli interi non mostrano il separatore decimale
                // (evita artefatti tipo "99," in locale italiano).
                cell.numFmt = Number.isInteger(v) ? INT_FORMAT : DEC_FORMAT;
                cell.alignment = { horizontal: 'right' };
            } else if (v instanceof Date) {
                cell.numFmt = DATE_FORMAT;
                cell.alignment = { horizontal: 'right' };
            }
        }
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = `A1:${ws.getColumn(colCount).letter}1`;
};

/** Evidenzia solo la prima riga come titolo (fogli testuali, es. Istruzioni). */
const styleTitleSheet = (ws: ExcelJS.Worksheet): void => {
    if (ws.rowCount === 0) return;
    ws.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: TITLE_TEXT_ARGB } };
};

const book_new = (): ExcelJS.Workbook => new ExcelJS.Workbook();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const json_to_sheet = (rows: any[]): SheetDescriptor => {
    const records = rows as Record<string, unknown>[];
    return { _kind: 'json', headers: collectHeaders(records), rows: records };
};

const aoa_to_sheet = (aoa: unknown[][]): SheetDescriptor => ({ _kind: 'aoa', aoa });

const book_append_sheet = (wb: ExcelJS.Workbook, sheet: SheetDescriptor, name: string): void => {
    const ws = wb.addWorksheet(name);

    let colCount = 0;
    let hasHeader = false;
    if (sheet._kind === 'json') {
        const { headers, rows } = sheet;
        if (headers.length > 0) {
            ws.addRow(headers);
            hasHeader = true;
        }
        for (const row of rows) {
            ws.addRow(headers.map(h => toCellValue(row[h])));
        }
        colCount = headers.length;
    } else {
        for (const r of sheet.aoa) {
            ws.addRow(r.map(toCellValue));
        }
        colCount = sheet.aoa.reduce((max, r) => Math.max(max, r.length), 0);
        hasHeader = sheet.aoa.length > 0;
    }

    const style = sheet['!style'] ?? 'table';
    if (style === 'table' && hasHeader) {
        styleTableSheet(ws, colCount);
    } else if (style === 'title') {
        styleTitleSheet(ws);
    }
    applyColumnWidths(ws, colCount, sheet['!cols']);
};

/**
 * Converte un foglio in array di oggetti usando la prima riga come header,
 * replicando il comportamento di default di `XLSX.utils.sheet_to_json`.
 * Tollerante: foglio assente o `{}` -> `[]`.
 */
const sheet_to_json = <T = Record<string, unknown>>(ws: ExcelJS.Worksheet | Record<string, never> | undefined): T[] => {
    if (!ws || typeof (ws as ExcelJS.Worksheet).getRow !== 'function') return [];
    const sheet = ws as ExcelJS.Worksheet;

    const headerRow = sheet.getRow(1);
    const headers: Record<number, string> = {};
    headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
        const h = fromCellValue(cell.value);
        if (h !== undefined && h !== null && String(h) !== '') headers[col] = String(h);
    });

    const out: T[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const obj: Record<string, unknown> = {};
        let hasData = false;
        row.eachCell({ includeEmpty: false }, (cell, col) => {
            const key = headers[col];
            if (!key) return;
            const val = fromCellValue(cell.value);
            if (val !== undefined) {
                obj[key] = val;
                hasData = true;
            }
        });
        if (hasData) out.push(obj as T);
    }
    return out;
};

export const utils = { book_new, json_to_sheet, aoa_to_sheet, book_append_sheet, sheet_to_json };

/** Carica un workbook da ArrayBuffer/Uint8Array ed espone i fogli per nome (come xlsx). */
export const read = async (
    data: ArrayBuffer | Uint8Array,
    _opts?: { type?: string; cellDates?: boolean },
): Promise<ReadWorkbook> => {
    const wb = new ExcelJS.Workbook();
    const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const Sheets: Record<string, ExcelJS.Worksheet> = {};
    wb.eachSheet(ws => { Sheets[ws.name] = ws; });
    return { Sheets };
};

/** Serializza il workbook e ne avvia il download nel browser (come `XLSX.writeFile`). */
export const writeFile = async (wb: ExcelJS.Workbook, filename: string): Promise<void> => {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
