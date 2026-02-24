const pool = require('../config/db');

const createBankAccount = async (payload) => {
  const {
    bankName,
    accountNumber,
    ifscCode,
    accountHolderName,
    accountType = 'CURRENT'
  } = payload;

  if (!bankName || !accountNumber) {
    const error = new Error('Bank name and account number are required');
    error.statusCode = 400;
    throw error;
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO bank_accounts (
        bank_name,
        account_number,
        ifsc_code,
        account_holder_name,
        account_type,
        is_active
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        bankName,
        accountNumber,
        ifscCode || null,
        accountHolderName || null,
        accountType,
        1
      ]
    );

    return {
      id: result.insertId,
      bankName,
      accountNumber,
      status: 'created'
    };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const dupError = new Error('Account number already exists');
      dupError.statusCode = 409;
      throw dupError;
    }
    throw error;
  }
};

const getBankAccounts = async (isActive = true) => {
  const [accounts] = await pool.query(
    `SELECT * FROM bank_accounts 
     WHERE is_active = ? 
     ORDER BY bank_name ASC`,
    [isActive ? 1 : 0]
  );
  return accounts;
};

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

  return rows[0];
};

const updateBankAccount = async (accountId, payload) => {
  const {
    bankName,
    accountNumber,
    ifscCode,
    accountHolderName,
    accountType,
    isActive
  } = payload;

  const updates = [];
  const params = [];

  if (bankName !== undefined) {
    updates.push('bank_name = ?');
    params.push(bankName);
  }
  if (accountNumber !== undefined) {
    updates.push('account_number = ?');
    params.push(accountNumber);
  }
  if (ifscCode !== undefined) {
    updates.push('ifsc_code = ?');
    params.push(ifscCode);
  }
  if (accountHolderName !== undefined) {
    updates.push('account_holder_name = ?');
    params.push(accountHolderName);
  }
  if (accountType !== undefined) {
    updates.push('account_type = ?');
    params.push(accountType);
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  if (!updates.length) {
    return { id: accountId, message: 'No updates provided' };
  }

  updates.push('updated_at = NOW()');
  params.push(accountId);

  try {
    await pool.execute(
      `UPDATE bank_accounts SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return { id: accountId, status: 'updated' };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const dupError = new Error('Account number already exists');
      dupError.statusCode = 409;
      throw dupError;
    }
    throw error;
  }
};

const deactivateBankAccount = async (accountId) => {
  await pool.execute(
    'UPDATE bank_accounts SET is_active = 0, updated_at = NOW() WHERE id = ?',
    [accountId]
  );

  return { id: accountId, message: 'Bank account deactivated' };
};

const deleteBankAccount = async (accountId) => {
  const [payment] = await pool.query(
    'SELECT COUNT(*) as count FROM payments WHERE bank_account_id = ?',
    [accountId]
  );

  if (payment[0].count > 0) {
    const error = new Error('Cannot delete bank account with existing payments');
    error.statusCode = 409;
    throw error;
  }

  await pool.execute('DELETE FROM bank_accounts WHERE id = ?', [accountId]);
  return { id: accountId, message: 'Bank account deleted successfully' };
};

module.exports = {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  updateBankAccount,
  deactivateBankAccount,
  deleteBankAccount
};
