import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';

// CRITICAL: Import global styles (Tailwind) here to ensure they load
import './index.css';

function App() {
  return (
    // HashRouter is preferred for Electron apps to handle file:// paths correctly
    <HashRouter>
      <Routes>
        {/* Wrap everything in the Main Layout (Sidebar + Content Area) */}
        <Route path="/" element={<Layout />}>
          
          {/* The default page is Dashboard */}
          <Route index element={<Dashboard />} />
          
          {/* The Inventory Manager */}
          <Route path="inventory" element={<Inventory />} />
          
          {/* Placeholders for future phases */}
          <Route 
            path="purchase-orders" 
            element={
              <div className="p-10 text-center">
                <h2 className="text-2xl font-bold text-gray-400">Purchase Orders Module</h2>
                <p className="text-gray-500">Coming in Phase 4</p>
              </div>
            } 
          />
          <Route 
            path="settings" 
            element={
              <div className="p-10 text-center">
                <h2 className="text-2xl font-bold text-gray-400">System Settings</h2>
                <p className="text-gray-500">Configuration options will appear here.</p>
              </div>
            } 
          />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;