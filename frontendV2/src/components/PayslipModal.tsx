
import React, { useState, useMemo } from 'react';
import { Employee, TimeEntry, PayrollSettings, TimeLogEntryType } from '../types';
import Modal from './common/Modal';
import Button from './common/Button';
import Icon from './common/Icon';
import Input from './common/Input';

interface PayslipModalProps {
    employee: Employee;
    timeEntries: TimeEntry[];
    onClose: () => void;
    payrollSettings: PayrollSettings;
}

// Czech holidays for 2024 - simplified, for demonstration
const CZECH_HOLIDAYS_2024: Set<string> = new Set([
    '2024-01-01', // New Year's Day
    '2024-03-29', // Good Friday
    '2024-04-01', // Easter Monday
    '2024-05-01', // Labour Day
    '2024-05-08', // Victory in Europe Day
    '2024-07-05', // Saints Cyril and Methodius Day
    '2024-07-06', // Jan Hus Day
    '2024-09-28', // St. Wenceslas Day
    '2024-10-28', // Independent Czechoslovak State Day
    '2024-11-17', // Struggle for Freedom and Democracy Day
    '2024-12-24', // Christmas Eve
    '2024-12-25', // Christmas Day
    '2024-12-26', // St. Stephen's Day
]);

const PayslipModal: React.FC<PayslipModalProps> = ({ employee, timeEntries, onClose, payrollSettings }) => {
    const [date, setDate] = useState(new Date('2024-07-01')); // Default to July to show sample data
    const [bonus, setBonus] = useState(0);

    const handlePrint = () => {
        const printContent = document.getElementById('payslip-print-area');
        if (printContent) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Výplatní páska</title>');
            printWindow?.document.write('<script src="https://cdn.tailwindcss.com"></script>');
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
    
    const payslipData = useMemo(() => {
        const year = date.getFullYear();
        const month = date.getMonth();

        const employeeTimeEntries = timeEntries.filter(entry => {
            // Fix: Use start_time instead of date, and user.id instead of employeeId
            const entryDate = new Date(entry.start_time);
            return entry.user.id === employee.user.id &&
                   entryDate.getFullYear() === year &&
                   entryDate.getMonth() === month &&
                   entry.entry_type === TimeLogEntryType.Work; // Fix: Use entry_type instead of activity
        });

        let totalHours = 0;
        let baseWorkSalary = 0;

        employeeTimeEntries.forEach(entry => {
            // Fix: Use start_time and end_time
            if (!entry.start_time || !entry.end_time) return;
            try {
                const startTimeStr = entry.start_time.substring(11, 16);
                const endTimeStr = entry.end_time.substring(11, 16);
                const [startH, startM] = startTimeStr.split(':').map(Number);
                const [endH, endM] = endTimeStr.split(':').map(Number);
                let minutes = (endH * 60 + endM) - (startH * 60 + startM);
                if (minutes <= 0) return;
                
                const hours = minutes / 60;
                totalHours += hours;

                let rateMultiplier = 1.0;
                // Fix: Use start_time to extract the date
                const entryDate = new Date(entry.start_time);
                const dayOfWeek = entryDate.getDay();

                if (CZECH_HOLIDAYS_2024.has(entry.start_time.split('T')[0])) {
                    rateMultiplier += payrollSettings.holidayRate / 100;
                } else if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
                    rateMultiplier += payrollSettings.weekendRate / 100;
                }
                
                // Note: Overtime and night shift calculation is simplified.
                // A full implementation would group hours by day for overtime
                // and split entries for night shifts. This is an approximation.
                // Fix: Membership doesn't have hourlyRate directly, using added field in types.ts
                baseWorkSalary += hours * (employee.hourlyRate || 0) * rateMultiplier;

            } catch {
                // Ignore invalid time entries
            }
        });
        
        const grossSalary = baseWorkSalary + bonus;
        
        // Simplified Czech payroll calculation
        const socialSecurityEmployee = grossSalary * 0.071; // Updated rate for 2024
        const healthInsuranceEmployee = grossSalary * 0.045;
        const taxBase = grossSalary;
        const tax = Math.max(0, taxBase * 0.15 - 2570); // 15% tax rate, 2570 CZK monthly tax credit on taxpayer
        const totalDeductions = socialSecurityEmployee + healthInsuranceEmployee + tax;
        const netSalary = grossSalary - totalDeductions;

        return {
            totalHours,
            baseWorkSalary,
            bonus,
            grossSalary,
            socialSecurityEmployee,
            healthInsuranceEmployee,
            tax,
            totalDeductions,
            netSalary,
            // Fix: Using added fields in Membership interface
            vacationRemaining: (employee.vacationDaysTotal || 0) - (employee.vacationDaysUsed || 0),
        };

    }, [employee, timeEntries, date, payrollSettings, bonus]);

    const changeMonth = (offset: number) => {
        const newDate = new Date(date);
        newDate.setMonth(date.getMonth() + offset);
        setDate(newDate);
    };

    return (
        <Modal title={`Výplatní páska - ${employee.user.email}`} onClose={onClose}>
             <div className="flex justify-between items-center mb-4 p-2 bg-slate-100 rounded-md">
                <Button onClick={() => changeMonth(-1)} variant="secondary"><Icon name="fa-arrow-left" /></Button>
                <span className="font-bold text-lg">{date.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' })}</span>
                <Button onClick={() => changeMonth(1)} variant="secondary"><Icon name="fa-arrow-right" /></Button>
            </div>
            
             <div className="mb-4">
                <Input
                    label="Odměny / Pohyblivá složka (Kč)"
                    type="number"
                    value={bonus}
                    onChange={e => setBonus(Number(e.target.value))}
                    min="0"
                />
            </div>

            <div id="payslip-print-area" className="p-6 border rounded-md">
                <h2 className="text-2xl font-bold text-center mb-4">Výplatní páska</h2>
                <div className="grid grid-cols-2 gap-6 text-sm mb-6">
                    <div>
                        <p><strong>Zaměstnavatel:</strong></p>
                        <p>LP DVOŘÁČEK spol. s.r.o.</p>
                        <p>Velice 27, 373 48 Dříteň</p>
                    </div>
                     <div>
                        <p><strong>Zaměstnanec:</strong></p>
                        <p>{employee.user.email}</p>
                        <p>Role: {employee.role}</p>
                    </div>
                </div>

                <div className="space-y-4">
                     <div>
                        <h3 className="font-semibold text-md border-b pb-1 mb-2">Položky mzdy</h3>
                        <div className="flex justify-between"><span>Základní mzda z odpracovaných hodin</span><span>{payslipData.baseWorkSalary.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span></div>
                        <div className="flex justify-between"><span>Odpracováno hodin</span><span>{payslipData.totalHours.toFixed(2)} hod</span></div>
                        <div className="flex justify-between"><span>Odměny / Pohyblivá složka</span><span>{payslipData.bonus.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span></div>
                        <div className="flex justify-between font-bold mt-1"><span>Hrubá mzda celkem</span><span>{payslipData.grossSalary.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span></div>
                    </div>

                     <div>
                        <h3 className="font-semibold text-md border-b pb-1 mb-2">Odvody a daně</h3>
                        <div className="flex justify-between"><span>Sociální pojištění (7.1%)</span><span>-{payslipData.socialSecurityEmployee.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span></div>
                        <div className="flex justify-between"><span>Zdravotní pojištění (4.5%)</span><span>-{payslipData.healthInsuranceEmployee.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span></div>
                        <div className="flex justify-between"><span>Záloha na daň z příjmu</span><span>-{payslipData.tax.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span></div>
                        <div className="flex justify-between font-bold mt-1"><span>Celkem srážky</span><span>-{payslipData.totalDeductions.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</span></div>
                    </div>
                </div>

                <div className="text-right mt-6 pt-4 border-t-2 border-slate-800">
                    <p className="text-xl font-bold">ČISTÁ MZDA K VÝPLATĚ</p>
                    <p className="text-2xl font-bold">{payslipData.netSalary.toLocaleString('cs-CZ', { style: 'currency', currency: 'CZK' })}</p>
                </div>

                 <div className="mt-6 pt-4 border-t text-sm">
                    <h3 className="font-semibold text-md mb-2">Evidence dovolené</h3>
                    {/* Fix: Using added fields in Membership interface */}
                    <div className="flex justify-between"><span>Celkový nárok</span><span>{employee.vacationDaysTotal || 0} dní</span></div>
                    <div className="flex justify-between"><span>Vyčerpáno</span><span>{employee.vacationDaysUsed || 0} dní</span></div>
                    <div className="flex justify-between font-bold"><span>Zbývá</span><span>{payslipData.vacationRemaining} dní</span></div>
                </div>

            </div>
             <div className="flex justify-end pt-4 mt-4">
                <Button onClick={handlePrint}><Icon name="fa-print" className="mr-2" /> Tisk</Button>
            </div>
        </Modal>
    );
};

export default PayslipModal;
