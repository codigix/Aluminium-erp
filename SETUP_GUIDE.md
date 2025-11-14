# Aluminium Precision Casting ERP - Setup Guide

## Overview
This is a comprehensive ERP system for an aluminium precision casting company with modules for Buying, Selling, Stock, Manufacturing, and Quality management.

## Project Structure

```
aluminium_erp/
├── backend/              # Express.js API server
│   ├── src/
│   │   ├── app.js       # Main application file
│   │   ├── models/      # Database models
│   │   ├── controllers/ # Business logic
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Middleware
│   │   └── config/      # Configuration
│   └── scripts/
│       ├── database.sql # MySQL schema
│       └── migration.js # Database migration script
│
└── frontend/            # React + Vite application
    ├── src/
    │   ├── pages/       # Page components
    │   ├── components/  # Reusable components
    │   ├── hooks/       # Custom hooks
    │   └── services/    # API services
    └── public/          # Static files
```

## Prerequisites

- **Node.js**: v16 or higher
- **MySQL**: v5.7 or higher
- **npm**: v8 or higher

## Installation Steps

### 1. Clone/Setup Project

```bash
# Navigate to project root
cd c:\repo
```

### 2. Install Dependencies

```bash
# Install both backend and frontend dependencies
npm install

# Or install specific workspace
npm install -w backend
npm install -w frontend
```

### 3. Configure Environment

Create `.env` file in backend directory:

```env
# Backend/.env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=aluminium_erp
DB_PORT=3306
NODE_ENV=development
PORT=5000
```

### 4. Setup MySQL Database

```bash
# Run migration script (from project root)
node backend/scripts/migration.js
```

This will:
- Create the `aluminium_erp` database
- Create all tables for the Buying module
- Insert sample data (suppliers, items, warehouses, contacts)

### 5. Run Development Servers

```bash
# From root directory - runs both backend and frontend concurrently
npm run dev

# Or run them separately:
# Terminal 1: npm run dev -w backend
# Terminal 2: npm run dev -w frontend
```

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Buying Module Endpoints

#### Purchase Orders
- `POST /purchase-orders` - Create PO
- `GET /purchase-orders` - List all POs
- `GET /purchase-orders/:po_no` - Get PO details
- `PUT /purchase-orders/:po_no` - Update PO
- `DELETE /purchase-orders/:po_no` - Delete PO
- `POST /purchase-orders/:po_no/submit` - Submit PO

#### Items
- `POST /items` - Create item
- `GET /items` - List items
- `GET /items/groups` - Get item groups
- `GET /items/:item_code` - Get item details
- `PUT /items/:item_code` - Update item
- `DELETE /items/:item_code` - Delete item (soft delete)
- `GET /items/:item_code/stock` - Get stock information

#### Purchase Receipts (GRN)
- `POST /purchase-receipts` - Create GRN
- `GET /purchase-receipts` - List GRNs
- `GET /purchase-receipts/:grn_no` - Get GRN details
- `PUT /purchase-receipts/:grn_no/items/:grn_item_id` - Update GRN item
- `POST /purchase-receipts/:grn_no/accept` - Accept GRN
- `POST /purchase-receipts/:grn_no/reject` - Reject GRN
- `DELETE /purchase-receipts/:grn_no` - Delete GRN

#### Purchase Invoices
- `POST /purchase-invoices` - Create invoice
- `GET /purchase-invoices` - List invoices
- `GET /purchase-invoices/:invoice_no` - Get invoice details
- `POST /purchase-invoices/:invoice_no/submit` - Submit invoice
- `POST /purchase-invoices/:invoice_no/mark-paid` - Mark as paid
- `DELETE /purchase-invoices/:invoice_no` - Delete invoice

#### Suppliers (Existing)
- `GET /suppliers` - List suppliers
- `POST /suppliers` - Create supplier
- And other CRUD operations...

## Frontend Routes

