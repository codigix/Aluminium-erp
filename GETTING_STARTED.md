# Getting Started with Aluminium Precision Casting ERP

This guide will help you set up and run the ERP system on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Docker & Docker Compose** (Recommended)
  - Download from https://www.docker.com/products/docker-desktop
  - Verify installation: \docker --version\ and \docker-compose --version\

- **Node.js 18+** (For local development without Docker)
  - Download from https://nodejs.org/
  - Verify installation: \
ode --version\ and \
pm --version\

## Quick Start with Docker (Recommended)

### Step 1: Clone and Navigate
\\\ash
cd /repo
\\\

### Step 2: Start Services
\\\ash
docker-compose up -d
\\\

### Step 3: Wait for Services
Services will be ready after ~30 seconds:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
- MySQL: localhost:3306

### Step 4: Access the Application
Open your browser and navigate to: **http://localhost:5173**

## Local Development Setup

### Step 1: Copy Environment Files
\\\ash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
\\\

### Step 2: Update Environment (if needed)
For local MySQL, edit \ackend/.env\:
\\\
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
\\\

### Step 3: Start MySQL
Ensure MySQL server is running on your system.

### Step 4: Run Database Setup
\\\ash
# From backend directory
mysql -u root -p your_mysql_password < scripts/init.sql
\\\

### Step 5: Install Dependencies
\\\ash
npm run install-all
\\\

### Step 6: Start Development Servers
\\\ash
# Start both frontend and backend
npm run dev

# Or start them separately:
npm run backend    # Terminal 1
npm run frontend   # Terminal 2
\\\

### Step 7: Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Project Structure Overview

\\\
project-root/
├── backend/              # Express API server
│   ├── src/
│   │   ├── app.js       # Main Express app
│   │   ├── models/      # Database models
│   │   ├── routes/      # API endpoints
│   │   └── controllers/ # Business logic
│   ├── scripts/
│   │   └── init.sql     # Database schema
│   └── package.json
│
├── frontend/            # React + Vite application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Application pages
│   │   ├── services/    # API client
│   │   └── styles/      # Global styles
│   ├── tailwind.config.js
│   └── package.json
│
└── docker-compose.yml   # Docker services definition
\\\

## Available Commands

### Root Commands (monorepo)
\\\ash
npm run dev           # Start both frontend and backend
npm run backend       # Start only backend
npm run frontend      # Start only frontend
npm run build         # Build both projects
npm run install-all   # Install dependencies for all
\\\

### Backend Commands
\\\ash
cd backend
npm run dev           # Start with auto-reload
npm start             # Start normally
\\\

### Frontend Commands
\\\ash
cd frontend
npm run dev           # Start development server
npm run build         # Build for production
npm run preview       # Preview production build
\\\

## Troubleshooting

### Docker Issues

**Port already in use**
\\\ash
# Kill service on specific port
# On Windows (find and kill process on port)
netstat -ano | findstr :5173
taskkill /PID <PID> /F
\\\

**MySQL connection refused**
\\\ash
# Check MySQL container logs
docker-compose logs mysql

# Restart MySQL container
docker-compose restart mysql
\\\

**Frontend can't connect to backend**
- Ensure \VITE_API_URL\ in \rontend/.env\ is correct
- Check if backend container is running: \docker ps\
- Verify network connection: \docker network ls\

### Node.js Issues

**Module not found**
\\\ash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
\\\

**Port already in use**
\\\ash
# On Windows - find and kill process on port
netstat -ano | findstr :5000
taskkill /PID <PID> /F
\\\

**MySQL connection failed (local development)**
- Verify MySQL server is running
- Check credentials in \.env\
- Test connection: \mysql -u root -p\

## Stopping Services

### With Docker
\\\ash
docker-compose down          # Stop all services
docker-compose down -v       # Stop and remove volumes (data loss!)
docker-compose logs -f       # View logs in real-time
\\\

### Local Development
Press \Ctrl+C\ in each terminal where services are running.

## Next Steps

1. **Explore the UI Components**: Check \rontend/src/components/\
2. **Review Database Schema**: Check \ackend/scripts/init.sql\
3. **Add New Features**: Start with a new model in \ackend/src/models/\
4. **Customize Styling**: Edit Tailwind config in \rontend/tailwind.config.js\
5. **Read API Documentation**: See \API.md\

## Development Tips

### Hot Reload
- Frontend: Automatically reloads on file changes
- Backend: Use \
pm run dev\ for auto-reload with \--watch\ flag

### Database Management
- Access MySQL CLI: \docker-compose exec mysql mysql -u root -p\
- View database: \USE aluminium_erp; SHOW TABLES;\
- Reset database: Remove MySQL volume and restart

### API Testing
- Use Postman or Insomnia for API testing
- Import requests from API documentation
- Backend runs on \http://localhost:5000\

### Browser DevTools
- Frontend runs in Vite dev server with source maps
- Check console for API errors
- Network tab shows all API calls

## Common Tasks

### Add a New Supplier
1. Navigate to Suppliers page
2. Click "Add New Supplier"
3. Fill in the form
4. Click Submit

### Create a Purchase Order
1. Navigate to Purchase Orders
2. Click "Create New PO"
3. Select supplier and items
4. Review and submit

### Check Stock Levels
1. Navigate to Stock
2. Filter by warehouse
3. Check quantities and reorder levels

## Resources

- **Tailwind CSS Docs**: https://tailwindcss.com/docs
- **React Docs**: https://react.dev
- **Vite Docs**: https://vitejs.dev
- **Express.js Docs**: https://expressjs.com
- **MySQL Docs**: https://dev.mysql.com/doc/

## Support

If you encounter issues:
1. Check the Troubleshooting section above
2. Review logs: \docker-compose logs\ or console output
3. Verify prerequisites are installed correctly
4. Ensure ports 3306, 5000, 5173 are available

---

**Ready to start?** Run \docker-compose up -d\ and navigate to http://localhost:5173!
