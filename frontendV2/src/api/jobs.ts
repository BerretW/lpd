import { WorkOrderOut, TaskOut } from '../types';
import { fetchApi, USE_MOCKS, mockStore } from './core';

export const getWorkOrders = (cid: number): Promise<WorkOrderOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.workOrders as any[]) : fetchApi(`/companies/${cid}/work-orders`);

export const getWorkOrder = (cid: number, id: number): Promise<WorkOrderOut> => {
    if (USE_MOCKS) return Promise.resolve(mockStore.workOrders.find(w => w.id === id) as any);
    return fetchApi(`/companies/${cid}/work-orders/${id}`);
};

export const createWorkOrder = (cid: number, data: any): Promise<WorkOrderOut> => {
    if (USE_MOCKS) {
        const newWo = { ...data, id: mockStore.workOrders.length + 1, status: 'new', tasks: [], company_id: cid };
        mockStore.workOrders.push(newWo);
        return Promise.resolve(newWo as any);
    }
    return fetchApi(`/companies/${cid}/work-orders`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateWorkOrder = (cid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const updateWorkOrderStatus = (cid: number, id: number, status: string): Promise<WorkOrderOut> => {
    if (USE_MOCKS) {
        const wo = mockStore.workOrders.find(w => w.id === id);
        if (wo) wo.status = status;
        return Promise.resolve(wo as any);
    }
    return fetchApi(`/companies/${cid}/work-orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
};

export const getTask = (cid: number, wid: number, tid: number): Promise<TaskOut> =>
    USE_MOCKS ? Promise.resolve({ id: tid, name: "Mock Task", status: "new", used_items: [], work_order_id: wid } as any) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}`);

export const createTask = (cid: number, wid: number, data: any): Promise<TaskOut> => {
    if (USE_MOCKS) return Promise.resolve({ ...data, id: 999, status: 'new', used_items: [], work_order_id: wid } as any);
    return fetchApi(`/companies/${cid}/work-orders/${wid}/tasks`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateTask = (cid: number, wid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const assignTask = (cid: number, wid: number, tid: number, aid: any) =>
    USE_MOCKS ? Promise.resolve({ id: tid }) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/assign`, { method: 'POST', body: JSON.stringify({ assignee_id: aid }) });

export const getTaskTotalHours = (cid: number, wid: number, tid: number) =>
    USE_MOCKS ? Promise.resolve({ total_hours: 5 }) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/total-hours`);

export const getTaskTimeLogs = (cid: number, wid: number, tid: number) =>
    USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/time-logs`);

export const updateUsedItemForTask = (cid: number, wid: number, tid: number, uid: number, q: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory/${uid}`, { method: 'PATCH', body: JSON.stringify({ quantity: q }) });

export const deleteUsedItemFromTask = (cid: number, wid: number, tid: number, uid: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory/${uid}`, { method: 'DELETE' });

export const useInventoryForTask = (cid: number, wid: number, tid: number, iid: number, q: number, lid: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory`, { method: 'POST', body: JSON.stringify({ inventory_item_id: iid, quantity: q, from_location_id: lid }) });

export const directAssignInventoryToTask = (cid: number, wid: number, tid: number, data: any) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory/direct-assign`, { method: 'POST', body: JSON.stringify(data) });
