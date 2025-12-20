# Sales Order & BOM Integration Implementation

## Overview
This document describes the comprehensive implementation of BOM (Bill of Materials) integration with Sales Orders in the Aluminium ERP system. The sales order workflow now allows users to link sales orders with BOMs from the production module and view detailed analysis.

## Architecture Changes

### 1. Database Schema Updates
**File**: `backend/src/scripts/add-sales-order-bom-fields.sql`

Added the following columns to the `selling_sales_order` table:
- `bom_id` (VARCHAR(50)) - Reference to BOM from production module
- `quantity` (INT) - Quantity of BOM to be produced
- `source_warehouse` (VARCHAR(100)) - Warehouse from which materials are sourced
- `order_type` (VARCHAR(50)) - Type of order (Sales, Custom, Service)
- `customer_name` (VARCHAR(255)) - Cached customer name for performance
- `customer_email` (VARCHAR(100)) - Cached customer email
- `customer_phone` (VARCHAR(20)) - Cached customer phone
- `series` (VARCHAR(50)) - Sales order series/prefix
- `cost_center` (VARCHAR(100)) - Cost center for accounting
- `project` (VARCHAR(100)) - Associated project

Added indexes:
- `idx_bom_id` - For efficient BOM lookups
- `idx_order_type` - For order type filtering

### 2. Backend Models

#### SalesOrderModel (`backend/src/models/SalesOrderModel.js`)
New model class handling all sales order operations with BOM integration:

**Key Methods:**
- `initializeSchema()` - Ensures database schema is up-to-date
- `createSalesOrder(data)` - Creates new sales order with BOM link
- `getSalesOrders(filters)` - Retrieves sales orders with optional filtering
- `getSalesOrderById(id)` - Gets complete order with linked BOM details
- `updateSalesOrder(id, data)` - Updates sales order
- `deleteSalesOrder(id)` - Soft deletes order
- `getBOMForSalesOrder(bomId)` - Fetches BOM details including materials and operations
- `getBOMsForCustomer(customerId)` - Gets available BOMs for a customer
- `getSalesOrdersByBOM(bomId)` - Finds all orders using a specific BOM
- `getSalesOrderAnalytics()` - Generates sales analytics
- `getOrderAnalysisByBOM(bomId)` - BOM-specific sales analysis
- `getOrderAnalysisByCustomer(customerId)` - Customer-specific sales analysis

### 3. Backend Controllers

#### SellingController Updates (`backend/src/controllers/SellingController.js`)
Added four new endpoints for BOM integration:

1. **getBOMList()** - GET `/api/selling/bom-list`
   - Returns list of all active/draft BOMs
   - Used for BOM selection in sales order form

2. **getBOMDetails()** - GET `/api/selling/bom/:bomId`
   - Retrieves complete BOM details including:
     - Basic BOM info (ID, product, quantity, UOM)
     - Materials list with costs
     - Scrap items
     - Operations

3. **getSalesOrderAnalysisByBOM()** - GET `/api/selling/orders-by-bom/:bomId`
   - Provides BOM-specific analytics:
     - Summary: total orders, quantity, amount, unique customers, date range
     - Recent orders list (last 10)
   - Used in BOM Details tab

4. **getSalesOrderAnalysisByCustomer()** - GET `/api/selling/orders-by-customer/:customerId`
   - Customer-specific sales analysis
   - Groups orders by status and date
   - Lists all customer orders

### 4. API Routes

**File**: `backend/src/routes/selling.js`

New routes added:
```
GET /api/selling/bom-list              - List all BOMs
GET /api/selling/bom/:bomId            - Get BOM details
GET /api/selling/orders-by-bom/:bomId  - BOM analysis
GET /api/selling/orders-by-customer/:customerId - Customer analysis
```

### 5. Frontend Components

#### SalesOrderForm.jsx - Enhanced with 3 Tabs
**File**: `frontend/src/pages/Selling/SalesOrderForm.jsx`

