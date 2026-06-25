export interface EditCommand {
  type: 'changeColor' | 'addElement' | 'fixButton' | 'unknown';
  targetFile: string;
  description: string;
  newCode?: string;
}

export function parseEditCommand(userMessage: string, currentFiles: string[]): EditCommand {
  const lower = userMessage.toLowerCase();
  // قاعدة بسيطة: إذا ذكر "لون الخلفية" أو "background color"
  if (lower.includes('لون الخلفية') || lower.includes('background')) {
    return {
      type: 'changeColor',
      targetFile: findCssOrHtmlFile(currentFiles),
      description: userMessage,
    };
  }
  if (lower.includes('أضف زر') || lower.includes('add button')) {
    return {
      type: 'addElement',
      targetFile: findHtmlFile(currentFiles),
      description: userMessage,
    };
  }
  if (lower.includes('زر') && (lower.includes('لا يعمل') || lower.includes('fix'))) {
    return {
      type: 'fixButton',
      targetFile: findJsOrHtmlFile(currentFiles),
      description: userMessage,
    };
  }
  return { type: 'unknown', targetFile: '', description: userMessage };
}

function findCssOrHtmlFile(files: string[]): string {
  return files.find(f => f.endsWith('.css') || f.endsWith('.html') || f.endsWith('.jsx')) || files[0];
}
function findHtmlFile(files: string[]): string {
  return files.find(f => f.endsWith('.html') || f.endsWith('.jsx')) || files[0];
}
function findJsOrHtmlFile(files: string[]): string {
  return files.find(f => f.endsWith('.js') || f.endsWith('.html')) || files[0];
}
