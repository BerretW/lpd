export interface QuoteItem {
    id: number;
    section_id: number;
    name: string;
    unit: string;
    quantity: number;
    material_price: number;
    assembly_price: number;
    inventory_item_id?: number;
    inventory_category_name?: string;
    sort_order: number;
    is_reduced_work: boolean;
}

export interface QuoteSection {
    id: number;
    quote_id: number;
    name: string;
    prefix?: string;
    sort_order: number;
    is_extras: boolean;
    items: QuoteItem[];
}

export interface CategoryAssembly {
    id: number;
    quote_id: number;
    category_name: string;
    assembly_price_per_unit: number;
}

export interface Quote {
    id: number;
    company_id: number;
    site_id?: number;
    parent_quote_id?: number;
    name: string;
    version: number;
    status: string;
    customer_id?: number;
    customer_name?: string;
    prepared_by?: string;
    prepared_by_phone?: string;
    validity_days: number;
    currency: string;
    vat_rate: number;
    global_discount: number;
    global_discount_type: string;
    global_hourly_rate: number;
    notes?: string;
    created_at: string;
    updated_at: string;
    sections: QuoteSection[];
    category_assemblies: CategoryAssembly[];
    sub_quotes: Quote[];
}
