const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const drawingService = require('../services/drawingService');
const { parseExcelDrawings, normalizeDrawingType } = require('../utils/excelDrawingParser');
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
      drawing_type: drawing_type !== undefined ? normalizeDrawingType(drawing_type, description) : undefined,
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

    await drawingService.updateItemDrawing(itemId, { 
      drawingNo, 
      revisionNo, 
      description, 
      drawingPdf, 
      drawing_type: drawing_type !== undefined ? normalizeDrawingType(drawing_type, description) : undefined 
    });
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

const normalizeCode = (str) => {
  if (!str) return '';
  return String(str).trim().toLowerCase().replace(/^0+/, '').replace(/[^a-z0-9]/g, '');
};

const collapseZeros = (str) => {
  return normalizeCode(str).replace(/0+/g, '0');
};

const getEntryPathParts = (entryName) => {
  const normalized = String(entryName || '').replace(/\\/g, '/');
  const parts = normalized.split('/').map(p => p.trim()).filter(Boolean);
  const fileName = parts.length > 0 ? parts[parts.length - 1] : '';
  const ext = path.extname(fileName);
  const baseNoExt = ext ? fileName.slice(0, fileName.length - ext.length) : fileName;
  const folderParts = parts.slice(0, -1);
  return { normalized, parts, fileName, ext, baseNoExt, folderParts };
};

const findMatchingZipEntry = (zipEntries, drawingNo, explicitFileName) => {
  if (!zipEntries || zipEntries.length === 0 || !drawingNo) return null;

  const rawDrawingNo = String(drawingNo).trim();
  const cleanDrawingNo = rawDrawingNo.toLowerCase();
  const normDrawingNo = normalizeCode(cleanDrawingNo);
  const collapsedDrawingNo = collapseZeros(cleanDrawingNo);
  const cleanExplicit = explicitFileName ? String(explicitFileName).trim().toLowerCase() : null;

  const validEntries = zipEntries.filter(e => {
    if (e.isDirectory) return false;
    const { normalized, fileName } = getEntryPathParts(e.entryName);
    if (normalized.includes('__MACOSX') || fileName.startsWith('.')) return false;
    return true;
  });

  // Priority 0: Exact match with explicit drawingFile from Excel
  if (cleanExplicit) {
    const match = validEntries.find(e => {
      const { fileName, baseNoExt } = getEntryPathParts(e.entryName);
      return fileName.toLowerCase() === cleanExplicit || baseNoExt.toLowerCase() === cleanExplicit;
    });
    if (match) return match;
  }

  // Priority 1: Exact match of filename without extension
  let match = validEntries.find(e => {
    const { baseNoExt } = getEntryPathParts(e.entryName);
    return baseNoExt.toLowerCase().trim() === cleanDrawingNo;
  });
  if (match) return match;

  // Priority 2: Normalized match of filename without extension (removes leading zeros, symbols)
  match = validEntries.find(e => {
    const { baseNoExt } = getEntryPathParts(e.entryName);
    return normalizeCode(baseNoExt) === normDrawingNo;
  });
  if (match) return match;

  // Priority 3: Parent directory match (e.g., "09002017001/090002017001.png" -> folder "09002017001" matches "9002017001")
  match = validEntries.find(e => {
    const { folderParts } = getEntryPathParts(e.entryName);
    return folderParts.some(f => {
      const cleanFolder = f.toLowerCase();
      return cleanFolder === cleanDrawingNo || normalizeCode(cleanFolder) === normDrawingNo;
    });
  });
  if (match) return match;

  // Priority 4: Filename contains drawing number (or normalized contains normalized)
  match = validEntries.find(e => {
    const { baseNoExt } = getEntryPathParts(e.entryName);
    const normBase = normalizeCode(baseNoExt);
    return baseNoExt.toLowerCase().includes(cleanDrawingNo) || (normDrawingNo.length >= 4 && normBase.includes(normDrawingNo));
  });
  if (match) return match;

  // Priority 5: Zero-collapsed match for zero repetition differences (e.g. 090002017001 vs 9002017001)
  match = validEntries.find(e => {
    const { folderParts, baseNoExt } = getEntryPathParts(e.entryName);
    const allSegments = [...folderParts, baseNoExt];
    return allSegments.some(seg => collapseZeros(seg) === collapsedDrawingNo);
  });
  if (match) return match;

  // Priority 6: Any segment in the entry path includes the normalized drawing number
  match = validEntries.find(e => {
    const { normalized } = getEntryPathParts(e.entryName);
    const normPath = normalizeCode(normalized);
    return normDrawingNo.length >= 4 && normPath.includes(normDrawingNo);
  });
  if (match) return match;

  return null;
};

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
            const entry = findMatchingZipEntry(zipEntries, d.drawingNo, d.drawingFile);

            if (entry) {
              const { fileName: entryFileName } = getEntryPathParts(entry.entryName);
              const safeFileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}-${entryFileName.replace(/[\s,;'"()]+/g, '_')}`;
              const destPath = path.join(uploadsPath, safeFileName);
              fs.writeFileSync(destPath, entry.getData());
              rowFilePath = `uploads/${safeFileName}`;
            }
          }

          const itemDrawingType = normalizeDrawingType(d.drawing_type || d.drawingType || drawing_type, d.description || description);

          batchData.push({
            clientName,
            projectName,
            drawingNo: d.drawingNo,
            revision: d.revision || revision,
            qty: d.qty || qty || 1,
            description: d.description || description,
            drawing_type: itemDrawingType,
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
      drawing_type: normalizeDrawingType(drawing_type, description),
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
