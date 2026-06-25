// src/components/Dashboard.jsx
const Dashboard = () => {
  return (
    <div className="flex h-screen bg-slate-900 text-white">
      {/* Sidebar - Control */}
      <aside className="w-64 bg-slate-800 p-6">
        <h1 className="text-2xl font-bold mb-8 text-blue-400">JAOLA OS</h1>
        <div className="space-y-4">
          <button className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded">تنشيط CEO Agent</button>
          <button className="w-full bg-slate-700 p-2 rounded">فتح الـ Marketplace</button>
          <button className="w-full bg-slate-700 p-2 rounded">سجل البيانات (BI)</button>
        </div>
      </aside>

      {/* Main Canvas - Workspace */}
      <main className="flex-1 p-6">
        <div className="bg-white text-black h-full rounded-xl shadow-2xl p-4">
          <h2 className="text-lg font-semibold mb-4">Workspace: Live Preview</h2>
          <iframe id="live-preview" src="http://localhost:3000/workspace/projects/default/index.html" className="w-full h-full border-none" />
        </div>
      </main>

      {/* Right Panel - Time Machine */}
      <aside className="w-72 bg-slate-800 p-6 overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">⏳ Time Machine</h3>
        {/* هنا سيتم عرض قائمة النسخ التي برمجناها */}
      </aside>
    </div>
  );
};
