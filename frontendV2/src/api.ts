
import { LoginIn } from './schemas/auth';
import { 
    Client, WorkOrder, Task, TimeLog, InventoryItem, WorkType, Membership, RoleEnum, 
    TaskOut, WorkOrderOut, TimeLogOut, MemberOut, ClientOut, InventoryItemOut, WorkTypeOut, 
    AuditLogOut, TimeLogStatus, CompanyOut, TimeLogEntryType, BillingReportOut, 
    ServiceReportDataOut, ClientBillingReportOut, CategoryOut, LocationOut, 
    SmtpSettingsOut, SmtpSettingsIn, TriggerOut, TriggerCreateIn, TriggerUpdateIn, 
    TaskTotalHoursOut, UserOut, LocationWithPermissions, LocationInventoryItem, 
    DirectAssignItemIn, WriteOffStockIn, PickingOrderOut, PickingOrderCreateIn, 
    PickingOrderFulfillIn, PickingOrderStatus 
} from './types';

const API_BASE_URL = 'http://127.0.0.1:8000';
const USE_MOCKS = false; // PŘEPÍNAČ PRO MOCK DATA

// --- REÁLNÝ KONEKTOR (ZŮSTÁVÁ FUNKČNÍ) ---
async function fetchApi(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers || {});
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    
    const body = options.body;
    if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
    }

    try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers,
        });
        
        if (response.status === 401) {
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { detail: response.statusText };
            }
            throw new Error(errorData.detail || 'API request failed');
        }
        
        if (response.status === 204) return null;
        return await response.json();
    } catch (error) {
        console.error(`[API Call FAILED] ${path}`, error);
        throw error;
    }
}

