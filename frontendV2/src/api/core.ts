import { RoleEnum, PickingOrderStatus } from '../types';

export const local = false;
export const API_BASE_URL = local ? 'http://localhost:8000' : window.location.origin + '/api';
export const USE_MOCKS = false;

// --- MOCK DATA STORE ---
const mockClientMargins: Record<string, number> = {
    "1_1": 15.5,
};

export const mockStore = {
    company: { id: 1, name: "Appartus", slug: "profitechnik", legal_name: "Appartus", address: "Průmyslová 145, 370 01 České Budějovice", ico: "12345678", dic: "CZ12345678" },
    members: [
        { user: { id: 1, email: "admin@profitechnik.cz" }, role: RoleEnum.Owner },
        { user: { id: 2, email: "technik1@profitechnik.cz" }, role: RoleEnum.Member }
    ],
    clients: [
        { id: 1, name: "Bytové družstvo Vltava", address: "Vltavská 10, ČB", company_id: 1 }
    ],
    locations: [
        { id: 1, name: "Hlavní sklad ČB", description: "Centrální sklad", authorized_users: [] },
        { id: 2, name: "Dodávka - Technik 1", description: "Pohotovostní zásoba", authorized_users: [] }
    ],
    categories: [
        { id: 1, name: "Kabeláž", children: [] },
        { id: 2, name: "Jističe", children: [] }
    ],
    inventory: [
        { id: 1, name: "CYKY-J 3x1.5", sku: "CAB-001", ean: "8590001000018", total_quantity: 500, price: 18.5, category_ids: [1], company_id: 1, is_monitored_for_stock: true, low_stock_threshold: 100, locations: [{ quantity: 500, location: { id: 1, name: "Hlavní sklad ČB" } }], categories: [] },
        { id: 2, name: "Jistič B16A 1p", sku: "EL-016", ean: "8590001000025", total_quantity: 45, price: 115, category_ids: [2], company_id: 1, is_monitored_for_stock: true, low_stock_threshold: 10, locations: [{ quantity: 45, location: { id: 1, name: "Hlavní sklad ČB" } }], categories: [] }
    ],
    workOrders: [
        { id: 1, name: "Revize elektro - BD Vltava", status: "in_progress", client_id: 1, company_id: 1, budget_hours: 40, tasks: [{ id: 1, name: "Měření odporů", status: "in_progress" }], client: { id: 1, name: "Bytové družstvo Vltava" } }
    ],
    timeLogs: [] as any[],
    pickingOrders: [] as any[],
    mockClientMargins,
};

// --- REÁLNÝ KONEKTOR ---
export async function fetchApi(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) headers.set('Authorization', `Bearer ${token}`);

    if (options.body &&
        !(options.body instanceof FormData) &&
        !(options.body instanceof URLSearchParams) &&
        !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
        if (response.status === 401) throw new Error('Unauthorized');
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch { errorData = { detail: response.statusText }; }
            throw new Error(errorData.detail || 'API request failed');
        }
        if (response.status === 204) return null;
        return await response.json();
    } catch (error) {
        console.error(`[API Call FAILED] ${path}`, error);
        throw error;
    }
}

// Pomocná funkce pro výpočet ceny s marží (používá billing modul)
export const calculateItemPriceWithMargin = (
    item: any,
    client: any,
    clientMargins: Record<string, number>
): { price: number; margin: number } => {
    if (!client) return { price: item.price || 0, margin: 0 };

    let appliedMargin = client.margin_percentage || 0;
    if (item.category_ids && item.category_ids.length > 0) {
        for (const catId of item.category_ids) {
            const key = `${client.id}_${catId}`;
            if (clientMargins[key] !== undefined) {
                appliedMargin = clientMargins[key];
                break;
            }
        }
    }
    const basePrice = item.price || 0;
    const finalPrice = basePrice * (1 + appliedMargin / 100);
    return { price: finalPrice, margin: appliedMargin };
};

// Suppress unused import warning for PickingOrderStatus (used in mockStore init)
void PickingOrderStatus;
