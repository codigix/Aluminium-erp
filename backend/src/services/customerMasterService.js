const pool = require('../config/db');

// Customer Master (Sales): customers with multiple contact persons.
// Tables come from prisma migration 20261106120000_create_customer_master; they are also created here on
// first use so the page works on databases where that migration has not been applied yet.
let tablesReady = null;
const ensureTables = () => {
  if (!tablesReady) {
    tablesReady = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS customers (
        id INT NOT NULL AUTO_INCREMENT,
        customer_name VARCHAR(255) NOT NULL,
        gst_no VARCHAR(20) NULL,
        address TEXT NOT NULL,
        pincode VARCHAR(10) NOT NULL,
        email VARCHAR(150) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE INDEX uq_customers_gst_no (gst_no),
        INDEX idx_customers_name (customer_name),
        INDEX idx_customers_status (status)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS customer_contacts (
        id INT NOT NULL AUTO_INCREMENT,
        customer_id INT NOT NULL,
        contact_name VARCHAR(150) NOT NULL,
        mobile VARCHAR(20) NULL,
        email VARCHAR(150) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_customer_contacts_customer (customer_id),
        INDEX idx_customer_contacts_name (contact_name),
        CONSTRAINT customer_contacts_customer_fk FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE ON UPDATE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    })().catch(err => {
      tablesReady = null;
      throw err;
    });
  }
  return tablesReady;
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const MOBILE_PATTERN = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;

const badRequest = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const clean = value => (value === undefined || value === null ? '' : String(value).trim());

// Validates and normalises a customer payload; throws a 400 error naming the first problem
const normalizePayload = (payload = {}) => {
  const customer = {
    customerName: clean(payload.customerName),
    gstNo: clean(payload.gstNo).toUpperCase(),
    address: clean(payload.address),
    pincode: clean(payload.pincode),
    email: clean(payload.email).toLowerCase(),
    status: clean(payload.status).toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
  };

  if (!customer.customerName) throw badRequest('Customer Name is required');
  if (customer.gstNo && !GSTIN_PATTERN.test(customer.gstNo)) throw badRequest('Enter a valid 15-character GST No. (e.g. 27AAACA1234A1Z5)');
  if (!customer.address) throw badRequest('Address is required');
  if (!customer.pincode) throw badRequest('Pincode is required');
  if (!PINCODE_PATTERN.test(customer.pincode)) throw badRequest('Enter a valid 6-digit Pincode');
  if (customer.email && !EMAIL_PATTERN.test(customer.email)) throw badRequest('Enter a valid customer Email ID');

  const contacts = (Array.isArray(payload.contacts) ? payload.contacts : [])
    .map(c => ({ contactName: clean(c.contactName), mobile: clean(c.mobile), email: clean(c.email).toLowerCase() }))
    .filter(c => c.contactName || c.mobile || c.email);

  contacts.forEach((c, i) => {
    const row = `Contact ${i + 1}`;
    if (!c.contactName) throw badRequest(`${row}: Contact Person name is required`);
    if (c.mobile && !MOBILE_PATTERN.test(c.mobile)) throw badRequest(`${row}: enter a valid Mobile No.`);
    if (c.email && !EMAIL_PATTERN.test(c.email)) throw badRequest(`${row}: enter a valid Email ID`);
  });

  return { customer, contacts };
};

const assertGstAvailable = async (connection, gstNo, excludeId = null) => {
  if (!gstNo) return;
  const [rows] = await connection.query(
    'SELECT id, customer_name FROM customers WHERE gst_no = ? AND (? IS NULL OR id <> ?) LIMIT 1',
    [gstNo, excludeId, excludeId]
  );
  if (rows.length) throw badRequest(`GST No. ${gstNo} is already registered to customer "${rows[0].customer_name}"`, 409);
};

const saveContacts = async (connection, customerId, contacts) => {
  await connection.query('DELETE FROM customer_contacts WHERE customer_id = ?', [customerId]);
  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    await connection.query(
      'INSERT INTO customer_contacts (customer_id, contact_name, mobile, email, sort_order) VALUES (?, ?, ?, ?, ?)',
      [customerId, c.contactName, c.mobile || null, c.email || null, i]
    );
  }
};