// --- MOCK DATA STORE (IN-MEMORY DB) ---
const mockStore = {
    company: {
        id: 1,
        name: "ProfiTechnik s.r.o.",
        slug: "profitechnik",
        legal_name: "ProfiTechnik Elektro s.r.o.",
        address: "Průmyslová 145, 370 01 České Budějovice",
        ico: "12345678",
        dic: "CZ12345678",
        executive: "Jan Novák",
        bank_account: "123456789/0100"
    },
    members: [
        { user: { id: 1, email: "admin@profitechnik.cz" }, role: RoleEnum.Owner },
        { user: { id: 2, email: "technik1@profitechnik.cz" }, role: RoleEnum.Member },
        { user: { id: 3, email: "technik2@profitechnik.cz" }, role: RoleEnum.Member }
    ],
    clients: [
        { id: 1, name: "Bytové družstvo Vltava", address: "Vltavská 10, ČB", company_id: 1, ico: "88776655" },
        { id: 2, name: "Hotel Relax", address: "Lipno 45, Lipno nad Vltavou", company_id: 1, dic: "CZ22334455" }
    ],
    locations: [
        { id: 1, name: "Hlavní sklad ČB", description: "Centrální sklad materiálu" },
        { id: 2, name: "Dodávka - Technik 1 (3AB 1234)", description: "Pohotovostní zásoba" },
        { id: 3, name: "Dodávka - Technik 2 (5C2 9988)", description: "Pohotovostní zásoba" }
    ],
    categories: [
        { id: 1, name: "Kabeláž", children: [] },
        { id: 2, name: "Jističe a moduly", children: [] },
        { id: 3, name: "Koncové prvky (zásuvky/vypínače)", children: [] }
    ],
    workTypes: [
        { id: 1, name: "Montážní práce", rate: 550, company_id: 1 },
        { id: 2, name: "Revizní činnost", rate: 850, company_id: 1 },
        { id: 3, name: "Servisní zásah", rate: 650, company_id: 1 }
    ],
    inventory: [
        { id: 1, name: "CYKY-J 3x1.5", sku: "CAB-001", total_quantity: 500, price: 18.5, category_id: 1, company_id: 1, is_monitored_for_stock: true, low_stock_threshold: 100, locations: [{ quantity: 500, location: { id: 1, name: "Hlavní sklad ČB" } }] },
        { id: 2, name: "Jistič B16A 1p", sku: "EL-016", total_quantity: 45, price: 115, category_id: 2, company_id: 1, is_monitored_for_stock: true, low_stock_threshold: 10, locations: [{ quantity: 30, location: { id: 1, name: "Hlavní sklad ČB" } }, { quantity: 15, location: { id: 2, name: "Dodávka - Technik 1" } }] },
        { id: 3, name: "Zásuvka 230V bílá", sku: "SW-001", total_quantity: 120, price: 89, category_id: 3, company_id: 1, is_monitored_for_stock: false, low_stock_threshold: null, locations: [{ quantity: 120, location: { id: 1, name: "Hlavní sklad ČB" } }] }
    ],
    workOrders: [
        { id: 1, name: "Revize elektro - BD Vltava", status: "in_progress", client_id: 1, company_id: 1, budget_hours: 40, tasks: [{ id: 1, name: "Měření izolačních odporů", status: "in_progress" }, { id: 2, name: "Kontrola rozvaděčů", status: "new" }], client: { id: 1, name: "Bytové družstvo Vltava" } },
        { id: 2, name: "Instalace EZS - Hotel Relax", status: "new", client_id: 2, company_id: 1, budget_hours: 120, tasks: [{ id: 3, name: "Tahání kabeláže", status: "new" }], client: { id: 2, name: "Hotel Relax" } }
    ],
    tasks: [
        { id: 1, name: "Měření izolačních odporů", status: "in_progress", work_order_id: 1, used_items: [] },
        { id: 2, name: "Kontrola rozvaděčů", status: "new", work_order_id: 1, used_items: [] },
        { id: 3, name: "Tahání kabeláže", status: "new", work_order_id: 2, used_items: [] }
    ],
    timeLogs: [
        { id: 1, start_time: new Date().toISOString().split('T')[0] + "T08:00:00Z", end_time: new Date().toISOString().split('T')[0] + "T12:00:00Z", entry_type: TimeLogEntryType.Work, status: TimeLogStatus.Approved, user: { id: 1, email: "admin@profitechnik.cz" }, task: { id: 1, name: "Měření izolačních odporů" }, duration_hours: 4 },
        { id: 2, start_time: new Date().toISOString().split('T')[0] + "T12:30:00Z", end_time: new Date().toISOString().split('T')[0] + "T16:30:00Z", entry_type: TimeLogEntryType.Work, status: TimeLogStatus.Pending, user: { id: 1, email: "admin@profitechnik.cz" }, task: { id: 1, name: "Měření izolačních odporů" }, duration_hours: 4 }
    ],
    pickingOrders: [],
    triggers: [],
    smtp: {
        id: 1,
        smtp_host: "smtp.example.com",
        smtp_port: 587,
        smtp_user: "user@example.com",
        sender_email: "noreply@example.com",
        password_is_set: true,
        security_protocol: 'tls',
        notification_settings: {
            on_invite_created: true,
            on_budget_alert: true,
            on_low_stock_alert: true
        }
    }
};

// --- API IMPLEMENTACE S MOCK LOGIKOU ---

// Auth
export const login = async (credentials: {email: string, password: string}) => {
    if (USE_MOCKS) {
        // Generování validního mock JWT tokenu pro admin@profitechnik.cz (ID 1, Company 1)
        // Payload: {"sub":"1","tenants":[1],"exp":2524608000} (rok 2050)
        const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidGVuYW50cyI6WzFdLCJleHAiOjI1MjQ2MDgwMDB9.dummy-signature";
        return { access_token: mockToken, token_type: "bearer" };
    }
    const formData = new URLSearchParams();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    return fetchApi('/auth/login', { method: 'POST', body: formData });
};

// Company
export const getCompany = (companyId: number): Promise<CompanyOut> => 
    USE_MOCKS ? Promise.resolve(mockStore.company as CompanyOut) : fetchApi(`/companies/${companyId}`);

export const updateCompanyBillingInfo = (companyId: number, data: any): Promise<CompanyOut> => {
    if (USE_MOCKS) {
        mockStore.company = { ...mockStore.company, ...data };
        return Promise.resolve(mockStore.company as CompanyOut);
    }
    return fetchApi(`/companies/${companyId}/billing`, { method: 'PATCH', body: JSON.stringify(data) });
};

// Work Orders
export const getWorkOrders = (companyId: number): Promise<WorkOrderOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.workOrders as any[]) : fetchApi(`/companies/${companyId}/work-orders`);

