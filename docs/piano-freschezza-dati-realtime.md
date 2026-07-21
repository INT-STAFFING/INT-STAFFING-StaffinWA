# Piano d'implementazione — Freschezza dati senza refresh manuale (Approccio 1 + 2)

> **Stato**: proposta / non ancora implementato
> **Branch di sviluppo previsto**: `claude/db-updates-visibility-ifeohx`
> **Obiettivo generale**: eliminare la necessità del refresh manuale della pagina per vedere i dati aggiornati dopo inserimenti/aggiornamenti, **senza** appesantire l'app, allungare i tempi d'uso o dare percezione di lentezza.
> **Vincolo**: questo documento è solo un piano. Nessuna modifica al codice è inclusa qui.

---

## 0. Contesto tecnico (diagnosi confermata sul codice)

| Aspetto | Situazione attuale | File / riferimento |
|---|---|---|
| Caricamento dati | Un'unica volta al mount, via `fetchData()` in un `useEffect([fetchData])` | `context/AppContext.tsx:212-214` |
| Sorgente dati | Due chiamate bulk: `/api/data?scope=metadata` + planning data | `context/AppContext.tsx:100-197` |
| Aggiornamento post-mutazione | Le CRUD aggiornano già lo stato locale con la risposta del server (`setResources(prev => …)`, ecc.) | es. `context/ResourcesContext.tsx` |
| Cascade delete | Aggiornano lo stato locale via funzioni `_remove*` | `context/AppContext.tsx:225-252` |
| Dati derivati (KPI/dashboard) | `analyticsCache` calcolato lato server; si aggiorna **solo** con `forceRecalculateAnalytics()` (bottone manuale) o con un `fetchData()` completo | `context/UIConfigContext.tsx:292-300`, `api/data.ts:143` |
| Re-fetch automatico | **Assente**: niente polling, WebSocket/SSE, né refetch su focus/visibilità | (verificato: nessun `setInterval`/`EventSource`/`visibilitychange`) |
| Preview/test | `apiFetch` intercetta `/api` e devia al mock engine in ambiente preview | `services/apiClient.ts` |
| Framework test | Vitest + jsdom + Testing Library; i context si testano con `renderHook` mockando `apiFetch` e `ToastContext` | `vite.config.ts:36-39`, `context/KnowledgeBaseContext.test.tsx` |

**Causa radice del sintomo** ("devo fare refresh"): i dati vivono nello stato React caricato una sola volta. Il refresh serve quando il cambiamento arriva da una sorgente che il `setState` locale non conosce:
1. modifiche fatte da **altri utenti / altre schede**;
2. **dati derivati lato server** (`analyticsCache`) non ricalcolati dopo una mutazione;
3. eventuali **percorsi di scrittura** che non richiamano il `setState` corrispondente.

L'**Approccio 1** (refetch silenzioso su focus/visibilità) risolve (1). L'**Approccio 2** (chiusura percorsi + invalidazione mirata dei derivati) risolve (2) e (3).

---

## Principi guida (validi per tutti i GOAL)

- **Silenzioso**: nessun aggiornamento deve mostrare lo spinner a schermo intero o far "lampeggiare" la UI. Il refetch avviene in background e sostituisce lo stato solo a dati pronti.
- **Frugale**: zero traffico mentre l'utente lavora; le richieste partono solo su eventi discreti (rientro sulla scheda) o dopo mutazioni mirate.
- **Mirato prima che globale**: preferire l'aggiornamento della singola entità o della singola fetta di dati rispetto al re-fetch bulk.
- **Idempotente e sicuro**: mai sovrascrivere una mutazione in corso; deduplica e throttling obbligatori.
- **Testabile**: ogni GOAL ha un gate verificabile e test automatici prima di considerarsi chiuso.

---

## GOAL 0 — Audit e baseline dei percorsi di scrittura

**Obiettivo**: avere la mappa completa e verificata di *tutti* i percorsi di scrittura e del loro effetto sullo stato locale, così da sapere con certezza cosa va sistemato nel GOAL 3. Nessuna modifica funzionale.

### Azioni
0.1 Elencare ogni chiamata `apiFetch` con `method: 'POST' | 'PUT' | 'DELETE'` nei context e nelle pagine (punto di partenza: ~92 occorrenze nei context).
0.2 Per ciascuna, annotare in tabella: entità toccata, se aggiorna lo stato locale (`setX`), e se impatta i dati derivati (`analyticsCache`, backlog contratti, computed skills).
0.3 Marcare come **GAP** ogni scrittura che: (a) non aggiorna lo stato locale, oppure (b) modifica un dato che alimenta un derivato non invalidato.
0.4 Salvare la tabella in `docs/audit-percorsi-scrittura.md`.

