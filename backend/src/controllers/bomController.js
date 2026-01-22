const bomService = require('../services/bomService');

const getItemMaterials = async (req, res, next) => {
  try {
    const materials = await bomService.getItemMaterials(req.params.itemId);
    const components = await bomService.getItemComponents(req.params.itemId);
    const operations = await bomService.getItemOperations(req.params.itemId);
    const scrap = await bomService.getItemScrap(req.params.itemId);
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

module.exports = {
  getItemMaterials,
  addItemMaterial,
  addComponent,
  addOperation,
  addScrap,
  updateItemMaterial,
  deleteItemMaterial,
  deleteComponent,
  deleteOperation,
  deleteScrap,
  getBOMBySalesOrder,
  getApprovedBOMs,
  createBOMRequest
};
