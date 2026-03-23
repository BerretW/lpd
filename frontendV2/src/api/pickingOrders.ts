import { PickingOrderOut, PickingOrderStatus, PickingOrderCreateIn } from '../types';
import { fetchApi, USE_MOCKS, mockStore } from './core';

export const getPickingOrders = (cid: number): Promise<PickingOrderOut[]> =>
    USE_MOCKS ? Promise.resolve(mockStore.pickingOrders as any[]) : fetchApi(`/companies/${cid}/picking-orders`);

export const createPickingOrder = (cid: number, data: PickingOrderCreateIn): Promise<PickingOrderOut> => {
    if (USE_MOCKS) {
        const newOrder = {
            ...data,
            id: mockStore.pickingOrders.length + 1,
            status: PickingOrderStatus.New,
            created_at: new Date().toISOString(),
            requester: mockStore.members[0].user,
            source_location: data.source_location_id ? mockStore.locations.find(l => l.id === data.source_location_id) : null,
            destination_location: mockStore.locations.find(l => l.id === data.destination_location_id),
            items: data.items.map((item, idx) => ({
                id: idx + 1,
                requested_quantity: item.requested_quantity,
                picked_quantity: null,
                inventory_item: item.inventory_item_id ? mockStore.inventory.find(i => i.id === item.inventory_item_id) : null,
                requested_item_description: item.requested_item_description || null
            }))
        };
        mockStore.pickingOrders.push(newOrder as any);
        return Promise.resolve(newOrder as any);
    }
    return fetchApi(`/companies/${cid}/picking-orders`, { method: 'POST', body: JSON.stringify(data) });
};

export const fulfillPickingOrder = (cid: number, id: number, data: any) =>
    USE_MOCKS ? Promise.resolve() : fetchApi(`/companies/${cid}/picking-orders/${id}/fulfill`, { method: 'POST', body: JSON.stringify(data) });