### Gate di verifica (G0)
- [ ] Tabella completa: ogni write path ha una riga con esito (OK / GAP).
- [ ] Lista dei GAP condivisa e approvata prima di procedere.
- [ ] Nessuna modifica al codice applicativo (solo documento di audit).

### Test
- Nessun test automatico (fase di sola analisi). Verifica manuale: `grep` di POST/PUT/DELETE confrontato con la tabella (conteggio coerente).

---

## GOAL 1 — Refetch silenzioso su focus/visibilità (Approccio 1)

**Obiettivo**: quando l'utente rientra sulla scheda (o la finestra riprende il focus), i dati si aggiornano automaticamente in background, senza spinner e senza percezione di attesa. Copre il caso "modifica fatta altrove / da un collega".

### Contesto/file coinvolti
- `context/AppContext.tsx` — `fetchData` (100-208), `useFetchData` (661-663), `useAppState`/`isActionLoading` (655-659).
- Nuovo hook (proposto): `hooks/useAutoRefreshOnFocus.ts`.
- Punto di aggancio: componente radice che ha già accesso ai provider (es. `App.tsx:174`).

### Azioni progressive
**1.A — Modalità "silent" per il refetch**
- 1.A.1 Introdurre la possibilità di eseguire `fetchData` **senza** attivare `setLoading(true)` (parametro opzionale `{ silent: true }` o funzione dedicata `refetchSilent`). Motivo: `setLoading(true)` fa comparire la schermata di caricamento (`App.tsx:181`), da evitare in refetch.
- 1.A.2 In modalità silent, aggiornare lo stato solo a fine fetch riuscita; in caso di errore, **non** impostare `fetchError` a schermo intero (al massimo un toast discreto o log), per non interrompere il lavoro dell'utente.

**1.B — Hook `useAutoRefreshOnFocus`**
- 1.B.1 Registrare i listener `visibilitychange` (con `document.visibilityState === 'visible'`) e `window.focus`.
- 1.B.2 Al trigger, chiamare `refetchSilent()`.
- 1.B.3 **Throttle / min-interval**: ignorare i trigger ravvicinati (es. non più di 1 refetch ogni 15–30s) per evitare raffiche quando l'utente cambia scheda di continuo.
- 1.B.4 **Guardia mutazioni in corso**: se `isActionLoading` indica una mutazione attiva, rimandare/saltare il refetch per non sovrascrivere un'operazione dell'utente.
- 1.B.5 **Cleanup**: rimuovere i listener allo smontaggio.

**1.C — Aggancio**
- 1.C.1 Invocare `useAutoRefreshOnFocus()` una sola volta a livello radice, dentro i provider.
- 1.C.2 (Opzionale, dietro flag) intervallo di sicurezza lungo (es. 5 min) solo quando la scheda è visibile, come rete di sicurezza; disattivabile.

### Gate di verifica (G1)
- [ ] Rientrando sulla scheda, i dati modificati altrove compaiono **senza** refresh manuale e **senza** spinner a schermo intero.
- [ ] Nessun refetch parte mentre la scheda è nascosta.
- [ ] Due cambi scheda ravvicinati (< intervallo) producono **un solo** refetch (throttle attivo).
- [ ] Un refetch non parte (o è posticipato) se c'è una mutazione in corso.
- [ ] Errore di rete durante il refetch silent → nessuna schermata d'errore bloccante.

### Test (Vitest + jsdom)
- `hooks/useAutoRefreshOnFocus.test.ts`:
  - dispatch di `visibilitychange` con `visibilityState='visible'` → `refetchSilent` chiamato una volta;
  - `visibilityState='hidden'` → **non** chiamato;
  - due eventi entro l'intervallo → una sola chiamata (fake timers `vi.useFakeTimers()`);
  - mutazione attiva (`isActionLoading` true) → chiamata saltata/posticipata;
  - unmount → listener rimossi (nessuna chiamata dopo unmount).
- `context/AppContext` (estensione test esistenti):
  - `refetchSilent` **non** porta `loading` a `true`;
  - errore in silent → `fetchError` resta `null`.

---

## GOAL 2 — Refetch mirato dopo una mutazione ("visibilità immediata garantita")

**Obiettivo**: garantire che, subito dopo un inserimento/aggiornamento fatto **dall'utente stesso**, la vista corrente rifletta il dato reale del server anche nei casi in cui l'aggiornamento ottimistico locale potrebbe divergere (es. campi calcolati lato DB, trigger, default). Il tutto senza re-fetch globale.

