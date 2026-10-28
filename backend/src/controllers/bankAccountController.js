const bankAccountService = require('../services/bankAccountService');

const createBankAccount = async (req, res, next) => {
  try {
    const result = await bankAccountService.createBankAccount(req.body);
    res.status(201).json({
      success: true,
      message: 'Bank account registered successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getBankAccounts = async (req, res, next) => {
  try {
    const accounts = await bankAccountService.getBankAccounts(req.query);
    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    next(error);
  }
};

const getBankAccountById = async (req, res, next) => {
  try {
    const account = await bankAccountService.getBankAccountById(req.params.accountId);
    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    next(error);
  }
};

const getBankPeriodSummary = async (req, res, next) => {
  try {
    const summary = await bankAccountService.getBankPeriodSummary(req.params.accountId, req.query.startDate, req.query.endDate, req.query.hostCompanyId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

const updateBankAccount = async (req, res, next) => {
  try {
    const result = await bankAccountService.updateBankAccount(
      req.params.accountId,
      req.body
    );
    res.json({
      success: true,
      message: 'Bank account updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const toggleBankAccountStatus = async (req, res, next) => {
  try {
    const result = await bankAccountService.toggleBankAccountStatus(req.params.accountId);
    res.json({
      success: true,
      message: `Bank account marked as ${result.status}`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const deactivateBankAccount = async (req, res, next) => {
  try {
    const result = await bankAccountService.deactivateBankAccount(req.params.accountId);
    res.json({
      success: true,
      message: 'Bank account deactivated',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const deleteBankAccount = async (req, res, next) => {
  try {
    const result = await bankAccountService.deleteBankAccount(req.params.accountId);
    res.json({
      success: true,
      message: 'Bank account deleted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBankAccount,
  getBankAccounts,
  getBankAccountById,
  getBankPeriodSummary,
  updateBankAccount,
  toggleBankAccountStatus,
  deactivateBankAccount,
  deleteBankAccount
};
