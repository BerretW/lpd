import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import * as api from '../../../api';
import { getCategories } from '../../../api/inventory';
import { CategoryOut } from '../../../types';
import { fmtPrice } from './utils';

function flattenCategories(cats: CategoryOut[], depth = 0): { cat: CategoryOut; depth: number }[] {
    return cats.flatMap(c => [{ cat: c, depth }, ...flattenCategories(c.children ?? [], depth + 1)]);
}

const InventoryPicker: React.FC<{
    companyId: number;
    categoryAssemblies: { category_name: string; assembly_price_per_unit: number }[];
    onSelect: (item: any, categoryName: string | undefined) => void;
    onClose: () => void;
}> = ({ companyId, categoryAssemblies, onSelect, onClose }) => {
    const [items, setItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<{ cat: CategoryOut; depth: number }[]>([]);
    const [search, setSearch] = useState('');
    const [filterCatId, setFilterCatId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [pendingItem, setPendingItem] = useState<any | null>(null);

    useEffect(() => {
        Promise.all([
            api.getInventoryItems(companyId),
            getCategories(companyId),
        ]).then(([inv, cats]) => {
            setItems(inv);
            setCategories(flattenCategories(cats));
        }).finally(() => setLoading(false));
    }, [companyId]);

    const filtered = items.filter(item => {
        const matchesSearch =
            item.name.toLowerCase().includes(search.toLowerCase()) ||
            (item.sku || '').toLowerCase().includes(search.toLowerCase()) ||
            (item.categories ?? []).some((c: CategoryOut) => c.name.toLowerCase().includes(search.toLowerCase()));
        const matchesCat = filterCatId === null || (item.category_ids ?? []).includes(filterCatId);
        return matchesSearch && matchesCat;
    });

    const handleItemClick = (item: any) => {
        const itemCats: CategoryOut[] = item.categories ?? [];
        if (itemCats.length <= 1) {
            onSelect(item, itemCats[0]?.name);
        } else {
            setPendingItem(item);
        }
    };

    // ── Category picker step ──────────────────────────────────────────────────
    if (pendingItem) {
        const itemCats: CategoryOut[] = pendingItem.categories ?? [];
        return (
            <Modal title="Vyberte kategorii montáže" onClose={() => setPendingItem(null)}>
                <p className="text-sm text-slate-500 mb-4">
                    Položka <strong>{pendingItem.name}</strong> je zařazena ve více kategoriích.
                    Vyberte, která kategorie určí sazbu montáže.
                </p>
                <div className="space-y-2">
                    {itemCats.map(cat => {
                        const assembly = categoryAssemblies.find(a => a.category_name === cat.name);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => onSelect(pendingItem, cat.name)}
                                className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-red-400 hover:bg-red-50 transition-colors flex items-center justify-between group">
                                <div>
                                    <span className="text-sm font-medium text-slate-700 group-hover:text-red-700">{cat.name}</span>
                                    {assembly ? (
                                        <span className="ml-2 text-xs text-green-600 font-medium">
                                            <i className="fas fa-tools mr-1" />{fmtPrice(assembly.assembly_price_per_unit)}/ks
                                        </span>
                                    ) : (
                                        <span className="ml-2 text-xs text-slate-400">nová sazba</span>
                                    )}
                                </div>
                                <Icon name="fa-chevron-right" className="text-slate-300 group-hover:text-red-400 text-xs" />
                            </button>
                        );
                    })}
                    <button
                        onClick={() => onSelect(pendingItem, undefined)}
                        className="w-full text-left px-4 py-3 rounded-lg border border-dashed border-slate-200 hover:border-slate-400 transition-colors text-sm text-slate-400 hover:text-slate-600">
                        Bez kategorie
                    </button>
                </div>
                <div className="flex justify-start mt-4">
                    <Button variant="secondary" onClick={() => setPendingItem(null)}>
                        <Icon name="fa-arrow-left" className="mr-1" />Zpět
                    </Button>
                </div>
            </Modal>
        );
    }

    // ── Main picker ───────────────────────────────────────────────────────────
    return (
        <Modal title="Přidat položku ze skladu" onClose={onClose}>
            {/* Filters */}
            <div className="flex gap-3 mb-4">
                <div className="relative flex-1">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none" />
                    <input
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Hledat název, SKU, kategorie…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <select
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-700 min-w-[180px]"
                    value={filterCatId ?? ''}
                    onChange={e => setFilterCatId(e.target.value === '' ? null : Number(e.target.value))}>
                    <option value="">Všechny kategorie</option>
                    {categories.map(({ cat, depth }) => (
                        <option key={cat.id} value={cat.id}>
                            {'　'.repeat(depth)}{depth > 0 ? '└ ' : ''}{cat.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Item list */}
            {loading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                    <i className="fas fa-spinner fa-spin mr-2" />
                    Načítám sklad…
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <i className="fas fa-box-open text-3xl mb-2 text-slate-300" />
                    <span className="text-sm">Nic nenalezeno</span>
                </div>
            ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_auto_auto] bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        <span>Název / SKU</span>
                        <span className="text-right pr-4">Kategorie</span>
                        <span className="text-right min-w-[100px]">Nák. cena</span>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                        {filtered.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleItemClick(item)}
                                className="w-full text-left grid grid-cols-[1fr_auto_auto] items-center px-4 py-3 hover:bg-red-50 transition-colors group">
                                {/* Name + SKU + manufacturer */}
                                <div className="min-w-0 pr-4">
                                    <p className="text-sm font-medium text-slate-800 group-hover:text-red-700 truncate">
                                        {item.name}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate mt-0.5">
                                        {[item.sku, item.manufacturer?.name].filter(Boolean).join(' · ')}
                                    </p>
                                </div>

                                {/* Categories */}
                                <div className="flex flex-wrap gap-1 justify-end pr-4 max-w-[200px]">
                                    {(item.categories ?? []).slice(0, 3).map((c: CategoryOut) => (
                                        <span
                                            key={c.id}
                                            className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-500 whitespace-nowrap">
                                            {c.name}
                                        </span>
                                    ))}
                                    {(item.categories ?? []).length > 3 && (
                                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-xs text-slate-400">
                                            +{(item.categories ?? []).length - 3}
                                        </span>
                                    )}
                                </div>

                                {/* Price */}
                                <div className="text-right min-w-[100px]">
                                    <p className="text-sm font-semibold text-slate-700">
                                        {fmtPrice(item.price ?? 0)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer info */}
            {!loading && filtered.length > 0 && (
                <p className="text-xs text-slate-400 mt-2 text-right">
                    {filtered.length} {filtered.length === 1 ? 'položka' : filtered.length < 5 ? 'položky' : 'položek'}
                </p>
            )}
        </Modal>
    );
};

export default InventoryPicker;
