import { BillingReportOut, ClientBillingReportOut } from '../types';
import { fetchApi, USE_MOCKS, mockStore, calculateItemPriceWithMargin, API_BASE_URL } from './core';

export const getBillingReport = (cid: number, wid: number, s?: string, e?: string): Promise<BillingReportOut> => {
    if (USE_MOCKS) {
        const wo = mockStore.workOrders.find(w => w.id === wid);
        if (!wo) return Promise.reject("Work Order not found");

        const client = mockStore.clients.find(c => c.id === (wo as any).client_id);
        let totalHours = 40;
        let totalPriceWork = totalHours * 500;
        let totalPriceInventory = 0;
        const billingItems: any[] = [];

        const mockUsedItems = [
            { id: 1, inventory_item_id: 1, quantity: 10, task_name: "Instalace" },
            { id: 2, inventory_item_id: 2, quantity: 5, task_name: "Zapojení" }
        ];

        mockUsedItems.forEach(used => {
            const invItem = mockStore.inventory.find(i => i.id === used.inventory_item_id);
            if (invItem) {
                const { price, margin } = calculateItemPriceWithMargin(invItem as any, client as any, mockStore.mockClientMargins);
                const lineTotal = price * used.quantity;
                totalPriceInventory += lineTotal;
                billingItems.push({
                    item_id: invItem.id, item_name: invItem.name, task_name: used.task_name,
                    quantity: used.quantity, unit_cost: invItem.price, margin_applied: margin,
                    unit_price_sold: price, total_price: lineTotal,
                    category_name: (invItem as any).categories?.[0]?.name || "Obecné"
                });
            }
        });

        return Promise.resolve({
            work_order_name: wo.name, client_name: client ? client.name : "Neznámý klient",
            total_hours: totalHours, total_price_work: totalPriceWork,
            total_price_inventory: totalPriceInventory, grand_total: totalPriceWork + totalPriceInventory,
            time_logs: [
                { work_type_name: "Montáž", task_name: "Instalace", hours: 10, rate: 500, total_price: 5000 },
                { work_type_name: "Servis", task_name: "Zapojení", hours: 30, rate: 500, total_price: 15000 }
            ],
            used_items: billingItems
        } as any);
    }
    return fetchApi(`/companies/${cid}/work-orders/${wid}/billing-report${s ? `?start_date=${s}` : ''}${e ? `${s ? '&' : '?'}end_date=${e}` : ''}`);
};

export const getBillingReportForClient = (cid: number, clid: number, s: string, e: string): Promise<ClientBillingReportOut> => {
    if (USE_MOCKS) return Promise.resolve({ client_name: "Klient", total_hours: 50, total_price_work: 25000, total_price_inventory: 10000, grand_total: 35000, time_logs: [], used_items: [] });
    return fetchApi(`/companies/${cid}/clients/${clid}/billing-report?start_date=${s}&end_date=${e}`);
};

// Pohoda exports
export const exportInvoiceXml = async (cid: number, invId: number) => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/companies/${cid}/pohoda/export/invoice/${invId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error("Chyba exportu");
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pohoda_faktura_${invId}.xml`;
    document.body.appendChild(a); a.click();
    window.URL.revokeObjectURL(url);
};

export const exportWorkOrderToPohoda = async (cid: number, workOrderId: number) => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/companies/${cid}/pohoda/export/invoice/${workOrderId}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Export do Pohody selhal.");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pohoda_faktura_zakazka_${workOrderId}.xml`;
    document.body.appendChild(a); a.click();
    window.URL.revokeObjectURL(url);
};

export const exportPeriodicInvoiceToPohoda = async (cid: number, clientId: number, startDate: string, endDate: string) => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/companies/${cid}/pohoda/export/periodic-invoice/${clientId}?start_date=${startDate}&end_date=${endDate}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Export periodické faktury do Pohody selhal.");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pohoda_faktura_klient_${clientId}_${startDate}.xml`;
    document.body.appendChild(a); a.click();
    window.URL.revokeObjectURL(url);
};
