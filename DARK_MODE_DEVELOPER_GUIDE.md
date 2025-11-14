# Dark Mode Developer Guide

## Architecture Overview

The dark mode system uses **CSS variables** and **React Context** to provide theme switching across the entire application.

### Components

1. **Theme Context** (`src/hooks/ThemeContext.jsx`)
   - Centralized theme state management
   - Handles theme switching logic
   - Manages localStorage persistence

2. **Theme Toggle** (`src/components/ThemeToggle.jsx`)
   - UI component for theme switching
   - Located in sidebar footer
   - Displays moon/sun icon

3. **Design System** (`src/styles/theme.css`)
   - 150+ CSS variables
   - Light and dark mode color definitions
   - Typography, spacing, and shadow system

---

## CSS Variables System

### Variable Structure

```css
/* Light Mode (Default) */
:root {
  /* Background Colors */
  --bg-primary: #ffffff;        /* Main background */
  --bg-secondary: #f9fafb;      /* Secondary background */
  --bg-tertiary: #f3f4f6;       /* Tertiary background */
  --bg-hover: #f3f4f6;          /* Hover state background */
  
  /* Text Colors */
  --text-primary: #111827;      /* Main text */
  --text-secondary: #4b5563;    /* Secondary text */
  --text-tertiary: #6b7280;     /* Tertiary text */
  
  /* Component Specific */
  --sidebar-bg: #111827;
  --sidebar-text: #f9fafb;
  --header-bg: #ffffff;
  --card-bg: #ffffff;
  --input-bg: #ffffff;
}

/* Dark Mode Override */
[data-theme="dark"] {
  --bg-primary: #111827;
  --bg-secondary: #1f2937;
  --bg-tertiary: #374151;
  
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --text-tertiary: #9ca3af;
  
  --sidebar-bg: #030712;
  --sidebar-text: #f3f4f6;
  --header-bg: #1f2937;
  --card-bg: #1f2937;
  --input-bg: #1f2937;
}
```

---

## How to Add Dark Mode to New Components

### Step 1: Use CSS Variables

**❌ WRONG - Hardcoded colors:**
```jsx
<div className="text-neutral-900 bg-white">
  Content
</div>
```

**✅ RIGHT - CSS variables:**
```jsx
<div style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}>
  Content
</div>
```

### Step 2: Use Tailwind with Variables

**✅ Using Tailwind arbitrary values:**
```jsx
<div className="text-[var(--text-primary)] bg-[var(--bg-secondary)]">
  Content
</div>
```

### Step 3: Common Component Examples

#### Button Component
```jsx
export function Button({ variant = 'primary', children, ...props }) {
  const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-colors'
  
  const variants = {
    primary: 'bg-[var(--primary-600)] text-white hover:bg-[var(--primary-700)]',
    secondary: 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
  }
  
  return (
    <button className={`${baseClasses} ${variants[variant]}`} {...props}>
      {children}
    </button>
  )
}
```

#### Card Component
```jsx
export function Card({ children, className = '' }) {
  return (
    <div className={`
      rounded-lg p-6
      bg-[var(--card-bg)]
      border border-[var(--border-color)]
      shadow-md
      ${className}
    `}>
      {children}
    </div>
  )
}
```

#### Input Component
```jsx
export function Input({ label, ...props }) {
  return (
    <div className="form-group">
      <label className="text-sm font-medium text-[var(--text-primary)] mb-2 block">
        {label}
      </label>
      <input
        className="input-base"
        style={{
          backgroundColor: 'var(--input-bg)',
          borderColor: 'var(--input-border)',
          color: 'var(--input-text)',
        }}
        {...props}
      />
    </div>
  )
}
```

---

## Testing Dark Mode in Components

### Manual Testing
```javascript
// Open browser console and run:

// Test light mode
document.documentElement.setAttribute('data-theme', 'light')

// Test dark mode
document.documentElement.setAttribute('data-theme', 'dark')

// Check a variable
getComputedStyle(document.documentElement).getPropertyValue('--text-primary')
```

### Automated Testing
```javascript
describe('Dark Mode', () => {
  it('should apply dark theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    
    const color = window.getComputedStyle(document.documentElement)
      .getPropertyValue('--text-primary').trim()
    
    expect(color).toBe('#f9fafb')
  })
})
```

---

## Theme Context API

### Using Theme in Components

```jsx
import { useTheme } from '../hooks/ThemeContext'

export function MyComponent() {
  const { theme, toggleTheme } = useTheme()
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  )
}
```

### Theme Context Structure

```javascript
{
  theme: 'light' | 'dark',
  toggleTheme: () => void,
  isDark: boolean
}
```

---

## Available CSS Variables

### Colors (All have 50-900 variants)
- `--primary-*` - Blue
- `--secondary-*` - Green
- `--accent-*` - Orange
- `--danger-*` - Red
- `--neutral-*` - Grays

