import React, { useState, useMemo, useEffect } from 'react';
import { useEntitiesContext } from '../context/AppContext';
import { Resource, Evaluation } from '../types';
import { evaluationTemplate, scoreOptions, seniorityOrder } from '../data/evaluationTemplate';
import SearchableSelect from '../components/SearchableSelect';
import { InformationCircleIcon, SpinnerIcon } from '../components/icons';
import { useToast } from '../context/ToastContext';

const SkillRow: React.FC<{
    skill: { id: string; text: string; description: string };
    value: number;
    onChange: (skillId: string, score: number) => void;
}> = ({ skill, value, onChange }) => {
    return (
        <tr className="border-b border-border dark:border-dark-border">
            <td className="p-4 text-sm text-foreground dark:text-dark-foreground">
                {skill.text}
            </td>
            <td className="p-4" style={{ width: '250px' }}>
                <div className="flex items-center gap-2">
                    <select
                        value={value}
                        onChange={(e) => onChange(skill.id, parseInt(e.target.value))}
                        className="form-select w-full"
                    >
                        {scoreOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <div className="relative group">
                        <InformationCircleIcon className="w-5 h-5 text-primary cursor-pointer" />
                        <div className="absolute bottom-full mb-2 w-72 p-2 text-xs text-white bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 -translate-x-1/2 left-1/2">
                            {skill.description}
                        </div>
                    </div>
                </div>
            </td>
        </tr>
    );
};

const CompetenzePage: React.FC = () => {
    const { resources, roles, evaluations, saveEvaluation, isActionLoading } = useEntitiesContext();
    const { addToast } = useToast();
    
    const [selectedResourceId, setSelectedResourceId] = useState<string>('');
    const [selectedEvaluatorId, setSelectedEvaluatorId] = useState<string>('');
    const [currentPeriod] = useState('FY25');
    const [answers, setAnswers] = useState<Record<string, number>>({});

    const selectedResource = useMemo(() => resources.find(r => r.id === selectedResourceId), [resources, selectedResourceId]);

    useEffect(() => {
        if (selectedResourceId && selectedEvaluatorId) {
            const existingEvaluation = evaluations.find(
                e => e.evaluatedResourceId === selectedResourceId && e.evaluatorResourceId === selectedEvaluatorId && e.period === currentPeriod
            );
            if (existingEvaluation) {
                const loadedAnswers = existingEvaluation.answers.reduce((acc, ans) => {
                    acc[ans.skillId] = ans.score;
                    return acc;
                }, {} as Record<string, number>);
                setAnswers(loadedAnswers);
            } else {
                setAnswers({});
            }
        } else {
            setAnswers({});
        }
    }, [selectedResourceId, selectedEvaluatorId, currentPeriod, evaluations]);

    const evaluatorsForSelectedResource = useMemo(() => {
        if (!selectedResource) return [];
        const evaluatedRole = roles.find(r => r.id === selectedResource.roleId);
        if (!evaluatedRole) return [];

        const evaluatedSeniority = seniorityOrder[evaluatedRole.seniorityLevel] || 0;
        
        return resources
            .filter(r => r.id !== selectedResourceId)
            .filter(r => {
                const evaluatorRole = roles.find(role => role.id === r.roleId);
                const evaluatorSeniority = evaluatorRole ? seniorityOrder[evaluatorRole.seniorityLevel] || 0 : 0;
                return evaluatorSeniority > evaluatedSeniority;
            })
            .map(r => ({ value: r.id!, label: r.name }));
    }, [selectedResource, resources, roles]);

    const evaluationsForResource = useMemo(() => {
        return evaluations.filter(e => e.evaluatedResourceId === selectedResourceId && e.period === currentPeriod);
    }, [evaluations, selectedResourceId, currentPeriod]);

    const canAddEvaluator = useMemo(() => {
        const uniqueEvaluators = new Set(evaluationsForResource.map(e => e.evaluatorResourceId));
        if (uniqueEvaluators.has(selectedEvaluatorId)) {
            return true; // Can edit existing evaluation
        }
        return uniqueEvaluators.size < 5;
    }, [evaluationsForResource, selectedEvaluatorId]);

    const handleAnswerChange = (skillId: string, score: number) => {
        setAnswers(prev => ({ ...prev, [skillId]: score }));
    };

    const handleSave = async () => {
        if (!selectedResourceId || !selectedEvaluatorId) {
            addToast('Seleziona una risorsa e un valutatore.', 'error');
            return;
        }
        if (!canAddEvaluator) {
             addToast('Questa risorsa ha già raggiunto il numero massimo di 5 valutatori.', 'error');
            return;
        }
        const answersToSave = Object.entries(answers).map(([skillId, score]) => ({ skillId, score }));
        await saveEvaluation(selectedResourceId, selectedEvaluatorId, currentPeriod, answersToSave);
    };
    
    const resourceOptions = useMemo(() => resources.filter(r => !r.resigned).map(r => ({ value: r.id!, label: r.name })), [resources]);
    const totalSkills = evaluationTemplate.sections.reduce((acc, section) => acc + section.skills.length, 0);
    const isFormComplete = Object.values(answers).filter(v => v > 0).length === totalSkills;

    return (
        <div className="space-y-6">
            <div className="bg-card dark:bg-dark-card rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-1">Risorsa da Valutare</label>
                        <SearchableSelect
                            name="selectedResource"
                            value={selectedResourceId}
                            onChange={(_, value) => {
                                setSelectedResourceId(value);
                                setSelectedEvaluatorId('');
                            }}
                            options={resourceOptions}
                            placeholder="Seleziona risorsa..."
                        />
                    </div>
                    {selectedResourceId && (
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Valutatore</label>
                            <SearchableSelect
                                name="selectedEvaluator"
                                value={selectedEvaluatorId}
                                onChange={(_, value) => setSelectedEvaluatorId(value)}
                                options={evaluatorsForSelectedResource}
                                placeholder="Seleziona valutatore..."
                            />
                        </div>
                    )}
                    {selectedResource && (
                        <div className="bg-muted dark:bg-dark-muted p-4 rounded-md text-center">
                            <h3 className="text-sm font-medium text-muted-foreground">Punteggio Medio Complessivo</h3>
                            <p className="text-3xl font-bold text-primary">{selectedResource.averageScore?.toFixed(2) || 'N/A'}</p>
                        </div>
                    )}
                </div>
                 {!canAddEvaluator && selectedEvaluatorId && (
                    <div className="mt-4 text-sm text-warning font-semibold bg-warning/10 p-3 rounded-md">
                        Questa risorsa ha già raggiunto il numero massimo di 5 valutatori per questo periodo. Puoi modificare solo una valutazione esistente.
                    </div>
                )}
            </div>

            {selectedResourceId && selectedEvaluatorId ? (
                <div className="bg-card dark:bg-dark-card rounded-lg shadow">
                    <div className="p-6 border-b border-border dark:border-dark-border flex justify-between items-center">
                        <h2 className="text-xl font-semibold">{evaluationTemplate.title}</h2>
                        <button
                            onClick={handleSave}
                            disabled={!isFormComplete || !canAddEvaluator || isActionLoading('saveEvaluation')}
                            className="flex items-center justify-center px-4 py-2 bg-primary text-white rounded-md shadow-sm hover:bg-primary-darker disabled:opacity-50"
                        >
                            {isActionLoading('saveEvaluation') ? <SpinnerIcon className="w-5 h-5 mr-2" /> : null}
                            Salva Valutazione
                        </button>
                    </div>
                    {evaluationTemplate.sections.map(section => (
                        <div key={section.title} className="p-6 border-b border-border dark:border-dark-border last:border-b-0">
                            <h3 className="text-lg font-semibold text-primary mb-4">{section.title}</h3>
                            <table className="w-full">
                                <tbody>
                                    {section.skills.map(skill => (
                                        <SkillRow
                                            key={skill.id}
                                            skill={skill}
                                            value={answers[skill.id] || 0}
                                            onChange={handleAnswerChange}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-card dark:bg-dark-card rounded-lg shadow">
                    <p className="text-muted-foreground">Seleziona una risorsa e un valutatore per iniziare.</p>
                </div>
            )}
             <style>{`.form-select { display: block; width: 100%; border-radius: 0.375rem; border: 1px solid #D1D5DB; background-color: #FFFFFF; padding: 0.5rem 0.75rem; font-size: 0.875rem; line-height: 1.25rem; } .dark .form-select { border-color: #4B5563; background-color: #374151; color: #F9FAFB; }`}</style>
        </div>
    );
};

export default CompetenzePage;