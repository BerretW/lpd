import React, { useState, useEffect } from 'react';
import { InventoryItem, AuditLogOut, AuditLogAction } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import * as api from '../api';

interface InventoryHistoryModalProps {
    companyId: number;
    item: InventoryItem;
    onClose: () => void;
}

const actionTranslations: Record<AuditLogAction, string> = {
    [AuditLogAction.Created]: "Vytvořeno",
    [AuditLogAction.Updated]: "Upraveno",
    [AuditLogAction.Deleted]: "Smazáno",
    [AuditLogAction.QuantityAdjusted]: "Úprava množství",
    [AuditLogAction.LocationPlaced]: "Naskladněno na lokaci",
    [AuditLogAction.LocationWithdrawn]: "Vyskladněno z lokace",
    [AuditLogAction.LocationTransferred]: "Přesun mezi lokacemi",
    [AuditLogAction.WriteOff]: "Odpis",
    [AuditLogAction.PickingFulfilled]: "Výdej na žádanku"
};

const actionColors: Record<AuditLogAction, string> = {
    [AuditLogAction.Created]: "text-green-600",
    [AuditLogAction.Updated]: "text-blue-600",
    [AuditLogAction.Deleted]: "text-red-600",
    [AuditLogAction.QuantityAdjusted]: "text-orange-600",
    [AuditLogAction.LocationPlaced]: "text-green-600",
    [AuditLogAction.LocationWithdrawn]: "text-red-600",
    [AuditLogAction.LocationTransferred]: "text-blue-600",
    [AuditLogAction.WriteOff]: "text-red-700 font-bold",
    [AuditLogAction.PickingFulfilled]: "text-purple-600"
};

const InventoryHistoryModal: React.FC<InventoryHistoryModalProps> = ({ companyId, item, onClose }) => {
    const [logs, setLogs] = useState<AuditLogOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const data = await api.getInventoryHistory(companyId, item.id);
                // Seřadíme od nejnovějšího
                setLogs(data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Nepodařilo se načíst historii.");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [companyId, item.id]);

    return (
        <Modal title={`Historie pohybů: ${item.name}`} onClose={onClose}>
            <div className="space-y-4 min-h-[400px]">
                {error && (
                    <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">
                        <Icon name="fa-exclamation-circle" className="mr-2"/> {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Icon name="fa-spinner fa-spin" className="text-3xl text-slate-400" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Icon name="fa-history" className="text-4xl mb-3" />
                        <p>Pro tuto položku neexistují žádné záznamy v historii.</p>
                    </div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Datum</th>
                                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Akce</th>
                                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Uživatel</th>
                                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Detail</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {logs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                                            {new Date(log.timestamp).toLocaleString('cs-CZ')}
                                        </td>
                                        <td className={`px-4 py-2 whitespace-nowrap font-medium ${actionColors[log.action] || 'text-slate-700'}`}>
                                            {actionTranslations[log.action] || log.action}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-slate-700">
                                            {log.user?.email || 'Systém'}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">
                                            {log.details || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <Button variant="secondary" onClick={onClose}>Zavřít</Button>
                </div>
            </div>
        </Modal>
    );
};

export default InventoryHistoryModal;