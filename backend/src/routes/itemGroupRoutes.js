const express = require('express');
const router = express.Router();
const itemGroupController = require('../controllers/itemGroupController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), itemGroupController.getAll);
router.get('/:id', authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), itemGroupController.getById);
router.post('/', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), itemGroupController.create);
router.put('/:id', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), itemGroupController.update);
router.delete('/:id', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), itemGroupController.delete);

module.exports = router;
