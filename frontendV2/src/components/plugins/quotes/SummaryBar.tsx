import React from 'react';
import { Quote } from './types';
import { fmtPrice } from './utils';

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

export default SummaryBar;
