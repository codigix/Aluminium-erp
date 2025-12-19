import { v4 as uuidv4 } from 'uuid'

export class ClientPOModel {
  constructor(db) {
    this.db = db
  }

  // Single Form Creation (Full Save)
  async createFull(data) {
    const connection = await this.db.getConnection()
    try {
      await connection.beginTransaction()

      const po_id = data.po_id || `PO-${Date.now()}`
      
      // Auto-generate PO Number if empty: CPO-YYYY-XXXX
      let po_number = data.po_number
      if (!po_number) {
        const year = new Date().getFullYear()
        const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM client_pos WHERE YEAR(created_at) = ?', [year])
        const count = countResult[0].count + 1
        po_number = `CPO-${year}-${String(count).padStart(4, '0')}`
      }

      // Auto-generate Project Reference: CLIENTCODE-YEAR-RUNNING_NO
      let project_reference = data.project_reference
      if (!project_reference && data.client_id) {
         const [clientResult] = await connection.execute('SELECT name FROM selling_customer WHERE customer_id = ?', [data.client_id])
         if (clientResult.length > 0) {
             const clientName = clientResult[0].name
             const clientCode = clientName.substring(0, 3).toUpperCase()
             const year = new Date().getFullYear()
             const [projCount] = await connection.execute('SELECT COUNT(*) as count FROM client_pos WHERE client_id = ? AND YEAR(created_at) = ?', [data.client_id, year])
             const count = projCount[0].count + 1
             project_reference = `${clientCode}-${year}-${String(count).padStart(3, '0')}`
         }
      }

      // Insert/Update Client PO
      const [existing] = await connection.execute('SELECT po_id FROM client_pos WHERE po_id = ?', [po_id])
      
      if (existing.length > 0) {
        await connection.execute(
          `UPDATE client_pos 
           SET client_id = ?, po_number = ?, po_date = ?, contact_person = ?, 
               email_reference = ?, updated_at = NOW()
           WHERE po_id = ?`,
          [
            data.client_id,
            po_number,
            data.po_date,
            data.contact_person,
            data.email_reference,
            po_id
          ]
        )
      } else {
        await connection.execute(
          `INSERT INTO client_pos 
           (po_id, client_id, po_number, po_date, contact_person, email_reference, po_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            po_id,
            data.client_id,
            po_number,
            data.po_date,
            data.contact_person,
            data.email_reference,
            'draft'
          ]
        )
      }

      // Insert/Update Project Info
      const [existingProject] = await connection.execute('SELECT project_id FROM client_po_projects WHERE po_id = ?', [po_id])
      
      if (existingProject.length > 0) {
          await connection.execute(
              `UPDATE client_po_projects 
               SET project_name = ?, project_requirement = ?, project_code = ?
               WHERE po_id = ?`,
              [
                  data.project_name,
                  data.project_requirement,
                  project_reference,
                  po_id
              ]
          )
      } else {
          const projectId = `PROJ-${Date.now()}`
          await connection.execute(
              `INSERT INTO client_po_projects 
               (project_id, po_id, project_name, project_requirement, project_code)
               VALUES (?, ?, ?, ?, ?)`,
              [
                  projectId,
                  po_id,
                  data.project_name,
                  data.project_requirement,
                  project_reference
              ]
          )
      }

      // Handle Drawings
      if (data.drawings && Array.isArray(data.drawings)) {
          // Get existing drawing IDs
          const [existingDrawings] = await connection.execute('SELECT drawing_id FROM client_po_drawings WHERE po_id = ?', [po_id])
          const existingIds = existingDrawings.map(d => d.drawing_id)
          const incomingIds = data.drawings.filter(d => d.id).map(d => d.id)
          
          // Delete removed
          const toDelete = existingIds.filter(id => !incomingIds.includes(id))
          if (toDelete.length > 0) {
              // Wrap IDs in quotes since they are strings (VARCHAR)
              const idsToDelete = toDelete.map(id => `'${id}'`).join(',')
              await connection.execute(`DELETE FROM client_po_drawings WHERE drawing_id IN (${idsToDelete})`)
          }

          for (const drawing of data.drawings) {
              if (drawing.id) {
                  await connection.execute(
                      `UPDATE client_po_drawings 
                       SET drawing_no = ?, revision = ?, description = ?, file_path = ?, delivery_date = ?, quantity = ?, unit = ?, unit_rate = ?, line_value = ?
                       WHERE drawing_id = ?`,
                      [
                        drawing.drawing_no, 
                        drawing.revision, 
                        drawing.description, 
                        drawing.file_path || null, 
                        drawing.delivery_date || null, 
                        parseFloat(drawing.quantity) || 1, 
                        drawing.unit || 'NOS', 
                        parseFloat(drawing.unit_rate) || 0,
                        parseFloat(drawing.line_value) || 0,
                        drawing.id
                      ]
                  )
              } else {
                  const newDrawingId = `DRW-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                  await connection.execute(
                      `INSERT INTO client_po_drawings 
                       (drawing_id, po_id, drawing_no, revision, description, file_path, delivery_date, quantity, unit, unit_rate, line_value)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                      [
                        newDrawingId, 
                        po_id, 
                        drawing.drawing_no, 
                        drawing.revision, 
                        drawing.description, 
                        drawing.file_path || null, 
                        drawing.delivery_date || null, 
                        parseFloat(drawing.quantity) || 1, 
                        drawing.unit || 'NOS',
                        parseFloat(drawing.unit_rate) || 0,
                        parseFloat(drawing.line_value) || 0
                      ]
                  )
              }
          }
      }

      // Calculate and Update Commercials Total
      if (data.drawings && Array.isArray(data.drawings)) {
          const totalValue = data.drawings.reduce((sum, d) => sum + (parseFloat(d.line_value) || 0), 0)
          
          // Check if commercials exist
          const [existingComm] = await connection.execute('SELECT commercial_id FROM client_po_commercials WHERE po_id = ?', [po_id])
          
          if (existingComm.length > 0) {
              await connection.execute(
                  `UPDATE client_po_commercials SET total_value = ?, subtotal = ? WHERE po_id = ?`,
                  [totalValue, totalValue, po_id]
              )
          } else {
              const commId = `COM-${Date.now()}`
              await connection.execute(
                  `INSERT INTO client_po_commercials 
                   (commercial_id, po_id, total_value, subtotal, rate, currency, tax_rate, freight_charges) 
                   VALUES (?, ?, ?, ?, 0, 'INR', 0, 0)`,
                  [commId, po_id, totalValue, totalValue]
              )
          }
      }

      await connection.commit()
      return { po_id, po_number, project_reference }
    } catch (error) {
      await connection.rollback()
      throw new Error(`Failed to save client PO: ${error.message}`)
    } finally {
      connection.release()
    }
  }

  // Step 1: Save Client Information
  async saveClientInfo(data) {
    try {
      const po_id = data.po_id || `PO-${Date.now()}`
      const po_number = data.po_number || `PO-${Date.now()}`

      const [existing] = await this.db.execute(
        'SELECT po_id FROM client_pos WHERE po_id = ?',
        [po_id]
      )

      if (existing.length > 0) {
        await this.db.execute(
          `UPDATE client_pos 
           SET client_id = ?, po_number = ?, po_date = ?, contact_person = ?, 
               email_reference = ?, updated_at = NOW()
           WHERE po_id = ?`,
          [
            data.client_id,
            po_number,
            data.po_date || new Date().toISOString().split('T')[0],
            data.contact_person || null,
            data.email_reference || null,
            po_id
          ]
        )
      } else {
        await this.db.execute(
          `INSERT INTO client_pos 
           (po_id, client_id, po_number, po_date, contact_person, email_reference, po_status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            po_id,
            data.client_id,
            po_number,
            data.po_date || new Date().toISOString().split('T')[0],
            data.contact_person || null,
            data.email_reference || null,
            'draft'
          ]
        )
      }

      // Initialize step status
      await this.initializeStepStatus(po_id)
      await this.updateStepStatus(po_id, 'client_info_completed', true)

      return { po_id, po_number }
    } catch (error) {
      throw new Error(`Failed to save client info: ${error.message}`)
    }
  }

  // Step 2: Save Project Information
  async saveProjectInfo(data) {
    try {
      const project_id = data.project_id || `PROJ-${Date.now()}`

      const [existing] = await this.db.execute(
        'SELECT project_id FROM client_po_projects WHERE project_id = ?',
        [project_id]
      )

      if (existing.length > 0) {
        await this.db.execute(
          `UPDATE client_po_projects 
           SET project_name = ?, project_code = ?, project_type = ?, sales_engineer = ?,
               delivery_start_date = ?, delivery_end_date = ?, updated_at = NOW()
           WHERE project_id = ?`,
          [
            data.project_name,
            data.project_code || null,
            data.project_type || null,
            data.sales_engineer || null,
            data.delivery_start_date || null,
            data.delivery_end_date || null,
            project_id
          ]
        )
      } else {
        await this.db.execute(
          `INSERT INTO client_po_projects 
           (project_id, po_id, project_name, project_code, project_type, sales_engineer, 
            delivery_start_date, delivery_end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            project_id,
            data.po_id,
            data.project_name,
            data.project_code || null,
            data.project_type || null,
            data.sales_engineer || null,
            data.delivery_start_date || null,
            data.delivery_end_date || null
          ]
        )
      }

      await this.updateStepStatus(data.po_id, 'project_info_completed', true)

      return { project_id }
    } catch (error) {
      throw new Error(`Failed to save project info: ${error.message}`)
    }
  }

  // Step 3: Save Drawings
  async saveDrawings(po_id, drawings) {
    try {
      for (const drawing of drawings) {
        const drawing_id = drawing.drawing_id || `DRW-${Date.now()}-${Math.random()}`

        const [existing] = await this.db.execute(
          'SELECT drawing_id FROM client_po_drawings WHERE po_id = ? AND drawing_no = ?',
          [po_id, drawing.drawing_no]
        )

        if (existing.length > 0) {
          await this.db.execute(
            `UPDATE client_po_drawings 
             SET revision = ?, description = ?, quantity = ?, unit = ?, delivery_date = ?, unit_rate = ?, line_value = ?
             WHERE drawing_id = ?`,
            [
              drawing.revision || null,
              drawing.description || null,
              parseFloat(drawing.quantity) || 1,
              drawing.unit || 'NOS',
              drawing.delivery_date || null,
              parseFloat(drawing.unit_rate) || 0,
              parseFloat(drawing.line_value) || 0,
              existing[0].drawing_id
            ]
          )
        } else {
          await this.db.execute(
            `INSERT INTO client_po_drawings 
             (drawing_id, po_id, drawing_no, revision, description, quantity, unit, delivery_date, unit_rate, line_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              drawing_id,
              po_id,
              drawing.drawing_no,
              drawing.revision || null,
              drawing.description || null,
              parseFloat(drawing.quantity) || 1,
              drawing.unit || 'NOS',
              drawing.delivery_date || null,
              parseFloat(drawing.unit_rate) || 0,
              parseFloat(drawing.line_value) || 0
            ]
          )
        }
      }

      await this.updateStepStatus(po_id, 'drawings_completed', true)
      return { count: drawings.length }
    } catch (error) {
      throw new Error(`Failed to save drawings: ${error.message}`)
    }
  }

