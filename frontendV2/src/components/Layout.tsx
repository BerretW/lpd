import React, { useState, useRef, useEffect } from 'react';
import { View, RoleEnum } from '../types';
import Icon from './common/Icon';
import { useAuth } from '../AuthContext';
import { useI18n } from '../I18nContext';

interface LayoutProps {
  children: React.ReactNode;
  currentView: View;
  setCurrentView: (view: View) => void;
  currentUser: { id: string; name: string; role: RoleEnum };
  onLogout: () => void;
}

const NavItem: React.FC<{
  view: View;
  label: string;
  icon: string;
  currentView: View;
  setCurrentView: (view: View) => void;
  isCollapsed: boolean;
}> = ({ view, label, icon, currentView, setCurrentView, isCollapsed }) => {
  const isActive = currentView === view;
  return (
    <li
      className={`flex items-center p-3 my-1 rounded-lg cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-red-600 text-white shadow-lg'
          : 'text-slate-200 hover:bg-gray-700 hover:text-white'
      } ${isCollapsed ? 'justify-center' : ''}`}
      onClick={() => setCurrentView(view)}
    >
      <Icon name={icon} className={`w-6 h-6 ${!isCollapsed ? 'mr-4' : ''}`} />
      {!isCollapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
    </li>
  );
};

const LanguageSwitcher: React.FC<{ isCollapsed: boolean }> = ({ isCollapsed }) => {
    const { language, setLanguage } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const languages = {
        cs: { name: 'Čeština', flag: '🇨🇿' },
        en: { name: 'English', flag: '🇬🇧' },
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectLanguage = (lang: 'cs' | 'en') => {
        setLanguage(lang);
        setIsOpen(false);
    };

    if (isCollapsed) {
        return (
             <div className="relative" ref={dropdownRef}>
                <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-center items-center p-3 rounded-lg text-slate-300 hover:bg-gray-700">
                    <span>{languages[language].flag}</span>
                </button>
                {isOpen && (
                    <div className="absolute bottom-full mb-2 w-12 bg-gray-800 rounded-md shadow-lg border border-gray-700">
                        {Object.entries(languages).map(([key, value]) => (
                             <button key={key} onClick={() => selectLanguage(key as 'cs' | 'en')} className="w-full text-center p-2 text-lg hover:bg-gray-600 rounded-md">
                                {value.flag}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-2 rounded-lg text-slate-300 hover:bg-gray-700">
                <span>{languages[language].flag} {languages[language].name}</span>
                <Icon name={isOpen ? "fa-chevron-up" : "fa-chevron-down"} className="w-4 h-4" />
            </button>
            {isOpen && (
                <div className="absolute bottom-full mb-2 w-full bg-gray-800 rounded-md shadow-lg border border-gray-700">
                    {Object.entries(languages).map(([key, value]) => (
                         <button key={key} onClick={() => selectLanguage(key as 'cs' | 'en')} className="w-full text-left p-2 hover:bg-gray-600 rounded-md">
                            {value.flag} {value.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const Layout: React.FC<LayoutProps> = ({ children, currentView, setCurrentView, currentUser, onLogout }) => {
  const { role } = useAuth();
  const { t } = useI18n();
  const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-100 font-sans">
      <aside className={`bg-gray-900 text-white flex flex-col p-4 shadow-2xl transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <div className="text-2xl font-bold text-center py-4 border-b border-gray-700 flex items-center justify-center">
          <i className="fas fa-shield-halved"></i>
          {!isCollapsed && <span className="ml-2 whitespace-nowrap">LPD Worker</span>}
        </div>
        
        <div className="p-4 mt-4 text-center bg-gray-800 rounded-lg">
            <Icon name="fa-user-circle" className="text-4xl text-slate-300 mb-2"/>
            {!isCollapsed && (
              <>
                <h3 className="font-semibold text-white whitespace-nowrap">{currentUser.name}</h3>
                <p className="text-sm text-slate-400 capitalize">{currentUser.role}</p>
              </>
            )}
            <button 
                onClick={onLogout}
                className={`w-full mt-4 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 rounded-md transition-colors ${isCollapsed ? 'flex justify-center' : ''}`}
                aria-label={t('navigation.logoutAria')}
            >
                {isCollapsed ? <Icon name="fa-sign-out-alt" /> : t('navigation.logout')}
            </button>
        </div>

        <nav className="mt-4">
          <ul>
            <NavItem isCollapsed={isCollapsed} view={View.Dashboard} label={t('navigation.dashboard')} icon="fa-home" currentView={currentView} setCurrentView={setCurrentView} />
            <NavItem isCollapsed={isCollapsed} view={View.Attendance} label={t('navigation.attendance')} icon="fa-calendar-alt" currentView={currentView} setCurrentView={setCurrentView} />
            {isAdmin && (
                <NavItem isCollapsed={isCollapsed} view={View.Jobs} label={t('navigation.jobs')} icon="fa-briefcase" currentView={currentView} setCurrentView={setCurrentView} />
            )}
            <NavItem isCollapsed={isCollapsed} view={View.Inventory} label={t('navigation.inventory')} icon="fa-warehouse" currentView={currentView} setCurrentView={setCurrentView} />
            <NavItem isCollapsed={isCollapsed} view={View.PickingOrders} label={t('navigation.pickingOrders')} icon="fa-people-carry" currentView={currentView} setCurrentView={setCurrentView} />
            <NavItem isCollapsed={isCollapsed} view={View.Planning} label={t('navigation.planning')} icon="fa-calendar-check" currentView={currentView} setCurrentView={setCurrentView} />
            {isAdmin && (
                <NavItem isCollapsed={isCollapsed} view={View.Admin} label={t('navigation.admin')} icon="fa-user-shield" currentView={currentView} setCurrentView={setCurrentView} />
            )}
          </ul>
        </nav>
        <div className="mt-auto space-y-2">
           <LanguageSwitcher isCollapsed={isCollapsed} />
           <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full flex items-center justify-center p-3 rounded-lg text-slate-400 hover:bg-gray-700 hover:text-white transition-colors duration-200"
                aria-label={isCollapsed ? t('navigation.expandMenu') : t('navigation.collapseMenu')}
            >
                <Icon name={isCollapsed ? 'fa-arrow-right-to-bracket' : 'fa-arrow-left-to-bracket'} className="w-6 h-6" />
            </button>
          {!isCollapsed && <p className="text-center text-slate-400 text-sm whitespace-nowrap">&copy; 2024 ProfiTechnik s.r.o.</p>}
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;