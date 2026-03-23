import { VehicleOut, VehicleLogOut, VehicleAlertOut, FuelLogOut } from '../types';
import { fetchApi } from './core';

export const getVehicles = (cid: number): Promise<VehicleOut[]> =>
    fetchApi(`/plugins/fleet/${cid}/vehicles`);

export const createVehicle = (cid: number, data: any): Promise<VehicleOut> =>
    fetchApi(`/plugins/fleet/${cid}/vehicles`, { method: 'POST', body: JSON.stringify(data) });

export const updateVehicle = (cid: number, vid: number, data: any): Promise<VehicleOut> =>
    fetchApi(`/plugins/fleet/${cid}/vehicles/${vid}`, { method: 'PATCH', body: JSON.stringify(data) });

export const getFleetLogs = (cid: number, vid?: number): Promise<VehicleLogOut[]> =>
    fetchApi(`/plugins/fleet/${cid}/logs${vid ? `?vehicle_id=${vid}` : ''}`);

export const createFleetLog = (cid: number, data: any): Promise<VehicleLogOut> =>
    fetchApi(`/plugins/fleet/${cid}/logs`, { method: 'POST', body: JSON.stringify(data) });

export const getFleetAlerts = (cid: number): Promise<VehicleAlertOut[]> =>
    fetchApi(`/plugins/fleet/${cid}/alerts`);

export const updateFleetLog = (cid: number, logId: number, data: any): Promise<VehicleLogOut> =>
    fetchApi(`/plugins/fleet/${cid}/logs/${logId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteFleetLog = (cid: number, logId: number): Promise<void> =>
    fetchApi(`/plugins/fleet/${cid}/logs/${logId}`, { method: 'DELETE' });

export const getFuelLogs = (cid: number, vid?: number): Promise<FuelLogOut[]> =>
    fetchApi(`/plugins/fleet/${cid}/fuel${vid ? `?vehicle_id=${vid}` : ''}`);

export const createFuelLog = (cid: number, data: any): Promise<FuelLogOut> =>
    fetchApi(`/plugins/fleet/${cid}/fuel`, { method: 'POST', body: JSON.stringify(data) });

export const updateFuelLog = (cid: number, logId: number, data: any): Promise<FuelLogOut> =>
    fetchApi(`/plugins/fleet/${cid}/fuel/${logId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteFuelLog = (cid: number, logId: number): Promise<void> =>
    fetchApi(`/plugins/fleet/${cid}/fuel/${logId}`, { method: 'DELETE' });
