import React, { createContext, useContext, useState, useEffect } from 'react';

type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
}

interface UserContextType {
  user: User | null;
  isAdmin: boolean;
  login: (u: User) => void;
  logout: () => void;
  loading: boolean;
  isInitialized: boolean; // True if at least one user exists in DB
  checkInitialization: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(true);

  // Check if the system has been set up (has users)
  const checkInitialization = async () => {
    try {
      const res = await window.api.checkInit();
      setIsInitialized(res.initialized);
    } catch (error) {
      console.error("Failed to check initialization status:", error);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      
      // 1. Check if system is initialized
      await checkInitialization();
      
      // 2. Check for persisted session
      const stored = localStorage.getItem('it_asset_user');
      if (stored) {
        try {
          setUser(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse stored user", e);
          localStorage.removeItem('it_asset_user');
        }
      }
      
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (u: User) => {
    setUser(u);
    localStorage.setItem('it_asset_user', JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('it_asset_user');
  };

  const value = {
    user,
    isAdmin: user?.role === 'ADMIN',
    login,
    logout,
    loading,
    isInitialized,
    checkInitialization
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}