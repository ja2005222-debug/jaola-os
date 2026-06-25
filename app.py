from flask import Flask, render_template
import os

# تهيئة التطبيق مع تحديد مسار القوالب
app = Flask(__name__, template_folder='templates')

@app.route('/')
def home():
    """
    الصفحة الرئيسية لنظام جولا
    تأكد من وجود ملف index.html داخل مجلد templates
    """
    try:
        return render_template('index.html')
    except Exception as e:
        return f"حدث خطأ في تحميل الصفحة: {str(e)}", 500

if __name__ == '__main__':
    # التأكد من تشغيل السيرفر على جميع الواجهات
    app.run(debug=True, port=5000)
