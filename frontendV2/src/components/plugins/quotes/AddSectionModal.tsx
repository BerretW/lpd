import React, { useState } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

const AddSectionModal: React.FC<{
    onSave: (data: any) => void;
    onClose: () => void;
    isExtras?: boolean;
    suggestedNames?: string[];
}> = ({ onSave, onClose, isExtras, suggestedNames }) => {
    const [name, setName] = useState('');
    const [prefix, setPrefix] = useState('');

    return (
        <Modal title={isExtras ? 'Přidat sekci Vícepráce' : 'Přidat sekci'} onClose={onClose}>
            <div className="space-y-4">
                {suggestedNames && suggestedNames.length > 0 && (
                    <div>
                        <p className="text-xs font-medium text-slate-500 mb-2">Technologie objektu — kliknutím vyplnit:</p>
                        <div className="flex flex-wrap gap-2">
                            {suggestedNames.map((n: string) => (
                                <button key={n} type="button"
                                    onClick={() => setName(n)}
                                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${name === n ? 'bg-red-600 text-white border-red-600' : 'border-slate-300 text-slate-600 hover:border-red-400 hover:text-red-600'}`}>
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Název sekce *</label>
                    <input autoFocus className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={name} onChange={e => setName(e.target.value)}
                        placeholder="např. Elektroinstalace, Kamerový systém…" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Zkratka (prefix v PDF)</label>
                    <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={prefix} onChange={e => setPrefix(e.target.value.toUpperCase())}
                        placeholder="EL / CCTV / PZTS…" maxLength={10} />
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={() => { if (name.trim()) onSave({ name: name.trim(), prefix: prefix.trim() || null, is_extras: !!isExtras, sort_order: 0 }); }}>
                    Přidat sekci
                </Button>
            </div>
        </Modal>
    );
};

export default AddSectionModal;
