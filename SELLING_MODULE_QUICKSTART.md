# Selling Module - Quick Start Guide

## 🚀 Getting Started with the Selling Module

The Selling Module has been fully integrated into your ERP system. Here's how to use each page:

## 📍 Navigation

Access the Selling Module from the sidebar:
- **Selling Module** (in main navigation)
  - Quotations
  - Sales Orders
  - Delivery Notes
  - Sales Invoices
  - Customers

Plus Analytics:
- **Analytics** → Selling Analytics

---

## 1️⃣ Quotations (`/selling/quotations`)

### What it does
Creates and manages customer quotations for product offerings.

### Key Statuses
- **Draft** 🟡 - Quote in preparation, not yet sent
- **Sent** 🔵 - Quote sent to customer, awaiting response
- **Accepted** 🟢 - Customer approved, ready for sales order
- **Converted** ⚫ - Converted to Sales Order
- **Cancelled** 🔴 - Quote rejected or no longer needed

### Step-by-step workflow

```
1. Click "New Quotation"
   ├─ Fill customer details
   ├─ Add items with pricing
   ├─ Set valid-till date
   └─ Save as Draft

2. Review and Edit (Draft only)
   └─ Update details as needed

3. Send to Customer
   ├─ Click "Send" button (Mail icon)
   ├─ System marks status as "Sent"
   └─ Customer receives quotation

4. Await Acceptance
   └─ Status changes to "Accepted" when customer approves

5. Convert to Sales Order
   ├─ Click Convert button (File icon)
   ├─ Creates new Sales Order with same items
   └─ Quotation marked as "Converted"
```

### Statistics Tracked
- Total Quotations: Count of all quotes
- Draft: Quotes not yet sent
- Sent: Quotes awaiting response
- Accepted: Quotes approved and ready
- Total Value: Sum of all quote amounts

### Actions Available
- 👁️ **View** - See full quotation details
- ✏️ **Edit** - Modify draft quotes
- 📤 **Send** - Send to customer (draft only)
- 🔄 **Convert** - Create sales order (accepted only)
- 🗑️ **Delete** - Remove quotation

---

## 2️⃣ Sales Orders (`/selling/sales-orders`)

### What it does
Manages customer orders from confirmation through dispatch.

### Key Statuses
- **Draft** 🟡 - Order created but not confirmed
- **Confirmed** 🔵 - Order approved, ready for dispatch (stock checked)
- **Dispatched** 🔵 - Goods sent to customer
- **Invoiced** 🟢 - Order completed and invoiced
- **Cancelled** 🔴 - Order cancelled

### Step-by-step workflow

```
1. Create New Sales Order
   ├─ From Quotation (Convert from accepted quote)
   ├─ Or manually create new
   ├─ Fill order details
   ├─ Add items with quantities
   └─ Save as Draft

2. Confirm Order (Draft only)
   ├─ Click "Confirm" button (Checkmark)
   ├─ System checks:
   │  ├─ Stock availability
   │  ├─ Customer credit limit
   │  └─ Material requirements
   ├─ Status changes to "Confirmed"
   └─ Production notified if needed

3. Create Delivery Note (Confirmed only)
   ├─ Click "Create Delivery Note" (Truck icon)
   ├─ Delivery Note created with same items
   ├─ Record actual quantities being shipped
   └─ Submit for stock reduction

4. Track Invoicing
   ├─ Delivery Note Submitted
   ├─ Create Sales Invoice
   └─ Status changes to "Invoiced"
```

### Statistics Tracked
- Total Orders: Count of all sales orders
- Draft: Not yet confirmed
- Confirmed: Ready for dispatch
- Dispatched: In transit
- Total Value: Sum of order amounts

### Actions Available
- 👁️ **View** - See full order details
- ✏️ **Edit** - Modify draft orders
- ✅ **Confirm** - Approve order and check stock
- 🚚 **Create Delivery Note** - From confirmed orders
- 🗑️ **Delete** - Remove order

---

## 3️⃣ Delivery Notes (`/selling/delivery-notes`)

### What it does
Records actual goods dispatch and automatically reduces warehouse stock.

### Key Statuses
- **Draft** 🟡 - Note prepared but not yet submitted
- **Submitted** 🔵 - Goods in transit, stock reduced
- **Delivered** 🟢 - Goods received by customer
- **Partially Delivered** 🟡 - Some items delivered, more pending
- **Cancelled** 🔴 - Delivery cancelled

### Step-by-step workflow

