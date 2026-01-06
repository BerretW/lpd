import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TimeLogOut, TimeLogStatus, RoleEnum, MemberOut, TemplateDayEntry, TimeLogEntryType, ServiceReportDataOut, View } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import * as api from '../api';
import TemplateDayForm from './TemplateDayForm';
import { getCookie } from '../utils/cookies';
import TimeLogModal from './TimeLogModal';
import TimeLogItem from './TimeLogItem';
import WorkReport from './WorkReport';
import ErrorModal from './common/ErrorModal';
import ManageTaskMaterialsModal from './ManageTaskMaterialsModal';
import MyTasksView from './MyTasksView';

interface AttendanceCalendarProps {
    companyId: number;
    userId: number; // Logged-in user's ID
    userRole: RoleEnum;
    userEmail: string;
    setCurrentView: (view: View) => void;
}

// === HELPERS ===
const toYYYYMMDD = (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getLunchSettings = (companyId: number): { startTime: string; endTime: string } => {
    const cookieName = `profitechnik_lunch_settings_${companyId}`;
    const savedSettings = getCookie(cookieName);
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            if (settings.startTime && settings.endTime) {
                return settings;
            }
        } catch (e) {
            console.error("Failed to parse attendance settings cookie", e);
        }
    }
    // Default values
    return { startTime: '12:00', endTime: '12:30' };
};


