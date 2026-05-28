const pool = require('../config/db');

const getActiveCompany = async () => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM company_master WHERE status = 'ACTIVE' LIMIT 1"
    );
    return rows[0] || null;
  } catch (error) {
    console.error('Error fetching active company:', error.message);
    return null;
  }
};

const getCompanies = async () => {
  const [companies] = await pool.query(
    "SELECT * FROM company_master ORDER BY created_at DESC"
  );
  return companies;
};

const getCompanyById = async (id) => {
  const [rows] = await pool.query(
    "SELECT * FROM company_master WHERE id = ?",
    [id]
  );
  if (!rows.length) {
    const error = new Error('Company not found');
    error.statusCode = 404;
    throw error;
  }
  return rows[0];
};

const createCompany = async (payload) => {
  const {
    companyName,
    companyAddress,
    gstin,
    pan,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
    authorizedSignature,
    companyLogo,
    invoiceFooterNotes,
    status = 'ACTIVE'
  } = payload;

  if (!companyName) {
    const error = new Error('Company name is required');
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO company_master (
        company_name,
        company_address,
        gstin,
        pan,
        bank_name,
        account_number,
        ifsc_code,
        branch_name,
        authorized_signature,
        company_logo,
        invoice_footer_notes,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyName,
        companyAddress || null,
        gstin || null,
        pan || null,
        bankName || null,
        accountNumber || null,
        ifscCode || null,
        branchName || null,
        authorizedSignature || null,
        companyLogo || null,
        invoiceFooterNotes || null,
        status
      ]
    );

    await connection.commit();

    return {
      id: result.insertId,
      companyName,
      status
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateCompany = async (id, payload) => {
  const {
    companyName,
    companyAddress,
    gstin,
    pan,
    bankName,
    accountNumber,
    ifscCode,
    branchName,
    authorizedSignature,
    companyLogo,
    invoiceFooterNotes,
    status
  } = payload;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT * FROM company_master WHERE id = ?", [id]);
    if (!rows.length) {
      const error = new Error('Company not found');
      error.statusCode = 404;
      throw error;
    }

    const updates = [];
    const params = [];

    if (companyName !== undefined) {
      updates.push('company_name = ?');
      params.push(companyName);
    }
    if (companyAddress !== undefined) {
      updates.push('company_address = ?');
      params.push(companyAddress);
    }
    if (gstin !== undefined) {
      updates.push('gstin = ?');
      params.push(gstin);
    }
    if (pan !== undefined) {
      updates.push('pan = ?');
      params.push(pan);
    }
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
    if (branchName !== undefined) {
      updates.push('branch_name = ?');
      params.push(branchName);
    }
    if (authorizedSignature !== undefined) {
      updates.push('authorized_signature = ?');
      params.push(authorizedSignature);
    }
    if (companyLogo !== undefined) {
      updates.push('company_logo = ?');
      params.push(companyLogo);
    }
    if (invoiceFooterNotes !== undefined) {
      updates.push('invoice_footer_notes = ?');
      params.push(invoiceFooterNotes);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = NOW()');
      params.push(id);
      await connection.execute(
        `UPDATE company_master SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }

    await connection.commit();
    return { id, status: 'updated' };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteCompany = async (id) => {
  await pool.execute('DELETE FROM company_master WHERE id = ?', [id]);
  return { id, status: 'deleted' };
};

module.exports = {
  getActiveCompany,
  getCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany
};
