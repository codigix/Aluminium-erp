const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const drawingService = require('../services/drawingService');
const parseExcelDrawings = require('../utils/excelDrawingParser');
const { uploadsPath } = require('../config/uploadConfig');

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
    const { id } = req.params;
    const { 
      description, 
      revisionNo, 
      clientName, 
      contactPerson, 
      phoneNumber, 
      emailAddress,
      customerType,
      gstin,
      city,
      state,
      billingAddress,
      shippingAddress,
      qty,
      remarks,
      drawingNo
    } = req.body;
    const drawingPdf = req.file ? `uploads/${req.file.filename}` : null;

    await drawingService.updateDrawing(id, { 
      description, 
      revisionNo, 
      drawingPdf,
      clientName,
      contactPerson,
      phoneNumber,
      emailAddress,
      customerType,
      gstin,
      city,
      state,
      billingAddress,
      shippingAddress,
      qty,
      remarks,
      drawingNo
    });
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
    const { 
      clientName, drawingNo, revision, qty, description, remarks, fileType, 
      contactPerson, phoneNumber, emailAddress,
      customerType, gstin, city, state, billingAddress, shippingAddress
    } = req.body;
    
    // Check for both single file and multiple files (upload.fields)
    const excelFile = req.files?.file?.[0] || req.file;
    const zipFile = req.files?.zipFile?.[0];

    const fileName = excelFile ? excelFile.filename : null;
    if (!fileName) throw new Error('Excel or Drawing file is required');

    // Use absolute path for reading the file with XLSX
    const absoluteExcelPath = path.join(uploadsPath, fileName);
    const dbFilePath = `uploads/${fileName}`;

    const uploadedBy = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Sales';

    // Handle Excel + ZIP
    if ((fileType === 'XLSX' || fileType === 'XLS') && excelFile) {
      const parsedDrawings = await parseExcelDrawings(absoluteExcelPath);
      if (parsedDrawings && parsedDrawings.length > 0) {
        let zipEntries = [];
        if (zipFile) {
          const zip = new AdmZip(zipFile.path);
          zipEntries = zip.getEntries();
        }

        const batchData = [];
        for (const d of parsedDrawings) {
          let rowFilePath = null; 
          
          if (zipFile && zipEntries.length > 0) {
            // Find drawing file in ZIP matching drawingNo or drawingFile column
            // We search for files matching drawingNo (ignoring case and extension)
            const cleanDrawingNo = d.drawingNo.toLowerCase().trim();
            const explicitFileName = d.drawingFile ? d.drawingFile.toLowerCase().trim() : null;

            const entry = zipEntries.find(e => {
              if (e.isDirectory) return false;
              const entryName = e.entryName.toLowerCase();
              const fileNameWithExt = path.basename(entryName);
              const fileNameWithoutExt = path.basename(entryName, path.extname(entryName));
              
              // Priority 0: Exact match with explicit drawingFile from Excel
              if (explicitFileName && (fileNameWithExt === explicitFileName || fileNameWithoutExt === explicitFileName)) return true;

              // Priority 1: Exact match of filename without extension
              if (fileNameWithoutExt === cleanDrawingNo) return true;
              
              // Priority 2: Full entry name matches (for files in root)
              if (entryName === cleanDrawingNo) return true;

              // Priority 3: Filename includes drawing number (best effort)
              return fileNameWithoutExt.includes(cleanDrawingNo) || cleanDrawingNo.includes(fileNameWithoutExt);
            });

            if (entry) {
              const safeFileName = `${Date.now()}-${path.basename(entry.entryName).replace(/\s+/g, '_')}`;
              const destPath = path.join(uploadsPath, safeFileName);
              fs.writeFileSync(destPath, entry.getData());
              rowFilePath = `uploads/${safeFileName}`;
            }
          }

          // If no ZIP match, we can still save the record but without a file path
          // Unless the user uploaded a single drawing (which shouldn't happen in batch mode but let's be safe)
          
          batchData.push({
            clientName,
            drawingNo: d.drawingNo,
            revision: d.revision || revision,
            qty: d.qty || qty || 1,
            description: d.description || description,
            filePath: rowFilePath,
            fileType: rowFilePath ? (path.extname(rowFilePath).replace('.', '').toUpperCase() || 'PDF') : 'NONE',
            remarks: d.remarks || remarks,
            uploadedBy,
            contactPerson,
            phoneNumber,
            emailAddress,
            customerType,
            gstin,
            city,
            state,
            billingAddress,
            shippingAddress
          });
        }
        
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
      filePath: dbFilePath,
      fileType,
      remarks,
      uploadedBy,
      contactPerson,
      phoneNumber,
      emailAddress,
      customerType,
      gstin,
      city,
      state,
      billingAddress,
      shippingAddress
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
