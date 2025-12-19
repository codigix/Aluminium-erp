export class ClientController {
  static async create(req, res) {
    const db = req.app.locals.db
    const {
      client_name,
      email,
      phone,
      address,
      city,
      state,
      postal_code,
      country,
      contact_person,
      contact_person_phone,
      credit_limit,
      payment_terms_days,
      is_active
    } = req.body

    try {
      if (!client_name) {
        return res.status(400).json({ error: 'Client name is required' })
      }

      const client_id = `CUST-${Date.now()}`
      const status = is_active ? 'active' : 'inactive'

      await db.execute(
        `INSERT INTO selling_customer 
         (customer_id, name, email, phone, billing_address, shipping_address, 
          city, state, postal_code, country,
          contact_person, contact_person_phone, credit_limit, payment_terms_days, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          client_id,
          client_name,
          email || null,
          phone || null,
          address || null,
          address || null, // Use same address for shipping by default
          city || null,
          state || null,
          postal_code || null,
          country || null,
          contact_person || null,
          contact_person_phone || null,
          credit_limit || 0,
          payment_terms_days || 30,
          status
        ]
      )

      res.status(201).json({
        success: true,
        data: {
          client_id,
          ...req.body
        }
      })
    } catch (error) {
      console.error('Error creating client:', error)
      res.status(500).json({ error: 'Failed to create client', details: error.message })
    }
  }

  static async getAll(req, res) {
    const db = req.app.locals.db
    
    try {
      const [rows] = await db.execute(
        'SELECT * FROM selling_customer WHERE deleted_at IS NULL ORDER BY created_at DESC'
      )

      // Map DB fields to frontend fields
      const clients = rows.map(row => ({
        client_id: row.customer_id,
        client_name: row.name,
        email: row.email,
        phone: row.phone,
        address: row.billing_address,
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        country: row.country,
        contact_person: row.contact_person,
        contact_person_phone: row.contact_person_phone,
        credit_limit: row.credit_limit,
        payment_terms_days: row.payment_terms_days,
        is_active: row.status === 'active'
      }))

      res.json({ success: true, data: clients })
    } catch (error) {
      console.error('Error fetching clients:', error)
      res.status(500).json({ error: 'Failed to fetch clients', details: error.message })
    }
  }

  static async getById(req, res) {
    const db = req.app.locals.db
    const { id } = req.params

    try {
      const [rows] = await db.execute(
        'SELECT * FROM selling_customer WHERE customer_id = ? AND deleted_at IS NULL',
        [id]
      )

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' })
      }

      const row = rows[0]
      const client = {
        client_id: row.customer_id,
        client_name: row.name,
        email: row.email,
        phone: row.phone,
        address: row.billing_address,
        city: row.city,
        state: row.state,
        postal_code: row.postal_code,
        country: row.country,
        contact_person: row.contact_person,
        contact_person_phone: row.contact_person_phone,
        credit_limit: row.credit_limit,
        payment_terms_days: row.payment_terms_days,
        is_active: row.status === 'active'
      }

      res.json({ success: true, data: client })
    } catch (error) {
      console.error('Error fetching client:', error)
      res.status(500).json({ error: 'Failed to fetch client', details: error.message })
    }
  }

  static async update(req, res) {
    const db = req.app.locals.db
    const { id } = req.params
    const {
      client_name,
      email,
      phone,
      address,
      city,
      state,
      postal_code,
      country,
      contact_person,
      contact_person_phone,
      credit_limit,
      payment_terms_days,
      is_active
    } = req.body

    try {
      const [existing] = await db.execute(
        'SELECT customer_id FROM selling_customer WHERE customer_id = ? AND deleted_at IS NULL',
        [id]
      )

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Client not found' })
      }

      const status = is_active ? 'active' : 'inactive'

      await db.execute(
        `UPDATE selling_customer 
         SET name = ?, email = ?, phone = ?, billing_address = ?, shipping_address = ?,
             city = ?, state = ?, postal_code = ?, country = ?,
             contact_person = ?, contact_person_phone = ?, 
             credit_limit = ?, payment_terms_days = ?, status = ?,
             updated_at = NOW()
         WHERE customer_id = ?`,
        [
          client_name,
          email || null,
          phone || null,
          address || null,
          address || null, // Update shipping address too
          city || null,
          state || null,
          postal_code || null,
          country || null,
          contact_person || null,
          contact_person_phone || null,
          credit_limit || 0,
          payment_terms_days || 30,
          status,
          id
        ]
      )

      res.json({
        success: true,
        data: {
          client_id: id,
          ...req.body
        }
      })
    } catch (error) {
      console.error('Error updating client:', error)
      res.status(500).json({ error: 'Failed to update client', details: error.message })
    }
  }

  static async delete(req, res) {
    const db = req.app.locals.db
    const { id } = req.params

    try {
      const [existing] = await db.execute(
        'SELECT customer_id FROM selling_customer WHERE customer_id = ? AND deleted_at IS NULL',
        [id]
      )

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Client not found' })
      }

      await db.execute(
        'UPDATE selling_customer SET deleted_at = NOW() WHERE customer_id = ?',
        [id]
      )

      res.json({ success: true, message: 'Client deleted successfully' })
    } catch (error) {
      console.error('Error deleting client:', error)
      res.status(500).json({ error: 'Failed to delete client', details: error.message })
    }
  }
}
