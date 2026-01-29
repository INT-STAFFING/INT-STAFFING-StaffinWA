
import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-12">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6 pb-3 border-b-2 border-primary/30 dark:border-primary/50">{title}</h2>
        <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-6">
            {children}
        </div>
    </section>
);

const SubSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
     <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-3">{title}</h3>
        <div className="prose dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 space-y-4">
             {children}
        </div>
    </div>
);

const FormulaBox: React.FC<{ title: string; formula: string; description: React.ReactNode }> = ({ title, formula, description }) => (
    <div className="bg-surface-container-low border border-outline-variant rounded-lg p-4 my-4">
        <h4 className="font-bold text-primary mb-2">{title}</h4>
        <div className="font-mono bg-surface-container p-2 rounded text-sm mb-3 border border-outline-variant overflow-x-auto">
            {formula}
        </div>
        <div className="text-sm text-on-surface-variant">
            {description}
        </div>
    </div>
);


const UserManualPage: React.FC = () => {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 md:p-12">
            <header className="text-center mb-16">
                <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">Manuale Funzionale</h1>
                <p className="text-xl text-gray-500 dark:text-gray-400">Applicazione di Staffing (V1.3)</p>
            </header>
            
            <Section title="1. Introduzione">
                <p>L'Applicazione di Staffing è uno strumento per pianificare e monitorare l'allocazione delle risorse umane sui progetti aziendali. Permette di visualizzare chi sta lavorando su cosa, per quanto tempo, e di identificare rapidamente situazioni di sovraccarico o sottoutilizzo del personale.</p>
                <p>La piattaforma integra funzionalità operative per la gestione quotidiana (staffing, anagrafiche) con strumenti di controllo di gestione (forecasting, analisi costi) e sviluppo del capitale umano (competenze, certificazioni).</p>
            </Section>

            <Section title="2. Dashboard & KPI">
                <p>La Dashboard è il punto di ingresso che aggrega i dati in tempo reale per fornire una visione d'insieme immediata dello stato aziendale.</p>
                
                <SubSection title="Indicatori Chiave">
                    <FormulaBox 
                        title="Budget Complessivo" 
                        formula="Σ (Budget di tutti i progetti attivi o pianificati)"
                        description="Valore totale del portafoglio progetti censito a sistema."
                    />
                    <FormulaBox 
                        title="Costo Stimato (Mese Corrente)" 
                        formula="Σ [(Allocazione% / 100) * CostoRuoloStorico(Data) * %Realizzazione]"
                        description="Costo del personale allocato nel mese corrente, calcolato in base al costo giornaliero storico del ruolo ricoperto."
                    />
                    <FormulaBox 
                        title="Giorni Allocati (Mese Corrente)" 
                        formula="Σ (Allocazione% / 100) su tutti i giorni lavorativi del mese"
                        description="Totale dei giorni/uomo (Person-Days) pianificati nel mese corrente."
                    />
                </SubSection>

                <SubSection title="Card di Attenzione">
                    <p>Il sistema evidenzia automaticamente le criticità:</p>
                    <ul>
                        <li><strong>Risorse Non Allocate:</strong> Risorse attive senza alcuna assegnazione progettuale.</li>
                        <li><strong>Progetti Senza Staff:</strong> Progetti aperti ("In corso") privi di team assegnato.</li>
                        <li><strong>FTE Non Allocati:</strong> Capacità produttiva inutilizzata nel mese corrente.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="3. Gestione Staffing">
                <p>Il cuore operativo dell'applicazione è la pagina di <strong>Staffing</strong>, che offre una vista a matrice (Risorse x Tempo).</p>
                
                <SubSection title="Funzionalità Principali">
                    <ul>
                        <li><strong>Allocazione:</strong> Assegnazione di una risorsa a un progetto con una percentuale di impegno giornaliero.</li>
                        <li><strong>Visualizzazione Temporale:</strong> Viste configurabili per Giorno, Settimana o Mese.</li>
                        <li><strong>Validazione Capacità:</strong> Il sistema segnala (in rosso) se una risorsa supera la sua capacità massima (es. &gt;100%).</li>
                        <li><strong>Assenze:</strong> I giorni di ferie o malattia approvati vengono visualizzati in sola lettura e bloccati per impedire la pianificazione.</li>
                    </ul>
                </SubSection>
            </Section>

            <Section title="4. Forecasting & Capacità">
                <p>Lo strumento di <strong>Forecasting</strong> permette di analizzare il carico di lavoro futuro (fino a 12 mesi) confrontando la domanda (allocazioni) con l'offerta (capacità delle risorse).</p>
                
                <SubSection title="Modalità di Calcolo">
                    <ul>
                        <li><strong>Dati Consuntivi:</strong> Per i periodi con allocazioni puntuali, il sistema usa i dati inseriti.</li>
                        <li><strong>Proiezioni (Algoritmo Predittivo):</strong> Per i mesi futuri senza dettaglio giornaliero, il sistema proietta il carico basandosi sulla media storica delle allocazioni attive ("run-rate").</li>
                    </ul>
                    <FormulaBox 
                        title="Utilizzo Previsto" 
                        formula="(Giorni Allocati + Giorni Proiettati) / Giorni Disponibili * 100"
                        description="Indica la percentuale di saturazione del team nel periodo futuro."
                    />
                </SubSection>
            </Section>

            <Section title="5. Gestione Risorse Umane">
                <p>L'applicazione include moduli dedicati alla gestione del ciclo di vita delle risorse.</p>

                <SubSection title="Competenze (Skills Matrix)">
                    <p>Mappatura delle competenze tecniche e funzionali. Il sistema supporta:</p>
                    <ul>
                        <li><strong>Competenze Manuali:</strong> Inserite manualmente o tramite certificazioni.</li>
                        <li><strong>Competenze Inferite:</strong> Calcolate automaticamente in base ai progetti su cui la risorsa ha lavorato.</li>
                        <li><strong>Analisi Grafica:</strong> Visualizzazioni avanzate (Network, Heatmap, Radar) per esplorare la distribuzione delle competenze in azienda.</li>
                    </ul>
                </SubSection>

                <SubSection title="Assenze">
                    <p>Gestione del workflow di richiesta e approvazione ferie/permessi. Le assenze approvate riducono automaticamente la capacità disponibile nel calcolo del forecasting.</p>
                </SubSection>

                <SubSection title="Recruitment">
                    <p>Tracciamento delle <strong>Richieste di Risorse</strong> aperte sui progetti e gestione dell'iter di selezione (<strong>Colloqui</strong>) fino all'assunzione.</p>
                </SubSection>
            </Section>

            <Section title="6. Amministrazione">
                <p>Gli amministratori hanno accesso a funzionalità di configurazione avanzata.</p>
                <ul>
                    <li><strong>Anagrafiche:</strong> Gestione centralizzata di Clienti, Progetti, Ruoli e Contratti.</li>
                    <li><strong>Configurazione:</strong> Personalizzazione di liste valori (es. Sedi, Livelli Seniority, Stati Progetto).</li>
                    <li><strong>Sicurezza:</strong> Gestione Utenti, Ruoli e Permessi (RBAC).</li>
                    <li><strong>Import/Export:</strong> Strumenti per l'importazione massiva dei dati e l'esportazione in formato Excel o SQL.</li>
                </ul>
            </Section>

            <Section title="7. Gestione Listini (Rate Cards)">
                <p>La pagina <strong>Listini (Rate Cards)</strong> permette di definire le tariffe di vendita giornaliere per ogni risorsa, fondamentali per il calcolo dei ricavi nei progetti <em>Time & Material</em>.</p>
                
                <SubSection title="Struttura Master-Detail">
                    <p>L'interfaccia è divisa in due pannelli:</p>
                    <ul>
                        <li><strong>Sinistra (Listini):</strong> Elenco dei listini attivi (es. "Listino Standard 2024", "Listino Cliente X"). Qui puoi creare, rinominare o eliminare un intero listino.</li>
                        <li><strong>Destra (Tariffe):</strong> Tabella di dettaglio che mostra tutte le risorse attive. Per ogni risorsa è possibile definire una tariffa specifica (<em>Sell Rate</em>) per il listino selezionato.</li>
                    </ul>
                </SubSection>

                <SubSection title="Funzionalità di Inizializzazione">
                    <p>Per velocizzare la compilazione, il pulsante <strong>Inizializza</strong> applica una regola automatica a tutte le risorse visualizzate:</p>
                    <FormulaBox 
                        title="Calcolo Automatico Tariffa" 
                        formula="Sell Rate = Costo Interno Risorsa * 1.20"
                        description="Applica un markup standard del 20% sul costo interno della risorsa (o del suo ruolo) per generare una proposta di tariffa di vendita."
                    />
                    <p>È sempre possibile modificare manualmente le singole tariffe dopo l'inizializzazione prima di salvare.</p>
                </SubSection>
            </Section>

            <Section title="8. Modulo Simulazioni (Scenario Planning)">
                <p>La pagina <strong>Simulazioni</strong> è un ambiente "Sandbox" (isolato) dove è possibile creare scenari alternativi di staffing e budget senza intaccare i dati reali di produzione.</p>

                <SubSection title="Creazione di uno Scenario">
                    <ul>
                        <li><strong>Importa Dati Reali:</strong> Copia l'attuale stato di risorse, progetti e allocazioni nella simulazione come punto di partenza.</li>
                        <li><strong>Risorse Ghost:</strong> Puoi creare risorse simulate (es. "Java Dev Senior 1") per testare l'impatto di nuove assunzioni sul budget e sulla capacità produttiva.</li>
                    </ul>
                </SubSection>

                <SubSection title="Configurazione Scenario">
                    <p>Nel tab <em>Configurazione</em> puoi:</p>
                    <ul>
                        <li>Modificare i <strong>Costi</strong> e le <strong>Tariffe</strong> delle risorse solo per questo scenario (es. simulare un aumento di listino).</li>
                        <li>Cambiare il <strong>Listino</strong> applicato a specifici progetti.</li>
                        <li>Definire piani di fatturazione (Milestones) o spese extra ipotetiche.</li>
                    </ul>
                </SubSection>

                <SubSection title="Analisi Finanziaria (P&L)">
                    <p>Il tab <em>Analisi</em> fornisce un conto economico previsionale dello scenario, confrontando Ricavi e Costi mese per mese e calcolando il Margine operativo risultante dalle modifiche simulate.</p>
                </SubSection>
            </Section>

            <Section title="9. Analisi Allocazioni WBS">
                <p>La pagina <strong>Analisi Allocazioni WBS</strong> offre una vista gerarchica e finanziaria delle allocazioni, ideale per il controllo di gestione e la verifica della copertura contrattuale.</p>

                <SubSection title="Struttura Gerarchica">
                    <p>I dati sono raggruppati secondo la seguente logica ad albero:</p>
                    <ol className="list-decimal list-inside ml-4 space-y-1">
                        <li><strong>WBS / Contratto:</strong> Il livello più alto (es. Codice commessa o Nome Contratto).</li>
                        <li><strong>Progetto:</strong> I progetti collegati a quel contratto.</li>
                        <li><strong>Risorsa:</strong> Le persone che lavorano su quel progetto.</li>
                    </ol>
                </SubSection>

                <SubSection title="Unità di Misura">
                    <p>È possibile cambiare dinamicamente l'unità di misura dei dati visualizzati:</p>
                    <ul>
                        <li><strong>Giorni Uomo:</strong> Totale giornate allocate.</li>
                        <li><strong>FTE (Full Time Equivalent):</strong> Stima delle teste equivalenti (1 FTE ≈ 20 giorni/mese).</li>
                        <li><strong>Costo (€):</strong> Valorizzazione economica delle giornate basata sul costo interno della risorsa.</li>
                    </ul>
                </SubSection>

                <SubSection title="Controllo Copertura (No WBS)">
                    <p>La pagina evidenzia una sezione speciale o KPI per <strong>"No WBS"</strong> o <strong>"Attività Extra-Contrattuali"</strong>. Qui finiscono tutte le allocazioni su progetti che non sono stati collegati a nessun contratto attivo, permettendo di identificare rapidamente revenue a rischio o effort non coperto.</p>
                </SubSection>
            </Section>

            <Section title="10. Sezione Tecnica per Sviluppatori">
                <SubSection title="Architettura e fondamenti">
                    <ul>
                        <li><strong>SPA React + React Router:</strong> l'applicazione è una single-page application avviata da <code>App.tsx</code> con routing dichiarativo (<code>&lt;Routes&gt;</code>/<code>&lt;Route&gt;</code>) e lazy loading di tutte le pagine per ridurre il bundle iniziale.</li>
                        <li><strong>Code splitting:</strong> le pagine sono caricate con <code>React.lazy</code> e <code>Suspense</code>, rendendo il caricamento progressivo e migliorando la percezione delle performance.</li>
                        <li><strong>Styling:</strong> utilizza classi Tailwind (configurate in <code>tailwind.config.js</code>) combinate con le palette Material 3 presenti nelle classi <code>bg-surface</code>/<code>text-on-surface</code>.</li>
                    </ul>
                </SubSection>

                <SubSection title="Struttura logica dei moduli">
                    <ul>
                        <li><strong>pages/</strong>: contiene le viste di business (Staffing, Risorse, Progetti, Dashboard, Forecasting, ecc.) caricate in lazy loading. Ogni pagina espone un componente React predefinito.</li>
                        <li><strong>components/</strong>: libreria di UI condivisa (es. <code>Sidebar</code>, <code>BottomNavBar</code>, icone, tabelle, card) riusata trasversalmente dalle pagine.</li>
                        <li><strong>context/</strong>: provider React che incapsulano lo stato globale e i servizi (es. <code>AuthContext</code> per login e RBAC, <code>AppContext</code> per meta-configurazioni e dati dinamici, <code>ToastContext</code> per notifiche, <code>ThemeContext</code> per tema chiaro/scuro).</li>
                        <li><strong>services/</strong> e <strong>libs/</strong>: adapter verso API e utility (helper per date, formattazione, fetch con gestione errori). Mantengono la logica di integrazione separata dalla UI.</li>
                        <li><strong>config/</strong>: contiene configurazioni riusabili (es. mapping di ruoli, filtri, preset di griglie).</li>
                    </ul>
                </SubSection>

                <SubSection title="Routing, layout e permessi">
                    <ul>
                        <li><strong>Layout composito:</strong> <code>App.tsx</code> orchestra l'app: <code>Sidebar</code> laterale, <code>Header</code> dinamico con breadcrumb e <code>BottomNavBar</code> mobile.</li>
                        <li><strong>Protezione rotte:</strong> il wrapper <code>DynamicRoute</code> verifica i permessi via <code>AuthContext</code> prima di renderizzare la pagina; gli utenti senza permessi vengono reindirizzati.</li>
                        <li><strong>Home dinamica:</strong> <code>HomeRedirect</code> sceglie la landing page in base al ruolo (es. admin verso configurazione, manager verso staffing).</li>
                    </ul>
                </SubSection>

                <SubSection title="Flussi dati e stato applicativo">
                    <ul>
                        <li><strong>Fetching e caching:</strong> i servizi di <code>services/</code> recuperano dati (risorse, progetti, allocazioni) e li espongono ai componenti tramite i context; lo stato condiviso evita chiamate duplicate e semplifica le mutazioni ottimistiche.</li>
                        <li><strong>Feedback utente:</strong> <code>ToastProvider</code> gestisce notifiche di successo/errore, mentre i <em>skeleton loader</em> (<code>LoadingSkeleton</code> in <code>App.tsx</code>) coprono i periodi di attesa per mantenere responsività percepita.</li>
                        <li><strong>Tema e accessibilità:</strong> <code>ThemeProvider</code> abilita dark/light mode e classi semantiche; le sezioni usano titoli gerarchici, liste e pulsanti con etichette ARIA per garantire navigabilità.</li>
                    </ul>
                </SubSection>

                <SubSection title="Componenti e pattern ricorrenti">
                    <ul>
                        <li><strong>Tabelle e liste dinamiche:</strong> le pagine di gestione (Risorse, Progetti, Ruoli) utilizzano componenti tabellari configurabili (ordinamento, filtri, paginazione) con selettori azione contestuali.</li>
                        <li><strong>Card e pannelli informativi:</strong> la Dashboard e le viste analitiche impiegano card riusabili per KPI e grafici; gli stati di warning/errore sono evidenziati con classi cromatiche coerenti.</li>
                        <li><strong>Form e validazioni:</strong> i form adottano controlli controllati React, validazione lato client e feedback inline; le date sono normalizzate tramite helper condivisi.</li>
                        <li><strong>Interazioni drag & drop/resize:</strong> la griglia di staffing consente di estendere o ridurre l'allocazione temporale direttamente sulle celle, con aggiornamento immediato dello stato globale.</li>
                    </ul>
                </SubSection>

                <SubSection title="Come estendere o intervenire sul codice">
                    <ol className="list-decimal list-inside space-y-2">
                        <li><strong>Aggiungere una pagina:</strong> creare il file in <code>pages/</code>, esportare un componente React di default, aggiungere l'import lazy in <code>src/App.tsx</code> e configurare il path nel router (eventualmente in <code>src/routes.ts</code> se usato per menu dinamici).</li>
                        <li><strong>Integrare un nuovo dato/API:</strong> incapsulare le chiamate in <code>services/</code>, tipizzare le risposte in <code>types.ts</code>, e passare i dati tramite il context pertinente per mantenerli coerenti tra le viste.</li>
                        <li><strong>Riutilizzare componenti UI:</strong> consultare <code>components/</code> per pattern già disponibili (card, toolbar, filtri). Estendere i componenti con props tipizzate evitando <code>any</code> e mantenendo la compatibilità con Tailwind.</li>
                        <li><strong>Gestire permessi:</strong> mappare il nuovo path nel sistema RBAC dentro <code>AuthContext</code> (o nella configurazione di ruoli) così che <code>DynamicRoute</code> possa validarlo automaticamente.</li>
                        <li><strong>Testing manuale veloce:</strong> usare la navigazione laterale per raggiungere le nuove viste, verificare loading/error state e controllare che i toast vengano emessi correttamente dopo azioni CRUD.</li>
                    </ol>
                </SubSection>
            </Section>

            <style>{`
                .prose ul > li::before {
                    background-color: #2563eb;
                }
                .prose a {
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: 500;
                }
                 .prose a:hover {
                    text-decoration: underline;
                }
                .prose code {
                    color: #1d4ed8;
                    font-weight: 600;
                    background-color: #e0e7ff;
                    padding: 0.2em 0.4em;
                    border-radius: 0.25rem;
                }
                .dark .prose code {
                     color: #93c5fd;
                     background-color: #1e293b;
                }
            `}</style>
        </div>
    );
};

export default UserManualPage;
