import React, { useState, useEffect, useCallback } from 'react';
import Button from '../common/Button';
import Icon from '../common/Icon';
import * as api from '../../api';
import * as quotesApi from '../../api/quotes';
import { STATUS_LABELS } from './quotes/utils';
import QuoteDetail from './quotes/QuoteDetail';
import NewQuoteModal from './quotes/NewQuoteModal';

interface QuotesPluginProps {
    companyId: number;
    siteId?: number;
    siteName?: string;
    siteCustomerId?: number;
    siteTechTypes?: string[];
}

const QuotesPlugin: React.FC<QuotesPluginProps> = ({ companyId, siteId, siteName, siteCustomerId, siteTechTypes }) => {
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
                siteTechTypes={siteTechTypes}
                onBack={() => { setSelectedQuoteId(null); loadData(); }}
                onOpenQuote={setSelectedQuoteId}
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
                    initialCustomerId={siteCustomerId}
                    onSave={handleCreate} onClose={() => setShowNew(false)} />
            )}
        </div>
    );
};

export default QuotesPlugin;
