import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import * as api from '../../../api';
import { getCategories } from '../../../api/inventory';
import { CategoryOut } from '../../../types';
import { fmtPrice } from './utils';

// Flatten nested category tree into a flat list for display
function flattenCategories(cats: CategoryOut[], depth = 0): { cat: CategoryOut; depth: number }[] {
    return cats.flatMap(c => [{ cat: c, depth }, ...flattenCategories(c.children ?? [], depth + 1)]);
}

const InventoryPicker: React.FC<{
    companyId: number;
    onSelect: (item: any, categoryName: string | undefined) => void;
    onClose: () => void;
}> = ({ companyId, onSelect, onClose }) => {
    const [items, setItems] = useState<any[]>([]);
    const [categories, setCategories] = useState<{ cat: CategoryOut; depth: number }[]>([]);
    const [search, setSearch] = useState('');
    const [filterCatId, setFilterCatId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Step 2: category picker for a selected item
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

    // ── Category picker step ───────────────────────────────────────────────────
    if (pendingItem) {
        const itemCats: CategoryOut[] = pendingItem.categories ?? [];
        return (
            <Modal title="Vyberte kategorii montáže" onClose={() => setPendingItem(null)} size="sm">
                <p className="text-sm text-slate-500 mb-4">
                    Položka <strong>{pendingItem.name}</strong> je zařazena ve více kategoriích.
                    Vyberte, která kategorie se použije pro sazbu montáže.
                </p>
                <div className="space-y-2">
                    {itemCats.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => onSelect(pendingItem, cat.name)}
                            className="w-full text-left px-4 py-3 rounded-lg border border-slate-200 hover:border-red-400 hover:bg-red-50 transition-colors flex items-center justify-between group">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-red-700">{cat.name}</span>
                            <Icon name="fa-chevron-right" className="text-slate-300 group-hover:text-red-400 text-xs" />
                        </button>
                    ))}
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

    // ── Main picker ────────────────────────────────────────────────────────────
    return (
        <Modal title="Přidat položku ze skladu" onClose={onClose} size="lg">
            <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                    <Icon name="fa-search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                    <input
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Hledat název, SKU, kategorie…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>
                <select
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-700"
                    value={filterCatId ?? ''}
                    onChange={e => setFilterCatId(e.target.value === '' ? null : Number(e.target.value))}>
                    <option value="">Všechny kategorie</option>
                    {categories.map(({ cat, depth }) => (
                        <option key={cat.id} value={cat.id}>
                            {'  '.repeat(depth)}{depth > 0 ? '└ ' : ''}{cat.name}
                        </option>
                    ))}
                </select>
            </div>

            {loading ? (
                <p className="text-center text-slate-400 py-8">Načítám sklad…</p>
            ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                    {filtered.map(item => (
                        <button key={item.id} onClick={() => handleItemClick(item)}
                            className="w-full text-left px-3 py-2.5 hover:bg-red-50 transition-colors flex items-center justify-between group">
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 group-hover:text-red-700 truncate">{item.name}</p>
                                <p className="text-xs text-slate-400">
                                    {item.sku}
                                    {item.manufacturer?.name ? ` · ${item.manufacturer.name}` : ''}
                                    {(item.categories ?? []).length > 0 && (
                                        <span className="ml-2 text-slate-300">|</span>
                                    )}
                                    {(item.categories ?? []).map((c: CategoryOut) => (
                                        <span key={c.id} className="ml-1 px-1 py-0.5 bg-slate-100 rounded text-slate-500">{c.name}</span>
                                    ))}
                                </p>
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

export default InventoryPicker;
