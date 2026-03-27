import React, { useState } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

const NewQuoteModal: React.FC<{
    clients: any[];
    siteId?: number;
    siteName?: string;
    initialCustomerId?: number;
    onSave: (data: any) => void;
    onClose: () => void;
}> = ({ clients, siteId, siteName, initialCustomerId, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: siteName ? `Nabídka - ${siteName}` : '',
        customer_id: initialCustomerId ? String(initialCustomerId) : '',
        prepared_by: '',
        prepared_by_phone: '',
        validity_days: 14,
        vat_rate: 21,
        global_discount: 0,
        global_discount_type: 'percent',
        global_hourly_rate: 0,
    });
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    return (
        <Modal title="Nová nabídka" onClose={onClose} size="lg">
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Název nabídky *</label>
                    <input autoFocus className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={form.name} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Zákazník</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
                            <option value="">— vyberte —</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Platnost (dní)</label>
                        <input type="number" min="1"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.validity_days} onChange={e => set('validity_days', parseInt(e.target.value) || 14)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Zpracoval</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.prepared_by} onChange={e => set('prepared_by', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Telefon</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.prepared_by_phone} onChange={e => set('prepared_by_phone', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">DPH (%)</label>
                        <input type="number"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.vat_rate} onChange={e => set('vat_rate', parseFloat(e.target.value) || 21)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Hodinová sazba montáže (Kč)</label>
                        <input type="number"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.global_hourly_rate} onChange={e => set('global_hourly_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
                <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                <Button onClick={() => {
                    if (!form.name.trim()) return;
                    onSave({
                        ...form,
                        customer_id: form.customer_id ? parseInt(form.customer_id) : null,
                        site_id: siteId ?? null,
                    });
                }}>Vytvořit nabídku</Button>
            </div>
        </Modal>
    );
};

export default NewQuoteModal;
