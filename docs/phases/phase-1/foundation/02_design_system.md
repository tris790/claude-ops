# Work Item: Design System Implementation

**Feature**: Foundation
**Phase**: 1
**Priority**: Critical

## Objective
Implement the core design system and "Command Center" shell as defined in `docs/ux-guidelines.md`. This sets the visual tone (Sapphire Blue, Dark Mode) and provides the reusable components for the rest of the application.

## Requirements

### 1. Global Styles & Theme
- **Tailwind Config**: Extend the theme with custom colors:
  - `sapphire`: { 500: '#3B82F6', 600: '#2563EB' } (or standard Blue, ensuring strictly used).
  - `zinc`: Base grays (ensure 900/950 are used for backgrounds).
- **CSS Variables**: Define base layout variables (header height, sidebar width).
- **Font**: Implement Inter (UI) and JetBrains Mono (Code).

### 2. Core Components
Create the following "Atom" components in `src/frontend/components/ui/`:
- **Button**: Variants (Primary, Secondary, Ghost).
- **Input**: With focus ring (`ring-sapphire-600`), error state.
- **Card/Panel**: `bg-zinc-900` with `border-zinc-800`.
- **Badge/Tag**: For states (Active, Closed, etc.).
- **Spinner/Loader**: Thin blue progress bar (top of screen) + local skeletons.

### 3. Layout Shell ("Command Center")
Create `src/frontend/layouts/MainLayout.tsx`:
- **Sidebar**: Collapsible, sticky left (`w-[260px]`).
- **Main Stage**: Central content area (`max-w-7xl` or full).
- **Status Bar**: Bottom fixed bar (`h-6`).
- **Activity Bar**: Optional thin strip (left of sidebar).

## Tasks
1. Update `tailwind.config.js` with the palette.
2. Add fonts to `index.html` or import in CSS.
3. Build `Button.tsx`, `Input.tsx`, `Card.tsx`.
4. Build `MainLayout.tsx` and wrap the app in it.

## Verification
- Navigate to homepage.
- Verify "Sapphire Blue" aesthetics against UX guidelines.
- Verify Sidebar expands/collapses.
- Verify Dark Mode is the default.
