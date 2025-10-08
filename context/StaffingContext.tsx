import React, { createContext, useState, useEffect, ReactNode, useContext } from 'react';
import {
    collection,
    doc,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    getDocs,
    writeBatch,
    setDoc,
    deleteField,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Client, Role, Resource, Project, Assignment, Allocation, ConfigOption } from '../types';
import { generateSampleData } from '../utils/sampleData';

interface StaffingContextType {
    clients: Client[];
    roles: Role[];
    resources: Resource[];
    projects: Project[];
    assignments: Assignment[];
    allocations: Allocation;
    horizontals: ConfigOption[];
    seniorityLevels: ConfigOption[];
    projectStatuses: ConfigOption[];
    clientSectors: ConfigOption[];
    loading: boolean;
    addClient: (client: Omit<Client, 'id'>) => Promise<void>;
    updateClient: (client: Client) => Promise<void>;
    deleteClient: (clientId: string) => Promise<void>;
    addRole: (role: Omit<Role, 'id'>) => Promise<void>;
    updateRole: (role: Role) => Promise<void>;
    deleteRole: (roleId: string) => Promise<void>;
    addResource: (resource: Omit<Resource, 'id'>) => Promise<void>;
    updateResource: (resource: Resource) => Promise<void>;
    deleteResource: (resourceId: string) => Promise<void>;
    addProject: (project: Omit<Project, 'id'>) => Promise<void>;
    updateProject: (project: Project) => Promise<void>;
    deleteProject: (projectId: string) => Promise<void>;
    addAssignment: (assignment: Omit<Assignment, 'id'>) => Promise<void>;
    deleteAssignment: (assignmentId: string) => Promise<void>;
    updateAllocation: (assignmentId: string, date: string, percentage: number) => Promise<void>;
    bulkUpdateAllocations: (assignmentId: string, startDate: string, endDate: string, percentage: number) => Promise<void>;
    addConfigOption: (type: keyof ConfigLists, value: string) => Promise<void>;
    updateConfigOption: (type: keyof ConfigLists, option: ConfigOption) => Promise<void>;
    deleteConfigOption: (type: keyof ConfigLists, optionId: string) => Promise<void>;
}

type ConfigLists = {
    horizontals: ConfigOption[],
    seniorityLevels: ConfigOption[],
    projectStatuses: ConfigOption[],
    clientSectors: ConfigOption[]
};

const collections = {
    clients: 'clients',
    roles: 'roles',
    resources: 'resources',
    projects: 'projects',
    assignments: 'assignments',
    allocations: 'allocations',
    horizontals: 'config-horizontals',
    seniorityLevels: 'config-seniorityLevels',
    projectStatuses: 'config-projectStatuses',
    clientSectors: 'config-clientSectors'
};

export const StaffingContext = createContext<StaffingContextType | undefined>(undefined);

const seedDatabase = async () => {
    console.log("Seeding database with initial data...");
    const sample = generateSampleData();
    const batch = writeBatch(db);

    Object.entries(collections).forEach(([key, collName]) => {
        const data = sample[key as keyof typeof sample] as any[];
        if (key === 'allocations') {
            Object.entries(data).forEach(([assignmentId, dateData]) => {
                 batch.set(doc(db, collName, assignmentId), dateData as object);
            })
        } else {
             data.forEach(item => {
                const docRef = doc(collection(db, collName));
                batch.set(docRef, item);
            });
        }
    });

    await batch.commit();
    console.log("Database seeded successfully.");
};

