// src/state/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode'; // Správný import pro verzi 4+
import { login as apiLogin, logout as apiLogout } from '../api/apiService';

interface AuthData {
  token: string | null;
  userId: string | null;
  // Uživatel může být ve více firmách, pro jednoduchost vezmeme první
  companyId: number | null; 
}

interface AuthContextType {
  authData: AuthData | null;
  loading: boolean;
  login: (email, password) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Hook pro snadné použití kontextu v komponentách
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider, který obalí celou aplikaci
export const AuthProvider = ({ children }) => {
  const [authData, setAuthData] = useState<AuthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Při startu zkusíme načíst token z úložiště
    const loadToken = async () => {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        const decodedToken: any = jwtDecode(token);
        setAuthData({
          token,
          userId: decodedToken.sub,
          companyId: decodedToken.tenants?.[0] || null, // Vezmeme první firmu
        });
      }
      setLoading(false);
    };
    loadToken();
  }, []);

  const login = async (email, password) => {
    const response = await apiLogin(email, password);
    const token = response.access_token;
    const decodedToken: any = jwtDecode(token);
    setAuthData({
      token,
      userId: decodedToken.sub,
      companyId: decodedToken.tenants?.[0] || null,
    });
    // SecureStore je již řešen v apiService, ale pro jistotu
    await SecureStore.setItemAsync('authToken', token);
  };

  const logout = async () => {
    await apiLogout();
    setAuthData(null);
  };

  return (
    <AuthContext.Provider value={{ authData, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};