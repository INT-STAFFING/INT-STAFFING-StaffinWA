/**
 * @file utils/exportTableUtils.test.ts
 * @description Test unitari per le funzioni di generazione TSV e HTML da dati esportabili.
 */
import { describe, it, expect } from 'vitest';
import {
    normalizeExportData,
    getExportColumns,
    buildTsv,
    buildHtmlTable,
} from './exportTableUtils';

const simpleData = [
    { nome: 'Mario', eta: 30, attivo: true },
    { nome: 'Anna',  eta: 25, attivo: false },
];

// ---------------------------------------------------------------------------
// normalizeExportData
// ---------------------------------------------------------------------------
describe('normalizeExportData', () => {
    it('converte valori primitivi invariati', () => {
        const result = normalizeExportData([{ a: 'ciao', b: 42, c: true }]);
        expect(result[0].a).toBe('ciao');
        expect(result[0].b).toBe(42);
        expect(result[0].c).toBe(true);
    });

    it('converte null e undefined in stringa vuota', () => {
        const result = normalizeExportData([{ a: null, b: undefined }]);
        expect(result[0].a).toBe('');
        expect(result[0].b).toBe('');
    });

    it('converte un array di primitivi in array', () => {
        const result = normalizeExportData([{ tags: ['a', 'b'] }]);
        expect(Array.isArray(result[0].tags)).toBe(true);
    });

    it('converte un oggetto annidato in JSON string', () => {
        const result = normalizeExportData([{ meta: { x: 1 } }]);
        expect(typeof result[0].meta).toBe('string');
        expect(result[0].meta).toContain('"x"');
    });

    it('converte una Date in oggetto Date', () => {
        const d = new Date(Date.UTC(2024, 0, 1));
        const result = normalizeExportData([{ data: d }]);
        expect(result[0].data).toBeInstanceOf(Date);
    });
});

// ---------------------------------------------------------------------------
// getExportColumns
// ---------------------------------------------------------------------------
describe('getExportColumns', () => {
    it('restituisce le colonne nell\'ordine di prima comparsa', () => {
        const cols = getExportColumns(simpleData);
        expect(cols).toEqual(['nome', 'eta', 'attivo']);
    });

    it('deduplica le colonne se presenti in più righe', () => {
        const data = [{ a: 1, b: 2 }, { b: 3, a: 4 }];
        const cols = getExportColumns(data);
        expect(cols).toHaveLength(2);
        expect(cols).toContain('a');
        expect(cols).toContain('b');
    });

    it('restituisce array vuoto per dati vuoti', () => {
        expect(getExportColumns([])).toEqual([]);
    });

    it('unisce colonne eterogenee da righe diverse', () => {
        const data = [{ a: 1 }, { b: 2 }] as any[];
        const cols = getExportColumns(data);
        expect(cols).toContain('a');
        expect(cols).toContain('b');
    });
});

// ---------------------------------------------------------------------------
// buildTsv
// ---------------------------------------------------------------------------
describe('buildTsv', () => {
    it('restituisce stringa vuota per array vuoto', () => {
        expect(buildTsv([])).toBe('');
    });

    it('la prima riga è l\'header separato da tab', () => {
        const tsv = buildTsv(simpleData);
        const lines = tsv.split('\n');
        expect(lines[0]).toBe('nome\teta\tattivo');
    });

    it('ogni riga dati è separata da tab', () => {
        const tsv = buildTsv(simpleData);
        const lines = tsv.split('\n');
        expect(lines[1]).toBe('Mario\t30\ttrue');
        expect(lines[2]).toBe('Anna\t25\tfalse');
    });

    it('sostituisce le tabulazioni nei valori con spazi', () => {
        const tsv = buildTsv([{ desc: 'colonna\tcon\ttab' }]);
        const lines = tsv.split('\n');
        expect(lines[1]).toBe('colonna con tab');
    });

    it('sostituisce i newline nei valori con spazi', () => {
        const tsv = buildTsv([{ desc: 'riga1\nriga2' }]);
        const lines = tsv.split('\n');
        expect(lines[1]).toBe('riga1 riga2');
    });

    it('formatta un array come valori separati da virgola', () => {
        const tsv = buildTsv([{ tags: ['a', 'b', 'c'] }]);
        const lines = tsv.split('\n');
        expect(lines[1]).toBe('a, b, c');
    });

    it('formatta una Date come ISO string', () => {
        const d = new Date(Date.UTC(2024, 0, 1));
        const tsv = buildTsv([{ data: d }]);
        const lines = tsv.split('\n');
        expect(lines[1]).toContain('2024-01-01');
    });
});

// ---------------------------------------------------------------------------
// buildHtmlTable
// ---------------------------------------------------------------------------
describe('buildHtmlTable', () => {
    it('genera una tabella HTML con tag table, thead, tbody', () => {
        const html = buildHtmlTable(simpleData);
        expect(html).toContain('<table');
        expect(html).toContain('<thead>');
        expect(html).toContain('<tbody>');
    });

    it('genera header con i nomi delle colonne', () => {
        const html = buildHtmlTable(simpleData);
        expect(html).toContain('<th');
        expect(html).toContain('nome');
        expect(html).toContain('eta');
    });

    it('include i valori delle righe', () => {
        const html = buildHtmlTable(simpleData);
        expect(html).toContain('Mario');
        expect(html).toContain('Anna');
    });

    it('include una caption quando viene passato title', () => {
        const html = buildHtmlTable(simpleData, { title: 'Tabella Risorse' });
        expect(html).toContain('<caption');
        expect(html).toContain('Tabella Risorse');
    });

    it('non include caption se title non è fornito', () => {
        const html = buildHtmlTable(simpleData);
        expect(html).not.toContain('<caption');
    });

    it('esegue l\'escape dei caratteri HTML pericolosi', () => {
        const html = buildHtmlTable([{ nome: '<script>alert("xss")</script>' }]);
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });

    it('esegue l\'escape delle virgolette nel titolo', () => {
        const html = buildHtmlTable(simpleData, { title: 'Titolo "con virgolette"' });
        expect(html).toContain('&quot;');
        expect(html).not.toContain('"con virgolette"');
    });

    it('genera una tabella vuota (No data) per array vuoto', () => {
        const html = buildHtmlTable([]);
        expect(html).toContain('No data');
    });
});
