import { InventoryItemOut, CategoryOut, LocationOut, ManufacturerOut, SupplierOut, AuditLogOut } from '../types';
import { fetchApi, USE_MOCKS, mockStore, API_BASE_URL } from './core';

export const getInventoryItems = (cid: number, catId?: number): Promise<InventoryItemOut[]> => {
    if (USE_MOCKS) {
        let items = mockStore.inventory;
        if (catId) items = items.filter(i => i.category_ids.includes(catId));
        return Promise.resolve(items as any[]);
    }
    return fetchApi(`/companies/${cid}/inventory${catId ? `?category_id=${catId}` : ''}`);
};

export const getInventoryItemByEan = (cid: number, ean: string): Promise<InventoryItemOut> => {
    if (USE_MOCKS) {
        const item = mockStore.inventory.find(i => i.ean === ean);
        return item ? Promise.resolve(item as any) : Promise.reject(new Error("Položka nenalezena"));
    }
    return fetchApi(`/companies/${cid}/inventory/by-ean/${ean}`);
};

export const createInventoryItem = (cid: number, data: any): Promise<InventoryItemOut> => {
    if (USE_MOCKS) {
        const newItem = { ...data, id: mockStore.inventory.length + 1, total_quantity: 0, locations: [], categories: [], category_ids: data.category_ids || [], company_id: cid };
        mockStore.inventory.push(newItem);
        return Promise.resolve(newItem as any);
    }
    return fetchApi(`/companies/${cid}/inventory`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateInventoryItem = (cid: number, id: number, data: any): Promise<InventoryItemOut> => {
    if (USE_MOCKS) {
        const item = mockStore.inventory.find(i => i.id === id);
        if (item) Object.assign(item, data);
        return Promise.resolve(item as any);
    }
    return fetchApi(`/companies/${cid}/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const placeStock = (cid: number, data: any): Promise<InventoryItemOut> => {
    if (USE_MOCKS) {
        const item = mockStore.inventory.find(i => i.id === data.inventory_item_id);
        const loc = mockStore.locations.find(l => l.id === data.location_id);
        if (item && loc) {
            const stockAtLoc = item.locations.find((l: any) => l.location.id === loc.id);
            if (stockAtLoc) stockAtLoc.quantity += data.quantity;
            else item.locations.push({ quantity: data.quantity, location: { id: loc.id, name: loc.name } as any });
            item.total_quantity += data.quantity;
            return Promise.resolve(item as any);
        }
        return Promise.reject(new Error("Invalid data"));
    }
    return fetchApi(`/companies/${cid}/inventory/movements/place`, { method: 'POST', body: JSON.stringify(data) });
};

export const transferStock = (cid: number, data: any) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/inventory/movements/transfer`, { method: 'POST', body: JSON.stringify(data) });

export const writeOffStock = (cid: number, data: any) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/inventory/movements/write-off`, { method: 'POST', body: JSON.stringify(data) });

export const uploadInventoryItemImage = (cid: number, itemId: number, file: File): Promise<InventoryItemOut> => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchApi(`/companies/${cid}/inventory/${itemId}/upload-image`, { method: 'POST', body: formData });
};

export const getInventoryHistory = (cid: number, itemId: number): Promise<AuditLogOut[]> => {
    if (USE_MOCKS) {
        return Promise.resolve([
            { id: 1, timestamp: new Date().toISOString(), action: 'quantity_adjusted' as any, details: "Inventura - naskladnění", user: { id: 1, email: "admin@profitechnik.cz" }, inventory_item: { id: itemId, name: "Položka", sku: "123" } },
            { id: 2, timestamp: new Date(Date.now() - 86400000).toISOString(), action: 'location_placed' as any, details: "Přesun na Hlavní sklad", user: { id: 1, email: "admin@profitechnik.cz" }, inventory_item: { id: itemId, name: "Položka", sku: "123" } }
        ] as AuditLogOut[]);
    }
    return fetchApi(`/companies/${cid}/inventory/${itemId}/history`);
};

// Locations
export const getLocations = (cid: number): Promise<LocationOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.locations as any[]) : fetchApi(`/companies/${cid}/locations`);

export const getMyLocations = (cid: number): Promise<LocationOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.locations as any[]) : fetchApi(`/companies/${cid}/locations/my-locations`);

export const createLocation = (cid: number, data: any): Promise<LocationOut> => {
    if (USE_MOCKS) {
        const nl = { ...data, id: mockStore.locations.length + 1, authorized_users: [] };
        mockStore.locations.push(nl);
        return Promise.resolve(nl as any);
    }
    return fetchApi(`/companies/${cid}/locations`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateLocation = (cid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteLocation = (cid: number, id: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/locations/${id}`, { method: 'DELETE' });

export const getLocationPermissions = (cid: number, lid: number) =>
    USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/locations/${lid}/permissions`);

export const addLocationPermission = (cid: number, lid: number, e: string) =>
    USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/locations/${lid}/permissions`, { method: 'POST', body: JSON.stringify({ user_email: e }) });

export const removeLocationPermission = (cid: number, lid: number, uid: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/locations/${lid}/permissions/${uid}`, { method: 'DELETE' });

export const getLocationInventory = (cid: number, lid: number) =>
    USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/locations/${lid}/inventory`);

// Categories
export const getCategories = (cid: number): Promise<CategoryOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.categories as any[]) : fetchApi(`/companies/${cid}/categories`);

export const createCategory = (cid: number, data: any): Promise<CategoryOut> => {
    if (USE_MOCKS) {
        const nc = { ...data, id: mockStore.categories.length + 1, children: [] };
        mockStore.categories.push(nc);
        return Promise.resolve(nc as any);
    }
    return fetchApi(`/companies/${cid}/categories`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateCategory = (cid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteCategory = (cid: number, id: number) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/categories/${id}`, { method: 'DELETE' });

// Manufacturers & Suppliers
export const getManufacturers = (cid: number): Promise<ManufacturerOut[]> =>
    USE_MOCKS ? Promise.resolve([{ id: 1, name: "Siemens" }, { id: 2, name: "ABB" }]) : fetchApi(`/companies/${cid}/manufacturers`);

export const createManufacturer = (cid: number, name: string): Promise<ManufacturerOut> =>
    USE_MOCKS ? Promise.resolve({ id: Math.random(), name }) : fetchApi(`/companies/${cid}/manufacturers`, { method: 'POST', body: JSON.stringify({ name }) });

export const getSuppliers = (cid: number): Promise<SupplierOut[]> =>
    USE_MOCKS ? Promise.resolve([{ id: 1, name: "Sonepar" }, { id: 2, name: "DEK" }]) : fetchApi(`/companies/${cid}/suppliers`);

export const createSupplier = (cid: number, name: string): Promise<SupplierOut> =>
    USE_MOCKS ? Promise.resolve({ id: Math.random(), name }) : fetchApi(`/companies/${cid}/suppliers`, { method: 'POST', body: JSON.stringify({ name }) });

// Inventory wipe (plugin)
export const wipeInventoryItems = (cid: number): Promise<void> =>
    fetchApi(`/plugins/inventory-wipe/${cid}/items`, { method: 'DELETE' });

export const wipeInventoryCategories = (cid: number): Promise<void> =>
    fetchApi(`/plugins/inventory-wipe/${cid}/categories`, { method: 'DELETE' });

export const wipeInventoryAll = (cid: number): Promise<void> =>
    fetchApi(`/plugins/inventory-wipe/${cid}/all`, { method: 'DELETE' });

// Re-export for direct download URL usage
export { API_BASE_URL };
