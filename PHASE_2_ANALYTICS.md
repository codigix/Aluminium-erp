# Phase 2: Enhanced Buying Analytics & Dashboards

## Overview
Phase 2 adds comprehensive analytics and business intelligence to the Buying module, including real-time KPIs, performance metrics, trend analysis, and alert management.

## New Features

### 1. **Buying Analytics Dashboard** (`/buying/analytics`)
A comprehensive analytics page with multiple tabs and real-time metrics.

#### KPI Cards
- **Total POs**: Count of all purchase orders with completion status
- **Total PO Value**: Aggregate purchasing spend with averages
- **Total Invoices**: Invoice tracking with pending amount warnings
- **Paid Amount**: Payment tracking with paid invoice count

#### Tabs Available
1. **Overview Tab**
   - PO Status Distribution (Pie Chart)
   - Invoice Status (Bar Chart)
   - Real-time summary metrics

2. **Top Suppliers Tab**
   - Top 10 suppliers by PO value
   - PO count per supplier
   - Supplier completion rates
   - Average PO values
   - Sortable, responsive table

3. **Trends Tab**
   - PO count trends over time
   - PO value trends (Line Chart)
   - Date range selector (customizable)
   - Dual-axis visualization

4. **Alerts Tab**
   - Overdue POs (days overdue)
   - Pending GRNs (outstanding receipts)
   - Quick status indicators
   - Color-coded severity levels

5. **Aging Analysis Tab**
   - Invoice aging buckets (0-30, 30-60, 60-90, 90+ days)
   - Pending payment amounts by bucket
   - Bar chart visualization
   - Summary metrics

### 2. **Backend Analytics Model** (`BuyingAnalyticsModel.js`)

#### Core Analytics Methods
- `getPOSummary()` - Overall PO statistics
- `getPOTrends(startDate, endDate)` - Time-series PO data
- `getTopSuppliers(limit)` - Top suppliers by value
- `getSupplierPerformance(supplierId)` - Detailed supplier metrics
- `getItemPOSummary(limit)` - Item-wise purchase analysis
- `getReceiptAnalytics(startDate, endDate)` - GRN performance metrics
- `getInvoicePaymentAnalytics()` - Invoice payment tracking
- `getAgingAnalysis()` - Unpaid invoice aging
- `getCostAnalysis(periodType)` - Cost by supplier and period
- `getPurchaseByCategory()` - Purchases by item group
- `getOverduePOs()` - Overdue purchase orders
- `getPendingGRNs()` - Outstanding GRNs

#### Analytics Metrics Provided
- **PO Metrics**: Count, value (total/avg/min/max), status distribution
- **Supplier Metrics**: PO completion rate, acceptance rate, days since last order
- **Receipt Metrics**: GRN count, acceptance rates, rejection tracking
- **Invoice Metrics**: Payment status, aging, days to pay, pending amounts
- **Item Analytics**: Purchase frequency, rate variations, total volume

### 3. **Analytics API Endpoints** (`/api/analytics/*`)

```
GET /api/analytics/buying/summary
GET /api/analytics/buying/po-trends?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET /api/analytics/buying/top-suppliers?limit=10
GET /api/analytics/buying/supplier/:supplierId
GET /api/analytics/buying/items?limit=20
GET /api/analytics/buying/category
GET /api/analytics/buying/receipts?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
GET /api/analytics/buying/pending-grns
GET /api/analytics/buying/invoices
GET /api/analytics/buying/aging
GET /api/analytics/buying/cost-analysis?period=month|quarter|year
GET /api/analytics/buying/overdue-pos
```

### 4. **Database Optimizations**
- Indexed analytics queries for fast performance
- Aggregation functions for real-time calculations
- Soft delete support in all analytics queries
- Connection pooling for concurrent requests

### 5. **UI/UX Enhancements**
- **Date Range Picker**: Custom date selection for trends
- **Responsive Charts**: Mobile-friendly Recharts visualizations
- **Color-Coded Alerts**: Red for overdue, amber for pending
- **Tabbed Interface**: Easy navigation between analytics views
- **Real-time Updates**: Fetch all analytics data on page load and date change

## Integration Points

### Updated Files
1. **Backend**
   - `src/app.js` - Added analytics route registration
   - `src/routes/analyticsRoutes.js` - New analytics routes

2. **Frontend**
   - `src/App.jsx` - Added BuyingAnalytics route
   - `src/pages/Dashboard.jsx` - Added Analytics quick action button
   - `src/components/Layout/Layout.jsx` - Added sidebar menu item

### New Files
- `backend/src/models/BuyingAnalyticsModel.js`
- `backend/src/controllers/BuyingAnalyticsController.js`
- `backend/src/routes/analyticsRoutes.js`
- `frontend/src/pages/Buying/BuyingAnalytics.jsx`

## Key Metrics & Calculations

### Supplier Performance
```
Completion Rate = (Completed POs / Total POs) × 100
Acceptance Rate = (Accepted GRNs / Total GRNs) × 100
Days Since Last PO = Current Date - Last PO Order Date
```

### Invoice Aging
```
Current: Days Since Invoice ≤ 30
30-60: 30 < Days Since Invoice ≤ 60
60-90: 60 < Days Since Invoice ≤ 90
90+: Days Since Invoice > 90
```

### Cost Analysis
Groupable by:
- Month (YYYY-MM)
- Quarter (YYYY-Q)
- Year (YYYY)

## Performance Considerations
- All queries use proper indexing
- Aggregate functions used instead of application-level calculations
- Date range filtering to reduce dataset size
- Connection pooling with 10 connections
- Pagination support for large datasets

## Next Steps
- Add export functionality (CSV/PDF reports)
- Implement budget vs. actual comparison
- Add supplier scorecard automation
- Create custom dashboard builder
- Add email-based alert notifications

## Testing Analytics

1. **Access Analytics Dashboard**
   ```
   http://localhost:5173/buying/analytics
   ```

2. **Verify KPI Cards Display**
   - Check PO summary data
   - Verify invoice amounts
   - Validate completion rates

3. **Test Date Range Selector**
   - Change dates and verify chart updates
   - Confirm trend data changes

4. **Check Alerts**
   - Verify overdue POs list
   - Check pending GRNs
   - Validate severity indicators

5. **Supplier Performance**
   - Click on top suppliers tab
   - Verify metrics calculation
   - Check completion rates

## Troubleshooting

### No Data Displayed
1. Ensure sample data was loaded during migration
2. Check database connection in backend
3. Verify analytics queries in MySQL

### Chart Not Loading
1. Check browser console for errors
2. Verify Recharts library import
3. Ensure API endpoints are responding

### Performance Issues
1. Check MySQL slow query log
2. Verify database indexes exist
3. Reduce date range for testing

## API Response Format

### Successful Response
```json
{
  "success": true,
  "data": {
    "metric_name": "value",
    "nested": {
      "sub_metric": "value"
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```