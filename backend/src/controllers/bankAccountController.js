const bankAccountService = require('../services/bankAccountService');

const createBankAccount = async (req, res, next) => {
  try {
    const result = await bankAccountService.createBankAccount(req.body);
    res.status(201).json({
      message: 'Bank account created',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getBankAccounts = async (req, res, next) => {
  try {
    const isActive = req.query.active !== 'false';
    const accounts = await bankAccountService.getBankAccounts(isActive);
    res.json(accounts);
  } catch (error) {
    next(error);
  }
};

const getBankAccountById = async (req, res, next) => {
  try {
    const account = await bankAccountService.getBankAccountById(req.params.accountId);
    res.json(account);
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
      message: 'Bank account updated',
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
      message: 'Bank account deleted',
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
  updateBankAccount,
  deactivateBankAccount,
  deleteBankAccount
};
