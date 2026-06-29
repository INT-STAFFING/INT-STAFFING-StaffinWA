# 01 — Personas

> Validazione della progettazione — Staffing Allocation Planner
> Approccio: personas **comportamentali**, non demografiche. Ogni persona è
> ancorata a un ruolo reale del modello RBAC (`UserRole` in `types.ts`) e ai
> flussi effettivamente presenti nel codice. Niente stereotipi: ogni scheda
> dichiara *job-to-be-done*, comportamenti osservabili, trigger, frequenza
> d'uso, metrica di successo e attriti attuali.

## Mappa Persona ↔ Ruolo RBAC ↔ Pagine principali

| Persona | Ruolo `UserRole` | Pagine primarie | Frequenza |
|---|---|---|---|
| Giulia — Resource/Staffing Manager | `MANAGER` | Staffing, Carico Risorse, Richieste Risorse | Più volte/giorno |
| Marco — Delivery / Associate Director | `ASSOCIATE DIRECTOR` / `SENIOR MANAGER` | Forecasting, Gantt, Dashboard, Revenue, Simulazioni | Settimanale |
| Elena — HR & Recruiting | `MANAGER` (scope HR) | Richieste Risorse, Colloqui, Risorse, Assenze | Giornaliera |
| Davide — Consulente / Dipendente | `SIMPLE` / `SIMPLE_EXT` | Carico Risorse (self), Assenze, Competenze, Certificazioni | Settimanale |
| Sara — System Admin / IT | `ADMIN` | Security Center, Config, Import/Export, DB Inspector, Webhooks | A picchi |
| Luca — Managing Director (Exec) | `MANAGING DIRECTOR` | Dashboard, Revenue, Report, Forecasting | Settimanale/mensile |

---

## P1 — Giulia, Resource/Staffing Manager  *(persona primaria)*

- **Ruolo RBAC:** `MANAGER` — accesso in scrittura allo staffing del proprio perimetro.
- **Contesto:** gestisce l'allocazione di 25–60 consulenti su 10–20 progetti
  attivi in parallelo. È la utente che apre l'app per prima al mattino.
- **Job-to-be-done:** *"Quando un progetto cambia scope o entra una nuova
  richiesta, voglio ri-bilanciare le allocazioni in pochi minuti senza creare
  sovra-allocazioni, così da rispettare le scadenze senza bruciare le persone."*
- **Comportamenti osservabili (dal codice):**
  - Usa la **griglia Staffing** (`StaffingPage` + `VirtualStaffingGrid`) in vista
    Giorno/Settimana/Mese; sfrutta l'assegnazione massiva (`🗓️`) per intervalli.
  - Legge i colori della cella (rosso = oltre `maxStaffingPercentage`) come
    semaforo di sovraccarico.
  - Filtra per Risorsa / Cliente / PM / Progetto via `SearchableSelect`.
  - Salta su **Carico Risorse** per la lettura veloce del totale per persona.
- **Trigger:** nuova Richiesta Risorse `ATTIVA`, slittamento progetto, rientro/uscita persona.
- **Metrica di successo:** zero risorse in rosso non intenzionale; tempo di
  ri-allocazione < 5 min; nessun progetto "In corso" senza staff.
- **Attriti attuali (ipotesi da validare):**
  - L'editing è a step del 5% via `select`: lento per ribilanciamenti su molte celle.
  - Nessuna vista "undo" dopo un'assegnazione massiva errata.
  - Sovra-allocazione segnalata col colore ma **non bloccata né spiegata** (di chi è il conflitto?).
- **Frase tipica:** *"Chi posso spostare da X senza mandarlo in rosso la settimana prossima?"*

---

## P2 — Marco, Delivery Lead / Associate Director

- **Ruolo RBAC:** `ASSOCIATE DIRECTOR` (o `SENIOR MANAGER`).
- **Contesto:** responsabile di un portafoglio di progetti; risponde di margine,
  capacità e rispetto del budget. Non edita celle, **interpreta trend**.
