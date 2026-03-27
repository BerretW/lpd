import React, { useState, useEffect } from 'react';
import Modal from '../../common/Modal';
import Icon from '../../common/Icon';
import * as api from '../../../api';
import { fmtPrice } from './utils';

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

export default InventoryPicker;
