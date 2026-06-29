# 02 — User Stories

> Formato: `Come <persona>, voglio <azione> così da <valore>`.
> Ogni storia ha **criteri di accettazione** verificabili e un riferimento allo
> stato nel codice: ✅ coperto · ⚠️ parziale · ❌ gap.
> Le storie marcate ⚠️/❌ alimentano l'Audit (doc 05) e la Checklist (doc 06).

## Epica A — Pianificazione dello Staffing  *(Giulia, P1)*

### A1 — Allocare una risorsa a un progetto su un periodo ✅
- **Come** Staffing Manager **voglio** assegnare una risorsa a un progetto e
  impostare la % giornaliera su un intervallo **così da** pianificare il carico.
- **Accettazione:**
  - Posso aggiungere un'assegnazione (`➕`) e applicare una % a un range (modale `🗓️`).
  - La cella mostra il colore corretto rispetto a `maxStaffingPercentage`.
  - Le viste Giorno/Settimana/Mese aggregano coerentemente.

### A2 — Individuare e risolvere una sovra-allocazione ⚠️
- **Come** Staffing Manager **voglio** vedere quando una persona supera il
  proprio massimo **così da** ribilanciare prima che diventi un problema.
- **Accettazione:**
  - ✅ La cella totale diventa rossa se `totale > maxStaffingPercentage`.
  - ⚠️ **Gap:** il sistema non spiega *quali* progetti causano lo sforamento né
    propone una risoluzione; nessun avviso/conferma quando salvo una sovra-allocazione.

### A3 — Annullare un'assegnazione massiva errata ❌
- **Come** Staffing Manager **voglio** annullare l'ultima operazione massiva
  **così da** recuperare da un errore senza ricostruire a mano.
- **Accettazione (target):** un "Annulla" sull'ultima azione bulk, o anteprima
  prima dell'applicazione. **Stato:** ❌ non presente.

### A4 — Capire perché una cella non è editabile ⚠️
- **Come** utente **voglio** capire perché una cella è disabilitata (assenza,
  fine progetto, dimissione, mancanza permessi) **così da** non perdere tempo.
- **Accettazione (target):** tooltip/motivo sullo stato disabilitato. **Stato:** ⚠️ da verificare/uniformare.

## Epica B — Capacità, Forecast e Budget  *(Marco, P2 · Luca, P6)*

### B1 — Prevedere capacità e deficit a 12 mesi ✅
- **Accettazione:** la tabella Forecasting mostra G/U Disponibili, Allocati, Utilizzo%, Surplus/Deficit per mese, con grafico.

### B2 — La capacità deve tener conto delle assenze approvate ✅ *(verificato risolto)*
- **Come** Delivery Lead **voglio** che ferie/permessi approvati riducano i G/U
  disponibili **così da** non sovrastimare la capacità.
- **Accettazione:** i `leaves` con stato `APPROVED` decurtano la disponibilità in
  Forecasting. **Stato:** ✅ implementato (`ForecastingPage.tsx` → `leaveDaysLost`
  sottratto da `availablePersonDays`). L'ipotesi di gap dell'audit era errata.

### B3 — Confrontare Budget vs Costo Stimato per progetto ✅
- **Accettazione:** Dashboard e Report mostrano Budget, Costo, Varianza con coerenza di formula.

### B4 — I KPI devono coincidere tra Dashboard, Report e Revenue ⚠️
- **Come** Executive **voglio** un'unica fonte di verità **così da** non perdere
  fiducia nei numeri.
- **Accettazione (target):** stessa formula di "Costo Stimato" e di "Utilizzo"
  riusata (non duplicata) tra pagine. **Stato:** ⚠️ da verificare contro `utils/costUtils`.

### B5 — Simulare uno scenario senza toccare i dati reali ✅
- **Accettazione:** la pagina Simulazioni consente what-if isolati (reducer dedicato).

## Epica C — HR & Recruiting  *(Elena, P3)*

### C1 — Aprire una Richiesta Risorsa e tracciarne lo stato ✅
- **Accettazione:** CRUD richiesta con ruolo, periodo, %impegno, urgenza, stato `ATTIVA/STANDBY/CHIUSA`, `isLongTerm` calcolato.

### C2 — Gestire la pipeline colloqui collegata alla richiesta ✅
- **Accettazione:** colloquio legato a una richiesta; feedback `Positivo/On Hold/Negativo`; card-filtro.

### C3 — Convertire un candidato assunto in Risorsa staffabile ❌
- **Come** HR **voglio** che un candidato con "Data Ingresso" diventi una Risorsa
  anagrafica disponibile in Staffing **così da** non re-inserire i dati a mano.
