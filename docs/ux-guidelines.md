# UX Guidelines

## Design Philosophy

Claude-Ops should feel like a **premium developer tool** - fast, focused, and visually refined. The UI should get out of the way while providing powerful capabilities.

## Visual Identity

### Color Palette

**Avoid:**
- Purple (too common, Azure DevOps association)
- Claude-style orange/warm beige
- Gemini-style blue/teal
- Generic "AI product" gradients

**Recommended Direction:**
- Deep, rich backgrounds (not pure black)
- High-contrast syntax highlighting
- Accent color TBD (consider: emerald, amber, cyan, or warm neutral)
- Subtle gradients for depth, not decoration

### Theme Support

- **Dark Mode**: Default, primary design target
- **Light Mode**: Available via toggle, fully supported

## Typography

- Clean, modern sans-serif for UI
- Monospace for code (consider: JetBrains Mono, Fira Code, or similar)
- Clear hierarchy with size and weight

## Layout Principles

### Information Density
- Developers prefer information density over whitespace
- Balance readability with efficiency
- Collapsible panels for optional context

### Navigation
- Command palette as primary navigation method
- Minimal click depth to common actions
- Breadcrumbs for context awareness

### Responsive Behavior
- Optimized for large screens (developers typically use wide monitors)
- Minimum viable width: 1024px
- Panels resize gracefully

## Interaction Patterns

### Command Palette
- Opens with Ctrl+K or Ctrl+P
- Fuzzy search across all entity types
- Recent items shown by default
- Type-ahead filtering
- Keyboard navigation (up/down arrows, enter to select)

### Keyboard Shortcuts
- Standard shortcuts only (no vim-style in v1)
- Arrow keys for list navigation
- Tab for focus movement
- Enter to confirm/open
- Escape to close/cancel

### Real-time Updates
- In-view content updates automatically
- Subtle visual indicator when content refreshes
- No disruptive notifications or toasts
- Loading states should be unobtrusive

### Forms & Inputs
- Markdown preview for text areas (comments, descriptions)
- @mention autocomplete with avatar + name
- Inline validation
- Clear error states

## Component Guidelines

### Lists & Tables
- Sortable columns
- Filterable content
- Infinite scroll or pagination (TBD)
- Row hover states
- Quick actions on hover

### Code Display
- Syntax highlighting (language-aware)
- Line numbers
- Clickable line numbers for sharing
- Diff view with side-by-side option
- Blame annotations

### Status Indicators
- Pipeline status: Clear iconography (running, success, failed, cancelled)
- PR status: Approved, needs work, draft, merged
- Work item states: Visual color coding

## Animation & Transitions

- Subtle, fast transitions (150-200ms)
- No gratuitous animation
- Loading skeletons over spinners where appropriate
- Smooth scroll behavior

## Accessibility Considerations

- Keyboard navigable
- Sufficient color contrast
- Focus indicators
- Screen reader compatible labels (stretch goal)

## Anti-Patterns to Avoid

- Modal overload (prefer inline editing)
- Deep navigation hierarchies
- Forced workflows
- Unnecessary confirmation dialogs
- Auto-playing anything
- Tooltip overload
