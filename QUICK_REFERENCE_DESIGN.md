# 🎨 Quick Reference - Design System

## 🚀 Quick Start

### Theme Toggle
Click the **moon icon (🌙)** in the sidebar footer to switch between light and dark modes.

### Importing CSS
All Buying pages already have this import:
```jsx
import './Buying.css'
```

---

## 🎨 Available Classes

### Buttons
```jsx
// Primary action (blue)
<button className="btn btn-primary">Save</button>

// Secondary action (gray)
<button className="btn btn-secondary">Cancel</button>

// Success action (green)
<button className="btn btn-success">Approve</button>

// Danger action (red)
<button className="btn btn-danger">Delete</button>

// Warning action (orange)
<button className="btn btn-warning">Warning</button>

// Small button
<button className="btn btn-sm btn-primary">Edit</button>

// Large button
<button className="btn btn-lg btn-primary">Large</button>
```

### Form Elements
```jsx
// Form group with label
<div className="form-group">
  <label>Email Address</label>
  <input type="email" className="input-base" />
</div>

// Multi-column layout
<div className="form-row">
  <div className="form-group">
    <label>Field 1</label>
    <input className="input-base" />
  </div>
  <div className="form-group">
    <label>Field 2</label>
    <input className="input-base" />
  </div>
</div>

// Text area
<div className="form-group">
  <label>Message</label>
  <textarea className="input-base"></textarea>
</div>
```

### Cards & Containers
```jsx
// Standard card
<div className="card">
  <h3>Title</h3>
  <p>Content</p>
</div>

// Table container
<div className="table-wrapper">
  <table className="table">
    {/* table content */}
  </table>
</div>

// Form container
<form className="form-section">
  {/* form content */}
</form>
```

### Badges & Status
```jsx
// Badge styles
<span className="badge badge-primary">Primary</span>
<span className="badge badge-success">Success</span>
<span className="badge badge-warning">Warning</span>
<span className="badge badge-danger">Danger</span>

// Status badges
<span className="badge-draft">Draft</span>
<span className="badge-sent">Sent</span>
<span className="badge-responses">Responses</span>
<span className="badge-closed">Closed</span>
```

### Alerts
```jsx
// Alert messages
<div className="alert alert-info">Info message</div>
<div className="alert alert-success">Success message</div>
<div className="alert alert-warning">Warning message</div>
<div className="alert alert-danger">Error message</div>
```

### Tables
```jsx
<table className="table">
  <thead>
    <tr>
      <th>Column 1</th>
      <th>Column 2</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Data</td>
      <td>Data</td>
      <td>
        <button className="btn btn-sm btn-primary">Edit</button>
      </td>
    </tr>
  </tbody>
</table>
```

---

## 🎯 Color Variables

### Light Mode (Default)
```css
--primary-600: #0284c7      /* Sky Blue - main color */
--secondary-600: #16a34a    /* Green - success */
--accent-600: #d97706       /* Orange - warning */
--danger-600: #dc2626       /* Red - errors */

--text-primary: #111827     /* Dark text */
--text-secondary: #6b7280   /* Medium text */
--bg-primary: #ffffff       /* White background */
--card-bg: #ffffff          /* White cards */
--border-color: #e5e7eb     /* Light borders */
```

### Dark Mode
```css
--text-primary: #f9fafb     /* Light text */
--text-secondary: #d1d5db   /* Light medium text */
--bg-primary: #111827       /* Very dark background */
--card-bg: #1f2937          /* Dark cards */
--border-color: #374151     /* Dark borders */
```

---

## 📏 Spacing Variables

```css
--spacing-1: 4px
--spacing-2: 8px
--spacing-3: 12px
--spacing-4: 16px
--spacing-5: 20px
--spacing-6: 24px
--spacing-8: 32px
--spacing-10: 40px
--spacing-12: 48px
```

### Usage Example
```css
.my-element {
  padding: var(--spacing-4);
  margin: var(--spacing-3);
  gap: var(--spacing-2);
}
```

---

## 🔤 Typography

### Font Families
```css
--font-primary: 'Inter', sans-serif        /* Body text */
--font-heading: 'Poppins', sans-serif      /* Headings */
```