- **Job-to-be-done:** *"Voglio capire con 1–3 mesi di anticipo dove avrò deficit
  o surplus di capacità e quali progetti stanno erodendo il margine, per
  decidere assunzioni, rotazioni o escalation."*
- **Comportamenti osservabili:**
  - **Forecasting & Capacity** (12 mesi): legge Utilizzo% e Surplus/Deficit G/U.
  - **Dashboard**: Analisi Budget (Budget vs Costo Stimato vs Varianza), FTE per progetto.
  - **Gantt**: sovrapposizioni temporali e "buchi".
  - **Revenue & Invoicing** e **Simulazioni**: scenari what-if prima di impegnarsi.
- **Trigger:** revisione mensile di portfolio, richiesta del MD, varianza budget negativa.
- **Metrica di successo:** previsione di capacità affidabile; varianza di margine
  intercettata prima della fine progetto.
- **Attriti attuali:**
  - Il forecast assume `maxStaffingPercentage` come capacità ma **le assenze
    approvate** (`leaves`) potrebbero non essere scalate in modo evidente dalla capacità.
  - Manca un collegamento diretto "deficit di capacità → genera Richiesta Risorsa".
- **Frase tipica:** *"Questo deficit di luglio è reale o è perché non ho ancora staffato la pipeline?"*

---

## P3 — Elena, HR & Recruiting Specialist

- **Ruolo RBAC:** `MANAGER` con visibilità sulle entità HR (`resource_requests`, `interviews`, `resources`, `leaves`).
- **Contesto:** trasforma le richieste di staffing non coperte internamente in
  assunzioni; gestisce la pipeline candidati.
- **Job-to-be-done:** *"Voglio passare da una Richiesta Risorsa aperta a un
  candidato assunto tracciando ogni colloquio e feedback, senza perdere lo
  stato di nessuna pratica."*
- **Comportamenti osservabili:**
  - **Richieste Risorse** (tabella/card): FTE richiesti per ruolo, urgenza, `isLongTerm` (>60gg, calcolato).
  - **Colloqui**: card riassuntive interattive (Candidati attivi, Feedback positivi, Prossimi ingressi) usate come filtri rapidi.
  - Collega colloquio → richiesta (vincolo `interviews → resource_requests`).
- **Trigger:** richiesta `ATTIVA` non staffabile internamente; feedback colloquio; data ingresso.
- **Metrica di successo:** time-to-fill ridotto; nessuna richiesta "orfana"; ingressi pianificati visibili allo staffing.
- **Attriti attuali:**
  - Il passaggio **candidato assunto → Risorsa anagrafica → disponibile in Staffing** non è un flusso guidato esplicito.
  - Stato richiesta e stato pipeline colloqui vivono in due pagine separate: rischio disallineamento.
- **Frase tipica:** *"Questa richiesta è ancora aperta o l'abbiamo già coperta con l'ingresso di lunedì?"*

---

## P4 — Davide, Consulente / Dipendente  *(self-service, persona meno coperta)*

- **Ruolo RBAC:** `SIMPLE` / `SIMPLE_EXT` — sola lettura sui propri dati, scrittura limitata (assenze, competenze).
- **Contesto:** non pianifica nessuno; usa l'app **per sé**. È l'utente più
  numeroso e quello con la minor frequenza → ogni interazione deve essere ovvia.
- **Job-to-be-done:** *"Voglio vedere su cosa sono allocato, chiedere ferie e
  tenere aggiornate competenze/certificazioni in meno di 2 minuti, senza dover
  imparare uno strumento da pianificatore."*
- **Comportamenti osservabili:**
  - **Carico Risorse** filtrato sulla propria persona (read-only).
  - **Assenze**: crea una `LeaveRequest` (stato `PENDING` → `APPROVED/REJECTED`), vede i giorni lavorativi calcolati.
  - **Competenze / Certificazioni**: aggiorna il proprio profilo skill (livello 1–5).
