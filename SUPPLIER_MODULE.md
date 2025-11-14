# 🏭 SUPPLIER MODULE - Complete Documentation

## Overview
The Supplier module provides comprehensive supplier management for the aluminium precision casting ERP system. It handles all aspects of supplier relationships from basic information management to performance tracking.

---

## 📁 Architecture

### Backend Structure
```
backend/
├── src/
│   ├── models/
│   │   └── SupplierModel.js          # 16+ methods for supplier operations
│   ├── controllers/
│   │   └── SupplierController.js     # 12+ endpoint handlers
│   └── routes/
│       └── suppliers.js              # API route definitions
└── scripts/
    └── database.sql                  # Database schema
```

### Frontend Structure
```
frontend/
└── src/
    └── pages/
        └── Suppliers/
            ├── SupplierList.jsx      # List, search, CRUD operations
            └── SupplierDetail.jsx    # Detailed supplier view
```

---

## 🗄️ Database Schema

### Core Tables
- **supplier** - Main supplier master
- **supplier_group** - Supplier categorization
- **supplier_contact** - Multiple contacts per supplier
- **supplier_address** - Multiple addresses per supplier
- **supplier_scorecard** - Performance metrics

### Key Fields (supplier table)
```sql
supplier_id          VARCHAR(50) PRIMARY KEY
name                 VARCHAR(255) NOT NULL
supplier_group       VARCHAR(100) - links to supplier_group
gstin                VARCHAR(50) - Tax ID
payment_terms_days   INT (default: 30)
lead_time_days       INT (default: 7)
rating               DECIMAL(3,2) - 0-5 scale
is_active            BOOLEAN (default: TRUE)
contact_person_id    VARCHAR(50) - FK to contact
address_id           VARCHAR(50) - FK to address
bank_details         LONGTEXT - JSON storage
```

---

## 📊 Backend API Endpoints

### Core CRUD Operations
```
GET    /api/suppliers                     → Get all suppliers
POST   /api/suppliers                     → Create new supplier
GET    /api/suppliers/:id                 → Get supplier details
PUT    /api/suppliers/:id                 → Update supplier
DELETE /api/suppliers/:id                 → Delete supplier
```

### Advanced Operations
```
GET    /api/suppliers/active              → Get only active suppliers
GET    /api/suppliers/groups              → Get all supplier groups
GET    /api/suppliers/statistics          → Get supplier statistics
GET    /api/suppliers/search              → Search with filters
GET    /api/suppliers/group/:groupName    → Get suppliers by group
PATCH  /api/suppliers/:id/deactivate      → Soft delete (deactivate)
```

### Related Data Endpoints
```
GET    /api/suppliers/:id/contacts        → Get supplier contacts
GET    /api/suppliers/:id/addresses       → Get supplier addresses
GET    /api/suppliers/:id/scorecard       → Get performance scorecard
```

---

## 🔧 Backend Model Methods

### Basic Operations
```javascript
getAll(db)                              // Get all suppliers
getActive(db)                           // Get only active suppliers
getById(db, supplierId)                 // Get supplier by ID
getByName(db, name)                     // Get supplier by name
create(db, supplierData)                // Create new supplier
update(db, supplierId, supplierData)    // Update supplier
delete(db, supplierId)                  // Hard delete
deactivate(db, supplierId)              // Soft delete
```

### Search & Filter
```javascript
search(db, searchTerm, filters)         // Advanced search with filters
getByGroup(db, groupName)               // Get suppliers by group
getGroups(db)                           // Get all supplier groups
```

### Related Data
```javascript
getContacts(db, supplierId)             // Get all contacts
getAddresses(db, supplierId)            // Get all addresses
getScorecardById(db, supplierId)        // Get performance scorecard
addContact(db, supplierId, contactId)   // Link contact
addAddress(db, supplierId, addressId)   // Link address
```

### Analytics
```javascript
getStatistics(db)                       // Get supplier statistics
// Returns: total_suppliers, active_count, avg_rating, highest_rating
```

---

## 💻 Frontend Components

### SupplierList.jsx
**Features:**
- ✅ Fetch suppliers from API
- ✅ Real-time search (by name, ID, GSTIN)
- ✅ Filter by status (Active/Inactive)
- ✅ Add new supplier (modal form)
- ✅ Edit existing supplier (modal form)
- ✅ Delete supplier (confirmation modal)
- ✅ Loading states
- ✅ Error handling
- ✅ Success notifications
- ✅ Responsive table design

**Form Validation:**
- Supplier name (required)
- GSTIN (required)
- Optional: Group, Payment Terms, Lead Time, Rating, Active status

### SupplierDetail.jsx
**Features:**
- ✅ Complete supplier profile
- ✅ Key metrics (status, rating, payment terms, lead time)
- ✅ Basic information section
- ✅ Contacts section (if available)
- ✅ Addresses section (if available)
- ✅ Performance scorecard (if available)
- ✅ Back navigation
- ✅ Edit button
- ✅ Loading and error states

---

## 🎯 Key Features

### 1. **Supplier Management**
- Create, read, update, delete suppliers
- Soft delete (deactivate) option
- Track active vs inactive suppliers
- Support for supplier groups/categories

