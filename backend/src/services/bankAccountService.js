const pool = require('../config/db');

/**
 * Create a new bank account with all required fields
 */
const createBankAccount = async (payload) => {
  const {
    bankName,
    accountHolderName,
    accountNumber,
    ifscCode,
    branchName,
    accountType = 'CURRENT',
    openingBalance = 0,
    isActive = true
  } = payload;

  if (!bankName || !accountNumber || !accountHolderName || !ifscCode || !branchName) {
    const error = new Error('Bank Name, Account Holder Name, Account Number, IFSC Code, and Branch Name are required');
    error.statusCode = 400;
    throw error;
  }

  const cleanAccountNumber = String(accountNumber).trim();
  const cleanIfscCode = String(ifscCode).trim().toUpperCase();
  const cleanBankName = String(bankName).trim();
  const cleanHolderName = String(accountHolderName).trim();
  const cleanBranchName = String(branchName).trim();
  const cleanAccountType = String(accountType).trim().toUpperCase();
  const parsedBalance = parseFloat(openingBalance) || 0;
  const activeFlag = (isActive === false || isActive === 'false' || isActive === 0 || isActive === '0') ? 0 : 1;

  try {
    const [result] = await pool.execute(
      `INSERT INTO bank_accounts (
        bank_name,
        account_holder_name,
        account_number,
        ifsc_code,
        branch_name,
        account_type,
        opening_balance,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        cleanBankName,
        cleanHolderName,
        cleanAccountNumber,
        cleanIfscCode,
        cleanBranchName,
        cleanAccountType,
        parsedBalance,
        activeFlag
      ]
    );

    const [newAccount] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [result.insertId]);

    return newAccount[0] || {
      id: result.insertId,
      bank_name: cleanBankName,
      account_number: cleanAccountNumber,
      account_holder_name: cleanHolderName,
      status: 'created'
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const dupError = new Error(`Account Number "${cleanAccountNumber}" is already registered`);
      dupError.statusCode = 409;
      throw dupError;
    }
    throw error;
  }
};

/**
 * Calculate live credits, debits and balance for specific bank accounts
 */
const calculateBankBalances = async (accountIds = []) => {
  if (!accountIds || !accountIds.length) return {};

  const placeholders = accountIds.map(() => '?').join(',');

  // 1. Customer Receipts (Inflow / Credit)
  const [custRows] = await pool.query(
    `SELECT bank_account_id, COALESCE(SUM(payment_amount), 0) as total_customer_receipts, COUNT(*) as cust_count
     FROM customer_payments
     WHERE bank_account_id IN (${placeholders}) AND status = 'CONFIRMED'
     GROUP BY bank_account_id`,
    accountIds
  );

  // 2. Vendor Payments (Outflow / Debit)
  const [vendRows] = await pool.query(
    `SELECT bank_account_id, COALESCE(SUM(payment_amount), 0) as total_vendor_payments, COUNT(*) as vend_count
     FROM payments
     WHERE bank_account_id IN (${placeholders}) AND status = 'CONFIRMED'
     GROUP BY bank_account_id`,
    accountIds
  );

  // 3. Contra Inflows (Transfer In to this bank)
  const [contraInRows] = await pool.query(
    `SELECT to_bank_account_id as bank_account_id, COALESCE(SUM(amount), 0) as total_contra_in, COUNT(*) as contra_in_count
     FROM contra_vouchers
     WHERE to_bank_account_id IN (${placeholders})
     GROUP BY to_bank_account_id`,
    accountIds
  );

  // 4. Contra Outflows (Transfer Out from this bank)
  const [contraOutRows] = await pool.query(
    `SELECT from_bank_account_id as bank_account_id, COALESCE(SUM(amount), 0) as total_contra_out, COUNT(*) as contra_out_count
     FROM contra_vouchers
     WHERE from_bank_account_id IN (${placeholders})
     GROUP BY from_bank_account_id`,
    accountIds
  );

  const statsMap = {};
  for (const id of accountIds) {
    statsMap[id] = {
      customer_receipts: 0,
      vendor_payments: 0,
      contra_in: 0,
      contra_out: 0,
      total_credits: 0,
      total_debits: 0,
      transaction_count: 0
    };
  }

  for (const r of custRows) {
    if (statsMap[r.bank_account_id]) {
      statsMap[r.bank_account_id].customer_receipts = parseFloat(r.total_customer_receipts) || 0;
      statsMap[r.bank_account_id].transaction_count += parseInt(r.cust_count) || 0;
    }
  }

  for (const r of vendRows) {
    if (statsMap[r.bank_account_id]) {
      statsMap[r.bank_account_id].vendor_payments = parseFloat(r.total_vendor_payments) || 0;
      statsMap[r.bank_account_id].transaction_count += parseInt(r.vend_count) || 0;
    }
  }

  for (const r of contraInRows) {
    if (statsMap[r.bank_account_id]) {
      statsMap[r.bank_account_id].contra_in = parseFloat(r.total_contra_in) || 0;
      statsMap[r.bank_account_id].transaction_count += parseInt(r.contra_in_count) || 0;
    }
  }

  for (const r of contraOutRows) {
    if (statsMap[r.bank_account_id]) {
      statsMap[r.bank_account_id].contra_out = parseFloat(r.total_contra_out) || 0;
      statsMap[r.bank_account_id].transaction_count += parseInt(r.contra_out_count) || 0;
    }
  }

  for (const id of accountIds) {
    const s = statsMap[id];
    s.total_credits = +(s.customer_receipts + s.contra_in).toFixed(2);
    s.total_debits = +(s.vendor_payments + s.contra_out).toFixed(2);
  }

  return statsMap;
};

/**
 * Get available live balance for a single bank account
 */
const getBankAccountBalance = async (accountId) => {
  const [rows] = await pool.query('SELECT id, bank_name, account_number, opening_balance FROM bank_accounts WHERE id = ?', [accountId]);
  if (!rows.length) return null;
  const acc = rows[0];
  const statsMap = await calculateBankBalances([acc.id]);
  const s = statsMap[acc.id] || { total_credits: 0, total_debits: 0 };
  const opening = parseFloat(acc.opening_balance) || 0;
  const currentBalance = +(opening + s.total_credits - s.total_debits).toFixed(2);
  return {
    id: acc.id,
    bank_name: acc.bank_name,
    account_number: acc.account_number,
    opening_balance: opening,
    total_credits: s.total_credits,
    total_debits: s.total_debits,
    current_balance: currentBalance,
    available_balance: currentBalance
  };
};

/**
 * Get all bank accounts with optional filtering and search
 */
const getBankAccounts = async (filters = {}) => {
  let whereClauses = [];
  let params = [];

  // Filter by status: 'all', 'active', 'inactive', boolean true/false
  if (filters.status === 'active' || filters.isActive === true || filters.isActive === 'true') {
    whereClauses.push('is_active = 1');
  } else if (filters.status === 'inactive' || filters.isActive === false || filters.isActive === 'false') {
    whereClauses.push('is_active = 0');
  }

  // Filter by account type
  if (filters.accountType && filters.accountType !== 'ALL') {
    whereClauses.push('account_type = ?');
    params.push(filters.accountType);
  }

  // Search query
  if (filters.search && filters.search.trim()) {
    const searchPattern = `%${filters.search.trim()}%`;
    whereClauses.push(`(
      bank_name LIKE ? OR 
      account_holder_name LIKE ? OR 
      account_number LIKE ? OR 
      ifsc_code LIKE ? OR 
      branch_name LIKE ?
    )`);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [accounts] = await pool.query(
    `SELECT * FROM bank_accounts 
     ${whereSql}
     ORDER BY id DESC`,
    params
  );

  const ids = accounts.map(a => a.id);
  const statsMap = await calculateBankBalances(ids);

  return accounts.map(a => {
    const s = statsMap[a.id] || { total_credits: 0, total_debits: 0, customer_receipts: 0, vendor_payments: 0, contra_in: 0, contra_out: 0, transaction_count: 0 };
    const opening = parseFloat(a.opening_balance) || 0;
    const currentBalance = +(opening + s.total_credits - s.total_debits).toFixed(2);
    return {
      ...a,
      total_credits: s.total_credits,
      total_debits: s.total_debits,
      customer_receipts: s.customer_receipts,
      vendor_payments: s.vendor_payments,
      contra_in: s.contra_in,
      contra_out: s.contra_out,
      current_balance: currentBalance,
      total_balance: currentBalance,
      available_balance: currentBalance,
      linked_transactions_count: s.transaction_count
    };
  });
};

/**
 * Get single bank account by ID
 */
const getBankAccountById = async (accountId) => {
  const [rows] = await pool.query(
    'SELECT * FROM bank_accounts WHERE id = ?',
    [accountId]
  );

  if (!rows.length) {
    const error = new Error('Bank account not found');
    error.statusCode = 404;
    throw error;
  }

  const account = rows[0];
  const statsMap = await calculateBankBalances([account.id]);
  const s = statsMap[account.id] || { total_credits: 0, total_debits: 0, customer_receipts: 0, vendor_payments: 0, contra_in: 0, contra_out: 0, transaction_count: 0 };
  const opening = parseFloat(account.opening_balance) || 0;
  const currentBalance = +(opening + s.total_credits - s.total_debits).toFixed(2);

  return {
    ...account,
    total_credits: s.total_credits,
    total_debits: s.total_debits,
    customer_receipts: s.customer_receipts,
    vendor_payments: s.vendor_payments,
    contra_in: s.contra_in,
    contra_out: s.contra_out,
    current_balance: currentBalance,
    total_balance: currentBalance,
    available_balance: currentBalance,
    total_received: s.total_credits,
    linked_transactions_count: s.transaction_count
  };
};

/**
 * Update an existing bank account
 */
const updateBankAccount = async (accountId, payload) => {
  const {
    bankName,
    accountHolderName,
    accountNumber,
    ifscCode,
    branchName,
    accountType,
    openingBalance,
    isActive,
    status
  } = payload;

  const updates = [];
  const params = [];

  if (bankName !== undefined) {
    updates.push('bank_name = ?');
    params.push(String(bankName).trim());
  }
  if (accountHolderName !== undefined) {
    updates.push('account_holder_name = ?');
    params.push(String(accountHolderName).trim());
  }
  if (accountNumber !== undefined) {
    updates.push('account_number = ?');
    params.push(String(accountNumber).trim());
  }
  if (ifscCode !== undefined) {
    updates.push('ifsc_code = ?');
    params.push(String(ifscCode).trim().toUpperCase());
  }
  if (branchName !== undefined) {
    updates.push('branch_name = ?');
    params.push(String(branchName).trim());
  }
  if (accountType !== undefined) {
    updates.push('account_type = ?');
    params.push(String(accountType).trim().toUpperCase());
  }
  if (openingBalance !== undefined) {
    updates.push('opening_balance = ?');
    params.push(parseFloat(openingBalance) || 0);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push((isActive === true || isActive === 'true' || isActive === 1 || isActive === '1') ? 1 : 0);
  } else if (status !== undefined) {
    updates.push('is_active = ?');
    params.push(String(status).toLowerCase() === 'active' ? 1 : 0);
  }

  if (!updates.length) {
    return { id: accountId, message: 'No updates provided' };
  }

  updates.push('updated_at = NOW()');
  params.push(accountId);

  try {
    const [result] = await pool.execute(
      `UPDATE bank_accounts SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      const notFound = new Error('Bank account not found');
      notFound.statusCode = 404;
      throw notFound;
    }

    const [updated] = await pool.query('SELECT * FROM bank_accounts WHERE id = ?', [accountId]);
    return updated[0] || { id: accountId, status: 'updated' };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const dupError = new Error('Account number already exists on another bank record');
      dupError.statusCode = 409;
      throw dupError;
    }
    throw error;
  }
};

