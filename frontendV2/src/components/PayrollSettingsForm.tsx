import React, { useState, useEffect } from 'react';
import { PayrollSettings } from '../types';
import Input from './common/Input';
import Icon from './common/Icon';

interface PayrollSettingsFormProps {
    settings: PayrollSettings;
    setSettings: React.Dispatch<React.SetStateAction<PayrollSettings>>;
}

const PayrollSettingsForm: React.FC<PayrollSettingsFormProps> = ({ settings, setSettings }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (field: keyof PayrollSettings, value: string) => {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
            const newSettings = { ...localSettings, [field]: numValue };
            setLocalSettings(newSettings);
            // In a real app, you might debounce this or have a save button
            // For this app, we'll save on change
            setSettings(newSettings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-semibold text-slate-700 mb-4 flex justify-between items-center">
                Konfigurace mzdových příplatků
                {saved && <span className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full"><Icon name="fa-check-circle" className="mr-2"/> Uloženo</span>}
            </h2>
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                <p className="text-sm text-slate-600">
                    Zde můžete nastavit procentuální příplatky k základní hodinové sazbě za práci za specifických podmínek.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Příplatek za přesčas (%)"
                        type="number"
                        value={localSettings.overtimeRate}
                        onChange={e => handleChange('overtimeRate', e.target.value)}
                        min="0"
                    />
                     <Input
                        label="Práh pro přesčas (hodin/den)"
                        type="number"
                        value={localSettings.overtimeThreshold}
                        onChange={e => handleChange('overtimeThreshold', e.target.value)}
                        min="0"
                    />
                    <Input
                        label="Příplatek za práci o víkendu (%)"
                        type="number"
                        value={localSettings.weekendRate}
                        onChange={e => handleChange('weekendRate', e.target.value)}
                        min="0"
                    />
                    <Input
                        label="Příplatek za práci ve svátek (%)"
                        type="number"
                        value={localSettings.holidayRate}
                        onChange={e => handleChange('holidayRate', e.target.value)}
                        min="0"
                    />
                    <Input
                        label="Příplatek za noční práci (%)"
                        type="number"
                        value={localSettings.nightRate}
                        onChange={e => handleChange('nightRate', e.target.value)}
                        min="0"
                    />
                </div>
            </div>
        </div>
    );
};

export default PayrollSettingsForm;
