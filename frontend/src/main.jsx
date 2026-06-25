import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx'; // تأكد من وجود ./ قبل اسم الملف
import './index.css'; // تأكد من وجود ملف التنسيقات

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
