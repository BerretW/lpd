import { Quote } from './types';

// ─── Tech Bits ────────────────────────────────────────────────────────────────
// Každá technologie = jeden bit v hexadecimálním ID nabídky.
// Pořadí odpovídá seed_technologies.sql.

export const TECH_BITS: Record<string, number> = {
    'CCTV':         0x001,  // bit 0
    'PZTS':         0x002,  // bit 1
    'EKV':          0x004,  // bit 2
    'MZS':          0x008,  // bit 3
    'DT':           0x010,  // bit 4
    'SK':           0x020,  // bit 5
    'PV':           0x040,  // bit 6
    'ID':           0x080,  // bit 7
    'DOMÁCÍ TEL.':  0x100,  // bit 8
};

/**
 * Sestaví referenční kód nabídky:
 * {customerId}/{siteId}-v{version}-{techHex}
 *
 * techHex = hex maska technologií odvozená z prefixů sekcí.
 * Příklad: zákazník 42, objekt 15, verze 2, CCTV+DT → 42/15-v2-11
 */
export function computeQuoteRef(quote: Quote): string {
    const custId = quote.customer_id ?? 0;
    const siteId = quote.site_id ?? 0;
    const version = quote.version ?? 1;

    let techMask = 0;
    for (const section of quote.sections ?? []) {
        const key = (section.prefix ?? section.name).toUpperCase().trim();
        if (TECH_BITS[key] !== undefined) {
            techMask |= TECH_BITS[key];
        }
    }

    const techHex = techMask === 0 ? '00' : techMask.toString(16).toUpperCase().padStart(2, '0');
    return `${custId}/${siteId}-v${version}-${techHex}`;
}

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    draft: { label: 'Koncept', color: 'bg-slate-200 text-slate-700' },
    sent: { label: 'Odesláno', color: 'bg-blue-100 text-blue-700' },
    accepted: { label: 'Přijato', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'Zamítnuto', color: 'bg-red-100 text-red-700' },
};

export const fmtPrice = (v: number) =>
    v.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč';

/**
 * Vypočítá DPH rozdělené po sazbách.
 * - Materiál každé položky se zdaní globální sazbou quote.vat_rate.
 * - Montáž se zdaní sazbou dle kategorie (CategoryAssembly.vat_rate),
 *   pokud kategorie není nastavena, použije se globální sazba.
 * - Sleva se aplikuje proporcionálně na položky regulárních sekcí.
 * - Méněpráce se z DPH vyloučí.
 */
export function computeVatBreakdown(quote: Quote): { rate: number; base: number; vat: number }[] {
    const catRateMap = new Map(quote.category_assemblies.map(ca => [ca.category_name, ca.vat_rate]));

    const regularItems = quote.sections.filter(s => !s.is_extras).flatMap(s => s.items);
    const extrasItems  = quote.sections.filter(s =>  s.is_extras).flatMap(s => s.items);

    const subtotal = regularItems
        .filter(i => !i.is_reduced_work)
        .reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);

    let discountAmount = 0;
    if (quote.global_discount > 0) {
        discountAmount = quote.global_discount_type === 'percent'
            ? subtotal * quote.global_discount / 100
            : Math.min(quote.global_discount, subtotal);
    }
    const discountRatio = subtotal > 0 ? discountAmount / subtotal : 0;

    const groups = new Map<number, number>();
    const add = (rate: number, amount: number) =>
        groups.set(rate, (groups.get(rate) ?? 0) + amount);

    // Sazba DPH pro celou položku — kategorie přebíjí globální sazbu pro materiál i montáž
    const itemRate = (item: { inventory_category_name?: string }) =>
        item.inventory_category_name
            ? (catRateMap.get(item.inventory_category_name) ?? quote.vat_rate)
            : quote.vat_rate;

    for (const i of regularItems.filter(x => !x.is_reduced_work)) {
        const f = 1 - discountRatio;
        const rate = itemRate(i);
        add(rate, i.quantity * (i.material_price + i.assembly_price) * f);
    }
    for (const i of extrasItems) {
        add(itemRate(i), i.quantity * (i.material_price + i.assembly_price));
    }

    return Array.from(groups.entries())
        .filter(([, base]) => base > 0)
        .map(([rate, base]) => ({ rate, base, vat: base * rate / 100 }))
        .sort((a, b) => a.rate - b.rate);
}

