// Race-safe document numbering backed by the `document_sequences` table.
// The sequence row is locked (SELECT ... FOR UPDATE) inside the caller's
// transaction, so two users saving at the same moment can never receive the
// same number. On first use for a year the sequence is seeded from the highest
// number already present in the source table, so existing numbers are not reused.

const DOCUMENT_TYPES = {
  PURCHASE_ORDER: { table: 'purchase_orders', column: 'po_number', prefix: year => `PO-${year}-`, pad: 4 },
  DELIVERY_CHALLAN: { table: 'delivery_challans', column: 'challan_number', prefix: year => `DC-${year}-`, pad: 5 },
  PAYMENT_RECEIPT: { table: 'customer_payments', column: 'payment_receipt_no', prefix: year => `PR-${year}-`, pad: 5 },
  PAYMENT_VOUCHER: { table: 'payments', column: 'payment_voucher_no', prefix: year => `PV-${year}-`, pad: 5 }
};

const highestExistingNumber = async (connection, config, prefix) => {
  const [rows] = await connection.query(
    `SELECT ${config.column} AS doc_no FROM ${config.table} WHERE ${config.column} LIKE ?`,
    [`${prefix}%`]
  );
  return rows.reduce((max, row) => {
    const value = parseInt(String(row.doc_no).slice(prefix.length), 10);
    return Number.isFinite(value) && value > max ? value : max;
  }, 0);
};

/**
 * Returns the next number for a document type. Must be called with a
 * connection that has an open transaction; the lock is held until commit.
 */
const nextDocumentNumber = async (connection, type, date = new Date()) => {
  const config = DOCUMENT_TYPES[type];
  if (!config) throw new Error(`Unknown document type ${type}`);

  const year = date.getFullYear();
  const prefix = config.prefix(year);
  const sequenceKey = `${type}:${year}`;

  const [existing] = await connection.query(
    'SELECT current_value FROM document_sequences WHERE sequence_key = ? FOR UPDATE',
    [sequenceKey]
  );

  let nextValue;
  if (existing.length === 0) {
    nextValue = (await highestExistingNumber(connection, config, prefix)) + 1;
    await connection.query(
      'INSERT INTO document_sequences (sequence_key, current_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE current_value = GREATEST(current_value + 1, VALUES(current_value))',
      [sequenceKey, nextValue]
    );
    const [[row]] = await connection.query(
      'SELECT current_value FROM document_sequences WHERE sequence_key = ? FOR UPDATE',
      [sequenceKey]
    );
    nextValue = row.current_value;
  } else {
    nextValue = Number(existing[0].current_value) + 1;
    await connection.query(
      'UPDATE document_sequences SET current_value = ? WHERE sequence_key = ?',
      [nextValue, sequenceKey]
    );
  }

  return `${prefix}${String(nextValue).padStart(config.pad, '0')}`;
};

module.exports = { nextDocumentNumber, DOCUMENT_TYPES };
