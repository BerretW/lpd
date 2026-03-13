import React, { useState } from 'react';
import * as api from '../../api';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Modal from '../common/Modal';

interface InventoryWipePluginProps {
    companyId: number;
}

type WipeAction = 'items' | 'categories' | 'all';

const WIPE_CONFIG: Record<WipeAction, { label: string; description: string; confirmWord: string }> = {
    items: {
        label: 'Smazat všechny položky',
        description: 'Smaže všechny skladové položky včetně zásob na lokacích. Kategorie zůstanou zachovány.',
        confirmWord: 'POLOŽKY',
    },
    categories: {
        label: 'Smazat všechny kategorie',
        description: 'Smaže všechny kategorie. Funguje jen pokud neexistují žádné položky.',
        confirmWord: 'KATEGORIE',
    },
    all: {
        label: 'Smazat položky i kategorie',
        description: 'Kompletně vymaže celý sklad — všechny položky, zásoby i kategorie.',
        confirmWord: 'SMAZAT VŠE',
    },
};

const InventoryWipePlugin: React.FC<InventoryWipePluginProps> = ({ companyId }) => {
    const [pendingAction, setPendingAction] = useState<WipeAction | null>(null);
    const [confirmInput, setConfirmInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const openConfirm = (action: WipeAction) => {
        setConfirmInput('');
        setResultMessage(null);
        setPendingAction(action);
    };

    const closeConfirm = () => {
        setPendingAction(null);
        setConfirmInput('');
    };

    const handleWipe = async () => {
        if (!pendingAction) return;
        setLoading(true);
        try {
            if (pendingAction === 'items') await api.wipeInventoryItems(companyId);
            else if (pendingAction === 'categories') await api.wipeInventoryCategories(companyId);
            else await api.wipeInventoryAll(companyId);
            setResultMessage({ type: 'success', text: 'Operace proběhla úspěšně.' });
        } catch (e: any) {
            setResultMessage({ type: 'error', text: e.message ?? 'Neznámá chyba.' });
        } finally {
            setLoading(false);
            closeConfirm();
        }
    };

    const config = pendingAction ? WIPE_CONFIG[pendingAction] : null;
    const canConfirm = config ? confirmInput === config.confirmWord : false;

    return (
        <div>
            {resultMessage && (
                <div className={`mb-4 px-4 py-3 rounded-md text-sm font-medium ${resultMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {resultMessage.text}
                </div>
            )}

            <div className="border border-red-200 rounded-lg bg-red-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                    <Icon name="fa-exclamation-triangle" /> Nebezpečná zóna — tyto operace jsou nevratné
                </p>
                {(Object.entries(WIPE_CONFIG) as [WipeAction, typeof WIPE_CONFIG[WipeAction]][]).map(([action, cfg]) => (
                    <div key={action} className="flex items-center justify-between bg-white rounded-md px-4 py-3 border border-red-100">
                        <div>
                            <p className="font-medium text-slate-800 text-sm">{cfg.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{cfg.description}</p>
                        </div>
                        <Button
                            variant="secondary"
                            className="!bg-red-100 !text-red-700 hover:!bg-red-200 !text-xs ml-4 flex-shrink-0"
                            onClick={() => openConfirm(action)}
                        >
                            <Icon name="fa-trash" className="mr-1" /> Smazat
                        </Button>
                    </div>
                ))}
            </div>

            {pendingAction && config && (
                <Modal title="Potvrdit mazání" onClose={closeConfirm}>
                    <div className="text-slate-700 space-y-4">
                        <div className="text-center">
                            <Icon name="fa-exclamation-triangle" className="text-4xl text-red-500 mb-3" />
                        </div>
                        <p className="text-center font-semibold">{config.label}</p>
                        <p className="text-sm text-center text-slate-500">{config.description}</p>
                        <p className="text-sm text-center text-slate-700">
                            Pro potvrzení napište: <strong>{config.confirmWord}</strong>
                        </p>
                        <input
                            type="text"
                            value={confirmInput}
                            onChange={e => setConfirmInput(e.target.value)}
                            placeholder={config.confirmWord}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                            autoFocus
                        />
                        <div className="flex justify-center gap-3 pt-2">
                            <Button variant="secondary" onClick={closeConfirm} disabled={loading}>
                                Zrušit
                            </Button>
                            <Button
                                onClick={handleWipe}
                                disabled={!canConfirm || loading}
                                className="!bg-red-600 hover:!bg-red-700 disabled:!bg-red-200"
                            >
                                {loading ? 'Mazání...' : 'Potvrdit a smazat'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default InventoryWipePlugin;
