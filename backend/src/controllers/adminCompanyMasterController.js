const adminCompanyMasterService = require('../services/adminCompanyMasterService');

const getCompanies = async (req, res, next) => {
  try {
    const companies = await adminCompanyMasterService.getCompanies();
    res.json(companies);
  } catch (error) {
    next(error);
  }
};

const getCompanyById = async (req, res, next) => {
  try {
    const company = await adminCompanyMasterService.getCompanyById(req.params.id);
    res.json(company);
  } catch (error) {
    next(error);
  }
};

const getActiveCompany = async (req, res, next) => {
  try {
    const company = await adminCompanyMasterService.getActiveCompany();
    res.json(company);
  } catch (error) {
    next(error);
  }
};

const createCompany = async (req, res, next) => {
  try {
    const {
      companyName,
      companyAddress,
      gstin,
      pan,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      invoiceFooterNotes,
      status
    } = req.body;

    let companyLogo = null;
    let authorizedSignature = null;

    if (req.files) {
      if (req.files.companyLogo && req.files.companyLogo[0]) {
        companyLogo = `uploads/${req.files.companyLogo[0].filename}`;
      }
      if (req.files.authorizedSignature && req.files.authorizedSignature[0]) {
        authorizedSignature = `uploads/${req.files.authorizedSignature[0].filename}`;
      }
    }

    const result = await adminCompanyMasterService.createCompany({
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
    });

    res.status(201).json({
      message: 'Company master created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      companyName,
      companyAddress,
      gstin,
      pan,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      invoiceFooterNotes,
      status
    } = req.body;

    const payload = {
      companyName,
      companyAddress,
      gstin,
      pan,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      invoiceFooterNotes,
      status
    };

    if (req.files) {
      if (req.files.companyLogo && req.files.companyLogo[0]) {
        payload.companyLogo = `uploads/${req.files.companyLogo[0].filename}`;
      }
      if (req.files.authorizedSignature && req.files.authorizedSignature[0]) {
        payload.authorizedSignature = `uploads/${req.files.authorizedSignature[0].filename}`;
      }
    }

    const result = await adminCompanyMasterService.updateCompany(id, payload);

    res.json({
      message: 'Company master updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const deleteCompany = async (req, res, next) => {
  try {
    const result = await adminCompanyMasterService.deleteCompany(req.params.id);
    res.json({
      message: 'Company master deleted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCompanies,
  getCompanyById,
  getActiveCompany,
  createCompany,
  updateCompany,
  deleteCompany
};
