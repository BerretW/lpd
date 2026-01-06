
import { LoginIn } from './schemas/auth';
import { 
    Client, WorkOrder, Task, TimeLog, InventoryItem, WorkType, RoleEnum, 
    TaskOut, WorkOrderOut, TimeLogOut, MemberOut, ClientOut, InventoryItemOut, WorkTypeOut, 
    AuditLogOut, TimeLogStatus, CompanyOut, TimeLogEntryType, BillingReportOut, 
    ServiceReportDataOut, ClientBillingReportOut, CategoryOut, LocationOut, 
    SmtpSettingsOut, TriggerOut, PickingOrderOut, PickingOrderStatus, PickingOrderCreateIn 
} from './types';

const API_BASE_URL = 'http://127.0.0.1:8000';
const USE_MOCKS = false;

// --- REÁLNÝ KONEKTOR ---
async function fetchApi(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    
    if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
        if (response.status === 401) throw new Error('Unauthorized');
        if (!response.ok) {
            let errorData;
            try { errorData = await response.json(); } catch (e) { errorData = { detail: response.statusText }; }
            throw new Error(errorData.detail || 'API request failed');
        }
        if (response.status === 204) return null;
        return await response.json();
    } catch (error) {
        console.error(`[API Call FAILED] ${path}`, error);
        throw error;
    }
}

// --- MOCK DATA STORE ---
const mockStore = {
    company: { id: 1, name: "ProfiTechnik s.r.o.", slug: "profitechnik", legal_name: "ProfiTechnik Elektro s.r.o.", address: "Průmyslová 145, 370 01 České Budějovice", ico: "12345678", dic: "CZ12345678" },
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
    timeLogs: [],
    pickingOrders: []
};

// --- API IMPLEMENTACE ---

export const login = async (credentials: any) => {
    if (USE_MOCKS) {
        const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidGVuYW50cyI6WzFdLCJleHAiOjI1MjQ2MDgwMDB9.dummy-signature";
        return { access_token: mockToken, token_type: "bearer" };
    }
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    return fetchApi('/auth/login', { method: 'POST', body: formData });
};

export const getCompany = (id: number): Promise<CompanyOut> => USE_MOCKS ? Promise.resolve(mockStore.company as CompanyOut) : fetchApi(`/companies/${id}`);
export const updateCompanyBillingInfo = (id: number, data: any): Promise<CompanyOut> => {
    if (USE_MOCKS) { Object.assign(mockStore.company, data); return Promise.resolve(mockStore.company as CompanyOut); }
    return fetchApi(`/companies/${id}/billing`, { method: 'PATCH', body: JSON.stringify(data) });
};

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

