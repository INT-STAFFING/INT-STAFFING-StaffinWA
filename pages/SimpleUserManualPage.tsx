
import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-10">
        <h2 className="text-2xl font-bold text-primary mb-4 pb-2 border-b border-outline-variant">{title}</h2>
        <div className="prose prose-sm dark:prose-invert max-w-none text-on-surface space-y-4">
            {children}
        </div>
    </section>
);

const InfoBox: React.FC<{ icon: string; title: string; children: React.ReactNode; type?: 'info' | 'warning' | 'tip' }> = ({ icon, title, children, type = 'info' }) => {
    const colors = {
        info: 'bg-primary-container text-on-primary-container border-primary',
        warning: 'bg-yellow-container text-on-yellow-container border-yellow-600',
        tip: 'bg-tertiary-container text-on-tertiary-container border-tertiary',
    };

    return (
        <div className={`p-4 rounded-lg border-l-4 ${colors[type]} my-4`}>
            <div className="flex items-center gap-2 mb-2 font-bold">
                <span className="material-symbols-outlined">{icon}</span>
                <span>{title}</span>
            </div>
            <div className="text-sm opacity-90">
                {children}
            </div>
        </div>
    );
};

const SimpleUserManualPage: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto bg-surface rounded-2xl shadow-lg p-8">
            <header className="mb-10 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-on-primary-container mb-4">
                    <span className="material-symbols-outlined text-3xl">event_available</span>
                </div>
                <h1 className="text-3xl font-bold text-on-surface">Guida alla Gestione Assenze</h1>
                <p className="text-on-surface-variant mt-2">Istruzioni rapide per richiedere ferie, permessi e malattie.</p>
            </header>

            <Section title="1. Panoramica">
                <p>
                    La pagina <strong>Gestione Assenze</strong> ti permette di inserire richieste per ferie, permessi o malattie e di monitorare il loro stato di approvazione.
                    Come utente, puoi vedere <strong>solo le tue richieste</strong> nella tabella principale.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="bg-surface-container-low p-3 rounded-lg text-center">
                        <span className="material-symbols-outlined text-primary text-2xl block mb-1">add_circle</span>
                        <span className="text-sm font-medium">Inserisci Richiesta</span>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-lg text-center">
                        <span className="material-symbols-outlined text-tertiary text-2xl block mb-1">group</span>
                        <span className="text-sm font-medium">Seleziona 3 Manager</span>
                    </div>
                    <div className="bg-surface-container-low p-3 rounded-lg text-center">
                        <span className="material-symbols-outlined text-secondary text-2xl block mb-1">notifications</span>
                        <span className="text-sm font-medium">Attendi Esito</span>
                    </div>
                </div>
            </Section>

            <Section title="2. Come inserire una nuova richiesta">
                <ol className="list-decimal list-inside space-y-3 ml-2">
                    <li>
                        Vai alla pagina <strong>Assenze</strong> dal menu laterale.
                    </li>
                    <li>
                        Clicca sul pulsante <span className="inline-flex items-center px-2 py-1 bg-primary text-on-primary text-xs rounded font-bold">Nuova Richiesta</span> in alto a destra.
                    </li>
                    <li>
                        Si aprirà una finestra. Il campo <strong>Risorsa Richiedente</strong> sarà già compilato con il tuo nome.
                    </li>
                    <li>
                        Seleziona la <strong>Tipologia Assenza</strong> (es. Ferie, Malattia, Permesso Studio).
                    </li>
                    <li>
                        <strong>Date:</strong> Inserisci la data di Inizio e Fine. Se è un solo giorno, inserisci la stessa data in entrambi i campi.
                    </li>
                </ol>

                <InfoBox icon="priority_high" title="Regola Approvatori (Importante)" type="warning">
                    <p>
                        Nel campo <strong>Richiedi Approvazione a</strong>, devi obbligatoriamente selezionare <strong>almeno 3 Manager</strong> dall'elenco.
                    </p>
                    <ul className="list-disc list-inside mt-2 text-xs">
                        <li>Il sistema invierà la richiesta a tutti e tre.</li>
                        <li>È sufficiente che <strong>uno solo</strong> di loro approvi affinché la richiesta venga confermata.</li>
                        <li>Se selezioni meno di 3 persone, non potrai salvare la richiesta.</li>
                    </ul>
                </InfoBox>
            </Section>

            <Section title="3. Stati della Richiesta">
                <p>Una volta salvata, la tua richiesta apparirà in tabella con uno dei seguenti stati:</p>
                <div className="space-y-3 mt-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container">
                        <span className="px-2 py-1 bg-yellow-container text-on-yellow-container text-xs font-bold rounded">PENDING</span>
                        <span className="text-sm">La richiesta è stata inviata ed è <strong>in attesa</strong> che uno dei manager selezionati la valuti.</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container">
                        <span className="px-2 py-1 bg-tertiary-container text-on-tertiary-container text-xs font-bold rounded">APPROVED</span>
                        <span className="text-sm">La richiesta è stata <strong>approvata</strong>. I giorni sono stati registrati e il calendario aggiornato.</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container">
                        <span className="px-2 py-1 bg-error-container text-on-error-container text-xs font-bold rounded">REJECTED</span>
                        <span className="text-sm">La richiesta è stata <strong>rifiutata</strong>. Contatta il tuo manager per dettagli.</span>
                    </div>
                </div>
            </Section>

            <Section title="4. Modifica e Cancellazione">
                <p>
                    Puoi modificare o cancellare una richiesta solo finché si trova nello stato <strong>PENDING</strong>.
                </p>
                <ul className="list-disc list-inside mt-2">
                    <li>Usa l'icona <span className="material-symbols-outlined text-primary text-sm align-middle">edit</span> per cambiare date o approvatori.</li>
                    <li>Usa l'icona <span className="material-symbols-outlined text-error text-sm align-middle">delete</span> per annullare la richiesta.</li>
                </ul>
                <InfoBox icon="info" title="Richieste già elaborate" type="tip">
                    Se una richiesta è già stata <strong>Approvata</strong> o <strong>Rifiutata</strong>, non puoi più modificarla autonomamente. Se devi annullare delle ferie già approvate, contatta un Admin o un Manager.
                </InfoBox>
            </Section>
        </div>
    );
};

export default SimpleUserManualPage;
