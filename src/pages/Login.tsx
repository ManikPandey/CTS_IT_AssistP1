import React, { useState } from 'react';
import { useUser } from '@/context/UserContext';
import { Shield, User, Lock, Key, LogIn, Save } from 'lucide-react';

export default function Login() {
  const { login, isInitialized, checkInitialization } = useUser();
  const [isSignup, setIsSignup] = useState(!isInitialized);
  
  const [form, setForm] = useState({ username: '', password: '', name: '' });
  const [error, setError] = useState('');

  // If not initialized, force signup mode
  React.useEffect(() => {
    if (!isInitialized) setIsSignup(true);
  }, [isInitialized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignup) {
      // First Run / Setup Logic
      const res = await window.api.register({ ...form, role: 'ADMIN' });
      if (res.success) {
        login(res.user);
        checkInitialization(); // Update init state
      } else {
        setError(res.error || 'Setup failed');
      }
    } else {
      // Login Logic
      const res = await window.api.login(form);
      if (res.success) {
        login(res.user);
      } else {
        setError(res.error || 'Login failed');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-600 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Shield className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">IT Asset Manager</h1>
          <p className="text-indigo-200 text-sm mt-1">Enterprise Edition</p>
        </div>

        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">
            {isSignup ? "System Setup" : "Welcome Back"}
          </h2>
          
          {isSignup && (
             <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded text-sm text-blue-700">
               <strong>First Run:</strong> Create your Administrator account to initialize the system.
             </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input 
                    className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="Admin Name"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    required={isSignup}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="username"
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="password"
                  className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  required
                />
              </div>
            </div>

            {error && <div className="text-red-500 text-sm text-center">{error}</div>}

            <button className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
              {isSignup ? <><Save size={18}/> Initialize System</> : <><LogIn size={18}/> Login</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}