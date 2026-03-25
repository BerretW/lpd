import React, { useState, useEffect, useCallback } from 'react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Icon from '../common/Icon';
import * as api from '../../api';
import * as quotesApi from '../../api/quotes';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuoteItem {
    id: number;
    section_id: number;
    name: string;
    unit: string;
    quantity: number;
    material_price: number;
    assembly_price: number;
    inventory_item_id?: number;
    inventory_category_name?: string;
    sort_order: number;
    is_reduced_work: boolean;
}

interface QuoteSection {
    id: number;
    quote_id: number;
    name: string;
    prefix?: string;
    sort_order: number;
    is_extras: boolean;
    items: QuoteItem[];
}

interface CategoryAssembly {
    id: number;
    quote_id: number;
    category_name: string;
    assembly_price_per_unit: number;
}

interface Quote {
    id: number;
    company_id: number;
    site_id?: number;
    parent_quote_id?: number;
    name: string;
    status: string;
    customer_id?: number;
    customer_name?: string;
    prepared_by?: string;
    prepared_by_phone?: string;
    validity_days: number;
    currency: string;
    vat_rate: number;
    global_discount: number;
    global_discount_type: string;
    global_hourly_rate: number;
    notes?: string;
    created_at: string;
    updated_at: string;
    sections: QuoteSection[];
    category_assemblies: CategoryAssembly[];
    sub_quotes: Quote[];
}

// ─── Frontend PDF (print) ─────────────────────────────────────────────────────

