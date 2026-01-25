import React, { useEffect, useState } from 'react';
import { BarChart3, Package, FileText, ArrowUpRight } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);

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

      {/* Placeholder for Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 min-h-[300px]">
        <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 group">
                <span className="font-medium text-gray-700">Import New Assets</span>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
            </button>
            <button className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 group">
                <span className="font-medium text-gray-700">Create Purchase Order</span>
                <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
            </button>
        </div>
      </div>
    </div>
  );
}