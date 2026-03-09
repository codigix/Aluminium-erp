const rfqService = require('../services/rfqService');

const createRfq = async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            requested_by: req.user ? req.user.id : null
        };
        const result = await rfqService.createRfq(payload);
        res.status(201).json({ message: 'RFQ created successfully', data: result });
    } catch (error) {
        next(error);
    }
};

const getRfqsByMrId = async (req, res, next) => {
    try {
        const { mrId } = req.params;
        const rfqs = await rfqService.getRfqsByMrId(mrId);
        res.json(rfqs);
    } catch (error) {
        next(error);
    }
};

const getRfqs = async (req, res, next) => {
    try {
        const rfqs = await rfqService.getRfqs();
        res.json(rfqs);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createRfq,
    getRfqsByMrId,
    getRfqs
};
