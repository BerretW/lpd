
import React, { useState, useEffect } from 'react';
import { WorkType } from '../types';
import Input from './common/Input';
import Button from './common/Button';

interface WorkRateFormProps {
  onSave: (rateData: Omit<WorkType, 'id' | 'company_id'>) => void;
  onCancel: () => void;
  workRate: WorkType | null;
}

const WorkRateForm: React.FC<WorkRateFormProps> = ({ onSave, onCancel, workRate }) => {
    const [name, setName] = useState('');
    const [rate, setRate] = useState(0);

    useEffect(() => {
        if (workRate) {
            setName(workRate.name);
            setRate(workRate.rate);
        }
    }, [workRate]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name, rate });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                label="Název sazby / druhu práce"
                value={name}
                onChange={e => setName(e.target.value)}
                required
            />
            <Input
                label="Hodinová sazba bez DPH (Kč)"
                type="number"
                value={rate}
                onChange={e => setRate(Number(e.target.value))}
                required
                min="0"
            />
            <div className="flex justify-end pt-4 space-x-2">
                <Button type="button" variant="secondary" onClick={onCancel}>Zrušit</Button>
                <Button type="submit">Uložit sazbu</Button>
            </div>
        </form>
    );
};

export default WorkRateForm;
