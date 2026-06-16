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

    it('applica lo stile Brand a header, filtro e riga bloccata senza alterare i valori', async () => {
        const wb = utils.book_new();
        const rows = [{ Nome: 'Alice', Costo: 1200, Ratio: 0.5 }, { Nome: 'Bob', Costo: 800, Ratio: 1 }];
        utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Stile');

        const ws = wb.getWorksheet('Stile')!;
        const headerCell = ws.getRow(1).getCell(1);
        expect((headerCell.fill as any).fgColor.argb).toBe('FF006493');
        expect(headerCell.font?.bold).toBe(true);
        expect(headerCell.font?.color?.argb).toBe('FFFFFFFF');
        expect(ws.views?.[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
        expect(ws.autoFilter).toBe('A1:C1');
        expect(ws.getColumn(1).width).toBeGreaterThan(0);
        // Interi senza separatore decimale, decimali con separatore.
        expect(ws.getRow(2).getCell(2).numFmt).toBe('#,##0');
        expect(ws.getRow(2).getCell(3).numFmt).toBe('#,##0.###');

        // I valori restano invariati dopo il round-trip.
        const out = await read(await toBuffer(wb));
        expect(utils.sheet_to_json(out.Sheets['Stile'])).toEqual(rows);
    });

    it('lo stile "title" evidenzia solo la prima riga (fogli testuali)', () => {
        const wb = utils.book_new();
        const sheet = utils.aoa_to_sheet([['Istruzioni'], [], ['- riga']]);
        sheet['!style'] = 'title';
        utils.book_append_sheet(wb, sheet, 'Istruzioni');

        const ws = wb.getWorksheet('Istruzioni')!;
        expect(ws.getRow(1).getCell(1).font?.size).toBe(14);
        expect(ws.autoFilter).toBeFalsy();
    });

    it('foglio assente o vuoto -> array vuoto', () => {
        expect(utils.sheet_to_json(undefined)).toEqual([]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(utils.sheet_to_json({} as any)).toEqual([]);
    });
});
