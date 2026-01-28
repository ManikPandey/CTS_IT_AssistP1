import React, { useEffect, useState } from 'react';
import { BarChart3, Package, FileText, ArrowUpRight, Plus, Upload, Activity, Wrench, Clock, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';
// Recharts imports for Analytics
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [maintenanceCosts, setMaintenanceCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const { isAdmin } = useUser();

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Fetch all necessary data in parallel
        const [resStats, resLogs, resMaint] = await Promise.all([
          window.api.getDashboardStats(),
          window.api.getAuditLogs(),
          window.api.getMaintenanceRecords()
        ]);

        if (resStats.success) setStats(resStats.data);
        if (resLogs.success) setRecentLogs(resLogs.data.slice(0, 5)); // Top 5 recent logs
        
        // Process Maintenance Costs Client-Side for Analysis
        if (resMaint.success) {
           const costsByMonth: Record<string, number> = {};
           resMaint.data.forEach((rec: any) => {
             if (rec.cost > 0 && rec.createdAt) {
               const month = new Date(rec.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
               costsByMonth[month] = (costsByMonth[month] || 0) + rec.cost;
             }
           });
           const processedMaintCosts = Object.entries(costsByMonth).map(([name, value]) => ({ name, value }));
           setMaintenanceCosts(processedMaintCosts);
        }

      } catch (error) {
        console.error("Dashboard Load Error:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // KPI Cards Configuration
  const cards = [
    { 
      label: "Total Assets", 
      value: stats?.assetCount || 0, 
      icon: Package, 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      link: "/inventory"
    },
    { 
      label: "Purchase Orders", 
      value: stats?.poCount || 0, 
      icon: FileText, 
      color: "text-purple-600", 
      bg: "bg-purple-50",
      link: "/purchase-orders"
    },
    { 
      label: "Open Maintenance", 
      value: stats?.maintenanceCount || 0, 
      icon: Wrench, 
      color: "text-orange-600", 
      bg: "bg-orange-50",
      link: "/maintenance"
    },
    { 
      label: "Total Categories", 
      value: stats?.categoryCount || 0, 
      icon: BarChart3, 
      color: "text-gray-600", 
      bg: "bg-gray-50",
      link: "/inventory"
    },
  ];

  // Chart Colors
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <header className="flex justify-between items-end">
        <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500">Overview of your IT Infrastructure</p>
        </div>
        <div className="text-right">
            <p className="text-sm font-medium text-gray-500">System Status</p>
            <div className="flex items-center gap-2 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-sm font-bold text-gray-700">Operational</span>
            </div>
        </div>
      </header>

      {/* 1. KPI STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div 
            key={i} 
            onClick={() => navigate(card.link)}
            className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">{card.value}</h3>
            </div>
            <div className={`p-4 rounded-xl ${card.bg} group-hover:scale-110 transition-transform`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* 2. ANALYTICS CHARTS ROW 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CHART: ASSETS BY CATEGORY (Bar) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 min-h-[400px]">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 size={18} className="text-indigo-500" /> Asset Distribution by Category
            </h3>
            {stats?.assetsByCategory?.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={stats.assetsByCategory} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            cursor={{ fill: '#f3f4f6' }}
                        />
                        <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Count" barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No Asset Data Available</div>
            )}
        </div>

        {/* CHART: ASSETS BY STATUS (Donut) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px]">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Activity size={18} className="text-green-500" /> Asset Health Status
            </h3>
            {stats?.assetsByStatus?.length > 0 ? (
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.assetsByStatus}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stats.assetsByStatus.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No Data</div>
            )}
        </div>
      </div>

      {/* 3. COST ANALYSIS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* CHART: PO SPEND (Bar) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[350px]">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign size={18} className="text-green-600" /> Procurement Spend Analysis
            </h3>
            {stats?.costByMonth?.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stats.costByMonth}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value: any) => [`₹ ${value.toLocaleString()}`, 'Cost']} />
                        <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Purchase Cost" />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No Purchase Orders</div>
            )}
        </div>

        {/* CHART: MAINTENANCE COST (Area) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[350px]">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Wrench size={18} className="text-orange-500" /> Maintenance Costs (Estimated)
            </h3>
            {maintenanceCosts.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={maintenanceCosts}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} />
                        <YAxis axisLine={false} tickLine={false} />
                        <Tooltip formatter={(value: any) => [`₹ ${value.toLocaleString()}`, 'Cost']} />
                        <Area type="monotone" dataKey="value" stroke="#f97316" fill="#ffedd5" name="Maintenance" />
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400">No Maintenance Records with Cost</div>
            )}
        </div>
      </div>

      {/* 4. RECENT ACTIVITY & QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* RECENT ACTIVITY */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Clock size={20} className="text-gray-500" /> Recent Activity
            </h3>
            <div className="space-y-4">
                {recentLogs.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No recent activity.</p>
                ) : (
                    recentLogs.map((log) => (
                        <div key={log.id} className="flex gap-4 items-center p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0">
                            <div className={cn(
                                "w-2 h-2 rounded-full shrink-0",
                                log.action === 'CREATE' ? "bg-green-500" :
                                log.action === 'DELETE' ? "bg-red-500" :
                                log.action === 'RECEIVE' ? "bg-purple-500" :
                                "bg-blue-500"
                            )} />
                            <div className="flex-1">
                                <p className="text-sm text-gray-800 font-medium">{log.details}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-xs text-gray-400">{log.entityType} • {log.action}</span>
                                    <span className="text-xs text-gray-400 font-mono">{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <button onClick={() => navigate('/settings')} className="mt-4 w-full py-2 text-xs font-medium text-center text-indigo-600 hover:bg-indigo-50 rounded transition-colors">
                View Full Audit Log
            </button>
        </div>

        {/* QUICK ACTIONS */}
        <div className="space-y-4">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-md p-6 text-white">
                <h3 className="font-bold text-lg mb-2">Quick Actions</h3>
                <p className="text-indigo-100 text-sm mb-6">Common tasks for Asset Management</p>
                
                <div className="space-y-3">
                    <button onClick={() => navigate('/inventory')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center justify-between transition-colors">
                        <span className="text-sm font-medium flex items-center gap-2"><Upload size={16} /> Import Assets</span>
                        <ArrowUpRight size={16} />
                    </button>
                    <button onClick={() => navigate('/purchase-orders')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center justify-between transition-colors">
                        <span className="text-sm font-medium flex items-center gap-2"><Plus size={16} /> New Purchase Order</span>
                        <ArrowUpRight size={16} />
                    </button>
                    <button onClick={() => navigate('/maintenance')} className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm p-3 rounded-lg flex items-center justify-between transition-colors">
                        <span className="text-sm font-medium flex items-center gap-2"><Wrench size={16} /> Report Issue</span>
                        <ArrowUpRight size={16} />
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}