import { LoginIn } from './schemas/auth';
// FIX: Removed self-import which was causing declaration conflicts. All types are defined below and do not need to be imported from the same file.

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
    Work = "work",
    Vacation = "vacation",
    SickDay = "sick_day",
    Doctor = "doctor",
    UnpaidLeave = "unpaid_leave",
}

export enum AuditLogAction {
    Created = "created",
    Updated = "updated",
    Deleted = "deleted",
    QuantityAdjusted = "quantity_adjusted",
    WriteOff = "write_off",
}

// NEW: Enums for notification triggers
export enum TriggerType {
    InventoryLowStock = 'inventory_low_stock',
    WorkOrderBudget = 'work_order_budget',
}

export enum TriggerCondition {
    PercentageReached = 'percentage_reached',
}

export enum PickingOrderStatus {
    New = 'new',
    InProgress = 'in_progress',
    Completed = 'completed',
    Cancelled = 'cancelled',
}


// Backend Schemas (from OpenAPI)
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
}

export interface CategoryOut {
    id: number;
    name: string;
    parent_id?: number;
    children: CategoryOut[];
}

// NEW: Location type from API docs
export interface LocationOut {
    id: number;
    name: string;
    description?: string;
}

// NEW: Location type with permissions
export interface LocationWithPermissions extends LocationOut {
    authorized_users: UserOut[];
}


// NEW: Link between item and location with quantity
export interface ItemLocationQuantity {
    quantity: number;
    location: LocationOut;
}


export interface InventoryItemOut {
    id: number;
    name: string;
    sku: string;
    description?: string;
    total_quantity: number; // UPDATED from 'quantity'
    locations: ItemLocationQuantity[]; // NEW
    category_id?: number;
    ean?: string;
    image_url?: string;
    price?: number;
    vat_rate?: number;
    company_id: number;
    category?: CategoryOut;
    // NEW from API docs for stock monitoring
    is_monitored_for_stock: boolean;
    low_stock_threshold: number | null;
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
    tasks: TaskPreviewOut[]; // Corrected: List view provides previews, not full tasks.
    client?: ClientOut;
    budget_hours?: number;
}

export interface TaskPreviewForTimeLog {
    id: number;
    name: string;
}

// NEW from spec: Data for creating a new task directly from a time log.
export interface NewTaskData {
    work_order_id: number;
    name: string;
}

export interface TimeLogOut {
    id: number;
    start_time: string; // ISO datetime string
    end_time: string;   // ISO datetime string
    entry_type: TimeLogEntryType;
    notes?: string;
    status: TimeLogStatus;
    user: UserOut;

    // Work-specific fields (optional)
    work_type_id?: number;
    task_id?: number;
    break_duration_minutes?: number;
    is_overtime?: boolean;
    work_type?: WorkTypeOut;
    task?: TaskPreviewForTimeLog;
    new_task?: NewTaskData | null; // From API spec
    
    duration_hours: number; // Computed property from backend
}

// NEW from spec: Input types for creating/updating time logs
export interface TimeLogCreateIn {
    start_time: string;
    end_time: string;
    entry_type: TimeLogEntryType;
    notes?: string | null;
    work_type_id?: number | null;
    task_id?: number | null;
    new_task?: NewTaskData | null;
    break_duration_minutes?: number;
    is_overtime?: boolean;
}

export type TimeLogUpdateIn = TimeLogCreateIn;


export interface MemberUserOut {
    id: number;
    email: string;
}

export interface MemberOut {
    user: MemberUserOut;
    role: RoleEnum;
}

export interface AuditLogItemPreview {
    id: number;
    name: string;
    sku: string;
}

export interface AuditLogOut {
    id: number;
    timestamp: string; // ISO datetime string
    action: AuditLogAction;
    details: string | null;
    user: UserOut | null;
    inventory_item: AuditLogItemPreview | null;
}

// NEW: Types for the billing report endpoint
export interface BillingReportTimeLogOut {
    work_date: string; // date string
    hours: number;
    rate: number;
    total_price: number;
    work_type_name: string;
    user_email: string;
    task_name: string;
}

export interface BillingReportUsedItemOut {
    item_name: string;
    sku: string;
    quantity: number;
    price: number | null; // price per unit
    total_price: number | null;
    task_name: string;
}

export interface BillingReportOut {
    work_order_name: string;
    client_name: string | null;
    total_hours: number;
    total_price_work: number;
    total_price_inventory: number;
    grand_total: number;
    time_logs: BillingReportTimeLogOut[];
    used_items: BillingReportUsedItemOut[];
}

// NEW from spec for periodic billing
export interface ClientBillingReportOut {
    client_name: string;
    total_hours: number;
    total_price_work: number;
    total_price_inventory: number;
    grand_total: number;
    time_logs: BillingReportTimeLogOut[];
    used_items: BillingReportUsedItemOut[];
}

