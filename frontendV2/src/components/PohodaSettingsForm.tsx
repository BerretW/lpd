import React, { useState, useEffect } from 'react';
import { PohodaSettingsIn } from '../types';
import Input from './common/Input';
import Button from './common/Button';
import Icon from './common/Icon';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';

interface PohodaSettingsFormProps {
    companyId: number;
}

const PohodaSettingsForm: React.FC<PohodaSettingsFormProps> = ({ companyId }) => {
    const [settings, setSettings] = useState<Partial<PohodaSettingsIn>>({});
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            setLoading(true);
            try {
                // Poznámka: Backend musí mít implementovaný endpoint GET /companies/{id}/pohoda/settings
                // Pokud ho nemáte, formulář nebude moci načíst data.
                const data = await api.getPohodaSettings(companyId);
                setSettings({
                    is_enabled: data.is_enabled,
                    mserver_url: data.mserver_url,
                    mserver_user: data.mserver_user,
                    ico_of_accounting_entity: data.ico_of_accounting_entity
                });
                // Heslo nenačítáme z bezpečnostních důvodů
            } catch (err) {
                // Pokud endpoint neexistuje (např. při prvním spuštění), jen potlačíme chybu
                console.warn('Nepodařilo se načíst nastavení Pohody (možná ještě neexistuje).');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, [companyId]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSaveSuccess(false);

        const payload: PohodaSettingsIn = {
            is_enabled: settings.is_enabled || false,
            mserver_url: settings.mserver_url,
            mserver_user: settings.mserver_user,
            ico_of_accounting_entity: settings.ico_of_accounting_entity,
            mserver_password: password || undefined // Pošleme jen pokud bylo zadáno nové
        };

        try {
            await api.updatePohodaSettings(companyId, payload);
            setSaveSuccess(true);
            setPassword(''); // Vyčistit pole hesla
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Uložení selhalo.');
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        setError(null);
        try {
            // Jako test použijeme pokus o synchronizaci klientů
            const res = await api.syncClientsFromPohoda(companyId);
            setTestResult({ success: true, message: res.message || "Spojení navázáno." });
        } catch (err) {
            setTestResult({ success: false, message: err instanceof Error ? err.message : "Spojení selhalo." });
        } finally {
            setTesting(false);
        }
    };

    if (loading) return <p>Načítání...</p>;

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <ErrorMessage message={error} />
            
            <div className="p-4 border rounded-lg bg-slate-50">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-700">Konfigurace mServeru (HTTP)</h3>
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="is_enabled"
                            name="is_enabled"
                            checked={settings.is_enabled || false}
                            onChange={handleInputChange}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                        <label htmlFor="is_enabled" className="ml-2 block text-sm text-slate-900 font-medium">
                            Aktivovat integraci
                        </label>
                    </div>
                </div>

                <div className={`space-y-4 ${!settings.is_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="grid grid-cols-1 gap-4">
                        <Input 
                            label="URL mServeru" 
                            name="mserver_url" 
                            value={settings.mserver_url || ''} 
                            onChange={handleInputChange} 
                            placeholder="http://verejna-ip:4444/xml"
                        />
                        <p className="text-xs text-slate-500 -mt-3">
                            Adresa, na které naslouchá Pohoda mServer. Musí být dostupná z tohoto serveru.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="Uživatel (HTTP Basic Auth)" 
                            name="mserver_user" 
                            value={settings.mserver_user || ''} 
                            onChange={handleInputChange} 
                            placeholder="Admin"
                        />
                        <Input 
                            label="Heslo" 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder={settings.mserver_user ? 'Zadejte pro změnu' : ''} 
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input 
                            label="IČO Účetní jednotky" 
                            name="ico_of_accounting_entity" 
                            value={settings.ico_of_accounting_entity || ''} 
                            onChange={handleInputChange} 
                            placeholder="Vyplňte, pokud se liší od IČO firmy"
                        />
                    </div>
                </div>
            </div>

            {testResult && (
                <div className={`p-3 rounded-md ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <Icon name={testResult.success ? "fa-check-circle" : "fa-exclamation-triangle"} className="mr-2" />
                    {testResult.message}
                </div>
            )}

            <div className="flex justify-end items-center pt-4 space-x-4">
                {saveSuccess && (
                    <span className="text-sm text-green-600 flex items-center">
                        <Icon name="fa-check-circle" className="mr-2"/> Uloženo.
                    </span>
                )}
                
                <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={handleTestConnection} 
                    disabled={testing || !settings.is_enabled || !settings.mserver_url}
                >
                    {testing ? <><Icon name="fa-spinner fa-spin" className="mr-2"/> Testuji...</> : 'Otestovat spojení'}
                </Button>

                <Button type="submit" disabled={saving}>
                    {saving ? 'Ukládání...' : 'Uložit nastavení'}
                </Button>
            </div>
        </form>
    );
};

export default PohodaSettingsForm;