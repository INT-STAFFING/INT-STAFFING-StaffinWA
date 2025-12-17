
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