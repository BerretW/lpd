import { fetchApi } from './core';

export interface WorkOrderInvoiceIn {
    invoice_number: string;
    issue_date: string;
    duzp: string;
    due_date: string;
    variable_symbol: string;
    payment_method: string;
    note?: string;
    total_net: number;
    total_vat: number;
    total_gross: number;
}

export interface InvoiceOut {
    id: number;
    company_id: number;
    quote_id?: number;
    quote_name?: string;
    work_order_id?: number;
    work_order_name?: string;
    customer_id?: number;
    customer_name?: string;
    invoice_number: string;
    issue_date: string;
    duzp: string;
    due_date: string;
    variable_symbol: string;
    payment_method: string;
    note?: string;
    total_net: number;
    total_vat: number;
    total_gross: number;
    status: string;
    created_at: string;
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
    issued: 'Vystavena',
    sent: 'Posláno',
    accepted: 'Přijato',
    paid: 'Zaplaceno',
    overdue: 'Po splatnosti',
    cancelled: 'Stornováno',
};

export const INVOICE_STATUS_COLORS: Record<string, string> = {
    issued: 'bg-blue-100 text-blue-800',
    sent: 'bg-yellow-100 text-yellow-800',
    accepted: 'bg-indigo-100 text-indigo-800',
    paid: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
    cancelled: 'bg-slate-100 text-slate-500',
};

export const listInvoices = (cid: number): Promise<InvoiceOut[]> =>
    fetchApi(`/plugins/invoices/${cid}`);

export const updateInvoiceStatus = (cid: number, invoiceId: number, status: string): Promise<InvoiceOut> =>
    fetchApi(`/plugins/invoices/${cid}/${invoiceId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });

export const createWorkOrderInvoice = (cid: number, workOrderId: number, data: WorkOrderInvoiceIn): Promise<InvoiceOut> =>
    fetchApi(`/plugins/invoices/${cid}/work-orders/${workOrderId}`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
