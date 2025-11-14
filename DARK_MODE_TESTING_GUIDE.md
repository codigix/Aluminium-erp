# Dark Mode Testing Guide

## Quick Start

1. **Run the application:**
   ```bash
   npm run dev
   ```

2. **Access the app:**
   - Open http://localhost:5173 (or your configured port)

3. **Toggle Dark Mode:**
   - Look for the **moon icon (🌙)** in the **sidebar footer**
   - Click to toggle between light and dark mode
   - Theme preference is saved to localStorage

---

## Pages to Test

### 1. Supplier Management (/suppliers)
**Supplier List**
- [ ] Title "Suppliers" is visible and readable
- [ ] Search card has proper background
- [ ] Input fields are clearly visible
- [ ] Status filter dropdown works in both modes
- [ ] Table headers have good contrast
- [ ] Table rows have hover effects
- [ ] Badges (Active/Inactive) are colored correctly
- [ ] Edit/Delete buttons are clickable and visible
- [ ] Add New Supplier button is visible

**Supplier Detail (/suppliers/:id)**
- [ ] Header text is readable
- [ ] Status, Rating, Payment Terms cards are visible
- [ ] Basic Information section has proper styling
- [ ] Contacts section (if present) is readable
- [ ] Addresses section (if present) is readable
- [ ] Performance Scorecard (if present) displays properly
- [ ] Timestamp text is visible

### 2. Purchase Orders (/purchase-orders)
- [ ] Title "Purchase Orders" is visible
- [ ] PO ID column text is colored correctly
- [ ] Amount column text is readable
- [ ] Status badges display properly
- [ ] Action buttons (View, Download, Cancel) are visible and hoverable

### 3. Dashboard (/dashboard)
- [ ] All stat cards are visible
- [ ] Charts/graphs (if any) are readable
- [ ] Text contrast is good
- [ ] Navigation elements stand out

### 4. Buying Module Pages
Test these sections:
- [ ] Material Requests
- [ ] RFQs
- [ ] Quotations
- [ ] Purchase Orders
- [ ] Purchase Receipts
- [ ] Purchase Invoices

**For each page verify:**
- [ ] Page title is readable
- [ ] Form inputs have visible borders
- [ ] Table headers have good contrast
- [ ] Links are clearly visible and colored
- [ ] Buttons work and are visible

---

## Color Reference

### Light Mode
```
Text (Primary):     Dark gray/black (#111827)
Text (Secondary):   Medium gray (#4b5563)
Background:         White/Light gray (#ffffff, #f9fafb)
Borders:           Light gray (#e5e7eb)
Sidebar:           Dark gray (#111827)
```

### Dark Mode
```
Text (Primary):     Light gray (#f9fafb)
Text (Secondary):   Gray (#d1d5db)
Background:         Very dark gray/black (#111827, #030712)
Borders:           Dark gray (#374151)
Sidebar:           Almost black (#030712)
```

---

## Things to Look For

### ✅ Good Dark Mode Implementation
- [ ] Text is readable (not too light, not too dark)
- [ ] Backgrounds are dark but not pure black
- [ ] Form inputs are clearly visible
- [ ] Hover states work smoothly
- [ ] Buttons have good contrast
- [ ] Borders are visible but not jarring
- [ ] No hardcoded colors breaking the theme

### ❌ Common Issues (If Found, Report)
- [ ] Text is too faint (unreadable)
- [ ] Backgrounds are too bright (defeats dark mode)
- [ ] Form inputs disappear or are invisible
- [ ] Buttons don't show in dark mode
- [ ] Borders are invisible
- [ ] Colors don't change when toggling theme
- [ ] Page looks broken in dark mode

---

## Quick Checklist

### Light Mode Should Show:
- [ ] Clean, bright interface
- [ ] Dark text on light backgrounds
- [ ] Light sidebar
- [ ] Good readability

### Dark Mode Should Show:
- [ ] Dark interface with light text
- [ ] All text remains readable
- [ ] Dark sidebar
- [ ] No eye strain
- [ ] Professional appearance

---

## Testing Specific Components

### Input Fields
**Light Mode:** Clear border, white background, dark text
**Dark Mode:** Clear border, dark background, light text
- [ ] Placeholder text is visible in both modes
- [ ] Focused state shows ring
- [ ] Value text is readable

### Buttons
- [ ] Primary buttons are visible and clickable in both modes
- [ ] Secondary buttons have good contrast
- [ ] Hover effects work smoothly
- [ ] Color changes are appropriate for the theme

### Tables
- [ ] Headers have good contrast
- [ ] Rows have visible borders
- [ ] Hover state is visible
- [ ] Text is readable in all cells

### Modals
- [ ] Modal background is visible
- [ ] Modal text is readable
- [ ] Buttons are clickable
- [ ] Close button works

### Cards
- [ ] Card backgrounds are visible
- [ ] Card text is readable
- [ ] Shadows are appropriate
- [ ] Card content is not hidden

---

## Performance Notes

Dark mode toggle should:
- [ ] Switch instantly (< 300ms)
- [ ] Not cause page flicker
- [ ] Not require page refresh
- [ ] Be smooth and professional-looking

---

## Accessibility Verification

Check that contrast ratios meet WCAG AA standards:
- [ ] Normal text: 4.5:1 minimum
- [ ] Large text: 3:1 minimum
- [ ] All colors have sufficient contrast

Use browser DevTools or WAVE tool to verify.

---

## Browser Testing

Test dark mode in:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## System Preference Test

1. **Change system dark mode:**
   - Windows: Settings > Personalization > Colors > Dark
   - macOS: System Preferences > General > Dark
   - Linux: Depends on desktop environment

2. **Refresh the app** (if first visit)
   - App should automatically use system preference

3. **Manually toggle** using moon icon
   - Should override system preference
   - Should be saved in localStorage

---

## Sign-Off

When all items are checked:
- [ ] Dark mode is fully functional
- [ ] All pages support dark mode
- [ ] No issues or broken elements
- [ ] Ready for production

**Tested by:** ________________
**Date:** ________________
**Status:** ✅ APPROVED / ❌ NEEDS FIXES

---

## Feedback Form

If you find any issues:

```
Issue: [What's broken?]
Page: [Which page?]
Light Mode: [Works? Y/N]
Dark Mode: [Works? Y/N]
Expected: [What should happen?]
Actual: [What actually happens?]
Severity: [Minor/Major/Critical]
```

Submit feedback to the development team for immediate fixes.