**Simplified tab structure:**
1. **Basic Details Tab**
   - Series, Date, Customer (with auto-fill of name/email/phone)
   - BOM selection dropdown (dynamically populated from API)
   - Quantity field (affects total cost calculation)
   - Source Warehouse dropdown
   - Delivery Date, Order Type, Status

2. **Items Tab**
   - Manual item entry for orders without BOM
   - Add/Remove item buttons
   - Table with: Item Code, Item Name, Qty, Rate, Amount
   - Running total calculation

3. **BOM Details Tab** (Analysis)
   - Display selected BOM details:
     - BOM ID, Product name, Total cost
     - Materials table with costs
     - Scrap items (if applicable)
     - Operations (if applicable)
   - **Sales Order Analysis Card** (Blue info box)
     - Total orders for this BOM
     - Total sales amount
     - Unique customers using this BOM
     - Average order value
     - Recent orders table with customer, amount, quantity, status, date

**Features:**
- Responsive grid layout
- Tab navigation with Previous/Next buttons
- Real-time total calculation
- Automatic customer data population
- BOM cost-based pricing
- Error handling and validation

#### SalesOrderAnalysis.jsx - New Component
**File**: `frontend/src/pages/Selling/SalesOrderAnalysis.jsx`

Standalone analysis dashboard with:

**Overall Statistics (4 stat cards):**
- Total Orders
- Total Sales Amount
- Average Order Value
- Unique Customers

**BOM-wise Analysis Section:**
- Dropdown to select BOM
- Analyze button
- Results showing:
  - Orders grouped by status
  - Recent orders table
  - Detailed breakdown per status

**Customer-wise Analysis Section:**
- Dropdown to select Customer
- Analyze button
- Results showing:
  - Orders by date and status
  - All customer orders table
  - Associated BOMs

**UI Features:**
- Icon-based stat cards with color coding
- Filter section with clean form layout
- Responsive tables with status badges
- Date formatting and currency display
- Loading states
- Error handling

### 6. Data Flow

#### Creating a Sales Order with BOM:
```
1. User navigates to /selling/sales-orders/new
2. SalesOrderForm fetches:
   - Customers list
   - Available BOMs (from production module)
   - Warehouses
3. User selects customer → Name/Email/Phone auto-filled
4. User selects BOM → Details loaded in BOM Details tab
5. User sets Quantity
6. Tab 1 (Basic Details) completed
7. User can add manual items in Items tab (optional)
8. User reviews BOM details and analysis in Tab 3
9. Click "Save Sales Order"
10. Data sent to API with order_amount calculated from:
    - BOM total_cost × quantity (if BOM selected)
    - OR Sum of manual items
11. Order saved to database with BOM link
12. Redirect to sales orders list
```

#### Analyzing Sales Orders:
```
1. User navigates to Sales Order Analysis page
2. Selects BOM or Customer
3. Clicks Analyze
4. API queries sales_order table for:
   - Orders matching filter
   - Aggregated statistics
   - Recent/all orders
5. Results displayed with charts/tables
```

## Database Migrations

**File**: `backend/src/scripts/add-sales-order-bom-fields.sql`

Execute to add BOM-related columns:
```bash
mysql -u root -p aluminium_erp < backend/src/scripts/add-sales-order-bom-fields.sql
```

Or automatically executed on app startup via SalesOrderModel.initializeSchema()

## Usage Examples

### Creating a Sales Order (API)
```javascript
POST /api/selling/sales-orders
{
  "customer_id": "CUST-123",
  "date": "2025-12-20",
  "bom_id": "BOM-001",
  "quantity": 5,
  "source_warehouse": "Main Warehouse",
  "delivery_date": "2025-12-27",
  "order_type": "Sales",
  "status": "Draft",
  "order_amount": 50000
}
```

