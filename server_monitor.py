import time
import psutil # مكتبة لمراقبة موارد النظام

def monitor_server(interval=5):
    """
    أداة لمراقبة حالة السيرفر واستهلاك الموارد.
    interval: الفاصل الزمني بين كل فحص (بالثواني).
    """
    print("--- بدأ مراقبة السيرفر ---")
    try:
        while True:
            # الحصول على استهلاك المعالج
            cpu_usage = psutil.cpu_percent(interval=1)
            # الحصول على استهلاك الذاكرة
            memory_info = psutil.virtual_memory()
            
            print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}]")
            print(f"استهلاك المعالج (CPU): {cpu_usage}%")
            print(f"استهلاك الذاكرة (RAM): {memory_info.percent}% (المستخدم: {memory_info.used // (1024**2)} MB)")
            print("-" * 30)
            
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nتم إيقاف المراقبة من قبل المستخدم.")

if __name__ == "__main__":
    # تشغيل الأداة
    monitor_server()
