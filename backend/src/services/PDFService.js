import puppeteer from 'puppeteer'
import ejs from 'ejs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class PDFService {
  static async generatePOPDF(poData) {
    let browser = null
    try {
      const html = await this.generatePOHTML(poData)
      
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      })

      const page = await browser.createPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      
      const pdf = await page.pdf({
        format: 'A4',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        },
        printBackground: true
      })

      return pdf
    } catch (error) {
      throw new Error(`PDF generation failed: ${error.message}`)
    } finally {
      if (browser) {
        await browser.close()
      }
    }
  }

  static async generatePOHTML(poData) {
    try {
      const templatePath = path.join(__dirname, '../templates/po-template.ejs')
      const html = await ejs.renderFile(templatePath, { data: poData })
      return html
    } catch (error) {
      throw new Error(`HTML generation failed: ${error.message}`)
    }
  }

  static async generatePOExcel(poData) {
    try {
      const ExcelJS = (await import('exceljs')).default
      const workbook = new ExcelJS.Workbook()

      // Sheet 1: PO Details
      const detailsSheet = workbook.addWorksheet('PO Details')
      detailsSheet.columns = [
        { header: 'Field', key: 'field', width: 30 },
        { header: 'Value', key: 'value', width: 50 }
      ]

      detailsSheet.addRow({ field: 'PO Number', value: poData.po.po_number })
      detailsSheet.addRow({ field: 'Client Name', value: poData.po.client_name })
      detailsSheet.addRow({ field: 'PO Date', value: poData.po.po_date })
      detailsSheet.addRow({ field: 'Contact Person', value: poData.po.contact_person || '-' })
      detailsSheet.addRow({ field: 'Email', value: poData.po.email_reference || '-' })
      detailsSheet.addRow({ field: 'Status', value: poData.po.po_status })

      if (poData.project) {
        detailsSheet.addRow({})
        detailsSheet.addRow({ field: 'Project Name', value: poData.project.project_name })
        detailsSheet.addRow({ field: 'Project Code', value: poData.project.project_code || '-' })
        detailsSheet.addRow({ field: 'Project Type', value: poData.project.project_type || '-' })
        detailsSheet.addRow({ field: 'Sales Engineer', value: poData.project.sales_engineer || '-' })
      }

      // Sheet 2: Drawings
      if (poData.drawings && poData.drawings.length > 0) {
        const drawingsSheet = workbook.addWorksheet('Drawings')
        drawingsSheet.columns = [
          { header: 'Drawing No', key: 'drawing_no', width: 15 },
          { header: 'Revision', key: 'revision', width: 10 },
          { header: 'Description', key: 'description', width: 30 },
          { header: 'Qty', key: 'quantity', width: 10 },
          { header: 'Unit', key: 'unit', width: 10 },
          { header: 'Delivery Date', key: 'delivery_date', width: 15 }
        ]

        poData.drawings.forEach(drawing => {
          drawingsSheet.addRow({
            drawing_no: drawing.drawing_no,
            revision: drawing.revision || '',
            description: drawing.description || '',
            quantity: drawing.quantity,
            unit: drawing.unit,
            delivery_date: drawing.delivery_date || ''
          })
        })
      }

      // Sheet 3: Commercials
      if (poData.commercials) {
        const commSheet = workbook.addWorksheet('Commercials')
        commSheet.columns = [
          { header: 'Description', key: 'description', width: 30 },
          { header: 'Amount', key: 'amount', width: 20 }
        ]

        const subtotal = poData.commercials.subtotal || 0
        const taxAmount = (subtotal * (poData.commercials.tax_rate || 0)) / 100
        const total = subtotal + taxAmount + (poData.commercials.freight_charges || 0)

        commSheet.addRow({ description: 'Subtotal', amount: subtotal })
        commSheet.addRow({
          description: `Tax (${poData.commercials.tax_rate}%)`,
          amount: taxAmount
        })
        commSheet.addRow({
          description: 'Freight Charges',
          amount: poData.commercials.freight_charges || 0
        })
        commSheet.addRow({ description: 'Total Value', amount: total })
        commSheet.addRow({ description: 'Currency', amount: poData.commercials.currency })
      }

      // Sheet 4: Terms
      if (poData.terms) {
        const termsSheet = workbook.addWorksheet('Terms')
        termsSheet.columns = [
          { header: 'Description', key: 'description', width: 50 }
        ]

        if (poData.terms.payment_terms_description) {
          termsSheet.addRow({ description: `Payment Terms: ${poData.terms.payment_terms_description}` })
        }
        if (poData.terms.delivery_schedule) {
          termsSheet.addRow({ description: `Delivery Schedule: ${poData.terms.delivery_schedule}` })
        }
        if (poData.terms.packing_instructions) {
          termsSheet.addRow({ description: `Packing Instructions: ${poData.terms.packing_instructions}` })
        }
        if (poData.terms.special_remarks) {
          termsSheet.addRow({ description: `Special Remarks: ${poData.terms.special_remarks}` })
        }
      }

      const buffer = await workbook.xlsx.writeBuffer()
      return buffer
    } catch (error) {
      throw new Error(`Excel generation failed: ${error.message}`)
    }
  }
}