```
1. Create Delivery Note
   ├─ From Sales Order (Confirmed only)
   ├─ Link one or multiple orders
   ├─ Record quantities being shipped
   ├─ Add vehicle/transporter details
   └─ Save as Draft

2. Review and Edit (Draft only)
   ├─ Verify quantities
   ├─ Add dispatch location
   └─ Attach proof of delivery (optional)

3. Submit Delivery Note
   ├─ Click "Submit" button
   ├─ System automatically:
   │  ├─ Reduces warehouse stock
   │  ├─ Changes status to "Submitted"
   │  └─ Creates invoice draft
   └─ Goods now in transit

4. Track Delivery
   ├─ Monitor delivery status
   ├─ Update when goods arrive
   └─ Mark as "Delivered"
```

### Statistics Tracked
- Total Notes: Count of all delivery notes
- Draft: Not yet submitted
- Submitted: In transit (stock reduced)
- Delivered: Successfully delivered
- Qty Delivered: Total units shipped

### Actions Available
- 👁️ **View** - See delivery details and tracking
- ✏️ **Edit** - Modify draft notes
- 📤 **Submit** - Confirm shipment (reduces stock)
- 🗑️ **Delete** - Remove note

---

## 4️⃣ Sales Invoices (`/selling/sales-invoices`)

### What it does
Creates customer invoices and tracks payment status.

### Key Statuses (Invoice)
- **Draft** 🟡 - Invoice created but not sent
- **Submitted** 🔵 - Invoice sent to customer
- **Paid** 🟢 - Invoice fully paid
- **Cancelled** 🔴 - Invoice cancelled

### Payment Statuses
- **Unpaid** 🔴 - No payment received
- **Partially Paid** 🟡 - Some payment received
- **Paid** 🟢 - Full payment received

### Step-by-step workflow

```
1. Create Sales Invoice
   ├─ From Delivery Note (auto-fetch details)
   ├─ Or from Sales Order
   ├─ System auto-calculates:
   │  ├─ Taxes (GST, TDS)
   │  ├─ Discounts
   │  └─ Total amount
   └─ Save as Draft

2. Review Invoice (Draft only)
   ├─ Verify all details
   ├─ Check calculations
   ├─ Set payment terms
   └─ Ready to send

3. Submit Invoice
   ├─ Click "Submit" button
   ├─ Invoice sent to customer
   ├─ Status: "Submitted"
   └─ Payment tracking starts

4. Record Payment
   ├─ Customer makes payment
   ├─ Click "Record Payment" (Credit Card icon)
   ├─ Enter payment amount
   ├─ Update payment status:
   │  ├─ Partially Paid (if partial)
   │  └─ Paid (if full)
   └─ Update outstanding amount

5. Track Payment Status
   ├─ Monitor pending amounts
   ├─ Track overdue invoices
   ├─ Send payment reminders
   └─ Record additional payments
```

### Statistics Tracked
- Total Invoices: Count of all invoices
- Pending: Unpaid invoices
- Paid: Fully paid invoices
- Total Value: Sum of invoice amounts
- Collected: Total amount received

### Actions Available
- 👁️ **View** - See invoice details
- ✏️ **Edit** - Modify draft invoices
- 📤 **Submit** - Send to customer
- 💳 **Record Payment** - Track payment received
- 🗑️ **Delete** - Remove invoice

---

## 5️⃣ Customers (`/selling/customers`)

### What it does
Maintains customer master data and credit information.

### Key Fields
- Company Name
- Email & Phone
- GST Number
- Credit Limit (maximum they can owe)
- Customer Status (Active/Inactive)
- Billing & Shipping Addresses

### Step-by-step workflow

```
1. Create New Customer
   ├─ Click "New Customer"
   ├─ Fill basic details:
   │  ├─ Company name
   │  ├─ Contact details
   │  └─ GST number
   ├─ Set credit limit
   └─ Save

2. Add Details
   ├─ Multiple addresses (billing/shipping)
   ├─ Customer group (OEM, Dealer, Local, Export)
   ├─ Payment terms preference
   └─ Key contacts for follow-up

3. Activate/Deactivate
   ├─ Set status to "Active" for orders
   ├─ Mark as "Inactive" if not ordering
   └─ Can reactivate anytime

4. Use in Orders
   ├─ Select when creating quotation
   ├─ System pulls credit limit
   ├─ Validates against outstanding balance
   └─ Prevents over-credit sales
```

### Statistics Tracked
- Total Customers: Count of all customers
- Active: Customers status as "Active"
- Inactive: Customers status as "Inactive"
- Total Credit: Sum of all credit limits
- Top Customer: Highest sales value

### Actions Available
- 👁️ **View** - See customer profile
- ✏️ **Edit** - Update customer details
- 🗑️ **Delete** - Remove customer

---

## 📊 Selling Analytics (`/analytics/selling`)

### What it shows
High-level sales performance insights and trends.

