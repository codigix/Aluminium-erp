# Aluminium Precision Casting ERP

A comprehensive Enterprise Resource Planning (ERP) system designed for aluminium precision casting companies. This system manages Buying, Selling, Stock, Manufacturing, and Quality modules with a modern tech stack.

## 🚀 Tech Stack

- **Backend**: Node.js + Express.js + MySQL
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: MySQL 8.0
- **Containerization**: Docker + Docker Compose
- **API**: RESTful with JSON
- **Styling**: Tailwind CSS with custom configuration

## 📁 Project Structure

\\\
.
├── backend/
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Custom middleware
│   │   └── app.js           # Express app setup
│   ├── scripts/
│   │   └── init.sql         # Database initialization
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Card/
│   │   │   ├── Badge/
│   │   │   ├── Alert/
│   │   │   ├── Table/
│   │   │   ├── Modal/
│   │   │   └── Layout/
│   │   ├── pages/           # Page components
│   │   │   ├── Dashboard
│   │   │   ├── Suppliers/
│   │   │   └── PurchaseOrder/
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API services
│   │   ├── styles/          # Global styles
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/              # Static files
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   ├── index.html
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── docker-compose.yml
├── package.json             # Monorepo root config
└── README.md
\\\

## 🎨 UI Components

Pre-built reusable components with Tailwind CSS:

- **Button**: Multiple variants (primary, secondary, outline, danger, ghost) and sizes (sm, md, lg)
- **Input**: Form input with labels, error states
- **Card**: Container with optional hover effects
- **Badge**: Status badges with color variants
- **Alert**: Info, success, warning, danger alerts
- **Table**: Responsive table with head, body, row, header, and cell components
- **Modal**: Dialog component with customizable sizing
- **Layout**: Main application layout with sidebar, header, and footer

## 🎯 Features

### Buying Module
- Supplier Management
- Material Requests (MR)
- Request for Quotation (RFQ)
- Supplier Quotations
- Purchase Orders (PO)
- Purchase Receipts (GRN)
- Purchase Invoices
- Taxes & Charges

### Stock Module
- Inventory Management
- Warehouse Management
- Stock Tracking
- Item Master

### Common Features
- Responsive design with Tailwind CSS
- Role-based structure (ready for RBAC implementation)
- Comprehensive database schema
- RESTful API endpoints
- Docker containerization

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose (recommended)
- Node.js 18+ (for local development)
- npm or yarn

### Using Docker Compose (Recommended)

\\\ash
# Start all services
docker-compose up -d

# Services will be available at:
# - Frontend: http://localhost:5173
# - Backend API: http://localhost:5000
# - MySQL: localhost:3306
\\\

### Local Development

\\\ash
# Install all dependencies
npm run install-all

# Start frontend and backend in development mode
npm run dev

# Or run them separately:
npm run backend    # Runs on http://localhost:5000
npm run frontend   # Runs on http://localhost:5173
\\\

## 📝 Environment Variables

### Backend (.env)
\\\
DB_HOST=localhost
DB_USER=erp_user
DB_PASSWORD=erp_password
DB_NAME=aluminium_erp
DB_PORT=3306
NODE_ENV=development
PORT=5000
\\\

### Frontend (.env)
\\\
VITE_API_URL=http://localhost:5000
\\\

## 🎨 Tailwind CSS Configuration

The project comes with a pre-configured Tailwind theme including:

### Colors
- **Primary**: Blue (for main actions and navigation)
- **Secondary**: Emerald (for success and positive actions)
- **Accent**: Amber (for warnings)
- **Neutral**: Gray (for text and backgrounds)
- **Status**: Danger (red), Success (green), Warning (amber), Info (blue)

### Typography
- **Sans**: Inter (default)
- **Display**: Poppins (headings)
- **Mono**: Fira Code (code)

### Components
- Custom component classes in Tailwind layer
- Reusable button, input, card, table, badge, and alert styles

## 📊 Database Schema

Fully normalized schema with:
- Supplier management (with ratings and groups)
- Material requests and tracking
- RFQ and quotation management
- Purchase orders and receipts
- Invoice management
- Inventory tracking
- Tax configuration

All tables include:
- Proper relationships and foreign keys
- Timestamps (created_at, updated_at)
- Indexes for performance
- Status enumerations

## 🔌 API Endpoints

Example endpoints:

\\\
GET  /api/suppliers           # List all suppliers
POST /api/suppliers           # Create new supplier
GET  /api/suppliers/:id       # Get supplier details
PUT  /api/suppliers/:id       # Update supplier
DELETE /api/suppliers/:id     # Delete supplier

GET  /api/purchase-orders     # List all purchase orders
POST /api/purchase-orders     # Create new PO
GET  /api/purchase-orders/:id # Get PO details

GET  /api/stock               # List all stock
GET  /api/health              # Health check
\\\

## 🛠️ Development

### Adding New Components

Components follow a consistent structure:

\\\jsx
export default function MyComponent({ prop1, prop2, className = '', ...props }) {
  return (
    <div className={\ase-classes \\} {...props}>
      {/* Component content */}
    </div>
  )
}
\\\

### Adding New Pages

Pages should be placed in \rontend/src/pages/\ and imported in \App.jsx\.

### Adding New API Routes

Create route files in \ackend/src/routes/\ and import them in \pp.js\.

## 📦 Build & Deployment

\\\ash
# Build both frontend and backend
npm run build

# Build with Docker
docker-compose build

# Deploy using Docker Compose
docker-compose up -d
\\\

## 📄 License

© 2025 Aluminium Precision Casting ERP. All rights reserved.

## 🤝 Support

For issues or questions, please refer to the documentation or contact the development team.
