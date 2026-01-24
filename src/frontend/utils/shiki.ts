import { createHighlighter, type Highlighter } from 'shiki';

let highlighter: Highlighter | null = null;

export async function getHighlighter() {
    if (highlighter) return highlighter;
    highlighter = await createHighlighter({
        themes: ['github-dark', 'github-light'],
        langs: ['typescript', 'javascript', 'go', 'python', 'json', 'bash', 'markdown', 'csharp', 'cpp', 'html', 'css']
    });
    return highlighter;
}

export function highlightCode(code: string, lang: string, isDark: boolean = true) {
    if (!highlighter) return code;
    return highlighter.codeToHtml(code, {
        lang,
        theme: isDark ? 'github-dark' : 'github-light'
    });
}
