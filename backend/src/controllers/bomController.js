const bomService = require('../services/bomService');

const getItemMaterials = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { itemCode, drawingNo, drawingId, drawing_id } = req.query;
    
    // Support fetching by either itemId (sales_order_item_id), itemCode (Master BOM), or drawingNo
    const effectiveItemId = (itemId === 'null' || itemId === 'undefined' || itemId === 'bom-form') ? null : itemId;
    const resolvedDrawingId = drawingId || drawing_id || null;
    
    const materials = await bomService.getItemMaterials(effectiveItemId, itemCode, drawingNo, resolvedDrawingId);
    const components = await bomService.getItemComponents(effectiveItemId, itemCode, drawingNo, null, null, null, resolvedDrawingId);
    const operations = await bomService.getItemOperations(effectiveItemId, itemCode, drawingNo, resolvedDrawingId);
    const scrap = await bomService.getItemScrap(effectiveItemId, itemCode, drawingNo, resolvedDrawingId);
    res.json({ materials, components, operations, scrap });
  } catch (error) {
    next(error);
  }
};

const addItemMaterial = async (req, res, next) => {
  try {
    const materialId = await bomService.addItemMaterial(req.params.itemId, req.body);
    res.status(201).json({ id: materialId, message: 'Material added to BOM' });
  } catch (error) {
    next(error);
  }
};

const addComponent = async (req, res, next) => {
  try {
    const id = await bomService.addComponent(req.params.itemId, req.body);
    res.status(201).json({ id, message: 'Component added to BOM' });
  } catch (error) {
    next(error);
  }
};

const addOperation = async (req, res, next) => {
  try {
    const id = await bomService.addOperation(req.params.itemId, req.body);
    res.status(201).json({ id, message: 'Operation added to BOM' });
  } catch (error) {
    next(error);
  }
};

const addScrap = async (req, res, next) => {
  try {
    const id = await bomService.addScrap(req.params.itemId, req.body);
    res.status(201).json({ id, message: 'Scrap added to BOM' });
  } catch (error) {
    next(error);
  }
};

const updateItemMaterial = async (req, res, next) => {
  try {
    await bomService.updateItemMaterial(req.params.id, req.body);
    res.json({ message: 'BOM material updated' });
  } catch (error) {
    next(error);
  }
};

const updateOperation = async (req, res, next) => {
  try {
    await bomService.updateOperation(req.params.id, req.body);
    res.json({ message: 'BOM operation updated' });
  } catch (error) {
    next(error);
  }
};

const updateComponent = async (req, res, next) => {
  try {
    await bomService.updateComponent(req.params.id, req.body);
    res.json({ message: 'BOM component updated' });
  } catch (error) {
    next(error);
  }
};

const updateScrap = async (req, res, next) => {
  try {
    await bomService.updateScrap(req.params.id, req.body);
    res.json({ message: 'BOM scrap updated' });
  } catch (error) {
    next(error);
  }
};

const deleteItemMaterial = async (req, res, next) => {
  try {
    await bomService.deleteItemMaterial(req.params.id);
    res.json({ message: 'Material removed from BOM' });
  } catch (error) {
    next(error);
  }
};

const deleteComponent = async (req, res, next) => {
  try {
    await bomService.deleteComponent(req.params.id);
    res.json({ message: 'Component removed from BOM' });
  } catch (error) {
    next(error);
  }
};

const deleteOperation = async (req, res, next) => {
  try {
    await bomService.deleteOperation(req.params.id);
    res.json({ message: 'Operation removed from BOM' });
  } catch (error) {
    next(error);
  }
};

const deleteScrap = async (req, res, next) => {
  try {
    await bomService.deleteScrap(req.params.id);
    res.json({ message: 'Scrap removed from BOM' });
  } catch (error) {
    next(error);
  }
};

const getBOMBySalesOrder = async (req, res, next) => {
  try {
    const bom = await bomService.getBOMBySalesOrder(req.params.salesOrderId);
    res.json(bom);
  } catch (error) {
    next(error);
  }
};

const createBOMRequest = async (req, res, next) => {
  try {
    const result = await bomService.createBOMRequest(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const getApprovedBOMs = async (req, res, next) => {
  try {
    const boms = await bomService.getApprovedBOMs();
    res.json(boms);
  } catch (error) {
    next(error);
  }
};

const deleteBOM = async (req, res, next) => {
  try {
    await bomService.deleteBOM(req.params.itemId);
    res.json({ message: 'BOM deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getBOMHistory = async (req, res, next) => {
  try {
    const { itemCode, drawingNo, itemId } = req.query;
    const history = await bomService.getBOMHistory(itemCode, drawingNo, itemId);
    res.json(history);
  } catch (error) {
    next(error);
  }
};

const getLatestBOMCost = async (req, res, next) => {
  try {
    const { itemCode, drawingNo, bomId } = req.query;
    const result = await bomService.getLatestBOMCost(itemCode, drawingNo, bomId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const unlinkChildFromAssembly = async (req, res, next) => {
  try {
    await bomService.unlinkChildFromAssembly(req.params.itemId);
    res.json({ message: 'Child item removed from assembly' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getItemMaterials,
  addItemMaterial,
  addComponent,
  addOperation,
  addScrap,
  updateItemMaterial,
  updateOperation,
  updateComponent,
  updateScrap,
  deleteItemMaterial,
  deleteComponent,
  deleteOperation,
  deleteScrap,
  getBOMBySalesOrder,
  getApprovedBOMs,
  createBOMRequest,
  deleteBOM,
  getBOMHistory,
  getLatestBOMCost,
  unlinkChildFromAssembly
};
