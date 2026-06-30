import { useState } from 'react';

export default function LoginPage({ navigateTo, onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    setLoading(true);
    setError('');

    try {
      const BACKEND_URL = window.location.origin;
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim().toLowerCase().replace(/\s+/g, '_') })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('loggedOut');
        localStorage.setItem('token', data.token);
        localStorage.setItem('currentUser', data.currentUser);
        localStorage.setItem('activeProject', 'sandbox_app');
        onLoginSuccess(data.currentUser, data.token);
        navigateTo('dashboard');
      } else {
        setError('فشل تسجيل الدخول. حاول مجدداً.');
      }
    } catch (err) {
      setError('خطأ في الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-150px] right-[-150px] w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[130px] pointer-events-none"></div>
      <div className="absolute bottom-[-100px] left-[-100px] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>

      <div className="max-w-md w-full bg-[#0d121f]/85 border border-slate-800 p-8 rounded-3xl text-center shadow-2xl backdrop-blur-2xl relative z-10">
        <div className="text-5xl mb-5 animate-bounce">⚡</div>
        <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent">
          JAOLA OS
        </h2>
        <p className="text-[11px] text-slate-400 mb-8">أدخل اسم مستخدم واحد لجميع مشاريعك</p>

        {error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="اسم المستخدم..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500 text-center placeholder-slate-600"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-extrabold text-sm py-4 rounded-2xl hover:scale-[1.01] shadow-lg shadow-cyan-500/20 transition-all duration-300 disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'دخول المنصة 🚀'}
          </button>
        </form>

        <div className="mt-6 text-[10px] text-slate-600">
          لا يوجد حساب؟ سيتم إنشاؤه تلقائياً عند أول دخول
        </div>
      </div>
    </div>
  );
}
