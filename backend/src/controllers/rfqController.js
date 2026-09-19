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

const getRfqById = async (req, res, next) => {
    try {
        const rfq = await rfqService.getRfqById(req.params.id);
        if (!rfq) return res.status(404).json({ error: 'RFQ not found' });
        res.json(rfq);
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

const assignItemVendors = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { itemVendorMap, targetStatus } = req.body; // { [rfq_item_id]: vendor_id | null }

        if (!itemVendorMap || typeof itemVendorMap !== 'object') {
            return res.status(400).json({ error: 'itemVendorMap is required' });
        }

        const result = await rfqService.updateRfqItemVendors(id, itemVendorMap, targetStatus);
        res.json({ message: 'Vendor assignment updated', data: result });
    } catch (error) {
        next(error);
    }
};

const deleteRfq = async (req, res, next) => {
    try {
        const { id } = req.params;
        await rfqService.deleteRfq(id);
        res.json({ message: 'RFQ deleted successfully' });
    } catch (error) {
        next(error);
    }
};

const getMergeEligibleVendors = async (req, res, next) => {
    try {
        const vendors = await rfqService.getMergeEligibleVendors();
        res.json(vendors);
    } catch (error) {
        next(error);
    }
};

const getMergeEligibleRfqs = async (req, res, next) => {
    try {
        const { vendorId } = req.query;
        if (!vendorId) return res.status(400).json({ error: 'vendorId is required' });
        const rfqs = await rfqService.getMergeEligibleRfqs(vendorId);
        res.json(rfqs);
    } catch (error) {
        next(error);
    }
};

const mergeRfqs = async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            requestedBy: req.user ? req.user.id : null
        };
        const result = await rfqService.mergeRfqs(payload);
        res.status(201).json({ message: 'RFQs merged successfully', data: result });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createRfq,
    getRfqById,
    getRfqsByMrId,
    getRfqs,
    assignItemVendors,
    deleteRfq,
    getMergeEligibleVendors,
    getMergeEligibleRfqs,
    mergeRfqs
};
