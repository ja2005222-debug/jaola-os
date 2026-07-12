import { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Loader2 } from 'lucide-react';
import { useJaolaStore } from '../../store/useJaolaStore.js';
import { useI18n } from '../../i18n.js';
import { FileTabs } from './FileTabs.jsx';

export function MonacoWorkspace() {
  const openFiles = useJaolaStore((s) => s.openFiles);
  const activeFilePath = useJaolaStore((s) => s.activeFilePath);
  const updateFileContent = useJaolaStore((s) => s.updateFileContent);
  const saveFile = useJaolaStore((s) => s.saveFile);
  const closeFile = useJaolaStore((s) => s.closeFile);
  const t = useI18n((s) => s.t);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  const handleEditorChange = useCallback((value) => {
    // نقرأ المسار النشط من المتجر مباشرة لتفادي closure قديم
    const { activeFilePath: current } = useJaolaStore.getState();
    if (current && value !== undefined) updateFileContent(current, value);
  }, [updateFileContent]);

  const handleEditorMount = useCallback((editor, monaco) => {
    // ثيم داكن متوافق مع هوية JAOLA
    monaco.editor.defineTheme('jaolaDark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC' },
        { token: 'identifier', foreground: 'E2E8F0' },
        { token: 'string', foreground: '4ADE80' },
        { token: 'number', foreground: 'F472B6' },
        { token: 'tag', foreground: 'FCA5A5' },
        { token: 'attribute.name', foreground: '93C5FD' },
      ],
      colors: {
        'editor.background': '#0F1117',
        'editor.lineHighlightBackground': '#1A1D27',
        'editor.selectionBackground': '#312E81',
        'editor.inactiveSelectionBackground': '#1E1B4B',
        'editorLineNumber.foreground': '#4B5563',
        'editorLineNumber.activeForeground': '#9CA3AF',
        'editorGutter.background': '#0F1117',
      },
    });
    monaco.editor.setTheme('jaolaDark');

    editor.updateOptions({
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
      lineHeight: 22,
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      padding: { top: 16 },
      automaticLayout: true,
    });

    // Ctrl+S للحفظ — نقرأ الحالة من المتجر لحظة الضغط (وليس من closure قديم)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const { activeFilePath: current, saveFile: save } = useJaolaStore.getState();
      if (current) save(current);
    });
  }, []);

  if (openFiles.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0F1117] text-gray-500">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto border-2 border-dashed border-gray-700 rounded-xl flex items-center justify-center">
            <span className="text-2xl" dir="ltr">{'</>'}</span>
          </div>
          <p className="text-sm font-medium">{t('selectFile')}</p>
          <p className="text-xs text-gray-600">{t('orAskJaola')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0F1117] min-w-0">
      <FileTabs files={openFiles} activePath={activeFilePath} onClose={closeFile} />

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {activeFile?.isLoading ? (
            <motion.div
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-[#0F1117]"
            >
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key={activeFilePath || 'empty'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0"
            >
              <Editor
                height="100%"
                path={activeFile?.path}
                language={activeFile?.language || 'plaintext'}
                value={activeFile?.content ?? ''}
                onChange={handleEditorChange}
                onMount={handleEditorMount}
                loading={null}
                theme="vs-dark"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* مؤشر تغييرات غير محفوظة */}
        {activeFile?.isDirty && !activeFile?.isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => saveFile(activeFilePath)}
            className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-blue-600/90 backdrop-blur-sm text-white text-xs rounded-lg shadow-lg cursor-pointer hover:bg-blue-500 z-10"
          >
            {activeFile.isSaving
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Save className="w-3 h-3" />}
            <span>{activeFile.isSaving ? t('savingFile') : t('unsavedChanges')}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
