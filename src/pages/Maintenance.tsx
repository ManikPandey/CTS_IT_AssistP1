import React, { useEffect, useState } from 'react';
import { Wrench, CheckCircle, AlertTriangle, Activity, X, DollarSign,IndianRupee, Check } from 'lucide-react';
import { useUser } from '@/context/UserContext';
import { cn } from '@/lib/utils';

export default function Maintenance() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('OPEN'); // OPEN | CLOSED | ALL
  const { isAdmin } = useUser();
  
  // Resolve Modal State
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveCost, setResolveCost] = useState('');

  const loadData = async () => {
    setLoading(true);
    const res = await window.api.getMaintenanceRecords();
    if (res.success) {
        setRecords(res.data);
    } else {
        console.error("Failed to load records:", res.error);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openResolveModal = (id: string) => {
    setResolvingId(id);
    setResolveCost('0');
  };

  const handleResolveSubmit = async () => {
    if (!resolvingId) return;
    
    const costValue = parseFloat(resolveCost);
    if (isNaN(costValue) || costValue < 0) {
        alert("Please enter a valid non-negative cost.");
        return;
    }
    
    const res = await window.api.resolveMaintenanceRecord({ 
        id: resolvingId, 
        cost: costValue
    });

    if (res.success) {
      setResolvingId(null);
      loadData(); // Refresh list to show status change
    } else {
      alert("Error: " + res.error);
    }
  };

  const filteredRecords = records.filter(r => {
    if (filter === 'ALL') return true;
    return r.status === filter;
  });

  const totalCost = filteredRecords.reduce((acc, r) => acc + (r.cost || 0), 0);

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="text-orange-500" /> Maintenance & Issues
          </h1>
          <p className="text-gray-500">Track asset repairs, breakdowns, and maintenance costs.</p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-lg">
          {['OPEN', 'CLOSED', 'ALL'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                filter === f ? "bg-white shadow text-indigo-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="p-3 bg-red-50 text-red-600 rounded-full"><AlertTriangle /></div>
            <div>
               <div className="text-2xl font-bold text-gray-900">{records.filter(r => r.status === 'OPEN').length}</div>
               <div className="text-sm text-gray-500">Active Issues</div>
            </div>
         </div>
         <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="p-3 bg-green-50 text-green-600 rounded-full"><CheckCircle /></div>
            <div>
               <div className="text-2xl font-bold text-gray-900">{records.filter(r => r.status === 'CLOSED').length}</div>
               <div className="text-sm text-gray-500">Resolved</div>
            </div>
         </div>
         <div className="bg-white p-4 rounded-lg border shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Activity /></div>
            <div>
               <div className="text-2xl font-bold text-gray-900">₹ {totalCost.toLocaleString()}</div>
               <div className="text-sm text-gray-500">Total Maintenance Cost</div>
            </div>
         </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-lg shadow border flex-1 overflow-hidden">
        <div className="overflow-auto h-full">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10 border-b">
                    <tr>
                        <th className="p-4 font-semibold text-gray-600 w-32">Date</th>
                        <th className="p-4 font-semibold text-gray-600 w-64">Asset</th>
                        <th className="p-4 font-semibold text-gray-600 w-32">Issue Type</th>
                        <th className="p-4 font-semibold text-gray-600">Description</th>
                        <th className="p-4 font-semibold text-gray-600 w-24">Cost</th>
                        <th className="p-4 font-semibold text-gray-600 w-24">Status</th>
                        <th className="p-4 font-semibold text-gray-600 w-24 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {loading ? (
                        <tr><td colSpan={7} className="p-12 text-center text-gray-500">Loading records...</td></tr>
                    ) : filteredRecords.length === 0 ? (
                        <tr><td colSpan={7} className="p-12 text-center text-gray-500">No maintenance records found.</td></tr>
                    ) : (
                        filteredRecords.map(rec => {
                            // Safe parsing of asset name
                            let assetName = "Unknown Asset";
                            try { 
                                const props = JSON.parse(rec.asset.properties);
                                assetName = props['Name'] || props['name'] || "Asset #" + rec.assetId.slice(0,4); 
                            } catch(e){}

                            return (
                                <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-gray-500 whitespace-nowrap">{new Date(rec.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        <div className="font-medium text-gray-900">{assetName}</div>
                                        <div className="text-xs text-gray-400">
                                            {rec.asset.subCategory?.category?.name} / {rec.asset.subCategory?.name}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs font-semibold text-gray-700 border">
                                            {rec.issueType}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600 max-w-xs truncate" title={rec.description}>
                                        {rec.description}
                                    </td>
                                    <td className="p-4 font-mono font-medium">
                                        {rec.cost > 0 ? `₹ ${rec.cost.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="p-4">
                                        <span className={cn(
                                            "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                                            rec.status === 'OPEN' 
                                                ? "bg-red-50 text-red-700 border-red-200" 
                                                : "bg-green-50 text-green-700 border-green-200"
                                        )}>
                                            {rec.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        {rec.status === 'OPEN' && isAdmin && (
                                            <button 
                                                onClick={() => openResolveModal(rec.id)} 
                                                className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 shadow-sm transition-colors"
                                            >
                                                Resolve
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* RESOLVE MODAL */}
      {resolvingId && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-200">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-900">Resolve Issue</h3>
                <button onClick={() => setResolvingId(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <X size={20}/>
                </button>
             </div>
             
             <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Final Repair Cost (₹)</label>
                <div className="relative">
                    {/* <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /> */}
                    <IndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                        type="number" 
                        min="0"
                        className="w-full pl-9 p-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none" 
                        placeholder="0.00"
                        value={resolveCost}
                        onChange={(e) => setResolveCost(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-800">
                    <p><strong>Note:</strong> Marking as closed will:</p>
                    <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5">
                        <li>Set Asset status back to <strong>ACTIVE</strong></li>
                        <li>Log resolution date & cost</li>
                    </ul>
                </div>
             </div>

             <div className="flex justify-end gap-3 pt-2">
                <button 
                    onClick={() => setResolvingId(null)} 
                    className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleResolveSubmit} 
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm flex items-center gap-2 transition-colors"
                >
                    <Check size={16} /> Complete
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}