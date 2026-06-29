# 04 — Flussi & Wireframe (testuali)

> Wireframe a bassa fedeltà (ASCII) e diagrammi di flusso per i percorsi critici.
> Servono a rendere discutibili le scelte di IA (information architecture) e di
> interazione **prima** di toccare il codice. Riferiti ai componenti reali.

## F1 — Information Architecture attuale (as-is)

```
Sidebar (38 voci, 7 sezioni)
├─ Principale     : Dashboard · Cerca · Knowledge Base · Notifiche · Staffing · Carico Risorse
├─ Analisi        : Simulazioni · Gantt · WBS · Revenue · Forecasting
├─ Progetti       : Progetti · Contratti · Clienti
├─ Risorse        : Risorse · Performance · Competenze · Certificazioni · Analisi Competenze · Organigramma · Ruoli · Assenze
├─ Operatività    : Richieste Risorse · Colloqui · Mappa Competenze · Visualizzazione Staffing
├─ Supporto       : Manuale · Guida Assenze · Report
├─ Configurazione : Calendario · Opzioni · Rate Cards
├─ Dati           : Importa · Esporta
└─ Amministrazione: Impostazioni Admin · Security Center · Webhooks · DB Inspector
```

**Problema di IA:** la sidebar mostra *tutte* le voci consentite dal ruolo, ma
non distingue per **frequenza d'uso** né per persona. Per `SIMPLE` (Davide) le
voci pertinenti sono ~4, ma l'architettura non lo guida. → vedi proposta F6.

---

## F2 — Wireframe: Griglia Staffing (as-is)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [← Prec] [Oggi] [Succ →]   Vista:(Giorno)(Settimana)(Mese)             │
│ Filtri: [Risorsa ▾][Cliente ▾][PM ▾][Progetto ▾]                       │
├───────────────┬────┬────┬────┬────┬────┬────┬────┬────┬────────────────┤
│ Risorsa/Prog  │ Lun│ Mar│ Mer│ Gio│ Ven│ ...│    │    │  (sticky head) │
├───────────────┼────┼────┼────┼────┼────┼────┼────┼────┼────────────────┤
│▍Rossi M.  80% ➕│ 90🔴│ 80🟢│ 60🟡│ ...                              │ ← master row
│  · Progetto A 🗓️❌│ 50 │ 50 │ 30 │ ...                              │ ← assignment
│  · Progetto B 🗓️❌│ 40 │ 30 │ 30 │ ...                              │
└───────────────┴────┴────┴────┴────┴────┴────┴────┴────┴────────────────┘
   🔴 totale > max   🟢 = max   🟡 0<tot<max
```

**Attriti di interazione (da validare con i test di usabilità):**
- Editing % via `select` step 5 → lento su molte celle.
- 🔴 non spiega *quale* assegnazione causa lo sforamento.
- `🗓️` (bulk) non ha anteprima né undo.

---

## F3 — Flusso: Risoluzione sovra-allocazione (proposto)

```
        ┌─────────────────────────┐
        │ Cella totale = ROSSO     │
        └────────────┬────────────┘
                     │ click/hover
                     ▼
        ┌─────────────────────────────────────────┐
        │ Popover "Perché è in sovraccarico"       │
        │  • Max: 80%  • Totale: 110%  • +30%      │
        │  Ripartizione:                            │
        │   - Progetto A  50%   [riduci]            │
        │   - Progetto B  60%   [riduci]            │
        │  [Bilancia a 80%]  [Ignora]               │
        └─────────────────────────────────────────┘
```
Obiettivo: trasformare un segnale (colore) in un'**azione** (diagnosi + fix).
Domanda di ricerca associata: R-A2.

---

## F4 — Flusso: Richiesta Assenza self-service (as-is vs to-be)

**As-is**
```
Apri Assenze → (lista vuota, nessuna guida) → Nuova richiesta →
compila → Salva (PENDING) → ??? (nessuna conferma su approvatore)
```

**To-be**
```
Apri Assenze
  └─ se vuota → EmptyState: "Nessuna richiesta. Le tue ferie appariranno qui."
                 [Richiedi assenza]
Nuova richiesta → compila (date, tipo, ½ giornata)
  └─ mostra: giorni lavorativi = N · Approvatore: <manager>
Salva → Toast "Richiesta inviata a <manager> · stato: In attesa"
  └─ lista: badge stato (In attesa / Approvata / Rifiutata)
```
Domande di ricerca: R-D2 (chiarezza approvatore), R-D3 (empty state).

---

## F5 — Flusso: Recruiting → Staffing (handoff, proposto)

```
Richiesta Risorsa (ATTIVA)
   │ coperta internamente?  ── sì ──► Staffing (assegna)
   │ no
   ▼
Colloqui (pipeline) → Feedback Positivo → Data Ingresso
   │
   ▼
[Crea Risorsa da candidato]  ◄── azione guidata (pre-compila anagrafica)
   │
   ▼
Risorsa creata → disponibile in Staffing
   │
   ▼
Richiesta → suggerisci stato CHIUSA
```
Domande di ricerca: R-C3 (conversione candidato→risorsa), R-C4 (chiusura).

---

## F6 — Proposta IA: navigazione adattiva per persona

```
SIMPLE (Davide)            MANAGER (Giulia)           ADMIN (Sara)
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│ Il mio carico │          │ Staffing      │          │ tutte le voci │
│ Le mie assenze│          │ Carico Risorse│          │ + Amministraz.│
│ Competenze    │          │ Richieste     │          │ ...           │
│ Certificazioni│          │ Forecasting   │          │               │
│ ───────────── │          │ Dashboard     │          │               │
│ Altro ▾       │          │ Altro ▾       │          │               │
└───────────────┘          └───────────────┘          └───────────────┘
```
Principio: la sidebar è già filtrata per **permessi**; va filtrata anche per
**rilevanza/frequenza**, riducendo il carico cognitivo (soprattutto P4).
Nota: già esiste il feature flag `pageVisibility` per ruolo — la proposta è
sfruttarlo per ordinare/raggruppare, non solo per nascondere.

---

### Legenda stato delle proposte
| Wireframe/Flusso | Tipo | Stato |
|---|---|---|
| F2 Griglia | as-is | documentato |
| F3 Risoluzione sovraccarico | to-be | proposta (R-A2) |
| F4 Assenze self-service | to-be | **in sviluppo** (empty state) |
| F5 Handoff recruiting | to-be | proposta (R-C3/C4) |
| F6 Navigazione adattiva | to-be | proposta (research) |
