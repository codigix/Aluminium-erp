# Modal Standards & Guidelines

## Modal Component Structure

### Core Components
All modals use the unified `Modal` component from either:
- `frontend/src/components/Modal.jsx` (CSS-based, Tailwind converted)
- `frontend/src/components/Modal/Modal.jsx` (Direct Tailwind approach)

Both are now identical in functionality and structure.

## Layout Structure

### Proper Modal Flex Layout
```
Modal Container (fixed inset-0, flex layout)
  ├─ Header (flex-shrink-0, sticky)
  │  ├─ Title
  │  └─ Close Button (×)
  ├─ Body (flex-1, overflow-y-auto) ✅ SCROLLABLE HERE
  │  └─ Form Content
  └─ Footer (flex-shrink-0, optional)
     └─ Action Buttons
```

### Key Properties
- **Header**: `flex-shrink-0` prevents scrolling over header
- **Body**: `flex-1 overflow-y-auto` allows content to scroll
- **Footer**: `flex-shrink-0` prevents scrolling over footer
- **Max Height**: `max-h-[90vh]` ensures modal fits on screen

## Size Guidelines

### Available Sizes
```javascript
const sizes = {
  sm: 'max-w-sm',      // 384px - Simple forms, confirmations
  md: 'max-w-md',      // 448px - Basic single-section forms
  lg: 'max-w-lg',      // 512px - Multi-field forms
  xl: 'max-w-xl',      // 576px - Complex forms with tables
  '2xl': 'max-w-2xl',  // 672px - Large forms with item lists
  '3xl': 'max-w-3xl',  // 768px - Very large forms (purchase orders, etc)
}
```

### Size Recommendations
- **sm**: Confirmations, simple actions
- **md**: Customer creation, simple inputs
- **lg**: Sales orders, basic forms
- **xl**: GRN, RFQ (one-section items)
- **2xl**: Purchase orders, quotations (multi-section)
- **3xl**: Complex forms with multiple data grids

## Content Organization

### Section Pattern
```jsx
{/* Section Title */}
<div style={{
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '20px'
}}>
  <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 600 }}>
    📌 Section Title
  </h3>
  {/* Section content */}
</div>
```

### Scrollable Data Lists
For items/tables that may scroll:
```jsx
<div style={{ 
  maxHeight: '400px',      // Controls inner scrolling
  overflowY: 'auto',       // Only inner scrolls, not modal
  border: '1px solid #e5e7eb', 
  borderRadius: '6px' 
}}>
  {/* Items */}
</div>
```

## Padding & Spacing Standards

### Modal Padding
- **Header**: `px-6 py-4` (24px horizontal, 16px vertical)
- **Body**: `px-6 py-4` (24px horizontal, 16px vertical)
- **Footer**: `px-6 py-4` (24px horizontal, 16px vertical)

### Section Margins
- **Between Sections**: `marginBottom: '20px'`
- **Within Sections**: `marginBottom: '16px'`

### Input Styling
```javascript
{
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '0.95rem',
  fontFamily: 'inherit',
  backgroundColor: '#fff',
  boxSizing: 'border-box'
}
```

## Error & Alert Styling

### Error Alert
```javascript
{
  background: '#fee2e2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '20px',
  color: '#dc2626',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '0.9rem'
}
```

### Success/Info Alert
```javascript
{
  backgroundColor: '#e0f2fe',
  border: '1px solid #bae6fd',
  borderRadius: '6px',
  padding: '12px 16px',
  color: '#0284c7'
}
```

## Common Patterns

### Form Grid Layout
```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
  {/* Fields */}
</div>
```

### Button Group
```jsx
<div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
  <button>Cancel</button>
  <button>Submit</button>
</div>
```

### Data Summary
```jsx
<div style={{
  padding: '16px',
  backgroundColor: '#f1f5f9',
  borderRadius: '6px',
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '16px'
}}>
  {/* Summary items */}
</div>
```

## Import Standards

### Correct Import
```jsx
import Modal from '../Modal'                // From same Buying/Production/Selling folder
import Modal from '../Modal/Modal'         // More explicit path
```

Both now resolve to identical implementations.

## What NOT to Do ❌

1. ❌ Use `overflow-y: auto` on the entire modal container
2. ❌ Add scrolling to header or footer sections
3. ❌ Forget `boxSizing: 'border-box'` on width: 100% elements
4. ❌ Use hardcoded pixel widths instead of responsive sizes
5. ❌ Apply padding to modal's flex container instead of sections
6. ❌ Hide content behind a sticky header without flex-shrink-0
7. ❌ Use sizes without consistent padding (causes misalignment)

## Testing Checklist

- [ ] Header stays visible when scrolling
- [ ] Footer stays visible when scrolling
- [ ] Content doesn't hide behind header
- [ ] Modal fits on screen (not taller than viewport)
- [ ] Padding is consistent across all sections
- [ ] Grid layouts align properly
- [ ] Tables/lists scroll internally without affecting modal scroll
- [ ] Close button (×) always accessible
- [ ] Modal works on mobile (responsive width)

## Implementation Example

```jsx
import Modal from '../Modal/Modal'

export default function CreateItemModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({ /* ... */ })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    // Handle submission
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="📦 Create New Item" 
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        {/* Error Alert */}
        {error && (
          <div style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '20px',
            color: '#dc2626'
          }}>
            {error}
          </div>
        )}

        {/* Section 1 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontWeight: 600 }}>Basic Info</h3>
          {/* Fields */}
        </div>

        {/* Section 2 */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontWeight: 600 }}>Details</h3>
          {/* Fields */}
        </div>
      </form>
    </Modal>
  )
}
```

## Browser Support

- ✅ Chrome/Edge (Tailwind flex, overflow)
- ✅ Firefox (Tailwind flex, overflow)
- ✅ Safari (Tailwind flex, overflow)
- ✅ Mobile browsers (responsive width)
