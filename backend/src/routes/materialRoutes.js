const express = require('express');
const router = express.Router();
const materialController = require('../controllers/materialController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), materialController.getAll);
router.get('/:id', authorize(['STOCK_VIEW', 'DESIGN_VIEW', 'DESIGN_MANAGE']), materialController.getById);
router.post('/', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), materialController.create);
router.put('/:id', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), materialController.update);
router.delete('/:id', authorize(['STOCK_MANAGE', 'DESIGN_MANAGE']), materialController.delete);

module.exports = router;