- **Trigger:** pianificazione ferie, richiesta del manager di aggiornare lo skill profile, curiosità sul proprio carico.
- **Metrica di successo:** richiesta ferie inviata senza errori al primo tentativo; sa a chi è andata in approvazione.
- **Attriti attuali (verificati nel codice):**
  - La navigazione è pensata per pianificatori: **38 voci di menu** sono opprimenti per chi ha accesso a 4 pagine.
  - Gli **stati vuoti** erano ambigui: `DataTable` (condiviso) mostra già un `EmptyState`, ma lo stesso messaggio ("…con i filtri o i criteri correnti") copriva sia "nessun dato ancora" sia "nessun risultato dai filtri" → un dipendente senza assenze pensava fosse rotto. *(corretto, vedi audit R-D3)*
  - Non è chiaro **chi approva** una richiesta di assenza dal punto di vista del dipendente.
- **Frase tipica:** *"Ho mandato la richiesta… e adesso? Chi la deve approvare?"*

---

## P5 — Sara, System Admin / IT

- **Ruolo RBAC:** `ADMIN` — bypassa ogni controllo; configura il sistema.
- **Contesto:** governa accessi (RBAC a 3 livelli), opzioni, import/export massivi e integrità dati.
- **Job-to-be-done:** *"Voglio configurare con sicurezza chi vede e fa cosa, e
  caricare/migrare dati in blocco senza corrompere lo stato, con un audit di ciò
  che è stato cambiato."*
- **Comportamenti osservabili:**
  - **Security Center**: pillar Identity, RBAC, Entity Visibility, Hierarchy, Navigation, Audit.
  - **Import** guidato (template obbligatorio, dedup su nomi/email), **Export** Excel/SQL.
  - **DB Inspector**: vista grezza, edit inline, `TRUNCATE`, export schema+dati.
  - **Webhooks / Notifiche**: integrazioni in uscita.
- **Trigger:** onboarding nuovo reparto, cambio policy, richiesta migrazione, incidente dati.
- **Metrica di successo:** zero accessi non autorizzati; import senza duplicati; rollback possibile.
- **Attriti attuali:**
  - **DB Inspector** con `TRUNCATE` ed edit inline è uno strumento ad alto rischio: serve frizione/audit robusti.
  - L'effetto di un cambio RBAC su un utente loggato (sessioni esistenti) non è ovvio.
- **Frase tipica:** *"Se tolgo la visibilità su `projects` a questo ruolo, cosa succede a chi è già loggato?"*

---

## P6 — Luca, Managing Director (Executive)  *(persona secondaria, read-mostly)*

- **Ruolo RBAC:** `MANAGING DIRECTOR`.
- **Contesto:** non opera nel dettaglio; vuole numeri sintetici e affidabili per decisioni e board.
- **Job-to-be-done:** *"In 60 secondi voglio sapere se utilizzo, margine e
  pipeline sono in salute, e dove sono i rischi."*
- **Comportamenti osservabili:** Dashboard (KPI aggregati), Revenue, Report esportabili (CSV/PDF), Forecasting a colpo d'occhio.
- **Metrica di successo:** un'unica fonte di verità coerente con quanto riportano Marco/Giulia.
- **Attriti attuali:** rischio di **numeri divergenti** tra Dashboard, Report e Revenue se le formule non sono allineate (vedi audit, asse Coerenza).
- **Frase tipica:** *"Perché il margine in Dashboard non coincide con quello del Report?"*

---

### Anti-personas (chi NON serviamo, per evitare scope creep)
- Il **cliente finale** del progetto: non ha accesso, non è un utente.
- Il **candidato** in colloquio: è un *dato* gestito da Elena, non un utente del sistema.
- L'**utente mobile-first sul campo**: esiste una BottomNav, ma l'app resta desktop-first per i flussi di pianificazione.
