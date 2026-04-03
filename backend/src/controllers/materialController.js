const materialService = require('../services/materialService');

class MaterialController {
  async getAll(req, res) {
    try {
      const materials = await materialService.getAll();
      res.json(materials);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const material = await materialService.getById(req.params.id);
      if (material) {
        res.json(material);
      } else {
        res.status(404).json({ message: 'Material not found' });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const material = await materialService.create(req.body);
      res.status(201).json(material);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const material = await materialService.update(req.params.id, req.body);
      res.json(material);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      await materialService.delete(req.params.id);
      res.json({ message: 'Material deleted' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new MaterialController();
