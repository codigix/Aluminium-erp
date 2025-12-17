import { SetupModel } from '../models/SetupModel.js'

export class SetupController {
  static async getPaymentTerms(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getPaymentTerms()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getLetterHeads(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getLetterHeads()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getCampaigns(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getCampaigns()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getTerritories(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getTerritories()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getLeadSources(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getLeadSources()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getLostReasons(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getLostReasons()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getTaxCategories(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getTaxCategories()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getShippingRules(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getShippingRules()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getIncoterms(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getIncoterms()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getSalesTaxesChargesTemplate(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getSalesTaxesChargesTemplate()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getCostCenters(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getCostCenters()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getProjects(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getProjects()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getPriceLists(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getPriceLists()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getContactPersons(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getContactPersons()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getSalesPartners(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getSalesPartners()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getCouponCodes(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getCouponCodes()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }

  static async getAccountHeads(req, res) {
    try {
      const { db } = req.app.locals
      const setupModel = new SetupModel(db)
      const data = await setupModel.getAccountHeads()
      res.json({ success: true, data })
    } catch (error) {
      res.status(500).json({ success: false, error: error.message })
    }
  }
}