const attachContacts = async (customers) => {
  if (!customers.length) return customers;
  const [contacts] = await pool.query(
    'SELECT id, customer_id, contact_name, mobile, email FROM customer_contacts WHERE customer_id IN (?) ORDER BY sort_order, id',
    [customers.map(c => c.id)]
  );
  const byCustomer = contacts.reduce((acc, c) => {
    (acc[c.customer_id] = acc[c.customer_id] || []).push(c);
    return acc;
  }, {});
  return customers.map(c => ({ ...c, contacts: byCustomer[c.id] || [] }));
};

// List with search on customer name, GST No. and contact person (name / mobile / email)
const listCustomers = async ({ search = '', status = '' } = {}) => {
  await ensureTables();
  const conditions = [];
  const params = [];
  const statusFilter = clean(status).toUpperCase();
  if (statusFilter === 'ACTIVE' || statusFilter === 'INACTIVE') {
    conditions.push('c.status = ?');
    params.push(statusFilter);
  }
  const term = clean(search);
  if (term) {
    const like = `%${term}%`;
    conditions.push(`(c.customer_name LIKE ? OR c.gst_no LIKE ? OR EXISTS (
      SELECT 1 FROM customer_contacts cc WHERE cc.customer_id = c.id AND (cc.contact_name LIKE ? OR cc.mobile LIKE ? OR cc.email LIKE ?)
    ))`);
    params.push(like, like, like, like, like);
  }
  const [rows] = await pool.query(
    `SELECT c.* FROM customers c ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY c.customer_name ASC, c.id ASC`,
    params
  );
  return attachContacts(rows);
};

const getCustomerById = async (id) => {
  await ensureTables();
  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [id]);
  if (!rows.length) throw badRequest('Customer not found', 404);
  const [withContacts] = await attachContacts(rows);
  return withContacts;
};

const createCustomer = async (payload, userId = null) => {
  await ensureTables();
  const { customer, contacts } = normalizePayload(payload);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await assertGstAvailable(connection, customer.gstNo);
    const [result] = await connection.query(
      'INSERT INTO customers (customer_name, gst_no, address, pincode, email, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [customer.customerName, customer.gstNo || null, customer.address, customer.pincode, customer.email || null, customer.status, userId]
    );
    await saveContacts(connection, result.insertId, contacts);
    await connection.commit();
    return getCustomerById(result.insertId);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw badRequest(`GST No. ${customer.gstNo} is already registered to another customer`, 409);
    throw error;
  } finally {
    connection.release();
  }
};

const updateCustomer = async (id, payload) => {
  await ensureTables();
  const { customer, contacts } = normalizePayload(payload);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.query('SELECT id FROM customers WHERE id = ? FOR UPDATE', [id]);
    if (!existing.length) throw badRequest('Customer not found', 404);
    await assertGstAvailable(connection, customer.gstNo, Number(id));
    await connection.query(
      'UPDATE customers SET customer_name = ?, gst_no = ?, address = ?, pincode = ?, email = ?, status = ? WHERE id = ?',
      [customer.customerName, customer.gstNo || null, customer.address, customer.pincode, customer.email || null, customer.status, id]
    );
    await saveContacts(connection, id, contacts);
    await connection.commit();
    return getCustomerById(id);
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') throw badRequest(`GST No. ${customer.gstNo} is already registered to another customer`, 409);
    throw error;
  } finally {
    connection.release();
  }
};

const updateCustomerStatus = async (id, status) => {
  await ensureTables();
  const next = clean(status).toUpperCase();
  if (next !== 'ACTIVE' && next !== 'INACTIVE') throw badRequest('Status must be ACTIVE or INACTIVE');
  const [result] = await pool.query('UPDATE customers SET status = ? WHERE id = ?', [next, id]);
  if (!result.affectedRows) throw badRequest('Customer not found', 404);
  return getCustomerById(id);
};

const deleteCustomer = async (id) => {
  await ensureTables();
  const [result] = await pool.query('DELETE FROM customers WHERE id = ?', [id]);
  if (!result.affectedRows) throw badRequest('Customer not found', 404);
  return { id: Number(id) };
};

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  updateCustomerStatus,
  deleteCustomer
};
