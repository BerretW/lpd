import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Definice toho, co je plugin na frontendu
export interface PluginComponentProps {
    context: any; // Data předaná z rodiče (např. clientId, workOrderId)
}

export type PluginRenderFn = React.FC<PluginComponentProps>;

interface PluginRegistry {
    [slotName: string]: PluginRenderFn[];
}

// Globální registr (mimo React cyklus, aby byl dostupný všude)
const pluginRegistry: PluginRegistry = {};

// Funkce pro registraci pluginu do konkrétního slotu
export const registerPlugin = (slotName: string, component: PluginRenderFn) => {
    if (!pluginRegistry[slotName]) {
        pluginRegistry[slotName] = [];
    }
    pluginRegistry[slotName].push(component);
};

// --- React Komponenta: ExtensionPoint (Zásuvka) ---
// Tuto komponentu vložíte kamkoliv do UI, kde chcete dovolit úpravy
interface ExtensionPointProps {
    name: string; // Název slotu, např. "client-detail-bottom"
    context?: any; // Data, která plugin potřebuje (např. { clientId: 5 })
}

export const ExtensionPoint: React.FC<ExtensionPointProps> = ({ name, context }) => {
    const plugins = pluginRegistry[name] || [];

    if (plugins.length === 0) return null;

    return (
        <div className="extension-point-container space-y-4">
            {plugins.map((PluginComponent, index) => (
                <div key={`${name}-plugin-${index}`} className="plugin-wrapper">
                    <PluginComponent context={context} />
                </div>
            ))}
        </div>
    );
};