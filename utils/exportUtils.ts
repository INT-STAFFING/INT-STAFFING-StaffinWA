/**
 * @file exportUtils.ts
 * @description Funzioni di utilità per esportare dati in formato Excel.
 * Si assume che la libreria 'xlsx' sia caricata globalmente tramite CDN.
 */

import { getWorkingDaysBetween } from './dateUtils';
import { WbsTask } from '../types';

// Dichiarazione per informare TypeScript che la variabile XLSX esiste a livello globale.
declare var XLSX: any;

/**
 * @interface StaffingData
 * @description Definisce la struttura dei dati di staffing passati alla funzione di esportazione.
 */
interface StaffingData {
    clients: any[];
    roles: any[];
    resources: any[];
    projects: any[];
    assignments: any[];
    allocations: any;
    companyCalendar: any[];
    wbsTasks: WbsTask[];
}

/**
 * Esporta tutti i dati principali dell'applicazione in un singolo file Excel con fogli multipli.
 * I fogli sono formattati per assomigliare il più possibile alla visualizzazione nell'app.
 * @param {StaffingData} data - L'oggetto contenente tutti i dati dell'applicazione, solitamente dal contesto.
 */
export const exportDataToExcel = (data: StaffingData) => {
    const { clients, roles, resources, projects, assignments, allocations, companyCalendar, wbsTasks } = data;

    /**
     * Calcola l'allocazione media di una risorsa per un dato mese.
     * @param {string} resourceId - L'ID della risorsa.
     * @param {number} [monthOffset=0] - 0 per il mese corrente, 1 per il prossimo, etc.
     * @returns {number} La percentuale di allocazione media.
     */
    const calculateResourceAllocation = (resourceId: string, monthOffset: number = 0): number => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1 + monthOffset, 0);
        const resource = resources.find((r: any) => r.id === resourceId);
        const resourceLocation = resource ? resource.location : null;
        const workingDaysInMonth = getWorkingDaysBetween(firstDay, lastDay, companyCalendar, resourceLocation);

        if (workingDaysInMonth === 0) return 0;
        const resourceAssignments = assignments.filter(a => a.resourceId === resourceId);
        if (resourceAssignments.length === 0) return 0;

        let totalPersonDays = 0;
        resourceAssignments.forEach(assignment => {
            const assignmentAllocations = allocations[assignment.id];
            if (assignmentAllocations) {
                for (const dateStr in assignmentAllocations) {
                    const allocDate = new Date(dateStr);
                    if (allocDate >= firstDay && allocDate <= lastDay) {
                        totalPersonDays += (assignmentAllocations[dateStr] / 100);
                    }
                }
            }
        });
        return Math.round((totalPersonDays / workingDaysInMonth) * 100);
    };

    // 1. Prepara i dati per ciascun foglio, con intestazioni chiare e campi calcolati.
    
    const clientsSheetData = clients.map(c => ({
        'Nome Cliente': c.name,
        'Settore': c.sector,
        'Email Contatto': c.contactEmail,
    }));

    const rolesSheetData = roles.map(r => ({
        'Nome Ruolo': r.name,
        'Livello Seniority': r.seniorityLevel,
        'Costo Giornaliero (€)': r.dailyCost,
    }));
    
    const resourcesSheetData = resources.map(r => {
        const role = roles.find(role => role.id === r.roleId);
        return {
            'Nome': r.name,
            'Email': r.email,
            'Sede': r.location,
            'Ruolo': role?.name || 'N/A',
            'Horizontal': r.horizontal,
            'Costo Giornaliero (€)': role?.dailyCost || 0,
            'Allocazione Media Mese Corrente (%)': calculateResourceAllocation(r.id!),
            'Data Assunzione': r.hireDate,
            'Anzianità Lavorativa (anni)': r.workSeniority,
            'Note': r.notes || '',
        };
    });
    
    const projectsSheetData = projects.map(p => ({
        'Nome Progetto': p.name,
        'Cliente': clients.find(c => c.id === p.clientId)?.name || 'N/A',
        'Stato': p.status,
        'Budget (€)': p.budget,
        'Realizzazione (%)': p.realizationPercentage,
        'Data Inizio': p.startDate,
        'Data Fine': p.endDate,
        'Project Manager': p.projectManager,
        'Note': p.notes || '',
    }));

    // Crea un unico foglio "Dettaglio Staffing" che combina Assegnazioni e Allocazioni.
    const staffingSheetData: { 'Data': string, 'Risorsa': string, 'Ruolo': string, 'Progetto': string, 'Cliente': string, 'Allocazione (%)': number }[] = [];
    Object.entries(allocations).forEach(([assignmentId, dateAllocations]) => {
        const assignment = assignments.find(a => a.id === assignmentId);
        if (assignment) {
            const resource = resources.find(r => r.id === assignment.resourceId);
            const project = projects.find(p => p.id === assignment.projectId);
            if (resource && project) {
                const client = clients.find(c => c.id === project.clientId);
                const role = roles.find(ro => ro.id === resource.roleId);
                Object.entries(dateAllocations as Record<string, number>).forEach(([date, percentage]) => {
                    staffingSheetData.push({
                        'Data': date,
                        'Risorsa': resource.name,
                        'Ruolo': role?.name || 'N/A',
                        'Progetto': project.name,
                        'Cliente': client?.name || 'N/A',
                        'Allocazione (%)': percentage
                    });
                });
            }
        }
    });
    // Ordina i dati per data e poi per risorsa per una migliore leggibilità.
    staffingSheetData.sort((a, b) => {
        if (a.Data > b.Data) return 1;
        if (a.Data < b.Data) return -1;
        if (a.Risorsa > b.Risorsa) return 1;
        if (a.Risorsa < b.Risorsa) return -1;
        return 0;
    });

    // Aggiungi foglio per WBS
    const wbsSheetData = wbsTasks.map(task => {
        const p = task;
        const totaleOre = (p.ore || 0) + (p.oreNetworkItalia || 0);
        const totaleProduzioneLorda = (p.produzioneLorda || 0) + (p.produzioneLordaNetworkItalia || 0);
        const produzioneNetta = (totaleProduzioneLorda + (p.perdite || 0)) * ((p.realisation || 100) / 100);
        const totaleSpese = (p.speseOnorariEsterni || 0) + (p.speseAltro || 0);
        const fattureOnorariESpese = (p.fattureOnorari || 0) + (p.fattureSpese || 0);
        const totaleFatture = fattureOnorariESpese + (p.iva || 0);
        const totaleWIP = produzioneNetta - fattureOnorariESpese;
        const credito = totaleFatture + totaleWIP - (p.incassi || 0);
        return {
            'Elemento WBS': task.elementoWbs,
            'Descrizione WBE': task.descrizioneWbe,
            'Cliente': clients.find(c => c.id === task.clientId)?.name || 'N/A',
            'Periodo': task.periodo,
            'Ore': task.ore,
            'Produzione Lorda': task.produzioneLorda,
            'Ore Network Italia': task.oreNetworkItalia,
            'Produzione Lorda Network Italia': task.produzioneLordaNetworkItalia,
            'Totale Ore': totaleOre,
            'Totale Produzione Lorda': totaleProduzioneLorda,
            'Perdite': task.perdite,
            'Realisation (%)': task.realisation,
            'Produzione Netta': produzioneNetta,
            'Spese Onorari Esterni': task.speseOnorariEsterni,
            'Spese Altro': task.speseAltro,
            'Totale Spese': totaleSpese,
            'Fatture Onorari': task.fattureOnorari,
            'Fatture Spese': task.fattureSpese,
            'Fatture Onorari e Spese': fattureOnorariESpese,
            'IVA': task.iva,
            'TOTALE Fatture': totaleFatture,
            'Totale WIP': totaleWIP,
            'Incassi': task.incassi,
            'Credito': credito,
            'Primo Responsabile': resources.find(r => r.id === task.primoResponsabileId)?.name || 'N/A',
            'Secondo Responsabile': resources.find(r => r.id === task.secondoResponsabileId)?.name || 'N/A',
        }
    });

    // 2. Crea un nuovo workbook e aggiunge i fogli di lavoro.
    const wb = XLSX.utils.book_new();
    
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resourcesSheetData), 'Risorse');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projectsSheetData), 'Progetti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientsSheetData), 'Clienti');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rolesSheetData), 'Ruoli');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(wbsSheetData), 'WBS Incarichi');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(staffingSheetData), 'Dettaglio Staffing');
    
    // 3. Avvia il download del file Excel.
    XLSX.writeFile(wb, 'Staffing_Export.xlsx');
};

