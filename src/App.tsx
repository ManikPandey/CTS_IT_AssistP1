import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PurchaseOrders from './pages/PurchaseOrders'; // Import the new page
import Settings from './pages/Settings';

// CRITICAL: Import global styles (Tailwind) here to ensure they load
import './index.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="settings" element={<Settings />} />          
          <Route path="purchase-orders" element={<PurchaseOrders />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;