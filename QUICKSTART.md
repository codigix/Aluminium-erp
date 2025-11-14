# Quick Start - ERP System

## 1️⃣ Setup Database (First Time Only)

```powershell
# From c:\repo directory
node backend/scripts/migration.js
```

Expected output:
```
🔄 Running database migration...
✓ Database schema created successfully
📦 Loading sample data...
✓ Sample data inserted successfully
✓ Migration completed successfully!
```

## 2️⃣ Start Development Servers

```powershell
# From c:\repo directory
npm run dev
```

Expected output:
```
✓ Server running on http://localhost:5000
✓ Database pool created successfully
✓ API Base URL: http://localhost:5000/api

VITE v5.4.21  ready in 388 ms
➜  Local:   http://localhost:5173/
```

## 3️⃣ Access the Application

### Frontend Dashboard
- **URL**: http://localhost:5173
- **Features**: Dashboard with quick actions for Buying module

### Backend API
- **Base URL**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health

## 4️⃣ Test Buying Module

### Create a Purchase Order
1. Go to http://localhost:5173
2. Click "Create PO" button
3. Select supplier and items
4. Click "Save PO"

### Create a GRN
1. Go to Dashboard → "GRN List"
2. Click "Create GRN"
3. Reference a PO and add received items
4. Click "Accept" to update stock

### Create Invoice
1. Go to Dashboard → "View Invoices"
2. Click "Create Invoice"
3. Fill in supplier and items
4. Click "Submit Invoice"

## 5️⃣ API Testing Examples

### Create Purchase Order
```bash
curl -X POST http://localhost:5000/api/purchase-orders \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": "SUP001",
    "order_date": "2025-01-15",
    "expected_date": "2025-01-20",
    "items": [
      {
        "item_code": "ITEM001",
        "qty": 100,
        "uom": "KG",
        "rate": 1500
      }
    ]
  }'
```

### Get Purchase Orders
```bash
curl http://localhost:5000/api/purchase-orders
```

### Get Items
```bash
curl http://localhost:5000/api/items
```

### Create GRN
```bash
curl -X POST http://localhost:5000/api/purchase-receipts \
  -H "Content-Type: application/json" \
  -d '{
    "po_no": "PO-123456",
    "supplier_id": "SUP001",
    "receipt_date": "2025-01-20",
    "items": [
      {
        "item_code": "ITEM001",
        "received_qty": 100,
        "accepted_qty": 100,
        "warehouse_code": "WH001"
      }
    ]
  }'
```

## 6️⃣ Database Structure

### Key Tables
| Table | Purpose |
|-------|---------|
| `supplier` | Supplier master |
| `item` | Product master |
| `purchase_order` | Orders placed |
| `purchase_receipt` | Goods received |
| `purchase_invoice` | Supplier invoices |
| `stock` | Current inventory |
| `stock_ledger` | Stock history |

### Sample Data
| Type | Count |
|------|-------|
| Suppliers | 3 |
| Items | 5 |
| Warehouses | 3 |
| Contacts | 3 |

## 7️⃣ Common Issues & Solutions

### Issue: Port 5000 Already in Use
```powershell
taskkill /IM node.exe /F
npm run dev
```

### Issue: Database Not Found
```powershell
# Re-run migration
node backend/scripts/migration.js
```

### Issue: Frontend Can't Connect to Backend
- Ensure both servers are running
- Check CORS is enabled in backend
- Verify backend URL in API calls

## 8️⃣ Project Structure

```
c:\repo
├── backend/              # Express API
│   ├── src/app.js       # Main entry
│   ├── scripts/
│   │   ├── database.sql # Schema
│   │   └── migration.js # Setup script
│   ├── src/models/      # DB models
│   ├── src/controllers/ # Business logic
│   └── src/routes/      # API routes
│
└── frontend/            # React + Vite
    ├── src/App.jsx      # Main app
    ├── src/pages/       # Page components
    │   ├── Dashboard.jsx
    │   └── Buying/      # Buying module pages
    ├── src/components/  # UI components
    └── package.json
```

## 9️⃣ Available Frontend Routes

- `/` - Dashboard
- `/buying/purchase-orders` - PO List
- `/buying/purchase-order/new` - Create PO
- `/buying/purchase-receipts` - GRN List
- `/buying/purchase-invoices` - Invoice List
- `/buying/items` - Items Master

## 🔟 Next Steps

1. ✅ Buying module is complete
2. 🔜 Create Selling module (customers, quotations, orders)
3. 🔜 Build Manufacturing module (BOM, production orders)
4. 🔜 Implement advanced Stock management
5. 🔜 Add Reports and Analytics

---

**Everything is ready to go!** 🚀

Questions? Check SETUP_GUIDE.md for detailed information.