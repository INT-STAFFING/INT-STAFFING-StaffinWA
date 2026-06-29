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
- [ ] ⬜ R-B4 — Verificare che "Costo Stimato" e "Utilizzo" usino le **stesse**
      utility (`utils/costUtils`, `utils/dateUtils`) in Dashboard/Report/Revenue/Forecasting
- [ ] ⬜ R-B2 — Le assenze `APPROVED` riducono i G/U disponibili nel Forecasting
- [ ] ⬜ R-C3/R-C4 — Handoff recruiting→staffing guidato (candidato→risorsa, chiusura richiesta)
- [x] ✅ User stories aggiornate per chiudere i gap di copertura

## 3. Utente & self-service (Asse 2, persona P4)
- [x] ✅ R-D3 — **Empty state distinto** (dataset vuoto vs filtro senza risultati) in `DataTable` + test
- [ ] ⬜ R-F1 — `aria-label` sui controlli icona-only (backlog: oggi usano `title`)
- [ ] ⬜ R-D2 — Mostrare approvatore + badge stato nelle richieste di assenza
- [ ] ⬜ F6 — Navigazione adattiva/ordinata per rilevanza per ruolo

## 4. Edge cases (Asse 3) — da coprire con validazione/test
- [ ] ⬜ E-01 Dimissione a metà allocazione futura
- [ ] ⬜ E-02 Assenza approvata sovrapposta ad allocazione
- [ ] ⬜ E-03 `endDate` progetto < allocazioni
- [ ] ⬜ E-04 Riduzione `maxStaffingPercentage` retroattiva
- [x] ✅ E-05 Optimistic locking (`version`) presente — UX errore da rifinire
- [ ] ⬜ E-06 Cambio entity visibility a sessione attiva (vedi R-E4)
- [ ] ⬜ E-07 Locale/encoding numeri in import
- [ ] ⬜ E-08 Festività locale vs nazionale nei G/U (estendere test)
- [ ] ⬜ E-09 Timezone su confini mese (estendere test)
- [x] ✅ E-10 Liste vuote senza guida (empty state distinto + test)
- [x] ✅ E-11 LockScreen su accesso non autorizzato
- [ ] ⬜ E-12 Allocazione su festivo/weekend

## 5. Operazioni rischiose & governance
- [ ] ⬜ R-E3 — Doppia conferma "digita per confermare" su `TRUNCATE`
- [ ] ⬜ R-E4 — Messaggio "il cambio permessi ha effetto al prossimo accesso"
- [x] ✅ Conferma su delete/azioni distruttive (ConfirmationModal) presente

## 6. Qualità non-funzionale (gate tecnico)
- [x] ✅ `npm run typecheck` verde
- [x] ✅ `npm run test` verde (446 test, +3 nuovi su `DataTable`)
- [x] ✅ `npm run lint` a zero warning sui file modificati
- [x] ✅ Nessuna regressione introdotta dall'intervento corrente
- [ ] ⬜ Accessibilità: focus visibile e navigazione tastiera sulla griglia (R-F1 esteso)
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
- **Sviluppo**: R-D3 — empty state distinto (dataset vuoto vs filtro) in `DataTable` + test.
- **Backlog tracciato**: R-A2/A3, R-B2/B4, R-C3/C4, R-D2, R-E3/E4, R-F1, edge cases aperti.
- **Gate**: typecheck ✅ + test ✅ (446) + lint ✅ — eseguiti prima del push.