  // Step 4: Save Commercial Details
  async saveCommercials(po_id, data) {
    try {
      const commercial_id = data.commercial_id || `COM-${Date.now()}`

      const subtotal = parseFloat(data.subtotal) || 0
      const tax = parseFloat(data.tax_rate) || 0
      const freight = parseFloat(data.freight_charges) || 0
      const tax_amount = (subtotal * tax) / 100
      const total_value = subtotal + tax_amount + freight

      const [existing] = await this.db.execute(
        'SELECT commercial_id FROM client_po_commercials WHERE po_id = ?',
        [po_id]
      )

      if (existing.length > 0) {
        await this.db.execute(
          `UPDATE client_po_commercials 
           SET rate = ?, currency = ?, payment_terms = ?, tax_rate = ?, 
               freight_charges = ?, subtotal = ?, total_value = ?
           WHERE po_id = ?`,
          [
            parseFloat(data.rate) || 0,
            data.currency || 'INR',
            data.payment_terms || null,
            tax,
            freight,
            subtotal,
            total_value,
            po_id
          ]
        )
      } else {
        await this.db.execute(
          `INSERT INTO client_po_commercials 
           (commercial_id, po_id, rate, currency, payment_terms, tax_rate, 
            freight_charges, subtotal, total_value)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            commercial_id,
            po_id,
            parseFloat(data.rate) || 0,
            data.currency || 'INR',
            data.payment_terms || null,
            tax,
            freight,
            subtotal,
            total_value
          ]
        )
      }

      await this.updateStepStatus(po_id, 'commercials_completed', true)
      return { commercial_id }
    } catch (error) {
      throw new Error(`Failed to save commercials: ${error.message}`)
    }
  }

  // Step 5: Save Terms & Attachments
  async saveTermsAndAttachments(po_id, data) {
    try {
      const term_id = data.term_id || `TERM-${Date.now()}`

      const [existing] = await this.db.execute(
        'SELECT term_id FROM client_po_terms WHERE po_id = ?',
        [po_id]
      )

      if (existing.length > 0) {
        await this.db.execute(
          `UPDATE client_po_terms 
           SET payment_terms_description = ?, delivery_schedule = ?, packing_instructions = ?,
               special_remarks = ?, quality_standards = ?, warranty_terms = ?
           WHERE po_id = ?`,
          [
            data.payment_terms_description || null,
            data.delivery_schedule || null,
            data.packing_instructions || null,
            data.special_remarks || null,
            data.quality_standards || null,
            data.warranty_terms || null,
            po_id
          ]
        )
      } else {
        await this.db.execute(
          `INSERT INTO client_po_terms 
           (term_id, po_id, payment_terms_description, delivery_schedule, 
            packing_instructions, special_remarks, quality_standards, warranty_terms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            term_id,
            po_id,
            data.payment_terms_description || null,
            data.delivery_schedule || null,
            data.packing_instructions || null,
            data.special_remarks || null,
            data.quality_standards || null,
            data.warranty_terms || null
          ]
        )
      }

      if (data.attachments && Array.isArray(data.attachments)) {
        for (const file of data.attachments) {
          const file_id = `FILE-${Date.now()}-${Math.random()}`
          await this.db.execute(
            `INSERT INTO client_po_files 
             (file_id, po_id, file_name, file_type, file_path, file_size, file_category)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              file_id,
              po_id,
              file.file_name,
              file.file_type || null,
              file.file_path,
              file.file_size || null,
              file.file_category || 'po_document'
            ]
          )
        }
      }

      await this.updateStepStatus(po_id, 'attachments_completed', true)
      return { term_id }
    } catch (error) {
      throw new Error(`Failed to save terms and attachments: ${error.message}`)
    }
  }

  // Accept PO and Create Sales Order
  async acceptPO(po_id) {
    const connection = await this.db.getConnection()
    try {
      await connection.beginTransaction()

      // 1. Get PO Details
      const [poResult] = await connection.execute(
        `SELECT p.*, c.total_value, proj.delivery_end_date 
         FROM client_pos p
         LEFT JOIN client_po_commercials c ON p.po_id = c.po_id
         LEFT JOIN client_po_projects proj ON p.po_id = proj.po_id
         WHERE p.po_id = ?`,
        [po_id]
      )

      if (poResult.length === 0) {
        throw new Error('Client PO not found')
      }

      const po = poResult[0]

      // 2. Update PO Status
      await connection.execute(
        'UPDATE client_pos SET po_status = ? WHERE po_id = ?',
        ['confirmed', po_id]
      )

      // 3. Create Sales Order
      const sales_order_id = `SO-${Date.now()}`
      const order_amount = po.total_value || 0
      const delivery_date = po.delivery_end_date || po.po_date

      await connection.execute(
        `INSERT INTO selling_sales_order 
         (sales_order_id, customer_id, order_amount, delivery_date, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          sales_order_id,
          po.client_id,
          order_amount,
          delivery_date,
          'draft' // Start as draft in Sales Order
        ]
      )

      await connection.commit()
      return { sales_order_id }
    } catch (error) {
      await connection.rollback()
      throw new Error(`Failed to accept PO: ${error.message}`)
    } finally {
      connection.release()
    }
  }

  // Step 6: Submit for Approval
  async submitForApproval(po_id) {
    try {
      await this.db.execute(
        `UPDATE client_pos 
         SET po_status = 'pending_approval', updated_at = NOW()
         WHERE po_id = ?`,
        [po_id]
      )

      await this.updateStepStatus(po_id, 'final_submitted', true)

      return { status: 'submitted' }
    } catch (error) {
      throw new Error(`Failed to submit for approval: ${error.message}`)
    }
  }

  // Get complete PO data for review
  async getPOForReview(po_id) {
    try {
      const [poData] = await this.db.execute(
        `SELECT cp.*, sc.name as client_name, sc.billing_address, sc.gstin, sc.email, sc.phone
         FROM client_pos cp
         LEFT JOIN selling_customer sc ON cp.client_id COLLATE utf8mb4_unicode_ci = sc.customer_id COLLATE utf8mb4_unicode_ci
         WHERE cp.po_id = ?`,
        [po_id]
      )

      if (!poData.length) {
        throw new Error('Client PO not found')
      }

      const po = poData[0]

      // Get project info
      const [projectData] = await this.db.execute(
        'SELECT * FROM client_po_projects WHERE po_id = ?',
        [po_id]
      )

      // Get drawings
      const [drawings] = await this.db.execute(
        'SELECT * FROM client_po_drawings WHERE po_id = ? ORDER BY drawing_no',
        [po_id]
      )

      // Get commercials
      const [commercials] = await this.db.execute(
        'SELECT * FROM client_po_commercials WHERE po_id = ?',
        [po_id]
      )

      // Get terms
      const [terms] = await this.db.execute(
        'SELECT * FROM client_po_terms WHERE po_id = ?',
        [po_id]
      )

      // Get files
      const [files] = await this.db.execute(
        'SELECT * FROM client_po_files WHERE po_id = ?',
        [po_id]
      )

      // Get step status
      const [stepStatus] = await this.db.execute(
        'SELECT * FROM client_po_step_status WHERE po_id = ?',
        [po_id]
      )

      return {
        po: po,
        project: projectData[0] || null,
        drawings: drawings,
        commercials: commercials[0] || null,
        terms: terms[0] || null,
        files: files,
        stepStatus: stepStatus[0] || null
      }
    } catch (error) {
      throw new Error(`Failed to fetch PO for review: ${error.message}`)
    }
  }

  // Get step status
  async getStepStatus(po_id) {
    try {
      const [status] = await this.db.execute(
        'SELECT * FROM client_po_step_status WHERE po_id = ?',
        [po_id]
      )
      return status[0] || null
    } catch (error) {
      throw new Error(`Failed to fetch step status: ${error.message}`)
    }
  }

  // Initialize step status (called when PO is first created)
  async initializeStepStatus(po_id) {
    try {
      const status_id = `STATUS-${Date.now()}`
      const [existing] = await this.db.execute(
        'SELECT status_id FROM client_po_step_status WHERE po_id = ?',
        [po_id]
      )

      if (!existing.length) {
        await this.db.execute(
          `INSERT INTO client_po_step_status 
           (status_id, po_id, client_info_completed, project_info_completed, 
            drawings_completed, commercials_completed, attachments_completed, final_submitted)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [status_id, po_id, false, false, false, false, false, false]
        )
      }
    } catch (error) {
      console.error('Error initializing step status:', error)
    }
  }

  // Update step status
  async updateStepStatus(po_id, step, value) {
    try {
      const validSteps = [
        'client_info_completed',
        'project_info_completed',
        'drawings_completed',
        'commercials_completed',
        'attachments_completed',
        'final_submitted'
      ]

      if (!validSteps.includes(step)) {
        throw new Error(`Invalid step: ${step}`)
      }

      const query = `UPDATE client_po_step_status SET ${step} = ? WHERE po_id = ?`
      await this.db.execute(query, [value, po_id])
    } catch (error) {
      console.error(`Error updating step status: ${error.message}`)
    }
  }

  // Get PO by ID with all related data
  async getById(po_id) {
    return this.getPOForReview(po_id)
  }

  // Get all POs (with pagination)
  async getAll(filters = {}) {
    try {
      let query = `
        SELECT cp.*, sc.name as client_name, cps.client_info_completed, 
               cps.project_info_completed, cps.drawings_completed, 
               cps.commercials_completed, cps.attachments_completed, cps.final_submitted,
               comm.total_value
        FROM client_pos cp
        LEFT JOIN selling_customer sc ON cp.client_id COLLATE utf8mb4_unicode_ci = sc.customer_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN client_po_step_status cps ON cp.po_id COLLATE utf8mb4_unicode_ci = cps.po_id COLLATE utf8mb4_unicode_ci
        LEFT JOIN client_po_commercials comm ON cp.po_id COLLATE utf8mb4_unicode_ci = comm.po_id COLLATE utf8mb4_unicode_ci
        WHERE 1=1
      `
      const params = []

      if (filters.client_id) {
        query += ' AND cp.client_id = ?'
        params.push(filters.client_id)
      }

      if (filters.status) {
        query += ' AND cp.po_status = ?'
        params.push(filters.status)
      }

      if (filters.search) {
        query += ' AND (cp.po_number COLLATE utf8mb4_unicode_ci LIKE ? OR sc.name COLLATE utf8mb4_unicode_ci LIKE ?)'
        params.push(`%${filters.search}%`, `%${filters.search}%`)
      }

      query += ' ORDER BY cp.created_at DESC'

      const [pos] = await this.db.execute(query, params)
      return pos
    } catch (error) {
      throw new Error(`Failed to fetch client POs: ${error.message}`)
    }
  }

  // Create PO (for bulk import)
  async create(data) {
    try {
      const po_id = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      let po_number = data.po_number
      if (!po_number) {
        const timestamp = Date.now()
        const random = Math.floor(Math.random() * 10000)
        po_number = `PO-${timestamp}-${random}`
      }
      
      let client_id = data.client_id
      
      if (!client_id || !Number.isInteger(Number(client_id))) {
        const [customers] = await this.db.execute(
          'SELECT customer_id FROM selling_customer LIMIT 1'
        )
        if (customers.length > 0) {
          client_id = customers[0].customer_id
        } else {
          throw new Error('No customers found in system. Please create a customer first.')
        }
      }
      
      const [result] = await this.db.execute(
        `INSERT INTO client_pos 
         (po_id, client_id, po_number, po_date, contact_person, email_reference, po_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          po_id,
          client_id,
          po_number,
          data.po_date || new Date().toISOString().split('T')[0],
          data.contact_person || null,
          data.email_reference || null,
          data.po_status || 'draft'
        ]
      )
      
      if (result.affectedRows > 0) {
        await this.initializeStepStatus(po_id)
        return { po_id, po_number }
      }
      
      throw new Error('Failed to insert record')
    } catch (error) {
      throw new Error(`${error.message}`)
    }
  }

  // Delete PO
  async delete(po_id) {
    try {
      await this.db.execute('DELETE FROM client_pos WHERE po_id = ?', [po_id])
      return { deleted: true }
    } catch (error) {
      throw new Error(`Failed to delete client PO: ${error.message}`)
    }
  }
}
