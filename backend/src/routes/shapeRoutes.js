const express = require('express');
const router = express.Router();
const shapeController = require('../controllers/shapeController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), shapeController.getAll);
router.get('/:id', authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), shapeController.getById);
router.post('/', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), shapeController.create);
router.put('/:id', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), shapeController.update);
router.delete('/:id', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), shapeController.delete);

module.exports = router;
