import React, { useState } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import { CategoryAssembly, QuoteItem } from './types';
import { fmtPrice } from './utils';
import InventoryPicker from './InventoryPicker';

const AddItemModal: React.FC<{
    companyId: number;
    categoryAssemblies: CategoryAssembly[];
    onSave: (data: Partial<QuoteItem>) => void;
    onClose: () => void;
    initial?: Partial<QuoteItem>;
}> = ({ companyId, categoryAssemblies, onSave, onClose, initial }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [form, setForm] = useState<Partial<QuoteItem>>({
        name: '', unit: 'ks', quantity: 1, material_price: 0, assembly_price: 0,
        is_reduced_work: false, ...initial,
    });

    const set = (k: keyof QuoteItem, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleSelectInventory = (item: any) => {
        setForm(f => ({
            ...f,
            name: item.name,
            material_price: item.price ?? 0,
            inventory_item_id: item.id,
            inventory_category_name: item.categories?.[0]?.name ?? undefined,
        }));
        const cat = item.categories?.[0]?.name;
        if (cat) {
            const ca = categoryAssemblies.find(c => c.category_name === cat);
            if (ca) setForm(f => ({ ...f, assembly_price: ca.assembly_price_per_unit }));
        }
        setShowPicker(false);
    };

    const pricePerUnit = (form.material_price ?? 0) + (form.assembly_price ?? 0);
    const total = (form.quantity ?? 0) * pricePerUnit;

    return (
        <>
            <Modal title={initial?.id ? 'Upravit položku' : 'Přidat položku'} onClose={onClose} size="lg">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-600 mb-1">Název položky *</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Název…" />
                        </div>
                        <Button variant="secondary" onClick={() => setShowPicker(true)} className="self-end">
                            <Icon name="fa-warehouse" className="mr-1" />Sklad
                        </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Množství</label>
                            <input type="number" min="0" step="any"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                value={form.quantity ?? ''} onChange={e => set('quantity', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">M.j.</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                value={form.unit ?? 'ks'} onChange={e => set('unit', e.target.value)} placeholder="ks / m / kpl" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Kategorie (montáž)</label>
                            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                value={form.inventory_category_name ?? ''}
                                onChange={e => set('inventory_category_name', e.target.value)}
                                placeholder="Kategorie…" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cena materiálu / ks (Kč)</label>
                            <input type="number" min="0" step="0.01"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                value={form.material_price ?? ''} onChange={e => set('material_price', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Cena montáže / ks (Kč)</label>
                            <input type="number" min="0" step="0.01"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                value={form.assembly_price ?? ''} onChange={e => set('assembly_price', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
                        <span className="text-slate-500">Cena/ks: <b className="text-slate-800">{fmtPrice(pricePerUnit)}</b></span>
                        <span className="text-slate-500">Celkem: <b className="text-red-600">{fmtPrice(total)}</b></span>
                    </div>

                    <div
                        className={`rounded-lg border px-3 py-2.5 cursor-pointer select-none transition-colors ${form.is_reduced_work ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50 border-slate-200 hover:border-yellow-300'}`}
                        onClick={() => set('is_reduced_work', !(form.is_reduced_work ?? false))}>
                        <div className="flex items-center gap-2.5">
                            <input type="checkbox" checked={form.is_reduced_work ?? false}
                                onChange={e => set('is_reduced_work', e.target.checked)}
                                onClick={e => e.stopPropagation()}
                                className="w-4 h-4 rounded accent-yellow-500 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-slate-700">Méněpráce</p>
                                <p className="text-xs text-slate-500">Položka bude odečtena od ceny sekce jako zákazníkova úspora</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button onClick={() => { if (form.name?.trim()) onSave(form); }}>
                        {initial?.id ? 'Uložit' : 'Přidat položku'}
                    </Button>
                </div>
            </Modal>
            {showPicker && <InventoryPicker companyId={companyId} onSelect={handleSelectInventory} onClose={() => setShowPicker(false)} />}
        </>
    );
};

export default AddItemModal;
