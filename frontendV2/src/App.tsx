import React, { useState } from 'react';
import { View, RoleEnum } from './types';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Jobs from './components/Jobs';
import Inventory from './components/Inventory';
import AttendanceCalendar from './components/AttendanceCalendar';
import Login from './components/Login';
import Admin from './components/Admin';
import { useAuth } from './AuthContext';
import { useI18n } from './I18nContext';
import PickingOrders from './components/PickingOrders';
import FleetPlugin from './components/plugins/FleetPlugin';
const App: React.FC = () => {
    const { isAuthenticated, user, role, companyId, logout } = useAuth();
    const [currentView, setCurrentView] = useState<View>(View.Dashboard);
    const { t } = useI18n();

    if (!isAuthenticated || !user || !companyId || !role) {
        return <Login />;
    }

    const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;

    // Simple user object for props, adjust as needed
    const currentUserForProps = {
        id: String(user.id),
        name: user.email,
        role: role,
    };

    const renderView = () => {
        switch (currentView) {
            case View.Dashboard:
                return <Dashboard setCurrentView={setCurrentView} companyId={companyId} />;
            case View.Attendance:
                return <AttendanceCalendar companyId={companyId} userId={user.id} userRole={role} userEmail={user.email} setCurrentView={setCurrentView} />;
            case View.Jobs:
                // Only Admins and Owners can see the Jobs page.
                if (isAdmin) {
                    return <Jobs companyId={companyId} />;
                }
                // Redirect non-admin users to the dashboard if they try to access Jobs.
                return <Dashboard setCurrentView={setCurrentView} companyId={companyId} />;
            case View.Inventory:
                return <Inventory companyId={companyId} />;
            case View.PickingOrders:
                return <PickingOrders companyId={companyId} />;
            case View.Fleet:
                return <FleetPlugin companyId={companyId} />;
            case View.Admin:
                if (isAdmin) {
                    return <Admin companyId={companyId} />;
                }
                return <Dashboard setCurrentView={setCurrentView} companyId={companyId} />;
            case View.Planning:
                return <div className="p-8"><h1 className="text-3xl font-bold text-slate-800">{t('navigation.planning')}</h1><p className="mt-4 text-slate-600">Tato funkce bude brzy k dispozici.</p></div>;
            default:
                return <Dashboard setCurrentView={setCurrentView} companyId={companyId} />;
        }
    };

    return (
        <Layout currentView={currentView} setCurrentView={setCurrentView} currentUser={currentUserForProps} onLogout={logout}>
            {renderView()}
        </Layout>
    );
};

export default App;