export const placeStock = (cid: number, data: any): Promise<InventoryItemOut> => {
    if (USE_MOCKS) {
        const item = mockStore.inventory.find(i => i.id === data.inventory_item_id);
        const loc = mockStore.locations.find(l => l.id === data.location_id);
        if (item && loc) {
            const stockAtLoc = item.locations.find(l => l.location.id === loc.id);
            if (stockAtLoc) stockAtLoc.quantity += data.quantity;
            else item.locations.push({ quantity: data.quantity, location: { id: loc.id, name: loc.name } as any });
            item.total_quantity += data.quantity;
            return Promise.resolve(item as any);
        }
        return Promise.reject(new Error("Invalid data"));
    }
    return fetchApi(`/companies/${cid}/inventory/movements/place`, { method: 'POST', body: JSON.stringify(data) });
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

export const getWorkOrders = (cid: number): Promise<WorkOrderOut[]> => USE_MOCKS ? Promise.resolve(mockStore.workOrders as any[]) : fetchApi(`/companies/${cid}/work-orders`);
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

export const updateWorkOrderStatus = (cid: number, id: number, status: string): Promise<WorkOrderOut> => {
    if (USE_MOCKS) {
        const wo = mockStore.workOrders.find(w => w.id === id);
        if (wo) wo.status = status;
        return Promise.resolve(wo as any);
    }
    return fetchApi(`/companies/${cid}/work-orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
};

export const getTask = (cid: number, wid: number, tid: number): Promise<TaskOut> => USE_MOCKS ? Promise.resolve({ id: tid, name: "Mock Task", status: "new", used_items: [], work_order_id: wid } as any) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}`);
export const createTask = (cid: number, wid: number, data: any): Promise<TaskOut> => {
    if (USE_MOCKS) return Promise.resolve({ ...data, id: 999, status: 'new', used_items: [], work_order_id: wid } as any);
    return fetchApi(`/companies/${cid}/work-orders/${wid}/tasks`, { method: 'POST', body: JSON.stringify(data) });
};

export const getTimeLogs = (cid: number, params: any): Promise<TimeLogOut[]> => USE_MOCKS ? Promise.resolve(mockStore.timeLogs as any[]) : fetchApi(`/companies/${cid}/time-logs?${new URLSearchParams(params).toString()}`);
export const createTimeLog = (cid: number, data: any): Promise<TimeLogOut> => {
    if (USE_MOCKS) {
        const newLog = { ...data, id: mockStore.timeLogs.length + 1, status: 'pending', duration_hours: 8, user: { id: 1, email: "admin@profitechnik.cz" } };
        (mockStore.timeLogs as any[]).push(newLog);
        return Promise.resolve(newLog as any);
    }
    return fetchApi(`/companies/${cid}/time-logs`, { method: 'POST', body: JSON.stringify(data) });
};

export const getMembers = (cid: number): Promise<MemberOut[]> => USE_MOCKS ? Promise.resolve(mockStore.members as any[]) : fetchApi(`/companies/${cid}/members`);
export const updateMemberRole = (cid: number, uid: number, role: string): Promise<MemberOut> => {
    if (USE_MOCKS) {
        const m = mockStore.members.find(m => m.user.id === uid);
        if (m) m.role = role as any;
        return Promise.resolve(m as any);
    }
    return fetchApi(`/companies/${cid}/members/${uid}`, { method: 'PATCH', body: JSON.stringify({ role }) });
};

export const getLocations = (cid: number): Promise<LocationOut[]> => USE_MOCKS ? Promise.resolve(mockStore.locations as any[]) : fetchApi(`/companies/${cid}/locations`);
export const getMyLocations = (cid: number): Promise<LocationOut[]> => USE_MOCKS ? Promise.resolve(mockStore.locations as any[]) : fetchApi(`/companies/${cid}/locations/my-locations`);
export const createLocation = (cid: number, data: any): Promise<LocationOut> => {
    if (USE_MOCKS) {
        const nl = { ...data, id: mockStore.locations.length + 1, authorized_users: [] };
        mockStore.locations.push(nl);
        return Promise.resolve(nl as any);
    }
    return fetchApi(`/companies/${cid}/locations`, { method: 'POST', body: JSON.stringify(data) });
};

export const getCategories = (cid: number): Promise<CategoryOut[]> => USE_MOCKS ? Promise.resolve(mockStore.categories as any[]) : fetchApi(`/companies/${cid}/categories`);
export const createCategory = (cid: number, data: any): Promise<CategoryOut> => {
    if (USE_MOCKS) {
        const nc = { ...data, id: mockStore.categories.length + 1, children: [] };
        mockStore.categories.push(nc);
        return Promise.resolve(nc as any);
    }
    return fetchApi(`/companies/${cid}/categories`, { method: 'POST', body: JSON.stringify(data) });
};

export const getWorkTypes = (cid: number): Promise<WorkTypeOut[]> => USE_MOCKS ? Promise.resolve([{ id: 1, name: "Montáž", rate: 500, company_id: cid }] as any[]) : fetchApi(`/companies/${cid}/work-types`);
export const getClients = (cid: number): Promise<ClientOut[]> => USE_MOCKS ? Promise.resolve(mockStore.clients as any[]) : fetchApi(`/companies/${cid}/clients`);
export const createClient = (cid: number, data: any): Promise<ClientOut> => {
    if (USE_MOCKS) {
        const nc = { ...data, id: mockStore.clients.length + 1, company_id: cid };
        mockStore.clients.push(nc);
        return Promise.resolve(nc as any);
    }
    return fetchApi(`/companies/${cid}/clients`, { method: 'POST', body: JSON.stringify(data) });
};

export const getBillingReport = (cid: number, wid: number, s?: string, e?: string): Promise<BillingReportOut> => {
    if (USE_MOCKS) return Promise.resolve({ work_order_name: "Zakázka", client_name: "Klient", total_hours: 10, total_price_work: 5000, total_price_inventory: 2000, grand_total: 7000, time_logs: [], used_items: [] });
    return fetchApi(`/companies/${cid}/work-orders/${wid}/billing-report${s ? `?start_date=${s}` : ''}${e ? `${s ? '&' : '?'}end_date=${e}` : ''}`);
};

export const getBillingReportForClient = (cid: number, clid: number, s: string, e: string): Promise<ClientBillingReportOut> => {
    if (USE_MOCKS) return Promise.resolve({ client_name: "Klient", total_hours: 50, total_price_work: 25000, total_price_inventory: 10000, grand_total: 35000, time_logs: [], used_items: [] });
    return fetchApi(`/companies/${cid}/clients/${clid}/billing-report?start_date=${s}&end_date=${e}`);
};

export const getPickingOrders = (cid: number): Promise<PickingOrderOut[]> => USE_MOCKS ? Promise.resolve(mockStore.pickingOrders as any[]) : fetchApi(`/companies/${cid}/picking-orders`);
// Added missing createPickingOrder implementation
export const createPickingOrder = (cid: number, data: PickingOrderCreateIn): Promise<PickingOrderOut> => {
    if (USE_MOCKS) {
        const newOrder = {
            ...data,
            id: mockStore.pickingOrders.length + 1,
            status: PickingOrderStatus.New,
            created_at: new Date().toISOString(),
            requester: mockStore.members[0].user,
            source_location: data.source_location_id ? mockStore.locations.find(l => l.id === data.source_location_id) : null,
            destination_location: mockStore.locations.find(l => l.id === data.destination_location_id),
            items: data.items.map((item, idx) => ({
                id: idx + 1,
                requested_quantity: item.requested_quantity,
                picked_quantity: null,
                inventory_item: item.inventory_item_id ? mockStore.inventory.find(i => i.id === item.inventory_item_id) : null,
                requested_item_description: item.requested_item_description || null
            }))
        };
        (mockStore.pickingOrders as any[]).push(newOrder);
        return Promise.resolve(newOrder as any);
    }
    return fetchApi(`/companies/${cid}/picking-orders`, { method: 'POST', body: JSON.stringify(data) });
};

export const getServiceReportData = (cid: number, lid: number): Promise<ServiceReportDataOut> => {
    if (USE_MOCKS) return Promise.resolve({ work_order: mockStore.workOrders[0], task: mockStore.workOrders[0].tasks[0] } as any);
    return fetchApi(`/companies/${cid}/time-logs/${lid}/service-report-data`);
};

// Fallbacks pro nepoužité ale exportované metody
export const updateWorkOrder = (cid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateTask = (cid: number, wid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteTimeLog = (cid: number, id: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/time-logs/${id}`, { method: 'DELETE' });
export const updateTimeLog = (cid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/time-logs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateTimeLogStatus = (cid: number, id: number, s: any) => USE_MOCKS ? Promise.resolve({ id, status: s }) : fetchApi(`/companies/${cid}/time-logs/${id}/status`, { method: 'POST', body: JSON.stringify({ status: s }) });
export const updateUsedItemForTask = (cid: number, wid: number, tid: number, uid: number, q: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory/${uid}`, { method: 'PATCH', body: JSON.stringify({ quantity: q }) });
export const deleteUsedItemFromTask = (cid: number, wid: number, tid: number, uid: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory/${uid}`, { method: 'DELETE' });
export const useInventoryForTask = (cid: number, wid: number, tid: number, iid: number, q: number, lid: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory`, { method: 'POST', body: JSON.stringify({ inventory_item_id: iid, quantity: q, from_location_id: lid }) });
export const directAssignInventoryToTask = (cid: number, wid: number, tid: number, data: any) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/inventory/direct-assign`, { method: 'POST', body: JSON.stringify(data) });
export const getTaskTotalHours = (cid: number, wid: number, tid: number) => USE_MOCKS ? Promise.resolve({ total_hours: 5 }) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/total-hours`);
export const getTaskTimeLogs = (cid: number, wid: number, tid: number) => USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/time-logs`);
export const getSmtpSettings = (cid: number) => USE_MOCKS ? Promise.resolve({ id: 1, is_enabled: true, smtp_host: "smtp.mock.cz", smtp_port: 587, smtp_user: "user", sender_email: "info@mock.cz", password_is_set: true, security_protocol: "TLS", notification_settings: {} }) : fetchApi(`/companies/${cid}/smtp-settings`);
export const updateSmtpSettings = (cid: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/smtp-settings`, { method: 'PUT', body: JSON.stringify(data) });
export const testSmtpSettings = (cid: number) => USE_MOCKS ? Promise.resolve({ message: "OK" }) : fetchApi(`/companies/${cid}/smtp-settings/test`, { method: 'POST', body: JSON.stringify({}) });
export const getTriggers = (cid: number) => USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/triggers`);
export const createTrigger = (cid: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/triggers`, { method: 'POST', body: JSON.stringify(data) });
export const updateTrigger = (cid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/triggers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateLocation = (cid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteLocation = (cid: number, id: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/locations/${id}`, { method: 'DELETE' });
export const getLocationPermissions = (cid: number, lid: number) => USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/locations/${lid}/permissions`);
export const addLocationPermission = (cid: number, lid: number, e: string) => USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/locations/${lid}/permissions`, { method: 'POST', body: JSON.stringify({ user_email: e }) });
export const removeLocationPermission = (cid: number, lid: number, uid: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/locations/${lid}/permissions/${uid}`, { method: 'DELETE' });
export const getLocationInventory = (cid: number, lid: number) => USE_MOCKS ? Promise.resolve([]) : fetchApi(`/companies/${cid}/locations/${lid}/inventory`);
export const updateCategory = (cid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteCategory = (cid: number, id: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/categories/${id}`, { method: 'DELETE' });
export const createMember = (cid: number, data: any) => USE_MOCKS ? Promise.resolve({ user: { id: 99, email: data.email }, role: data.role }) : fetchApi(`/companies/${cid}/members`, { method: 'POST', body: JSON.stringify(data) });
export const updateClient = (cid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve(data) : fetchApi(`/companies/${cid}/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteClient = (cid: number, id: number) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/clients/${id}`, { method: 'DELETE' });
export const createWorkType = (cid: number, data: any) => USE_MOCKS ? Promise.resolve({ ...data, id: 99, company_id: cid }) : fetchApi(`/companies/${cid}/work-types`, { method: 'POST', body: JSON.stringify(data) });
export const assignTask = (cid: number, wid: number, tid: number, aid: any) => USE_MOCKS ? Promise.resolve({ id: tid }) : fetchApi(`/companies/${cid}/work-orders/${wid}/tasks/${tid}/assign`, { method: 'POST', body: JSON.stringify({ assignee_id: aid }) });
export const transferStock = (cid: number, data: any) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/inventory/movements/transfer`, { method: 'POST', body: JSON.stringify(data) });
export const writeOffStock = (cid: number, data: any) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/inventory/movements/write-off`, { method: 'POST', body: JSON.stringify(data) });
export const fulfillPickingOrder = (cid: number, id: number, data: any) => USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/picking-orders/${id}/fulfill`, { method: 'POST', body: JSON.stringify(data) });