### Backgrounds
- `--bg-primary` - Main background
- `--bg-secondary` - Secondary background
- `--bg-tertiary` - Tertiary background
- `--bg-hover` - Hover state
- `--bg-active` - Active state
- `--bg-sidebar` - Sidebar background
- `--bg-header` - Header background

### Text
- `--text-primary` - Main text
- `--text-secondary` - Secondary text
- `--text-tertiary` - Tertiary text
- `--text-disabled` - Disabled text
- `--sidebar-text` - Sidebar text

### Components
- `--input-bg` - Input background
- `--input-border` - Input border
- `--input-text` - Input text
- `--card-bg` - Card background
- `--card-border` - Card border
- `--border-color` - Border color
- `--border-light` - Light border

### Spacing
- `--spacing-1` through `--spacing-12` (4px to 48px)

### Typography
- `--font-primary` - Body font
- `--font-heading` - Heading font
- `--text-xs` through `--text-4xl` - Font sizes
- `--font-light` through `--font-extrabold` - Font weights
- `--line-height-*` - Line heights
- `--letter-spacing-*` - Letter spacing

### Effects
- `--shadow-xs` through `--shadow-2xl` - Shadow levels
- `--radius-sm` through `--radius-2xl` - Border radius
- `--transition-fast` / `--transition-base` / `--transition-slow` - Timing

---

## Common Mistakes to Avoid

### ❌ Using Hardcoded Colors
```jsx
// WRONG
<div className="text-gray-900 bg-white">
```

### ✅ Using CSS Variables
```jsx
// RIGHT
<div className="text-[var(--text-primary)] bg-[var(--bg-secondary)]">
```

### ❌ Mixing Theme Methods
```jsx
// WRONG - Don't mix hardcoded with variables
<div className="text-neutral-900" style={{ color: 'var(--text-primary)' }}>
```

### ❌ Forgetting About Readability
```jsx
// WRONG - Colors might not have enough contrast
const color = '#555555'

// RIGHT - Use predefined color scales
const color = 'var(--text-primary)'
```

### ❌ Creating New Color Variables
```jsx
// WRONG - Duplicating variables
const color = '#0ea5e9'

// RIGHT - Use existing variables
const color = 'var(--primary-500)'
```

---

## Updating Dark Mode Colors

### Global Color Change

Edit `/src/styles/theme.css`:

```css
[data-theme="dark"] {
  /* Change all background colors */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2a2a2a;
  --bg-tertiary: #3a3a3a;
  
  /* Change all text colors */
  --text-primary: #e0e0e0;
  --text-secondary: #b0b0b0;
}
```

Changes apply globally instantly!

### Component-Specific Override

```css
/* For specific component styling */
[data-theme="dark"] .card {
  background-color: var(--card-bg);
  border-color: var(--card-border);
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.3);
}
```

---

## Performance Considerations

### CSS Variables vs JavaScript Switching
**Why CSS Variables:**
- ✅ Instant switching (browser-native)
- ✅ No JavaScript execution needed
- ✅ Smooth transitions
- ✅ Smaller bundle size

### localStorage Persistence
```javascript
// Theme preference is automatically saved
localStorage.setItem('theme-preference', 'dark')

// And restored on next visit
const saved = localStorage.getItem('theme-preference')
```

### System Preference Detection
```javascript
// Automatic detection on first visit
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  // Use dark mode
}
```

---

## Troubleshooting

### Colors not changing?
1. Check `data-theme` attribute on `<html>` element
2. Verify CSS variables are spelled correctly
3. Clear browser cache
4. Check localStorage isn't overriding preference

### Text unreadable in dark mode?
1. Check contrast ratio (should be 4.5:1 minimum)
2. Verify using correct text color variable
3. Test with browser DevTools color picker

### Styles not applying?
1. Ensure stylesheet is imported before usage
2. Check specificity - CSS variables should win
3. Verify Tailwind is generating arbitrary value classes

---

## Resources

- **Theme File:** `src/styles/theme.css`
- **Theme Context:** `src/hooks/ThemeContext.jsx`
- **Theme Toggle:** `src/components/ThemeToggle.jsx`
- **Design Docs:** `UI_DESIGN_SYSTEM.md`
- **Implementation Guide:** `DESIGN_IMPLEMENTATION_GUIDE.md`

---

## Quick Reference

```jsx
// Import theme context
import { useTheme } from '../hooks/ThemeContext'

// Use in component
const { theme, toggleTheme } = useTheme()

// Apply dark mode classes
className="text-[var(--text-primary)] bg-[var(--bg-secondary)]"

// Or inline styles
style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)' }}

// Common variables
--text-primary          /* Main text */
--bg-secondary          /* Main background */
--primary-600           /* Primary color */
--danger-600            /* Error/delete color */
```

---

## Contributing

When adding new features:
1. Always use CSS variables for colors
2. Test in both light and dark modes
3. Verify contrast ratios
4. Document any new variables needed
5. Update this guide if adding new functionality

---

## Status: ✅ Complete

Dark mode system is production-ready and fully documented.