export const StaffingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [allocations, setAllocations] = useState<Allocation>({});
    const [horizontals, setHorizontals] = useState<ConfigOption[]>([]);
    const [seniorityLevels, setSeniorityLevels] = useState<ConfigOption[]>([]);
    const [projectStatuses, setProjectStatuses] = useState<ConfigOption[]>([]);
    const [clientSectors, setClientSectors] = useState<ConfigOption[]>([]);

    useEffect(() => {
        const unsubscribes = Object.entries(collections).map(([key, collName]) => {
            const q = collection(db, collName);
            return onSnapshot(q, async (querySnapshot) => {
                if (loading && querySnapshot.empty && key === 'clients') { // Check one collection to decide to seed
                    await seedDatabase();
                    return; // The snapshot will re-trigger with the new data
                }
                
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                switch (key) {
                    case 'clients': setClients(data as Client[]); break;
                    case 'roles': setRoles(data as Role[]); break;
                    case 'resources': setResources(data as Resource[]); break;
                    case 'projects': setProjects(data as Project[]); break;
                    case 'assignments': setAssignments(data as Assignment[]); break;
                    case 'allocations': 
                        const allocs: Allocation = {};
                        querySnapshot.docs.forEach(doc => {
                           allocs[doc.id] = doc.data();
                        });
                        setAllocations(allocs);
                        break;
                    case 'horizontals': setHorizontals(data as ConfigOption[]); break;
                    case 'seniorityLevels': setSeniorityLevels(data as ConfigOption[]); break;
                    case 'projectStatuses': setProjectStatuses(data as ConfigOption[]); break;
                    case 'clientSectors': setClientSectors(data as ConfigOption[]); break;
                }
                setLoading(false);
            });
        });
        return () => unsubscribes.forEach(unsub => unsub());
    }, [loading]);

    // --- CRUD Functions (Firebase v9) ---
    const addClient = async (client: Omit<Client, 'id'>) => { await addDoc(collection(db, collections.clients), client); };
    const updateClient = async (client: Client) => { const { id, ...data } = client; await updateDoc(doc(db, collections.clients, id!), data); };
    const deleteClient = async (clientId: string) => { await deleteDoc(doc(db, collections.clients, clientId)); /* Note: cascade delete logic needed */ };

    const addRole = async (role: Omit<Role, 'id'>) => { await addDoc(collection(db, collections.roles), role); };
    const updateRole = async (role: Role) => { const { id, ...data } = role; await updateDoc(doc(db, collections.roles, id!), data); };
    const deleteRole = async (roleId: string) => { await deleteDoc(doc(db, collections.roles, roleId)); };
    
    const addResource = async (resource: Omit<Resource, 'id'>) => { await addDoc(collection(db, collections.resources), resource); };
    const updateResource = async (resource: Resource) => { const { id, ...data } = resource; await updateDoc(doc(db, collections.resources, id!), data); };
    const deleteResource = async (resourceId: string) => {
         const batch = writeBatch(db);
         const assignmentsQuery = query(collection(db, collections.assignments), where("resourceId", "==", resourceId));
         const assignmentsSnapshot = await getDocs(assignmentsQuery);
         assignmentsSnapshot.forEach(docSnapshot => {
             batch.delete(docSnapshot.ref);
             // Also delete allocations for this assignment
             batch.delete(doc(db, collections.allocations, docSnapshot.id));
         });
         batch.delete(doc(db, collections.resources, resourceId));
         await batch.commit();
    };
    
    const addProject = async (project: Omit<Project, 'id'>) => { await addDoc(collection(db, collections.projects), project); };
    const updateProject = async (project: Project) => { const { id, ...data } = project; await updateDoc(doc(db, collections.projects, id!), data); };
    const deleteProject = async (projectId: string) => {
        const batch = writeBatch(db);
        const assignmentsQuery = query(collection(db, collections.assignments), where("projectId", "==", projectId));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        assignmentsSnapshot.forEach(docSnapshot => {
            batch.delete(docSnapshot.ref);
            batch.delete(doc(db, collections.allocations, docSnapshot.id));
        });
        batch.delete(doc(db, collections.projects, projectId));
        await batch.commit();
    };

    const addAssignment = async (assignment: Omit<Assignment, 'id'>) => {
        const q = query(collection(db, collections.assignments), where("resourceId", "==", assignment.resourceId), where("projectId", "==", assignment.projectId));
        const existing = await getDocs(q);
        if (existing.empty) {
            await addDoc(collection(db, collections.assignments), assignment);
        }
    };
    const deleteAssignment = async (assignmentId: string) => {
        const batch = writeBatch(db);
        batch.delete(doc(db, collections.assignments, assignmentId));
        batch.delete(doc(db, collections.allocations, assignmentId)); // Delete associated allocations
        await batch.commit();
    };
    
    const updateAllocation = async (assignmentId: string, date: string, percentage: number) => {
        const docRef = doc(db, collections.allocations, assignmentId);
        if (percentage === 0) {
            await updateDoc(docRef, {
                [date]: deleteField()
            });
        } else {
            await setDoc(docRef, { [date]: percentage }, { merge: true });
        }
    };

    const bulkUpdateAllocations = async (assignmentId: string, startDate: string, endDate: string, percentage: number) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const updates: { [key: string]: any } = {};
        for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                const dateStr = d.toISOString().split('T')[0];
                updates[dateStr] = percentage === 0 ? deleteField() : percentage;
            }
        }
        
        const docRef = doc(db, collections.allocations, assignmentId);
        try {
            if (percentage > 0) {
                await setDoc(docRef, updates, { merge: true });
            } else if (Object.keys(updates).length > 0) {
                await updateDoc(docRef, updates);
            }
        } catch(e) {
            console.warn(`Could not bulk update allocations for ${assignmentId}`, e);
        }
    };

    const addConfigOption = async (type: keyof ConfigLists, value: string) => {
        await addDoc(collection(db, collections[type]), { value });
    };
    const updateConfigOption = async (type: keyof ConfigLists, option: ConfigOption) => {
        const { id, ...data } = option;
        await updateDoc(doc(db, collections[type], id!), data);
    };
    const deleteConfigOption = async (type: keyof ConfigLists, optionId: string) => {
        await deleteDoc(doc(db, collections[type], optionId));
    };

    const contextValue: StaffingContextType = {
        clients, roles, resources, projects, assignments, allocations,
        horizontals, seniorityLevels, projectStatuses, clientSectors, loading,
        addClient, updateClient, deleteClient,
        addRole, updateRole, deleteRole,
        addResource, updateResource, deleteResource,
        addProject, updateProject, deleteProject,
        addAssignment, deleteAssignment,
        updateAllocation, bulkUpdateAllocations,
        addConfigOption, updateConfigOption, deleteConfigOption
    };

    return (
        <StaffingContext.Provider value={contextValue}>
            {children}
        </StaffingContext.Provider>
    );
};

export const useStaffingContext = () => {
    const context = useContext(StaffingContext);
    if (!context) {
        throw new Error('useStaffingContext must be used within a StaffingProvider');
    }
    return context;
};
