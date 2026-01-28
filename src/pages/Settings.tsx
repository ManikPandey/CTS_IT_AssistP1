import React, { useEffect, useState } from 'react';
import { Shield, Database, History, Download, HardDrive, User, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';
import { useUser } from '@/context/UserContext';

export default function Settings() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'data' | 'account'
  
  // Use Global User Context for Role Management
  const { role, setRole, isAdmin } = useUser();

  const loadLogs = async () => {
    setLoading(true);
    const res = await window.api.getAuditLogs();
    if (res.success) setLogs(res.data);
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'audit') loadLogs();
  }, [activeTab]);

  const handleBackup = async () => {
    if (!isAdmin) {
        alert("Access Denied: Only Admins can perform backups.");
        return;
    }
    const res = await window.api.backupDatabase();
    if (res.success) {
      alert(`Backup successful!\nSaved to: ${res.filePath}`);
      loadLogs(); // Refresh logs to show the backup event
    } else if (res.error) {
      alert("Backup failed: " + res.error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-500">Manage security, data, and system logs</p>
        </div>
        <div className="text-sm font-medium px-3 py-1 bg-gray-100 rounded-full text-gray-600">
            Current Role: <span className={isAdmin ? "text-indigo-600 font-bold" : "text-gray-600 font-bold"}>{role}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setActiveTab('audit')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'audit' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <div className="flex items-center gap-2"><History size={16} /> Audit Logs</div>
        </button>
        <button onClick={() => setActiveTab('data')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'data' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <div className="flex items-center gap-2"><Database size={16} /> Data & Backup</div>
        </button>
        <button onClick={() => setActiveTab('account')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'account' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <div className="flex items-center gap-2"><User size={16} /> Role Simulation</div>
        </button>
      </div>

      {/* 1. AUDIT LOG TAB */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Recent Activity</h3>
            <button onClick={loadLogs} className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0 shadow-sm">
                <tr>
                  <th className="p-3 font-semibold text-gray-600 w-48">Time</th>
                  <th className="p-3 font-semibold text-gray-600 w-32">Action</th>
                  <th className="p-3 font-semibold text-gray-600 w-32">Entity</th>
                  <th className="p-3 font-semibold text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-gray-500 whitespace-nowrap text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        log.action === 'CREATE' ? 'bg-green-100 text-green-800' : 
                        log.action === 'DELETE' ? 'bg-red-100 text-red-800' : 
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                        log.action === 'IMPORT' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-medium text-gray-500 uppercase">{log.entityType}</td>
                    <td className="p-3 text-gray-700">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && !loading && <div className="p-12 text-center text-gray-500 italic">No activity logs found.</div>}
          </div>
        </div>
      )}

      {/* 2. DATA TAB */}
      {activeTab === 'data' && (
        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600"><HardDrive size={24} /></div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Database Backup</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-xl">
                    Create a full copy of your local SQLite database file (`dev.db`). 
                    We recommend doing this weekly to prevent data loss in case of system failure.
                </p>
                <div className="mt-6">
                  {isAdmin ? (
                    <button onClick={handleBackup} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-all">
                        <Download size={16} /> Backup Now
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm">
                        <Shield size={14} /> Backup requires Admin privileges.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-75">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gray-100 rounded-lg text-gray-500"><Database size={24} /></div>
              <div>
                <h3 className="text-lg font-bold text-gray-700">Restore Database</h3>
                <p className="text-sm text-gray-500 mt-1">
                    To restore data, please close the application and manually replace the `prisma/dev.db` file with your backup file.
                    This feature is locked in the UI for safety.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ROLE SIMULATION TAB */}
      {activeTab === 'account' && (
        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">Active Role: <span className={role === 'ADMIN' ? "text-indigo-600" : "text-gray-600"}>{role}</span></h3>
                    <p className="text-sm text-gray-500 max-w-lg">
                        {role === 'ADMIN' 
                            ? "You are currently in Admin Mode. You have full access to Create, Edit, Delete assets, and perform System Backups." 
                            : "You are currently in User (View-Only) Mode. You can view Inventory and POs, but cannot make changes or see Admin controls."}
                    </p>
                </div>
                <button 
                    onClick={() => setRole(role === 'ADMIN' ? 'USER' : 'ADMIN')}
                    className={`flex items-center gap-3 px-6 py-4 rounded-xl font-bold text-white transition-all shadow-md transform active:scale-95 ${
                        role === 'ADMIN' 
                        ? 'bg-indigo-600 hover:bg-indigo-700 ring-4 ring-indigo-50' 
                        : 'bg-gray-600 hover:bg-gray-700 ring-4 ring-gray-100'
                    }`}
                >
                    {role === 'ADMIN' ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    <span>Switch to {role === 'ADMIN' ? 'User' : 'Admin'}</span>
                </button>
            </div>
            
            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 flex items-start gap-3">
                <Shield size={18} className="mt-0.5 shrink-0" />
                <p>
                    <strong>Note:</strong> This toggle is for demonstration and testing purposes. 
                    In a production deployment, this would be replaced by a secure Login Screen.
                </p>
            </div>
        </div>
      )}
    </div>
  );
}