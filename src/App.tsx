import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders';
import Maintenance from './pages/Maintenance'; // Import the new Maintenance page
import Settings from './pages/Settings';
import { UserProvider } from './context/UserContext'; // Import Context Provider

// CRITICAL: Import global styles (Tailwind) here to ensure they load
import './index.css';

function App() {
  return (
    <UserProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </UserProvider>
  );
}

export default App;