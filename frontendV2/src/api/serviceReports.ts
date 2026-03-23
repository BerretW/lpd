import { ServiceReportOut, ServiceReportDataOut } from '../types';
import { fetchApi, USE_MOCKS, mockStore } from './core';

export const getServiceReportData = (cid: number, lid: number): Promise<ServiceReportDataOut> => {
    if (USE_MOCKS) return Promise.resolve({ work_order: mockStore.workOrders[0], task: mockStore.workOrders[0].tasks[0] } as any);
    return fetchApi(`/companies/${cid}/time-logs/${lid}/service-report-data`);
};

export const createServiceReport = (cid: number, data: any): Promise<ServiceReportOut> =>
    fetchApi(`/companies/${cid}/service-reports`, { method: 'POST', body: JSON.stringify(data) });

export const getServiceReports = (cid: number, params?: { task_id?: number; work_order_id?: number; object_id?: number }): Promise<ServiceReportOut[]> => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString() : '';
    return fetchApi(`/companies/${cid}/service-reports${qs}`);
};

export const getServiceReport = (cid: number, id: number): Promise<ServiceReportOut> =>
    fetchApi(`/companies/${cid}/service-reports/${id}`);

export const updateServiceReport = (cid: number, id: number, data: any): Promise<ServiceReportOut> =>
    fetchApi(`/companies/${cid}/service-reports/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteServiceReport = (cid: number, id: number): Promise<void> =>
    fetchApi(`/companies/${cid}/service-reports/${id}`, { method: 'DELETE' });
