const express = require('express');
const router = express.Router();
const materialRequestController = require('../controllers/materialRequestController');
const { authenticate } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', materialRequestController.getAll);
router.get('/:id', materialRequestController.getById);
router.patch('/:id/status', materialRequestController.updateStatus);
router.put('/:id/warehouse', materialRequestController.updateWarehouse);
router.post('/:id/items', materialRequestController.addItem);
router.post('/', materialRequestController.create);
router.delete('/:id/items/:itemId', materialRequestController.deleteItem);
router.delete('/:id', materialRequestController.delete);

module.exports = router;