export interface InvoiceConfig {
    invoice_number: string;
    issue_date: string;       // YYYY-MM-DD
    duzp: string;             // datum uskutečnění zdanitelného plnění
    due_date: string;         // YYYY-MM-DD
    variable_symbol: string;
    payment_method: string;   // 'převodem' | 'hotovost' | 'kartou'
    note?: string;
}

export interface InvoiceCompany {
    name: string;
    legal_name?: string;
    address?: string;
    ico?: string;
    dic?: string;
    bank_account?: string;
    iban?: string;
}

export interface InvoiceClient {
    name: string;
    legal_name?: string;
    address?: string;
    ico?: string;
    dic?: string;
}

export function printInvoicePdf(
    quote: Quote,
    company: InvoiceCompany,
    client: InvoiceClient,
    cfg: InvoiceConfig,
) {
    const fmtP = (v: number) =>
        v.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Kč';

    const regularSections = quote.sections.filter(s => !s.is_extras);
    const extrasSections = quote.sections.filter(s => s.is_extras);

    const catRateMap = new Map(quote.category_assemblies.map(ca => [ca.category_name, ca.vat_rate]));
    const itemVatRate = (item: { inventory_category_name?: string }) =>
        item.inventory_category_name
            ? (catRateMap.get(item.inventory_category_name) ?? quote.vat_rate)
            : quote.vat_rate;

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
    const vatBreakdown = computeVatBreakdown(quote);
    const totalVat = vatBreakdown.reduce((s, g) => s + g.vat, 0);
    const gross = net + totalVat;

    const fmtDate = (d: string) => new Date(d).toLocaleDateString('cs-CZ');

    const addrHtml = (addr?: string) =>
        addr ? addr.replace(/\n/g, '<br>') : '';

    const supplierBlock = `
        <div style="font-weight:700;font-size:10px;margin-bottom:4px;text-transform:uppercase;color:#cc0000">Dodavatel</div>
        <div style="font-weight:700;font-size:11px">${company.legal_name || company.name}</div>
        ${company.address ? `<div style="font-size:9px;color:#555;margin-top:2px">${addrHtml(company.address)}</div>` : ''}
        ${company.ico ? `<div style="font-size:9px;margin-top:4px">IČO: <b>${company.ico}</b></div>` : ''}
        ${company.dic ? `<div style="font-size:9px">DIČ: <b>${company.dic}</b></div>` : ''}
        ${company.bank_account ? `<div style="font-size:9px;margin-top:4px">Č. účtu: <b>${company.bank_account}</b></div>` : ''}
        ${company.iban ? `<div style="font-size:9px">IBAN: <b>${company.iban}</b></div>` : ''}`;

    const buyerBlock = `
        <div style="font-weight:700;font-size:10px;margin-bottom:4px;text-transform:uppercase;color:#cc0000">Odběratel</div>
        <div style="font-weight:700;font-size:11px">${client.legal_name || client.name}</div>
        ${client.address ? `<div style="font-size:9px;color:#555;margin-top:2px">${addrHtml(client.address)}</div>` : ''}
        ${client.ico ? `<div style="font-size:9px;margin-top:4px">IČO: <b>${client.ico}</b></div>` : ''}
        ${client.dic ? `<div style="font-size:9px">DIČ: <b>${client.dic}</b></div>` : ''}`;

    const sectionRows = (sections: typeof regularSections, isExtras: boolean) => sections.map(sec =>
        sec.items.map((item, idx) => {
            if (item.is_reduced_work) return '';
            const unitPrice = item.material_price + item.assembly_price;
            const total = item.quantity * unitPrice;
            const vatRate = itemVatRate(item);
            const bg = idx % 2 === 0 ? '#fff' : '#f8f8f8';
            return `<tr style="background:${bg}">
                <td style="padding:3px 6px;font-size:9px;color:#777">${isExtras ? '+' : (sec.prefix || '')}</td>
                <td style="padding:3px 6px;font-size:9px">${item.name}</td>
                <td style="padding:3px 6px;text-align:center;font-size:9px">${item.unit}</td>
                <td style="padding:3px 6px;text-align:right;font-size:9px">${item.quantity}</td>
                <td style="padding:3px 6px;text-align:right;font-size:9px">${fmtP(unitPrice)}</td>
                <td style="padding:3px 6px;text-align:center;font-size:9px">${vatRate}%</td>
                <td style="padding:3px 6px;text-align:right;font-size:9px;font-weight:600">${fmtP(total)}</td>
            </tr>`;
        }).join('')
    ).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Faktura ${cfg.invoice_number}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 15mm; font-size: 10px; color: #333; }
        table { width: 100%; border-collapse: collapse; }
        @media print { body { padding: 0; } @page { margin: 12mm; size: A4; } }
        th { background: #1a1a1a; color: #fff; padding: 5px 6px; font-size: 9px; text-align: right; }
        th:nth-child(1), th:nth-child(2) { text-align: left; }
        .recap td { padding: 3px 6px; font-size: 10px; }
        .recap .lbl { text-align: right; }
        hr { border: none; border-top: 0.5px solid #ccc; margin: 8px 0; }
    </style></head><body>

    <!-- Hlavička -->
    <table style="margin-bottom:8px"><tr>
        <td style="font-size:13px;font-weight:700">${company.name}</td>
        <td style="text-align:right">
            <div style="font-size:22px;font-weight:900;color:#cc0000;letter-spacing:1px">FAKTURA</div>
            <div style="font-size:10px;color:#555">daňový doklad</div>
        </td>
    </tr></table>
    <div style="background:#1a1a1a;color:#fff;padding:6px 10px;font-weight:700;font-size:11px;margin-bottom:12px">
        Č. faktury: ${cfg.invoice_number} &nbsp;·&nbsp; ${quote.name}
    </div>

    <!-- Strany + platební údaje -->
    <table style="margin-bottom:14px"><tr style="vertical-align:top">
        <td style="width:45%;padding-right:20px;border-right:1px solid #eee">${supplierBlock}</td>
        <td style="width:10%"></td>
        <td style="width:45%">${buyerBlock}</td>
    </tr></table>

    <table style="width:55%;margin-bottom:14px;font-size:9px">
        <tr><td style="font-weight:700;width:160px;padding:2px 0">Datum vystavení:</td><td>${fmtDate(cfg.issue_date)}</td></tr>
        <tr><td style="font-weight:700;padding:2px 0">DUZP:</td><td>${fmtDate(cfg.duzp)}</td></tr>
        <tr><td style="font-weight:700;padding:2px 0">Datum splatnosti:</td><td><b>${fmtDate(cfg.due_date)}</b></td></tr>
        <tr><td style="font-weight:700;padding:2px 0">Variabilní symbol:</td><td>${cfg.variable_symbol}</td></tr>
        <tr><td style="font-weight:700;padding:2px 0">Způsob úhrady:</td><td>${cfg.payment_method}</td></tr>
    </table>

    <!-- Položky -->
    <table>
        <thead><tr>
            <th style="width:32px;text-align:left"></th>
            <th style="text-align:left">Popis</th>
            <th style="width:36px;text-align:center">M.j.</th>
            <th style="width:50px">Počet</th>
            <th style="width:90px">Cena/ks bez DPH</th>
            <th style="width:44px;text-align:center">DPH</th>
            <th style="width:95px">Celkem bez DPH</th>
        </tr></thead>
        <tbody>
            ${sectionRows(regularSections, false)}
            ${extrasSections.length > 0 ? sectionRows(extrasSections, true) : ''}
        </tbody>
    </table>

    <br>
    <table class="recap" style="width:60%;margin-left:auto">
        <tr><td class="lbl">Základ bez DPH:</td><td>${fmtP(subtotal)}</td></tr>
        ${reducedTotal > 0 ? `<tr style="color:#996600"><td class="lbl">Méněpráce (odečteno):</td><td>− ${fmtP(reducedTotal)}</td></tr>` : ''}
        ${discountAmount > 0 ? `<tr style="color:#006600"><td class="lbl">Sleva:</td><td>− ${fmtP(discountAmount)}</td></tr>` : ''}
        ${extrasTotal > 0 ? `<tr style="color:#cc0000;font-weight:700"><td class="lbl">Vícepráce:</td><td>+ ${fmtP(extrasTotal)}</td></tr>` : ''}
        <tr style="border-top:1px solid #ccc;font-weight:700"><td class="lbl">Základ DPH celkem:</td><td>${fmtP(net)}</td></tr>
        ${vatBreakdown.map(g => `<tr><td class="lbl">DPH ${g.rate}% (základ ${fmtP(g.base)}):</td><td>${fmtP(g.vat)}</td></tr>`).join('')}
        <tr style="border-top:2px solid #cc0000;font-size:13px;font-weight:700;color:#cc0000">
            <td class="lbl">CELKEM K ÚHRADĚ:</td><td>${fmtP(gross)}</td>
        </tr>
    </table>

    ${cfg.note ? `<br><div style="font-size:9px;border-top:1px solid #eee;padding-top:8px"><b>Poznámka:</b><br>${cfg.note}</div>` : ''}

    <hr style="margin-top:24px">
    <div style="text-align:center;font-size:8px;color:#999">${company.name} • www.lpdweb.cz • info@lpdweb.cz</div>
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Povolte vyskakovací okna pro tisk PDF.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
}

export function printQuotePdf(quote: Quote, companyName: string, quoteRef?: string) {
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
    const vatBreakdown = computeVatBreakdown(quote);
    const totalVat = vatBreakdown.reduce((s, g) => s + g.vat, 0);
    const gross = net + totalVat;

    const createdDate = new Date(quote.created_at).toLocaleDateString('cs-CZ');
    const validUntil = new Date(new Date(quote.created_at).getTime() + quote.validity_days * 86400000).toLocaleDateString('cs-CZ');

    const catRateMap = new Map(quote.category_assemblies.map(ca => [ca.category_name, ca.vat_rate]));
    const itemVatRate = (item: { inventory_category_name?: string }) =>
        item.inventory_category_name
            ? (catRateMap.get(item.inventory_category_name) ?? quote.vat_rate)
            : quote.vat_rate;

    const sectionRows = (sections: typeof regularSections, isExtras: boolean) => sections.map(sec => {
        const secTotal = sec.items.reduce((s, i) => s + i.quantity * (i.material_price + i.assembly_price), 0);
        const itemRows = sec.items.map((item, idx) => {
            const total = item.quantity * (item.material_price + item.assembly_price);
            const bg = item.is_reduced_work ? '#FFFF99' : idx % 2 === 0 ? '#fff' : '#f8f8f8';
            const vatRate = itemVatRate(item);
            return `<tr style="background:${bg}">
                <td style="padding:3px 5px;color:#999;font-size:10px">${sec.prefix || ''}</td>
                <td style="padding:3px 5px;font-size:10px${item.is_reduced_work ? ';text-decoration:line-through;color:#888' : ''}">${item.name}</td>
                <td style="padding:3px 5px;text-align:center;font-size:10px">${item.unit}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${item.quantity}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${fmtP(item.material_price)}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${fmtP(item.assembly_price)}</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px">${fmtP(item.material_price + item.assembly_price)}</td>
                <td style="padding:3px 5px;text-align:center;font-size:10px;color:#555">${vatRate}%</td>
                <td style="padding:3px 5px;text-align:right;font-size:10px;font-weight:600${item.is_reduced_work ? ';color:#996600' : ''}">${item.is_reduced_work ? '−' : ''}${fmtP(total)}</td>
            </tr>`;
        }).join('');
        return `
            <tr style="background:#eee">
                <td style="padding:4px 5px;font-weight:700;font-size:10px">${sec.prefix || ''}</td>
                <td colspan="8" style="padding:4px 5px;font-weight:700;font-size:10px">${isExtras ? '[VÍCEPRÁCE] ' : ''}${sec.name}</td>
            </tr>
            ${itemRows}
            <tr style="background:#ddd">
                <td colspan="8" style="padding:4px 5px;text-align:right;font-weight:700;font-size:10px">${sec.name} celkem:</td>
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
    ${quoteRef ? `
    <div style="display:flex;align-items:center;justify-content:space-between;margin:10px 0 6px 0;border-bottom:2px solid #cc0000;padding-bottom:6px">
        <div style="font-size:18px;font-weight:900;color:#1a1a1a;letter-spacing:0.5px">${quote.name}</div>
        <div style="text-align:right">
            <div style="font-size:8px;color:#999;text-transform:uppercase;letter-spacing:1px">Č. nabídky</div>
            <div style="font-size:16px;font-weight:900;color:#cc0000;font-family:monospace;letter-spacing:1px">${quoteRef}</div>
        </div>
    </div>` : ''}
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
            <th style="width:42px;text-align:center">DPH</th>
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
        ${vatBreakdown.map(g => `<tr><td class="lbl">DPH ${g.rate}% (základ ${fmtP(g.base)}):</td><td>${fmtP(g.vat)}</td></tr>`).join('')}
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
