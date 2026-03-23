import { TimeLogOut } from '../types';
import { fetchApi, USE_MOCKS, mockStore } from './core';

export const getTimeLogs = (cid: number, params: any): Promise<TimeLogOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.timeLogs as any[]) : fetchApi(`/companies/${cid}/time-logs?${new URLSearchParams(params).toString()}`);

export const createTimeLog = (cid: number, data: any): Promise<TimeLogOut> => {
    if (USE_MOCKS) {
        const newLog = { ...data, id: mockStore.timeLogs.length + 1, status: 'pending', duration_hours: 8, user: { id: 1, email: "admin@profitechnik.cz" } };
        mockStore.timeLogs.push(newLog);
        return Promise.resolve(newLog as any);
    }
    return fetchApi(`/companies/${cid}/time-logs`, { method: 'POST', body: JSON.stringify(data) });
};

export const deleteTimeLog = (cid: number, id: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/time-logs/${id}`, { method: 'DELETE' });

export const updateTimeLog = (cid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/time-logs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const updateTimeLogStatus = (cid: number, id: number, s: any) =>
    USE_MOCKS ? Promise.resolve({ id, status: s }) : fetchApi(`/companies/${cid}/time-logs/${id}/status`, { method: 'POST', body: JSON.stringify({ status: s }) });