### Key Metrics
- **Total Sales** (₹): Sum of all invoice values
- **Total Orders**: Count of sales orders
- **Average Order Value** (₹): Sales ÷ Orders
- **Conversion Rate** (%): Quotations → Orders conversion

### Insights
- **Top Customer**: Customer with highest sales
- **Top Product**: Most sold item by units
- **Order Status Breakdown**: Distribution by status
- **Payment Status**: Paid vs Unpaid amounts

### Time Periods Available
- Weekly: Last 7 days trend
- Monthly: Last 30 days trend
- Quarterly: Last 90 days trend
- Yearly: Last 12 months trend

### Export Option
- Download analytics as Excel file
- Use for reports and presentations
- Analyze in spreadsheet tools

---

## 🔄 Complete Workflow Example

### From Quote to Payment

```
MONTH 1 - Sales Quotation
Day 1:   Create quotation for ABC Corp (₹100,000)
Day 2:   Send quotation to customer
Day 5:   Customer accepts quotation ✅

MONTH 1 - Sales Order
Day 6:   Convert to Sales Order
         System checks: Stock ✅, Credit limit ✅
         Order status: Confirmed
         Production starts

MONTH 1 - Delivery
Day 15:  Create Delivery Note with 100 units
Day 16:  Submit Delivery Note
         System reduces warehouse stock by 100 units ✅
         Status: Submitted (in transit)

MONTH 1 - Invoicing
Day 18:  Create Sales Invoice (₹100,000)
         System auto-calculates:
         - Base amount: ₹100,000
         - GST 18%: ₹18,000
         - Total: ₹118,000
Day 19:  Submit Invoice to customer
         Payment status: Unpaid

MONTH 2 - Payment
Day 25:  Receive payment of ₹59,000
         Record payment
         Payment status: Partially Paid (₹59,000 / ₹118,000)

MONTH 2 - Final Payment
Day 28:  Receive payment of ₹59,000
         Record payment
         Payment status: Paid ✅
         Invoice complete

OVERALL METRICS (visible in Analytics):
- 1 quotation converted
- 1 sales order completed
- 118,000 invoice value collected
- Collection rate: 100%
```

---

## 💡 Tips & Best Practices

### 1. Always Create Quotation First
- Gives customer time to decide
- Easier to track negotiation
- Builds audit trail

### 2. Review Before Sending
- Check all prices and calculations
- Verify customer details
- Ensure taxes are correct

### 3. Confirm Orders Early
- Allows production planning
- Catches credit limit issues early
- Triggers stock checks

### 4. Delivery Notes Are Critical
- Reduces stock automatically
- Creates audit trail
- Supports partial deliveries

### 5. Invoice Promptly
- Send invoice same day as delivery
- Faster payment collection
- Better cash flow

### 6. Track Payments Regularly
- Update payment status immediately
- Send reminders for overdue
- Know outstanding balance

---

## ❓ Common Questions

**Q: Can I edit a quotation after sending it?**
A: No, once sent, you must cancel and create a new one for revision.

**Q: What if customer wants to change order quantity?**
A: Edit the draft order before confirming. After confirmed, you'll need to cancel and create new.

**Q: Can one delivery note contain items from multiple sales orders?**
A: Yes, if they're going to same customer. This helps consolidate shipments.

**Q: What happens if payment is partial?**
A: Status stays "Partially Paid". Record additional payments to complete it.

**Q: Can I see sales trends?**
A: Yes, visit "Selling Analytics" for trends, top customers, and performance metrics.

**Q: What if delivery happens in stages?**
A: Create delivery note with first batch, mark as "Partially Delivered". Create another for remaining items.

---

## 🎯 Typical Daily Workflow

### Sales Executive
```
Morning:
- Check "Quotations" → Send any ready quotes
- Review "Sales Orders" → Confirm new orders

Afternoon:
- Monitor "Sales Invoices" → Send pending invoices
- Check "Customers" → Manage customer relationships
```

### Store/Warehouse Manager
```
Morning:
- Review "Delivery Notes" draft
- Prepare shipments

Afternoon:
- Submit delivery notes → stock reduced
- Record dispatch
```

### Accounts Team
```
Morning:
- Check "Sales Invoices" → Unpaid list
- Send payment reminders

Afternoon:
- Record payments in system
- Update payment status
- Generate daily collection report
```

### Management
```
Daily:
- Check KPI cards on each page for overview

Weekly:
- Review "Selling Analytics" dashboard
- Monitor conversion rates
- Check collection performance
```

---

## 📞 Support

For issues or questions:
1. Check the main implementation guide: `SELLING_MODULE_IMPLEMENTATION.md`
2. Review status workflows on each page
3. Verify data is synced with backend API
4. Check browser console for errors

---

**Ready to start selling! Happy invoicing! 🚀**