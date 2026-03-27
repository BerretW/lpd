import { fetchApi, API_BASE_URL } from './core';

// ─── Quotes ───────────────────────────────────────────────────────────────────

export const listQuotes = (cid: number, siteId?: number): Promise<any[]> => {
    const qs = siteId != null ? `?site_id=${siteId}` : '';
    return fetchApi(`/plugins/quotes/${cid}/quotes${qs}`);
};

export const getQuote = (cid: number, quoteId: number): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}`);

export const createQuote = (cid: number, data: any): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes`, { method: 'POST', body: JSON.stringify(data) });

export const updateQuote = (cid: number, quoteId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteQuote = (cid: number, quoteId: number): Promise<void> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}`, { method: 'DELETE' });

export const newVersionQuote = (cid: number, quoteId: number): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/new-version`, { method: 'POST' });

// ─── Sections ─────────────────────────────────────────────────────────────────

export const createSection = (cid: number, quoteId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/sections`, { method: 'POST', body: JSON.stringify(data) });

export const updateSection = (cid: number, quoteId: number, sectionId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/sections/${sectionId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteSection = (cid: number, quoteId: number, sectionId: number): Promise<void> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/sections/${sectionId}`, { method: 'DELETE' });

// ─── Items ────────────────────────────────────────────────────────────────────

export const createItem = (cid: number, quoteId: number, sectionId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/sections/${sectionId}/items`, { method: 'POST', body: JSON.stringify(data) });

export const updateItem = (cid: number, quoteId: number, sectionId: number, itemId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/sections/${sectionId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteItem = (cid: number, quoteId: number, sectionId: number, itemId: number): Promise<void> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/sections/${sectionId}/items/${itemId}`, { method: 'DELETE' });

// ─── Category Assemblies ──────────────────────────────────────────────────────

export const upsertCategoryAssemblies = (cid: number, quoteId: number, data: any[]): Promise<any[]> =>
    fetchApi(`/plugins/quotes/${cid}/quotes/${quoteId}/category-assemblies`, { method: 'PUT', body: JSON.stringify(data) });

// ─── PDF Export ───────────────────────────────────────────────────────────────

export const getQuotePdfUrl = (cid: number, quoteId: number): string => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
    return `${API_BASE_URL}/plugins/quotes/${cid}/quotes/${quoteId}/pdf?token=${encodeURIComponent(token)}`;
};

export const downloadQuotePdf = async (cid: number, quoteId: number, quoteName: string): Promise<void> => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
    const response = await fetch(`${API_BASE_URL}/plugins/quotes/${cid}/quotes/${quoteId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('PDF generation failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${quoteName}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
};
