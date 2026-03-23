import { fetchApi } from './core';

// Tech Types
export const getObjectTechTypes = (cid: number): Promise<any[]> =>
    fetchApi(`/plugins/objects/${cid}/tech-types`);

export const createObjectTechType = (cid: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/tech-types`, { method: 'POST', body: JSON.stringify(data) });

export const updateObjectTechType = (cid: number, typeId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteObjectTechType = (cid: number, typeId: number): Promise<void> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}`, { method: 'DELETE' });

// Tech Fields
export const createObjectTechField = (cid: number, typeId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}/fields`, { method: 'POST', body: JSON.stringify(data) });

export const updateObjectTechField = (cid: number, typeId: number, fieldId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}/fields/${fieldId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteObjectTechField = (cid: number, typeId: number, fieldId: number): Promise<void> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}/fields/${fieldId}`, { method: 'DELETE' });

// Accessory Types
export const createObjectAccessoryType = (cid: number, typeId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}/accessory-types`, { method: 'POST', body: JSON.stringify(data) });

export const updateObjectAccessoryType = (cid: number, typeId: number, accId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}/accessory-types/${accId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteObjectAccessoryType = (cid: number, typeId: number, accId: number): Promise<void> =>
    fetchApi(`/plugins/objects/${cid}/tech-types/${typeId}/accessory-types/${accId}`, { method: 'DELETE' });

// Sites
export const getObjectSites = (cid: number): Promise<any[]> =>
    fetchApi(`/plugins/objects/${cid}/sites`);

export const getObjectSite = (cid: number, siteId: number): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}`);

export const createObjectSite = (cid: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/sites`, { method: 'POST', body: JSON.stringify(data) });

export const updateObjectSite = (cid: number, siteId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteObjectSite = (cid: number, siteId: number): Promise<void> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}`, { method: 'DELETE' });

// Technologies on sites
export const addObjectTechnology = (cid: number, siteId: number, techTypeId: number): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}/technologies`, { method: 'POST', body: JSON.stringify({ tech_type_id: techTypeId }) });

export const removeObjectTechnology = (cid: number, siteId: number, instanceId: number): Promise<void> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}/technologies/${instanceId}`, { method: 'DELETE' });

// Elements
export const createObjectElement = (cid: number, siteId: number, instanceId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}/technologies/${instanceId}/elements`, { method: 'POST', body: JSON.stringify(data) });

export const updateObjectElement = (cid: number, siteId: number, instanceId: number, elementId: number, data: any): Promise<any> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}/technologies/${instanceId}/elements/${elementId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteObjectElement = (cid: number, siteId: number, instanceId: number, elementId: number): Promise<void> =>
    fetchApi(`/plugins/objects/${cid}/sites/${siteId}/technologies/${instanceId}/elements/${elementId}`, { method: 'DELETE' });
