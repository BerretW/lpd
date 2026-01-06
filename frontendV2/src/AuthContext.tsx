import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import * as api from './api';
import { RoleEnum, User } from './types';
import { Membership } from './types';

interface DecodedToken {
  sub: string;
  tenants: number[];
  exp: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  companyId: number | null;
  role: RoleEnum | null;
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string; rememberMe: boolean; }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('authToken') || sessionStorage.getItem('authToken'));
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [role, setRole] = useState<RoleEnum | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
    setCompanyId(null);
    setRole(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initializeAuth = async () => {
      if (token) {
        try {
          const decoded = jwtDecode<DecodedToken>(token);
          if (decoded.exp * 1000 > Date.now()) {
            const userId = parseInt(decoded.sub, 10);
            const company = decoded.tenants[0];

            if (company) {
              const members: Membership[] = await api.getMembers(company);
              if (!isMounted) return; // Don't update state if component unmounted

              const currentUserMembership = members.find(m => m.user.id === userId);
              if (currentUserMembership) {
                setCompanyId(company);
                setRole(currentUserMembership.role);
                setUser(currentUserMembership.user);
              } else {
                logout(); // User not found in company members
              }
            } else {
              logout(); // No company associated with token
            }
          } else {
            logout(); // Token expired
          }
        } catch (error) {
          if (!isMounted) return;
          console.error('Token validation failed', error);
          // Only log out on auth-related errors, not network failures
          if (error instanceof Error && error.message === 'Unauthorized') {
             logout();
          }
        }
      }
    };
    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [token, logout]);

  const login = async (credentials: { email: string; password: string; rememberMe: boolean }) => {
    const { email, password, rememberMe } = credentials;
    const data = await api.login({ email, password });
    
    if (rememberMe) {
        localStorage.setItem('authToken', data.access_token);
        sessionStorage.removeItem('authToken');
    } else {
        sessionStorage.setItem('authToken', data.access_token);
        localStorage.removeItem('authToken');
    }

    setToken(data.access_token);
  };

  const value = {
    token,
    user,
    companyId,
    role,
    isAuthenticated: !!token && !!user && !!companyId,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};