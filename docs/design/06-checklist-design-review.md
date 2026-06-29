# 06 — Checklist di Design Review (gate pre-sviluppo)

> FASE 4. Documento da **verificare sistematicamente** prima di promuovere ogni
> incremento. Legenda: ✅ fatto · �doing in corso · ⬜ aperto (backlog/ricerca).
> Aggiornare ad ogni iterazione. Una voce ⬜ non blocca, ma deve avere un owner
> e una decisione (fix / ricerca / accettato-con-rischio).

## 1. Fondamenta di progettazione
- [x] ✅ Personas concrete, ancorate a ruoli RBAC reali (doc 01)
- [x] ✅ Anti-personas definite (scope)
- [x] ✅ User stories con criteri di accettazione e stato (doc 02)
- [x] ✅ User journeys con momenti di verità e attriti (doc 03)
- [x] ✅ Wireframe/flussi as-is e to-be per i percorsi critici (doc 04)
- [x] ✅ Audit su 3 assi + 10 domande di stress test (doc 05)
- [x] ✅ Matrice criticità → domanda di ricerca / azione (doc 05 FASE 3)

## 2. Coerenza (Asse 1)
- [x] ✅ R-B2 — **Verificato già risolto**: il Forecasting filtra le assenze `APPROVED`
      e le sottrae dai G/U disponibili (`ForecastingPage.tsx`, `leaveDaysLost`).
- [x] ✅ R-B4 — Forecasting unificato sulle util condivise di `dateUtils`
      (`buildHolidaySet`/`isHolidayInSet`/`getWorkingDaysBetweenWithSet`),
      con **test di equivalenza** vs `isHoliday`/`getWorkingDaysBetween`; corrette
      2 divergenze latenti (festività locale senza sede, normalizzazione date da timestamp).
- [x] ✅ R-C3/R-C4 — Handoff recruiting→staffing: "Crea risorsa da candidato"
      (prefill del form Risorsa) + "Chiudi richiesta collegata" dal colloquio assunto.
- [x] ✅ User stories aggiornate per chiudere i gap di copertura

## 3. Utente & self-service (Asse 2, persona P4)
- [x] ✅ R-D3 — **Empty state distinto** (dataset vuoto vs filtro senza risultati) in `DataTable` + test
- [x] ✅ R-D2 — **Approvatore visibile** + badge stato in italiano nelle richieste di assenza (`LeavePage`)
- [x] ✅ R-F1 — `aria-label` su **tutti i controlli icona-only** dell'app (~26 bottoni in 14 file: navigazione, salva/annulla inline, zoom, import/export, filtri…) + input accessibile in `ConfirmationModal`. I bottoni con testo visibile (anche in ternary) restano correttamente senza `aria-label` (già accessibili).
- [ ] ⬜ F6 — Navigazione adattiva/ordinata per rilevanza per ruolo — decisione di prodotto

## 4. Edge cases (Asse 3) — da coprire con validazione/test
- [ ] ⬜ E-01 Dimissione a metà allocazione futura
- [ ] ⬜ E-02 Assenza approvata sovrapposta ad allocazione
- [ ] ⬜ E-03 `endDate` progetto < allocazioni
- [ ] ⬜ E-04 Riduzione `maxStaffingPercentage` retroattiva
- [x] ✅ E-02 Assenza approvata: la capacità del Forecasting già scala i giorni di assenza `APPROVED` (vedi R-B2); segnalazione in griglia staffing resta backlog
- [x] ✅ E-05 Optimistic locking (`version`) presente — UX errore da rifinire
- [ ] ⬜ E-06 Cambio entity visibility a sessione attiva (vedi R-E4)
- [ ] ⬜ E-07 Locale/encoding numeri in import
- [ ] ⬜ E-08 Festività locale vs nazionale nei G/U (estendere test)
- [ ] ⬜ E-09 Timezone su confini mese (estendere test)
- [x] ✅ E-10 Liste vuote senza guida (empty state distinto + test)
- [x] ✅ E-11 LockScreen su accesso non autorizzato
- [ ] ⬜ E-12 Allocazione su festivo/weekend

## 5. Operazioni rischiose & governance
- [x] ✅ R-E3 — **"Digita per confermare"** su svuotamento tabella (`ConfirmationModal.confirmPhrase` + DB Inspector) + test
- [x] ✅ R-E4 — Nota **"effetto al prossimo accesso"** ora presente sia in Entity Visibility sia in **RBAC** (route permissions)
- [x] ✅ Conferma su delete/azioni distruttive (ConfirmationModal) presente

## 6. Qualità non-funzionale (gate tecnico)
- [x] ✅ `npm run typecheck` verde
- [x] ✅ `npm run test` verde (452 test: + `DataTable`, `ConfirmationModal`, equivalenza `dateUtils`)
- [x] ✅ `npm run lint` a zero warning sui file modificati
- [x] ✅ Nessuna regressione introdotta dall'intervento corrente
- [ ] ⬜ Accessibilità: focus visibile e navigazione tastiera sulla griglia (R-F1 esteso a tutte le pagine)
- [ ] ⬜ Strategia mobile dichiarata (read-only vs full) — domanda di prodotto aperta

## 7. Definizione di "Pronto per la fase successiva"
Un incremento è promuovibile quando:
1. Le voci ✅/🔄 toccate dall'incremento sono verde su typecheck + test.
2. Ogni nuova voce ⬜ ha owner + decisione registrata in doc 05.
3. Le personas/stories impattate sono aggiornate (no documentazione stale).
4. Nessuna criticità di sicurezza/integrità dati introdotta.

---

### Stato dell'iterazione corrente
- **Artefatti di design**: completati (doc 01–06).
- **Sviluppo iterazione 1**: R-D3 — empty state distinto in `DataTable` + test.
- **Sviluppo iterazione 2 (criticità non risolte)**:
  - R-B2 ✅ verificato già risolto (assenze nella capacità del Forecasting).
  - R-D2 ✅ approvatore + stato (label IT) nelle richieste di assenza.
  - R-E3 ✅ "digita per confermare" sullo svuotamento tabella (`ConfirmationModal.confirmPhrase`) + test.
  - R-E4 ✅ nota "effetto al prossimo accesso" aggiunta in RBAC (già presente in Entity Visibility).
  - R-F1 ⚠️ aria-label sui controlli icona-only di `LeavePage` + input accessibile in `ConfirmationModal` (rollout completo: backlog).
- **Sviluppo iterazione 3 (criticità non risolte, scelte dall'utente)**:
  - R-B4 ✅ Forecasting unificato sulle util condivise di `dateUtils` + test di equivalenza (corrette 2 divergenze latenti).
  - R-C3 ✅ "Crea risorsa da candidato" (prefill form Risorsa via router state).
  - R-C4 ✅ "Chiudi richiesta collegata" dal colloquio assunto.
- **Sviluppo iterazione 4**: R-F1 ✅ rollout completo degli `aria-label` sui controlli icona-only (~26 bottoni in 14 file).
- **Backlog tracciato (feature / decisioni di prodotto)**: R-A2/A3 (undo + diagnosi sovraccarico nella griglia), F6 (navigazione adattiva), edge case E-01/03/04/06/07/08/09/12.
- **Gate**: typecheck ✅ + test ✅ (448) + lint ✅ — eseguiti prima del push.