export const getWorkOrder = (companyId: number, id: number): Promise<WorkOrderOut> => {
    if (USE_MOCKS) {
        const wo = mockStore.workOrders.find(w => w.id === id);
        return wo ? Promise.resolve(wo as any) : Promise.reject("Not found");
    }
    return fetchApi(`/companies/${companyId}/work-orders/${id}`);
};

export const createWorkOrder = (companyId: number, data: any): Promise<WorkOrderOut> => {
    if (USE_MOCKS) {
        const newWo = { ...data, id: mockStore.workOrders.length + 1, status: 'new', tasks: [], company_id: companyId };
        mockStore.workOrders.push(newWo);
        return Promise.resolve(newWo as any);
    }
    return fetchApi(`/companies/${companyId}/work-orders`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateWorkOrder = (companyId: number, id: number, data: any): Promise<WorkOrderOut> => {
    if (USE_MOCKS) {
        const wo = mockStore.workOrders.find(w => w.id === id);
        if (wo) Object.assign(wo, data);
        return Promise.resolve(wo as any);
    }
    return fetchApi(`/companies/${companyId}/work-orders/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export const updateWorkOrderStatus = (companyId: number, id: number, status: string): Promise<WorkOrderOut> => {
    if (USE_MOCKS) {
        const wo = mockStore.workOrders.find(w => w.id === id);
        if (wo) wo.status = status;
        return Promise.resolve(wo as any);
    }
    return fetchApi(`/companies/${companyId}/work-orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });
};

// Billing Report
export const getBillingReport = (companyId: number, workOrderId: number, startDate?: string, endDate?: string): Promise<BillingReportOut> => {
    if (USE_MOCKS) {
        const wo = mockStore.workOrders.find(w => w.id === workOrderId);
        return Promise.resolve({
            work_order_name: wo?.name || "Zakázka",
            client_name: wo?.client?.name || "Klient",
            total_hours: 8.5,
            total_price_work: 4675,
            total_price_inventory: 1240,
            grand_total: 5915,
            time_logs: [],
            used_items: []
        });
    }
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/billing-report`);
};

export const getBillingReportForClient = (companyId: number, clientId: number, startDate: string, endDate: string): Promise<ClientBillingReportOut> => {
    if (USE_MOCKS) {
        const client = mockStore.clients.find(c => c.id === clientId);
        return Promise.resolve({
            client_name: client?.name || "Klient",
            total_hours: 45.2,
            total_price_work: 24860,
            total_price_inventory: 15420,
            grand_total: 40280,
            time_logs: [],
            used_items: []
        });
    }
    return fetchApi(`/companies/${companyId}/clients/${clientId}/billing-report?start_date=${startDate}&end_date=${endDate}`);
};

// Tasks
export const getTask = (companyId: number, workOrderId: number, taskId: number): Promise<TaskOut> => {
    if (USE_MOCKS) {
        const task = mockStore.tasks.find(t => t.id === taskId);
        return task ? Promise.resolve(task as any) : Promise.reject("Task not found");
    }
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks/${taskId}`);
};

