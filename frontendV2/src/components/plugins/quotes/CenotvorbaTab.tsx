import React, { useState, useEffect } from 'react';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import * as quotesApi from '../../../api/quotes';
import { CategoryAssembly, Quote } from './types';

const CenotvorbaTab: React.FC<{
    quote: Quote;
    companyId: number;
    onRefresh: () => void;
    parentQuote?: Quote;
}> = ({ quote, companyId, onRefresh, parentQuote }) => {
    const pricing = parentQuote ?? quote;
    const [form, setForm] = useState({
        validity_days: quote.validity_days,
        currency: quote.currency,
        vat_rate: pricing.vat_rate,
        global_discount: pricing.global_discount,
        global_discount_type: pricing.global_discount_type,
        global_hourly_rate: pricing.global_hourly_rate,
        prepared_by: quote.prepared_by ?? '',
        prepared_by_phone: quote.prepared_by_phone ?? '',
        notes: quote.notes ?? '',
    });
    const [assemblies, setAssemblies] = useState<CategoryAssembly[]>(parentQuote ? parentQuote.category_assemblies : quote.category_assemblies);
    const [saving, setSaving] = useState(false);

    const usedCategories = Array.from(new Set(
        quote.sections.flatMap(s => s.items.map(i => i.inventory_category_name)).filter(Boolean) as string[]
    ));

    useEffect(() => {
        setAssemblies(prev => {
            const existing = new Set(prev.map(a => a.category_name));
            const newEntries = usedCategories
                .filter(c => !existing.has(c))
                .map(c => ({ id: -Date.now() - Math.random(), quote_id: quote.id, category_name: c, assembly_price_per_unit: quote.global_hourly_rate, vat_rate: pricing.vat_rate }));
            return [...prev, ...newEntries];
        });
    }, [usedCategories.join(',')]);

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await quotesApi.updateQuote(companyId, quote.id, form);
            const cleanAssemblies = assemblies.map(({ category_name, assembly_price_per_unit, vat_rate }) => ({ category_name, assembly_price_per_unit, vat_rate }));
            await quotesApi.upsertCategoryAssemblies(companyId, quote.id, cleanAssemblies);

            const updatePromises: Promise<any>[] = [];
            for (const section of quote.sections) {
                for (const item of section.items) {
                    if (!item.inventory_category_name) continue;
                    const match = cleanAssemblies.find((a: { category_name: string; assembly_price_per_unit: number }) => a.category_name === item.inventory_category_name);
                    if (match && item.assembly_price !== match.assembly_price_per_unit) {
                        updatePromises.push(
                            quotesApi.updateItem(companyId, quote.id, section.id, item.id, { assembly_price: match.assembly_price_per_unit })
                        );
                    }
                }
            }
            if (updatePromises.length > 0) await Promise.all(updatePromises);

            onRefresh();
        } catch (err) { console.error(err); } finally { setSaving(false); }
    };

    return (
        <div className="space-y-6">
            {parentQuote && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                    <Icon name="fa-link" className="shrink-0" />
                    <span>Cenotvorba (DPH, sleva, sazby montáže) je zděděna z hlavní nabídky <strong>{parentQuote.name}</strong> a nelze ji zde měnit.</span>
                </div>
            )}
            <div>
                <h3 className="font-semibold text-slate-700 mb-3">Základní nastavení</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Zpracoval</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.prepared_by} onChange={e => set('prepared_by', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Telefon zpracovatele</label>
                        <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.prepared_by_phone} onChange={e => set('prepared_by_phone', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Platnost nabídky (dní)</label>
                        <input type="number" min="1"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.validity_days} onChange={e => set('validity_days', parseInt(e.target.value) || 14)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Měna</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.currency} onChange={e => set('currency', e.target.value)}>
                            <option value="CZK">CZK</option>
                            <option value="EUR">EUR</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Sazba DPH (%)</label>
                        <input type="number" min="0" max="100" disabled={!!parentQuote}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                            value={form.vat_rate} onChange={e => set('vat_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Globální hodinová sazba (Kč)</label>
                        <input type="number" min="0" disabled={!!parentQuote}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                            value={form.global_hourly_rate} onChange={e => set('global_hourly_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-slate-700 mb-3">Sleva</h3>
                <div className="flex items-center gap-3">
                    <input type="number" min="0" disabled={!!parentQuote}
                        className="w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                        value={form.global_discount} onChange={e => set('global_discount', parseFloat(e.target.value) || 0)} />
                    <select disabled={!!parentQuote} className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                        value={form.global_discount_type} onChange={e => set('global_discount_type', e.target.value)}>
                        <option value="percent">% (procenta)</option>
                        <option value="amount">Kč (pevná částka)</option>
                    </select>
                    {form.global_discount > 0 && (
                        <span className="text-sm text-green-600 font-medium">
                            <Icon name="fa-tag" className="mr-1" />
                            Sleva {form.global_discount}{form.global_discount_type === 'percent' ? '%' : ' Kč'}
                        </span>
                    )}
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-slate-700 mb-1">Sazby dle kategorie</h3>
                <p className="text-xs text-slate-500 mb-3">
                    Jakmile přidáte položky ze skladu s kategorií, systém automaticky přidá kategorii sem.
                    Nastavte paušální cenu montáže a sazbu DPH za 1 ks pro každou kategorii.
                </p>
                {assemblies.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Žádné kategorie zatím. Přidejte položky ze skladu.</p>
                ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Kategorie</th>
                                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600 w-36">Montáž / ks (Kč)</th>
                                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600 w-28">DPH (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {assemblies.map((a, idx) => (
                                    <tr key={a.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        <td className="px-4 py-2 font-medium text-slate-700">{a.category_name}</td>
                                        <td className="px-4 py-2">
                                            <input type="number" min="0" step="0.5" disabled={!!parentQuote}
                                                className="w-32 ml-auto block border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                                                value={a.assembly_price_per_unit}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setAssemblies(prev => prev.map(x => x.id === a.id ? { ...x, assembly_price_per_unit: val } : x));
                                                }} />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input type="number" min="0" max="100" step="1" disabled={!!parentQuote}
                                                className="w-20 ml-auto block border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-slate-100 disabled:text-slate-400"
                                                value={a.vat_rate}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setAssemblies(prev => prev.map(x => x.id === a.id ? { ...x, vat_rate: val } : x));
                                                }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!parentQuote && (
                    <div className="mt-2">
                        <button
                            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            onClick={() => setAssemblies(prev => [...prev, { id: -Date.now(), quote_id: quote.id, category_name: 'Nová kategorie', assembly_price_per_unit: 0, vat_rate: pricing.vat_rate }])}>
                            <Icon name="fa-plus" className="text-xs" /> Přidat kategorii ručně
                        </button>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Poznámky k nabídce</label>
                <textarea rows={3}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    value={form.notes} onChange={e => set('notes', e.target.value)}
                    placeholder="Poznámky, podmínky, upozornění…" />
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <><Icon name="fa-spinner fa-spin" className="mr-2" />Ukládám…</> : <><Icon name="fa-save" className="mr-2" />Uložit nastavení</>}
                </Button>
            </div>
        </div>
    );
};

export default CenotvorbaTab;
