const companyService = require('../services/companyService');

const createCompany = async (req, res, next) => {
  try {
    const result = await companyService.createCompany(req.body);
    res.status(201).json({ message: 'Company created', data: result });
  } catch (error) {
    next(error);
  }
};

const getCompanies = async (req, res, next) => {
  try {
    const companies = await companyService.getCompanies();
    res.json(companies);
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const result = await companyService.updateCompany(req.params.companyId, req.body);
    res.json({ message: 'Company updated', data: result });
  } catch (error) {
    next(error);
  }
};

const updateCompanyStatus = async (req, res, next) => {
  try {
    const status = await companyService.updateCompanyStatus(req.params.companyId, req.body.status);
    res.json({ message: 'Status updated', status });
  } catch (error) {
    next(error);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    await companyService.deleteCompany(req.params.companyId);
    res.json({ message: 'Company removed' });
  } catch (error) {
    next(error);
  }
};

const addContact = async (req, res, next) => {
  try {
    const result = await companyService.addContact({
      companyId: req.params.companyId,
      ...req.body
    });
    res.status(201).json({ message: 'Contact added', data: result });
  } catch (error) {
    next(error);
  }
};

const updateContact = async (req, res, next) => {
  try {
    const result = await companyService.updateContact(req.params.companyId, req.params.contactId, req.body);
    res.json({ message: 'Contact updated', data: result });
  } catch (error) {
    next(error);
  }
};

const updateContactStatus = async (req, res, next) => {
  try {
    const status = await companyService.updateContactStatus(req.params.companyId, req.params.contactId, req.body.status);
    res.json({ message: 'Contact status updated', status });
  } catch (error) {
    next(error);
  }
};

const deleteContact = async (req, res, next) => {
  try {
    await companyService.deleteContact(req.params.companyId, req.params.contactId);
    res.json({ message: 'Contact removed' });
  } catch (error) {
    next(error);
  }
};

const getContacts = async (req, res, next) => {
  try {
    const contacts = await companyService.getContacts(req.params.companyId);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
};

const getCompanyById = async (req, res, next) => {
  try {
    const company = await companyService.getCompanyById(req.params.companyId);
    res.json(company);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  updateCompanyStatus,
  deleteCompany,
  addContact,
  updateContact,
  updateContactStatus,
  deleteContact,
  getContacts
};
