const itemGroupService = require('../services/itemGroupService');

class ItemGroupController {
  async getAll(req, res) {
    try {
      const groups = await itemGroupService.getAll();
      res.json(groups);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const group = await itemGroupService.getById(req.params.id);
      if (group) {
        res.json(group);
      } else {
        res.status(404).json({ message: 'Item group not found' });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const group = await itemGroupService.create(req.body);
      res.status(201).json(group);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const group = await itemGroupService.update(req.params.id, req.body);
      res.json(group);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      await itemGroupService.delete(req.params.id);
      res.json({ message: 'Item group deleted' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new ItemGroupController();
