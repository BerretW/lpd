import React, { useState, useEffect, useMemo } from 'react';
import { LocationOut, LocationInventoryItem } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import ErrorMessage from './common/ErrorMessage';
import * as api from '../api';
import Input from './common/Input';

interface LocationContentsModalProps {
    companyId: number;
    location: LocationOut;
    onClose: () => void;
}

const LocationContentsModal: React.FC<LocationContentsModalProps> = ({ companyId, location, onClose }) => {
    const [contents, setContents] = useState<LocationInventoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchContents = async () => {
            setLoading(true);
            setError(null);
            try {
                const data = await api.getLocationInventory(companyId, location.id);
                setContents(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Nepodařilo se načíst obsah lokace.');
            } finally {
                setLoading(false);
            }
        };
        fetchContents();
    }, [companyId, location.id]);

    const filteredContents = useMemo(() => {
        if (!searchTerm) {
            return contents;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return contents.filter(item =>
            item.inventory_item.name.toLowerCase().includes(lowercasedTerm) ||
            item.inventory_item.sku.toLowerCase().includes(lowercasedTerm)
        );
    }, [contents, searchTerm]);
    
    const handlePrint = () => {
        const printContent = document.getElementById('print-area-location');
        if (printContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Obsah lokace</title>');
            printWindow?.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow?.document.write('<style>@media print { body { -webkit-print-color-adjust: exact; } .no-print { display: none; } .printable-area { display: block !important; } }</style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write(printContent.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            setTimeout(() => {
                printWindow?.print();
                printWindow?.close();
            }, 250);
        }
    };

    return (
        <Modal title={`Obsah lokace: ${location.name}`} onClose={onClose}>
            <div className="space-y-4 min-h-[400px]">
                <div className="no-print flex justify-between items-center">
                    <div className="w-1/2">
                        <Input
                            placeholder="Hledat položku..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={handlePrint} disabled={loading || !!error}>
                        <Icon name="fa-print" className="mr-2" /> Tisk
                    </Button>
                </div>
                
                <ErrorMessage message={error} />

                {loading ? (
                    <div className="flex justify-center items-center h-full pt-16">
                        <Icon name="fa-spinner fa-spin" className="text-3xl" />
                    </div>
                ) : (
                    <div id="print-area-location" className="printable-area">
                         <div className="mb-4">
                            <h2 className="text-xl font-bold">Obsah lokace: {location.name}</h2>
                            <p className="text-sm text-slate-600">Stav k {new Date().toLocaleString('cs-CZ')}</p>
                        </div>
                        
                        {filteredContents.length > 0 ? (
                            <div className="max-h-96 overflow-y-auto">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-100 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">Název položky</th>
                                            <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600">SKU</th>
                                            <th className="px-4 py-2 text-right text-sm font-semibold text-slate-600">Množství</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {filteredContents.map(item => (
                                            <tr key={item.inventory_item.id}>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-slate-900">{item.inventory_item.name}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-slate-500">{item.inventory_item.sku}</td>
                                                <td className="px-4 py-2 whitespace-nowrap text-sm text-right font-semibold">{item.quantity} ks</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500">
                                <Icon name="fa-box-open" className="text-4xl mb-3" />
                                <p>{searchTerm ? 'Nebyla nalezena žádná položka odpovídající hledání.' : 'Tato lokace je prázdná.'}</p>
                            </div>
                        )}
                    </div>
                )}
                 <div className="no-print flex justify-end pt-4">
                    <Button onClick={onClose}>Zavřít</Button>
                </div>
            </div>
        </Modal>
    );
};

export default LocationContentsModal;