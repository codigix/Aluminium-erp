# Architecture Documentation

## System Overview

The Aluminium Precision Casting ERP is built using a modern full-stack architecture with clear separation of concerns.

\\\
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│         React + Vite + Tailwind CSS (Port 5173)             │
├─────────────────────────────────────────────────────────────┤
│                    HTTP/REST API Layer                       │
│         Express.js Backend (Port 5000)                       │
├─────────────────────────────────────────────────────────────┤
│                    Database Layer                            │
│         MySQL 8.0 (Port 3306)                               │
└─────────────────────────────────────────────────────────────┘
\\\

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Database Driver**: mysql2/promise
- **Utilities**: dotenv, uuid, cors
- **Architecture**: MVC (Model-View-Controller)

### Frontend
- **Library**: React 18
- **Build Tool**: Vite 5.x
- **Styling**: Tailwind CSS 3.x
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Components**: Custom reusable component library

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Database**: MySQL 8.0

## Folder Structure

### Backend

\\\
backend/
├── src/
│   ├── app.js                    # Express app setup
│   ├── config/
│   │   └── config.js             # Configuration manager
│   ├── models/                   # Database models
│   │   ├── SupplierModel.js
│   │   ├── PurchaseOrderModel.js
│   │   └── ...
│   ├── controllers/              # Business logic
│   │   ├── SupplierController.js
│   │   ├── PurchaseOrderController.js
│   │   └── ...
│   ├── routes/                   # API endpoints
│   │   ├── suppliers.js
│   │   ├── purchaseOrders.js
│   │   └── ...
│   └── middleware/               # Custom middleware
│       └── errorHandler.js
├── scripts/
│   └── init.sql                  # Database schema
├── Dockerfile
├── package.json
└── .env.example
\\\

### Frontend

\\\
frontend/
├── src/
│   ├── main.jsx                  # Vite entry point
│   ├── App.jsx                   # Root component
│   ├── App.css                   # App styles
│   ├── components/               # Reusable components
│   │   ├── Button/
│   │   ├── Input/
│   │   ├── Card/
│   │   ├── Badge/
│   │   ├── Alert/
│   │   ├── Table/
│   │   ├── Modal/
│   │   └── Layout/
│   ├── pages/                    # Page components
│   │   ├── Dashboard.jsx
│   │   ├── Suppliers/
│   │   ├── PurchaseOrder/
│   │   └── ...
│   ├── hooks/                    # Custom hooks
│   │   └── useModal.js
│   ├── services/                 # API clients
│   │   └── api.js
│   └── styles/
│       └── index.css             # Global styles
├── public/                       # Static assets
├── index.html                    # HTML entry point
├── tailwind.config.js            # Tailwind configuration
├── postcss.config.js             # PostCSS configuration
├── vite.config.js                # Vite configuration
├── Dockerfile
├── package.json
└── .env.example
\\\

## Data Flow

### 1. User Interaction
\\\
User Action → Component State Update → API Call
\\\

### 2. Backend Processing
\\\
API Request → Route Handler → Controller → Model → Database
\\\

### 3. Response
\\\
Database → Model → Controller → Response → Frontend → UI Update
\\\

## Component Architecture

### Reusable Components

Each component is built with flexibility and reusability in mind:

`jsx
// Button Component Example
export default function Button({ 
  children, 
  variant = 'primary',    // Style variant
  size = 'md',            // Size variant
  disabled = false,       // State
  onClick,                // Handler
  className = '',         // Additional classes
  ...props                // Spread props
}) {
  return (
    <button className={/* computed classes */}>
      {children}
    </button>
  )
}
`

**Key Principles:**
- Props-based configuration
- Default values for common cases
- Support for custom className
- Spread operator for additional props
- TypeScript-ready (can add types later)

### Layout System

The Layout component provides:
- **Sidebar Navigation**: Collapsible menu with icons
- **Header**: Application title and user controls
- **Content Area**: Main scrollable content
- **Footer**: Copyright and information

## Styling Architecture

### Tailwind CSS Configuration

The project uses a centralized Tailwind configuration (\	ailwind.config.js\) that defines:

