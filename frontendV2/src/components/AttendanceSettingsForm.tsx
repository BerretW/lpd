import React, { useState, useEffect } from 'react';
import { getCookie, setCookie } from '../utils/cookies';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';

interface AttendanceSettingsFormProps {
  companyId: number;
}

const AttendanceSettingsForm: React.FC<AttendanceSettingsFormProps> = ({ companyId }) => {
    const cookieName = `profitechnik_lunch_settings_${companyId}`;
    const [startTime, setStartTime] = useState('12:00');
    const [endTime, setEndTime] = useState('12:30');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const savedSettings = getCookie(cookieName);
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.startTime && settings.endTime) {
                    setStartTime(settings.startTime);
                    setEndTime(settings.endTime);
                }
            } catch (e) {
                console.error("Failed to parse attendance settings cookie", e);
            }
        }
    }, [cookieName]);

    const handleSave = () => {
        const settings = { startTime, endTime };
        setCookie(cookieName, JSON.stringify(settings), 365);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="space-y-6">
            <div className="p-4 border rounded-lg bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-700 mb-4">Výchozí pauza na oběd</h3>
                <p className="text-sm text-slate-600 mb-4">
                    Nastavte výchozí čas, který se předvyplní při vkládání pauzy na oběd v docházce.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Začátek pauzy" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    <Input label="Konec pauzy" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
            </div>
            <div className="flex justify-end items-center pt-4 space-x-4">
                {saved && (
                    <span className="text-sm text-green-600 flex items-center">
                        <Icon name="fa-check-circle" className="mr-2"/> Nastavení uloženo.
                    </span>
                )}
                <Button type="button" onClick={handleSave}>Uložit nastavení</Button>
            </div>
        </div>
    );
};

export default AttendanceSettingsForm;
