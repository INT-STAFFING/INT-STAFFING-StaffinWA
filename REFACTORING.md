# REFACTORING.md — File di lavoro refactoring incrementale

> File di tracciamento per il refactoring completo dell'applicativo, mantenendo
> **tutte** le funzionalità attuali. Approccio scelto con l'utente:
> **incrementale ad alto valore**, con verifica (test + typecheck + lint) ad ogni passo.
> Obiettivi richiesti: pulizia tecnica, spezzare file enormi, coerenza & struttura,
> robustezza tipi/test.

## Baseline (2026-06-15) — stato di partenza VERDE
- `npx tsc --noEmit` → **0 errori**
- `npx vitest run` → **380 test passano** (23 file)
- `npx eslint . --ext ts,tsx --max-warnings 0` → **0 warning**

Regola d'oro: dopo OGNI fase, questi tre comandi devono restare verdi prima del commit.

## Mappa dei problemi individuati
| # | Problema | Tipo | Rischio | Fase |
|---|---|---|---|---|
| P1 | Cartella `src/` duplicata e morta (`src/routes.ts`, `src/pages/SkillAnalysisPage.tsx`) — esclusa da tsconfig, nessun import reale | Codice morto | Basso | 1 |
| P2 | 5 coppie di test duplicati e divergenti per lo stesso modulo (dateUtils, costUtils, formatters, zod, apiClient) — due suite parallele | Duplicazione | Medio | 2 |
| P3 | Convenzione posizione test incoerente (co-located vs `__tests__/`) | Coerenza | Basso | 2 |
| P4 | File enormi: DashboardPage 2362, SecurityCenterPage 1822, SimulationPage 1453, api/resources.ts 1052, ProjectsPage 1012 | Manutenibilità | Medio-Alto | 3 |
| P5 | Uso di `any` / type-safety da rivedere nelle parti toccate | Robustezza tipi | Medio | 4 (continuo) |

## Piano a fasi

### Fase 1 — Pulizia codice morto [COMPLETATA]
- [x] Rimuovere cartella `src/` (duplicata, esclusa da compilazione, nessun import reale)
- [x] Aggiornare il riferimento testuale in `pages/UserManualPage.tsx` (citava `src/App.tsx`/`src/routes.ts` inesistenti)
- [x] Verifica: tsc + vitest (380) + eslint verdi
- [x] Commit

### Fase 2 — Consolidamento test duplicati + convenzione [COMPLETATA]
Le 5 coppie NON sono identiche e nessuna è sempre il superset:
- dateUtils: 49 / 49 — confronto cases
- zod: co-located 38 / `__tests__` 45
- costUtils: 14 / 14
- formatters: co-located 9 / `__tests__` 10
- apiClient: co-located 16 / `__tests__` 10
Strategia: per ogni coppia produrre l'**unione** dei casi di test in un singolo file
canonico, eliminando il doppione. Convenzione scelta: test unitari **co-locati**
accanto al sorgente (utils/libs/services/hooks); `components/__tests__/` e
`pages/__tests__/` restano invariati. Conteggio test finale deve essere >= unione
dei casi unici (mai perdita di copertura).
- [x] Merge dateUtils (49+49 = 98 casi, blocchi suite A/B)
- [x] Merge zod (38+45 = 83 casi)
- [x] Merge costUtils (14+14 = 28 casi, fixture rinominate rolesB/historyB)
- [x] Merge formatters (9+10 = 19 casi)
- [x] Merge apiClient (16+10 = 26 casi, setLocationB per evitare collisioni)
- [x] Spostati `utils/auth.test.ts` e `utils/noStubs.test.ts` co-locati (path ROOT aggiornato a `..`)
- [x] Rimosse cartelle `__tests__/` ormai vuote (libs, services, utils)
- [x] Verifica: tsc 0 + vitest 380 (18 file, da 23) + eslint 0 → commit

Risultato: 23 → 18 file di test, 380 test invariati (zero perdita di copertura: l'unione
in un solo file equivale ai due file separati contati prima). `components/__tests__/` e
`pages/__tests__/` lasciati invariati (convenzione UI consolidata).

### Fase 3 — Spezzare file enormi [da fare, valutare scope]
Da affrontare uno alla volta, estraendo componenti/funzioni pure senza cambiare comportamento.