/**
 * Toggle active/inactive status
 */
const toggleBankAccountStatus = async (accountId) => {
  const [current] = await pool.query('SELECT is_active FROM bank_accounts WHERE id = ?', [accountId]);
  if (!current.length) {
    const error = new Error('Bank account not found');
    error.statusCode = 404;
    throw error;
  }

  const newStatus = current[0].is_active ? 0 : 1;
  await pool.execute(
    'UPDATE bank_accounts SET is_active = ?, updated_at = NOW() WHERE id = ?',
    [newStatus, accountId]
  );

  return { id: accountId, is_active: Boolean(newStatus), status: newStatus ? 'Active' : 'Inactive' };
};

/**
 * Deactivate bank account
 */
const deactivateBankAccount = async (accountId) => {
  await pool.execute(
    'UPDATE bank_accounts SET is_active = 0, updated_at = NOW() WHERE id = ?',
    [accountId]
  );
  return { id: accountId, is_active: false, status: 'Inactive', message: 'Bank account deactivated' };
};

/**
 * Delete bank account if no linked payments exist
 */
const deleteBankAccount = async (accountId) => {
  const [custPayments] = await pool.query(
    'SELECT COUNT(*) as count FROM customer_payments WHERE bank_account_id = ?',
    [accountId]
  );

  let vendorPaymentsCount = 0;
  try {
    const [vPayments] = await pool.query(
      'SELECT COUNT(*) as count FROM payments WHERE bank_account_id = ?',
      [accountId]
    );
    vendorPaymentsCount = vPayments[0]?.count || 0;
  } catch (e) {
    // payments table might not have bank_account_id
  }

  const totalLinked = (custPayments[0]?.count || 0) + vendorPaymentsCount;
  if (totalLinked > 0) {
    const error = new Error(`Cannot delete this bank account because ${totalLinked} payment record(s) are linked to it. Please deactivate it instead.`);
    error.statusCode = 409;
    throw error;
  }

  const [result] = await pool.execute('DELETE FROM bank_accounts WHERE id = ?', [accountId]);
  if (result.affectedRows === 0) {
    const error = new Error('Bank account not found');
    error.statusCode = 404;
    throw error;
  }

  return { id: accountId, message: 'Bank account deleted successfully' };
};

module.exports = {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  getBankAccountBalance,
  calculateBankBalances,
  updateBankAccount,
  toggleBankAccountStatus,
  deactivateBankAccount,
  deleteBankAccount
};
