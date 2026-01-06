
import React, { useState, useEffect } from 'react';
import { VatSettings } from '../types';
import Input from './common/Input';
import Icon from './common/Icon';

interface VatSettingsFormProps {
    settings: VatSettings;
    setSettings: React.Dispatch<React.SetStateAction<VatSettings>>;
}

const VatSettingsForm: React.FC<VatSettingsFormProps> = ({ settings, setSettings }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (field: keyof VatSettings, value: string) => {
        const numValue = Number(value);
        if (!isNaN(numValue)) {
            const newSettings = { ...localSettings, [field]: numValue };
            setLocalSettings(newSettings);
            setSettings(newSettings); // Save immediately
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    return (
        <div>
            <h2 className="text-2xl font-semibold text-slate-700 mb-4 flex justify-between items-center">
                Nastavení DPH
                {saved && <span className="text-sm text-green-600 bg-green-100 px-3 py-1 rounded-full"><Icon name="fa-check-circle" className="mr-2"/> Uloženo</span>}
            </h2>
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50">
                <p className="text-sm text-slate-600">
                    Nastavte výchozí sazby DPH pro materiál a práci. Tyto sazby budou použity při generování faktur. Všechny ceny v systému jsou zadávány bez DPH.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input
                        label="Sazba DPH na materiál (%)"
                        type="number"
                        value={localSettings.materialRate}
                        onChange={e => handleChange('materialRate', e.target.value)}
                        min="0"
                    />
                    <Input
                        label="Sazba DPH na práci (%)"
                        type="number"
                        value={localSettings.laborRate}
                        onChange={e => handleChange('laborRate', e.target.value)}
                        min="0"
                    />
                </div>
            </div>
        </div>
    );
};

export default VatSettingsForm;