**Priorità 1 — DashboardPage.tsx (2362 righe).** Analisi fatta: contiene ~28
sotto-componenti "card" puramente presentazionali (righe 79–1347) prima del
componente principale `DashboardPage` (1348–2362). Piano:
- Creare `pages/dashboard/dashboardConstants.ts` con `DASHBOARD_COLORS` e
  `getAvgAllocationColor` (helper condivisi).
- Creare `pages/dashboard/DashboardCards.tsx` con tutti i componenti card
  presentazionali (KpiHeaderCards, AttentionCards, ... TopMarginProjectsCard,
  più i locali `PdfExportButton`/`ViewToggleButton`).
- `DashboardPage.tsx` importa da questi moduli; resta solo l'orchestrazione/calcolo.
- Atteso: DashboardPage da 2362 → ~1050 righe. Comportamento invariato.
- ATTENZIONE: `parseISODate` locale (riga 69) è un dato di cache modulare — va
  spostato dove serve o duplicato con cura (non confondere con utils/dateUtils).

**Priorità successive (uno alla volta, stessa logica):**
- [x] DashboardPage.tsx (2362 → 1075) — estratte 28 card in `pages/dashboard/DashboardCards.tsx` (1287) + `dashboardConstants.ts` (41). tsc/vitest/eslint verdi + `vite build` OK. Solo spostamento, zero logica cambiata.
- [x] SecurityCenterPage.tsx (1822 → 87) — estratti i 6 Pillar in `pages/security/` + `securityShared.ts`. Main ridotto a composizione pura. tsc/vitest/eslint + vite build verdi. Solo spostamento.
- [x] api/resources.ts (1052 → 740) — estratte le 4 config statiche (JSONB_FIELDS, ENTITY_VISIBILITY_CONTROLLED, TABLE_MAPPING, VALIDATION_SCHEMAS) in `api/_lib/resourcesConfig.ts`. NOTA: scoperto che `api/` NON è escluso da tsconfig (AI.md era errato) → la verifica tsc+eslint è robusta. Tutti i gate verdi. Solo spostamento.
- [x] SimulationPage.tsx (1453 → 1061) — estratti reducer (`simulationReducer.ts`) e i 2 modali in `pages/simulation/`. tsc/vitest/eslint + vite build verdi. Solo spostamento.
- [x] ProjectsPage.tsx (1012 → 657) — estratti BillingPlanModal e ProjectExpensesModal in `pages/projects/`. tsc/vitest/eslint + vite build verdi. Solo spostamento.

### Fase 4 — Robustezza tipi (continuo) [IN CORSO]
- [x] Tipizzate le props delle 28 card Dashboard: `any` 71 → 16 (residui = idiomi d3 e
  shape di export eterogenee, lasciati di proposito). Nuovo `pages/dashboard/dashboardTypes.ts`
  con interfacce props + righe dati + tipi riusabili (`SelectOption`, `ClientFilter`,
  `ClientDateRangeFilter`, `NavigateFn`), riuso di `Resource`/`Project`/`Contract` da types.ts.
  `ColumnDef<any>` → tipo riga corretto. Risolta una unsoundness latente in ContractExpirationsCard
  (`formatDate(string|null,'short')` → `formatDateFull`, output byte-identico, verificato).
  tsc/vitest/eslint + vite build verdi. Call site del main NON toccati.
- [ ] (Futuro) Ridurre `any` nei pillar Security (catch/cast API) — richiede narrowing, non banale.

## Log avanzamento
- 2026-06-15: creata baseline (tutto verde), analisi iniziale, scritto questo file.
- 2026-06-15: Fase 1 completata (rimossa src/). Commit cb4d7ee.
- 2026-06-15: Fase 2 completata (consolidati 5 test duplicati, coerenza posizione). 380 test invariati.
- 2026-06-15: Fase 3 — DashboardPage.tsx spezzato (2362 → 1075). Verificato anche con vite build.
- 2026-06-15: Fase 3b — SecurityCenterPage.tsx spezzato (1822 → 87), 6 pillar in pages/security/. Build OK.
- 2026-06-15: Fase 4 — tipizzate props card Dashboard (any 71→16), nuovo dashboardTypes.ts. Build OK.
- 2026-06-15: ProjectsPage.tsx spezzato (1012 → 657), 2 modali in pages/projects/. Build OK.
- 2026-06-16: SimulationPage.tsx spezzato (1453 → 1061), reducer + 2 modali in pages/simulation/. Build OK.
- 2026-06-16: api/resources.ts spezzato (1052 → 740), config statiche in api/_lib/resourcesConfig.ts. tsc+eslint+test verdi.
