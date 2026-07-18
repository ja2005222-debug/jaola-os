import React, { useState } from 'react';

export default function AuthScreen({ onLogin }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // استدعاء دالة تسجيل الدخول الممررة من الـ hooks
      await onLogin(token);
    } catch (err) {
      setError(err.message || 'فشل تسجيل الدخول. تأكد من رمز الوصول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030508] flex items-center justify-center relative overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* خلفية متحركة وإضاءة (Glow Effects) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50">
        
        {/* الشعار والعنوان */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(59,130,246,0.4)] mb-4 animate-pulse">
            ⚡
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">JAOLA OS</h1>
          <p className="text-slate-400 mt-2 text-sm uppercase tracking-widest font-semibold">Mission Control Login</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-slate-950/50 border border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-600"
              placeholder="••••••••••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Initialize System</span>
                <span className="text-xl">🚀</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          Powered by JCR v2.1 • Autonomous Intelligence
        </div>
      </div>
    </div>
  );
}
