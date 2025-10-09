import React, { useState, useMemo } from 'react';
import { useStaffingContext } from '../context/StaffingContext';
import { addDays, formatDate, getWorkingDays } from '../utils/dateUtils';
import { PlusIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import Modal from '../components/Modal';
import { Assignment } from '../types';

// Helper to determine cell background color based on allocation percentage
const getAllocationColor = (percentage: number) => {
    if (percentage > 100) return 'bg-red-300 dark:bg-red-800';
    if (percentage === 100) return 'bg-green-200 dark:bg-green-800';
    if (percentage > 75) return 'bg-green-100 dark:bg-green-900';
    if (percentage > 50) return 'bg-yellow-100 dark:bg-yellow-900';
    if (percentage > 0) return 'bg-yellow-50 dark:bg-yellow-900/50';
    return 'bg-gray-50 dark:bg-gray-700/50';
};

const StaffingPage: React.FC = () => {
    const {
        projects,
        resources,
        assignments,
        allocations,
        addAssignment,
        deleteAssignment,
        updateAllocation,
    } = useStaffingContext();

    const [startDate, setStartDate] = useState(new Date());
    const [numberOfDays] = useState(20); // Number of working days to show
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);

    const timelineDays = useMemo(() => getWorkingDays(startDate, numberOfDays), [startDate, numberOfDays]);

    const handleDateChange = (days: number) => {
        setStartDate(prevDate => addDays(prevDate, days));
    };
    
    const openAssignmentModal = (projectId: string) => {
        setSelectedProject(projectId);
        setIsModalOpen(true);
    };
    
    const closeAssignmentModal = () => {
        setSelectedProject(null);
        setIsModalOpen(false);
    }
    
    const handleAddAssignment = (resourceId: string) => {
        if(selectedProject && resourceId){
            addAssignment({ projectId: selectedProject, resourceId });
        }
    };
    
    // Create a map for quick lookup of assignments by project
    const assignmentsByProject = useMemo(() => {
        return assignments.reduce((acc, assignment) => {
            if (!acc[assignment.projectId]) {
                acc[assignment.projectId] = [];
            }
            acc[assignment.projectId].push(assignment);
            return acc;
        }, {} as Record<string, Assignment[]>);
    }, [assignments]);
    
    const getResource = (resourceId: string) => resources.find(r => r.id === resourceId);

    const handleAllocationChange = (assignmentId: string, date: string, value: string) => {
        const percentage = parseInt(value, 10);
        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
            updateAllocation(assignmentId, date, percentage);
        } else if (value === '') {
            updateAllocation(assignmentId, date, 0); // Clear allocation
        }
    };

    const renderAssignmentRow = (assignment: Assignment) => {
        const resource = getResource(assignment.resourceId);
        if (!resource) return null;

        return (
            <tr key={assignment.id} className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-0 bg-white dark:bg-gray-800 z-10 w-48 min-w-[12rem] max-w-[12rem] truncate">
                   <div className="flex items-center">
                     <span className="truncate" title={resource.name}>{resource.name}</span>
                     <button onClick={() => deleteAssignment(assignment.id!)} className="ml-2 text-red-500 hover:text-red-700 opacity-50 hover:opacity-100">&times;</button>
                   </div>
                </td>
                {timelineDays.map(day => {
                    const dateStr = formatDate(day, 'iso');
                    const percentage = allocations[assignment.id]?.[dateStr] || 0;
                    return (
                        <td key={dateStr} className={`border-l border-gray-200 dark:border-gray-700 p-0 text-center ${getAllocationColor(percentage)}`}>
                            <input
                                type="number"
                                value={percentage || ''}
                                onChange={(e) => handleAllocationChange(assignment.id, dateStr, e.target.value)}
                                className="w-16 h-10 p-1 text-center bg-transparent border-0 focus:ring-2 focus:ring-blue-500 dark:text-white"
                                min="0" max="100" step="5"
                                placeholder="0"
                            />
                        </td>
                    );
                })}
            </tr>
        );
    };
    
    const unassignedResources = useMemo(() => {
        if (!selectedProject) return [];
        const assignedResourceIds = (assignmentsByProject[selectedProject] || []).map(a => a.resourceId);
        return resources.filter(r => r.id! && !assignedResourceIds.includes(r.id!));
    }, [selectedProject, resources, assignmentsByProject]);
    

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Staffing</h1>
                <div className="flex items-center gap-2">
                    <button onClick={() => handleDateChange(-numberOfDays)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronLeftIcon className="w-6 h-6" /></button>
                    <button onClick={() => setStartDate(new Date())} className="px-4 py-2 text-sm font-semibold bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md shadow-sm">Oggi</button>
                    <button onClick={() => handleDateChange(numberOfDays)} className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"><ChevronRightIcon className="w-6 h-6" /></button>
                </div>
            </div>

            <div className="overflow-x-auto shadow rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 bg-gray-100 dark:bg-gray-700 z-20 w-48 min-w-[12rem]">Progetto / Risorsa</th>
                            {timelineDays.map(day => (
                                <th key={formatDate(day, 'iso')} className={`w-16 min-w-[4rem] px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 border-l border-gray-200 dark:border-gray-600 ${['Sab', 'Dom'].includes(formatDate(day, 'day')) ? 'bg-gray-200 dark:bg-gray-600' : ''}`}>
                                    <div>{formatDate(day, 'day')}</div>
                                    <div>{formatDate(day, 'short')}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-800 dark:divide-gray-700">
                        {projects.map(project => (
                            <React.Fragment key={project.id}>
                                <tr className="bg-gray-50 dark:bg-gray-900">
                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200 sticky left-0 bg-gray-50 dark:bg-gray-900 z-10 w-48 min-w-[12rem] max-w-[12rem]">
                                        <div className="flex items-center justify-between">
                                            <span className="truncate" title={project.name}>{project.name}</span>
                                            <button onClick={() => openAssignmentModal(project.id!)} className="text-blue-500 hover:text-blue-700">
                                                <PlusIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </td>
                                    <td colSpan={numberOfDays} className="border-l border-gray-200 dark:border-gray-700"></td>
                                </tr>
                                {(assignmentsByProject[project.id!] || []).map(renderAssignmentRow)}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={closeAssignmentModal} title="Aggiungi Risorsa al Progetto">
                <div className="max-h-96 overflow-y-auto">
                    <ul>
                        {unassignedResources.length > 0 ? (
                            unassignedResources.map(resource => (
                                <li key={resource.id} className="flex justify-between items-center p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                                    <span>{resource.name}</span>
                                    <button onClick={() => handleAddAssignment(resource.id!)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md shadow-sm hover:bg-blue-700">
                                        Aggiungi
                                    </button>
                                </li>
                            ))
                        ) : (
                            <li className="p-2 text-center text-gray-500">Tutte le risorse sono già assegnate.</li>
                        )}
                    </ul>
                </div>
            </Modal>
        </div>
    );
};

export default StaffingPage;