function printQuotePdf(quote: Quote, companyName: string) {
    const fmtP = (v: number) =>
        v.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč';

    const regularSections = quote.sections.filter(s => !s.is_extras);
    const extrasSections = quote.sections.filter(s => s.is_extras);

    const subtotal = regularSections.flatMap(s => s.items).filter(i => !i.is_reduced_work)
        .reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);
    const reducedTotal = regularSections.flatMap(s => s.items).filter(i => i.is_reduced_work)
        .reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);
    const extrasTotal = extrasSections.flatMap(s => s.items)
        .reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);

    let discountAmount = 0;
    if (quote.global_discount > 0) {
        discountAmount = quote.global_discount_type === 'percent'
            ? subtotal * quote.global_discount / 100
            : quote.global_discount;
    }
    const net = subtotal - discountAmount - reducedTotal + extrasTotal;
    const vat = net * quote.vat_rate / 100;
    const gross = net + vat;

    const createdDate = new Date(quote.created_at).toLocaleDateString('cs-CZ');
    const validUntil = new Date(new Date(quote.created_at).getTime() + quote.validity_days * 86400000).toLocaleDateString('cs-CZ');

    const sectionRows = (sections: QuoteSection[], isExtras: boolean) => sections.map(sec => {
        const secTotal = sec.items.reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);
        const itemRows = sec.items.map((item, idx) => {
            const total = item.quantity * (item.material_price + item.assembly_price);
            const bg = item.is_reduced_work ? '#FFFF99' : idx % 2 === 0 ? '#fff' : '#f8f8f8';
            return `<tr style="background:${bg}">
                <td style="padding:3px 5px;color:#999;font-size:10px">${sec.prefix || ''}</td>
                <td style="padding:3px 5px;font-size:10px${item.is_reduced_work ? ';text-decoration:line-through;color:#888' : ''}">${item.name}</td>
                <td style="padding:3px 5px;text-align:center;font-size:10px">${item.unit}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${item.quantity}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${fmtP(item.material_price)}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${fmtP(item.assembly_price)}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${fmtP(item.material_price + item.assembly_price)}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px;font-weight:600${item.is_reduced_work ? ';color:#996600' : ''}">${item.is_reduced_work ? '−' : ''}${fmtP(total)}</td>
            </tr>`;
        }).join('');
        return `
            <tr style="background:#eee">
                <td style="padding:4px 5px;font-weight:700;font-size:10px">${sec.prefix || ''}</td>
                <td colspan="7" style="padding:4px 5px;font-weight:700;font-size:10px">${isExtras ? '[VÍCEPRÁCE] ' : ''}${sec.name}</td>
            </tr>
            ${itemRows}
            <tr style="background:#ddd">
                <td colspan="7" style="padding:4px 5px;text-align:right;font-weight:700;font-size:10px">${sec.name} celkem:</td>
                <td style="padding:4px 5px;text-align:right;font-weight:700;color:#cc0000;font-size:10px">${fmtP(secTotal)}</td>
            </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${quote.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 15mm; font-size: 10px; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        @media print { body { padding: 0; } @page { margin: 12mm; size: A4; } }
        .hdr { background: #1a1a1a; color: #fff; padding: 6px 10px; font-weight: 700; font-size: 11px; margin: 8px 0; }
        .meta td { padding: 2px 4px; font-size: 10px; }
        .meta td:first-child { font-weight: 700; width: 130px; }
        th { background: #1a1a1a; color: #fff; padding: 5px; font-size: 10px; text-align: right; }
        th:first-child, th:nth-child(2) { text-align: left; }
        .recap td { padding: 3px 6px; font-size: 10px; }
        .recap .lbl { text-align: right; }
        hr { border: none; border-top: 0.5px solid #ccc; margin: 8px 0; }
    </style></head><body>
    <table><tr>
        <td style="font-size:14px;font-weight:700">${companyName}</td>
        <td style="text-align:right;font-size:9px;color:#666">www.lpdweb.cz • info@lpdweb.cz</td>
    </tr></table>
    <div class="hdr">ZABEZPEČOVACÍ, POŽÁRNÍ, KAMEROVÉ, PŘÍSTUPOVÉ SYSTÉMY A ELEKTROINSTALACE</div>
    <table class="meta">
        <tr><td>Název zakázky:</td><td><b>${quote.name}</b></td></tr>
        <tr><td>Zákazník:</td><td>${quote.customer_name || ''}</td></tr>
        <tr><td>Zpracoval:</td><td>${quote.prepared_by || ''}${quote.prepared_by_phone ? '  tel. ' + quote.prepared_by_phone : ''}</td></tr>
        <tr><td>Platnost nabídky:</td><td>${quote.validity_days} dní (do ${validUntil})</td></tr>
        <tr><td>Datum:</td><td>${createdDate}</td></tr>
    </table>
    <br>
    <table>
        <thead><tr>
            <th style="width:32px"></th>
            <th style="text-align:left">Položka</th>
            <th style="width:36px">M.j.</th>
            <th style="width:50px">Počet</th>
            <th style="width:80px">Materiál</th>
            <th style="width:80px">Montáž</th>
            <th style="width:80px">Cena/ks</th>
            <th style="width:90px">Cena celkem</th>
        </tr></thead>
        <tbody>
            ${sectionRows(regularSections, false)}
            ${extrasSections.length > 0 ? sectionRows(extrasSections, true) : ''}
        </tbody>
    </table>
    <br>
    <div style="font-size:13px;font-weight:700;color:#cc0000;margin-bottom:6px">Rekapitulace</div>
    <table class="recap" style="width:60%;margin-left:auto">
        <tr><td class="lbl">Celkem bez DPH (před slevou):</td><td>${fmtP(subtotal)}</td></tr>
        ${reducedTotal > 0 ? `<tr style="color:#996600"><td class="lbl">Úspora - méněpráce:</td><td>− ${fmtP(reducedTotal)}</td></tr>` : ''}
        ${discountAmount > 0 ? `<tr style="color:#006600"><td class="lbl">Sleva (${quote.global_discount}${quote.global_discount_type === 'percent' ? '%' : ' Kč'}):</td><td>− ${fmtP(discountAmount)}</td></tr>` : ''}
        ${extrasTotal > 0 ? `<tr style="color:#cc0000;font-weight:700"><td class="lbl">Vícepráce:</td><td>+ ${fmtP(extrasTotal)}</td></tr>` : ''}
        <tr style="border-top:1px solid #333;font-weight:700"><td class="lbl">DODÁVKA A MONTÁŽ CELKEM BEZ DPH:</td><td>${fmtP(net)}</td></tr>
        <tr><td class="lbl">DPH ${quote.vat_rate}%:</td><td>${fmtP(vat)}</td></tr>
        <tr style="border-top:2px solid #cc0000;font-size:13px;font-weight:700;color:#cc0000"><td class="lbl">DODÁVKA CELKEM S DPH:</td><td>${fmtP(gross)}</td></tr>
    </table>
    ${quote.notes ? `<br><div style="font-size:10px"><b>Poznámky:</b><br>${quote.notes}</div>` : ''}
    <hr style="margin-top:20px">
    <div style="text-align:center;font-size:8px;color:#999">${companyName} • www.lpdweb.cz • info@lpdweb.cz</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Povolte vyskakovací okna pro tisk PDF.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Koncept', color: 'bg-slate-200 text-slate-700' },
    sent: { label: 'Odesláno', color: 'bg-blue-100 text-blue-700' },
    accepted: { label: 'Přijato', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'Zamítnuto', color: 'bg-red-100 text-red-700' },
};

const fmtPrice = (v: number) =>
    v.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč';

// ─── Inventory Picker ─────────────────────────────────────────────────────────

const InventoryPicker: React.FC<{
    companyId: number;
    onSelect: (item: any) => void;
    onClose: () => void;
}> = ({ companyId, onSelect, onClose }) => {
    const [items, setItems] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getInventoryItems(companyId).then(d => { setItems(d); setLoading(false); }).catch(() => setLoading(false));
    }, [companyId]);

    const filtered = items.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.sku || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <Modal title="Přidat položku ze skladu" onClose={onClose} size="lg">
            <div className="mb-3 relative">
                <Icon name="fa-search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                <input className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Hledat název, SKU…" value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            </div>
            {loading ? (
                <p className="text-center text-slate-400 py-8">Načítám sklad…</p>
            ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {filtered.map(item => (
                        <button key={item.id} onClick={() => onSelect(item)}
                            className="w-full text-left px-3 py-2.5 hover:bg-red-50 transition-colors flex items-center justify-between group">
                            <div>
                                <p className="text-sm font-medium text-slate-800 group-hover:text-red-700">{item.name}</p>
                                <p className="text-xs text-slate-400">{item.sku} {item.manufacturer?.name ? `· ${item.manufacturer.name}` : ''}</p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <p className="text-sm font-semibold text-slate-700">{fmtPrice(item.price ?? 0)}</p>
                                <p className="text-xs text-slate-400">nák. cena/ks</p>
                            </div>
                        </button>
                    ))}
                    {filtered.length === 0 && <p className="text-center text-slate-400 py-8">Nic nenalezeno</p>}
                </div>
            )}
        </Modal>
    );
};

// ─── Add Item Modal ───────────────────────────────────────────────────────────

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
        // Auto-fill assembly from category
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
            {showPicker && <InventoryPicker companyId={companyId} onSelect={handleSelectInventory} onClose={() => setShowPicker(false)} />}
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

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.is_reduced_work ?? false}
                            onChange={e => set('is_reduced_work', e.target.checked)}
                            className="w-4 h-4 rounded text-yellow-500" />
                        <span className="text-sm text-slate-700">Označit jako <span className="font-semibold text-yellow-700">méněpráce</span> (zákazník ušetří)</span>
                    </label>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={onClose}>Zrušit</Button>
                    <Button onClick={() => { if (form.name?.trim()) onSave(form); }}>
                        {initial?.id ? 'Uložit' : 'Přidat položku'}
                    </Button>
                </div>
            </Modal>
        </>
    );
};

// ─── Section Tab ──────────────────────────────────────────────────────────────

const SectionTab: React.FC<{
    section: QuoteSection;
    companyId: number;
    quoteId: number;
    categoryAssemblies: CategoryAssembly[];
    onRefresh: () => void;
}> = ({ section, companyId, quoteId, categoryAssemblies, onRefresh }) => {
    const [showAddItem, setShowAddItem] = useState(false);
    const [editItem, setEditItem] = useState<QuoteItem | null>(null);

    const sectionTotal = section.items.reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);

    const handleAddItem = async (data: Partial<QuoteItem>) => {
        try {
            await quotesApi.createItem(companyId, quoteId, section.id, data);
            setShowAddItem(false);
            onRefresh();
        } catch (err) { console.error(err); }
    };

    const handleUpdateItem = async (data: Partial<QuoteItem>) => {
        if (!editItem) return;
        try {
            await quotesApi.updateItem(companyId, quoteId, section.id, editItem.id, data);
            setEditItem(null);
            onRefresh();
        } catch (err) { console.error(err); }
    };

    const handleDeleteItem = async (itemId: number) => {
        if (!window.confirm('Smazat položku?')) return;
        try {
            await quotesApi.deleteItem(companyId, quoteId, section.id, itemId);
            onRefresh();
        } catch (err) { console.error(err); }
    };

    const handleToggleReduced = async (item: QuoteItem) => {
        try {
            await quotesApi.updateItem(companyId, quoteId, section.id, item.id, { is_reduced_work: !item.is_reduced_work });
            onRefresh();
        } catch (err) { console.error(err); }
    };

    return (
        <div>
            {section.is_extras && (
                <div className="mb-3 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm text-orange-700">
                    <Icon name="fa-plus-circle" />
                    <span>Tato sekce je označena jako <strong>Vícepráce</strong> — v PDF bude přidána ke konci jako samostatný oddíl a přičtena k celkové ceně.</span>
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white text-xs">
                            <th className="text-left px-3 py-2 font-semibold w-8">#</th>
                            <th className="text-left px-3 py-2 font-semibold">Název položky</th>
                            <th className="text-center px-2 py-2 font-semibold w-16">M.j.</th>
                            <th className="text-right px-2 py-2 font-semibold w-20">Počet</th>
                            <th className="text-right px-2 py-2 font-semibold w-28">Materiál/ks</th>
                            <th className="text-right px-2 py-2 font-semibold w-28">Montáž/ks</th>
                            <th className="text-right px-2 py-2 font-semibold w-28">Celkem</th>
                            <th className="w-24 px-2 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {section.items.map((item, idx) => {
                            const total = item.quantity * (item.material_price + item.assembly_price);
                            return (
                                <tr key={item.id}
                                    className={`border-b border-slate-100 ${item.is_reduced_work ? 'bg-yellow-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-red-50 transition-colors`}>
                                    <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            {item.is_reduced_work && (
                                                <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded font-semibold shrink-0">−</span>
                                            )}
                                            <span className={item.is_reduced_work ? 'text-slate-500 line-through' : 'text-slate-800'}>{item.name}</span>
                                        </div>
                                        {item.inventory_category_name && (
                                            <span className="text-xs text-slate-400">{item.inventory_category_name}</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-2 text-center text-slate-600">{item.unit}</td>
                                    <td className="px-2 py-2 text-right text-slate-700">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right text-slate-600">{fmtPrice(item.material_price)}</td>
                                    <td className="px-2 py-2 text-right text-slate-600">{fmtPrice(item.assembly_price)}</td>
                                    <td className={`px-2 py-2 text-right font-semibold ${item.is_reduced_work ? 'text-yellow-700' : 'text-slate-800'}`}>
                                        {item.is_reduced_work ? '−' : ''}{fmtPrice(total)}
                                    </td>
                                    <td className="px-2 py-2">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleToggleReduced(item)}
                                                title={item.is_reduced_work ? 'Zrušit méněpráce' : 'Označit jako méněpráce'}
                                                className={`p-1 rounded text-xs transition-colors ${item.is_reduced_work ? 'text-yellow-600 bg-yellow-100 hover:bg-yellow-200' : 'text-slate-400 hover:text-yellow-600 hover:bg-yellow-50'}`}>
                                                <Icon name="fa-minus-circle" />
                                            </button>
                                            <button onClick={() => setEditItem(item)}
                                                className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                                <Icon name="fa-edit" />
                                            </button>
                                            <button onClick={() => handleDeleteItem(item.id)}
                                                className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                <Icon name="fa-trash" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {section.items.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-400">Žádné položky. Přidejte první položku.</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot>
                        <tr className="bg-slate-100 font-semibold text-sm">
                            <td colSpan={6} className="px-3 py-2 text-right text-slate-600">
                                {section.name} celkem:
                            </td>
                            <td className="px-2 py-2 text-right text-red-600">{fmtPrice(sectionTotal)}</td>
                            <td />
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mt-3">
                <Button variant="secondary" onClick={() => setShowAddItem(true)}>
                    <Icon name="fa-plus" className="mr-2" />Přidat položku
                </Button>
            </div>

            {showAddItem && (
                <AddItemModal companyId={companyId} categoryAssemblies={categoryAssemblies}
                    onSave={handleAddItem} onClose={() => setShowAddItem(false)} />
            )}
            {editItem && (
                <AddItemModal companyId={companyId} categoryAssemblies={categoryAssemblies}
                    onSave={handleUpdateItem} onClose={() => setEditItem(null)} initial={editItem} />
            )}
        </div>
    );
};

// ─── Cenotvorba Tab ───────────────────────────────────────────────────────────

const CenotvorbaTab: React.FC<{
    quote: Quote;
    companyId: number;
    onRefresh: () => void;
}> = ({ quote, companyId, onRefresh }) => {
    const [form, setForm] = useState({
        validity_days: quote.validity_days,
        currency: quote.currency,
        vat_rate: quote.vat_rate,
        global_discount: quote.global_discount,
        global_discount_type: quote.global_discount_type,
        global_hourly_rate: quote.global_hourly_rate,
        prepared_by: quote.prepared_by ?? '',
        prepared_by_phone: quote.prepared_by_phone ?? '',
        notes: quote.notes ?? '',
    });
    const [assemblies, setAssemblies] = useState<CategoryAssembly[]>(quote.category_assemblies);
    const [saving, setSaving] = useState(false);

    // Gather unique categories from all items
    const usedCategories = Array.from(new Set(
        quote.sections.flatMap(s => s.items.map(i => i.inventory_category_name)).filter(Boolean) as string[]
    ));

    // Make sure all used categories have an assembly entry
    useEffect(() => {
        setAssemblies(prev => {
            const existing = new Set(prev.map(a => a.category_name));
            const newEntries = usedCategories
                .filter(c => !existing.has(c))
                .map(c => ({ id: -Date.now() - Math.random(), quote_id: quote.id, category_name: c, assembly_price_per_unit: quote.global_hourly_rate }));
            return [...prev, ...newEntries];
        });
    }, [usedCategories.join(',')]);

    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await quotesApi.updateQuote(companyId, quote.id, form);
            const cleanAssemblies = assemblies.map(({ category_name, assembly_price_per_unit }) => ({ category_name, assembly_price_per_unit }));
            await quotesApi.upsertCategoryAssemblies(companyId, quote.id, cleanAssemblies);
            onRefresh();
        } catch (err) { console.error(err); } finally { setSaving(false); }
    };

    return (
        <div className="space-y-6">
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
                        <input type="number" min="0" max="100"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.vat_rate} onChange={e => set('vat_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Globální hodinová sazba (Kč)</label>
                        <input type="number" min="0"
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={form.global_hourly_rate} onChange={e => set('global_hourly_rate', parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-slate-700 mb-3">Sleva</h3>
                <div className="flex items-center gap-3">
                    <input type="number" min="0"
                        className="w-36 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={form.global_discount} onChange={e => set('global_discount', parseFloat(e.target.value) || 0)} />
                    <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
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
                <h3 className="font-semibold text-slate-700 mb-1">Cena montáže dle kategorie</h3>
                <p className="text-xs text-slate-500 mb-3">
                    Jakmile přidáte položky ze skladu s kategorií, systém automaticky přidá kategorii sem.
                    Nastavte paušální cenu montáže za 1 ks pro každou kategorii.
                </p>
                {assemblies.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Žádné kategorie zatím. Přidejte položky ze skladu.</p>
                ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="text-left px-4 py-2 text-xs font-semibold text-slate-600">Kategorie</th>
                                    <th className="text-right px-4 py-2 text-xs font-semibold text-slate-600">Montáž / ks (Kč)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {assemblies.map((a, idx) => (
                                    <tr key={a.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        <td className="px-4 py-2 font-medium text-slate-700">{a.category_name}</td>
                                        <td className="px-4 py-2">
                                            <input type="number" min="0" step="0.5"
                                                className="w-32 ml-auto block border border-slate-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-red-500"
                                                value={a.assembly_price_per_unit}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setAssemblies(prev => prev.map(x => x.id === a.id ? { ...x, assembly_price_per_unit: val } : x));
                                                }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="mt-2">
                    <button
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        onClick={() => setAssemblies(prev => [...prev, { id: -Date.now(), quote_id: quote.id, category_name: 'Nová kategorie', assembly_price_per_unit: 0 }])}>
                        <Icon name="fa-plus" className="text-xs" /> Přidat kategorii ručně
                    </button>
                </div>
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

// ─── Quote Summary Bar ────────────────────────────────────────────────────────

const SummaryBar: React.FC<{ quote: Quote }> = ({ quote }) => {
    const regularItems = quote.sections.filter(s => !s.is_extras).flatMap(s => s.items);
    const extrasItems = quote.sections.filter(s => s.is_extras).flatMap(s => s.items);

    const subtotal = regularItems.filter(i => !i.is_reduced_work).reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);
    const reducedTotal = regularItems.filter(i => i.is_reduced_work).reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);
    const extrasTotal = extrasItems.reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);

    let discountAmount = 0;
    if (quote.global_discount > 0) {
        discountAmount = quote.global_discount_type === 'percent'
            ? subtotal * quote.global_discount / 100
            : quote.global_discount;
    }

    const net = subtotal - discountAmount - reducedTotal + extrasTotal;
    const vat = net * quote.vat_rate / 100;
    const gross = net + vat;

    return (
        <div className="bg-slate-800 text-white rounded-xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
                <span className="text-slate-400 text-xs">Základ bez DPH</span>
                <p className="font-semibold">{fmtPrice(net)}</p>
            </div>
            {reducedTotal > 0 && (
                <div>
                    <span className="text-yellow-400 text-xs">Úspora méněpráce</span>
                    <p className="font-semibold text-yellow-300">− {fmtPrice(reducedTotal)}</p>
                </div>
            )}
            {discountAmount > 0 && (
                <div>
                    <span className="text-green-400 text-xs">Sleva</span>
                    <p className="font-semibold text-green-300">− {fmtPrice(discountAmount)}</p>
                </div>
            )}
            {extrasTotal > 0 && (
                <div>
                    <span className="text-orange-400 text-xs">Vícepráce</span>
                    <p className="font-semibold text-orange-300">+ {fmtPrice(extrasTotal)}</p>
                </div>
            )}
            <div>
                <span className="text-slate-400 text-xs">DPH {quote.vat_rate}%</span>
                <p className="font-semibold">{fmtPrice(vat)}</p>
            </div>
            <div className="ml-auto">
                <span className="text-slate-400 text-xs">CELKEM S DPH</span>
                <p className="text-xl font-bold text-red-400">{fmtPrice(gross)}</p>
            </div>
        </div>
    );
};

// ─── Add Section Modal ────────────────────────────────────────────────────────

const AddSectionModal: React.FC<{
    onSave: (data: any) => void;
    onClose: () => void;
    isExtras?: boolean;
}> = ({ onSave, onClose, isExtras }) => {
    const [name, setName] = useState('');
    const [prefix, setPrefix] = useState('');

    return (
        <Modal title={isExtras ? 'Přidat sekci Vícepráce' : 'Přidat sekci'} onClose={onClose}>
            <div className="space-y-4">
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

// ─── Quote Detail ─────────────────────────────────────────────────────────────

const QuoteDetail: React.FC<{
    quoteId: number;
    companyId: number;
    onBack: () => void;
}> = ({ quoteId, companyId, onBack }) => {
    const [quote, setQuote] = useState<Quote | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('cenotvorba');
    const [showAddSection, setShowAddSection] = useState(false);
    const [showAddExtras, setShowAddExtras] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const q = await quotesApi.getQuote(companyId, quoteId);
            setQuote(q);
        } catch (err) { console.error(err); }
    }, [companyId, quoteId]);

    useEffect(() => {
        setLoading(true);
        refresh().finally(() => setLoading(false));
    }, [refresh]);

    const handleAddSection = async (data: any) => {
        try {
            const sec = await quotesApi.createSection(companyId, quoteId, data);
            setShowAddSection(false);
            setShowAddExtras(false);
            await refresh();
            setActiveTab(`sec_${sec.id}`);
        } catch (err) { console.error(err); }
    };

    const handleDeleteSection = async (sectionId: number) => {
        if (!window.confirm('Smazat celou sekci včetně položek?')) return;
        try {
            await quotesApi.deleteSection(companyId, quoteId, sectionId);
            setActiveTab('cenotvorba');
            await refresh();
        } catch (err) { console.error(err); }
    };

    const handleExportPdf = () => {
        if (!quote) return;
        const companyName = (api as any).getCompanyName?.() ?? '';
        printQuotePdf(quote, companyName);
    };

    const handleStatusChange = async (status: string) => {
        if (!quote) return;
        try {
            await quotesApi.updateQuote(companyId, quoteId, { status });
            await refresh();
        } catch (err) { console.error(err); }
    };

    if (loading || !quote) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Icon name="fa-spinner fa-spin" className="mr-3 text-2xl" />Načítám nabídku…
            </div>
        );
    }

    const regularSections = quote.sections.filter(s => !s.is_extras);
    const extrasSections = quote.sections.filter(s => s.is_extras);
    const statusInfo = STATUS_LABELS[quote.status] ?? STATUS_LABELS.draft;

    const tabs = [
        { key: 'cenotvorba', label: 'Cenotvorba', icon: 'fa-cog' },
        ...regularSections.map(s => ({ key: `sec_${s.id}`, label: `${s.prefix ? s.prefix + ' · ' : ''}${s.name}`, icon: 'fa-list', sectionId: s.id, isExtras: false })),
        ...extrasSections.map(s => ({ key: `sec_${s.id}`, label: `+ ${s.name}`, icon: 'fa-plus-circle', sectionId: s.id, isExtras: true })),
    ];

    return (
        <div>
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <button onClick={onBack} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors mt-1">
                    <Icon name="fa-arrow-left" />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-slate-800">{quote.name}</h1>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">
                        {quote.customer_name && <><Icon name="fa-user" className="mr-1" />{quote.customer_name} · </>}
                        Platnost: {quote.validity_days} dní
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={quote.status}
                        onChange={e => handleStatusChange(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <Button onClick={handleExportPdf}>
                        <><Icon name="fa-file-pdf" className="mr-2" />Export PDF</>
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <SummaryBar quote={quote} />

            {/* Tabs */}
            <div className="flex gap-1 flex-wrap mt-4 mb-3 bg-slate-100 p-1 rounded-lg">
                {tabs.map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
                            ${activeTab === tab.key ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}
                            ${tab.isExtras ? 'border border-orange-300' : ''}`}>
                        <Icon name={tab.icon} className="text-xs" />
                        {tab.label}
                        {tab.sectionId && (
                            <button
                                onClick={e => { e.stopPropagation(); handleDeleteSection(tab.sectionId!); }}
                                className={`ml-1 opacity-60 hover:opacity-100 transition-opacity ${activeTab === tab.key ? 'text-red-200 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}>
                                <Icon name="fa-times" className="text-xs" />
                            </button>
                        )}
                    </button>
                ))}
                <button
                    onClick={() => setShowAddSection(true)}
                    className="px-3 py-1.5 rounded-md text-sm text-slate-500 hover:bg-slate-200 transition-colors flex items-center gap-1">
                    <Icon name="fa-plus" className="text-xs" /> Sekce
                </button>
                <button
                    onClick={() => setShowAddExtras(true)}
                    className="px-3 py-1.5 rounded-md text-sm text-orange-600 hover:bg-orange-50 border border-orange-200 transition-colors flex items-center gap-1">
                    <Icon name="fa-plus-circle" className="text-xs" /> Vícepráce
                </button>
            </div>

            {/* Tab content */}
            <Card>
                {activeTab === 'cenotvorba' && (
                    <CenotvorbaTab quote={quote} companyId={companyId} onRefresh={refresh} />
                )}
                {tabs.filter(t => t.sectionId).map(tab => {
                    const sec = quote.sections.find(s => s.id === tab.sectionId);
                    if (!sec || activeTab !== tab.key) return null;
                    return (
                        <SectionTab key={sec.id} section={sec} companyId={companyId} quoteId={quoteId}
                            categoryAssemblies={quote.category_assemblies} onRefresh={refresh} />
                    );
                })}
            </Card>

            {/* Sub-quotes */}
            {(quote.sub_quotes?.length > 0 || true) && (
                <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-700">
                            <Icon name="fa-sitemap" className="mr-2 text-slate-400" />
                            Podnabídky
                        </h3>
                        <Button variant="secondary" onClick={async () => {
                            const name = window.prompt('Název podnabídky:');
                            if (!name?.trim()) return;
                            try {
                                const sub = await quotesApi.createQuote(companyId, {
                                    name: name.trim(),
                                    parent_quote_id: quote.id,
                                    site_id: quote.site_id,
                                    customer_id: quote.customer_id,
                                    validity_days: quote.validity_days,
                                    currency: quote.currency,
                                    vat_rate: quote.vat_rate,
                                    global_hourly_rate: quote.global_hourly_rate,
                                });
                                await refresh();
                            } catch (err) { console.error(err); }
                        }}>
                            <Icon name="fa-plus" className="mr-1" />Nová podnabídka
                        </Button>
                    </div>
                    {quote.sub_quotes?.length === 0 ? (
                        <p className="text-sm text-slate-400 italic">Žádné podnabídky. Podnabídka dědí cenové nastavení z hlavní nabídky.</p>
                    ) : (
                        <div className="space-y-2">
                            {quote.sub_quotes?.map(sub => (
                                <div key={sub.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
                                    <div>
                                        <p className="font-medium text-slate-800">{sub.name}</p>
                                        <p className="text-xs text-slate-500">{STATUS_LABELS[sub.status]?.label}</p>
                                    </div>
                                    <Button variant="secondary" onClick={() => {/* navigate to sub */}}>
                                        <Icon name="fa-external-link-alt" className="mr-1" />Otevřít
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showAddSection && <AddSectionModal onSave={handleAddSection} onClose={() => setShowAddSection(false)} />}
            {showAddExtras && <AddSectionModal onSave={handleAddSection} onClose={() => setShowAddExtras(false)} isExtras />}
        </div>
    );
};

// ─── New Quote Modal ──────────────────────────────────────────────────────────

const NewQuoteModal: React.FC<{
    clients: any[];
    siteId?: number;
    siteName?: string;
    onSave: (data: any) => void;
    onClose: () => void;
}> = ({ clients, siteId, siteName, onSave, onClose }) => {
    const [form, setForm] = useState({
        name: siteName ? `Nabídka - ${siteName}` : '',
        customer_id: '',
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

// ─── Quotes List ──────────────────────────────────────────────────────────────

interface QuotesPluginProps {
    companyId: number;
    siteId?: number;
    siteName?: string;
}

const QuotesPlugin: React.FC<QuotesPluginProps> = ({ companyId, siteId, siteName }) => {
    const [quotes, setQuotes] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedQuoteId, setSelectedQuoteId] = useState<number | null>(null);
    const [showNew, setShowNew] = useState(false);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [qs, cs] = await Promise.all([
                quotesApi.listQuotes(companyId, siteId),
                api.getClients(companyId),
            ]);
            setQuotes(qs);
            setClients(cs);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, [companyId, siteId]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleCreate = async (data: any) => {
        try {
            const q = await quotesApi.createQuote(companyId, data);
            setShowNew(false);
            await loadData();
            setSelectedQuoteId(q.id);
        } catch (err) { console.error(err); }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('Smazat nabídku? Tato akce je nevratná.')) return;
        try {
            await quotesApi.deleteQuote(companyId, id);
            setQuotes(prev => prev.filter(q => q.id !== id));
        } catch (err) { console.error(err); }
    };

    if (selectedQuoteId !== null) {
        return (
            <QuoteDetail
                quoteId={selectedQuoteId}
                companyId={companyId}
                onBack={() => { setSelectedQuoteId(null); loadData(); }}
            />
        );
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Cenové nabídky</h2>
                    {siteName && <p className="text-sm text-slate-500">{siteName}</p>}
                </div>
                <Button onClick={() => setShowNew(true)}>
                    <Icon name="fa-plus" className="mr-2" />Nová nabídka
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-400">
                    <Icon name="fa-spinner fa-spin" className="text-2xl mb-2" /><p>Načítám nabídky…</p>
                </div>
            ) : quotes.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Icon name="fa-file-invoice-dollar" className="text-4xl mb-3" />
                    <p className="text-lg font-medium">Žádné nabídky</p>
                    <p className="text-sm mt-1">Vytvořte první cenovou nabídku pro {siteName || 'tento objekt'}.</p>
                    <Button className="mt-4" onClick={() => setShowNew(true)}>
                        <Icon name="fa-plus" className="mr-2" />Vytvořit nabídku
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {quotes.map(q => {
                        const statusInfo = STATUS_LABELS[q.status] ?? STATUS_LABELS.draft;
                        const date = new Date(q.updated_at).toLocaleDateString('cs-CZ');
                        return (
                            <div key={q.id}
                                className="bg-white rounded-xl border border-slate-200 hover:border-red-200 hover:shadow-md transition-all cursor-pointer group"
                                onClick={() => setSelectedQuoteId(q.id)}>
                                <div className="flex items-center px-5 py-4 gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                                        <Icon name="fa-file-invoice-dollar" className="text-red-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-slate-800 group-hover:text-red-700 truncate">{q.name}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {q.customer_name && <><Icon name="fa-user" className="mr-1" />{q.customer_name} · </>}
                                            Upraveno: {date}
                                        </p>
                                    </div>
                                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 ${statusInfo.color}`}>
                                        {statusInfo.label}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={e => { e.stopPropagation(); handleDelete(q.id); }}
                                            className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded"
                                            title="Smazat nabídku">
                                            <Icon name="fa-trash" className="text-sm" />
                                        </button>
                                        <Icon name="fa-chevron-right" className="text-slate-300 group-hover:text-red-400 transition-colors" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showNew && (
                <NewQuoteModal clients={clients} siteId={siteId} siteName={siteName}
                    onSave={handleCreate} onClose={() => setShowNew(false)} />
            )}
        </div>
    );
};

export default QuotesPlugin;
