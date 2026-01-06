
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LocationOut, InventoryItemOut, CategoryOut } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import * as api from '../api';
import InventoryForm from './InventoryForm';
import ErrorMessage from './common/ErrorMessage';

interface EanTerminalProps {
    companyId: number;
    onClose: () => void;
    categories: CategoryOut[];
}

interface LogEntry {
    id: number;
    timestamp: Date;
    type: 'success' | 'error' | 'info';
    message: string;
}

const EanTerminal: React.FC<EanTerminalProps> = ({ companyId, onClose, categories }) => {
    const [locations, setLocations] = useState<LocationOut[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState<string>(localStorage.getItem('ean_terminal_location') || '');
    const [eanInput, setEanInput] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pendingEan, setPendingEan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        api.getMyLocations(companyId).then(data => {
            setLocations(data);
            if (!selectedLocationId && data.length > 0) {
                const first = String(data[0].id);
                setSelectedLocationId(first);
                localStorage.setItem('ean_terminal_location', first);
            }
        });
    }, [companyId]);

    const addLog = (type: LogEntry['type'], message: string) => {
        setLogs(prev => [{ id: Date.now(), timestamp: new Date(), type, message }, ...prev].slice(0, 50));
    };

    const processEan = useCallback(async (ean: string) => {
        if (!selectedLocationId) {
            setError("Nejprve vyberte cílovou lokaci.");
            return;
        }
        setIsProcessing(true);
        setError(null);
        addLog('info', `Hledám EAN: ${ean}...`);

        try {
            const item = await api.getInventoryItemByEan(companyId, ean);
            // Položka existuje -> naskladnit
            await api.placeStock(companyId, {
                inventory_item_id: item.id,
                location_id: parseInt(selectedLocationId),
                quantity: 1,
                details: "Skladový automat (EAN Terminál)"
            });
            addLog('success', `NASKLADNĚNO: ${item.name} (+1 ks)`);
            setEanInput('');
        } catch (err) {
            // Nenalezeno -> spustit flow vytvoření
            addLog('error', `EAN ${ean} neexistuje. Otevírám dialog pro novou kartu.`);
            setPendingEan(ean);
            setShowCreateModal(true);
        } finally {
            setIsProcessing(false);
            inputRef.current?.focus();
        }
    }, [companyId, selectedLocationId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && eanInput.trim()) {
            processEan(eanInput.trim());
        }
    };

    const handleCreateNewItem = async (formData: any) => {
        try {
            setIsProcessing(true);
            const newItem = await api.createInventoryItem(companyId, formData);
            await api.placeStock(companyId, {
                inventory_item_id: newItem.id,
                location_id: parseInt(selectedLocationId),
                quantity: 1,
                details: "Skladový automat (EAN Terminál - nová karta)"
            });
            addLog('success', `VYTVOŘENO A NASKLADNĚNO: ${newItem.name} (+1 ks)`);
            setShowCreateModal(false);
            setPendingEan(null);
            setEanInput('');
        } catch (err) {
            setError("Nepodařilo se vytvořit a naskladnit novou položku.");
        } finally {
            setIsProcessing(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedLocationId(val);
        localStorage.setItem('ean_terminal_location', val);
        inputRef.current?.focus();
    };

    return (
        <Modal title="Skladový automat (EAN Terminál)" onClose={onClose}>
            <div className="space-y-6">
                <div className="p-4 bg-gray-900 rounded-lg border-2 border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Cílová lokace</label>
                            <select 
                                value={selectedLocationId} 
                                onChange={handleLocationChange}
                                className="w-full bg-gray-800 text-white border-gray-600 rounded p-2 focus:ring-red-500"
                            >
                                <option value="">-- Vybrat lokaci --</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <div className="w-full relative">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Čekám na sken...</label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={eanInput}
                                    onChange={e => setEanInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={isProcessing}
                                    autoFocus
                                    placeholder="Naskenujte čárový kód"
                                    className="w-full bg-gray-800 text-white border-2 border-red-900 rounded p-3 text-xl font-mono focus:border-red-500 outline-none"
                                />
                                {isProcessing && <div className="absolute right-3 top-9"><Icon name="fa-spinner fa-spin" className="text-red-500" /></div>}
                            </div>
                        </div>
                    </div>
                </div>

                <ErrorMessage message={error} />

                <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Log operací</h3>
                    <div className="bg-slate-50 border rounded-lg h-64 overflow-y-auto font-mono text-sm p-2 space-y-1">
                        {logs.length === 0 && <p className="text-slate-400 italic text-center pt-24">Zatím žádná aktivita.</p>}
                        {logs.map(log => (
                            <div key={log.id} className={`p-1.5 rounded border-l-4 ${
                                log.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
                                log.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
                                'bg-blue-50 border-blue-500 text-blue-800'
                            }`}>
                                <span className="text-xs opacity-50 mr-2">{log.timestamp.toLocaleTimeString()}</span>
                                {log.message}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button onClick={onClose} variant="secondary">Zavřít terminál</Button>
                </div>
            </div>

            {showCreateModal && (
                <Modal title="EAN nebyl nalezen - vytvořit novou kartu?" onClose={() => { setShowCreateModal(false); setPendingEan(null); setEanInput(''); }}>
                    <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded border border-blue-200">
                        <Icon name="fa-info-circle mr-2" />
                        Naskenovaný EAN: <strong>{pendingEan}</strong>. Vyplňte prosím název a SKU pro novou položku.
                    </div>
                    <InventoryForm 
                        onSave={handleCreateNewItem} 
                        onCancel={() => { setShowCreateModal(false); setPendingEan(null); setEanInput(''); }}
                        companyId={companyId}
                        categories={categories}
                        initialEan={pendingEan || undefined}
                    />
                </Modal>
            )}
        </Modal>
    );
};

export default EanTerminal;
