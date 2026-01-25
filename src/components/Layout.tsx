import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Settings, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Layout() {
  const navItems = [
    { to: "/", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/inventory", icon: Database, label: "Inventory" },
    { to: "/purchase-orders", icon: ShoppingCart, label: "Purchase Orders" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold tracking-tight">IT Admin <span className="text-indigo-400">Pro</span></h1>
          <p className="text-xs text-slate-400 mt-1">Enterprise Asset Manager</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-indigo-600 text-white shadow-md" 
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800 rounded-lg p-3">
            <p className="text-xs text-slate-400 uppercase font-semibold">System Status</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-white">Online • Local DB</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
          {/* This is where the page content will appear */}
          <Outlet /> 
        </div>
      </main>
    </div>
  );
}