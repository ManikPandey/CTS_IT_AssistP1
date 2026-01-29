import React, { useEffect, useState } from 'react';
import { BarChart3, Package, FileText, ArrowUpRight, Plus, Upload, Activity, Wrench, Clock, DollarSign, Layers, PieChart as PieChartIcon, History } from 'lucide-react';
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
        if (resLogs.success) setRecentLogs(resLogs.data.slice(0, 10)); // Show recent 10
        
        if (resMaint.success) {
           const costsByMonth: Record<string, number> = {};
           resMaint.data.forEach((rec: any) => {
             if (rec.cost > 0 && rec.createdAt) {
               const month = new Date(rec.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
               costsByMonth[month] = (costsByMonth[month] || 0) + rec.cost;
             }
           });
           // Convert to array and sort (basic sort)
           const processedMaintCosts = Object.entries(costsByMonth).map(([name, value]) => ({ name, value }));
           setMaintenanceCosts(processedMaintCosts);
        }

      } catch (error) {
        console.error("Dashboard Error:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // --- CONFIGURATION ---
  const cards = [
    { label: "Total Assets", value: stats?.assetCount || 0, icon: Package, color: "text-blue-600", bg: "bg-blue-50", link: "/inventory" },
    { label: "Purchase Orders", value: stats?.poCount || 0, icon: FileText, color: "text-purple-600", bg: "bg-purple-50", link: "/purchase-orders" },
    { label: "Open Maintenance", value: stats?.maintenanceCount || 0, icon: Wrench, color: "text-orange-600", bg: "bg-orange-50", link: "/maintenance" },
    { label: "Categories", value: stats?.categoryCount || 0, icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50", link: "/inventory" },
  ];

  const COLORS = ['#0ea5e9', '#22c55e', '#eab308', '#f97316', '#ef4444', '#8b5cf6'];
  const STOCK_COLORS = ['#22c55e', '#ef4444']; // Green for In, Red for Out

  // Prepare Stock Data (Ensure values exist)
  const stockData = [
    { name: 'In Stock', value: stats?.inStock || 0 },
    { name: 'Out Stock', value: stats?.outStock || 0 }
  ].filter(x => x.value > 0); // Only show if data exists to avoid empty charts

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Executive Dashboard</h1>
            <p className="text-gray-500 mt-1">Real-time overview of assets, procurement, and operations.</p>
        </div>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border shadow-sm">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-semibold text-gray-700">System Operational</span>
        </div>
      </header>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div 
            key={i} 
            onClick={() => navigate(card.link)}
            className="bg-white p-6 rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 flex items-center justify-between cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
          >
            <div>
              <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">{card.label}</p>
              <h3 className="text-3xl font-extrabold text-gray-900 mt-2">{card.value}</h3>
            </div>
            <div className={`p-4 rounded-xl ${card.bg} group-hover:scale-110 transition-transform duration-300`}>
              <card.icon className={`w-6 h-6 ${card.color}`} />
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS SECTION 1: INVENTORY & STOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ASSET DISTRIBUTION (Bar) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <BarChart3 size={18} className="text-indigo-500" /> Asset Distribution
                </h3>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">By Category</span>
            </div>
            <div className="flex-1 w-full">
                {stats?.assetsByCategory?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.assetsByCategory} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                cursor={{ fill: '#f9fafb' }}
                            />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Count" barSize={32} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                        <Package size={48} className="mb-2 opacity-20" />
                        <p>No asset data available</p>
                    </div>
                )}
            </div>
        </div>

        {/* STOCK STATUS (Pie) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col">
            <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <Layers size={18} className="text-blue-500" /> Stock Availability
            </h3>
            <p className="text-xs text-gray-500 mb-6">In Stock vs Out of Stock Items</p>
            
            <div className="flex-1 w-full relative">
                {stockData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stockData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stockData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={STOCK_COLORS[index % STOCK_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400">
                         <div className="text-4xl font-bold text-gray-200">0%</div>
                         <p className="mt-2 text-sm">No stock info</p>
                    </div>
                )}
                {/* Center Label */}
                {stockData.length > 0 && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                        <span className="text-3xl font-bold text-gray-700">{stats?.assetCount || 0}</span>
                        <span className="block text-xs text-gray-400">Total</span>
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* 3. FINANCIAL ANALYSIS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* PROCUREMENT SPEND (Bar) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[350px] flex flex-col">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign size={18} className="text-green-600" /> Procurement Spend Analysis
            </h3>
            <div className="flex-1">
                {stats?.costByMonth?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.costByMonth}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                            <Tooltip formatter={(value: any) => [`₹ ${value.toLocaleString()}`, 'Cost']} contentStyle={{ borderRadius: '8px' }} />
                            <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Spend" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No Purchase Orders recorded</div>
                )}
            </div>
        </div>

        {/* MAINTENANCE COSTS (Area) */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[350px] flex flex-col">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Wrench size={18} className="text-orange-500" /> Maintenance Costs (Estimated)
            </h3>
            <div className="flex-1">
                {maintenanceCosts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={maintenanceCosts}>
                            <defs>
                                <linearGradient id="colorMaint" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                            <Tooltip formatter={(value: any) => [`₹ ${value.toLocaleString()}`, 'Cost']} contentStyle={{ borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="value" stroke="#f97316" fillOpacity={1} fill="url(#colorMaint)" name="Maintenance" />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No Maintenance Costs recorded</div>
                )}
            </div>
        </div>
      </div>

      {/* 4. ACTIVITY & QUICK ACTIONS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         
         {/* STATUS BREAKDOWN (Small Donut) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col">
             <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <PieChartIcon size={18} className="text-purple-500" /> All Statuses
             </h3>
             <div className="flex-1 w-full relative">
                {stats?.assetsByStatus?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={stats.assetsByStatus}
                                cx="50%"
                                cy="45%"
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {stats.assetsByStatus.map((entry: any, index: number) => (
                                    <Cell key={`cell-status-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Legend 
                                verticalAlign="bottom" 
                                align="center"
                                height={36} 
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">No Data</div>
                )}
             </div>
         </div>

         {/* QUICK ACTIONS (Moved Here) */}
         <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2 flex flex-col justify-center min-h-[400px]">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Activity size={18} className="text-indigo-500" /> Quick Actions
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                {[
                    { label: "Import Assets", icon: Upload, action: () => navigate('/inventory'), color: "text-blue-600", desc: "Bulk upload from Excel", bg: "bg-blue-50" },
                    { label: "Create Purchase Order", icon: Plus, action: () => navigate('/purchase-orders'), color: "text-green-600", desc: "Start new procurement", bg: "bg-green-50" },
                    { label: "Report Issue", icon: Wrench, action: () => navigate('/maintenance'), color: "text-orange-600", desc: "Log maintenance request", bg: "bg-orange-50" },
                    { label: "Audit Logs", icon: History, action: () => navigate('/settings'), color: "text-purple-600", desc: "View system history", bg: "bg-purple-50" },
                ].map((action, i) => (
                    <button 
                        key={i} 
                        onClick={action.action} 
                        className="flex items-start gap-4 p-5 bg-white border border-gray-100 rounded-xl hover:shadow-md hover:border-gray-200 transition-all text-left group"
                    >
                        <div className={`p-3 rounded-lg ${action.bg} group-hover:scale-110 transition-transform`}>
                             <action.icon size={24} className={action.color} />
                        </div>
                        <div>
                             <span className="block font-bold text-gray-800 text-lg">{action.label}</span>
                             <span className="text-sm text-gray-500">{action.desc}</span>
                        </div>
                    </button>
                ))}
            </div>
         </div>
      </div>

      {/* 5. RECENT ACTIVITY LOGS (Moved to Bottom) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Clock size={18} className="text-gray-500" /> Recent Activity
                </h3>
                <button onClick={() => navigate('/settings')} className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">View All</button>
            </div>
            
            <div className="overflow-hidden space-y-0">
                {recentLogs.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 italic">No recent activity found.</div>
                ) : (
                    recentLogs.map((log) => (
                        <div key={log.id} className={cn("flex gap-4 items-start p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0")}>
                            <div className={cn(
                                "mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-opacity-20",
                                log.action === 'CREATE' ? "bg-green-500 ring-green-100" :
                                log.action === 'DELETE' ? "bg-red-500 ring-red-100" :
                                log.action === 'RECEIVE' ? "bg-purple-500 ring-purple-100" :
                                "bg-blue-500 ring-blue-100"
                            )} />
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <p className="text-sm text-gray-800 font-medium leading-snug">{log.details}</p>
                                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{log.entityType}</span>
                                    <span className="text-[10px] text-gray-300">•</span>
                                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{log.action}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
      </div>

    </div>
  );
}