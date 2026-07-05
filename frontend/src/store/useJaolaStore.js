import { create } from 'zustand';
import { BACKEND_URL } from '../config.js';

// Controllers خارج الـ state — إلغاء جلب لكل ملف على حدة بدون re-render
const fetchControllers = new Map(); // path -> AbortController

const getLanguage = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = {
    js: 'javascript', mjs: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    html: 'html', htm: 'html', css: 'css', scss: 'scss',
    json: 'json', py: 'python', md: 'markdown',
    sql: 'sql', sh: 'shell', yaml: 'yaml', yml: 'yaml', prisma: 'prisma',
  };
  return map[ext] || 'plaintext';
};

export const useJaolaStore = create((set, get) => ({
  // ── سياق الجلسة (يُزامَن من Dashboard) ──────────────────────────
  token: '',
  project: 'sandbox_app',

  setContext: ({ token, project }) => {
    const prev = get();
    // تغيير المشروع يغلق كل التابات المفتوحة (ملفات مشروع آخر)
    if (project && project !== prev.project) {
      fetchControllers.forEach(c => c.abort());
      fetchControllers.clear();
      set({ token: token ?? prev.token, project, openFiles: [], activeFilePath: null });
      return;
    }
    set({ token: token ?? prev.token, project: project ?? prev.project });
  },

  // ── حالة المحرر ──────────────────────────────────────────────────
  openFiles: [],        // [{ path, content, language, isDirty, isLoading, isSaving }]
  activeFilePath: null,

  openFile: async (filePath) => {
    const { openFiles, token, project } = get();

    // مفتوح مسبقاً؟ فعّله فقط
    if (openFiles.some(f => f.path === filePath)) {
      set({ activeFilePath: filePath });
      return;
    }

    // إلغاء جلب سابق لنفس الملف فقط (وليس كل الملفات)
    fetchControllers.get(filePath)?.abort();
    const controller = new AbortController();
    fetchControllers.set(filePath, controller);

    set((state) => ({
      openFiles: [...state.openFiles, {
        path: filePath, content: '', language: getLanguage(filePath),
        isDirty: false, isLoading: true, isSaving: false,
      }],
      activeFilePath: filePath,
    }));

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/file-content?fileName=${encodeURIComponent(filePath)}&project=${encodeURIComponent(project)}`,
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
      );
      if (!res.ok) throw new Error(`فشل جلب الملف (${res.status})`);
      const { content } = await res.json();

      set((state) => ({
        openFiles: state.openFiles.map(f =>
          f.path === filePath ? { ...f, content: content ?? '', isLoading: false, isDirty: false } : f
        ),
      }));
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('File fetch error:', err);
      // إزالة التاب الفاشل — نحسب التاب النشط الجديد من الحالة الحالية وليس القديمة
      set((state) => {
        const remaining = state.openFiles.filter(f => f.path !== filePath);
        return {
          openFiles: remaining,
          activeFilePath: state.activeFilePath === filePath
            ? (remaining[remaining.length - 1]?.path || null)
            : state.activeFilePath,
        };
      });
    } finally {
      if (fetchControllers.get(filePath) === controller) fetchControllers.delete(filePath);
    }
  },

  closeFile: (filePath) => {
    fetchControllers.get(filePath)?.abort();
    set((state) => {
      const remaining = state.openFiles.filter(f => f.path !== filePath);
      return {
        openFiles: remaining,
        activeFilePath: state.activeFilePath === filePath
          ? (remaining[remaining.length - 1]?.path || null)
          : state.activeFilePath,
      };
    });
  },

  updateFileContent: (filePath, content) => set((state) => ({
    openFiles: state.openFiles.map(f =>
      f.path === filePath ? { ...f, content, isDirty: true } : f
    ),
  })),

  saveFile: async (filePath) => {
    const { openFiles, token, project } = get();
    const file = openFiles.find(f => f.path === filePath);
    if (!file || !file.isDirty || file.isSaving) return { success: false };

    set((state) => ({
      openFiles: state.openFiles.map(f => f.path === filePath ? { ...f, isSaving: true } : f),
    }));

    try {
      const res = await fetch(`${BACKEND_URL}/api/file-content/save`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: filePath, content: file.content, project }),
      });
      const ok = res.ok;
      set((state) => ({
        openFiles: state.openFiles.map(f =>
          f.path === filePath ? { ...f, isSaving: false, isDirty: ok ? false : f.isDirty } : f
        ),
      }));
      return { success: ok };
    } catch (err) {
      console.error('Save failed:', err);
      set((state) => ({
        openFiles: state.openFiles.map(f => f.path === filePath ? { ...f, isSaving: false } : f),
      }));
      return { success: false };
    }
  },

  resetWorkspace: () => {
    fetchControllers.forEach(c => c.abort());
    fetchControllers.clear();
    set({ openFiles: [], activeFilePath: null });
  },
}));
