import React, { useEffect, useState } from 'react';
import { BarChart3, Package, FileText, ArrowUpRight, Plus, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const res = await window.api.getDashboardStats();
      if (res.success) setStats(res.data);
    }
    load();
  }, []);

  const cards = [
    { label: "Total Assets", value: stats?.assetCount || 0, icon: Package, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Purchase Orders", value: stats?.poCount || 0, icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Categories", value: stats?.categoryCount || 0, icon: BarChart3, color: "text-indigo-600", bg: "bg-indigo-50" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">Overview of your IT Infrastructure</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-1">{card.value}</h3>
            </div>
            <div className={`p-3 rounded-lg ${card.bg}`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
                onClick={() => navigate('/inventory')} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 group transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Upload size={20} />
                    </div>
                    <div className="text-left">
                        <span className="block font-medium text-gray-700">Import/Manage Assets</span>
                        <span className="text-xs text-gray-500">Go to Inventory</span>
                    </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
            </button>

            <button 
                onClick={() => navigate('/purchase-orders')} 
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 group transition-all"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                        <Plus size={20} />
                    </div>
                    <div className="text-left">
                        <span className="block font-medium text-gray-700">Create Purchase Order</span>
                        <span className="text-xs text-gray-500">Go to Procurement</span>
                    </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600" />
            </button>
        </div>
      </div>
    </div>
  );
}