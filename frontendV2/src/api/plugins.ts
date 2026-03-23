import { PohodaSettingsIn } from '../types';
import { fetchApi, USE_MOCKS, API_BASE_URL } from './core';

// Backup
export const getBackupConfig = (cid: number) =>
    fetchApi(`/plugins/backup/config?company_id=${cid}`);

export const updateBackupConfig = (cid: number, data: any) =>
    fetchApi(`/plugins/backup/config?company_id=${cid}`, { method: 'POST', body: JSON.stringify(data) });

export const runBackup = (cid: number) =>
    fetchApi(`/plugins/backup/run?company_id=${cid}`, { method: 'POST' });

export const getBackupFiles = (cid: number) =>
    fetchApi(`/plugins/backup/files?company_id=${cid}`);

export const restoreBackup = (cid: number, filename: string) =>
    fetchApi(`/plugins/backup/restore/${filename}?company_id=${cid}`, { method: 'POST' });

export const getBackupDownloadUrl = (cid: number, filename: string) =>
    `${API_BASE_URL}/plugins/backup/download/${filename}?company_id=${cid}`;

// Pohoda
export const getPohodaSettings = (cid: number): Promise<PohodaSettingsIn> => {
    if (USE_MOCKS) return Promise.resolve({ is_enabled: false });
    return fetchApi(`/companies/${cid}/pohoda/settings`);
};

export const updatePohodaSettings = (cid: number, data: PohodaSettingsIn): Promise<PohodaSettingsIn> => {
    if (USE_MOCKS) return Promise.resolve(data);
    return fetchApi(`/companies/${cid}/pohoda/settings`, { method: 'PUT', body: JSON.stringify(data) });
};

export const syncClientsFromPohoda = async (cid: number) => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    const response = await fetch(`${API_BASE_URL}/companies/${cid}/pohoda/import/clients`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Synchronizace s Pohodou selhala.");
    }
    return await response.json();
};
