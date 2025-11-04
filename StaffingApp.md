# Staffing Allocation Planner - Manuale Utente Dettagliato

Questo documento serve come guida completa e tecnica all'applicazione **Staffing Allocation Planner**. È progettato per fornire a utenti, amministratori e sviluppatori una comprensione approfondita di ogni funzionalità, calcolo e dettaglio dell'interfaccia.

## Indice

1.  [Introduzione](#1-introduzione)
2.  [Layout Generale e Navigazione](#2-layout-generale-e-navigazione)
    *   [Sidebar di Navigazione](#sidebar-di-navigazione)
    *   [Header di Pagina](#header-di-pagina)
3.  [Dashboard: Il Tuo Centro di Controllo](#3-dashboard-il-tuo-centro-di-controllo)
4.  [Pagine Operative](#4-pagine-operative)
    *   [4.1 Staffing](#41-staffing)
    *   [4.2 Carico Risorse](#42-carico-risorse)
5.  [Pagine di Analisi](#5-pagine-di-analisi)
    *   [5.1 Forecasting & Capacity](#51-forecasting--capacity)
    *   [5.2 Gantt Progetti](#52-gantt-progetti)
    *   [5.3 Report](#53-report)
    *   [5.4 Visualizzazione Staffing](#54-visualizzazione-staffing)
6.  [Gestione Anagrafiche (CRUD)](#6-gestione-anagrafiche)
    *   [6.1 Gestione Risorse](#61-gestione-risorse)
    *   [6.2 Gestione Progetti](#62-gestione-progetti)
    *   [6.3 Gestione Contratti](#63-gestione-contratti)
    *   [6.4 Gestione Clienti](#64-gestione-clienti)
    *   [6.5 Gestione Ruoli](#65-gestione-ruoli)
7.  [Modulo HR & Recruitment](#7-modulo-hr--recruitment)
    *   [7.1 Richiesta Risorse](#71-richiesta-risorse)
    *   [7.2 Gestione Colloqui](#72-gestione-colloqui)
8.  [Gestione Dati](#8-gestione-dati)
    *   [8.1 Esporta Dati](#81-esporta-dati)
    *   [8.2 Importa Dati](#82-importa-dati)
9.  [Amministrazione](#9-amministrazione)
    *   [9.1 Calendario](#91-calendario)
    *   [9.2 Config](#92-config)
    *   [9.3 Impostazioni Admin](#93-impostazioni-admin)
    *   [9.4 Database Inspector](#94-database-inspector)
10. [Autenticazione](#10-autenticazione)

---

## 1. Introduzione

Lo **Staffing Allocation Planner** è un'applicazione web completa per la pianificazione e il monitoraggio dell'allocazione delle risorse umane sui progetti aziendali. Permette di visualizzare chi sta lavorando su cosa, per quanto tempo, e di identificare rapidamente situazioni di sovraccarico o sottoutilizzo del personale.

L'applicazione è progettata con un approccio "data-driven", fornendo non solo strumenti operativi per la gestione quotidiana ma anche potenti cruscotti di analisi per il supporto decisionale strategico.

## 2. Layout Generale e Navigazione

L'interfaccia principale è divisa in due sezioni: una **Sidebar** di navigazione a sinistra e un'area di **contenuto principale** a destra, che include un **Header**.

### Sidebar di Navigazione

La sidebar, con sfondo scuro (`bg-gray-800`), è il principale strumento di navigazione.
*   **Comportamento:** È fissa su schermi desktop (da `md` in su) e si trasforma in un menu a scomparsa su dispositivi mobili, attivabile tramite il pulsante "hamburger" nell'header. Un backdrop scuro appare su mobile quando la sidebar è aperta per focalizzare l'attenzione.
*   **Struttura:**
    *   **Logo/Titolo:** In alto, mostra il titolo "Staffing App".
    *   **Link di Navigazione:** I link sono raggruppati per aree funzionali. Ogni link è composto da un'icona (emoji) e un'etichetta testuale.
        *   **Link Attivo:** Evidenziato con uno sfondo più scuro (`bg-gray-700`) e testo bianco.
        *   **Sezioni:**
            *   Principale: `🗓️ Staffing`, `👥 Carico Risorse`, `📊 Dashboard`, `📋 Richiesta Risorse`, `💬 Gestione Colloqui`, `ℹ️ Manuale Utente`.
            *   Analisi: `📈 Forecasting`, `📏 Gantt Progetti`, `📄 Report`, `🎨 Visualizzazione`.
            *   Gestione: `👥 Risorse`, `💼 Progetti`, `📜 Contratti`, `🏢 Clienti`, `🏷️ Ruoli`.
            *   Amministrazione: `📅 Calendario`, `⚙️ Config`.
            *   Dati: `📥 Esporta Dati`, `📤 Importa Dati`.
            *   Amministrazione (solo Admin): `⚙️ Impostazioni Admin`, `🔍 Database Inspector`.
    *   **Footer:** In basso, mostra il numero di versione dell'applicazione (`V600`) e il pulsante `🚪 Logout` (se l'autenticazione è attiva).

### Header di Pagina

L'header si trova sopra l'area del contenuto principale.
*   **Titolo Pagina:** Mostra dinamicamente il titolo della pagina corrente (es. "Gestione Risorse", "Dashboard"). Il titolo è determinato dal percorso URL.
*   **Pulsante Hamburger (`☰`):** Visibile solo su schermi mobili (`md` e inferiori), apre la sidebar.

## 3. Dashboard: Il Tuo Centro di Controllo

Questa è la pagina principale che fornisce una visione d'insieme dello stato dell'azienda.

*   **Scopo:** Offrire una panoramica immediata dei principali indicatori di performance (KPI) e delle aree che richiedono attenzione.
*   **Card KPI Aggregati:**
    *   **Budget Complessivo:** Somma totale dei budget di tutti i progetti.
        *   **Formula:** `SUM(project.budget)` per tutti i `project` nel database.
    *   **Costo Stimato (Mese Corrente):** Stima del costo totale del personale allocato per il mese in corso.
        *   **Formula:** `SUM( (alloc_percentage / 100) * resource_daily_cost )` per ogni giorno lavorativo del mese corrente, per ogni allocazione. Il `resource_daily_cost` è derivato dal ruolo della risorsa.
    *   **Giorni Allocati (Mese Corrente):** Totale dei giorni/uomo (person-days) allocati su tutti i progetti nel mese corrente.
        *   **Formula:** `SUM(alloc_percentage / 100)` per ogni giorno lavorativo del mese corrente, per ogni allocazione.
*   **Card di Attenzione Interattive:** Evidenziano aree critiche. Cliccando su una card si viene reindirizzati alla pagina corrispondente con i filtri pre-applicati. Sfondo ambrato (`bg-amber-100`).
    *   **Risorse Non Allocate:** Conta le risorse attive (`resigned = false`) che non hanno alcuna assegnazione. Mostra i nomi delle prime risorse non allocate.
    *   **Progetti Senza Staff:** Conta i progetti con stato "In corso" che non hanno alcuna risorsa assegnata. Mostra i nomi dei primi progetti.
*   **Tabelle di Analisi Dettagliata:** Ogni tabella ha filtri specifici e colonne ordinabili.
    *   **Allocazione Media:**
        *   **Dati:** Per ogni risorsa, mostra l'allocazione media percentuale nel mese corrente e nel mese successivo.
        *   **Formula:** `(SUM(giorni_uomo_allocati_nel_mese) / giorni_lavorativi_nel_mese) * 100`.
        *   **Colori:** `Rosso (>90%)`, `Giallo (>=70%)`, `Verde (<70%)`.
    *   **FTE per Progetto:**
        *   **Dati:** Per ogni progetto, calcola il *Full-Time Equivalent*.
        *   **Formula:** `FTE = total_person_days / total_working_days_in_project_duration`.
    *   **Analisi Budget:**
        *   **Dati:** Per ogni progetto, confronta Budget, Costo Stimato e Varianza.
        *   **Formula Costo Stimato:** `SUM( (alloc_percentage / 100) * resource_daily_cost )` per l'intera durata del progetto.
        *   **Formula Varianza:** `budget - costo_stimato`. La varianza negativa è mostrata in rosso.
    *   **Risorse Sottoutilizzate:**
        *   **Dati:** Elenca le risorse con utilizzo < 100% nel mese selezionato tramite un filtro `input type="month"`.
    *   **Altre Analisi:** Tabelle che aggregano sforzo e budget per Cliente, Horizontal e Sede, utili per analisi strategiche.

## 4. Pagine Operative

### 4.1 Staffing

Pagina per la pianificazione dettagliata delle allocazioni.

*   **Vista Principale:** Una griglia a due dimensioni con risorse/progetti sulle righe e il tempo sulle colonne. La prima colonna e l'intestazione sono fisse (`sticky`) per facilitare lo scrolling. La tabella utilizza la virtualizzazione per gestire un grande numero di righe in modo performante.
*   **Controlli:**
    *   **Navigazione Temporale:** Pulsanti `← Prec.`, `Oggi`, `Succ. →`.
    *   **Selettore Vista:** `Giorno`, `Settimana`, `Mese`.
    *   **Filtri:** Per `Risorsa`, `Cliente`, `Project Manager`, `Progetto` tramite `SearchableSelect`.
*   **Struttura Griglia:**
    *   **Master Row (Risorsa):** Riga in grassetto (`bg-gray-100 dark:bg-gray-900`). Mostra nome risorsa, ruolo, `maxStaffingPercentage` e un pulsante `➕` per aggiungere assegnazioni. Nelle colonne temporali, visualizza il carico totale.
    *   **Assignment Row (Progetto):** Riga per ogni progetto assegnato. Mostra nome progetto, cliente, PM e le azioni (`🗓️`, `❌`). Nelle colonne temporali, visualizza l'allocazione specifica per quel progetto.
*   **Calcoli e Logiche:**
    *   **Carico Totale Giornaliero (Vista Giorno):**
        *   **Formula:** `SUM(percentuale_allocazione)` di una risorsa su tutti i suoi progetti in un dato giorno.
        *   **Colori Cella:**
            *   `Rosso` (`bg-red-200`): `Totale > maxStaffingPercentage`
            *   `Verde` (`bg-green-200`): `Totale == maxStaffingPercentage`
            *   `Giallo` (`bg-yellow-200`): `0 < Totale < maxStaffingPercentage`
    *   **Carico Totale Aggregato (Viste Settimana/Mese):**
        *   **Formula:** `(SUM(giorni_uomo_allocati_nel_periodo) / giorni_lavorativi_nel_periodo) * 100`.
        *   I colori seguono la stessa logica, applicata alla media arrotondata.
*   **Interazioni:**
    *   **Modifica Allocazione (Vista Giorno):** `select` con valori da 0 a 100 (step 5).
    *   **Assegnazione Massiva (`🗓️`):** Modale con `Data Inizio`, `Data Fine` e `Percentuale` per applicare un'allocazione a un intervallo.
    *   **Rimuovi Assegnazione (`❌`):** Modale di conferma per eliminare l'assegnazione e tutte le relative allocazioni.

### 4.2 Carico Risorse

Vista semplificata e di **sola lettura** dello staffing, focalizzata sul carico totale.

*   **Scopo:** Monitorare il carico di lavoro individuale senza il rischio di modifiche.
*   **Vista Principale:** Simile alla pagina Staffing, ma mostra solo le "Master Row" delle risorse con il loro carico totale. Non ci sono righe per i singoli progetti né controlli per la modifica.
*   **Filtri:** Disponibili filtri per `Risorsa`, `Ruolo` (multi-selezione), `Progetto` e `Cliente` per isolare gruppi di risorse.

## 5. Pagine di Analisi

### 5.1 Forecasting & Capacity

Analisi previsionale del carico di lavoro e della capacità del team.

*   **Vista Principale:**
    *   Un **grafico a barre** che mostra l'andamento dell'utilizzo percentuale del team per i prossimi 12 mesi.
    *   Una **tabella dettagliata** che, per ogni mese, mostra: `G/U Disponibili`, `G/U Allocati`, `Utilizzo (%)`, e `Surplus/Deficit (G/U)`.
*   **Calcoli:**
    *   **G/U Disponibili:** `SUM(giorni_lavorativi_nel_mese)` per ogni risorsa attiva nel team (o nel sottoinsieme filtrato). I giorni lavorativi escludono weekend e festività.
    *   **G/U Allocati:** `SUM(alloc_percentage / 100)` per ogni giorno lavorativo del mese, per tutte le risorse nel team.
    *   **Utilizzo:** `(G/U Allocati / G/U Disponibili) * 100`.
    *   **Surplus/Deficit:** `G/U Disponibili - G/U Allocati`. Un valore negativo (in rosso) indica un deficit di capacità.
*   **Filtri:** Per `Horizontal`, `Cliente`, `Progetto`.

### 5.2 Gantt Progetti

Visualizzazione temporale dei progetti in stile Gantt.

*   **Vista Principale:** Una timeline orizzontale dove ogni riga rappresenta un progetto.
*   **Barra del Progetto:** Una barra colorata (`bg-blue-500`) rappresenta la durata di ogni progetto. La sua posizione e larghezza sono calcolate dinamicamente.
    *   **Formula Posizione:** `left = ((project.startDate - ganttStartDate) / (1000 * 3600 * 24)) * pixelsPerDay`
    *   **Formula Larghezza:** `width = ((project.endDate - project.startDate) / (1000 * 3600 * 24)) * pixelsPerDay`
*   **Interazioni:**
    *   **Espansione:** Cliccando sulla freccia accanto al nome del progetto, la riga si espande per mostrare l'elenco delle risorse assegnate.
    *   **Zoom:** Pulsanti per cambiare la scala temporale (`Mese`, `Trim.`, `Anno`).
    *   **Indicatore "Oggi":** Una linea verticale rossa indica la data corrente sulla timeline.
*   **Filtri:** Per `Nome Progetto` e `Cliente`.

### 5.3 Report

Generazione di report tabellari esportabili in **CSV**.

*   **Interfaccia:** Due tab: "Report Costi Progetto" e "Report Utilizzo Risorse".
*   **Report Costi Progetto:**
    *   **Dati:** Per ogni progetto, confronta Budget, Costo Allocato Stimato, Varianza, Giorni/Uomo totali, e Costo Medio per G/U.
    *   **Filtri:** Per `Cliente` e `Stato Progetto`.
*   **Report Utilizzo Risorse:**
    *   **Dati:** Per un mese selezionato, mostra per ogni risorsa i G/U disponibili, G/U allocati, Utilizzo % e Costo Allocato.
    *   **Filtri:** Per `Mese`, `Ruolo`, `Horizontal`.

### 5.4 Visualizzazione Staffing

Visualizzazioni grafiche avanzate per esplorare le relazioni tra i dati.

*   **Controlli:** Selettore del `Mese` di analisi, selettore della `Vista` (`Diagramma di Flusso` o `Mappa delle Connessioni`), pulsanti di export `SVG`/`PNG`.
*   **Diagramma di Flusso (Sankey):**
    *   **Scopo:** Mostra come lo "sforzo" (in giorni/uomo) fluisce attraverso le diverse entità.
    *   **Struttura:** Quattro colonne di nodi: Risorse → Progetti → Clienti → Contratti. Lo spessore dei flussi è proporzionale al valore dei giorni/uomo.
*   **Mappa delle Connessioni (Network):**
    *   **Scopo:** Visualizza le entità come nodi e le loro relazioni come linee. Utile per vedere le connessioni tra le risorse.
    *   **Interattività:** Il grafico è zoomabile e "trascinabile". I nodi possono essere spostati.

## 6. Gestione Anagrafiche (CRUD)

Pagine dedicate al Create, Read, Update, Delete (CRUD) delle entità principali.

### Operazioni Standard (CRUD)

*   **Creazione:** Usa il pulsante "Aggiungi..." per aprire un modulo dettagliato per inserire un nuovo record.
*   **Modifica:** Ogni riga ha due icone a forma di matita (`✏️`). La prima apre il modulo di modifica completo. La seconda (dove presente) attiva la "modifica rapida", trasformando la riga in un form per aggiornamenti veloci.
*   **Eliminazione (`🗑️`):** Rimuove un record. Una finestra di dialogo chiederà sempre una conferma.
*   **Filtri e Ordinamento:** Usa i filtri in cima alla tabella per cercare i record e clicca sulle intestazioni delle colonne per ordinarli.
*   **Intestazioni Fisse e Colonne Ridimensionabili:** Per facilitare la consultazione di tabelle con molti dati, la riga di intestazione rimane sempre visibile durante lo scorrimento verticale. Inoltre, è possibile ridimensionare la larghezza di ogni colonna posizionando il mouse sul bordo destro dell'intestazione e trascinando.

### Specifiche delle Entità

*   **Risorse:** Oltre ai dati anagrafici, qui definisci la `maxStaffingPercentage` (la percentuale massima di allocazione, es. 80% per un part-time) e gestisci le dimissioni (flaggando `resigned` e inserendo l'ultimo giorno di lavoro).
*   **Progetti:** Definisci la `realizationPercentage`, una percentuale che rettifica il calcolo dei costi stimati. Qui puoi anche collegare un progetto a un **Contratto**.
*   **Contratti:** Un'entità che raggruppa più progetti sotto un unico cappello finanziario. La `Capienza` è l'importo totale del contratto, mentre il `Backlog` è la capienza residua, calcolata sottraendo i budget dei progetti collegati. Puoi forzare il ricalcolo del backlog con l'icona `🔄`.

## 7. Modulo HR & Recruitment

### 7.1 Richiesta Risorse

*   **Vista:** Selettore per visualizzazione a `Tabella` o a `Card`.
*   **Card Riassuntive:** Riepilogo FTE totali richiesti (per ruolo) e dettaglio richieste per progetto.
*   **Form di Creazione/Modifica:**
    *   **Campi:** Progetto, Ruolo, Richiedente, Periodo, % Impegno (slider), flag `Urgente` e `TECH`, Stato, Note.
    *   **Campo Calcolato:** `isLongTerm` viene calcolato automaticamente se la durata della richiesta è > 60 giorni.

### 7.2 Gestione Colloqui

*   **Vista:** Selettore per visualizzazione a `Tabella` o a `Card`.
*   **Card Riassuntive Interattive:** Mostrano totali per `Candidati Attivi`, `Feedback Positivi`, `Prossimi Ingressi` e agiscono da filtri rapidi.
*   **Form di Creazione/Modifica:**
    *   **Campi:** Dati anagrafici candidato, Richiesta di riferimento, Horizontal, Ruolo, Riassunto CV, Intervistatori (multi-selezione), Data colloquio, Feedback, Note, Stato Assunzione, Data Ingresso, Stato Processo.

## 8. Gestione Dati

### 8.1 Esporta Dati

*   **Interfaccia:** Una pagina con diverse card, una per ogni tipo di esportazione.
*   **Tipi di Export:**
    *   **Entità Principali:** File Excel con fogli separati per Risorse, Progetti, Clienti, Ruoli, Calendario e tutte le opzioni di configurazione.
    *   **Staffing:** File Excel con un singolo foglio che rappresenta la griglia delle allocazioni, ottimizzato per la re-importazione.
    *   **Richieste Risorse:** Elenco completo delle richieste.
    *   **Colloqui:** Elenco completo dei colloqui.

### 8.2 Importa Dati

*   **Procedura Guidata:**
    1.  **Selezione Tipo:** Scegli quale tipo di dati importare.
    2.  **Download Template:** Scarica il template Excel corretto per il tipo di dati scelto. **È obbligatorio usare questo template.**
    3.  **Carica e Importa:** Seleziona il file compilato e avvia l'importazione.
*   **Logica di Importazione:** Il backend gestisce la validazione dei dati, evita la creazione di duplicati (basandosi su nomi o email unici) e restituisce un messaggio di successo con eventuali avvisi (es. "Risorsa 'X' già esistente, saltata.").

## 9. Amministrazione

### 9.1 Calendario

*   **Scopo:** Definire i giorni non lavorativi.
*   **Funzionalità:** CRUD completo per gli eventi di calendario.
*   **Tipi di Evento:**
    *   `Festività Nazionale`: Si applica a tutte le sedi.
    *   `Chiusura Aziendale`: Si applica a tutte le sedi.
    *   `Festività Locale`: Si applica solo alla sede specificata.

### 9.2 Config

*   **Scopo:** Personalizzare le opzioni dei menu a tendina dell'applicazione.
*   **Interfaccia:** Una sezione per ogni tipo di configurazione (`Horizontals`, `Livelli Seniority`, `Stati Progetto`, `Settori Clienti`, `Sedi di Lavoro`).
*   **Funzionalità:** CRUD completo per le opzioni di ogni lista.

### 9.3 Impostazioni Admin

*   **Protezione con Password:** Un interruttore (toggle) per attivare/disattivare l'obbligo di login per accedere all'applicazione.
*   **Personalizzazione Tema:** Un editor che permette di modificare ogni colore utilizzato nell'applicazione, sia per il tema chiaro che per quello scuro. Le modifiche vengono salvate nel `localStorage` del browser e applicate tramite variabili CSS. È possibile ripristinare il tema di default.

### 9.4 Database Inspector

*   **ATTENZIONE:** Questo è uno strumento per sviluppatori. Un uso improprio può causare la perdita di dati.
*   **Funzionalità:**
    *   **Visualizzazione:** Seleziona una qualsiasi tabella del database da un menu a tendina per visualizzarne il contenuto grezzo.
    *   **Modifica Inline:** Cliccando l'icona `✏️`, una riga diventa modificabile.
    *   **Svuota Tabella:** Un pulsante `Svuota` (con modale di conferma) permette di eliminare tutte le righe da una tabella (`TRUNCATE`).
    *   **Export SQL:** Pulsanti per generare e scaricare un file `.sql` contenente lo schema completo (CREATE TABLE) e i dati (INSERT) dell'intero database, formattato per **PostgreSQL (Neon)** o **MySQL**.

## 10. Autenticazione

### Pagina di Login

*   **Scopo:** Proteggere l'accesso all'applicazione quando la "Protezione con Password" è attiva.
*   **Comportamento:**
    *   Se la protezione è **disattivata**, la pagina è comunque accessibile ma mostra un avviso e permette l'accesso per diventare admin.
    *   Se la protezione è **attivata**, l'accesso è obbligatorio.
*   **Credenziali:** L'applicazione supporta due livelli di accesso tramite password definite nelle variabili d'ambiente del server:
    *   **Password Utente:** Fornisce accesso standard.
    *   **Password Admin:** Fornisce accesso a tutte le pagine, incluse quelle di Amministrazione.
*   **Sessione:** Dopo un login corretto, lo stato di autenticazione viene salvato nel `sessionStorage` del browser, mantenendo l'utente loggato finché la scheda non viene chiusa.