### 2. **Search & Filter**
- Full-text search by name, ID, GSTIN
- Filter by group
- Filter by active status
- Filter by minimum rating
- Search endpoint with combined filters

### 3. **Contact & Address Management**
- Multiple contacts per supplier
- Multiple addresses per supplier
- Role-based contact tracking
- Full address details (address line 1 & 2, city, state, pincode, country)

### 4. **Performance Tracking**
- Supplier scorecard with quality, delivery, cost scores
- Overall performance score
- Last evaluation date tracking
- Rating system (0-5)

### 5. **Statistics & Analytics**
- Total supplier count
- Active vs inactive count
- Average rating calculation
- Highest rating tracking

---

## 📝 API Request/Response Examples

### Create Supplier
```javascript
POST /api/suppliers
{
  "name": "ABC Industries",
  "supplier_group": "Raw Materials",
  "gstin": "27AABCT1234H1Z0",
  "payment_terms_days": 30,
  "lead_time_days": 7,
  "rating": 4.5,
  "is_active": true
}

Response: {
  "success": true,
  "data": {
    "supplier_id": "SUP-1699856234567",
    "name": "ABC Industries",
    ...
  }
}
```

### Get Supplier with Details
```javascript
GET /api/suppliers/SUP-001

Response: {
  "success": true,
  "data": {
    "supplier_id": "SUP-001",
    "name": "ABC Industries",
    "gstin": "27AABCT1234H1Z0",
    "rating": 4.5,
    "is_active": true,
    "contacts": [...],
    "addresses": [...],
    "scorecard": {...}
  }
}
```

### Search Suppliers
```javascript
GET /api/suppliers/search?term=ABC&group=Raw Materials&active=true

Response: {
  "success": true,
  "data": [
    { supplier objects }
  ]
}
```

### Get Statistics
```javascript
GET /api/suppliers/statistics

Response: {
  "success": true,
  "data": {
    "total_suppliers": 25,
    "active_count": 22,
    "inactive_count": 3,
    "avg_rating": 4.2,
    "highest_rating": 5.0
  }
}
```

---

## 🚀 Usage Examples

### Frontend - List Suppliers
```javascript
import { suppliersAPI } from '../../services/api'

// Get all suppliers
const response = await suppliersAPI.list()

// Get with filters
const response = await suppliersAPI.list({
  params: { active: 'true', search: 'ABC' }
})
```

### Frontend - Create Supplier
```javascript
await suppliersAPI.create({
  name: 'New Supplier',
  gstin: '27AABCT1234H1Z0',
  supplier_group: 'Raw Materials'
})
```

### Frontend - Update Supplier
```javascript
await suppliersAPI.update('SUP-001', {
  rating: 4.8,
  lead_time_days: 5
})
```

### Frontend - Delete Supplier
```javascript
await suppliersAPI.delete('SUP-001')
```

---

## 🔐 Validation Rules

### Create/Update Supplier
| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| name | string | Yes | Not empty |
| gstin | string | Yes | GST format validation |
| supplier_group | string | No | Valid group reference |
| payment_terms_days | number | No | Min: 0 |
| lead_time_days | number | No | Min: 0 |
| rating | number | No | Range: 0-5 |
| is_active | boolean | No | Default: true |

---

## 📊 Performance Scorecard Fields

| Field | Type | Purpose |
|-------|------|---------|
| quality_score | decimal | Quality of materials (0-100) |
| delivery_score | decimal | On-time delivery rate (0-100) |
| cost_score | decimal | Price competitiveness (0-100) |
| overall_score | decimal | Weighted average (0-100) |
| last_evaluated_date | date | When scorecard was last updated |

---

## 🔗 Integration Points

### Stock Module
- When purchasing from supplier, stock levels update
- Reference supplier during stock receipt

### Purchase Order Module
- PO references supplier master
- Uses supplier payment terms
- Tracks supplier performance

### Purchase Invoice Module
- Invoice linked to supplier
- Payment terms applied
- Late payment tracking

### Analytics Module
- Supplier-wise purchase trends
- Supplier performance metrics
- Procurement analysis

---

## 🛠️ Future Enhancements

1. **Supplier Portal** - Self-service portal for suppliers
2. **RFQ Management** - Request for quotations
3. **Payment Reconciliation** - Track payments to suppliers
4. **Compliance Tracking** - GST compliance, documentation
5. **Bulk Import** - CSV/Excel supplier import
6. **Email Integration** - Send communications to contacts
7. **Document Storage** - Attach contracts, certifications
8. **Audit Trail** - Track all supplier changes
9. **Supplier Categories** - Advanced categorization
10. **Bank Details Management** - Secure bank account storage

---

## ✅ Quality Checklist

- ✅ Database schema properly normalized
- ✅ All CRUD operations implemented
- ✅ Advanced search and filtering
- ✅ Frontend components with state management
- ✅ Error handling and validation
- ✅ Loading states and user feedback
- ✅ Responsive design
- ✅ RESTful API endpoints
- ✅ Prepared for integration with other modules
- ✅ Documentation complete

---

## 📞 Support

For issues or questions about the Supplier module:
1. Check this documentation
2. Review API examples above
3. Check error messages in browser console
4. Verify database connection and tables exist
5. Ensure backend server is running on port 5000