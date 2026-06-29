# 05 — Audit della Progettazione, Stress Test e Suggerimenti

> Ruolo: Product Designer Senior, approccio critico-Socratico. Questo documento
> **non valida per compiacere**: elenca gap, contraddizioni e punti ciechi, e per
> ognuno propone una domanda di ricerca o un'azione concreta.

---

## FASE 1 — Audit

### Asse 1 — Coerenza (le user stories coprono i flussi critici?)

**Gap rilevati:**

- **G1 — Nessun recupero da errore nelle scritture massive.** L'assegnazione
  massiva (`🗓️`) e le operazioni distruttive in DB Inspector non hanno undo né
  anteprima. *(Story A3, E3)*
- **G2 — Possibile divergenza dei KPI tra pagine.** "Costo Stimato" e "Utilizzo"
  sono calcolati in Dashboard, Report, Revenue e Forecasting: se le formule non
  condividono la stessa utility, i numeri divergono e l'Executive perde fiducia.
  *(Story B4)* → azione: verificare che tutto passi da `utils/costUtils` / `utils/dateUtils`.
- **G3 — Handoff tra moduli non guidati.** Recruiting→Staffing (candidato→risorsa)
  e Forecast→Richiesta Risorsa sono passaggi manuali, fuori da un flusso. *(Story C3, B2)*
- **G4 — Capacità senza assenze.** Se i `leaves` approvati non riducono i G/U
  disponibili, il Forecasting sovrastima la capacità. *(Story B2)* — **da validare nel codice.**

**Contraddizioni:**

