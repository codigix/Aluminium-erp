const bcrypt = require('bcrypt');
const db = require('../config/db');

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
  }
];

const seedUsers = async () => {
  try {
    console.log('Seeding users...');
    
    for (const userData of DEFAULT_USERS) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const query = `
        INSERT IGNORE INTO users (username, email, password, first_name, last_name, department_id, role_id, status, phone)
        SELECT ?, ?, ?, ?, ?, d.id, r.id, 'ACTIVE', ?
        FROM departments d
        JOIN roles r ON r.department_id = d.id
        WHERE d.code = ? AND r.code = ?
      `;
      
      db.query(
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
            console.error(`Error creating user ${userData.email}:`, err.message);
          } else {
            console.log(`✓ User created: ${userData.email}`);
          }
        }
      );
    }
    
    console.log('User seeding completed');
  } catch (error) {
    console.error('Error seeding users:', error);
  }
};

module.exports = { seedUsers, DEFAULT_USERS };
