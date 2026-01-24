# UX Guidlines

## Design Philosophy

Claude-Ops must feel like a **precision-engineered instrument**—unapologetically technical yet beautifully refined. It should embody "Invisible Power": the interface recedes, highlighting the code and work items.

**Core Values:**
-   **Speed as a Feature:** Every interaction must feel instantaneous (under 100ms response).
-   **High Information Density:** Developers read code; they can handle dense execution, but it must be orderly.
-   **Visual Clarity:** Syntax highlighting and status indicators take precedence over decorative elements.

## Visual Identity

### Color Palette

**Primary Accent: Sapphire Blue**
-   **Usage:** Primary buttons, active states, focus rings, key loading indicators.
-   **Reference:** Tailwind `blue-600` (`#2563EB`) for light/default, `blue-500` (`#3B82F6`) for dark mode elements requiring higher contrast.
-   **Why:** It is sharp, modern, and trustworthy without being corporate-boring or "default bootstrap."

**Secondary Accents:**
-   **Red/Rose:** Destructive actions and blocking errors.
-   **Amber:** Warnings and "Draft" states.

**Neutrals (The "Stage"):**
-   **Backgrounds:** Rich, deep charcoals ex: `zinc-900` (`#18181b`) and `zinc-950` (`#09090b`). **Never pure black (`#000000`)**.
-   **Surface:** Softened dark grays `zinc-800/50` for cards and panels.
-   **Borders:** Subtle separation `white/10` or `zinc-800`.

**Avoid:**
-   Claude-style Orange/Beige (confuses brand).
-   Gemini/Google Teal (too distinctively Google).
-   Purple

### Theme Support
-   **Dark Mode First:** Designed primarily for dark mode. Light mode is a secondary citizen but fully supported.

## Typography

-   **UI Font:** Inter, Roboto, or system sans-serif. Legible at small sizes (11px-13px).
-   **Code Font:** JetBrains Mono (preferred), Fira Code, or generic monospace. **Must support ligatures.**
-   **Weights:** Use weight to denote hierarchy, not just size. Bold for headings, Semibold for active items, Regular for body.

## Layout & Spatial System

### The "Command Center" Layout
The app is framed by a stable, predictable shell.

1.  **Sidebar (Left):**
    -   Width: Collapsible, default ~260px.
    -   Content: Navigation tree (Project > Repos).
    -   Behavior: Sticky, independent scroll.
2.  **Activity Bar (optional):**
    -   Thin strip for high-level context switching (Repos, PRs, Pipelines).
3.  **Main Stage (Center):**
    -   Where the work happens.
    -   Maximum width constraint for readability (e.g., `max-w-7xl` centered) but allows full-width for diffs/logs.
4.  **Status Bar (Bottom):**
    -   Height: ~24px.
    -   Content: Connection status, current branch, quick actions.

### Spacing (Tailwind Scale)
-   **Tight:** `gap-1` (4px) or `gap-2` (8px) for related items (icons + text).
-   **Structure:** `p-4` (16px) or `p-6` (24px) for container padding.
-   **Separation:** `my-8` (32px) to distinct major sections.

## Component Guidelines

### Buttons
-   **Primary:** Solid Sapphire Blue background. White text. Subtle hover lift or brightness boost.
    -   `bg-blue-600 hover:bg-blue-500 text-white rounded-md px-3 py-1.5 font-medium shadow-sm transition-all`
-   **Secondary:** Transparent/Outline. Zinc border.
    -   `border border-zinc-700 hover:bg-zinc-800 text-zinc-300`
-   **Ghost:** Text only, background on hover. Used for list actions.
    -   `text-zinc-400 hover:text-white hover:bg-zinc-800/50`

### Inputs & Forms
-   **Style:** Minimalist, no heavy borders.
-   **Background:** Darker than the page background (`bg-zinc-950` on a `zinc-900` page).
-   **Focus:** Sharp Sapphire Blue ring (`ring-2 ring-blue-600/50`).
-   **Validation:** Inline, immediate. Red text helper below input.

### Lists & Tables
-   **Density:** Compact. 32px-40px row height.
-   **Hover:** Highlight entire row with `bg-white/5`.
-   **Separators:** Minimal or no border between rows; use alignment.
-   **Virtualization:** Mandatory for lists > 100 items.

### Panels & Cards
-   **Appearance:** Flat or subtle border. `bg-zinc-900` border `zinc-800`.
-   **Glassmorphism:** Use sparingly. Maybe for floating headers or the Command Palette.
    -   `backdrop-blur-md bg-zinc-900/80`

## Interaction Patterns

### Command Palette (The Heart)
-   **Design:** Floating modal, centered top-third. Large input text. Use icons to distinguish types (File, PR, Work Item).
-   **Behavior:** Immediate appearance. Zero lag.

### Feedback & States
-   **Loading:**
    -   **Global:** Thin blue progress bar at the very top of the window (GitHub style).
    -   **Local:** Skeleton screens (pulsing gray blocks) matching text line-heights.
    -   **Avoid:** Full-screen spinners.
-   **Empty States:**
    -   Don't just say "No items".
    -   Provide a call to action: "No PRs found. *Create one?*"
    -   Use a subtle, desaturated illustration.

### Transitions
-   **Duration:** Fast. 100ms-150ms.
-   **Easing:** `ease-out`.
-   **Properties:** Opacity and Transform (scale 0.98 -> 1.00).
-   **Touch:** All clickable elements must have a visual feedback state (:active).

## Accessibility
-   **Keyboard First:** Every single action must be doable without a mouse.
-   **Focus Indicators:** High contrast, usually Blue ring. Never suppress outline without providing an alternative.
-   **Contrast:** Text `zinc-400` minimum on dark backgrounds. Primary actions `white` on Blue.

## Anti-Patterns
-   **Scrolljacking:** Never mess with native scroll.
-   **Modals on Modals:** Maximum 1 level of modal depth.
-   **Mystery Meat Navigation:** All icons must have tooltips.
-   **Confirm Shaming:** "Are you sure you want to be unproductive?" -> Don't do this.