// NEW: Total hours for a single task
export interface TaskTotalHoursOut {
    task_id: number;
    total_hours: number;
}


// NEW: Recommended structure for service report data from backend
export interface ServiceReportDataOut {
    work_order: WorkOrderOut;
    task: TaskOut;
}

// NEW: Types for SMTP settings
export interface SmtpNotificationSettings {
    on_invite_created: boolean;
    on_budget_alert: boolean;

    on_low_stock_alert: boolean;
}

export interface SmtpSettingsOut {
    id: number;
    smtp_host: string | null;
    smtp_port: number | null;
    smtp_user: string | null;
    sender_email: string | null;
    password_is_set: boolean;
    security_protocol: 'none' | 'tls' | 'ssl';
    notification_settings: SmtpNotificationSettings;
}

export interface SmtpSettingsIn {
    is_enabled?: boolean;
    smtp_host?: string | null;
    smtp_port?: number | null;
    smtp_user?: string | null;
    smtp_password?: string; // Optional on update
    sender_email?: string | null;
    security_protocol?: 'none' | 'tls' | 'ssl';
    notification_settings?: SmtpNotificationSettings;
}


// NEW: Types for Notification Triggers
export interface TriggerOut {
    id: number;
    is_active: boolean;
    trigger_type: TriggerType;
    condition: TriggerCondition | null;
    threshold_value: number | null;
    recipient_emails: string[];
}

export interface TriggerCreateIn {
    is_active: boolean;
    trigger_type: TriggerType;
    condition?: TriggerCondition | null;
    threshold_value?: number | null;
    recipient_emails: string[];
}

export type TriggerUpdateIn = Partial<TriggerCreateIn>;

// NEW: For the location inventory endpoint
export interface LocationInventoryItemPreview {
  id: number;
  name: string;
  sku: string;
  image_url: string | null;
  price: number | null;
}

export interface LocationInventoryItem {
  quantity: number;
  inventory_item: LocationInventoryItemPreview;
}

// NEW: For direct assign inventory endpoint
export interface DirectAssignItemIn {
    inventory_item_id: number;
    quantity: number;
    details?: string;
}

// NEW: For stock write-off
export interface WriteOffStockIn {
    inventory_item_id: number;
    location_id: number;
    quantity: number;
    details: string;
}

// NEW: Picking Orders
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
    updated_at: string;
    source_location: LocationOut | null;
    destination_location: LocationOut;
    requester: UserOut;
    picker: UserOut | null;
    items: PickingOrderItemOut[];
}

export interface PickingOrderItemIn {
    inventory_item_id?: number;
    requested_item_description?: string;
    requested_quantity: number;
}

export interface PickingOrderCreateIn {
    source_location_id?: number | null;
    destination_location_id: number;
    notes?: string;
    items: PickingOrderItemIn[];
}

export interface PickingOrderFulfillItemIn {
    picking_order_item_id: number;
    picked_quantity: number;
    inventory_item_id?: number; // For linking free-text items
    source_location_id: number; // NEW from backend changes
}

export interface PickingOrderFulfillIn {
    items: PickingOrderFulfillItemIn[];
}


// Frontend-specific types
export type Company = CompanyOut;
export type User = UserOut;
export type Customer = ClientOut;
export type WorkOrder = WorkOrderOut;
export type Task = TaskOut;
export type Client = ClientOut;
export type Membership = MemberOut;
export type TimeLog = TimeLogOut;
export type WorkType = WorkTypeOut;
export type InventoryItem = InventoryItemOut;
export type Category = CategoryOut;
export type WorkRate = WorkType; // Alias
export type InventoryMovement = AuditLogOut;
export type Location = LocationOut; // NEW
export type PickingOrder = PickingOrderOut; // NEW

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

export interface Job {
    id: number;
    title: string;
    description: string;
    serviceReports: ServiceReport[];
}

export interface TimeEntry {
    id: string;
    employeeId: string;
    jobId: number;
    date: string;
    startTime: string;
    endTime: string;
    description: string;
    activity: string;
    isBillable: boolean;
    workRateId?: string;
}

export interface VatSettings {
    laborRate: number;
    materialRate: number;
}

export interface Employee {
    id: string;
    name: string;
    role: string;
    hourlyRate: number;
    vacationDaysTotal: number;
    vacationDaysUsed: number;
}

export interface PayrollSettings {
    overtimeRate: number;
    overtimeThreshold: number;
    weekendRate: number;
    holidayRate: number;
    nightRate: number;
}

export interface TemplateDayEntry {
    id: string; // for React keys
    workOrderId: string;
    taskId: string;
    workTypeId: string;
    startTime: string; // HH:mm
    endTime: string; // HH:mm
    breakMinutes: number;
    isOvertime: boolean;
    notes: string;
}