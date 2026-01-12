const bomService = require('../services/bomService');

const getItemMaterials = async (req, res, next) => {
  try {
    const materials = await bomService.getItemMaterials(req.params.itemId);
    res.json(materials);
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

const getBOMBySalesOrder = async (req, res, next) => {
  try {
    const bom = await bomService.getBOMBySalesOrder(req.params.salesOrderId);
    res.json(bom);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getItemMaterials,
  addItemMaterial,
  updateItemMaterial,
  deleteItemMaterial,
  getBOMBySalesOrder
};
