import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TimeMachineComponent = () => {
  const [history, setHistory] = useState([]);

  // جلب قائمة النسخ عند تحميل المكون
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const res = await axios.get('http://localhost:3000/api/history');
    setHistory(res.files);
  };

  const restoreVersion = async (fileName) => {
    await axios.post('http://localhost:3000/api/history/restore', { fileName });
    alert("تمت العودة بالزمن بنجاح! سيتم تحديث الصفحة.");
    window.location.reload();
  };

  return (
    <div className="time-machine-panel">
      <h3>⏳ Time Machine</h3>
      <ul>
        {history.map((file) => (
          <li key={file}>
            {file} 
            <button onClick={() => restoreVersion(file)}>استعادة</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TimeMachineComponent;