/**
 * Genera e avvia il download di un file Excel vuoto che funge da template per l'importazione massiva.
 * Include un foglio di istruzioni per guidare l'utente.
 */
export const exportTemplateToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Foglio di istruzioni
    const instructions = [
        ["Istruzioni per l'Importazione Massiva"],
        [], // Riga vuota
        ["1. Non modificare i nomi dei fogli (in basso) o i nomi delle colonne (la prima riga di ogni foglio)."],
        ["2. Compila ogni foglio con i dati richiesti. L'ordine di importazione è: Ruoli, Clienti, Risorse, Progetti, WBS."],
        ["3. I dati esistenti (con lo stesso nome/email/WBS) verranno saltati per evitare duplicati."],
        [],
        ["Formato Colonne:"],
        ["- roleName (nel foglio 'Risorse'): Deve corrispondere esattamente a un 'name' nel foglio 'Ruoli'."],
        ["- clientName (nei fogli 'Progetti' e 'WBS Incarichi'): Deve corrispondere a un 'name' nel foglio 'Clienti'."],
        ["- primoResponsabileEmail / secondoResponsabileEmail (foglio 'WBS Incarichi'): Deve corrispondere a una 'email' nel foglio 'Risorse'."],
        ["- Date (hireDate, startDate, endDate): Usa il formato AAAA-MM-GG (es. 2024-12-31)."],
        ["- Campi numerici (dailyCost, budget, ecc.): Inserire solo numeri, senza simboli di valuta."],
    ];
    const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
    // Imposta la larghezza delle colonne per una migliore leggibilità
    wsInstructions['!cols'] = [{ wch: 120 }];


    // NOTA: Gli header qui DEVONO corrispondere alle chiavi usate nell'endpoint API di importazione.
    const clientsHeaders = [["name", "sector", "contactEmail"]];
    const rolesHeaders = [["name", "seniorityLevel", "dailyCost"]];
    const resourcesHeaders = [["name", "email", "roleName", "horizontal", "location", "hireDate", "workSeniority", "notes"]];
    const projectsHeaders = [["name", "clientName", "status", "budget", "realizationPercentage", "startDate", "endDate", "projectManager", "notes"]];
    const wbsHeaders = [[
        "elementoWbs", "descrizioneWbe", "clientName", "periodo", "ore", "produzioneLorda", "oreNetworkItalia", 
        "produzioneLordaNetworkItalia", "perdite", "realisation", "speseOnorariEsterni", "speseAltro",
        "fattureOnorari", "fattureSpese", "iva", "incassi", "primoResponsabileEmail", "secondoResponsabileEmail"
    ]];


    const wsClients = XLSX.utils.aoa_to_sheet(clientsHeaders);
    const wsRoles = XLSX.utils.aoa_to_sheet(rolesHeaders);
    const wsResources = XLSX.utils.aoa_to_sheet(resourcesHeaders);
    const wsProjects = XLSX.utils.aoa_to_sheet(projectsHeaders);
    const wsWbs = XLSX.utils.aoa_to_sheet(wbsHeaders);

    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Istruzioni');
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clienti');
    XLSX.utils.book_append_sheet(wb, wsRoles, 'Ruoli');
    XLSX.utils.book_append_sheet(wb, wsResources, 'Risorse');
    XLSX.utils.book_append_sheet(wb, wsProjects, 'Progetti');
    XLSX.utils.book_append_sheet(wb, wsWbs, 'WBS Incarichi');


    XLSX.writeFile(wb, 'Staffing_Import_Template.xlsx');
};