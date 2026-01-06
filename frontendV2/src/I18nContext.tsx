import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { getCookie, setCookie } from './utils/cookies';

// Define translations directly in the context file
const translations = {
  cs: {
    navigation: {
      dashboard: 'Přehled',
      attendance: 'Docházka',
      jobs: 'Zakázky',
      inventory: 'Sklad',
      pickingOrders: 'Žádanky',
      planning: 'Plánování',
      admin: 'Správa',
      logout: 'Odhlásit se',
      logoutAria: 'Odhlásit se',
      expandMenu: 'Rozbalit menu',
      collapseMenu: 'Sbalit menu',
    },
    dashboard: {
      budget: 'Budget',
      remaining: 'Zbývá: {remaining} / {budget} h',
      worked: 'Odpracováno: {worked} hod ({percentage}%)',
      loading: 'Načítání přehledu...',
      logAttendance: 'Zapsat docházku',
      manageJobs: 'Spravovat zakázky',
      monthlyReport: 'Měsíční výkaz',
      planning: 'Plánování',
      activeJobs: 'Aktivní zakázky',
      clientMissing: 'Klient chybí',
      noActiveJobs: 'Nejsou zde žádné aktivní zakázky.',
      newJobs: 'Nové zakázky',
      noNewJobs: 'Nejsou zde žádné nové zakázky.',
      welcome: 'Vítejte, {name}',
      todayOverview: 'Zde je přehled vašeho dnešního dne.',
    },
    jobs: {
      title: 'Zakázky',
      periodicBilling: 'Periodická fakturace',
      newJob: 'Nová zakázka',
      status: {
        new: 'Nová',
        in_progress: 'Probíhá',
        completed: 'Hotovo',
        billed: 'Fakturováno',
      },
      detailsLoading: 'Načítání detailu zakázky...',
      backToOverview: 'Zpět na přehled',
      edit: 'Upravit',
      changeStatus: 'Změnit stav',
      invoice: 'Faktura',
      tasks: 'Úkoly',
      closeTaskForm: 'Zavřít',
      newTask: 'Nový úkol',
      newTaskPlaceholder: 'Název nového úkolu',
      createTask: 'Vytvořit úkol',
      unassigned: 'Nepřiřazeno',
      editTask: 'Upravit úkol',
      usedMaterial: 'Použitý materiál',
      add: 'Přidat',
      noMaterialUsed: 'Zatím nebyl použit žádný materiál.',
      confirmDeleteMaterialTitle: 'Smazat materiál',
      confirmDeleteMaterialMessage: 'Opravdu chcete odebrat tento materiál z úkolu?',
      loading: 'Načítání zakázek...',
    },
    inventory: {
        title: 'Sklad',
        newItem: 'Nová položka',
        searchPlaceholder: 'Hledat podle názvu nebo SKU...',
        allCategories: 'Všechny kategorie',
        items: 'Položky',
        locations: 'Lokace',
        categories: 'Kategorie',
        colItemName: 'Název položky',
        colSku: 'SKU',
        colTotal: 'Celkem ks',
        colPrice: 'Cena',
        colCategory: 'Kategorie',
        colActions: 'Akce',
        monitored: 'Hlídáno pro nízký stav zásob (práh: {threshold})',
        edit: 'Upravit',
        stockOperations: 'Skladové operace',
        noItemsFound: 'Nebyly nalezeny žádné položky odpovídající filtrům.',
        noItemsExist: 'Zatím nebyly vytvořeny žádné skladové položky.',
        loading: 'Načítání skladu...',
    },
    pickingOrders: {
      title: 'Žádanky',
      newOrder: 'Vytvořit žádanku',
      fulfill: 'Vychystat',
      detail: 'Detail',
      status: {
        new: 'Nová',
        in_progress: 'V přípravě',
        completed: 'Dokončeno',
        cancelled: 'Zrušeno',
      },
      from: 'Z',
      to: 'Do',
      createdBy: 'Vytvořeno',
      requestedBy: 'Požaduje',
      pickedBy: 'Vydává',
      items: 'Položky',
      requested: 'Požadováno',
      picked: 'Vydáno',
      backToOverview: 'Zpět na přehled',
      loading: 'Načítání žádanek...',
      // Create Form
      createModalTitle: 'Nová žádanka o materiál',
      sourceLocation: 'Zdrojový sklad',
      destinationLocation: 'Cílový sklad',
      notes: 'Poznámky',
      addItem: 'Přidat položku',
      itemFromStock: 'Ze skladu',
      itemCustom: 'Vlastní popis',
      searchItem: 'Hledat položku...',
      itemDescription: 'Popis položky',
      quantity: 'Množství',
      save: 'Uložit žádanku',
      // Fulfill Form
      fulfillModalTitle: 'Vychystání žádanky #{id}',
      requestedItem: 'Požadovaná položka',
      pickedQuantity: 'Vychystané množství',
      linkToInventoryItem: 'Přiřadit skladovou kartu',
      saveFulfillment: 'Potvrdit a přesunout',
      // New view options
      allOrders: 'Všechny žádanky',
      myOrders: 'Moje žádanky',
      uncompleted: 'Nevyřízené',
      completed: 'Vyřízené',
      mainWarehouse: 'Hlavní sklad',
    },
    login: {
      title: 'Přihlásit se do systému',
      prompt: 'Zadejte své přihlašovací údaje',
      loginFailed: 'Přihlášení se nezdařilo. Zkontrolujte své údaje.',
      emailPlaceholder: 'Emailová adresa',
      passwordPlaceholder: 'Heslo',
      rememberMe: 'Pamatovat si mě',
      loggingIn: 'Přihlašování...',
      loginButton: 'Přihlásit se',
    },
  },
  en: {
    navigation: {
      dashboard: 'Dashboard',
      attendance: 'Attendance',
      jobs: 'Jobs',
      inventory: 'Inventory',
      pickingOrders: 'Picking Orders',
      planning: 'Planning',
      admin: 'Admin',
      logout: 'Logout',
      logoutAria: 'Logout',
      expandMenu: 'Expand menu',
      collapseMenu: 'Collapse menu',
    },
    dashboard: {
      budget: 'Budget',
      remaining: 'Remaining: {remaining} / {budget} h',
      worked: 'Worked: {worked} hours ({percentage}%)',
      loading: 'Loading dashboard...',
      logAttendance: 'Log Attendance',
      manageJobs: 'Manage Jobs',
      monthlyReport: 'Monthly Report',
      planning: 'Planning',
      activeJobs: 'Active Jobs',
      clientMissing: 'Client missing',
      noActiveJobs: 'There are no active jobs.',
      newJobs: 'New Jobs',
      noNewJobs: 'There are no new jobs.',
      welcome: 'Welcome, {name}',
      todayOverview: "Here's your overview for today.",
    },
    jobs: {
      title: 'Jobs',
      periodicBilling: 'Periodic Billing',
      newJob: 'New Job',
      status: {
        new: 'New',
        in_progress: 'In Progress',
        completed: 'Completed',
        billed: 'Billed',
      },
      detailsLoading: 'Loading job details...',
      backToOverview: 'Back to Overview',
      edit: 'Edit',
      changeStatus: 'Change Status',
      invoice: 'Invoice',
      tasks: 'Tasks',
      closeTaskForm: 'Close',
      newTask: 'New Task',
      newTaskPlaceholder: 'New task name',
      createTask: 'Create Task',
      unassigned: 'Unassigned',
      editTask: 'Edit Task',
      usedMaterial: 'Used Material',
      add: 'Add',
      noMaterialUsed: 'No material has been used yet.',
      confirmDeleteMaterialTitle: 'Delete Material',
      confirmDeleteMaterialMessage: 'Are you sure you want to remove this material from the task?',
      loading: 'Loading jobs...',
    },
    inventory: {
        title: 'Inventory',
        newItem: 'New Item',
        searchPlaceholder: 'Search by name or SKU...',
        allCategories: 'All categories',
        items: 'Items',
        locations: 'Locations',
        categories: 'Categories',
        colItemName: 'Item Name',
        colSku: 'SKU',
        colTotal: 'Total Qty',
        colPrice: 'Price',
        colCategory: 'Category',
        colActions: 'Actions',
        monitored: 'Monitored for low stock (threshold: {threshold})',
        edit: 'Edit',
        stockOperations: 'Stock Operations',
        noItemsFound: 'No items found matching the filters.',
        noItemsExist: 'No inventory items have been created yet.',
        loading: 'Loading inventory...',
    },
     pickingOrders: {
      title: 'Picking Orders',
      newOrder: 'Create Order',
      fulfill: 'Fulfill',
      detail: 'Detail',
      status: {
        new: 'New',
        in_progress: 'In Progress',
        completed: 'Completed',
        cancelled: 'Cancelled',
      },
      from: 'From',
      to: 'To',
      createdBy: 'Created at',
      requestedBy: 'Requested by',
      pickedBy: 'Picked by',
      items: 'Items',
      requested: 'Requested',
      picked: 'Picked',
      backToOverview: 'Back to Overview',
      loading: 'Loading picking orders...',
      // Create Form
      createModalTitle: 'New Material Request',
      sourceLocation: 'Source Location',
      destinationLocation: 'Destination Location',
      notes: 'Notes',
      addItem: 'Add Item',
      itemFromStock: 'From Stock',
      itemCustom: 'Custom Description',
      searchItem: 'Search item...',
      itemDescription: 'Item description',
      quantity: 'Quantity',
      save: 'Save Request',
      // Fulfill Form
      fulfillModalTitle: 'Fulfill Request #{id}',
      requestedItem: 'Requested Item',
      pickedQuantity: 'Picked Quantity',
      linkToInventoryItem: 'Link to inventory item',
      saveFulfillment: 'Confirm and Transfer',
      // New view options
      allOrders: 'All Orders',
      myOrders: 'My Orders',
      uncompleted: 'Uncompleted',
      completed: 'Completed',
      mainWarehouse: 'Main Warehouse',
    },
    login: {
      title: 'Sign in to the system',
      prompt: 'Enter your credentials to continue',
      loginFailed: 'Login failed. Please check your credentials.',
      emailPlaceholder: 'Email address',
      passwordPlaceholder: 'Password',
      rememberMe: 'Remember me',
      signingIn: 'Signing in...',
      loginButton: 'Sign in',
    },
  },
};

type Language = 'cs' | 'en';
type Translations = typeof translations;

interface I18nContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string, params?: { [key: string]: string | number }) => string;
    translations: Translations[Language];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Helper to get nested property
const get = (obj: any, path: string) => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(() => {
        const savedLang = getCookie('profitechnik_lang');
        return (savedLang === 'cs' || savedLang === 'en') ? savedLang : 'cs';
    });
    
    const setLanguage = (lang: Language) => {
        setCookie('profitechnik_lang', lang, 365);
        setLanguageState(lang);
    };

    const t = useCallback((key: string, params?: { [key: string]: string | number }) => {
        let translation = get(translations[language], key);
        if (typeof translation !== 'string') {
            console.warn(`Translation key "${key}" not found for language "${language}".`);
            return key;
        }

        if (params) {
            Object.keys(params).forEach(paramKey => {
                translation = translation.replace(`{${paramKey}}`, String(params[paramKey]));
            });
        }
        return translation;
    }, [language]);

    const value = {
        language,
        setLanguage,
        t,
        translations: translations[language]
    };

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
};

export const useI18n = () => {
    const context = useContext(I18nContext);
    if (context === undefined) {
        throw new Error('useI18n must be used within an I18nProvider');
    }
    return context;
};