import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'typescript' || label === 'javascript') {
            return new tsWorker();
        }
        return new editorWorker();
    }
};

let editors = new Map(); // filePath -> editor instance
let activeEditor = null;

export function createEditor(container, options = {}) {
    const editor = monaco.editor.create(container, {
        value: options.value || '',
        language: options.language || 'typescript',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 13,
        minimap: { enabled: false },
        ...options
    });
    return editor;
}

export function setEditorContent(editor, content) {
    editor.setValue(content);
}

export function getEditorContent(editor) {
    return editor.getValue();
}

export function setLanguage(editor, language) {
    const model = editor.getModel();
    monaco.editor.setModelLanguage(model, language);
}

export function registerEditor(filePath, editor, projectPath) {
    editors.set(filePath, { editor, projectPath });
    activeEditor = editor;
}

export function getActiveEditor() {
    return activeEditor;
}

export function getAllEditors() {
    return Array.from(editors.entries());
}
