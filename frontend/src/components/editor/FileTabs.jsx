import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useJaolaStore } from '../../store/useJaolaStore.js';
import { useI18n } from '../../i18n.js';

const getFileIcon = (filename = '') => {
  if (/\.(tsx|ts)$/.test(filename)) return '🔷';
  if (/\.(jsx|js|mjs)$/.test(filename)) return '🟨';
  if (/\.(css|scss)$/.test(filename)) return '🎨';
  if (filename.endsWith('.html')) return '🧡';
  if (filename.endsWith('.json')) return '📋';
  if (filename.endsWith('.md')) return '📝';
  return '📄';
};

export function FileTabs({ files, activePath, onClose }) {
  const setActive = useJaolaStore((s) => s.openFile);
  const t = useI18n((s) => s.t);

  return (
    <div className="h-10 bg-[#0B0D14] border-b border-white/5 flex items-center overflow-x-auto flex-shrink-0">
      <div className="flex items-center h-full">
        {files.map((file) => {
          const isActive = file.path === activePath;
          const filename = file.path.split('/').pop();

          return (
            <div
              key={file.path}
              onClick={() => setActive(file.path)}
              className={`group relative h-full min-w-[120px] max-w-[200px] px-3 flex items-center gap-2 cursor-pointer
                border-t-2 select-none transition-colors hover:bg-white/5
                ${isActive ? 'bg-[#0F1117] border-t-blue-500 text-gray-200' : 'border-t-transparent text-gray-500'}`}
            >
              <span className="text-xs flex-shrink-0">{getFileIcon(filename)}</span>
              <span className="text-xs font-medium truncate flex-1" dir="ltr">{filename}</span>

              {file.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" title={t('unsavedTooltip')} />
              )}

              <button
                onClick={(e) => { e.stopPropagation(); onClose(file.path); }}
                className={`p-0.5 rounded-md hover:bg-white/10 transition-all
                  ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                title={t('closeTooltip')}
              >
                <X className="w-3 h-3" />
              </button>

              {isActive && (
                <motion.div
                  layoutId="jaolaActiveTab"
                  className="absolute inset-x-0 top-0 h-[1px] bg-blue-500/50 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
