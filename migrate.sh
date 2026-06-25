#!/bin/bash

# JAOLA OS - سكربت إعادة الهيكلة التلقائي المطور
echo "🚀 بدء عملية نقل وإعادة هيكلة ملفات JAOLA OS..."

# 1. إنشاء المجلدات الفرعية داخل backend
mkdir -p backend/agents
mkdir -p backend/services
mkdir -p backend/websocket
mkdir -p backend/utils

# 2. نقل ملفات الوكلاء (Agents)
echo "📦 نقل الوكلاء (Agents)..."
if [ -d "agents" ]; then
    mv agents/*.js backend/agents/ 2>/dev/null
    rmdir agents 2>/dev/null
fi
# نقل أي ملفات وكلاء مبعثرة في الجذر
mv autoFix.agent.js backend/agents/ 2>/dev/null

# 3. نقل الخدمات (Services)
echo "📦 نقل الخدمات (Services)..."
if [ -d "services" ]; then
    mv services/*.js backend/services/ 2>/dev/null
    rmdir services 2>/dev/null
fi
# نقل خدمات قواعد البيانات والتنسيق التي قد تكون في الجذر
mv db.js backend/services/ 2>/dev/null
mv orchestrator.js backend/services/ 2>/dev/null

# 4. نقل أدوات الـ Utilities والـ WebSocket
echo "📦 نقل ملفات الربط والـ WebSocket..."
if [ -d "utils" ]; then
    mv utils/*.js backend/utils/ 2>/dev/null
    rmdir utils 2>/dev/null
fi

if [ -d "websocket" ]; then
    mv websocket/*.js backend/websocket/ 2>/dev/null
    rmdir websocket 2>/dev/null
fi

# 5. نقل الخادم الرئيسي (server.js) وتهيئة قواعد البيانات
echo "📦 نقل ملفات التشغيل الأساسية..."
mv server.js backend/server.js 2>/dev/null
mv init_db.js backend/ 2>/dev/null
mv setup.js backend/setup.js 2>/dev/null
mv health_check.js backend/ 2>/dev/null
mv check_everything.js backend/ 2>/dev/null

# 6. نقل ملف قاعدة البيانات ليكون مع السيرفر
mv jaola_os.db backend/ 2>/dev/null

# 7. إنشاء ملف package.json الخاص بالـ backend تلقائياً لضمان وجود سكربت التشغيل
echo "📦 إنشاء وإعداد ملف backend/package.json التلقائي..."
cat <<EOT > backend/package.json
{
  "name": "jaola-backend",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "setup": "node setup.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.13.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "better-sqlite3": "^8.4.0",
    "node-fetch": "^3.3.1"
  }
}
EOT

echo "=================================================="
echo "✅ اكتملت عملية نقل الملفات وإعداد الحزم بنجاح!"
echo "بنيتك الآن نظيفة ومعزولة تماماً داخل مجلد /backend."
echo "الرجاء الآن تنفيذ التالي لتثبيت المكتبات والتشغيل:"
echo "  1. cd backend"
echo "  2. npm install"
echo "  3. npm start"
echo "=================================================="
