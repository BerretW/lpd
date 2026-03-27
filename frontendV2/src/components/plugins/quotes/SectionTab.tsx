import React, { useState } from 'react';
import Button from '../../common/Button';
import Icon from '../../common/Icon';
import * as quotesApi from '../../../api/quotes';
import { CategoryAssembly, QuoteItem, QuoteSection } from './types';
import { fmtPrice } from './utils';
import AddItemModal from './AddItemModal';

const SectionTab: React.FC<{
    section: QuoteSection;
    companyId: number;
    quoteId: number;
    categoryAssemblies: CategoryAssembly[];
    onRefresh: () => void;
}> = ({ section, companyId, quoteId, categoryAssemblies, onRefresh }) => {
    const [showAddItem, setShowAddItem] = useState(false);
    const [editItem, setEditItem] = useState<QuoteItem | null>(null);

    const regularItems = section.items.filter(i => !i.is_reduced_work);
    const reducedItems = section.items.filter(i => i.is_reduced_work);
    const regularTotal = regularItems.reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);
    const reducedTotal = reducedItems.reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);

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
                        {regularItems.length === 0 && reducedItems.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center py-8 text-slate-400">Žádné položky. Přidejte první položku.</td>
                            </tr>
                        )}
                        {regularItems.map((item, idx) => {
                            const total = item.quantity * (item.material_price + item.assembly_price);
                            return (
                                <tr key={item.id}
                                    className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-red-50 transition-colors`}>
                                    <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                                    <td className="px-3 py-2">
                                        <span className="text-slate-800">{item.name}</span>
                                        {item.inventory_category_name && (
                                            <span className="block text-xs text-slate-400">{item.inventory_category_name}</span>
                                        )}
                                    </td>
                                    <td className="px-2 py-2 text-center text-slate-600">{item.unit}</td>
                                    <td className="px-2 py-2 text-right text-slate-700">{item.quantity}</td>
                                    <td className="px-2 py-2 text-right text-slate-600">{fmtPrice(item.material_price)}</td>
                                    <td className="px-2 py-2 text-right text-slate-600">{fmtPrice(item.assembly_price)}</td>
                                    <td className="px-2 py-2 text-right font-semibold text-slate-800">{fmtPrice(total)}</td>
                                    <td className="px-2 py-2">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => handleToggleReduced(item)}
                                                title="Označit jako méněpráce"
                                                className="p-1 rounded text-xs text-slate-400 hover:text-yellow-700 hover:bg-yellow-100 transition-colors">
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
                        {reducedItems.length > 0 && (
                            <>
                                <tr className="bg-yellow-100 border-y border-yellow-200">
                                    <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-yellow-800">
                                        <Icon name="fa-minus-circle" className="mr-1.5" />Méněpráce — zákazník ušetří (odečteno od ceny sekce)
                                    </td>
                                </tr>
                                {reducedItems.map((item, idx) => {
                                    const total = item.quantity * (item.material_price + item.assembly_price);
                                    return (
                                        <tr key={item.id}
                                            className={`border-b border-yellow-100 ${idx % 2 === 0 ? 'bg-yellow-50' : 'bg-white'} hover:bg-red-50 transition-colors`}>
                                            <td className="px-3 py-2 text-slate-400 text-xs">{idx + 1}</td>
                                            <td className="px-3 py-2">
                                                <span className="text-slate-400 line-through">{item.name}</span>
                                                {item.inventory_category_name && (
                                                    <span className="block text-xs text-slate-400">{item.inventory_category_name}</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-center text-slate-500">{item.unit}</td>
                                            <td className="px-2 py-2 text-right text-slate-500">{item.quantity}</td>
                                            <td className="px-2 py-2 text-right text-slate-500">{fmtPrice(item.material_price)}</td>
                                            <td className="px-2 py-2 text-right text-slate-500">{fmtPrice(item.assembly_price)}</td>
                                            <td className="px-2 py-2 text-right font-semibold text-yellow-700">{fmtPrice(total)}</td>
                                            <td className="px-2 py-2">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => handleToggleReduced(item)}
                                                        title="Zrušit méněpráce"
                                                        className="px-1.5 py-1 rounded text-xs font-medium text-yellow-700 bg-yellow-200 hover:bg-yellow-300 transition-colors">
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
                            </>
                        )}
                    </tbody>
                    <tfoot>
                        {reducedItems.length > 0 ? (
                            <>
                                <tr className="bg-slate-50 text-sm">
                                    <td colSpan={6} className="px-3 py-2 text-right text-slate-500">Standardní práce celkem:</td>
                                    <td className="px-2 py-2 text-right text-slate-700 font-semibold">{fmtPrice(regularTotal)}</td>
                                    <td />
                                </tr>
                                <tr className="bg-yellow-50 text-sm">
                                    <td colSpan={6} className="px-3 py-1.5 text-right text-yellow-700">− Úspora méněpráce:</td>
                                    <td className="px-2 py-1.5 text-right text-yellow-700 font-semibold">− {fmtPrice(reducedTotal)}</td>
                                    <td />
                                </tr>
                                <tr className="bg-slate-100 font-semibold text-sm">
                                    <td colSpan={6} className="px-3 py-2 text-right text-slate-600">{section.name} celkem:</td>
                                    <td className="px-2 py-2 text-right text-red-600">{fmtPrice(regularTotal - reducedTotal)}</td>
                                    <td />
                                </tr>
                            </>
                        ) : (
                            <tr className="bg-slate-100 font-semibold text-sm">
                                <td colSpan={6} className="px-3 py-2 text-right text-slate-600">{section.name} celkem:</td>
                                <td className="px-2 py-2 text-right text-red-600">{fmtPrice(regularTotal)}</td>
                                <td />
                            </tr>
                        )}
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

export default SectionTab;
