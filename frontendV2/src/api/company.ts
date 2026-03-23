import { CompanyOut, MemberOut, WorkTypeOut, SmtpSettingsOut, TriggerOut } from '../types';
import { fetchApi, USE_MOCKS, mockStore } from './core';

export const getCompany = (id: number): Promise<CompanyOut> =>
    USE_MOCKS ? Promise.resolve(mockStore.company as CompanyOut) : fetchApi(`/companies/${id}`);

export const updateCompanyBillingInfo = (id: number, data: any): Promise<CompanyOut> => {
    if (USE_MOCKS) { Object.assign(mockStore.company, data); return Promise.resolve(mockStore.company as CompanyOut); }
    return fetchApi(`/companies/${id}/billing`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const getMembers = (cid: number): Promise<MemberOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.members as any[]) : fetchApi(`/companies/${cid}/members`);

export const updateMemberRole = (cid: number, uid: number, role: string): Promise<MemberOut> => {
    if (USE_MOCKS) {
        const m = mockStore.members.find(m => m.user.id === uid);
        if (m) m.role = role as any;
        return Promise.resolve(m as any);
    }
    return fetchApi(`/companies/${cid}/members/${uid}`, { method: 'PATCH', body: JSON.stringify({ role }) });
};

export const createMember = (cid: number, data: any) =>
    USE_MOCKS ? Promise.resolve({ user: { id: 99, email: data.email }, role: data.role }) : fetchApi(`/companies/${cid}/members`, { method: 'POST', body: JSON.stringify(data) });

export const getWorkTypes = (cid: number): Promise<WorkTypeOut[]> =>
    USE_MOCKS ? Promise.resolve([{ id: 1, name: "Montáž", rate: 500, company_id: cid }] as any[]) : fetchApi(`/companies/${cid}/work-types`);

export const createWorkType = (cid: number, data: any) =>
    USE_MOCKS ? Promise.resolve({ ...data, id: 99, company_id: cid }) : fetchApi(`/companies/${cid}/work-types`, { method: 'POST', body: JSON.stringify(data) });

export const updateWorkType = (cid: number, id: number, data: any): Promise<WorkTypeOut> => {
    if (USE_MOCKS) return Promise.resolve({ ...data, id, company_id: cid });
    return fetchApi(`/companies/${cid}/work-types/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const getSmtpSettings = (cid: number): Promise<SmtpSettingsOut> =>
    USE_MOCKS ? Promise.resolve({ id: 1, is_enabled: true, smtp_host: "smtp.mock.cz", smtp_port: 587, smtp_user: "user", sender_email: "info@mock.cz", password_is_set: true, security_protocol: "TLS", notification_settings: {} } as any) : fetchApi(`/companies/${cid}/smtp-settings`);

export const updateSmtpSettings = (cid: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/smtp-settings`, { method: 'PUT', body: JSON.stringify(data) });

export const testSmtpSettings = (cid: number) =>
    USE_MOCKS ? Promise.resolve({ message: "OK" }) : fetchApi(`/companies/${cid}/smtp-settings/test`, { method: 'POST', body: JSON.stringify({}) });

export const getTriggers = (cid: number): Promise<TriggerOut[]> =>
    USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/triggers`);

export const createTrigger = (cid: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/triggers`, { method: 'POST', body: JSON.stringify(data) });

export const updateTrigger = (cid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/triggers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
