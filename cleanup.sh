#!/bin/bash
# إنشاء مجلد الأرشيف
mkdir -p archive

echo "جاري تنظيف المشروع..."

# نقل الملفات المبعثرة والنسخ الاحتياطية إلى الأرشيف
mv *.zip *.tgz *.html *.txt *.save *.sh.save archive/ 2>/dev/null
mv dist/* archive/ 2>/dev/null

# نقل المجلدات غير الضرورية (اختياري)
mv backup tests archive/ 2>/dev/null

echo "✅ تم التنظيف بنجاح! الملفات الآن في مجلد archive."
