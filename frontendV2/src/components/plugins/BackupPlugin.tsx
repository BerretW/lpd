import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../../api';
import Button from '../common/Button';
import Icon from '../common/Icon';
import ConfirmModal from '../common/ConfirmModal';

// 1. Definujeme interface pro props
interface BackupPluginProps {
    companyId: number;
}

// 2. Přijímáme companyId v props
const BackupPlugin: React.FC<BackupPluginProps> = ({ companyId }) => {
    const [config, setConfig] = useState({ is_active: false, keep_count: 7 });
    const [files, setFiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [restoreFile, setRestoreFile] = useState<string | null>(null);

    // 3. Používáme companyId ve volání API
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [conf, fileList] = await Promise.all([
                api.getBackupConfig(companyId),
                api.getBackupFiles(companyId)
            ]);
            setConfig(conf);
            setFiles(fileList);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleSaveConfig = async () => {
        try {
            await api.updateBackupConfig(companyId, config);
            alert("Nastavení uloženo");
        } catch (e: any) {
            alert("Chyba: " + e.message);
        }
    };

    const handleRunBackup = async () => {
        setProcessing(true);
        try {
            await api.runBackup(companyId);
            await loadData();
        } catch (e: any) {
            // Oprava zobrazení chyby [object Object]
            const msg = e.message || JSON.stringify(e);
            alert("Chyba zálohování: " + msg);
        } finally {
            setProcessing(false);
        }
    };

    const handleRestore = async () => {
        if (!restoreFile) return;
        setProcessing(true);
        try {
            await api.restoreBackup(companyId, restoreFile);
            alert("Databáze byla úspěšně obnovena!");
            setRestoreFile(null);
        } catch (e: any) {
            alert("Chyba obnovy: " + e.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleDownload = (filename: string) => {
        const token = localStorage.getItem('authToken');
        // Zde voláme upravenou funkci s companyId
        fetch(api.getBackupDownloadUrl(companyId, filename), {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(async res => {
            if (!res.ok) throw new Error("Stažení selhalo");
            return res.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(e => alert(e.message));
    };

    // ... Zbytek renderu (JSX) zůstává stejný ...
    return (
        <div className="space-y-6">
            <div className="p-4 border rounded bg-slate-50">
                <h3 className="font-bold text-lg mb-4">Nastavení automatizace</h3>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                        <input 
                            type="checkbox" 
                            checked={config.is_active} 
                            onChange={e => setConfig({...config, is_active: e.target.checked})} 
                            className="mr-2"
                        />
                        Automaticky zálohovat denně (03:00)
                    </label>
                    <label className="flex items-center">
                        Držet posledních
                        <input 
                            type="number" 
                            value={config.keep_count} 
                            onChange={e => setConfig({...config, keep_count: parseInt(e.target.value)})}
                            className="w-16 mx-2 p-1 border rounded"
                        />
                        záloh
                    </label>
                    <Button onClick={handleSaveConfig} variant="secondary">Uložit nastavení</Button>
                </div>
            </div>

            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Dostupné zálohy</h3>
                <Button onClick={handleRunBackup} disabled={processing}>
                    <Icon name={processing ? "fa-spinner fa-spin" : "fa-plus"} className="mr-2"/> 
                    {processing ? "Vytvářím..." : "Vytvořit zálohu teď"}
                </Button>
            </div>

            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-200">
                        <th className="p-2">Soubor</th>
                        <th className="p-2">Vytvořeno</th>
                        <th className="p-2">Velikost</th>
                        <th className="p-2 text-right">Akce</th>
                    </tr>
                </thead>
                <tbody>
                    {files.map(f => (
                        <tr key={f.filename} className="border-b bg-white">
                            <td className="p-2">{f.filename}</td>
                            <td className="p-2">{new Date(f.created).toLocaleString()}</td>
                            <td className="p-2">{f.size_mb} MB</td>
                            <td className="p-2 text-right space-x-2">
                                <Button variant="secondary" className="!py-1 !px-2" onClick={() => handleDownload(f.filename)}>
                                    <Icon name="fa-download"/>
                                </Button>
                                <Button variant="secondary" className="!py-1 !px-2 !bg-red-100 !text-red-700" onClick={() => setRestoreFile(f.filename)}>
                                    <Icon name="fa-history"/> Obnovit
                                </Button>
                            </td>
                        </tr>
                    ))}
                    {files.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-500">Žádné zálohy</td></tr>}
                </tbody>
            </table>

            {restoreFile && (
                <ConfirmModal 
                    title="Obnovit databázi?" 
                    message={`POZOR: Obnova ze zálohy '${restoreFile}' přepíše aktuální data! Tato akce je nevratná.`}
                    confirmText="Ano, obnovit"
                    onConfirm={handleRestore}
                    onCancel={() => setRestoreFile(null)}
                />
            )}
        </div>
    );
};

export default BackupPlugin;