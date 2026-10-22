const creditNoteService = require('../services/creditNoteService');

const getCreditNoteSources = async (req, res, next) => {
  try {
    const sources = await creditNoteService.getCreditNoteSources(req.query.customerId);
    res.json(sources);
  } catch (error) {
    next(error);
  }
};

const getNextCreditNoteNo = async (req, res, next) => {
  try {
    const voucherNo = await creditNoteService.generateNextCreditNoteNo();
    res.json({ voucherNo });
  } catch (error) {
    next(error);
  }
};

const recordCreditNote = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const result = await creditNoteService.recordCreditNote({
      ...req.body,
      createdBy: userId
    });
    res.status(201).json({
      message: 'Credit note posted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getCreditNotes = async (req, res, next) => {
  try {
    const creditNotes = await creditNoteService.getCreditNotes(req.query.customerId || null);
    res.json(creditNotes);
  } catch (error) {
    next(error);
  }
};

const cancelCreditNote = async (req, res, next) => {
  try {
    const result = await creditNoteService.cancelCreditNote(req.params.id);
    res.json({
      message: 'Credit note cancelled successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCreditNoteSources,
  getNextCreditNoteNo,
  recordCreditNote,
  getCreditNotes,
  cancelCreditNote
};
