#!/bin/bash

# JAOLA OS - سكربت تثبيت وتوزيع الملفات
echo "جاري تجهيز هيكلية JAOLA OS..."

# إنشاء المجلدات الأساسية
mkdir -p backend/agents backend/services backend/websocket backend/utils scripts

# إنشاء ملفات الـ Backend
touch backend/server.js
touch backend/services/db.js
touch backend/services/orchestrator.js
touch backend/services/taskQueue.js
touch backend/agents/planner.agent.js
touch backend/agents/architect.agent.js
touch backend/agents/coder.agent.js
touch backend/agents/reviewer.agent.js
touch backend/agents/qa.agent.js
touch backend/agents/deployer.agent.js
touch backend/agents/educator.agent.js
touch backend/agents/agentFactory.js
touch backend/websocket/socketManager.js
touch backend/utils/aiProvider.js

# إنشاء ملف الواجهة
touch App.jsx

# إعداد ملف التبعات
echo '{
  "name": "jaola-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.13.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "better-sqlite3": "^8.4.0",
    "node-fetch": "^3.3.1"
  }
}' > backend/package.json

echo "تم إنشاء المجلدات والملفات بنجاح!"
echo "الخطوة التالية: قم بتثبيت التبعات عبر الأمر: cd backend && npm install"