### Fetching BOM Details
```javascript
GET /api/selling/bom/BOM-001
Response:
{
  "bom_id": "BOM-001",
  "product_name": "Aluminium Frame",
  "quantity": 1,
  "uom": "Kg",
  "total_cost": 10000,
  "materials": [
    {
      "item_code": "ITEM-001",
      "qty": 5,
      "uom": "Kg",
      "rate": 100,
      "amount": 500
    }
  ]
}
```

### Getting BOM Analysis
```javascript
GET /api/selling/orders-by-bom/BOM-001
Response:
{
  "summary": {
    "total_orders": 15,
    "total_quantity": 30,
    "total_amount": 300000,
    "avg_amount": 20000,
    "unique_customers": 8
  },
  "recent_orders": [...]
}
```

## Key Features Implemented

✅ **BOM Selection** - Dropdown with all available BOMs
✅ **BOM Details Display** - Materials, scrap items, operations
✅ **Quantity Multiplier** - Cost calculated based on quantity
✅ **Sales Analysis** - View sales data by BOM or Customer
✅ **Order Tracking** - Link sales orders back to BOM
✅ **Customer Analytics** - See customer purchasing patterns
✅ **Responsive Design** - Works on desktop and tablet
✅ **Error Handling** - Graceful error messages
✅ **Data Validation** - Required fields enforced
✅ **Performance** - Indexes on frequently queried columns

## Files Modified/Created

### Backend Files:
- ✅ `backend/src/models/SalesOrderModel.js` (NEW)
- ✅ `backend/src/controllers/SellingController.js` (UPDATED)
- ✅ `backend/src/routes/selling.js` (UPDATED)
- ✅ `backend/src/scripts/add-sales-order-bom-fields.sql` (NEW)

### Frontend Files:
- ✅ `frontend/src/pages/Selling/SalesOrderForm.jsx` (UPDATED)
- ✅ `frontend/src/pages/Selling/SalesOrderAnalysis.jsx` (NEW)
- ✅ `frontend/src/pages/Selling/index.js` (UPDATED)

## Testing Checklist

- [ ] Navigate to New Sales Order form
- [ ] Verify customer dropdown populates correctly
- [ ] Select a customer and verify auto-fill of name/email/phone
- [ ] Verify BOM dropdown loads from API
- [ ] Select BOM and verify details load in Tab 3
- [ ] Verify quantity field affects total calculation
- [ ] Add manual items in Items tab
- [ ] Calculate and verify total cost
- [ ] Save order and verify it appears in list
- [ ] Navigate to Sales Order Analysis
- [ ] Select BOM and view analysis
- [ ] Select Customer and view analysis
- [ ] Verify all statistics display correctly
- [ ] Check recent orders table shows correct data

## Future Enhancements

1. **Bill Generation** - Auto-generate bills from sales orders
2. **Stock Reservation** - Reserve stock based on BOM materials
3. **Production Planning** - Auto-create production plans from sales orders
4. **Payment Terms** - Add payment schedule to orders
5. **Delivery Tracking** - Track delivery status
6. **Discount Management** - Apply discounts per item
7. **Bulk Operations** - Confirm/cancel multiple orders at once
8. **Email Notifications** - Notify customers of order status
9. **Mobile App** - Mobile-friendly order entry
10. **Advanced Analytics** - Charts, graphs, forecasting

## Troubleshooting

### Issue: BOM list not loading
**Solution**: Verify BOMs exist in production module with status 'active' or 'draft'

### Issue: Total cost not calculating
**Solution**: Ensure BOM has total_cost field populated, or add manual items

### Issue: Customer details not auto-filling
**Solution**: Verify customer exists in selling_customer table

### Issue: Analysis page shows no data
**Solution**: Ensure orders exist with matching customer_id or bom_id

## Support & Maintenance

For issues or questions:
1. Check application logs
2. Verify database connection
3. Ensure all migrations executed
4. Check API endpoints return expected data
5. Review browser console for frontend errors
