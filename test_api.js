const http = require('http');

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/execute',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
};

const req = http.request(options, (res) => {
  res.on('data', (d) => process.stdout.write(d));
});

req.write(JSON.stringify({ mission: 'test' }));
req.end();
```eof

### 2. واجهة الشات البسيطة (No-Build Chat)
بدلاً من محاولة إصلاح الـ Dashboard المعقد الآن، سنضع هذا الملف في مجلد المشروع الأساسي ونفتحه مباشرة في المتصفح. إذا ظهرت نافذة الشات وعملت، فهذا يعني أن مشكلتنا كانت في الـ "Build process" وليس في السيرفر أو المنطق.

```html:simple_chat.html
<!DOCTYPE html>
<html>
<head><title>JAOLA OS - Minimal Chat</title></head>
<body style="background: #111; color: white; padding: 20px; font-family: sans-serif;">
    <h2>JAOLA Agent Chat</h2>
    <input id="input" style="width: 300px; padding: 10px;" placeholder="اطلب المهمة...">
    <button onclick="send()">إرسال</button>
    <div id="response" style="margin-top: 20px; padding: 10px; border: 1px solid #444;"></div>

    <script>
        async function send() {
            const mission = document.getElementById('input').value;
            const resDiv = document.getElementById('response');
            resDiv.innerText = "جاري الاتصال...";
            
            try {
                const response = await fetch('http://localhost:4000/api/execute', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ mission })
                });
                const data = await response.json();
                resDiv.innerText = "السيرفر رد: " + JSON.stringify(data);
            } catch (err) {
                resDiv.innerText = "خطأ: " + err.message;
            }
        }
    </script>
</body>
</html>
```eof

