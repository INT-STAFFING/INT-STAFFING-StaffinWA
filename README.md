# Staffing Allocation Planner

Un'applicazione web completa per la pianificazione e il monitoraggio dell'allocazione delle risorse umane sui progetti aziendali. Permette di visualizzare chi sta lavorando su cosa, per quanto tempo, e di identificare rapidamente situazioni di sovraccarico o sottoutilizzo del personale.

## ✨ Funzionalità Principali

- **Griglia di Staffing Interattiva**: Assegna risorse ai progetti e definisci le percentuali di allocazione giornaliere. Visualizza il carico di lavoro per giorno, settimana o mese.
- **Gestione Entità (CRUD)**: Gestione completa con modifica rapida e form dettagliati per:
    - **Risorse**: Dipendenti, con dettagli su ruolo, sede, seniority e percentuale massima di allocazione.
    - **Progetti**: Dettagli su cliente, budget, date, stato e project manager.
    - **Clienti**: Anagrafica dei clienti.
    - **Ruoli**: Definizione dei ruoli professionali e dei relativi costi.
- **Dashboard Analitica**: Visualizza KPI aggregati su budget, costi, sforzo (giorni/uomo), FTE e utilizzo delle risorse con filtri dinamici.
- **Report Avanzati**:
    - Analisi dei costi per progetto (Budget vs. Costi Allocati).
    - Report sull'utilizzo delle risorse per periodo e filtri.
- **Forecasting & Capacity**: Analisi previsionale del carico di lavoro e della capacità del team su un orizzonte di 12 mesi.
- **Carico Risorse**: Una vista focalizzata sul carico di lavoro totale di ogni risorsa, per identificare facilmente sovraccarichi.
- **Gestione Incarichi (WBS)**: Modulo per la gestione dettagliata degli incarichi professionali e del loro stato economico.
- **Gantt Progetti**: Visualizzazione temporale dei progetti in stile Gantt per monitorare le tempistiche.
- **Import/Export Dati**: Funzionalità per esportare tutti i dati in Excel e importare massivamente da un template predefinito.
- **Configurabilità**: Gestione centralizzata delle opzioni utilizzate nell'applicazione (es. sedi, livelli di seniority, stati progetto).

## 🚀 Stack Tecnologico

- **Frontend**:
    - **React 18**
    - **TypeScript**
    - **Tailwind CSS** per lo styling
    - **React Router** per la navigazione
- **Backend**:
    - **Vercel Serverless Functions** (Node.js) per le API
- **Database**:
    - **Vercel Postgres**

## 📁 Struttura del Progetto

```
/
├── api/                # Endpoint delle Vercel Serverless Functions
├── components/         # Componenti React riutilizzabili (Modal, DataTable, etc.)
├── context/            # Contesti React per la gestione dello stato globale
├── pages/              # Componenti React che rappresentano le pagine dell'applicazione
├── scripts/            # Script di utility (es. seed del database)
├── utils/              # Funzioni di utilità (date, export, etc.)
├── index.html          # Entry point HTML
└── index.tsx           # Entry point dell'applicazione React
```

## 🏁 Guida Introduttiva

Segui questi passaggi per avviare il progetto in locale.

### Prerequisiti

- [Node.js](https://nodejs.org/) (versione 18 o superiore)
- [npm](https://www.npmjs.com/) (o un altro package manager come yarn o pnpm)
- Un database Vercel Postgres (o un qualsiasi database PostgreSQL accessibile tramite una connection string).

### Installazione

1.  **Clona il repository** (se applicabile) o scarica i file del progetto.

2.  **Installa le dipendenze**:
    Apri un terminale nella cartella principale del progetto e lancia il comando:
    ```bash
    npm install
    ```

3.  **Configura le variabili d'ambiente**:
    Crea un nuovo file nella cartella principale chiamato `.env.development.local`. Copia il contenuto del file `.env.example` e inserisci la tua stringa di connessione al database.

    ```.env.development.local
    # Ottieni questa stringa dalle impostazioni del tuo progetto Vercel
    POSTGRES_URL="postgres://..."
    ```

4.  **Inizializza il database**:
    Questo comando creerà le tabelle necessarie e le popolerà con dati di esempio.
    ```bash
    npm run seed
    ```
    _Nota: Lo script è idempotente. Puoi eseguirlo più volte senza causare errori, ma i dati esistenti non verranno duplicati._

5.  **Avvia il server di sviluppo**:
    ```bash
    npm run dev
    ```
    L'applicazione sarà ora accessibile all'indirizzo `http://localhost:5173` (o un'altra porta indicata dal terminale).

## 📜 Script Disponibili

- `npm run dev`: Avvia il server di sviluppo Vite con hot-reloading.
- `npm run build`: Compila l'applicazione TypeScript e la builda per la produzione.
- `npm run seed`: Esegue lo script per creare lo schema del database e inserire i dati di esempio.
- `npm run lint`: Esegue ESLint per analizzare il codice e trovare potenziali problemi.
