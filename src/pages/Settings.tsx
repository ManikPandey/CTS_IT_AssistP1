import React, { useEffect, useState } from 'react';
import { Shield, Database, History, Download, HardDrive } from 'lucide-react';

export default function Settings() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'data'

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
    const res = await window.api.backupDatabase();
    if (res.success) {
      alert(`Backup successful!\nSaved to: ${res.filePath}`);
      loadLogs(); // Reload logs to show the backup event
    } else if (res.error) {
      alert("Backup failed: " + res.error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-500">Manage security, data, and system logs</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'audit' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <History size={16} /> Audit Logs
          </div>
        </button>
        <button
          onClick={() => setActiveTab('data')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'data' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Database size={16} /> Data & Backup
          </div>
        </button>
      </div>

      {/* AUDIT LOG TAB */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-700">Recent Activity (Last 200)</h3>
            <button onClick={loadLogs} className="text-sm text-indigo-600 hover:underline">Refresh</button>
          </div>
          
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="p-3 font-semibold text-gray-600">Time</th>
                  <th className="p-3 font-semibold text-gray-600">Action</th>
                  <th className="p-3 font-semibold text-gray-600">Entity</th>
                  <th className="p-3 font-semibold text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-3 text-gray-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-gray-700">{log.entityType}</td>
                    <td className="p-3 text-gray-600">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <div className="p-8 text-center text-gray-500">No logs found.</div>}
          </div>
        </div>
      )}

      {/* DATA TAB */}
      {activeTab === 'data' && (
        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                <HardDrive size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Database Backup</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Create a full copy of your SQLite database file (`dev.db`). 
                  Save this file to an external drive or cloud storage periodically to prevent data loss.
                </p>
                <div className="mt-4">
                  <button onClick={handleBackup} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm">
                    <Download size={16} /> Backup Now
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 opacity-60">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-50 rounded-lg text-red-600">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Dangerous Zone</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Database reset and restoration features are locked in this version for safety.
                  Please contact the system administrator to perform a full restore.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}