- **C1 — "Single source of truth" vs DB Inspector.** L'app promette dati coerenti
  e governati, ma offre edit inline + `TRUNCATE` che bypassano le validazioni di
  dominio. È una contraddizione di prodotto (potenza per l'admin vs integrità).
- **C2 — Ricchezza funzionale vs persona SIMPLE.** 38 voci di menu contraddicono
  il job-to-be-done "in meno di 2 minuti" del dipendente.

**Azione (Story aggiornate):** le storie A3, B2, B4, C3, C4, D2, D3, E3, E4, F1
sono state aggiunte/marcate in `02-user-stories.md` proprio per chiudere questi
gap di copertura. → asse Coerenza **aggiornato**, non solo segnalato.

### Asse 2 — Utente (personas concrete o stereotipi?)

Le personas sono state costruite **partendo dal modello RBAC reale** (`UserRole`)
e dai flussi nel codice, non da demografia. Ogni scheda ha job-to-be-done,
comportamenti osservabili nel codice, trigger, metrica e attriti verificabili.

**Punto cieco corretto:** mancava la persona **self-service (Davide/SIMPLE)**,
che è l'utente più numeroso e col journey più fragile. È ora P4 ed è il focus
degli interventi concreti (FASE 3). Aggiunte anche le **anti-personas** per
delimitare lo scope (cliente finale, candidato, mobile-first sul campo).

→ asse Utente: personas **rese concrete e completate**.

### Asse 3 — Edge cases non considerati

| # | Edge case | Dominio | Rischio | Stato |
|---|---|---|---|---|
| E-01 | Risorsa **dimessa** a metà di un'allocazione futura | Staffing | allocazioni "fantasma" oltre l'ultimo giorno | da validare |
| E-02 | Assenza **approvata** che sovrappone un'allocazione 100% | Assenze/Staffing | doppio impegno non segnalato | da validare |
| E-03 | Progetto con `endDate` < allocazioni esistenti | Progetti | costi calcolati oltre la fine | da validare |
| E-04 | Cambio `maxStaffingPercentage` con celle già oltre il nuovo max | Risorse | sovraccarichi retroattivi silenziosi | da validare |
| E-05 | **Optimistic locking**: due manager salvano la stessa risorsa | CRUD | perdita aggiornamenti / errore versione | gestito (`version`) — UX da verificare |
| E-06 | Cambio **Entity Visibility** mentre l'utente è loggato | RBAC | vede dati in cache fino al logout | gap UX (Story E4) |
| E-07 | Import con **encoding/locale** numeri (1.000 vs 1,000) | Import | valori errati silenziosi | da validare |
| E-08 | Festività **locale** per sede vs nazionale nel calcolo G/U | Calendario | giorni lavorativi errati per sede | logica presente, test da estendere |
| E-09 | Fuso orario / `parseISODate` su confini mese | Date | off-by-one su forecast mensile | test esistenti, da estendere a TZ |
| E-10 | **Lista vuota** in pagine senza dati (nuovo tenant) | Trasversale | "sembra rotto" | ✅ risolto (empty state distinto in `DataTable` + test) |
| E-11 | Ruolo senza visibilità apre una pagina via URL diretto | RBAC | deve mostrare lock-screen, non crash | gestito (LockScreen) — coverage da verificare |
| E-12 | Allocazione su **giorno festivo/weekend** | Staffing | conteggio G/U incoerente | da validare |

---

## FASE 2 — 10 domande di stress test (design review)

> Domande pensate per **mettere in crisi** le assunzioni, non confermarle.

1. **Single source of truth:** puoi dimostrare che "Costo Stimato" e "Utilizzo"
   producono lo **stesso numero** in Dashboard, Report, Revenue e Forecasting
   sugli stessi dati? Se no, quale pagina mente?
2. **Capacità reale:** il forecast di capacità **sottrae le assenze approvate**?
   Se un team è "in ferie" ad agosto, l'app lo vede o promette capacità inesistente?
3. **Recupero da errore:** un manager applica per sbaglio 100% a 200 celle.
   Qual è il percorso di **undo** in meno di 10 secondi? (oggi: nessuno)
4. **Persona SIMPLE:** un dipendente al primo accesso, con 4 pagine pertinenti su
   38 voci di menu, **quanto tempo** impiega a trovare "richiedi ferie"? L'hai misurato?
5. **Sovra-allocazione:** il rosso è un **allarme o un divieto**? Se è solo un
   colore, perché credi che i manager non lo ignorino sotto pressione?
6. **Handoff recruiting:** quante volte un candidato assunto viene **re-inserito a
   mano** come risorsa? Qual è il tasso di errore di quel doppio inserimento?
7. **DB Inspector:** perché uno strumento che fa `TRUNCATE` e bypassa le
   validazioni è esposto in produzione? Qual è il **blast radius** di un errore?
8. **Cambio permessi:** se revochi `entityVisibility` su `projects` a un ruolo,
   un utente già loggato **cosa vede** fino al prossimo login? È accettabile?
9. **Accessibilità:** la griglia di staffing è usabile **solo da tastiera** e con
   screen reader? I controlli icona-only (`🗓️ ❌ ✏️`) hanno un nome accessibile?
10. **Mobile:** esiste una BottomNav, ma i flussi di pianificazione sono
    desktop-first. Stai promettendo un'esperienza mobile che **non mantieni**?
    Meglio dichiararla read-only su mobile?

---

## FASE 3 — Suggerimenti concreti (domanda di ricerca / azione)

Per ogni criticità: una **domanda di ricerca** (da validare con utenti/dati) e/o
una **azione di sviluppo** immediata.

| ID | Criticità | Domanda di ricerca | Azione di sviluppo |
|---|---|---|---|
| R-A2 | Sovraccarico non spiegato (G1/Q5) | I manager vogliono diagnosi o solo bilanciamento 1-click? | Popover "perché è rosso" + breakdown (F3) |
| R-A3 | Nessun undo bulk (G1/Q3) | Preferiscono anteprima pre-apply o undo post-apply? | Conferma con riepilogo celle impattate prima dell'apply |
| R-B2 | Capacità senza assenze (G4/Q2) | Quanto incide sulle decisioni di hiring l'errore di capacità? | ✅ **già risolto** (verificato): il Forecasting sottrae i `leaves` APPROVED dai G/U |
| R-B4 | Divergenza KPI (G2/Q1) | Quali numeri gli utenti confrontano tra pagine? | ✅ Forecasting ora usa le util condivise (`buildHolidaySet`/`getWorkingDaysBetweenWithSet`); equivalenza provata da test (corrette 2 divergenze latenti) |
| R-C3 | No conversione candidato→risorsa (G3/Q6) | Quanto tempo si perde nel doppio inserimento? | ✅ "Crea risorsa da candidato" pre-compila il form Risorsa dal colloquio |
| R-C4 | Richiesta non chiusa quando coperta | Le richieste restano "orfane" dopo l'assunzione? | ✅ "Chiudi richiesta collegata" dal colloquio assunto (→ CHIUSA) |
| R-D2 | Stato approvazione assenza poco chiaro (Q4) | Il dipendente sa chi approva e quando? | ✅ approvatore + badge stato (label IT) in `LeavePage` |
| R-D3 | Empty state ambiguo (E-10/Q4) | Le liste vuote generano ticket di supporto? | ✅ `DataTable` ora distingue "dataset vuoto" da "filtro senza risultati" (+test) |
| R-E3 | Operazioni distruttive (C1/Q7) | Serve davvero `TRUNCATE` in prod? A chi? | ✅ "digita per confermare" (`ConfirmationModal.confirmPhrase`) sullo svuotamento + test |
| R-E4 | Effetto cambio permessi (E-06/Q8) | Gli admin sanno che serve un nuovo login? | ✅ nota "effetto al prossimo accesso" in RBAC (già in Entity Visibility) |
| R-F1 | Accessibilità (Q9) | Esistono utenti che navigano da tastiera/AT? | ✅ `aria-label` su tutti i controlli icona-only dell'app (~26 bottoni/14 file) + input accessibile in `ConfirmationModal` |

### Intervento di sviluppo in questa iterazione
Per chiudere il loop "proponi → sviluppa → ri-audita" su una criticità ad alto
impatto e basso rischio, si interviene su **R-D3 (empty state coerenti)**, che
tocca la persona più fragile (P4) ed è verificabile con test.

**Nota di onestà (auto-critica Socratica):** l'ipotesi iniziale "EmptyState usato
in 1 sola pagina" era **sbagliata**. Verificando il codice, il componente
condiviso `DataTable` *già* renderizza `EmptyState` per tutte le pagine
tabellari. Il gap **reale** era diverso e più sottile: lo stato vuoto usava un
**unico messaggio** ("…con i filtri o i criteri correnti") sia quando il dataset
è realmente vuoto (primo accesso) sia quando i filtri non hanno corrispondenze →
messaggio fuorviante e nessuna via d'uscita. La correzione distingue i due casi
e, nel caso "filtro", offre l'azione **"Azzera filtri"**. Coperto da
`components/__tests__/DataTable.test.tsx`.

Le restanti criticità (R-A2/A3, R-B2/B4, R-C3/C4, R-D2, R-E3/E4, R-F1 e gli edge
case aperti) restano tracciate come ricerca/backlog nella Checklist (doc 06).

---

## Re-audit (dopo l'intervento)

> Da aggiornare ad ogni iterazione di sviluppo. Vedi `06-checklist-design-review.md`
> per la verifica sistematica voce per voce.

- Asse 1 Coerenza: storie aggiornate; G2/G4 ancora **da validare** nel codice (backlog R-B4/R-B2).
- Asse 2 Utente: personas concrete e complete ✅; ipotesi sull'empty state **corretta** dopo verifica del codice (vedi nota di onestà).
- Asse 3 Edge cases: **E-10 chiuso** (empty state distinto + test); altri tracciati con owner nella checklist.
- Stress test: la domanda 4 (self-service) è **parzialmente indirizzata**; le altre (incl. 9 accessibilità) restano aperte e tracciate.
- Gate tecnico re-eseguito: `typecheck` ✅, `test` ✅ (446 test, +3 nuovi), `lint` ✅ sui file modificati.
