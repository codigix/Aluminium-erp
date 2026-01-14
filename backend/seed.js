require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'sales_erp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const DEFAULT_USERS = [
  {
    username: 'admin',
    email: 'admin@company.com',
    password: 'Admin@123',
    first_name: 'Admin',
    last_name: 'User',
    department_code: 'ADMIN',
    role_code: 'SYS_ADMIN',
    phone: '9876543210'
  },
  {
    username: 'sales_user',
    email: 'sales@company.com',
    password: 'Sales@123',
    first_name: 'John',
    last_name: 'Sales',
    department_code: 'SALES',
    role_code: 'SALES_MGR',
    phone: '9876543211'
  },
  {
    username: 'design_user',
    email: 'design@company.com',
    password: 'Design@123',
    first_name: 'Jane',
    last_name: 'Design',
    department_code: 'DESIGN_ENG',
    role_code: 'DESIGN_ENG_ROLE',
    phone: '9876543212'
  },
  {
    username: 'procurement_user',
    email: 'procurement@company.com',
    password: 'Procurement@123',
    first_name: 'Robert',
    last_name: 'Procurement',
    department_code: 'PROCUREMENT',
    role_code: 'PROC_OFFICER',
    phone: '9876543216'
  },
  {
    username: 'production_user',
    email: 'production@company.com',
    password: 'Production@123',
    first_name: 'Mike',
    last_name: 'Production',
    department_code: 'PRODUCTION',
    role_code: 'PROD_MGR',
    phone: '9876543213'
  },
  {
    username: 'accounts_user',
    email: 'accounts@company.com',
    password: 'Accounts@123',
    first_name: 'Sarah',
    last_name: 'Accounts',
    department_code: 'ACCOUNTS',
    role_code: 'ACC_MGR',
    phone: '9876543214'
  },
  {
    username: 'shipment_user',
    email: 'shipment@company.com',
    password: 'Shipment@123',
    first_name: 'David',
    last_name: 'Shipment',
    department_code: 'SHIPMENT',
    role_code: 'SHIP_OFFICER',
    phone: '9876543215'
  },
  {
    username: 'quality_user',
    email: 'quality@company.com',
    password: 'Quality@123',
    first_name: 'Alice',
    last_name: 'Quality',
    department_code: 'QUALITY',
    role_code: 'QA_INSP',
    phone: '9876543217'
  },
  {
    username: 'inventory_user',
    email: 'inventory@company.com',
    password: 'Inventory@123',
    first_name: 'Bob',
    last_name: 'Inventory',
    department_code: 'INVENTORY',
    role_code: 'INV_MGR',
    phone: '9876543218'
  }
];

const seedDatabase = async () => {
  console.log('Starting database seeding...\n');

  for (const userData of DEFAULT_USERS) {
    try {
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      const query = `
        INSERT INTO users (username, email, password, first_name, last_name, department_id, role_id, status, phone)
        SELECT ?, ?, ?, ?, ?, d.id, r.id, 'ACTIVE', ?
        FROM departments d
        JOIN roles r ON r.department_id = d.id
        WHERE d.code = ? AND r.code = ?
        ON DUPLICATE KEY UPDATE 
        password = VALUES(password),
        first_name = VALUES(first_name),
        last_name = VALUES(last_name),
        phone = VALUES(phone)
      `;

      pool.query(
        query,
        [
          userData.username,
          userData.email,
          hashedPassword,
          userData.first_name,
          userData.last_name,
          userData.phone,
          userData.department_code,
          userData.role_code
        ],
        (err, results) => {
          if (err) {
            console.error(`✗ Error creating/updating user ${userData.email}:`, err.message);
          } else if (results.affectedRows === 1) {
            console.log(`✓ User created: ${userData.email}`);
          } else if (results.affectedRows === 2) {
            console.log(`✓ User updated: ${userData.email}`);
          } else {
            console.log(`⊘ User verified (no changes): ${userData.email}\n`);
          }
        }
      );
    } catch (error) {
      console.error(`✗ Error hashing password for ${userData.email}:`, error.message);
    }
  }

  setTimeout(() => {
    console.log('Database seeding completed!');
    console.log('\nDEFAULT CREDENTIALS:');
    console.log('====================');
    DEFAULT_USERS.forEach(user => {
      console.log(`\nEmail: ${user.email}`);
      console.log(`Password: ${user.password}`);
      console.log(`Department: ${user.department_code}`);
    });
    pool.end();
  }, 2000);
};

seedDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
