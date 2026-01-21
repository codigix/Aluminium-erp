const drawingService = require('../services/drawingService');
const parseExcelDrawings = require('../utils/excelDrawingParser');

const listDrawings = async (req, res, next) => {
  try {
    const { search } = req.query;
    const drawings = await drawingService.listDrawings(search);
    res.json(drawings);
  } catch (error) {
    next(error);
  }
};

const getDrawingRevisions = async (req, res, next) => {
  try {
    const revisions = await drawingService.getDrawingRevisions(req.params.drawingNo);
    res.json(revisions);
  } catch (error) {
    next(error);
  }
};

const updateDrawing = async (req, res, next) => {
  try {
    const { drawingNo } = req.params;
    const { description, revisionNo } = req.body;
    const drawingPdf = req.file ? `uploads/${req.file.filename}` : null;

    await drawingService.updateDrawing(drawingNo, { description, revisionNo, drawingPdf });
    res.json({ message: 'Drawing updated successfully' });
  } catch (error) {
    next(error);
  }
};

const updateItemDrawing = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { drawingNo, revisionNo, description } = req.body;
    const drawingPdf = req.file ? `uploads/${req.file.filename}` : null;

    await drawingService.updateItemDrawing(itemId, { drawingNo, revisionNo, description, drawingPdf });
    res.json({ message: 'Item drawing updated successfully' });
  } catch (error) {
    next(error);
  }
};

const createDrawing = async (req, res, next) => {
  try {
    const { clientName, drawingNo, revision, qty, description, remarks, fileType, contactPerson, phoneNumber, emailAddress } = req.body;
    
    // Use relative path for database storage to ensure frontend can access it via static middleware
    const filePath = req.file ? `uploads/${req.file.filename}` : null;
    if (!filePath) throw new Error('Drawing file is required');

    const uploadedBy = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Sales';

    // Check if it's an Excel file and if we should parse it
    if (fileType === 'XLSX' || fileType === 'XLS') {
      const parsedDrawings = await parseExcelDrawings(filePath);
      if (parsedDrawings && parsedDrawings.length > 0) {
        const batchData = parsedDrawings.map(d => ({
          clientName,
          drawingNo: d.drawingNo,
          revision: d.revision || revision,
          qty: d.qty || qty || 1,
          description: d.description || description,
          filePath,
          fileType,
          remarks: d.remarks || remarks,
          uploadedBy,
          contactPerson,
          phoneNumber,
          emailAddress
        }));
        
        const count = await drawingService.createBatchCustomerDrawings(batchData);
        return res.status(201).json({ 
          message: `${count} drawings imported from Excel successfully`,
          count 
        });
      }
    }

    const id = await drawingService.createCustomerDrawing({
      clientName,
      drawingNo,
      revision,
      qty,
      description,
      filePath,
      fileType,
      remarks,
      uploadedBy,
      contactPerson,
      phoneNumber,
      emailAddress
    });

    res.status(201).json({ message: 'Customer drawing uploaded successfully', id });
  } catch (error) {
    next(error);
  }
};

const deleteDrawing = async (req, res, next) => {
  try {
    await drawingService.deleteCustomerDrawing(req.params.id);
    res.json({ message: 'Drawing deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const shareDrawing = async (req, res, next) => {
  try {
    await drawingService.shareWithDesign(req.params.id);
    res.json({ message: 'Drawing shared with Design Engineering successfully' });
  } catch (error) {
    next(error);
  }
};

const shareDrawingsBulk = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      throw new Error('Drawing IDs are required and must be an array');
    }
    await drawingService.shareDrawingsBulk(ids);
    res.json({ message: `${ids.length} drawings shared with Design Engineering successfully` });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listDrawings,
  getDrawingRevisions,
  updateDrawing,
  updateItemDrawing,
  createDrawing,
  deleteDrawing,
  shareDrawing,
  shareDrawingsBulk
};