// === SUB-COMPONENTS ===
const DatePicker: React.FC<{
    currentDate: Date;
    onSelectDate: (date: Date) => void;
    onClose: () => void;
}> = ({ currentDate, onSelectDate, onClose }) => {
    const [pickerDate, setPickerDate] = useState(new Date(currentDate));
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    const changePickerMonth = (offset: number) => {
        setPickerDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(newDate.getMonth() + offset);
            return newDate;
        });
    };

    const daysInMonth = new Date(pickerDate.getFullYear(), pickerDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(pickerDate.getFullYear(), pickerDate.getMonth(), 1).getDay();
    const startOffset = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startOffset }, () => null);
    const calendarCells = [...blanks, ...days];

    return (
        <div ref={calendarRef} className="absolute top-full mt-2 bg-white text-black shadow-lg rounded-lg p-4 z-20 w-72 border border-slate-200">
            <div className="flex justify-between items-center mb-2">
                <button onClick={() => changePickerMonth(-1)} className="p-1 rounded-full hover:bg-slate-100"><Icon name="fa-chevron-left" /></button>
                <span className="font-semibold text-slate-800">{pickerDate.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}</span>
                <button onClick={() => changePickerMonth(1)} className="p-1 rounded-full hover:bg-slate-100"><Icon name="fa-chevron-right" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
                {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(day => <div key={day} className="font-medium">{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-2">
                {calendarCells.map((day, index) => (
                    day ? (
                        <button
                            key={day}
                            onClick={() => onSelectDate(new Date(pickerDate.getFullYear(), pickerDate.getMonth(), day))}
                            className={`p-1 text-sm rounded-full aspect-square flex items-center justify-center transition-colors ${new Date(pickerDate.getFullYear(), pickerDate.getMonth(), day).toDateString() === currentDate.toDateString() ? 'bg-red-600 text-white font-bold' : 'hover:bg-slate-100 text-slate-700'}`}
                        >
                            {day}
                        </button>
                    ) : ( <div key={`blank-${index}`}></div> )
                ))}
            </div>
        </div>
    );
};


// === MAIN COMPONENT ===
const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({ companyId, userId, userRole, userEmail, setCurrentView }) => {
    // === STATE ===
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [timeLogs, setTimeLogs] = useState<TimeLogOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [members, setMembers] = useState<MemberOut[]>([]);
    const [viewingUserId, setViewingUserId] = useState<number>(userId);
    const [isFabOpen, setIsFabOpen] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'calendar' | 'tasks'>('calendar');
    
    // Unified modal state
    type ModalState = 
        | { type: 'NONE' }
        | { type: 'ADD'; payload: { entryType: TimeLogEntryType; initialData?: any } }
        | { type: 'EDIT'; payload: TimeLogOut }
        | { type: 'DELETE'; payload: TimeLogOut }
        | { type: 'MONTHLY_REPORT' }
        | { type: 'TEMPLATE_FORM' }
        | { type: 'MANAGE_MATERIALS', payload: ServiceReportDataOut };

    const [modalState, setModalState] = useState<ModalState>({ type: 'NONE' });

    const isAdmin = userRole === RoleEnum.Admin || userRole === RoleEnum.Owner;

    // === DATA FETCHING ===
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const logs = await api.getTimeLogs(companyId, { 
                user_id_filter: viewingUserId, 
                work_date: toYYYYMMDD(selectedDate),
            });
            setTimeLogs(logs);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch time logs");
            setTimeLogs([]);
        } finally {
            setLoading(false);
        }
    }, [companyId, viewingUserId, selectedDate]);

    useEffect(() => {
        if (activeTab === 'calendar') {
            fetchData();
        }
    }, [fetchData, activeTab]);

    useEffect(() => {
        if (isAdmin) {
            api.getMembers(companyId)
                .then(setMembers)
                .catch(err => console.error("Failed to fetch members", err));
        }
    }, [isAdmin, companyId]);

    // === CALLBACKS & HANDLERS (STABILIZED WITH useCallback) ===
    const handleEdit = useCallback((log: TimeLogOut) => setModalState({ type: 'EDIT', payload: log }), []);
    const handleDelete = useCallback((log: TimeLogOut) => setModalState({ type: 'DELETE', payload: log }), []);

    const handleConfirmDelete = useCallback(async () => {
        if (modalState.type !== 'DELETE') return;
        try {
            await api.deleteTimeLog(companyId, modalState.payload.id);
            setModalState({ type: 'NONE' });
            fetchData();
        } catch (err) {
            setError(err instanceof Error ? err.message : `Chyba při mazání záznamu`);
        }
    }, [companyId, modalState, fetchData]);

    const handleStatusUpdate = useCallback(async (logId: number, status: TimeLogStatus) => {
        try {
            const updatedLog = await api.updateTimeLogStatus(companyId, logId, status);
            setTimeLogs(currentLogs => currentLogs.map(log => log.id === logId ? updatedLog : log));
        } catch (err) {
            setError(err instanceof Error ? err.message : `Chyba při aktualizaci stavu`);
        }
    }, [companyId]);

    const handleManageMaterial = useCallback(async (log: TimeLogOut) => {
        if (!log.task) {
            setError('K tomuto záznamu není přiřazen žádný úkol.');
            console.error("[DEBUG] Pokus o správu materiálu pro záznam bez úkolu:", log);
            return;
        }
    
        setLoading(true);
        console.log(`[DEBUG] Načítání dat pro správu materiálu. Vstupní záznam (TimeLog):`, log);
    
        try {
            const data: ServiceReportDataOut = await api.getServiceReportData(companyId, log.id);
            console.log('[DEBUG] Odpověď ze serveru (ServiceReportData):', data);
    
            if (data && data.work_order && data.task) {
                setModalState({ type: 'MANAGE_MATERIALS', payload: data });
            } else {
                const errorMessage = 'Nepodařilo se načíst kompletní data pro správu materiálu. Zakázka nebo úkol nebyly nalezeny v databázi.';
                setError(errorMessage);
                
                // Detailed console logging for debugging
                console.error(`[DEBUG] CHYBA: ${errorMessage}`);
                if (!data) {
                    console.error("[DEBUG] Detail: Odpověď ze serveru je prázdná (null nebo undefined).");
                } else {
                    if (!data.work_order) {
                        console.error("[DEBUG] Detail: V odpovědi chybí objekt 'work_order'.");
                    }
                    if (!data.task) {
                        console.error("[DEBUG] Detail: V odpovědi chybí objekt 'task'.");
                    }
                }
                console.error("[DEBUG] Celá odpověď ze serveru pro analýzu:", data);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : `Nepodařilo se načíst data úkolu.`;
            setError(errorMessage);
            console.error(`[DEBUG] API volání selhalo s chybou:`, err);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    const handleSave = useCallback(() => {
        setModalState({ type: 'NONE' });
        fetchData();
    }, [fetchData]);
    
    const handleAddLunch = useCallback(() => {
        const lunchSettings = getLunchSettings(companyId);
        setModalState({
            type: 'ADD',
            payload: {
                entryType: TimeLogEntryType.UnpaidLeave,
                initialData: {
                    startTime: lunchSettings.startTime,
                    endTime: lunchSettings.endTime,
                    notes: 'Pauza na oběd'
                }
            }
        });
    }, [companyId]);


    const changeWeek = (offset: number) => {
        setSelectedDate(current => {
            const newDate = new Date(current);
            newDate.setDate(newDate.getDate() + offset * 7);
            return newDate;
        });
    };
    
    // === COMPUTED VALUES ===
    const weekDays = useMemo(() => {
        const startOfWeek = new Date(selectedDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        });
    }, [selectedDate]);

    const viewingUserEmail = useMemo(() => {
        if (viewingUserId === userId) return userEmail;
        return members.find(m => m.user.id === viewingUserId)?.user.email || 'Neznámý uživatel';
    }, [viewingUserId, userId, userEmail, members]);

    // === RENDER LOGIC ===
    const renderModals = () => {
        switch(modalState.type) {
            case 'ADD':
                return <TimeLogModal date={selectedDate} entryType={modalState.payload.entryType} initialData={modalState.payload.initialData} onClose={() => setModalState({ type: 'NONE' })} onSave={handleSave} companyId={companyId} dailyLogs={timeLogs} />;
            case 'EDIT':
                return <TimeLogModal date={new Date(modalState.payload.start_time)} entryType={modalState.payload.entry_type} timeLog={modalState.payload} onClose={() => setModalState({ type: 'NONE' })} onSave={handleSave} companyId={companyId} dailyLogs={timeLogs} />;
            case 'DELETE':
                return (
                    <Modal title="Potvrdit smazání" onClose={() => setModalState({ type: 'NONE' })}>
                        <p className="mb-4">Opravdu si přejete trvale smazat tento záznam docházky?</p>
                        <div className="bg-slate-100 p-3 rounded-md border"><p><strong>Typ:</strong> {modalState.payload.entry_type}</p><p><strong>Doba trvání:</strong> {modalState.payload.duration_hours.toFixed(2)} hod</p></div>
                        <div className="flex justify-end pt-6 space-x-2"><Button variant="secondary" onClick={() => setModalState({ type: 'NONE' })}>Zrušit</Button><Button onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700 text-white">Smazat</Button></div>
                    </Modal>
                );
            case 'MANAGE_MATERIALS':
                return <ManageTaskMaterialsModal workOrder={modalState.payload.work_order} initialTask={modalState.payload.task} companyId={companyId} onClose={() => setModalState({ type: 'NONE' })} onSaveSuccess={handleSave} />
            case 'MONTHLY_REPORT':
                return <WorkReport onClose={() => setModalState({ type: 'NONE' })} companyId={companyId} userId={viewingUserId} userEmail={viewingUserEmail} initialDate={selectedDate} />;
            case 'TEMPLATE_FORM':
                return <TemplateDayForm companyId={companyId} userId={userId} onClose={() => setModalState({ type: 'NONE' })} />;
            case 'NONE':
            default:
                return null;
        }
    };
    
    return (
        <div className="flex flex-col h-full bg-slate-50">
            <header className="bg-gray-900 text-white p-4 shadow-md z-10">
                <div className="flex justify-between items-center mt-4">
                    <Button onClick={() => changeWeek(-1)} variant="secondary" className="!bg-gray-800 !text-white border-none"><Icon name="fa-chevron-left" className="mr-2"/> Týden</Button>
                    <div className="relative">
                        <button onClick={() => setIsDatePickerOpen(prev => !prev)} className="font-semibold text-lg hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors">{selectedDate.toLocaleDateString('cs-CZ', { year: 'numeric', month: 'long', day: 'numeric' })}</button>
                        {isDatePickerOpen && <DatePicker currentDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setIsDatePickerOpen(false); }} onClose={() => setIsDatePickerOpen(false)} />}
                    </div>
                    <Button onClick={() => changeWeek(1)} variant="secondary" className="!bg-gray-800 !text-white border-none">Týden <Icon name="fa-chevron-right" className="ml-2"/></Button>
                </div>
                {activeTab === 'calendar' && (
                    <div className="flex justify-around mt-4">
                        {weekDays.map(date => (
                            <div key={date.toISOString()} onClick={() => setSelectedDate(date)} className={`flex flex-col items-center p-2 rounded-lg cursor-pointer transition-colors duration-200 w-16 ${date.toDateString() === selectedDate.toDateString() ? 'bg-red-600' : 'hover:bg-gray-700'}`}>
                                <span className="text-xs font-semibold">{date.toLocaleDateString('cs-CZ', { weekday: 'short' }).toUpperCase()}</span>
                                <span className="font-bold text-lg">{date.getDate()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </header>

            <div className="no-print p-4 bg-white border-b border-slate-200 flex justify-center">
                <div className="flex space-x-1 bg-slate-200 p-1 rounded-lg max-w-md w-full">
                    <button onClick={() => setActiveTab('calendar')} className={`w-full p-2 rounded-md font-semibold transition-colors flex items-center justify-center ${activeTab === 'calendar' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>
                        <Icon name="fa-calendar-alt" className="mr-2" /> Kalendář
                    </button>
                    <button onClick={() => setActiveTab('tasks')} className={`w-full p-2 rounded-md font-semibold transition-colors flex items-center justify-center ${activeTab === 'tasks' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-300'}`}>
                        <Icon name="fa-tasks" className="mr-2" /> Moje úkoly
                    </button>
                </div>
            </div>

            {activeTab === 'calendar' ? (
                <>
                    {isAdmin && (
                        <div className="p-4 bg-white border-b border-slate-200 flex items-end justify-between gap-4">
                            <div className="flex-grow">
                                <label htmlFor="user-select" className="block text-sm font-medium text-slate-700 mb-1">Zobrazit docházku pro:</label>
                                <select id="user-select" value={viewingUserId} onChange={(e) => setViewingUserId(Number(e.target.value))} className="block w-full p-2 border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm">
                                    <option value={userId}>Moje docházka ({userEmail})</option>
                                    {members.filter(m => m.user.id !== userId).map(member => (<option key={member.user.id} value={member.user.id}>{member.user.email}</option>))}
                                </select>
                            </div>
                            <Button onClick={() => setModalState({ type: 'MONTHLY_REPORT' })}><Icon name="fa-file-pdf" className="mr-2" />Měsíční výkaz</Button>
                        </div>
                    )}
                    <main className="flex-1 overflow-y-auto p-4">
                        {loading ? <p>Načítání...</p> : timeLogs.length > 0 ? (
                            <ul className="space-y-3">
                                {timeLogs.map(log => (
                                    <TimeLogItem key={log.id} log={log} isOwnLog={viewingUserId === userId} isAdmin={isAdmin} onEdit={handleEdit} onDelete={handleDelete} onStatusUpdate={handleStatusUpdate} onManageMaterial={handleManageMaterial} />
                                ))}
                            </ul>
                        ) : (
                            <div className="text-center text-slate-500 mt-16"><Icon name="fa-calendar-check" className="text-5xl mb-4" /><p>Pro tento den neexistují žádné záznamy.</p></div>
                        )}
                    </main>
                    <div className="absolute bottom-8 right-8">
                        {isFabOpen && (
                            <div className="flex flex-col items-end space-y-3 mb-4">
                                <div className="flex items-center"><span className="bg-gray-800 text-white text-xs px-2 py-1 rounded mr-2">Práce</span><Button className="!w-12 !h-12 !rounded-full" variant="secondary" onClick={() => setModalState({ type: 'ADD', payload: { entryType: TimeLogEntryType.Work } })}><Icon name="fa-briefcase"/></Button></div>
                                <div className="flex items-center"><span className="bg-gray-800 text-white text-xs px-2 py-1 rounded mr-2">Pauza na oběd</span><Button className="!w-12 !h-12 !rounded-full" variant="secondary" onClick={handleAddLunch}><Icon name="fa-utensils"/></Button></div>
                                <div className="flex items-center"><span className="bg-gray-800 text-white text-xs px-2 py-1 rounded mr-2">Lékař</span><Button className="!w-12 !h-12 !rounded-full" variant="secondary" onClick={() => setModalState({ type: 'ADD', payload: { entryType: TimeLogEntryType.Doctor } })}><Icon name="fa-stethoscope"/></Button></div>
                                <div className="flex items-center"><span className="bg-gray-800 text-white text-xs px-2 py-1 rounded mr-2">Dovolená</span><Button className="!w-12 !h-12 !rounded-full" variant="secondary" onClick={() => setModalState({ type: 'ADD', payload: { entryType: TimeLogEntryType.Vacation } })}><Icon name="fa-sun"/></Button></div>
                                <div className="flex items-center"><span className="bg-gray-800 text-white text-xs px-2 py-1 rounded mr-2">Nemoc</span><Button className="!w-12 !h-12 !rounded-full" variant="secondary" onClick={() => setModalState({ type: 'ADD', payload: { entryType: TimeLogEntryType.SickDay } })}><Icon name="fa-medkit"/></Button></div>
                                <div className="flex items-center"><span className="bg-gray-800 text-white text-xs px-2 py-1 rounded mr-2">Vzorový den</span><Button className="!w-12 !h-12 !rounded-full" variant="secondary" onClick={() => setModalState({ type: 'TEMPLATE_FORM' })}><Icon name="fa-star"/></Button></div>
                            </div>
                        )}
                        <button onClick={() => setIsFabOpen(!isFabOpen)} className="bg-red-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center text-3xl hover:bg-red-700 transition-transform duration-300" style={{ transform: isFabOpen ? 'rotate(45deg)' : 'rotate(0)' }}>
                            <Icon name="fa-plus" />
                        </button>
                    </div>
                </>
            ) : (
                 <main className="flex-1 overflow-y-auto">
                    <MyTasksView companyId={companyId} userId={userId} />
                </main>
            )}
            
            {renderModals()}
            {error && <ErrorModal title="Chyba v docházce" message={error} onClose={() => setError(null)} />}
        </div>
    );
};

export default AttendanceCalendar;