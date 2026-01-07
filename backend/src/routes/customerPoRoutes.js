const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const customerPoController = require('../controllers/customerPoController');

router.post('/parse', upload.single('poPdf'), customerPoController.parseCustomerPoPdf);
router.post('/', upload.single('poPdf'), customerPoController.createCustomerPo);
router.get('/', customerPoController.listCustomerPos);
router.get('/:id', customerPoController.getCustomerPo);

module.exports = router;