### Font Sizes
```css
--text-xs: 0.75rem      /* 12px */
--text-sm: 12px     /* 14px */
--text-base: 1rem       /* 16px */
--text-lg: 1.125rem     /* 18px */
--text-xl: 1.25rem      /* 20px */
--text-2xl: 1.5rem      /* 24px */
--text-3xl: 1.875rem    /* 30px */
--text-4xl: 2.25rem     /* 36px */
```

### Font Weights
```css
--font-light: 300
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
--font-extrabold: 800
```

---

## 🎨 Common Patterns

### Page Layout
```jsx
<div className="buying-container">
  <div className="page-header">
    <h2>Page Title</h2>
    <button className="btn btn-primary">+ New</button>
  </div>
  
  <div className="filters-section">
    {/* filter controls */}
  </div>
  
  <div className="table-wrapper">
    <table className="table">
      {/* table content */}
    </table>
  </div>
</div>
```

### Form Layout
```jsx
<form className="form-section">
  <div className="form-row">
    <div className="form-group">
      <label>Field 1</label>
      <input className="input-base" />
    </div>
    <div className="form-group">
      <label>Field 2</label>
      <input className="input-base" />
    </div>
  </div>
  
  <div className="form-actions">
    <button className="btn btn-primary">Save</button>
    <button className="btn btn-secondary">Cancel</button>
  </div>
</form>
```

---

## ✨ Utility Classes

```css
/* Text utilities */
.text-muted           /* Tertiary text color */
.text-subtle          /* Secondary text color */

/* Borders */
.border-light         /* Light border color */
.border-subtle        /* Standard border color */

/* Shadows (elevation) */
.shadow-elevation-1   /* Subtle shadow */
.shadow-elevation-2   /* Small shadow */
.shadow-elevation-3   /* Medium shadow */
.shadow-elevation-4   /* Large shadow */

/* Gradients */
.gradient-primary     /* Blue gradient */
.gradient-secondary   /* Green gradient */
.gradient-accent      /* Orange gradient */

/* Flexbox */
.flex-center          /* Centered flex */
.flex-between         /* Space-between flex */

/* Text truncation */
.truncate-lines-2     /* 2-line truncation */
.truncate-lines-3     /* 3-line truncation */
```

---

## 🔄 Responsive Breakpoints

```css
/* Desktop: > 1024px */
Full layout, all features visible

/* Tablet: 768px - 1024px */
Adjusted layout, optimized spacing

/* Mobile: < 768px */
Single column, stacked layout

/* Small Mobile: < 480px */
Minimal layout, touch-friendly
```

---

## 🌙 Dark Mode Testing

### To Test Dark Mode
1. Click the moon icon (🌙) in sidebar footer
2. All colors should smoothly transition
3. Verify readability in all modes

### Automatic Detection
- App automatically detects system preference
- User can override with theme toggle
- Choice is saved to localStorage

---

## ⚡ Performance Tips

### ✅ DO
```css
/* Use CSS variables */
color: var(--text-primary);
padding: var(--spacing-4);
background: var(--primary-600);
```

### ❌ DON'T
```css
/* Hardcode values */
color: #111827;
padding: 16px;
background: #0284c7;
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Colors not changing | Clear cache (Ctrl+Shift+Delete) then refresh |
| Dark mode not working | Check moon icon in sidebar, refresh page |
| Fonts not loading | Check Google Fonts in index.html |
| Buttons look weird | Verify using `.btn` + variant class |
| Form layout broken | Use `.form-row` for multi-column layout |

---

## 📱 Mobile-First Classes

```jsx
// Grid that adjusts for mobile
<div className="form-row">
  {/* Automatically single column on mobile */}
</div>

// Responsive table
<div className="table-wrapper">
  {/* Automatically scrollable on mobile */}
</div>

// Touch-friendly buttons
<button className="btn btn-primary">
  {/* Adequate padding for touch */}
</button>
```

---

## 🎓 Important Notes

1. **Always use CSS variables** - Don't hardcode colors
2. **Test in both modes** - Light and dark
3. **Use semantic HTML** - Improves accessibility
4. **Follow patterns** - Maintain consistency
5. **Check responsive** - Test on mobile

---

## 📚 Documentation

- **Full Guide**: `UI_DESIGN_SYSTEM.md`
- **Implementation**: `DESIGN_IMPLEMENTATION_GUIDE.md`
- **Summary**: `UI_REDESIGN_COMPLETE.md`

---

## 🚀 Ready to Go!

The design system is complete and ready to use. Start building beautiful, consistent interfaces! 

**Happy coding! 🎉**