**Color System:**
- Primary: Blue (#3b82f6) - Main actions
- Secondary: Emerald (#22c55e) - Success/positive
- Accent: Amber (#f59e0b) - Warnings
- Neutral: Gray - Text and backgrounds
- Status: Danger, Info colors

**Typography:**
- Sans: Inter (default)
- Display: Poppins (headings)
- Mono: Fira Code (code)

**Component Classes:**
- \.btn\ - Base button styles
- \.input-base\ - Form input styles
- \.card\ - Container styles
- \.badge\ - Status badges
- \.table-base\ - Table styles
- \.alert\ - Alert messages

### Global Styles

\rontend/src/styles/index.css\ includes:
- Base layer customizations (typography)
- Component layer reusable styles
- Utility layer helpers

## Database Architecture

### Schema Design

**Key Design Principles:**
1. **Normalization**: Separate tables for different entities
2. **Relationships**: Foreign keys maintain data integrity
3. **Indexes**: On frequently searched columns for performance
4. **Timestamps**: Track creation and updates
5. **Status Enumerations**: ENUM type for state fields

### Database Modules

**Buying Module:**
- Suppliers and supplier groups
- Material requests
- RFQ and quotations
- Purchase orders and receipts
- Purchase invoices

**Stock Module:**
- Items master
- Warehouses
- Stock levels
- Batch tracking

### Query Optimization

- Indexes on commonly searched fields (name, GSTIN, status)
- Foreign key constraints for referential integrity
- Connection pooling with mysql2/promise

## API Design

### RESTful Principles

- **Resources**: Each entity is a resource
- **Methods**: CRUD operations use HTTP methods
- **Status Codes**: Proper HTTP codes for responses
- **Consistent Format**: JSON request/response

### Response Format

All responses follow a consistent structure:

`json
{
  "success": true/false,
  "data": {...},        // For GET/POST/PUT
  "message": "...",     // For DELETE/errors
  "error": "..."        // For errors
}
`

### Error Handling

Central error handling middleware catches:
- Validation errors
- Database errors
- Not found errors
- Server errors

Returns consistent error responses with appropriate HTTP codes.

## Scalability Considerations

### Current Limitations & Future Improvements

1. **Authentication**: Ready for JWT token implementation
2. **Authorization**: Role-based access control structure in place
3. **Caching**: Can add Redis for frequently accessed data
4. **Load Balancing**: Docker Swarm or Kubernetes for horizontal scaling
5. **Database**: Can migrate to managed services (AWS RDS, etc.)
6. **API Rate Limiting**: Middleware for rate limiting can be added
7. **Logging**: Structured logging with log levels can be implemented
8. **Monitoring**: Prometheus/Grafana for metrics

## Development Workflow

### Adding a New Feature

1. **Database**: Add tables/columns to \init.sql\
2. **Backend**:
   - Create model in \src/models/\
   - Create controller in \src/controllers/\
   - Create routes in \src/routes/\
   - Register routes in \src/app.js\
3. **Frontend**:
   - Create components if needed
   - Create page component in \src/pages/\
   - Add route in \App.jsx\
   - Create API service in \src/services/\
   - Use in components with handlers

### Testing Workflow

Current approach: Manual testing via UI and API calls

Future: Add Jest, Supertest for automated testing

## Deployment Architecture

### Docker Compose Setup

Services:
- **MySQL**: Database service
- **Backend**: Express API service (depends on MySQL)
- **Frontend**: Vite + serve for static files (depends on backend)

### Production Considerations

1. **Environment Variables**: Use .env for secrets
2. **Database Backups**: Regular MySQL backups
3. **Logging**: Centralized logging for debugging
4. **Health Checks**: Container health monitoring
5. **Updates**: Zero-downtime deployment strategy

## Security Considerations

### Current Implementation
- CORS enabled for cross-origin requests
- Input validation at model level
- SQL injection prevention via parameterized queries
- Connection pooling for database

### Future Enhancements
- JWT authentication
- Role-based access control (RBAC)
- Input sanitization middleware
- HTTPS/TLS for encrypted communication
- Rate limiting and DDoS protection
- Security headers (CSP, X-Frame-Options, etc.)

## Performance Optimization

### Current
- MySQL connection pooling
- Indexed database queries
- React component optimization with proper keys

### Future Enhancements
- Redis caching layer
- API response caching
- Database query optimization
- Frontend code splitting and lazy loading
- Image optimization and CDN
- Gzip compression

## Monitoring & Debugging

### Backend
- Console logging for development
- Error stack traces in development mode
- Health check endpoint

### Frontend
- React DevTools browser extension
- Network tab for API debugging
- Console for JavaScript errors
- Source maps in development

## Version Control

- \.gitignore\: Excludes node_modules, .env, dist, build
- Conventional commit messages recommended
- Feature branches for new development

---

**This architecture provides a solid foundation for building a scalable, maintainable ERP system with clear separation of concerns and room for future enhancements.**
