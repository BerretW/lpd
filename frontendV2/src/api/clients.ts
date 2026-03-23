import { ClientOut, ClientCategoryMargin } from '../types';
import { fetchApi, USE_MOCKS, mockStore } from './core';

export const getClients = (cid: number): Promise<ClientOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.clients as any[]) : fetchApi(`/companies/${cid}/clients`);

export const createClient = (cid: number, data: any): Promise<ClientOut> => {
    if (USE_MOCKS) {
        const nc = { ...data, id: mockStore.clients.length + 1, company_id: cid };
        mockStore.clients.push(nc);
        return Promise.resolve(nc as any);
    }
    return fetchApi(`/companies/${cid}/clients`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateClient = (cid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteClient = (cid: number, id: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/clients/${id}`, { method: 'DELETE' });

export const getClientCategoryMargins = async (cid: number, clientId: number): Promise<ClientCategoryMargin[]> => {
    if (USE_MOCKS) {
        const margins: ClientCategoryMargin[] = [];
        const flattenCategories = (cats: any[]): any[] => cats.flatMap(c => [c, ...flattenCategories(c.children)]);
        const allCats = flattenCategories(mockStore.categories);
        allCats.forEach(cat => {
            const key = `${clientId}_${cat.id}`;
            if (mockStore.mockClientMargins[key] !== undefined) {
                margins.push({ category_id: cat.id, category_name: cat.name, margin_percentage: mockStore.mockClientMargins[key] });
            }
        });
        return Promise.resolve(margins);
    }
    return fetchApi(`/companies/${cid}/clients/${clientId}/margins`);
};

export const setClientCategoryMargin = async (cid: number, clientId: number, data: ClientCategoryMargin): Promise<void> => {
    if (USE_MOCKS) {
        mockStore.mockClientMargins[`${clientId}_${data.category_id}`] = data.margin_percentage;
        return Promise.resolve();
    }
    return fetchApi(`/companies/${cid}/clients/${clientId}/margins`, { method: 'POST', body: JSON.stringify(data) });
};

export const deleteClientCategoryMargin = async (cid: number, clientId: number, categoryId: number): Promise<void> => {
    if (USE_MOCKS) {
        delete mockStore.mockClientMargins[`${clientId}_${categoryId}`];
        return Promise.resolve();
    }
    return fetchApi(`/companies/${cid}/clients/${clientId}/margins/${categoryId}`, { method: 'DELETE' });
};
