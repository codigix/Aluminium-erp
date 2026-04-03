const shapeService = require('../services/shapeService');

class ShapeController {
  async getAll(req, res) {
    try {
      const shapes = await shapeService.getAll();
      res.json(shapes);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const shape = await shapeService.getById(req.params.id);
      if (shape) {
        res.json(shape);
      } else {
        res.status(404).json({ message: 'Shape not found' });
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }

  async create(req, res) {
    try {
      const shape = await shapeService.create(req.body);
      res.status(201).json(shape);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async update(req, res) {
    try {
      const shape = await shapeService.update(req.params.id, req.body);
      res.json(shape);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }

  async delete(req, res) {
    try {
      await shapeService.delete(req.params.id);
      res.json({ message: 'Shape deleted' });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
}

module.exports = new ShapeController();
