/**
 * 57 Standard Accounting Ledger Groups
 * Used across Vouchers, Customer Receivables, Vendor Payables, and Chart of Accounts.
 */

export const LEDGER_GROUPS = [
  { id: 1, name: 'Accounting Writing Charges', category: 'Expenses' },
  { id: 2, name: 'Bank Accounts', category: 'Assets' },
  { id: 3, name: 'Bank OCC A/c', category: 'Liabilities' },
  { id: 4, name: 'Bank OD A/c', category: 'Liabilities' },
  { id: 5, name: 'BONUS', category: 'Expenses' },
  { id: 6, name: 'Branch / Divisions', category: 'Liabilities' },
  { id: 7, name: 'Capital Account', category: 'Capital' },
  { id: 8, name: 'Cash-in-Hand', category: 'Assets' },
  { id: 9, name: 'Current Assets', category: 'Assets' },
  { id: 10, name: 'Current Liabilities', category: 'Liabilities' },
  { id: 11, name: 'Deposits (Asset)', category: 'Assets' },
  { id: 12, name: 'Direct Expenses', category: 'Expenses' },
  { id: 13, name: 'Direct Incomes', category: 'Income' },
  { id: 14, name: 'Duties & Taxes', category: 'Liabilities' },
  { id: 15, name: 'Expenses (Direct)', category: 'Expenses' },
  { id: 16, name: 'Expenses (Indirect)', category: 'Expenses' },
  { id: 17, name: 'Financial Expenses', category: 'Expenses' },
  { id: 18, name: 'Fixed Assets', category: 'Assets' },
  { id: 19, name: 'GST TAX', category: 'Liabilities' },
  { id: 20, name: 'Income (Direct)', category: 'Income' },
  { id: 21, name: 'Income (Indirect)', category: 'Income' },
  { id: 22, name: 'Indirect Expenses', category: 'Expenses' },
  { id: 23, name: 'Indirect Incomes', category: 'Income' },
  { id: 24, name: 'Insurance Charges', category: 'Expenses' },
  { id: 25, name: 'Investments', category: 'Assets' },
  { id: 26, name: 'Labour Charges/ Jobwork/services', category: 'Expenses' },
  { id: 27, name: 'Land Purchase', category: 'Assets' },
  { id: 28, name: 'Loans & Advances (Asset)', category: 'Assets' },
  { id: 29, name: 'Loans (Liability)', category: 'Liabilities' },
  { id: 30, name: 'Misc. Expenses (ASSET)', category: 'Assets' },
  { id: 31, name: 'MVAT TAX', category: 'Liabilities' },
  { id: 32, name: 'Provisions', category: 'Liabilities' },
  { id: 33, name: 'Purchase Accounts', category: 'Expenses' },
  { id: 34, name: 'Purchase GST', category: 'Liabilities' },
  { id: 35, name: 'Purchase MVAT', category: 'Liabilities' },
  { id: 36, name: 'Rates & Taxes Paid', category: 'Expenses' },
  { id: 37, name: 'Repairs & Maintenance', category: 'Expenses' },
  { id: 38, name: 'Reserves & Surplus', category: 'Capital' },
  { id: 39, name: 'Retained Earnings', category: 'Capital' },
  { id: 40, name: 'Salary', category: 'Expenses' },
  { id: 41, name: 'Sales Accounts', category: 'Income' },
  { id: 42, name: 'Sales GST', category: 'Liabilities' },
  { id: 43, name: 'Sales MVAT', category: 'Liabilities' },
  { id: 44, name: 'Secured Loans', category: 'Liabilities' },
  { id: 45, name: 'Shop Expences', category: 'Expenses' },
  { id: 46, name: 'Shop Rent', category: 'Expenses' },
  { id: 47, name: 'Smart Automation', category: 'Expenses' },
  { id: 48, name: 'Staff Advance', category: 'Assets' },
  { id: 49, name: 'Stock-in-Hand', category: 'Assets' },
  { id: 50, name: 'SUJAL J GAJBHIYE', category: 'Capital' },
  { id: 51, name: 'Sundry Creditors', category: 'Liabilities' },
  { id: 52, name: 'Sundry Debtors', category: 'Assets' },
  { id: 53, name: 'Suspense A/c', category: 'Liabilities' },
  { id: 54, name: 'TDS Payable', category: 'Liabilities' },
  { id: 55, name: 'TELEPHONE CHARGES', category: 'Expenses' },
  { id: 56, name: 'Unsecured Loans', category: 'Liabilities' },
  { id: 57, name: 'Wages', category: 'Expenses' },
];