### Contesto/file coinvolti
- Tutti i context CRUD (`ResourcesContext`, `ProjectsContext`, `SkillsContext`, `HRContext`, `LookupContext`, `UIConfigContext`).
- API per entità: `/api/resources?entity=…` (già supporta GET per singola entità).

### Azioni progressive
**2.A — Confermare l'ottimistico dove basta**
- 2.A.1 Per le entità semplici (nessun campo derivato lato server), mantenere l'attuale aggiornamento ottimistico: è già corretto e istantaneo. Nessun refetch aggiuntivo (evita traffico inutile).

**2.B — Refetch mirato dove serve**
- 2.B.1 Individuare (dall'audit G0) le entità con campi calcolati o dipendenze server (es. `roleCostHistory` già rifetchato dopo `updateRole` — pattern di riferimento in `context/ResourcesContext.tsx`).
- 2.B.2 Dove necessario, dopo la mutazione ricaricare **solo quella entità** (`GET /api/resources?entity=X`) e sostituire la relativa fetta di stato — non `fetchData()` intero.
- 2.B.3 Mantenere l'operazione silenziosa (nessuno spinner globale; al più `actionLoading` locale al pulsante, già esistente).

### Gate di verifica (G2)
- [ ] Dopo una mutazione con campi derivati, il valore mostrato coincide con quello del DB senza refresh.
- [ ] Il refetch mirato interessa **solo** l'entità toccata (verificabile dalle chiamate di rete).
- [ ] Nessun `fetchData()` bulk innescato da una singola CRUD (salvo casi che già lo prevedono, es. `updatePlanningSettings`).

### Test
- Per ogni context toccato, estendere i `*.test.tsx`:
  - mock `apiFetch`: la POST/PUT ritorna un valore, la successiva GET mirata ritorna il valore "canonico" → lo stato riflette la GET;
  - conteggio chiamate: nessuna chiamata a `/api/data` durante la CRUD;
  - `loading` globale invariato durante la CRUD.

---

## GOAL 3 — Chiusura dei GAP: percorsi che non aggiornano lo stato locale (Approccio 2a)

**Obiettivo**: nessuna scrittura deve lasciare la UI disallineata. Ogni GAP individuato nel GOAL 0 aggiorna lo stato locale (ottimistico) **oppure** fa un refetch mirato.

### Contesto/file coinvolti
- I GAP elencati in `docs/audit-percorsi-scrittura.md` (output G0).
- Candidati tipici da verificare: import massivi (`api/import.ts` lato client), operazioni cascade cross-domain (`context/AppContext.tsx:225-252`), azioni bulk su allocazioni (`bulkUpdateAllocations`, `context/AppContext.tsx:496-540`).

### Azioni progressive
- 3.A Per ogni GAP di tipo (a) "non aggiorna stato": aggiungere il `setState` mancante con la risposta del server, oppure un refetch mirato dell'entità.
- 3.B Per gli **import massivi** (che toccano molte entità in una volta): dopo l'import, eseguire **un** `refetchSilent()` mirato agli scope impattati (o al bulk se davvero pan-entità), preferendo comunque il silenzioso.
- 3.C Verificare le **cascade delete**: confermare che tutte le entità figlie vengano rimosse dallo stato (oggi `deleteResource`/`deleteProject` rimuovono già i figli; validarlo con test).

### Gate di verifica (G3)
- [ ] Ogni GAP di G0 è chiuso: la relativa azione aggiorna la UI senza refresh.
- [ ] Import massivo → la UI riflette i nuovi dati senza refresh, con al più **un** refetch.
- [ ] Cascade delete → nessun "fantasma" (figli orfani) resta a video.

### Test
- Test dedicati per import e cascade: dopo l'operazione, lo stato non contiene record eliminati e contiene quelli nuovi.
- Regressione: rieseguire l'intera suite context (`npm test`) senza fallimenti.

---

## GOAL 4 — Invalidazione mirata dei dati derivati / `analyticsCache` (Approccio 2b)

**Obiettivo**: dashboard e KPI restano coerenti dopo mutazioni che li alimentano (allocazioni, progetti, costi, ecc.), senza costringere l'utente a ricaricare la pagina né a premere manualmente "ricalcola".

### Contesto/file coinvolti
- `context/UIConfigContext.tsx:292-300` (`forceRecalculateAnalytics`, endpoint `analytics_cache&action=recalc_all`).
- `api/data.ts:111,143` (lettura `analytics_cache`).
- Mutazioni che impattano i KPI: allocazioni, progetti/contratti, costi ruolo, spese progetto.

### Azioni progressive (scegliere una strategia)
- 4.A **Strategia "stale-then-recompute" (consigliata)**: dopo una mutazione che impatta i KPI, marcare l'`analyticsCache` come *stale*; ricalcolare (chiamata a `recalc_all`) **una sola volta**, in modo *debounced* (es. 2–5s dopo l'ultima mutazione) e in background, poi aggiornare lo stato. Evita ricalcoli a raffica durante editing intensivo.
- 4.B **Strategia "on-view"**: ricalcolare solo quando l'utente apre una vista che usa i KPI e il cache è marcato stale (lazy). Minimizza il carico se le dashboard sono poco visitate.
- 4.C Riuso: sfruttare `forceRecalculateAnalytics()` già esistente come primitiva; aggiungere solo il *trigger* (stale flag + debounce), non un nuovo endpoint.

