import React, { useRef, useState } from 'react';
import { registerPlugin, PluginComponentProps } from '../../lib/PluginSystem';
import Button from '../common/Button';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import ErrorMessage from '../common/ErrorMessage';

const MAX_CATEGORY_LEVELS = 9;

// Definice polí, která systém umí importovat
const SYSTEM_FIELDS = [
    { key: 'name', label: 'Název položky', required: true },
    { key: 'sku', label: 'SKU (Kód)', required: true },
    { key: 'alt_sku', label: 'Alt. SKU (Dodavatel)', required: false },
    { key: 'ean', label: 'EAN', required: false },
    { key: 'supplier', label: 'Dodavatel', required: false },
    { key: 'manufacturer', label: 'Výrobce', required: false },
    { key: 'price', label: 'Nákupní cena', required: false },
    { key: 'description', label: 'Popis', required: false },
    { key: 'quantity', label: 'Množství (naskladnit)', required: false },
    { key: 'location', label: 'Název Lokace', required: false },
];

const InventoryImportPlugin: React.FC<PluginComponentProps> = ({ context }) => {
    const { companyId, refresh } = context;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Mapování: klíč = systémové pole, hodnota = index sloupce v Excelu (jako string)
    const [mapping, setMapping] = useState<Record<string, string>>({});

    // Hierarchie kategorií: pole indexů sloupců (jako string), až 9 úrovní
    const [categoryLevels, setCategoryLevels] = useState<string[]>(['']);

    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- FUNKCE PRO EXPORT ---
    const handleExport = async () => {
        setExporting(true);
        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');

            const response = await fetch(`/api/plugins/inventory-import/export?company_id=${companyId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Chyba při generování exportu.");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sklad_export.xlsx`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();

        } catch (err) {
            alert(err instanceof Error ? err.message : "Export se nezdařil.");
        } finally {
            setExporting(false);
        }
    };

    // --- FUNKCE PRO IMPORT ---

    // Krok 1: Výběr souboru a získání hlaviček (Preview)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const res = await fetch(`/api/plugins/inventory-import/preview?company_id=${companyId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!res.ok) throw new Error("Nepodařilo se načíst soubor.");

            const data = await res.json();
            setExcelHeaders(data.headers);

            // Inteligentní předvyplnění (pokud se názvy shodují)
            const initialMapping: Record<string, string> = {};
            SYSTEM_FIELDS.forEach(field => {
                const index = data.headers.findIndex((h: string) =>
                    h.toLowerCase().includes(field.label.toLowerCase()) ||
                    h.toLowerCase() === field.key
                );
                if (index !== -1) {
                    initialMapping[field.key] = index.toString();
                }
            });
            setMapping(initialMapping);
            setCategoryLevels(['']);

            setIsModalOpen(true);

        } catch (err) {
            alert(err instanceof Error ? err.message : "Chyba při čtení souboru.");
            setFile(null);
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Krok 2: Uživatel mění mapování v modálu
    const handleMappingChange = (fieldKey: string, colIndex: string) => {
        setMapping((prev: Record<string, string>) => ({ ...prev, [fieldKey]: colIndex }));
    };

    // Správa úrovní hierarchie kategorií
    const handleCategoryLevelChange = (levelIndex: number, colIndex: string) => {
        setCategoryLevels((prev: string[]) => {
            const updated = [...prev];
            updated[levelIndex] = colIndex;
            return updated;
        });
    };

    const addCategoryLevel = () => {
        if (categoryLevels.length < MAX_CATEGORY_LEVELS) {
            setCategoryLevels((prev: string[]) => [...prev, '']);
        }
    };

    const removeCategoryLevel = (levelIndex: number) => {
        setCategoryLevels((prev: string[]) => prev.filter((_: string, i: number) => i !== levelIndex));
    };

    // Krok 3: Odeslání importu s finálním mapováním
    const handleImport = async () => {
        if (!file) return;

        // Validace povinných polí
        const missingRequired = SYSTEM_FIELDS.filter(f => f.required && !mapping[f.key]);
        if (missingRequired.length > 0) {
            setError(`Prosím vyberte sloupec pro povinná pole: ${missingRequired.map(f => f.label).join(', ')}`);
            return;
        }

        setLoading(true);
        setError(null);

        // Převedeme mapping na formát { "name": 0, "sku": 5 } (čísla)
        const finalMapping: Record<string, number | number[]> = {};
        Object.entries(mapping).forEach(([key, val]) => {
            if (val !== "") finalMapping[key] = parseInt(val, 10);
        });

        // Kategorie jako pole indexů (filtrujeme prázdné)
        const categoryIndices = categoryLevels
            .filter((v: string) => v !== '')
            .map((v: string) => parseInt(v, 10));
        if (categoryIndices.length > 0) {
            finalMapping['category_levels'] = categoryIndices;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('mapping', JSON.stringify(finalMapping));

        try {
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            const response = await fetch(`/api/plugins/inventory-import/upload?company_id=${companyId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "Chyba importu");
            }

            const stats = await response.json();

            let msg = `Import dokončen!\n\n` +
                      `Vytvořeno: ${stats.created}\n` +
                      `Aktualizováno: ${stats.updated}\n` +
                      `Přeskočeno: ${stats.skipped}`;

            if (stats.errors && stats.errors.length > 0) {
                msg += `\n\nChyby (${stats.errors.length}):\n` +
                       stats.errors.slice(0, 5).join('\n') +
                       (stats.errors.length > 5 ? '\n...' : '');
            }
            alert(msg);

            handleClose();
            if (refresh) refresh();

        } catch (err) {
            setError(err instanceof Error ? err.message : "Chyba při nahrávání.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setFile(null);
        setMapping({});
        setCategoryLevels(['']);
        setError(null);
    };

    const headerOptions = (
        <>
            <option value="">-- Ignorovat --</option>
            {excelHeaders.map((header: string, idx: number) => (
                <option key={idx} value={idx}>
                    {header} (Sloupec {idx + 1})
                </option>
            ))}
        </>
    );

    return (
        <div className="flex space-x-2">
            {/* TLAČÍTKO EXPORT */}
            <Button
                onClick={handleExport}
                variant="secondary"
                disabled={exporting || loading}
                className="!bg-blue-600 !text-white hover:!bg-blue-700"
                title="Stáhnout aktuální stav skladu do Excelu"
            >
                <Icon name={exporting ? "fa-spinner fa-spin" : "fa-file-excel"} className="mr-2" />
                {exporting ? "Exportuji..." : "Export XLS"}
            </Button>

            {/* TLAČÍTKO IMPORT */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx"
                className="hidden"
            />

            <Button
                onClick={() => fileInputRef.current?.click()}
                variant="secondary"
                disabled={loading || exporting}
                className="!bg-emerald-600 !text-white hover:!bg-emerald-700"
                title="Nahrát položky z Excelu"
            >
                <Icon name={loading ? "fa-spinner fa-spin" : "fa-file-import"} className="mr-2" />
                {loading ? "Čekejte..." : "Import XLS"}
            </Button>

            {/* MODÁLNÍ OKNO PRO MAPOVÁNÍ */}
            {isModalOpen && (
                <Modal title="Mapování sloupců importu" onClose={handleClose}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600 mb-4">
                            Vyberte, který sloupec z vašeho Excelu odpovídá kterému údaji v systému.
                        </p>

                        <ErrorMessage message={error} />

                        <div className="grid grid-cols-1 gap-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {/* Standardní pole */}
                            {SYSTEM_FIELDS.map(field => (
                                <div key={field.key} className="flex items-center justify-between border-b pb-2">
                                    <label className="w-1/3 text-sm font-semibold text-slate-700">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="w-2/3">
                                        <select
                                            value={mapping[field.key] || ""}
                                            onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                            className={`w-full p-2 border rounded text-sm ${field.required && !mapping[field.key] ? 'border-red-300 bg-red-50' : 'border-slate-300'}`}
                                        >
                                            {headerOptions}
                                        </select>
                                    </div>
                                </div>
                            ))}

                            {/* Sekce hierarchie kategorií */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-slate-700">
                                        Hierarchie kategorií
                                        <span className="ml-1 text-xs font-normal text-slate-500">(až {MAX_CATEGORY_LEVELS} úrovní)</span>
                                    </span>
                                    {categoryLevels.length < MAX_CATEGORY_LEVELS && (
                                        <button
                                            type="button"
                                            onClick={addCategoryLevel}
                                            className="flex items-center text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                                        >
                                            <Icon name="fa-plus" className="mr-1" />
                                            Přidat úroveň
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                                    {categoryLevels.map((level: string, idx: number) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <span className="text-xs text-slate-500 w-16 shrink-0">
                                                Úroveň {idx + 1}
                                            </span>
                                            <select
                                                value={level}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleCategoryLevelChange(idx, e.target.value)}
                                                className="flex-1 p-2 border border-slate-300 rounded text-sm"
                                            >
                                                {headerOptions}
                                            </select>
                                            {categoryLevels.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeCategoryLevel(idx)}
                                                    className="text-red-400 hover:text-red-600 shrink-0"
                                                    title="Odebrat úroveň"
                                                >
                                                    <Icon name="fa-times" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-6 space-x-2 border-t mt-4">
                            <Button variant="secondary" onClick={handleClose}>Zrušit</Button>
                            <Button onClick={handleImport} disabled={loading}>
                                {loading ? "Importuji..." : "Spustit import"}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// Registrace pluginu do slotu 'inventory-header-actions'
registerPlugin('inventory-header-actions', InventoryImportPlugin);

export default InventoryImportPlugin;
