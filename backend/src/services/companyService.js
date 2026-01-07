const pool = require('../config/db');

const contactsColumnCache = new Map();
const contactColumnDefinitions = {
  contact_type: "contact_type ENUM('PRIMARY', 'PURCHASE', 'ACCOUNTS', 'TECHNICAL', 'OTHER') DEFAULT 'PRIMARY'",
  status: "status ENUM('DRAFT', 'ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE'",
  updated_at: 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
};

const ensureContactsColumn = async columnName => {
  if (contactsColumnCache.has(columnName)) {
    return contactsColumnCache.get(columnName);
  }
  let exists = false;
  try {
    const [rows] = await pool.query('SHOW COLUMNS FROM contacts LIKE ?', [columnName]);
    exists = rows.length > 0;
  } catch (error) {
    exists = false;
  }
  contactsColumnCache.set(columnName, exists);
  return exists;
};

const ensureContactColumnDefinition = async (executor, columnName) => {
  const exists = await ensureContactsColumn(columnName);
  if (exists) return;
  const definition = contactColumnDefinitions[columnName];
  if (!definition) return;
  await executor.query(`ALTER TABLE contacts ADD COLUMN ${definition}`);
  contactsColumnCache.set(columnName, true);
};

const ensureContactSchema = async executor => {
  const runner = executor || pool;
  for (const columnName of Object.keys(contactColumnDefinitions)) {
    await ensureContactColumnDefinition(runner, columnName);
  }
};

const normalizeCode = name => {
  if (!name) return `CMP-${Date.now()}`;
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
    .padEnd(4, 'X');
};

const CONTACT_TYPES = new Set(['PRIMARY', 'PURCHASE', 'ACCOUNTS', 'TECHNICAL', 'OTHER']);
const CONTACT_STATUSES = new Set(['DRAFT', 'ACTIVE', 'INACTIVE']);

const sanitizeValue = value => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
};

const normalizeContactType = value => {
  if (!value) return 'PRIMARY';
  const upper = String(value).toUpperCase();
  return CONTACT_TYPES.has(upper) ? upper : 'PRIMARY';
};

const normalizeContactStatus = value => {
  if (!value) return 'ACTIVE';
  const upper = String(value).toUpperCase();
  return CONTACT_STATUSES.has(upper) ? upper : 'ACTIVE';
};

const mapContactFields = contact => {
  const safeContact = contact || {};
  return {
    name: sanitizeValue(safeContact.name),
    email: sanitizeValue(safeContact.email),
    phone: sanitizeValue(safeContact.phone),
    designation: sanitizeValue(safeContact.designation),
    contactType: normalizeContactType(safeContact.contactType || safeContact.contact_type)
  };
};

const mapContactRecord = contact => {
  const fields = mapContactFields(contact);
  return {
    ...fields,
    status: normalizeContactStatus(contact && contact.status)
  };
};

