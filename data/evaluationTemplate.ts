export const evaluationTemplate = {
    title: 'Performance Skills FY25',
    sections: [
        {
            title: 'Technical Capabilities',
            skills: [
                { id: 'tech_1', text: 'Esegue lavori di alta qualità che rispettano gli standard professionali richiesti e produce correttamente e in modo efficace e preciso gli output richiesti', description: 'Valuta la qualità, l_accuratezza e l_efficacia del lavoro prodotto rispetto agli standard professionali e alle aspettative.' },
                { id: 'tech_2', text: 'Esegue task in autonomia, ricercando proattivamente modelli, standard e framework di riferimento interni e esterni', description: 'Valuta la capacità di lavorare in modo indipendente, cercando soluzioni e best practice senza costante supervisione.' },
                { id: 'tech_3', text: 'Porta a compimento le attività assegnate nei tempi e nei modi previsti, rispettando le indicazioni e le scadenze ricevute dai suoi responsabili', description: 'Valuta l_affidabilità, la puntualità e la capacità di seguire le direttive e rispettare le scadenze.' },
                { id: 'tech_4', text: 'Utilizza spirito critico nelle attività progettuali che svolge e attinge alle conoscenze tecniche dei colleghi più esperti per migliorarsi', description: 'Valuta la propensione a pensare in modo critico, a fare domande pertinenti e a imparare dagli altri per migliorare le proprie competenze.' }
            ]
        },
        {
            title: 'Business Acumen',
            skills: [
                { id: 'biz_1', text: 'Approfondisce la conoscenza del cliente e le tematiche progettuali sin dall_avvio delle attività', description: 'Valuta l_interesse e la proattività nel comprendere il contesto di business del cliente e gli obiettivi del progetto.' },
                { id: 'biz_2', text: 'E_ in grado di distinguere le problematiche lavorative prioritarie da quelle secondarie', description: 'Valuta la capacità di definire le priorità, concentrandosi sulle attività a maggior impatto e valore.' },
                { id: 'biz_3', text: 'Riesce a cogliere i bisogni dei clienti e si adopera per soddisfarli, anche attraverso il coinvolgimento di colleghi di maggiore esperienza', description: 'Valuta la capacità di ascolto, l_empatia verso il cliente e la ricerca di soluzioni efficaci, anche chiedendo supporto.' },
                { id: 'biz_4', text: 'Si informa per avere il quadro generale dell_approccio e del business di Intellera', description: 'Valuta l_interesse a comprendere la strategia aziendale, i servizi offerti e il modello di business.' }
            ]
        },
        {
            title: 'People Development Skills',
            skills: [
                { id: 'people_1', text: 'Dimostra capacità di adattamento, gestendo task ed attività in maniera flessibile in relazione alle esigenze e alle priorità del progetto/cliente', description: 'Valuta la flessibilità e la capacità di adattarsi a cambiamenti di priorità, requisiti o contesto.' },
                { id: 'people_2', text: 'Dimostra interesse verso il proprio piano di crescita e sviluppo, informandosi proattivamente su corsi di formazione e certificazione da acquisire', description: 'Valuta la proattività nella gestione della propria crescita professionale e l_impegno nello sviluppo di nuove competenze.' },
                { id: 'people_3', text: 'Partecipa attivamente al team di lavoro dimostrando collaborazione e un approccio di condivisione delle informazioni con i colleghi', description: 'Valuta la capacità di lavorare in team, di collaborare e di comunicare in modo trasparente con i colleghi.' },
                { id: 'people_4', text: 'Ricerca, con frequenza regolare, feedback costruttivi in merito al percorso di crescita e lavora sulle aree di miglioramento', description: 'Valuta l_apertura al feedback, la capacità di recepirlo in modo costruttivo e di agire per migliorare.' }
            ]
        },
        {
            title: 'Relationship Skills',
            skills: [
                { id: 'rel_1', text: 'Agisce sapendo di rappresentare Intellera e adotta comportamenti volti a promuoverne l_integrità e a salvaguardarne la reputazione e l_immagine sia internamente che verso l_esterno', description: 'Valuta la professionalità e la capacità di agire come ambasciatore positivo dell_azienda.' },
                { id: 'rel_2', text: 'Comunica in maniera chiara ed efficace', description: 'Valuta la chiarezza, la concisione e l_efficacia della comunicazione, sia scritta che verbale.' },
                { id: 'rel_3', text: 'Si impegna ad ascoltare attivamente il suo interlocutore, dimostrando apertura al confronto e approfondendo i messaggi che riceve', description: 'Valuta le capacità di ascolto attivo, l_empatia e l_apertura a punti di vista diversi.' },
                { id: 'rel_4', text: 'Si presenta al lavoro rispettando lo standing professionale (es. rispetto degli orari, ascolto attivo, approccio rispettoso ai colleghi e al cliente e abbigliamento adeguato)', description: 'Valuta il rispetto delle norme di comportamento professionale e l_adozione di uno standing adeguato al contesto lavorativo.' }
            ]
        }
    ]
};

export const scoreOptions = [
    { value: 0, label: 'Seleziona...' },
    { value: 1, label: '1 - Molto al di sotto' },
    { value: 2, label: '2 - Al di sotto' },
    { value: 3, label: '3 - In linea' },
    { value: 4, label: '4 - Al di sopra' },
    { value: 5, label: '5 - Eccezionale' },
];

export const seniorityOrder: { [key: string]: number } = {
    'Junior': 1,
    'Mid': 2,
    'Senior': 3,
    'Lead': 4,
    'Manager': 5,
};
