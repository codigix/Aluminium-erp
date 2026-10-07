const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const drawingService = require('../services/drawingService');
const parseExcelDrawings = require('../utils/excelDrawingParser');
const { uploadsPath } = require('../config/uploadConfig');

const listDrawings = async (req, res, next) => {
  try {
    const { search, onlyShared, clientName, summary } = req.query;
    const drawings = await drawingService.listDrawings(search, onlyShared === 'true', clientName, summary === 'true');
    res.json(drawings);
  } catch (error) {
    next(error);
  }
};

const getDrawingById = async (req, res, next) => {
  try {
    const drawing = await drawingService.getDrawingById(req.params.id);
    if (!drawing) {
      return res.status(404).json({ message: 'Drawing not found' });
    }
    res.json(drawing);
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
      projectName,
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
      drawingNo,
      drawing_type,
      hsnCode,
      hsn_code,
      deliveryDate,
      delivery_date,
      existingFiles
    } = req.body;

    // Support both multiple files (upload.fields) and single file (upload.single)
    const filesArray = req.files?.drawing_pdf || (req.file ? [req.file] : []);
    const newFilePaths = filesArray.map(f => `uploads/${f.filename}`);

    let keptFiles = [];
    if (existingFiles) {
      try {
        keptFiles = JSON.parse(existingFiles);
        if (!Array.isArray(keptFiles)) {
          keptFiles = existingFiles ? existingFiles.split(',').filter(Boolean) : [];
        }
      } catch (e) {
        keptFiles = existingFiles ? existingFiles.split(',').filter(Boolean) : [];
      }
    }

    const finalFilePaths = [...keptFiles, ...newFilePaths];
    // If no files at all, set drawingPdf to '' (since file_path is NOT NULL)
    const drawingPdf = finalFilePaths.join(',') || '';

    // Determine drawing type extension or MIXED
    let fileType = 'NONE';
    if (finalFilePaths.length === 1) {
      fileType = path.extname(finalFilePaths[0]).replace('.', '').toUpperCase();
    } else if (finalFilePaths.length > 1) {
      fileType = 'MIXED';
    }

    await drawingService.updateDrawing(id, {
      description,
      revisionNo,
      drawingPdf,
      fileType,
      clientName,
      projectName,
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
      drawingNo,
      drawing_type,
      hsnCode: hsnCode || hsn_code,
      deliveryDate: deliveryDate || delivery_date
    });
    res.json({ message: 'Drawing updated successfully', drawingPdf, file_path: drawingPdf });
  } catch (error) {
    next(error);
  }
};

const updateItemDrawing = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { drawingNo, revisionNo, description, drawing_type } = req.body;
    const drawingPdf = req.file ? `uploads/${req.file.filename}` : null;

    await drawingService.updateItemDrawing(itemId, { drawingNo, revisionNo, description, drawingPdf, drawing_type });
    res.json({ message: 'Item drawing updated successfully' });
  } catch (error) {
    next(error);
  }
};

const createDrawing = async (req, res, next) => {
  try {
    const {
      clientName, projectName, drawingNo, revision, qty, description, remarks, fileType,
      contactPerson, phoneNumber, emailAddress,
      customerType, gstin, city, state, billingAddress, shippingAddress,
      drawing_type, hsnCode, hsn_code, deliveryDate, delivery_date,
      salesOrderId
    } = req.body;

    // Check for both single file and multiple files (upload.fields)
    const filesArray = req.files?.file || (req.file ? [req.file] : []);
    const excelFile = filesArray[0];
    const zipFile = req.files?.zipFile?.[0];

    const fileName = excelFile ? excelFile.filename : null;
    // Removed mandatory file check as requested
    // if (!fileName) throw new Error('Excel or Drawing file is required');

    // Use absolute path for reading the file with XLSX
    const absoluteExcelPath = fileName ? path.join(uploadsPath, fileName) : null;

    const isExcel = fileName && (fileType === 'XLSX' || fileType === 'XLS');

    let dbFilePath = null;
    let finalFileType = fileType;

    if (isExcel) {
      dbFilePath = `uploads/${fileName}`;
    } else {
      const filePaths = filesArray.map(f => `uploads/${f.filename}`);
      dbFilePath = filePaths.join(',') || '';

      if (filesArray.length === 1) {
        finalFileType = path.extname(excelFile.filename).replace('.', '').toUpperCase();
      } else if (filesArray.length > 1) {
        finalFileType = 'MIXED';
      } else {
        finalFileType = 'NONE';
      }
    }

    const uploadedBy = req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'Sales';

    // Handle Excel + ZIP
    if (fileName && (fileType === 'XLSX' || fileType === 'XLS') && excelFile) {
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
            projectName,
            drawingNo: d.drawingNo,
            revision: d.revision || revision,
            qty: d.qty || qty || 1,
            description: d.description || description,
            drawing_type: d.drawing_type || d.drawingType || drawing_type || 'Part',
            hsnCode: d.hsnCode || d.hsn_code || hsnCode,
            deliveryDate: d.deliveryDate || d.delivery_date || deliveryDate || delivery_date || null,
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

        const count = await drawingService.createBatchCustomerDrawings(batchData, {
          excelPath: dbFilePath,
          zipPath: zipFile ? `uploads/${zipFile.filename}` : null,
          salesOrderId: salesOrderId ? parseInt(salesOrderId) : null
        });
        return res.status(201).json({
          message: `${count} drawings imported from Excel successfully`,
          count
        });
      }
    }

    const result = await drawingService.createCustomerDrawing({
      clientName,
      projectName,
      drawingNo,
      revision,
      qty,
      description,
      filePath: dbFilePath,
      fileType: finalFileType || fileType,
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
      shippingAddress,
      drawing_type,
      hsnCode: hsnCode || hsn_code,
      deliveryDate: deliveryDate || delivery_date,
      salesOrderId: salesOrderId ? parseInt(salesOrderId) : null
    });

    res.status(201).json({
      message: 'Customer drawing uploaded successfully',
      id: result.drawingId,
      salesOrderId: result.salesOrderId
    });
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

const deleteDrawingsBulk = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      throw new Error('Drawing IDs are required and must be an array');
    }
    await drawingService.deleteDrawingsBulk(ids);
    res.json({ message: `${ids.length} drawings deleted successfully` });
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

const getApprovedDrawings = async (req, res, next) => {
  try {
    const drawings = await drawingService.getApprovedDrawings();
    res.json(drawings);
  } catch (error) {
    next(error);
  }
};

const getDrawingAutofetchDetails = async (req, res, next) => {
  try {
    const details = await drawingService.getDrawingAutofetchDetails(req.params.id);
    if (!details) {
      return res.status(404).json({ message: 'Drawing details not found' });
    }
    res.json(details);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listDrawings,
  getDrawingById,
  getDrawingRevisions,
  updateDrawing,
  updateItemDrawing,
  createDrawing,
  deleteDrawing,
  deleteDrawingsBulk,
  shareDrawing,
  shareDrawingsBulk,
  getApprovedDrawings,
  getDrawingAutofetchDetails
};
