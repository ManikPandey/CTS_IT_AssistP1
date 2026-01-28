import React, { useEffect, useState } from 'react';
import { Shield, Database, History, Download, HardDrive, User, UserPlus, LogOut, Trash2, Key } from 'lucide-react';
import { useUser } from '@/context/UserContext';

// Simple Modal for Password Reset
function PasswordModal({ isOpen, onClose, username, onSubmit }: any) {
    const [pwd, setPwd] = useState('');
    
    useEffect(() => {
        if (isOpen) setPwd('');
    }, [isOpen]);

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold mb-4">Reset Password</h3>
                <p className="text-sm text-gray-500 mb-4">Enter new password for <strong>{username}</strong></p>
                <input 
                    type="password"
                    autoFocus
                    className="w-full p-2 border rounded mb-4"
                    placeholder="New Password"
                    value={pwd}
                    onChange={e => setPwd(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 border rounded text-gray-700">Cancel</button>
                    <button onClick={() => onSubmit(pwd)} disabled={!pwd} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
                </div>
            </div>
        </div>
    );
}

export default function Settings() {
  const [logs, setLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'data' | 'users'
  
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'USER' });
  const [resetModal, setResetModal] = useState<{ id: string, username: string } | null>(null);

  const { user, isAdmin, logout } = useUser();

  const loadData = async () => {
    setLoading(true);
    if (activeTab === 'audit') {
        const res = await window.api.getAuditLogs();
        if (res.success) setLogs(res.data || []);
    }
    if (activeTab === 'users' && isAdmin) {
        const res = await window.api.getUsers();
        if (res.success) setUsers(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const handleBackup = async () => {
    if (!isAdmin) return alert("Access Denied");
    const res = await window.api.backupDatabase();
    if (res.success) { alert(`Saved to: ${res.filePath}`); loadData(); } 
    else alert(res.error);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return alert("Fill all fields");
    
    const res = await window.api.register(newUser);
    if (res.success) {
        alert("User Created!");
        setNewUser({ name: '', username: '', password: '', role: 'USER' });
        loadData();
    } else {
        alert(res.error);
    }
  };

  const handlePasswordReset = async (newPassword: string) => {
      if (!resetModal) return;
      const res = await window.api.changePassword({ userId: resetModal.id, newPassword });
      if (res.success) {
          alert("Password updated successfully!");
          setResetModal(null);
      } else {
          alert("Error: " + res.error);
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
            <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
            <p className="text-gray-500">Manage security, data, and system logs</p>
        </div>
        <div className="flex items-center gap-4">
            <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500 uppercase">{user?.role}</p>
            </div>
            <button onClick={logout} className="p-2 bg-red-50 text-red-600 rounded hover:bg-red-100" title="Logout">
                <LogOut size={18} />
            </button>
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
        {isAdmin && (
            <button onClick={() => setActiveTab('users')} className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <div className="flex items-center gap-2"><User size={16} /> Users</div>
            </button>
        )}
      </div>

      {/* AUDIT LOG TAB */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-auto max-h-[500px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0 border-b"><tr><th className="p-3 font-medium text-gray-500">Time</th><th className="p-3 font-medium text-gray-500">Action</th><th className="p-3 font-medium text-gray-500">Details</th></tr></thead>
              <tbody className="divide-y">
                  {loading && <tr><td colSpan={3} className="p-4 text-center">Loading logs...</td></tr>}
                  {!loading && logs.map((log) => (<tr key={log.id} className="hover:bg-gray-50"><td className="p-3 text-gray-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td><td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${log.action === 'CREATE' ? 'bg-green-100 text-green-800' : log.action === 'DELETE' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{log.action}</span></td><td className="p-3 text-gray-600">{log.details}</td></tr>))}
                  {!loading && logs.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-500">No logs found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DATA TAB */}
      {activeTab === 'data' && (
        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
             <div className="flex items-center gap-4"><div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><HardDrive size={24} /></div><div><h3 className="font-bold">Database Backup</h3><p className="text-sm text-gray-500">Save a copy of your data (SQLite .db file).</p></div></div>
             {isAdmin ? <button onClick={handleBackup} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex gap-2"><Download size={16}/> Backup</button> : <span className="text-red-500 text-sm">Admin only</span>}
          </div>
        </div>
      )}

      {/* USERS TAB (Admin Only) */}
      {activeTab === 'users' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User List */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b"><tr><th className="p-3 font-medium text-gray-500">Name</th><th className="p-3 font-medium text-gray-500">Username</th><th className="p-3 font-medium text-gray-500">Role</th><th className="p-3 font-medium text-gray-500">Created</th><th className="p-3 font-medium text-gray-500 text-right">Actions</th></tr></thead>
                    <tbody className="divide-y">
                        {users.map(u => (
                            <tr key={u.id}>
                                <td className="p-3 font-medium">{u.name}</td>
                                <td className="p-3 text-gray-500">{u.username}</td>
                                <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role==='ADMIN'?'bg-purple-100 text-purple-700':'bg-gray-100 text-gray-700'}`}>{u.role}</span></td>
                                <td className="p-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                                <td className="p-3 text-right">
                                    <button 
                                        onClick={() => setResetModal({ id: u.id, username: u.username })} 
                                        className="text-orange-600 hover:bg-orange-50 p-1.5 rounded transition-colors" 
                                        title="Reset Password"
                                    >
                                        <Key size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create User Form */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><UserPlus size={18}/> Add User</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Full Name</label><input className="w-full p-2 border rounded mt-1" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} required /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Username</label><input className="w-full p-2 border rounded mt-1" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Password</label><input type="password" className="w-full p-2 border rounded mt-1" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Role</label><select className="w-full p-2 border rounded mt-1" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}><option value="USER">User (View Only)</option><option value="ADMIN">Admin (Full Access)</option></select></div>
                    <button className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold mt-2 transition-colors">Create Account</button>
                </form>
            </div>
        </div>
      )}

      {/* Password Reset Modal */}
      <PasswordModal 
        isOpen={!!resetModal} 
        username={resetModal?.username}
        onClose={() => setResetModal(null)}
        onSubmit={handlePasswordReset}
      />
    </div>
  );
}