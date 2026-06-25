// src/components/CommandBar.jsx
const CommandBar = () => {
  const [input, setInput] = useState('');

  const sendCommand = async () => {
    const isFixRequest = input.includes("أصلح") || input.includes("خطأ");
    const endpoint = isFixRequest ? '/api/debugger' : '/api/coder';
    
    await axios.post(`http://localhost:3000${endpoint}`, { task: input });
  };

  return (
    <div className="p-4 bg-slate-800 border-t border-slate-700">
      <input 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full bg-slate-900 p-3 rounded text-white"
        placeholder="أعطِ أمراً لـ JAOLA OS (مثلاً: أصلح الصفحة، أو اصنع لوحة تحكم...)"
      />
      <button onClick={sendCommand} className="mt-2 bg-blue-600 px-4 py-2 rounded">تنفيذ الأمر</button>
    </div>
  );
};
