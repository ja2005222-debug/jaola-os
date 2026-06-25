let currentFilePath = '';

function addLog(msg) {
    const logDiv = document.getElementById('logArea');
    const p = document.createElement('div');
    p.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logDiv.appendChild(p);
    logDiv.scrollTop = logDiv.scrollHeight;
}

document.getElementById('btnLoadFiles').onclick = async () => {
    addLog('جاري تحميل قائمة الملفات...');
    const res = await fetch('/api/ls');
    const data = await res.json();
    if (data.files) {
        const ul = document.getElementById('fileList');
        ul.innerHTML = '';
        data.files.forEach(file => {
            const li = document.createElement('li');
            li.className = 'cursor-pointer hover:bg-gray-200 p-1 border-b';
            li.textContent = file.replace(process.env.JAOLA_PATH || '', '');
            li.onclick = () => loadFile(file);
            ul.appendChild(li);
        });
        addLog(`تم تحميل ${data.files.length} ملف`);
    }
};

async function loadFile(fullPath) {
    currentFilePath = fullPath;
    document.getElementById('selectedFilePath').value = fullPath;
    addLog(`تحميل الملف: ${fullPath}`);
    const res = await fetch(`/api/file?path=${encodeURIComponent(fullPath)}`);
    const data = await res.json();
    if (data.content) {
        document.getElementById('editor').value = data.content;
    } else {
        addLog(`خطأ: ${data.error}`);
    }
}

document.getElementById('btnSaveFile').onclick = async () => {
    if (!currentFilePath) return addLog('اختر ملفاً أولاً');
    const content = document.getElementById('editor').value;
    addLog(`حفظ التغييرات في ${currentFilePath}...`);
    const res = await fetch('/api/file', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ path: currentFilePath, content })
    });
    const data = await res.json();
    if (data.success) {
        addLog('✅ تم الحفظ بنجاح');
    } else {
        addLog(`❌ خطأ: ${data.error}`);
    }
};

document.getElementById('btnRefreshFile').onclick = () => {
    if (currentFilePath) loadFile(currentFilePath);
};

document.getElementById('btnBuild').onclick = async () => {
    addLog('🔨 بدء البناء المحلي...');
    const res = await fetch('/api/build', { method: 'POST' });
    const data = await res.json();
    if (data.stdout) addLog(`Build output: ${data.stdout}`);
    if (data.stderr) addLog(`Errors: ${data.stderr}`);
    addLog('✅ اكتمل البناء');
};

document.getElementById('btnDeploy').onclick = async () => {
    addLog('🚀 بدء النشر على Vercel...');
    const res = await fetch('/api/deploy', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
        addLog(`✅ النشر ناجح: ${data.output}`);
    } else {
        addLog(`❌ فشل النشر: ${data.error}`);
    }
};
