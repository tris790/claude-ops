import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

let highlighter: HighlighterCore | null = null;

export async function getHighlighter() {
    if (highlighter) return highlighter;
    highlighter = await createHighlighterCore({
        themes: [
            import('shiki/themes/github-dark.mjs'),
            import('shiki/themes/github-light.mjs'),
        ],
        langs: [
            import('shiki/langs/typescript.mjs'),
            import('shiki/langs/javascript.mjs'),
            import('shiki/langs/go.mjs'),
            import('shiki/langs/python.mjs'),
            import('shiki/langs/json.mjs'),
            import('shiki/langs/bash.mjs'),
            import('shiki/langs/markdown.mjs'),
            import('shiki/langs/csharp.mjs'),
            import('shiki/langs/cpp.mjs'),
            import('shiki/langs/html.mjs'),
            import('shiki/langs/css.mjs'),
        ],
        engine: createJavaScriptRegexEngine(),
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