- **Accettazione (target):** azione "Crea risorsa da candidato" pre-compilata.
  **Stato:** ❌ flusso non guidato (vedi domanda di ricerca R-C3).

### C4 — Chiudere automaticamente la richiesta quando è coperta ⚠️
- **Accettazione (target):** suggerimento/automatismo di chiusura richiesta al verificarsi dell'ingresso. **Stato:** ⚠️ manuale.

## Epica D — Self-service Dipendente  *(Davide, P4)*

### D1 — Vedere il proprio carico/allocazioni ✅
- **Accettazione:** Carico Risorse filtrabile sulla propria persona, read-only.

### D2 — Richiedere un'assenza e sapere a chi va in approvazione ✅ *(risolto)*
- **Come** dipendente **voglio** inviare una richiesta di ferie e **vedere lo
  stato e l'approvatore** **così da** sapere a che punto è.
- **Accettazione:**
  - ✅ Creo la richiesta, validazione date (`endDate >= startDate`), giorni lavorativi calcolati.
  - ✅ Lo stato è mostrato con label in italiano ("In Attesa/Approvata/Rifiutata").
  - ✅ L'**approvatore** è visibile in tabella (colonna dedicata), nella card mobile e nell'export.

### D3 — Capire una lista vuota ✅ *(risolto in questa iterazione)*
- **Come** dipendente **voglio** che una pagina senza dati mi dica cosa fare
  **così da** non pensare che sia rotta.
- **Accettazione:** stato vuoto guidato (icona, titolo, descrizione, azione)
  coerente su tutte le pagine tabellari.
- **Stato:** ✅ `DataTable` (condiviso) ora distingue **dataset vuoto** ("Nessun
  elemento presente" + azione di creazione) da **filtro senza risultati**
  ("Nessun risultato" + "Azzera filtri"). Coperto da test (`DataTable.test.tsx`).

### D4 — Aggiornare le proprie competenze/certificazioni ✅
- **Accettazione:** skill 1–5, certificazioni con scadenza, livelli calcolati.

## Epica E — Amministrazione & Governance  *(Sara, P5)*

### E1 — Configurare RBAC su 3 livelli ✅
- **Accettazione:** Security Center gestisce route permissions, operation permissions, entity visibility.

### E2 — Import massivo senza duplicati ✅
- **Accettazione:** wizard con template obbligatorio, dedup, report con warning.

### E3 — Operazioni distruttive protette da frizione e tracciate ⚠️
- **Come** Admin **voglio** che `TRUNCATE`/edit inline in DB Inspector richiedano
  conferma esplicita e siano registrati **così da** poter risalire a cosa è successo.
- **Accettazione:** ✅ modale di conferma su svuota; ⚠️ audit trail delle modifiche distruttive da rafforzare.

### E4 — Capire l'effetto di un cambio permessi sulle sessioni attive ⚠️
- **Accettazione (target):** messaggio che spiega quando il cambio ha effetto (al prossimo login). **Stato:** ⚠️ non esplicitato.

## Epica F — Qualità trasversale (non-funzionali)  *(tutte le personas)*

### F1 — Accessibilità da tastiera e screen reader ⚠️
- **Accettazione (target):** focus visibile, label ARIA su controlli icona-only,
  navigazione tastiera sulla griglia. **Stato:** ⚠️ uso di `aria-*` limitato.

### F2 — Feedback coerente su errori e azioni asincrone ✅/⚠️
- **Accettazione:** toast e spinner presenti; ⚠️ messaggi di errore di rete non sempre azionabili.

### F3 — Coerenza visiva del design system ✅
- **Accettazione:** token MD3 semantici, Tailwind; recenti unificazioni colore sidebar.

---

### Matrice copertura flussi critici (sintesi)
| Flusso critico | Storia | Stato |
|---|---|---|
| Allocare/ribilanciare | A1, A2, A3 | ⚠️ (manca undo + spiegazione conflitto) |
| Forecast capacità reale | B1, B2 | ⚠️ (assenze nel calcolo) |
| Coerenza KPI cross-page | B4 | ⚠️ |
| Recruiting end-to-end | C1–C4 | ⚠️ (manca conversione candidato→risorsa) |
| Self-service dipendente | D1–D4 | ⚠️ (empty state, stato approvazione) |
| Governance/distruttive | E1–E4 | ⚠️ (audit, effetto sessioni) |
| Accessibilità | F1 | ⚠️ |
