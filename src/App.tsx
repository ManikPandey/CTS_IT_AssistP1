import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders';
import Maintenance from './pages/Maintenance';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { UserProvider, useUser } from './context/UserContext';
import './index.css';

// Component to handle routing based on authentication status
function AppRoutes() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-gray-600 animate-pulse">Loading System...</div>
      </div>
    );
  }

  // If not logged in, show Login page
  if (!user) {
    return <Login />;
  }

  // If logged in, show Main App Layout
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <UserProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </UserProvider>
  );
}

export default App;