const requireCompany = async companyId => {
  const [rows] = await pool.query('SELECT id, status FROM companies WHERE id = ?', [companyId]);
  if (!rows.length) {
    const error = new Error('Company not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
};

const ensureCompanyIsActive = async companyId => {
  const company = await requireCompany(companyId);
  if ((company.status || 'ACTIVE') !== 'ACTIVE') {
    const error = new Error('Company is inactive');
    error.statusCode = 400;
    throw error;
  }
  return company;
};

const insertAddress = async (connection, companyId, address, type) => {
  if (!address || !address.line1) return;
  await connection.execute(
    `INSERT INTO company_addresses
      (company_id, address_type, line1, line2, city, state, pincode, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ,
    [
      companyId,
      type,
      address.line1,
      address.line2 || null,
      address.city || null,
      address.state || null,
      address.pincode || null,
      address.country || 'India'
    ]
  );
};

const insertContact = async (executor, companyId, contact) => {
  await ensureContactSchema(executor);
  const payload = mapContactRecord(contact);
  const [result] = await executor.execute(
    `INSERT INTO contacts
      (company_id, name, email, phone, designation, contact_type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
    ,
    [
      companyId,
      payload.name,
      payload.email,
      payload.phone,
      payload.designation,
      payload.contactType,
      payload.status
    ]
  );
  return result.insertId;
};

const persistAddresses = async (connection, companyId, billingAddress, shippingAddress) => {
  await insertAddress(connection, companyId, billingAddress, 'BILLING');
  await insertAddress(connection, companyId, shippingAddress, 'SHIPPING');
};

const persistContacts = async (connection, companyId, contacts = []) => {
  if (!Array.isArray(contacts) || !contacts.length) return false;
  for (const contact of contacts) {
    await insertContact(connection, companyId, contact);
  }
  return true;
};

const ensurePrimaryContactShell = async (connection, companyId) => {
  await insertContact(connection, companyId, { contactType: 'PRIMARY', status: 'DRAFT' });
};

const createCompany = async payload => {
  const {
    companyName,
    gstin,
    cin,
    pan,
    customerType,
    paymentTerms,
    creditDays,
    currency,
    freightTerms,
    packingForwarding,
    insuranceTerms,
    billingAddress = {},
    shippingAddress = {},
    contacts = []
  } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [companyResult] = await connection.execute(
      `INSERT INTO companies
        (company_name, company_code, customer_type, status, gstin, cin, pan, payment_terms, credit_days,
         currency, freight_terms, packing_forwarding, insurance_terms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        companyName,
        normalizeCode(companyName),
        customerType || 'REGULAR',
        payload.status || 'ACTIVE',
        gstin || null,
        cin || null,
        pan || null,
        paymentTerms || null,
        creditDays || null,
        currency || 'INR',
        freightTerms || null,
        packingForwarding || null,
        insuranceTerms || null
      ]
    );

    const companyId = companyResult.insertId;

    await persistAddresses(connection, companyId, billingAddress, shippingAddress);
    const hasContacts = await persistContacts(connection, companyId, contacts);
    if (!hasContacts) {
      await ensurePrimaryContactShell(connection, companyId);
    }

    await connection.commit();

    return { id: companyId, companyName };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const getCompanies = async () => {
  const [companies] = await pool.query('SELECT * FROM companies ORDER BY created_at DESC');
  const companyIds = companies.map(c => c.id);

  if (!companyIds.length) {
    return companies;
  }

  const [addresses] = await pool.query('SELECT * FROM company_addresses');
  const [contacts] = await pool.query('SELECT * FROM contacts');

  return companies.map(company => ({
    ...company,
    addresses: addresses.filter(address => address.company_id === company.id),
    contacts: contacts.filter(contact => contact.company_id === company.id)
  }));
};

const updateCompany = async (companyId, payload) => {
  const {
    companyName,
    gstin,
    cin,
    pan,
    customerType,
    paymentTerms,
    creditDays,
    currency,
    freightTerms,
    packingForwarding,
    insuranceTerms,
    billingAddress = {},
    shippingAddress = {},
    contacts = []
  } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE companies
        SET company_name = ?, customer_type = ?, gstin = ?, cin = ?, pan = ?, payment_terms = ?, credit_days = ?,
            currency = ?, freight_terms = ?, packing_forwarding = ?, insurance_terms = ?
       WHERE id = ?`
      ,
      [
        companyName,
        customerType || 'REGULAR',
        gstin || null,
        cin || null,
        pan || null,
        paymentTerms || null,
        creditDays || null,
        currency || 'INR',
        freightTerms || null,
        packingForwarding || null,
        insuranceTerms || null,
        companyId
      ]
    );

    await connection.execute('DELETE FROM company_addresses WHERE company_id = ?', [companyId]);
    await persistAddresses(connection, companyId, billingAddress, shippingAddress);

    const hasContactPayload = Array.isArray(contacts) && contacts.length;
    if (hasContactPayload) {
      await connection.execute('DELETE FROM contacts WHERE company_id = ?', [companyId]);
      const hasContacts = await persistContacts(connection, companyId, contacts);
      if (!hasContacts) {
        await ensurePrimaryContactShell(connection, companyId);
      }
    }

    await connection.commit();
    return { id: companyId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateCompanyStatus = async (companyId, status) => {
  const normalizedStatus = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
  await pool.execute('UPDATE companies SET status = ? WHERE id = ?', [normalizedStatus, companyId]);
  return normalizedStatus;
};

const deleteCompany = async companyId => {
  await pool.execute('DELETE FROM companies WHERE id = ?', [companyId]);
};

const addContact = async ({ companyId, ...rest }) => {
  await ensureCompanyIsActive(companyId);
  const id = await insertContact(pool, companyId, rest);
  return { id };
};

const updateContact = async (companyId, contactId, payload) => {
  await ensureCompanyIsActive(companyId);
  await ensureContactSchema(pool);
  const fields = mapContactFields(payload);
  const [result] = await pool.execute(
    `UPDATE contacts
       SET name = ?, email = ?, phone = ?, designation = ?, contact_type = ?
     WHERE id = ? AND company_id = ?`
    ,
    [
      fields.name,
      fields.email,
      fields.phone,
      fields.designation,
      fields.contactType,
      contactId,
      companyId
    ]
  );
  if (!result.affectedRows) {
    const error = new Error('Contact not found');
    error.statusCode = 404;
    throw error;
  }
  return { id: contactId };
};

const updateContactStatus = async (companyId, contactId, status) => {
  await requireCompany(companyId);
  await ensureContactSchema(pool);
  const normalizedStatus = normalizeContactStatus(status);
  const [result] = await pool.execute(
    'UPDATE contacts SET status = ? WHERE id = ? AND company_id = ?',
    [normalizedStatus, contactId, companyId]
  );
  if (!result.affectedRows) {
    const error = new Error('Contact not found');
    error.statusCode = 404;
    throw error;
  }
  return normalizedStatus;
};

const deleteContact = async (companyId, contactId) => {
  await ensureCompanyIsActive(companyId);
  const [result] = await pool.execute('DELETE FROM contacts WHERE id = ? AND company_id = ?', [contactId, companyId]);
  if (!result.affectedRows) {
    const error = new Error('Contact not found');
    error.statusCode = 404;
    throw error;
  }
};

const getContacts = async companyId => {
  await requireCompany(companyId);
  await ensureContactSchema(pool);
  const hasContactTypeColumn = await ensureContactsColumn('contact_type');
  const hasStatusColumn = await ensureContactsColumn('status');
  const orderSegments = [];
  if (hasContactTypeColumn) {
    orderSegments.push("contact_type = 'PRIMARY' DESC");
  }
  if (hasStatusColumn) {
    orderSegments.push("status = 'DRAFT' DESC");
  }
  orderSegments.push('created_at DESC');
  const [rows] = await pool.query(
    `SELECT *
       FROM contacts
      WHERE company_id = ?
      ORDER BY ${orderSegments.join(', ')}`
    ,
    [companyId]
  );
  return rows;
};

module.exports = {
  createCompany,
  getCompanies,
  updateCompany,
  updateCompanyStatus,
  deleteCompany,
  addContact,
  updateContact,
  updateContactStatus,
  deleteContact,
  getContacts
};
