
import React, { useState, useEffect } from 'react';
import { SmtpSettingsOut, SmtpSettingsIn } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';

interface SmtpSettingsFormProps {
    companyId: number;
}

const SmtpSettingsForm: React.FC<SmtpSettingsFormProps> = ({ companyId }) => {
    const [settings, setSettings] = useState<Partial<SmtpSettingsIn>>({});
    const [password, setPassword] = useState('');
    const [passwordIsSet, setPasswordIsSet] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [testSuccess, setTestSuccess] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                const data = await api.getSmtpSettings(companyId);
                setSettings({
                    smtp_host: data.smtp_host,
                    smtp_port: data.smtp_port,
                    smtp_user: data.smtp_user,
                    sender_email: data.sender_email,
                    security_protocol: data.security_protocol,
                    notification_settings: data.notification_settings,
                });
                setPasswordIsSet(data.password_is_set);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nepodařilo se načíst SMTP nastavení.');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [companyId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            notification_settings: {
                ...(prev.notification_settings || { on_invite_created: false, on_budget_alert: false, on_low_stock_alert: false }),
                [name]: checked,
            },
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSaveSuccess(false);

        const portValue = settings.smtp_port;
        const parsedPort = (portValue === null || portValue === undefined || String(portValue).trim() === '')
            ? null
            : parseInt(String(portValue), 10);

        if (parsedPort !== null && isNaN(parsedPort)) {
            setError('Port musí být platné číslo.');
            setSaving(false);
            return;
        }

        // FIX: If a username is provided, but no password has ever been set (passwordIsSet is false)
        // and the user isn't providing one now, block the save to prevent a server error.
        if (settings.smtp_user && !password && !passwordIsSet) {
            setError("Pokud zadáváte uživatelské jméno, musíte také zadat heslo.");
            setSaving(false);
            return;
        }

        const payload: SmtpSettingsIn = { 
            ...settings,
            is_enabled: true,
            smtp_port: parsedPort,
        };
        if (password) {
            payload.smtp_password = password;
        }

        try {
            await api.updateSmtpSettings(companyId, payload);
            setSaveSuccess(true);
            if (password) {
                setPassword('');
                setPasswordIsSet(true);
            }
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení selhalo.');
        } finally {
            setSaving(false);
        }
    };
    
    const handleTest = async () => {
        setTesting(true);
        setError(null);
        setTestSuccess(null);
        try {
            const result = await api.testSmtpSettings(companyId);
            setTestSuccess(result.message);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Testovací e-mail se nepodařilo odeslat.');
        } finally {
            setTesting(false);
        }
    }

    if (loading) return <p>Načítání...</p>;

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <ErrorMessage message={error} />
            <div className="p-4 border rounded-lg bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Připojení k serveru</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     <Input label="SMTP Host" name="smtp_host" value={settings.smtp_host || ''} onChange={handleInputChange} />
                     <Input label="Port" type="number" name="smtp_port" value={settings.smtp_port || ''} onChange={handleInputChange} />
                     <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">Zabezpečení</label>
                         <select name="security_protocol" value={settings.security_protocol || 'none'} onChange={handleInputChange} className="w-full p-2 border rounded">
                             <option value="none">Žádné</option>
                             <option value="tls">TLS/STARTTLS</option>
                             <option value="ssl">SSL</option>
                         </select>
                     </div>
                 </div>
            </div>
             <div className="p-4 border rounded-lg bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Přihlašovací údaje</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Input label="Uživatelské jméno" name="smtp_user" value={settings.smtp_user || ''} onChange={handleInputChange} />
                     <Input label="Heslo" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={passwordIsSet ? 'Heslo je uloženo, pro změnu zadejte nové' : ''} />
                     <Input label="E-mail odesílatele" type="email" name="sender_email" value={settings.sender_email || ''} onChange={handleInputChange} />
                 </div>
             </div>
            <div className="p-4 border rounded-lg bg-slate-50">
                 <h3 className="text-lg font-semibold text-slate-700 mb-2">Aktivní e-mailové notifikace</h3>
                 <div className="space-y-2">
                     <div className="flex items-center"><input type="checkbox" id="on_invite_created" name="on_invite_created" checked={settings.notification_settings?.on_invite_created || false} onChange={handleNotificationChange} className="h-4 w-4 rounded" /><label htmlFor="on_invite_created" className="ml-2">Při pozvání nového zaměstnance</label></div>
                     <div className="flex items-center"><input type="checkbox" id="on_budget_alert" name="on_budget_alert" checked={settings.notification_settings?.on_budget_alert || false} onChange={handleNotificationChange} className="h-4 w-4 rounded" /><label htmlFor="on_budget_alert" className="ml-2">Při dosažení prahu rozpočtu na zakázce</label></div>
                     <div className="flex items-center"><input type="checkbox" id="on_low_stock_alert" name="on_low_stock_alert" checked={settings.notification_settings?.on_low_stock_alert || false} onChange={handleNotificationChange} className="h-4 w-4 rounded" /><label htmlFor="on_low_stock_alert" className="ml-2">Při nízkém stavu zásob</label></div>
                 </div>
            </div>
            
            {testSuccess && <p className="text-green-700 bg-green-100 p-3 rounded-md">{testSuccess}</p>}
            
            <div className="flex justify-end items-center pt-4 space-x-4">
                {saveSuccess && <span className="text-sm text-green-600 flex items-center"><Icon name="fa-check-circle" className="mr-2"/> Uloženo.</span>}
                <Button type="button" variant="secondary" onClick={handleTest} disabled={testing || saving}>
                    {testing ? 'Testuji...' : 'Otestovat odeslání'}
                </Button>
                <Button type="submit" disabled={saving || testing}>
                    {saving ? 'Ukládání...' : 'Uložit nastavení SMTP'}
                </Button>
            </div>
        </form>
    );
};

export default SmtpSettingsForm;
