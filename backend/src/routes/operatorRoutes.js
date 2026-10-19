const express = require('express');
const router = express.Router();
const operatorService = require('../services/operatorService');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

// 1. Get all operators
router.get('/', authorize(['PROD_VIEW', 'PROD_MANAGE']), async (req, res) => {
  try {
    const operators = await operatorService.getAllOperators();
    res.json(operators);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Live overview of all operators (current running machine, free/busy status, today load)
router.get('/overview', authorize(['PROD_VIEW', 'PROD_MANAGE']), async (req, res) => {
  try {
    const overview = await operatorService.getOperatorsOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Timetable schedule for an operator
router.get('/:id/schedule', authorize(['PROD_VIEW', 'PROD_MANAGE']), async (req, res) => {
  try {
    const schedule = await operatorService.getOperatorSchedule(req.params.id, req.query);
    res.json(schedule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. Historical allocated machines & logs for an operator
router.get('/:id/history', authorize(['PROD_VIEW', 'PROD_MANAGE']), async (req, res) => {
  try {
    const history = await operatorService.getOperatorHistory(req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 5. Create new operator
router.post('/', authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    const operator = await operatorService.createOperator(req.body);
    res.status(201).json(operator);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 6. Update operator
router.put('/:id', authorize(['PROD_MANAGE']), async (req, res) => {
  try {
    const updated = await operatorService.updateOperator(req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
