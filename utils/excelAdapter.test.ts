import { describe, it, expect } from 'vitest';
import { utils, read } from './excelAdapter';

/** Serializza un workbook in Uint8Array senza passare dal download DOM (writeFile). */
const toBuffer = async (wb: import('exceljs').Workbook): Promise<Uint8Array> => {
    const buf = await wb.xlsx.writeBuffer();
    return new Uint8Array(buf as ArrayBuffer);
};

describe('excelAdapter', () => {
    it('round-trip json_to_sheet -> writeBuffer -> read -> sheet_to_json', async () => {
        const wb = utils.book_new();
        const rows = [
            { Name: 'Alice', Age: 30 },
            { Name: 'Bob', Age: 25 },
        ];
        utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'People');

        const out = await read(await toBuffer(wb));
        expect(Object.keys(out.Sheets)).toContain('People');
        expect(utils.sheet_to_json(out.Sheets['People'])).toEqual(rows);
    });

    it('preserva i numeri come numeri e le stringhe come stringhe', async () => {
        const wb = utils.book_new();
        const rows = [{ code: 'A1', qty: 12, ratio: 0.5 }];
        utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'S');

        const out = await read(await toBuffer(wb));
        const parsed = utils.sheet_to_json<{ code: string; qty: number; ratio: number }>(out.Sheets['S']);
        expect(parsed[0].code).toBe('A1');
        expect(parsed[0].qty).toBe(12);
        expect(parsed[0].ratio).toBe(0.5);
    });

    it('aoa_to_sheet usa la prima riga come header', async () => {
        const wb = utils.book_new();
        utils.book_append_sheet(wb, utils.aoa_to_sheet([['Col1', 'Col2'], ['x', 'y']]), 'A');

        const out = await read(await toBuffer(wb));
        expect(utils.sheet_to_json(out.Sheets['A'])).toEqual([{ Col1: 'x', Col2: 'y' }]);
    });

    it('unione ordinata delle chiavi su righe con campi diversi', async () => {
        const wb = utils.book_new();
        utils.book_append_sheet(wb, utils.json_to_sheet([{ a: 1 }, { a: 2, b: 3 }]), 'U');

        const out = await read(await toBuffer(wb));
        const parsed = utils.sheet_to_json(out.Sheets['U']);
        expect(parsed).toEqual([{ a: 1 }, { a: 2, b: 3 }]);
    });

    it('foglio assente o vuoto -> array vuoto', () => {
        expect(utils.sheet_to_json(undefined)).toEqual([]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(utils.sheet_to_json({} as any)).toEqual([]);
    });
});
