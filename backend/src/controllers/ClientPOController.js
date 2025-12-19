import { ClientPOModel } from '../models/ClientPOModel.js'
import { PDFService } from '../services/PDFService.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class ClientPOController {
  // Single Form Creation
  static async createFull(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const data = req.body

      // Generate PO ID if not provided
      if (!data.po_id || data.po_id === 'new') {
        data.po_id = `PO-${Date.now()}`
      }

      // Handle file uploads (Base64)
      if (data.drawings && Array.isArray(data.drawings)) {
          for (const drawing of data.drawings) {
              if (drawing.file_base64 && drawing.file_name) {
                  const uploadDir = path.join(__dirname, '../../uploads/client-po', data.po_id)
                  
                  if (!fs.existsSync(uploadDir)){
                      fs.mkdirSync(uploadDir, { recursive: true })
                  }

                  const filePath = path.join(uploadDir, drawing.file_name)
                  // Remove header "data:application/pdf;base64,"
                  const base64Data = drawing.file_base64.replace(/^data:([A-Za-z-+\/]+);base64,/, "")
                  
                  fs.writeFileSync(filePath, base64Data, 'base64')
                  
                  // Set file_path relative to uploads
                  drawing.file_path = `/uploads/client-po/${data.po_id}/${drawing.file_name}`
                  
                  // Remove base64 to save memory/db space
                  delete drawing.file_base64
              }
          }
      }

      const result = await clientPOModel.createFull(data)

      res.status(201).json({
        success: true,
        message: 'Client PO created successfully',
        data: result
      })
    } catch (error) {
      console.error('Error creating client PO:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Step 1: Save Client Information
  static async saveClientInfo(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)

      const result = await clientPOModel.saveClientInfo(req.body)

      res.status(201).json({
        success: true,
        message: 'Client information saved',
        data: result
      })
    } catch (error) {
      console.error('Error saving client info:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Step 2: Save Project Information
  static async saveProjectInfo(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const result = await clientPOModel.saveProjectInfo({
        po_id,
        ...req.body
      })

      res.status(200).json({
        success: true,
        message: 'Project information saved',
        data: result
      })
    } catch (error) {
      console.error('Error saving project info:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Step 3: Save Drawings
  static async saveDrawings(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params
      const { drawings } = req.body

      if (!Array.isArray(drawings) || drawings.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Drawings array is required and must not be empty'
        })
      }

      const result = await clientPOModel.saveDrawings(po_id, drawings)

      res.status(200).json({
        success: true,
        message: 'Drawings saved successfully',
        data: result
      })
    } catch (error) {
      console.error('Error saving drawings:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Step 4: Save Commercial Details
  static async saveCommercials(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const result = await clientPOModel.saveCommercials(po_id, req.body)

      res.status(200).json({
        success: true,
        message: 'Commercial details saved',
        data: result
      })
    } catch (error) {
      console.error('Error saving commercial details:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Step 5: Save Terms & Attachments
  static async saveTermsAndAttachments(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const result = await clientPOModel.saveTermsAndAttachments(po_id, req.body)

      res.status(200).json({
        success: true,
        message: 'Terms and attachments saved',
        data: result
      })
    } catch (error) {
      console.error('Error saving terms and attachments:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Step 6: Submit for Approval
  static async submitForApproval(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const result = await clientPOModel.submitForApproval(po_id)

      res.status(200).json({
        success: true,
        message: 'Client PO submitted for approval',
        data: result
      })
    } catch (error) {
      console.error('Error submitting for approval:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Accept PO
  static async acceptPO(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const result = await clientPOModel.acceptPO(po_id)

      res.status(200).json({
        success: true,
        message: 'Client PO accepted and Sales Order created',
        data: result
      })
    } catch (error) {
      console.error('Error accepting PO:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Get PO for Review
  static async getPOForReview(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const data = await clientPOModel.getPOForReview(po_id)

      res.status(200).json({
        success: true,
        data: data
      })
    } catch (error) {
      console.error('Error fetching PO for review:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Render PO Template (for preview in iframe)
  static async renderPOTemplate(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const poData = await clientPOModel.getPOForReview(po_id)

      if (!poData || !poData.po) {
        return res.status(404).send('Client PO not found')
      }

      const html = await PDFService.generatePOHTML(poData)
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(html)
    } catch (error) {
      console.error('Error rendering PO template:', error)
      res.status(500).send(`Error: ${error.message}`)
    }
  }

  // Get Step Status
  static async getStepStatus(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const status = await clientPOModel.getStepStatus(po_id)

      res.status(200).json({
        success: true,
        data: status
      })
    } catch (error) {
      console.error('Error fetching step status:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Get PO by ID
  static async getById(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const data = await clientPOModel.getById(po_id)

      res.status(200).json({
        success: true,
        data: data
      })
    } catch (error) {
      console.error('Error fetching PO:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Get All POs with filters
  static async getAll(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { client_id, status, search } = req.query

      const filters = {}
      if (client_id) filters.client_id = client_id
      if (status) filters.status = status
      if (search) filters.search = search

      const pos = await clientPOModel.getAll(filters)

      res.status(200).json({
        success: true,
        data: pos
      })
    } catch (error) {
      console.error('Error fetching client POs:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Delete PO
  static async delete(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const result = await clientPOModel.delete(po_id)

      res.status(200).json({
        success: true,
        message: 'Client PO deleted',
        data: result
      })
    } catch (error) {
      console.error('Error deleting PO:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Download PO as PDF
  static async downloadPDF(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const poData = await clientPOModel.getPOForReview(po_id)

      if (!poData || !poData.po) {
        return res.status(404).json({
          success: false,
          error: 'Client PO not found'
        })
      }

      const pdf = await PDFService.generatePOPDF(poData)

      res.contentType('application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="PO-${poData.po.po_number}.pdf"`)
      res.send(pdf)
    } catch (error) {
      console.error('Error generating PDF:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  // Download PO as Excel
  static async downloadExcel(req, res) {
    try {
      const { db } = req.app.locals
      const clientPOModel = new ClientPOModel(db)
      const { po_id } = req.params

      const poData = await clientPOModel.getPOForReview(po_id)

      if (!poData || !poData.po) {
        return res.status(404).json({
          success: false,
          error: 'Client PO not found'
        })
      }

      const excel = await PDFService.generatePOExcel(poData)

      res.contentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="PO-${poData.po.po_number}.xlsx"`)
      res.send(excel)
    } catch (error) {
      console.error('Error generating Excel:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }

  static async importFromExcel(req, res) {
    try {
      const { db } = req.app.locals
      const { data } = req.body

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No data provided for import'
        })
      }

      const clientPOModel = new ClientPOModel(db)
      let imported = 0
      const errors = []

      for (const row of data) {
        try {
          const poData = {
            client_id: row.client_id,
            po_number: row.po_number,
            po_date: row.po_date,
            total_amount: parseFloat(row.total_amount) || 0,
            po_status: row.po_status || 'draft',
            description: row.description || ''
          }

          await clientPOModel.create(poData)
          imported++
        } catch (err) {
          errors.push({
            row: row.po_number,
            error: err.message
          })
        }
      }

      res.status(200).json({
        success: true,
        message: `Import completed: ${imported}/${data.length} records imported`,
        imported,
        total: data.length,
        errors: errors.length > 0 ? errors : undefined
      })
    } catch (error) {
      console.error('Error importing Excel:', error)
      res.status(500).json({
        success: false,
        error: error.message
      })
    }
  }
}
