
import { LoginIn } from './schemas/auth';

// Enums
export enum RoleEnum {
    Owner = 'owner',
    Admin = 'admin',
    Member = 'member',
}

export enum View {
    Dashboard = 'Dashboard',
    Attendance = 'Attendance',
    Jobs = 'Jobs',
    Inventory = 'Inventory',
    PickingOrders = 'PickingOrders',
    Admin = 'Admin',
    Planning = 'Planning',
}

export enum WorkTypeName {
    Installation = 'Installation',
    Service = 'Service',
    Revision = 'Revision',
    Repair = 'Repair',
}

export enum TimeLogStatus {
    Pending = "pending",
    Approved = "approved",
    Rejected = "rejected",
}

export enum TimeLogEntryType {
    Work = "WORK",
    Vacation = "VACATION",
    SickDay = "SICK_DAY",
    Doctor = "DOCTOR",
    UnpaidLeave = "UNPAID_LEAVE",
}

export enum AuditLogAction {
    Created = "created",
    Updated = "updated",
    Deleted = "deleted",
    QuantityAdjusted = "quantity_adjusted",
    LocationPlaced = "location_placed",
    LocationWithdrawn = "location_withdrawn",
    LocationTransferred = "location_transferred",
    WriteOff = "write_off",
    PickingFulfilled = "picking_fulfilled"
}

export enum TriggerType {
    WorkOrderBudget = 'WORK_ORDER_BUDGET',
    InventoryLowStock = 'INVENTORY_LOW_STOCK',
}

export enum TriggerCondition {
    PercentageReached = 'PERCENTAGE_REACHED',
    QuantityBelow = 'QUANTITY_BELOW'
}

export enum PickingOrderStatus {
    New = 'NEW',
    InProgress = 'IN_PROGRESS',
    Completed = 'COMPLETED',
    Cancelled = 'CANCELLED',
}


// Backend Schemas
export interface CompanyOut {
    id: number;
    name: string;
    slug: string;
    logo_url?: string;
    legal_name?: string;
    address?: string;
    ico?: string;
    dic?: string;
    executive?: string;
    bank_account?: string;
    iban?: string;
}

export interface UserOut {
    id: number;
    email: string;
}

export interface ClientOut {
    id: number;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    company_id: number;
    legal_name?: string;
    contact_person?: string;
    ico?: string;
    dic?: string;
    margin_percentage?: number;
}

export interface CategoryOut {
    id: number;
    name: string;
    parent_id?: number;
    children: CategoryOut[];
}

export interface LocationOut {
    id: number;
    name: string;
    description?: string;
    authorized_users: UserOut[];
}

export interface ItemLocationStockOut {
    quantity: number;
    location: LocationOut;
}

export interface ManufacturerOut {
    id: number;
    name: string;
}

export interface SupplierOut {
    id: number;
    name: string;
}
export interface InventoryItemOut {
    id: number;
    name: string;
    sku: string;
    description?: string;
    manufacturer?: ManufacturerOut;
    supplier?: SupplierOut;     
    total_quantity: number;
    locations: ItemLocationStockOut[];
    category_ids: number[];
    categories: CategoryOut[];
    ean?: string;
    image_url?: string;
    price?: number;
    vat_rate?: number;
    company_id: number;
    is_monitored_for_stock: boolean;
    low_stock_threshold: number | null;
    alternative_sku?: string;
    retail_price?: number; // Koncová cena (MOC)
}

export interface WorkTypeOut {
    id: number;
    name: string;
    rate: number;
    company_id: number;
}

export interface TaskPreviewOut {
    id: number;
    name: string;
    status: string;
}

export interface UsedItemInventoryPreviewOut {
    id: number;
    name: string;
    sku: string;
}

export interface UsedItemOut {
    id: number;
    quantity: number;
    inventory_item: UsedItemInventoryPreviewOut;
}

export interface TaskOut {
    id: number;
    name: string;
    description?: string;
    status: string;
    work_order_id: number;
    assignee?: UserOut;
    used_items: UsedItemOut[];
}

export interface WorkOrderOut {
    id: number;
    name: string;
    description?: string;
    client_id?: number;
    company_id: number;
    status: string;
    tasks: TaskPreviewOut[];
    client?: ClientOut;
    budget_hours?: number;
    // Added to support history reporting
    serviceReports?: ServiceReport[];
}

export interface TimeLogOut {
    id: number;
    start_time: string;
    end_time: string;
    entry_type: TimeLogEntryType;
    notes?: string;
    status: TimeLogStatus;
    user: UserOut;
    work_type_id?: number;
    task_id?: number;
    work_type?: WorkTypeOut;
    task?: { id: number; name: string };
    duration_hours: number;
    // Added missing properties
    break_duration_minutes?: number;
    is_overtime?: boolean;
}

export interface AuditLogOut {
    id: number;
    timestamp: string;
    action: AuditLogAction;
    details: string | null;
    user: UserOut | null;
    inventory_item: UsedItemInventoryPreviewOut | null;
}

export interface BillingReportOut {
    work_order_name: string;
    client_name: string | null;
    total_hours: number;
    total_price_work: number;
    total_price_inventory: number;
    grand_total: number;
    time_logs: any[];
    used_items: any[];
}

export interface ClientBillingReportOut extends Omit<BillingReportOut, 'work_order_name'> {
    client_name: string;
}

export interface ServiceReportDataOut {
    work_order: WorkOrderOut;
    task: TaskOut;
}

