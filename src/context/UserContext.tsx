import React, { createContext, useContext, useState, useEffect } from 'react';

type UserRole = 'ADMIN' | 'USER';

interface UserContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isAdmin: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  // Default to ADMIN for development convenience
  const [role, setRole] = useState<UserRole>('ADMIN');

  const value = {
    role,
    setRole,
    isAdmin: role === 'ADMIN',
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