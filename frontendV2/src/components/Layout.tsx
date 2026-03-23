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
  onNavigate?: () => void;
}> = ({ view, label, icon, currentView, setCurrentView, isCollapsed, onNavigate }) => {
  const isActive = currentView === view;
  return (
    <li
      className={`flex items-center p-3 my-1 rounded-lg cursor-pointer transition-all duration-200 ${
        isActive
          ? 'bg-red-600 text-white shadow-lg'
          : 'text-slate-200 hover:bg-gray-700 hover:text-white'
      } ${isCollapsed ? 'justify-center' : ''}`}
      onClick={() => { setCurrentView(view); onNavigate?.(); }}
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

const SidebarContent: React.FC<{
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  currentView: View;
  setCurrentView: (view: View) => void;
  currentUser: { id: string; name: string; role: RoleEnum };
  onLogout: () => void;
  isAdmin: boolean;
  onNavigate?: () => void;
}> = ({ isCollapsed, setIsCollapsed, currentView, setCurrentView, currentUser, onLogout, isAdmin, onNavigate }) => {
  const { t } = useI18n();
  return (
    <>
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

      <nav className="mt-4 flex-1 overflow-y-auto">
        <ul>
          <NavItem isCollapsed={isCollapsed} view={View.Dashboard} label={t('navigation.dashboard')} icon="fa-home" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          <NavItem isCollapsed={isCollapsed} view={View.Attendance} label={t('navigation.attendance')} icon="fa-calendar-alt" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          {isAdmin && (
            <NavItem isCollapsed={isCollapsed} view={View.Jobs} label={t('navigation.jobs')} icon="fa-briefcase" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          )}
          <NavItem isCollapsed={isCollapsed} view={View.Inventory} label={t('navigation.inventory')} icon="fa-warehouse" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          <NavItem isCollapsed={isCollapsed} view={View.Fleet} label="Vozový park" icon="fa-car" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          <NavItem isCollapsed={isCollapsed} view={View.Objects} label="Objekty" icon="fa-building" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          <NavItem isCollapsed={isCollapsed} view={View.PickingOrders} label={t('navigation.pickingOrders')} icon="fa-people-carry" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          <NavItem isCollapsed={isCollapsed} view={View.Planning} label={t('navigation.planning')} icon="fa-calendar-check" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
          {isAdmin && (
            <NavItem isCollapsed={isCollapsed} view={View.Admin} label={t('navigation.admin')} icon="fa-user-shield" currentView={currentView} setCurrentView={setCurrentView} onNavigate={onNavigate} />
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
        {!isCollapsed && <p className="text-center text-slate-400 text-sm whitespace-nowrap">&copy; 2026 Appartus</p>}
      </div>
    </>
  );
};

const Layout: React.FC<LayoutProps> = ({ children, currentView, setCurrentView, currentUser, onLogout }) => {
  const { role } = useAuth();
  const { t } = useI18n();
  const isAdmin = role === RoleEnum.Admin || role === RoleEnum.Owner;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-slate-100 font-sans">

      {/* Desktop sidebar */}
      <aside className={`hidden md:flex bg-gray-900 text-white flex-col p-4 shadow-2xl transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
        <SidebarContent
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          onLogout={onLogout}
          isAdmin={isAdmin}
        />
      </aside>

      {/* Mobile overlay backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-72 bg-gray-900 text-white flex flex-col p-4 shadow-2xl z-50 transition-transform duration-300 md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="absolute top-4 right-4 text-slate-300 hover:text-white p-1"
          aria-label="Zavřít menu"
        >
          <Icon name="fa-times" className="w-6 h-6" />
        </button>
        <SidebarContent
          isCollapsed={false}
          setIsCollapsed={() => {}}
          currentView={currentView}
          setCurrentView={setCurrentView}
          currentUser={currentUser}
          onLogout={onLogout}
          isAdmin={isAdmin}
          onNavigate={() => setIsMobileMenuOpen(false)}
        />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between bg-gray-900 text-white px-4 py-3 shadow-md flex-shrink-0">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Otevřít menu"
          >
            <Icon name="fa-bars" className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 font-bold text-lg">
            <i className="fas fa-shield-halved"></i>
            <span>LPD Worker</span>
          </div>
          <button
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors text-red-400"
            aria-label={t('navigation.logoutAria')}
          >
            <Icon name="fa-sign-out-alt" className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
