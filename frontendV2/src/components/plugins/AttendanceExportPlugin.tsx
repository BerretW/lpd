import React, { useState } from 'react';
import { registerPlugin, PluginComponentProps } from '../../lib/PluginSystem';
import Icon from '../common/Icon';

const AttendanceExportPlugin: React.FC<PluginComponentProps> = ({ context }) => {
    const { companyId, currentDate, userId } = context;
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            // Získáme rok z aktuálně zobrazeného data
            const dateObj = new Date(currentDate);
            const year = dateObj.getFullYear();
            
            const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
            
            if (!token) {
                alert("Nejste přihlášeni.");
                return;
            }

            // Upravené URL volající nový endpoint s parametrem YEAR
            let url = `/api/plugins/attendance-export/download?company_id=${companyId}&year=${year}`;
            
            if (userId) {
                url += `&user_id=${userId}`;
            }

            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error("Chyba při stahování");

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `vykaz_prace_${year}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);

        } catch (e) {
            console.error(e);
            alert("Nepodařilo se stáhnout export.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <button 
            onClick={handleDownload} 
            disabled={isDownloading}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded shadow transition-colors ml-2"
            title={`Stáhnout kompletní výkaz za rok ${new Date(currentDate).getFullYear()}`}
        >
            <Icon name={isDownloading ? "fa-spinner fa-spin" : "fa-file-excel"} className="mr-2" />
            {isDownloading ? "Generuji..." : "Výkaz (XLS)"}
        </button>
    );
};

registerPlugin('attendance-header-actions', AttendanceExportPlugin);

export default AttendanceExportPlugin;