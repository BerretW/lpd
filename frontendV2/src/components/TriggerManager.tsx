import React, { useState, useEffect, useCallback } from 'react';
import { TriggerOut, TriggerType, TriggerCondition, TriggerCreateIn, TriggerUpdateIn } from '../types';
import Button from './common/Button';
import Icon from './common/Icon';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';
import Input from './common/Input';

interface TriggerManagerProps {
    companyId: number;
}

interface TriggerFormProps {
    companyId: number;
    trigger: TriggerOut | null;
    triggerType: TriggerType;
    title: string;
    description: string;
    condition?: TriggerCondition;
    thresholdLabel?: string;
    thresholdSuffix?: string;
    onSave: () => void;
}

const TriggerForm: React.FC<TriggerFormProps> = ({ companyId, trigger, triggerType, title, description, condition, thresholdLabel, thresholdSuffix, onSave }) => {
    const [isActive, setIsActive] = useState(trigger?.is_active || false);
    const [threshold, setThreshold] = useState(trigger?.threshold_value?.toString() || '');
    const [recipients, setRecipients] = useState(trigger?.recipient_emails?.join(', ') || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const recipient_emails = recipients.split(',').map(e => e.trim()).filter(Boolean);
            if (recipient_emails.length === 0) {
                setError('Zadejte alespoň jednoho příjemce.');
                setSaving(false);
                return;
            }

            const payload: TriggerCreateIn & TriggerUpdateIn = {
                is_active: isActive,
                trigger_type: triggerType,
                recipient_emails,
                condition: condition,
                threshold_value: threshold ? parseFloat(threshold) : undefined,
            };
            
            if (trigger) {
                await api.updateTrigger(companyId, trigger.id, payload);
            } else {
                await api.createTrigger(companyId, payload);
            }
            onSave(); // Notify parent to refetch
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení se nezdařilo.');
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <div className="p-4 border rounded-lg bg-slate-50 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
                    <p className="text-sm text-slate-600">{description}</p>
                </div>
                <div className="flex items-center">
                    <label htmlFor={`active-toggle-${triggerType}`} className="mr-2 font-medium text-sm text-slate-700">{isActive ? 'Aktivní' : 'Neaktivní'}</label>
                    <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id={`active-toggle-${triggerType}`} checked={isActive} onChange={e => setIsActive(e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                        <label htmlFor={`active-toggle-${triggerType}`} className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                    </div>
                </div>
            </div>
            
            <div className={`space-y-4 ${!isActive ? 'opacity-50 pointer-events-none' : ''}`}>
                <ErrorMessage message={error} />
                {thresholdLabel && (
                    <div className="relative">
                        <Input 
                            label={thresholdLabel}
                            type="number"
                            step="0.1"
                            value={threshold}
                            onChange={e => setThreshold(e.target.value)}
                            className="pr-12"
                        />
                        {thresholdSuffix && <span className="absolute right-3 bottom-2 text-slate-500">{thresholdSuffix}</span>}
                    </div>
                )}
                 <Input 
                    label="Příjemci notifikací (oddělit čárkou)"
                    value={recipients}
                    onChange={e => setRecipients(e.target.value)}
                />
                <div className="text-right">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Ukládání...' : 'Uložit nastavení'}
                    </Button>
                </div>
            </div>
             <style>{`.toggle-checkbox:checked { right: 0; border-color: #ef4444; } .toggle-checkbox:checked + .toggle-label { background-color: #ef4444; }`}</style>
        </div>
    );
};


const TriggerManager: React.FC<TriggerManagerProps> = ({ companyId }) => {
    const [triggers, setTriggers] = useState<TriggerOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setTriggers(await api.getTriggers(companyId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Nepodařilo se načíst notifikační pravidla.');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) return <p>Načítání...</p>;

    const budgetTrigger = triggers.find(t => t.trigger_type === TriggerType.WorkOrderBudget) || null;
    const stockTrigger = triggers.find(t => t.trigger_type === TriggerType.InventoryLowStock) || null;
    
    return (
        <div className="space-y-6">
             <ErrorMessage message={error} />
             <TriggerForm
                companyId={companyId}
                trigger={budgetTrigger}
                triggerType={TriggerType.WorkOrderBudget}
                title="Hlídání rozpočtu zakázek"
                description="Odeslat e-mail, když odpracované hodiny na zakázce přesáhnou stanovené procento z jejího rozpočtu."
                condition={TriggerCondition.PercentageReached}
                thresholdLabel="Upozornit při dosažení"
                thresholdSuffix="%"
                onSave={fetchData}
            />

            <TriggerForm
                companyId={companyId}
                trigger={stockTrigger}
                triggerType={TriggerType.InventoryLowStock}
                title="Hlídání nízkého stavu zásob"
                description="Odeslat e-mail, když celkové množství skladové položky, která má zapnuté hlídání, klesne pod její nastavený práh."
                onSave={fetchData}
            />
        </div>
    );
};

export default TriggerManager;
