import React, { useEffect, useState } from 'react';
import { registerPlugin, PluginComponentProps } from '../../lib/PluginSystem';
import { useAuth } from '../../AuthContext';
import * as api from '../../api';
import { VehicleAlertOut } from '../../types';
import Icon from '../common/Icon';

const FleetDashboardWidget: React.FC<PluginComponentProps> = ({ context }) => {
    const { companyId } = useAuth(); // Použijeme hook, pokud context companyId nemá
    const [alerts, setAlerts] = useState<VehicleAlertOut[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fallback pro companyId
        const cid = context?.companyId || companyId;
        if (!cid) return;

        api.getFleetAlerts(cid)
            .then(setAlerts)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [context, companyId]);

    if (loading) return null;
    if (alerts.length === 0) return null;

    return (
        <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center">
                <Icon name="fa-car-crash" className="mr-2 text-red-500"/>
                Upozornění vozového parku
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.map(alert => (
                    <div key={alert.id} className="bg-white border-l-4 border-red-500 p-4 rounded shadow-sm flex justify-between items-start">
                        <div>
                            <p className="font-bold text-slate-800">{alert.brand} {alert.model}</p>
                            <p className="text-sm text-slate-600 font-mono">{alert.license_plate}</p>
                        </div>
                        <div className="text-right">
                            {alert.alert_type.includes('STK') && (
                                <p className="text-red-600 font-bold text-sm">
                                    STK {alert.days_remaining && alert.days_remaining < 0 ? 'propadla' : 'vyprší'} 
                                    <br/>
                                    {alert.days_remaining && Math.abs(alert.days_remaining)} dní
                                </p>
                            )}
                            {alert.alert_type.includes('SERVICE') && (
                                <p className="text-orange-600 font-bold text-sm">
                                    Servis <br/>
                                    {alert.km_overdue ? `přejeto o ${alert.km_overdue} km` : 'Nutná kontrola'}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Registrace do slotu, který musíme přidat do Dashboardu
registerPlugin('dashboard-top', FleetDashboardWidget);

export default FleetDashboardWidget;