export interface SmtpSettingsOut {
    id: number;
    is_enabled: boolean;
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_user: string | null;
    sender_email: string | null;
    password_is_set: boolean;
    security_protocol: 'NONE' | 'TLS' | 'SSL';
    notification_settings: any;
}

export interface TriggerOut {
    id: number;
    is_active: boolean;
    trigger_type: TriggerType;
    condition: TriggerCondition;
    threshold_value: number;
    recipient_emails: string[];
    company_id: number;
}

export interface PickingOrderItemOut {
    id: number;
    requested_quantity: number;
    picked_quantity: number | null;
    inventory_item: InventoryItemOut | null;
    requested_item_description: string | null;
}

export interface PickingOrderOut {
    id: number;
    status: PickingOrderStatus;
    notes: string | null;
    created_at: string;
    requester: UserOut;
    // Added picker property
    picker?: UserOut | null;
    source_location: LocationOut | null;
    destination_location: LocationOut;
    items: PickingOrderItemOut[];
}

// Missing Interfaces and Type Aliases
export interface Membership {
    user: UserOut;
    role: RoleEnum;
    // Added for payroll/payslip functionality
    hourlyRate?: number;
    vacationDaysTotal?: number;
    vacationDaysUsed?: number;
}
export type MemberOut = Membership;

export type WorkType = WorkTypeOut;
export type TimeLog = TimeLogOut;

export interface VatSettings {
    laborRate: number;
    materialRate: number;
}

export type Employee = Membership;
export type TimeEntry = TimeLogOut;

export interface PayrollSettings {
    overtimeRate: number;
    overtimeThreshold: number;
    weekendRate: number;
    holidayRate: number;
    nightRate: number;
}

export type Job = WorkOrderOut;
export type Customer = ClientOut;

export interface DirectAssignItemIn {
    inventory_item_id: number;
    quantity: number;
    details?: string;
}

export interface TimeLogCreateIn {
    entry_type: TimeLogEntryType;
    start_time: string;
    end_time: string;
    notes: string | null;
    task_id?: number | null;
    new_task?: {
        work_order_id: number;
        name: string;
    } | null;
    work_type_id?: number;
    break_duration_minutes?: number;
    is_overtime?: boolean;
}

export interface SmtpSettingsIn {
    is_enabled: boolean;
    smtp_host?: string | null;
    smtp_port?: number | null;
    smtp_user?: string | null;
    smtp_password?: string;
    sender_email?: string | null;
    security_protocol?: 'NONE' | 'TLS' | 'SSL';
    notification_settings?: any;
}

export interface TriggerCreateIn {
    is_active: boolean;
    trigger_type: TriggerType;
    condition?: TriggerCondition;
    threshold_value?: number;
    recipient_emails: string[];
}

export interface TriggerUpdateIn extends Partial<TriggerCreateIn> {}

export interface LocationInventoryItem {
    inventory_item: InventoryItemOut;
    quantity: number;
}

export interface PickingOrderItemIn {
    inventory_item_id?: number;
    requested_item_description?: string;
    requested_quantity: number;
}

export interface PickingOrderCreateIn {
    source_location_id: number | null;
    destination_location_id: number;
    notes?: string;
    items: PickingOrderItemIn[];
}

export interface PickingOrderFulfillItemIn {
    picking_order_item_id: number;
    picked_quantity: number;
    source_location_id: number;
    inventory_item_id?: number;
}

export interface PickingOrderFulfillIn {
    items: PickingOrderFulfillItemIn[];
}

export interface TaskTotalHoursOut {
    total_hours: number;
}

// Helper types for forms
export type Company = CompanyOut;
export type User = UserOut;
export type Client = ClientOut;
export type WorkOrder = WorkOrderOut;
export type Task = TaskOut;
export type InventoryItem = InventoryItemOut;
export type Category = CategoryOut;
export type Location = LocationOut;
export type PickingOrder = PickingOrderOut;

export interface Photo {
    id: string;
    dataUrl: string;
}

export interface ServiceReport {
    id: string;
    jobId: number;
    taskId?: number;
    date: string;
    technicians: string[];
    arrivalTime: string;
    kmDriven: number;
    workDescription: string;
    isWarrantyRepair: boolean;
    materialsUsed: { id: string; name: string; quantity: number }[];
    notes: string;
    workType: WorkTypeName[];
    photos: Photo[];
    workHours?: number;
    technicianSignature: string | null;
    customerSignature: string | null;
    timeLogs: TimeLogOut[];
}

export interface TemplateDayEntry {
    id: string;
    workOrderId: string;
    taskId: string;
    workTypeId: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    isOvertime: boolean;
    notes: string;
}
export interface ClientCategoryMargin {
    category_id: number;
    category_name?: string; // Název pro zobrazení
    margin_percentage: number;
}

export interface BillingReportItem {
    item_id: number;
    item_name: string;
    task_name: string;
    quantity: number;
    unit_cost: number; // Nákupní cena
    margin_applied: number; // Použitá marže v %
    unit_price_sold: number; // Prodejní cena za kus
    total_price: number; // Celkem
    category_name?: string;
}

// Upravíme BillingReportOut
export interface BillingReportOut {
    work_order_name: string;
    client_name: string | null;
    total_hours: number;
    total_price_work: number;
    total_price_inventory: number;
    grand_total: number;
    time_logs: any[];
    // Změna z any[] na konkrétní typ
    used_items: BillingReportItem[]; 
}

export interface PohodaSettingsIn {
    is_enabled: boolean;
    mserver_url?: string;
    mserver_user?: string;
    mserver_password?: string;
    ico_of_accounting_entity?: string;
}