```
Home
├── /                           # Dashboard
├── /buying/purchase-orders     # PO List
├── /buying/purchase-order/new  # Create PO
├── /buying/purchase-order/:id  # Edit PO
├── /buying/purchase-receipts   # GRN List
├── /buying/purchase-invoices   # Invoice List
└── /buying/items               # Items Master
```

## Database Schema - Buying Module

### Core Tables
- **supplier** - Supplier information
- **supplier_group** - Supplier categories
- **contact** - Contact persons
- **address** - Address information
- **item** - Product items
- **warehouse** - Storage locations

### Purchasing Flow
1. **material_request** - Requirement raised
2. **rfq** - Request for Quotation sent
3. **supplier_quotation** - Supplier responds
4. **purchase_order** - Order placed
5. **purchase_receipt** - Goods received
6. **purchase_invoice** - Invoice received

### Stock Management
- **stock** - Current stock levels
- **stock_ledger** - Stock transaction history

## Sample Data

The migration script creates sample data:
- **3 Suppliers** (Raw Materials, Components, Services)
- **3 Warehouses** (Main, Secondary, QC Store)
- **3 Contacts** (Managers)
- **3 Addresses** (Locations)
- **5 Items** (various categories)
- **1 Tax Template** (18% GST)

## Features Implemented

### Buying Module ✓
- [x] Supplier management with ratings
- [x] Item/Product master
- [x] Purchase Orders with multiple items
- [x] Goods Receipt Notes (GRN) with quality inspection
- [x] Purchase Invoices with tax calculation
- [x] Stock management
- [x] Status workflows

### UI Components ✓
- [x] Dashboard with stats and quick actions
- [x] List views with filtering
- [x] Forms for data entry
- [x] Table components with sorting
- [x] Badge indicators for status
- [x] Button variations
- [x] Input components
- [x] Cards for layout

### Backend Features ✓
- [x] RESTful APIs
- [x] Database relationships
- [x] Business logic (workflows, validations)
- [x] Stock ledger tracking
- [x] Tax calculations
- [x] Error handling

## Next Steps - Future Modules

### Selling Module
- Customers & Customer Groups
- Quotations
- Sales Orders
- Delivery Notes
- Sales Invoices

### Manufacturing Module
- Bill of Materials (BOM)
- Production Orders
- Work Orders
- Quality Inspections
- Finished Goods

### Stock Module (Advanced)
- Stock transfers between warehouses
- Stock reconciliation
- ABC analysis
- Reorder point management

### Reports & Analytics
- Purchase analytics
- Supplier performance
- Stock valuation
- Monthly reports

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:3306
```
- Ensure MySQL is running
- Check DB credentials in .env file
- Verify database name exists

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
```bash
# Kill the process using the port
taskkill /IM node.exe /F
```

### Migration Script Fails
```bash
# Run migration with more details
node backend/scripts/migration.js --debug
```

## Performance Optimization

- Database indexes on frequently queried fields
- Connection pooling (10 connections)
- Query optimization with JOINs
- Frontend lazy loading of components

## Security Considerations

- Input validation on all APIs
- SQL injection prevention (prepared statements)
- CORS enabled for development
- Environment variables for sensitive data

## Development Tips

### Adding a New Entity

1. Create model in `backend/src/models/EntityModel.js`
2. Create controller in `backend/src/controllers/entityController.js`
3. Create routes in `backend/src/routes/entities.js`
4. Import routes in `backend/src/app.js`
5. Create frontend pages in `frontend/src/pages/Module/`
6. Add routes in `frontend/src/App.jsx`

### Database Changes

1. Update schema in `backend/scripts/database.sql`
2. Re-run migration:
   ```bash
   # Drop database and recreate (be careful in production!)
   mysql -u root -p -e "DROP DATABASE aluminium_erp;"
   node backend/scripts/migration.js
   ```

## Support

For issues or questions:
1. Check error messages in console
2. Review database schema
3. Verify API responses using curl or Postman
4. Check browser console for frontend errors

## License

This project is confidential and proprietary.

---

**Version**: 1.0.0  
**Last Updated**: 2025  
**Status**: Phase 1 (Buying Module Complete)