import psutil
import time

def display_system_stats():
    """
    وظيفة لعرض إحصائيات النظام الأساسية باستخدام مكتبة psutil.
    """
    try:
        print("--- مراقبة نظام jaola-os ---")
        
        # الحصول على نسبة استخدام المعالج (CPU)
        cpu_usage = psutil.cpu_percent(interval=1)
        print(f"استخدام المعالج: {cpu_usage}%")
        
        # الحصول على معلومات الذاكرة (RAM)
        memory = psutil.virtual_memory()
        print(f"إجمالي الذاكرة: {memory.total / (1024**3):.2f} GB")
        print(f"الذاكرة المستخدمة: {memory.percent}%")
        
        # الحصول على حالة القرص الصلب
        disk = psutil.disk_usage('/')
        print(f"استخدام القرص: {disk.percent}%")
        
        print("----------------------------")
    except Exception as e:
        print(f"حدث خطأ أثناء قراءة بيانات النظام: {e}")

if __name__ == "__main__":
    # تشغيل المراقبة
    display_system_stats()
