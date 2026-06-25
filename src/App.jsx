import { useState } from 'react';
import axios from 'axios';

function App() {
  return (
    <div className="h-screen w-full bg-gray-900 text-white p-4">
      <h1 className="text-xl font-bold mb-4 text-blue-400">JAOLA OS - Live Development Cockpit</h1>
      
      <div className="grid grid-cols-2 grid-rows-3 gap-4 h-[90vh]">
        {/* AI Chat */}
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h2 className="text-xs font-bold uppercase text-gray-400 mb-2">AI Chat</h2>
          <textarea className="w-full h-32 bg-gray-950 p-2 border border-gray-700 rounded" placeholder="أمر الذكاء الاصطناعي..."></textarea>
          <button className="bg-blue-600 w-full mt-2 py-1 rounded">إرسال</button>
        </div>

        {/* Live Preview */}
        <div className="bg-white p-2 rounded border border-gray-700 row-span-2">
          <h2 className="text-xs font-bold uppercase text-gray-500 mb-2">Live Preview</h2>
          <iframe src="http://localhost:3000" className="w-full h-full" />
        </div>

        {/* Agent Stream */}
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h2 className="text-xs font-bold uppercase text-gray-400 mb-2">Agent Stream</h2>
          <div className="font-mono text-xs text-green-400 overflow-y-auto h-24">
            > جاري التحليل... <br /> > جاري الكتابة...
          </div>
        </div>

        {/* File Changes */}
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <h2 className="text-xs font-bold uppercase text-gray-400 mb-2">File Changes</h2>
          <ul className="text-xs text-gray-300">
            <li>+ app/page.js</li>
            <li>+ styles/globals.css</li>
          </ul>
        </div>

        {/* Digital Twin & Terminal */}
        <div className="bg-gray-800 p-4 rounded border border-gray-700 col-span-2 flex gap-4">
           <div className="w-1/2">
             <h2 className="text-xs font-bold uppercase text-gray-400">Digital Twin (Structure)</h2>
             {/* هنا سنعرض شجرة الملفات */}
           </div>
           <div className="w-1/2">
             <h2 className="text-xs font-bold uppercase text-gray-400">Terminal</h2>
             <div className="font-mono text-xs bg-black p-2 h-full text-white">
               $ npm run dev...
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
export default App;