export const DEFAULT_CUSTOMER_LEDGER_GROUP = 'Sundry Debtors';
export const DEFAULT_VENDOR_LEDGER_GROUP = 'Sundry Creditors';

export const getLedgerGroupById = (id) => LEDGER_GROUPS.find((g) => g.id === Number(id));
export const getLedgerGroupByName = (name) => LEDGER_GROUPS.find((g) => g.name.toLowerCase() === String(name).toLowerCase());

export const LEDGER_PARTY_TYPES = {
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  BANK: 'BANK',
  CASH: 'CASH',
  GENERAL: 'GENERAL',
};

/**
 * Detect the entity/party selection type required for a ledger group name or id.
 * 52. Sundry Debtors -> CUSTOMER
 * 51. Sundry Creditors -> SUPPLIER
 * Bank Accounts / Bank OD / Bank OCC -> BANK
 * Cash-in-Hand -> CASH
 * Expense, Income, Assets and Liabilities -> GENERAL
 */
export function getLedgerGroupType(nameOrId) {
  if (!nameOrId || nameOrId === 'ALL') return LEDGER_PARTY_TYPES.CUSTOMER;
  
  const raw = String(nameOrId).trim();
  const idMatch = raw.match(/^(\d+)/);
  const id = idMatch ? parseInt(idMatch[1], 10) : null;
  const clean = raw.replace(/^\d+[\.\-\s]+/, '').trim().toLowerCase();

  // 1. Sundry Debtors (Group 52)
  if (id === 52 || clean.includes('sundry debtor') || clean.includes('debtor')) {
    return LEDGER_PARTY_TYPES.CUSTOMER;
  }

  // 2. Sundry Creditors (Group 51)
  if (id === 51 || clean.includes('sundry creditor') || clean.includes('creditor')) {
    return LEDGER_PARTY_TYPES.SUPPLIER;
  }

  // 3. Bank Accounts / Bank OD / Bank OCC (Groups 2, 3, 4)
  if (
    id === 2 || id === 3 || id === 4 ||
    clean.includes('bank account') || clean.includes('bank od') || clean.includes('bank occ') ||
    clean.startsWith('bank')
  ) {
    return LEDGER_PARTY_TYPES.BANK;
  }

  // 4. Cash-in-Hand (Group 8)
  if (
    id === 8 ||
    clean.includes('cash-in-hand') || clean.includes('cash in hand') ||
    clean === 'cash' || clean.includes('petty cash')
  ) {
    return LEDGER_PARTY_TYPES.CASH;
  }

  // 5. Expense, Income, Assets and Liabilities -> GENERAL
  return LEDGER_PARTY_TYPES.GENERAL;
}

/**
 * Get field metadata (labels, placeholders, badges) for a ledger group.
 */
export function getLedgerPartyMeta(nameOrId) {
  const type = getLedgerGroupType(nameOrId);
  switch (type) {
    case LEDGER_PARTY_TYPES.CUSTOMER:
      return {
        type,
        label: 'Select Customer',
        placeholder: 'Select Customer → Sidel India Pvt Ltd',
        searchPlaceholder: 'Search customer name...',
        clearTitle: 'Clear customer',
        headerBadge: 'Customer Receivables',
        partyKey: 'customer',
      };
    case LEDGER_PARTY_TYPES.SUPPLIER:
      return {
        type,
        label: 'Select Supplier',
        placeholder: 'Select Supplier → RK Laser Unit 2',
        searchPlaceholder: 'Search supplier / vendor name...',
        clearTitle: 'Clear supplier',
        headerBadge: 'Vendor Payables',
        partyKey: 'supplier',
      };
    case LEDGER_PARTY_TYPES.BANK:
      return {
        type,
        label: 'Select Bank Account',
        placeholder: 'Select Bank Account → SBI Current Account',
        searchPlaceholder: 'Search bank account...',
        clearTitle: 'Clear bank account',
        headerBadge: 'Bank Accounts',
        partyKey: 'bank',
      };
    case LEDGER_PARTY_TYPES.CASH:
      return {
        type,
        label: 'Select Cash Account',
        placeholder: 'Select Cash Ledger',
        searchPlaceholder: 'Search cash ledger...',
        clearTitle: 'Clear cash account',
        headerBadge: 'Cash Accounts',
        partyKey: 'cash',
      };
    case LEDGER_PARTY_TYPES.GENERAL:
    default:
      return {
        type,
        label: 'Select General Ledger',
        placeholder: 'Select the relevant ledger from the existing chart of accounts.',
        searchPlaceholder: 'Select the relevant ledger from chart of accounts...',
        clearTitle: 'Clear general ledger',
        headerBadge: 'General Ledger',
        partyKey: 'general',
      };
  }
}

