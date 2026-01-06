import React from 'react';
import { TimeLogOut, TimeLogStatus, TimeLogEntryType } from '../types';
import Button from './common/Button';
import Icon from './common/Icon';

// Status display helper
const statusDisplay: { [key in TimeLogStatus]: { text: string; color: string } } = {
    [TimeLogStatus.Pending]: { text: 'Čeká na schválení', color: 'bg-yellow-200 text-yellow-800' },
    [TimeLogStatus.Approved]: { text: 'Schváleno', color: 'bg-green-200 text-green-800' },
    [TimeLogStatus.Rejected]: { text: 'Zamítnuto', color: 'bg-red-200 text-red-800' },
};

const entryTypeDisplay: { [key in TimeLogEntryType]: { text: string; icon: string; color: string; } } = {
    [TimeLogEntryType.Work]: { text: 'Práce', icon: 'fa-briefcase', color: 'border-l-red-300' },
    [TimeLogEntryType.Vacation]: { text: 'Dovolená', icon: 'fa-sun', color: 'border-l-blue-400' },
    [TimeLogEntryType.SickDay]: { text: 'Nemoc', icon: 'fa-medkit', color: 'border-l-orange-400' },
    [TimeLogEntryType.Doctor]: { text: 'Lékař', icon: 'fa-stethoscope', color: 'border-l-purple-400' },
    [TimeLogEntryType.UnpaidLeave]: { text: 'Neplacené volno', icon: 'fa-calendar-times', color: 'border-l-slate-400' },
};

const formatTime = (isoString: string) => {
    // Extracts HH:mm from "YYYY-MM-DDTHH:mm:ss" format, ignoring timezones.
    return isoString.substring(11, 16);
};


interface TimeLogItemProps {
    log: TimeLogOut;
    isOwnLog: boolean;
    isAdmin: boolean;
    onEdit: (log: TimeLogOut) => void;
    onDelete: (log: TimeLogOut) => void;
    onStatusUpdate: (logId: number, status: TimeLogStatus) => void;
    onManageMaterial: (log: TimeLogOut) => void;
}

const TimeLogItem: React.FC<TimeLogItemProps> = React.memo(({ log, isOwnLog, isAdmin, onEdit, onDelete, onStatusUpdate, onManageMaterial }) => {
    const isPending = log.status === 'pending';
    const statusInfo = statusDisplay[log.status];
    const entryInfo = entryTypeDisplay[log.entry_type];
    const isWork = log.entry_type === TimeLogEntryType.Work;

    return (
        <li className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
            <div className="flex items-center flex-grow min-w-0">
                <div className={`border-l-4 ${entryInfo.color} h-12 mr-4 flex-shrink-0`}></div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                        <Icon name={entryInfo.icon} className="text-slate-500 flex-shrink-0" />
                        <p className="font-semibold text-slate-800 truncate" title={isWork ? log.task?.name : entryInfo.text}>
                            {isWork ? log.task?.name : entryInfo.text}
                        </p>
                        {statusInfo && (
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusInfo.color} flex-shrink-0`}>
                                {statusInfo.text}
                            </span>
                        )}
                    </div>
                    {log.notes && <p className="text-sm text-slate-600 whitespace-pre-line mt-1 truncate">{log.notes}</p>}
                    {!isOwnLog && <p className="text-xs text-slate-500 mt-1 font-semibold">{log.user.email}</p>}
                </div>
            </div>
            <div className="text-right ml-6 flex-shrink-0">
                <p className="text-lg font-bold text-slate-700">
                    {log.duration_hours.toFixed(2)} hod
                </p>
                <p className="text-sm text-slate-500">
                    {formatTime(log.start_time)} - {formatTime(log.end_time)}
                </p>
            </div>
            <div className="flex-shrink-0 ml-4 flex flex-col space-y-2 w-36 text-center">
                {isWork && log.task && (
                    <>
                        <Button variant="secondary" onClick={() => onManageMaterial(log)} className="!py-1 !px-2 text-xs w-full">
                            <Icon name="fa-warehouse" className="mr-1" /> Spravovat materiál
                        </Button>
                    </>
                )}
                
                {(isOwnLog || isAdmin) && (
                     <div className="flex space-x-2">
                        <Button
                            variant="secondary"
                            onClick={() => onEdit(log)}
                            className="!py-1 !px-2 text-xs flex-1"
                            disabled={!isPending}
                            title={!isPending ? "Záznam již byl zpracován a nelze jej upravit." : "Upravit záznam"}
                        >
                            <Icon name="fa-pencil-alt" />
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => onDelete(log)}
                            className="!py-1 !px-2 text-xs bg-red-100 hover:bg-red-200 text-red-700 flex-1"
                            disabled={!isPending}
                            title={!isPending ? "Záznam již byl zpracován a nelze jej smazat." : "Smazat záznam"}
                        >
                            <Icon name="fa-trash" />
                        </Button>
                    </div>
                )}
                
                {(!isOwnLog && isAdmin && isPending) && (
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => onStatusUpdate(log.id, TimeLogStatus.Approved)}
                            className="!py-1 !px-2 text-xs bg-green-100 hover:bg-green-200 text-green-700 w-full"
                        >
                            <Icon name="fa-check" className="mr-1" /> Schválit
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => onStatusUpdate(log.id, TimeLogStatus.Rejected)}
                            className="!py-1 !px-2 text-xs bg-red-100 hover:bg-red-200 text-red-700 w-full"
                        >
                            <Icon name="fa-times" className="mr-1" /> Zamítnout
                        </Button>
                    </>
                )}
            </div>
        </li>
    );
});

export default TimeLogItem;