### Gate di verifica (G4)
- [ ] Dopo una mutazione rilevante, i KPI/dashboard mostrano il valore aggiornato senza refresh e senza click manuale.
- [ ] Editing intensivo (N mutazioni ravvicinate) → **un solo** ricalcolo analytics (debounce verificato).
- [ ] Nessun ricalcolo analytics per mutazioni che non impattano i KPI.

### Test
- `context/UIConfigContext.test.tsx` (nuovo/esteso): flag stale + fake timers → `recalc_all` chiamato una sola volta dopo N mutazioni entro la finestra di debounce.
- Test di non-regressione: una mutazione non-KPI **non** chiama `recalc_all`.

---

## GOAL 5 — Guardrail di performance e percezione di velocità

**Obiettivo**: garantire, con criteri misurabili, che le modifiche non appesantiscano l'app né introducano lentezza percepita.

### Azioni
- 5.A Definire budget: refetch silent su focus ≤ 1 ogni 15–30s; nessun polling continuo di default; payload dei refetch mirati < payload bulk.
- 5.B Verificare in DevTools (Network) che, durante una sessione di lavoro tipo, non parta traffico mentre la scheda è attiva e ferma.
- 5.C Confermare assenza di spinner a schermo intero durante i refetch (solo indicatori locali già esistenti).
- 5.D Verificare che il throttle e il debounce impediscano raffiche di richieste.

### Gate di verifica (G5)
- [ ] Sessione di 5 minuti di sola lettura → 0 richieste extra (a scheda visibile e ferma).
- [ ] Rientro scheda → esattamente 1 refetch.
- [ ] Editing intensivo → refetch mirati/analytics entro i limiti di throttle/debounce.
- [ ] Nessuna comparsa di schermata di loading globale durante gli aggiornamenti in background.

### Test
- Manuali guidati (checklist DevTools sopra) + eventuali test unitari di throttle/debounce già coperti nei GOAL 1 e 4.

---

## GOAL 6 — Consolidamento, regressione e rollout

**Obiettivo**: chiudere il lavoro in sicurezza, con qualità verificata e possibilità di disattivazione rapida.

### Azioni
- 6.A Eseguire `npm run typecheck`, `npm run lint`, `npm test` — tutti verdi.
- 6.B (Opzionale) Racchiudere l'auto-refresh dietro un flag/config per attivarlo/disattivarlo senza deploy.
- 6.C Aggiornare la documentazione: `AI-Lessons.md` (decisione e trade-off) e, se presente, la nota architetturale.
- 6.D Commit atomici per GOAL; push su `claude/db-updates-visibility-ifeohx`; PR in draft.

### Gate di verifica (G6 — Definition of Done complessiva)
- [ ] `typecheck` + `lint` + `test` verdi in CI/locale.
- [ ] Tutti i gate G1–G5 soddisfatti.
- [ ] Il sintomo iniziale non è più riproducibile: nessuno scenario richiede refresh manuale per vedere dati inseriti/aggiornati.
- [ ] Interruttore di disattivazione documentato (se adottato 6.B).

---

## Matrice riepilogativa GOAL → sintomo risolto

| GOAL | Risolve | Approccio | Rischio traffico |
|---|---|---|---|
| 0 | (analisi) | — | nullo |
| 1 | modifiche da altri utenti/schede | 1 | molto basso (evento discreto + throttle) |
| 2 | divergenza post-mutazione con campi derivati | 2 | basso (refetch mirato) |
| 3 | percorsi che non aggiornano lo stato | 2a | basso |
| 4 | dashboard/KPI stantii | 2b | basso (debounce) |
| 5 | percezione lentezza / peso | trasversale | — |
| 6 | qualità e rollout | trasversale | — |

## Ordine di esecuzione consigliato
`GOAL 0 → GOAL 1 → GOAL 3 → GOAL 4 → GOAL 2 → GOAL 5 → GOAL 6`

(Il GOAL 1 dà da solo il beneficio maggiore con il minimo sforzo; il GOAL 2 è raffinamento e può seguire dopo aver chiuso i GAP strutturali dei GOAL 3–4.)
