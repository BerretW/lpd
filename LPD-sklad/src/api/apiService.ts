// src/api/apiService.ts
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://192.168.88.57:8000'; // Nahraďte URL vašeho backendu!

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Toto je "interceptor" – kód, který se spustí před KAŽDÝM požadavkem.
// Automaticky přidá autorizační hlavičku, pokud máme token.
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Funkce pro autentizaci ---
export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  const { access_token } = response.data;
  // Uložíme token do bezpečného úložiště
  await SecureStore.setItemAsync('authToken', access_token);
  return response.data;
};

export const logout = async () => {
  // Smažeme token
  await SecureStore.deleteItemAsync('authToken');
};

// --- Funkce pro sklad ---
// Všechny cesty obsahují company_id, budeme ho muset předávat
export const getInventoryItems = (companyId: number) => {
  return api.get(`/companies/${companyId}/inventory`);
};

export const findItemByEan = (companyId: number, ean: string) => {
  return api.get(`/companies/${companyId}/inventory/by-ean/${ean}`);
};

export const createInventoryItem = (companyId: number, itemData: any) => {
  return api.post(`/companies/${companyId}/inventory`, itemData);
};

// ... a tak dále pro ostatní endpointy

export default api;