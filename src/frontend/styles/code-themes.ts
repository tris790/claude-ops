import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

// --- Dark Theme (One Dark Pro / GitHub Dark Hybrid) ---
const darkColors = {
    background: "#09090b", // zinc-950 matching the app
    foreground: "#c9d1d9", // zinc-300ish
    caret: "#3b82f6", // blue-500
    selection: "#264f78",
    lineHighlight: "#212124", // zinc-800/something
    gutterBackground: "#09090b",
    gutterForeground: "#6e7681",
};

export const darkHighlightStyle = HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "#c678dd" }, // Purple
    { tag: [t.controlKeyword, t.moduleKeyword], color: "#c678dd" }, // Purple
    { tag: [t.name, t.deleted, t.character, t.macroName], color: "#ef596f" }, // Red
    { tag: [t.propertyName], color: "#d19a66" }, // Orange
    { tag: [t.variableName], color: "#e5c07b" }, // Yellow/Gold
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#61afef" }, // Blue
    { tag: [t.string, t.special(t.string)], color: "#98c379" }, // Green
    { tag: [t.number, t.bool, t.null], color: "#d19a66" }, // Orange
    { tag: [t.comment, t.quote], color: "#7f848e", fontStyle: "italic" }, // Grey
    { tag: [t.heading, t.typeName, t.className], color: "#e5c07b", fontWeight: "bold" },
    { tag: t.url, color: "#56b6c2", textDecoration: "underline" },
    { tag: [t.meta, t.annotation], color: "#c678dd" },
    { tag: [t.strong], fontWeight: "bold" },
    { tag: [t.emphasis], fontStyle: "italic" },
]);

export const darkThemeExtension = EditorView.theme({
    "&": {
        color: darkColors.foreground,
        backgroundColor: darkColors.background,
    },
    ".cm-content": {
        caretColor: darkColors.caret,
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: darkColors.caret,
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: darkColors.selection,
    },
    ".cm-activeLine": {
        backgroundColor: darkColors.lineHighlight,
    },
    ".cm-gutters": {
        backgroundColor: darkColors.gutterBackground,
        color: darkColors.gutterForeground,
        border: "none",
    },
    ".cm-activeLineGutter": {
        backgroundColor: darkColors.lineHighlight,
    },
}, { dark: true });


// --- Light Theme (GitHub Light / One Light Hybrid) ---
const lightColors = {
    background: "#ffffff",
    foreground: "#24292f",
    caret: "#0969da",
    selection: "#add6ff",
    lineHighlight: "#f6f8fa",
    gutterBackground: "#ffffff",
    gutterForeground: "#6e7781",
};

export const lightHighlightStyle = HighlightStyle.define([
    { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "#d73a49" }, // Red
    { tag: [t.controlKeyword, t.moduleKeyword], color: "#d73a49" }, // Red
    { tag: [t.name, t.deleted, t.character, t.macroName], color: "#005cc5" }, // Blue
    { tag: [t.propertyName], color: "#d73a49" }, // Red (often varies, going with GitHub styleish)
    { tag: [t.variableName], color: "#24292f" }, // Black
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#6f42c1" }, // Purple
    { tag: [t.string, t.special(t.string)], color: "#032f62" }, // Dark Blue
    { tag: [t.number, t.bool, t.null], color: "#005cc5" }, // Blue
    { tag: [t.comment, t.quote], color: "#6a737d", fontStyle: "italic" }, // Grey
    { tag: [t.heading, t.typeName, t.className], color: "#6f42c1", fontWeight: "bold" }, // Purple
    { tag: t.url, color: "#032f62", textDecoration: "underline" },
    { tag: [t.meta, t.annotation], color: "#6f42c1" },
]);

export const lightThemeExtension = EditorView.theme({
    "&": {
        color: lightColors.foreground,
        backgroundColor: lightColors.background,
    },
    ".cm-content": {
        caretColor: lightColors.caret,
    },
    "&.cm-focused .cm-cursor": {
        borderLeftColor: lightColors.caret,
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
        backgroundColor: lightColors.selection,
    },
    ".cm-activeLine": {
        backgroundColor: lightColors.lineHighlight,
    },
    ".cm-gutters": {
        backgroundColor: lightColors.gutterBackground,
        color: lightColors.gutterForeground,
        border: "none",
    },
    ".cm-activeLineGutter": {
        backgroundColor: lightColors.lineHighlight,
    },
});

export const getEditorTheme = (isDark: boolean) => [
    isDark ? darkThemeExtension : lightThemeExtension,
    syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle),
];