export const createTask = (companyId: number, workOrderId: number, data: any): Promise<TaskOut> => {
    if (USE_MOCKS) {
        const newTask = { ...data, id: mockStore.tasks.length + 1, work_order_id: workOrderId, status: 'new', used_items: [] };
        mockStore.tasks.push(newTask);
        const wo = mockStore.workOrders.find(w => w.id === workOrderId);
        if (wo) wo.tasks.push({ id: newTask.id, name: newTask.name, status: 'new' });
        return Promise.resolve(newTask as any);
    }
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateTask = (companyId: number, workOrderId: number, taskId: number, data: any): Promise<TaskOut> => {
    if (USE_MOCKS) {
        const task = mockStore.tasks.find(t => t.id === taskId);
        if (task) Object.assign(task, data);
        return Promise.resolve(task as any);
    }
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const assignTask = (companyId: number, workOrderId: number, taskId: number, assigneeId: number | null): Promise<TaskOut> => {
    if (USE_MOCKS) {
        const task = mockStore.tasks.find(t => t.id === taskId);
        const user = mockStore.members.find(m => m.user.id === assigneeId)?.user || null;
        // FIX: Cast task to any to allow dynamic property assignment in mock logic
        if (task) (task as any).assignee = user as any;
        return Promise.resolve(task as any);
    }
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks/${taskId}/assignee`, { method: 'POST', body: JSON.stringify({ user_id: assigneeId }) });
};

// Used Items
export const updateUsedItemForTask = (companyId: number, workOrderId: number, taskId: number, usedItemId: number, quantity: number): Promise<any> => {
    if (USE_MOCKS) return Promise.resolve({ success: true });
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks/${taskId}/used-items/${usedItemId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) });
};

export const deleteUsedItemFromTask = (companyId: number, workOrderId: number, taskId: number, usedItemId: number): Promise<any> => {
    if (USE_MOCKS) return Promise.resolve({ success: true });
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks/${taskId}/used-items/${usedItemId}`, { method: 'DELETE' });
};

export const useInventoryForTask = (companyId: number, workOrderId: number, taskId: number, itemId: number, quantity: number, locationId: number): Promise<any> => {
    if (USE_MOCKS) return Promise.resolve({ success: true });
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks/${taskId}/used-items`, { 
        method: 'POST', 
        body: JSON.stringify({ inventory_item_id: itemId, quantity, location_id: locationId }) 
    });
};

export const directAssignInventoryToTask = (companyId: number, workOrderId: number, taskId: number, data: DirectAssignItemIn): Promise<any> => {
    if (USE_MOCKS) return Promise.resolve({ success: true });
    return fetchApi(`/companies/${companyId}/work-orders/${workOrderId}/tasks/${taskId}/used-items/direct`, { method: 'POST', body: JSON.stringify(data) });
};

// Inventory
export const getInventoryItems = (companyId: number, categoryId?: number): Promise<InventoryItemOut[]> => {
    if (USE_MOCKS) {
        let items = mockStore.inventory;
        if (categoryId) items = items.filter(i => i.category_id === categoryId);
        return Promise.resolve(items as any[]);
    }
    return fetchApi(`/companies/${companyId}/inventory${categoryId ? `?category_id=${categoryId}` : ''}`);
};

export const createInventoryItem = (companyId: number, data: any): Promise<InventoryItemOut> => {
    if (USE_MOCKS) {
        const newItem = { ...data, id: mockStore.inventory.length + 1, total_quantity: 0, locations: [], company_id: companyId };
        mockStore.inventory.push(newItem);
        return Promise.resolve(newItem as any);
    }
    return fetchApi(`/companies/${companyId}/inventory`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateInventoryItem = (companyId: number, id: number, data: any): Promise<InventoryItemOut> => {
    if (USE_MOCKS) {
        const item = mockStore.inventory.find(i => i.id === id);
        if (item) Object.assign(item, data);
        return Promise.resolve(item as any);
    }
    return fetchApi(`/companies/${companyId}/inventory/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

// Members
export const getMembers = (companyId: number): Promise<MemberOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.members as any[]) : fetchApi(`/companies/${companyId}/members`);

export const createMember = (companyId: number, data: any): Promise<MemberOut> => {
    if (USE_MOCKS) {
        const newMember = { user: { id: mockStore.members.length + 1, email: data.email }, role: data.role };
        mockStore.members.push(newMember as any);
        return Promise.resolve(newMember as any);
    }
    return fetchApi(`/companies/${companyId}/members`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateMemberRole = (companyId: number, userId: number, role: RoleEnum): Promise<MemberOut> => {
    if (USE_MOCKS) {
        const member = mockStore.members.find(m => m.user.id === userId);
        if (member) member.role = role;
        return Promise.resolve(member as any);
    }
    return fetchApi(`/companies/${companyId}/members/${userId}/role`, { method: 'POST', body: JSON.stringify({ role }) });
};

// Time Logs
export const getTimeLogs = (companyId: number, params: { user_id_filter?: number, work_date?: string }): Promise<TimeLogOut[]> => {
    if (USE_MOCKS) {
        let logs = mockStore.timeLogs;
        if (params.work_date) {
            logs = logs.filter(l => l.start_time.startsWith(params.work_date!));
        }
        if (params.user_id_filter) {
            logs = logs.filter(l => l.user.id === params.user_id_filter);
        }
        return Promise.resolve(logs as any[]);
    }
    const query = new URLSearchParams(params as any).toString();
    return fetchApi(`/companies/${companyId}/time-logs?${query}`);
};

export const createTimeLog = (companyId: number, data: any): Promise<TimeLogOut> => {
    if (USE_MOCKS) {
        const newLog = { 
            ...data, 
            id: mockStore.timeLogs.length + 1, 
            status: TimeLogStatus.Pending, 
            user: { id: 1, email: "admin@profitechnik.cz" },
            duration_hours: 8 
        };
        mockStore.timeLogs.push(newLog);
        return Promise.resolve(newLog as any);
    }
    return fetchApi(`/companies/${companyId}/time-logs`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateTimeLog = (companyId: number, id: number, data: any): Promise<TimeLogOut> => {
    if (USE_MOCKS) {
        const log = mockStore.timeLogs.find(l => l.id === id);
        if (log) Object.assign(log, data);
        return Promise.resolve(log as any);
    }
    return fetchApi(`/companies/${companyId}/time-logs/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const updateTimeLogStatus = (companyId: number, timeLogId: number, status: TimeLogStatus): Promise<TimeLogOut> => {
    if (USE_MOCKS) {
        const log = mockStore.timeLogs.find(l => l.id === timeLogId);
        if (log) log.status = status;
        return Promise.resolve(log as any);
    }
    return fetchApi(`/companies/${companyId}/time-logs/${timeLogId}/status`, { method: 'POST', body: JSON.stringify({ status }) });
};

export const deleteTimeLog = (companyId: number, id: number): Promise<any> => {
    if (USE_MOCKS) {
        mockStore.timeLogs = mockStore.timeLogs.filter(l => l.id !== id);
        return Promise.resolve({ success: true });
    }
    return fetchApi(`/companies/${companyId}/time-logs/${id}`, { method: 'DELETE' });
};

// Locations
export const getLocations = (companyId: number): Promise<LocationOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.locations as any[]) : fetchApi(`/companies/${companyId}/locations`);

export const getMyLocations = (companyId: number): Promise<LocationWithPermissions[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.locations.map(l => ({ ...l, authorized_users: [] }))) : fetchApi(`/companies/${companyId}/locations/my-locations`);

export const createLocation = (companyId: number, data: any): Promise<LocationOut> => {
    if (USE_MOCKS) {
        const newLoc = { ...data, id: mockStore.locations.length + 1 };
        mockStore.locations.push(newLoc);
        return Promise.resolve(newLoc as any);
    }
    return fetchApi(`/companies/${companyId}/locations`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateLocation = (companyId: number, id: number, data: any): Promise<LocationOut> => {
    if (USE_MOCKS) {
        const loc = mockStore.locations.find(l => l.id === id);
        if (loc) Object.assign(loc, data);
        return Promise.resolve(loc as any);
    }
    return fetchApi(`/companies/${companyId}/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const deleteLocation = (companyId: number, id: number): Promise<any> => {
    if (USE_MOCKS) {
        mockStore.locations = mockStore.locations.filter(l => l.id !== id);
        return Promise.resolve({ success: true });
    }
    return fetchApi(`/companies/${companyId}/locations/${id}`, { method: 'DELETE' });
};

export const getLocationInventory = (companyId: number, locationId: number): Promise<LocationInventoryItem[]> => {
    if (USE_MOCKS) return Promise.resolve([]);
    return fetchApi(`/companies/${companyId}/locations/${locationId}/inventory`);
};

export const getLocationPermissions = (companyId: number, locationId: number): Promise<UserOut[]> => {
    if (USE_MOCKS) return Promise.resolve([]);
    return fetchApi(`/companies/${companyId}/locations/${locationId}/permissions`);
};

export const addLocationPermission = (companyId: number, locationId: number, email: string): Promise<UserOut[]> => {
    if (USE_MOCKS) return Promise.resolve([]);
    return fetchApi(`/companies/${companyId}/locations/${locationId}/permissions`, { method: 'POST', body: JSON.stringify({ email }) });
};

export const removeLocationPermission = (companyId: number, locationId: number, userId: number): Promise<any> => {
    if (USE_MOCKS) return Promise.resolve({ success: true });
    return fetchApi(`/companies/${companyId}/locations/${locationId}/permissions/${userId}`, { method: 'DELETE' });
};

// Categories
export const getCategories = (companyId: number): Promise<CategoryOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.categories as any[]) : fetchApi(`/companies/${companyId}/categories`);

export const createCategory = (companyId: number, data: any): Promise<CategoryOut> => {
    if (USE_MOCKS) {
        const newCat = { ...data, id: mockStore.categories.length + 1, children: [] };
        mockStore.categories.push(newCat);
        return Promise.resolve(newCat as any);
    }
    return fetchApi(`/companies/${companyId}/categories`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateCategory = (companyId: number, id: number, data: any): Promise<CategoryOut> => {
    if (USE_MOCKS) {
        const cat = mockStore.categories.find(c => c.id === id);
        if (cat) Object.assign(cat, data);
        return Promise.resolve(cat as any);
    }
    return fetchApi(`/companies/${companyId}/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const deleteCategory = (companyId: number, id: number): Promise<any> => {
    if (USE_MOCKS) {
        mockStore.categories = mockStore.categories.filter(c => c.id !== id);
        return Promise.resolve({ success: true });
    }
    return fetchApi(`/companies/${companyId}/categories/${id}`, { method: 'DELETE' });
};

// Work Types
export const getWorkTypes = (companyId: number): Promise<WorkTypeOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.workTypes as any[]) : fetchApi(`/companies/${companyId}/work-types`);

export const createWorkType = (companyId: number, data: any): Promise<WorkTypeOut> => {
    if (USE_MOCKS) {
        const newWt = { ...data, id: mockStore.workTypes.length + 1, company_id: companyId };
        mockStore.workTypes.push(newWt);
        return Promise.resolve(newWt as any);
    }
    return fetchApi(`/companies/${companyId}/work-types`, { method: 'POST', body: JSON.stringify(data) });
};

// Clients
export const getClients = (companyId: number): Promise<ClientOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.clients as any[]) : fetchApi(`/companies/${companyId}/clients`);

export const createClient = (companyId: number, data: any): Promise<ClientOut> => {
    if (USE_MOCKS) {
        const newClient = { ...data, id: mockStore.clients.length + 1, company_id: companyId };
        mockStore.clients.push(newClient);
        return Promise.resolve(newClient as any);
    }
    return fetchApi(`/companies/${companyId}/clients`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateClient = (companyId: number, id: number, data: any): Promise<ClientOut> => {
    if (USE_MOCKS) {
        const client = mockStore.clients.find(c => c.id === id);
        if (client) Object.assign(client, data);
        return Promise.resolve(client as any);
    }
    return fetchApi(`/companies/${companyId}/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const deleteClient = (companyId: number, id: number): Promise<any> => {
    if (USE_MOCKS) {
        mockStore.clients = mockStore.clients.filter(c => c.id !== id);
        return Promise.resolve({ success: true });
    }
    return fetchApi(`/companies/${companyId}/clients/${id}`, { method: 'DELETE' });
};

// Picking Orders
export const getPickingOrders = (companyId: number): Promise<PickingOrderOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.pickingOrders as any[]) : fetchApi(`/companies/${companyId}/picking-orders`);

export const createPickingOrder = (companyId: number, data: PickingOrderCreateIn): Promise<PickingOrderOut> => {
    if (USE_MOCKS) {
        const newOrder = { 
            ...data, 
            id: mockStore.pickingOrders.length + 1, 
            status: PickingOrderStatus.New,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            requester: { id: 1, email: "admin@profitechnik.cz" },
            picker: null,
            items: data.items.map((item, idx) => ({
                id: idx + 1,
                requested_quantity: item.requested_quantity,
                picked_quantity: null,
                inventory_item: item.inventory_item_id ? mockStore.inventory.find(i => i.id === item.inventory_item_id) : null,
                requested_item_description: item.requested_item_description || null
            }))
        };
        mockStore.pickingOrders.push(newOrder as any);
        return Promise.resolve(newOrder as any);
    }
    return fetchApi(`/companies/${companyId}/picking-orders`, { method: 'POST', body: JSON.stringify(data) });
};

export const fulfillPickingOrder = (companyId: number, orderId: number, data: PickingOrderFulfillIn): Promise<PickingOrderOut> => {
    if (USE_MOCKS) {
        const order = mockStore.pickingOrders.find(o => o.id === orderId);
        if (order) {
            (order as any).status = PickingOrderStatus.Completed;
            (order as any).picker = { id: 1, email: "admin@profitechnik.cz" };
        }
        return Promise.resolve(order as any);
    }
    return fetchApi(`/companies/${companyId}/picking-orders/${orderId}/fulfill`, { method: 'POST', body: JSON.stringify(data) });
};

// Ostatní pomocné (Service Report atd.)
export const getServiceReportData = (companyId: number, timeLogId: number): Promise<ServiceReportDataOut> => {
    if (USE_MOCKS) {
        const log = mockStore.timeLogs.find(l => l.id === timeLogId);
        const task = mockStore.tasks.find(t => t.id === log?.task?.id);
        const wo = mockStore.workOrders.find(w => w.id === task?.work_order_id);
        return Promise.resolve({
            work_order: wo as any,
            task: task as any
        });
    }
    return fetchApi(`/companies/${companyId}/time-logs/${timeLogId}/service-report-data`);
};

export const getInventoryHistory = (companyId: number, itemId: number): Promise<AuditLogOut[]> => 
    fetchApi(`/companies/${companyId}/inventory/${itemId}/history`);

export const placeStock = (companyId: number, data: any): Promise<any> => 
    fetchApi(`/companies/${companyId}/inventory/movements/place`, { method: 'POST', body: JSON.stringify(data) });

export const transferStock = (companyId: number, data: any): Promise<any> => 
    fetchApi(`/companies/${companyId}/inventory/movements/transfer`, { method: 'POST', body: JSON.stringify(data) });

export const writeOffStock = (companyId: number, payload: WriteOffStockIn): Promise<any> => 
    fetchApi(`/companies/${companyId}/inventory/movements/write-off`, { method: 'POST', body: JSON.stringify(payload) });

export const getSmtpSettings = (companyId: number): Promise<SmtpSettingsOut> => 
    USE_MOCKS ? Promise.resolve(mockStore.smtp as SmtpSettingsOut) : fetchApi(`/companies/${companyId}/smtp-settings`);

export const updateSmtpSettings = (companyId: number, data: SmtpSettingsIn): Promise<SmtpSettingsOut> => {
    if (USE_MOCKS) {
        mockStore.smtp = { ...mockStore.smtp, ...data } as any;
        return Promise.resolve(mockStore.smtp as SmtpSettingsOut);
    }
    return fetchApi(`/companies/${companyId}/smtp-settings`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const testSmtpSettings = (companyId: number): Promise<{ message: string }> => {
    if (USE_MOCKS) return Promise.resolve({ message: "Testovací email byl úspěšně odeslán." });
    return fetchApi(`/companies/${companyId}/smtp-settings/test`, { method: 'POST' });
};

export const getTriggers = (companyId: number): Promise<TriggerOut[]> => 
    USE_MOCKS ? Promise.resolve(mockStore.triggers as any[]) : fetchApi(`/companies/${companyId}/triggers`);

export const createTrigger = (companyId: number, data: TriggerCreateIn): Promise<TriggerOut> => {
    if (USE_MOCKS) {
        const newTrigger = { ...data, id: mockStore.triggers.length + 1 };
        mockStore.triggers.push(newTrigger as any);
        return Promise.resolve(newTrigger as any);
    }
    return fetchApi(`/companies/${companyId}/triggers`, { method: 'POST', body: JSON.stringify(data) });
};

export const updateTrigger = (companyId: number, id: number, data: TriggerUpdateIn): Promise<TriggerOut> => {
    if (USE_MOCKS) {
        const trigger = mockStore.triggers.find(t => t.id === id);
        if (trigger) Object.assign(trigger, data);
        return Promise.resolve(trigger as any);
    }
    return fetchApi(`/companies/${companyId}/triggers/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const getTaskTotalHours = (companyId: number, woId: number, taskId: number): Promise<TaskTotalHoursOut> => {
    if (USE_MOCKS) return Promise.resolve({ task_id: taskId, total_hours: 4.5 });
    return fetchApi(`/companies/${companyId}/work-orders/${woId}/tasks/${taskId}/total-hours`);
};

export const getTaskTimeLogs = (companyId: number, woId: number, taskId: number): Promise<TimeLogOut[]> => {
    if (USE_MOCKS) return Promise.resolve([]);
    return fetchApi(`/companies/${companyId}/work-orders/${woId}/tasks/${taskId}/time-logs`);
};