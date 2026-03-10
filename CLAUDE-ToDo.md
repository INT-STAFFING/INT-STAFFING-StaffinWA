# CLAUDE-ToDo.md — Aggiornamento suite di test

**Sessione:** 2026-03-10
**Branch:** `claude/update-tests-UWvrH`

## Piano

- [x] Esplorare i test esistenti e la struttura del codebase
- [x] Identificare le lacune di copertura e pianificare i nuovi test
- [x] Impostare il branch git `claude/update-tests-UWvrH`
- [x] Creare `utils/dateUtils.test.ts` (49 test)
- [x] Creare `utils/costUtils.test.ts` (14 test)
- [x] Creare `utils/formatters.test.ts` (9 test)
- [x] Creare `libs/zod.test.ts` (38 test)
- [x] Eseguire tutti i test e correggere gli errori trovati
- [x] Commit e push su branch feature

## Revisione

### Risultato finale
- **7 file di test** — **119 test** — tutti ✅ passano
- Copertura aumentata da 3 file/9 test a 7 file/119 test

### Nuovi file creati
| File | Test | Area coperta |
|---|---|---|
| `utils/dateUtils.test.ts` | 49 | parseISODate, toISODateString, addDays, getCalendarDays, isHoliday, getWorkingDaysBetween, getLeaveDurationInWorkingDays, formatDate* |
| `utils/costUtils.test.ts` | 14 | getRoleCostForDate (SCD Type 2), calculateSegmentCost |
| `utils/formatters.test.ts` | 9 | formatCurrency (numeri, stringhe, null/undefined/NaN) |
| `libs/zod.test.ts` | 38 | string, number, boolean, enum, object, array, optional, nullable, refine, ZodError.flatten() |

### Bug/problemi riscontrati e corretti
1. **Test formatCurrency con separatore migliaia**: i test verificavano `'1.000'` come output
   di `toLocaleString('it-IT')`, ma jsdom non supporta i separatori migliaia ICU per locale
   non-inglesi. Corretti usando regex flessibili (`/1[.'\s]?000/`).

### Lacune di copertura ancora presenti (priorità futura)
- Contesti React (AppContext, ResourcesContext, ecc.)
- Hooks: `useComputedSkills`, `useExport`, `useGlobalSearch`
- Componenti: DataTable, SearchWidget, Toast, ConfirmationModal
- Servizi: `apiClient.ts`, `mockHandlers.ts`
- Export/PDF: `exportUtils.ts`, `pdfExport.ts`
