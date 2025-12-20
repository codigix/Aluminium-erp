export class SetupModel {
  constructor(db) {
    this.db = db
  }

  async ensureTablesExist() {
    try {
      const tables = [
        {
          name: 'setup_payment_terms',
          query: `CREATE TABLE IF NOT EXISTS setup_payment_terms (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            days INT DEFAULT 0,
            months INT DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_letter_heads',
          query: `CREATE TABLE IF NOT EXISTS setup_letter_heads (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            company_id INT,
            content LONGTEXT,
            logo_url VARCHAR(255),
            is_default BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_campaigns',
          query: `CREATE TABLE IF NOT EXISTS setup_campaigns (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            start_date DATE,
            end_date DATE,
            status VARCHAR(50),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_territories',
          query: `CREATE TABLE IF NOT EXISTS setup_territories (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            parent_territory_id INT,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_lead_sources',
          query: `CREATE TABLE IF NOT EXISTS setup_lead_sources (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            source_type VARCHAR(50),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_lost_reasons',
          query: `CREATE TABLE IF NOT EXISTS setup_lost_reasons (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_tax_categories',
          query: `CREATE TABLE IF NOT EXISTS setup_tax_categories (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            tax_rate DECIMAL(5,2) DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_shipping_rules',
          query: `CREATE TABLE IF NOT EXISTS setup_shipping_rules (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            from_weight DECIMAL(10,2),
            to_weight DECIMAL(10,2),
            shipping_cost DECIMAL(10,2),
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_incoterms',
          query: `CREATE TABLE IF NOT EXISTS setup_incoterms (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(50) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_sales_taxes_charges',
          query: `CREATE TABLE IF NOT EXISTS setup_sales_taxes_charges (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            tax_type VARCHAR(50),
            tax_rate DECIMAL(5,2),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_cost_centers',
          query: `CREATE TABLE IF NOT EXISTS setup_cost_centers (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            code VARCHAR(50),
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_projects',
          query: `CREATE TABLE IF NOT EXISTS setup_projects (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            code VARCHAR(50),
            description TEXT,
            status VARCHAR(50),
            start_date DATE,
            end_date DATE,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_price_lists',
          query: `CREATE TABLE IF NOT EXISTS setup_price_lists (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            price_list_type VARCHAR(50),
            currency VARCHAR(10),
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'crm_contact_persons',
          query: `CREATE TABLE IF NOT EXISTS crm_contact_persons (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            supplier_id INT,
            customer_id INT,
            email VARCHAR(100),
            phone VARCHAR(20),
            designation VARCHAR(100),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'crm_sales_partners',
          query: `CREATE TABLE IF NOT EXISTS crm_sales_partners (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            partner_type VARCHAR(50),
            commission_rate DECIMAL(5,2),
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'selling_coupon_codes',
          query: `CREATE TABLE IF NOT EXISTS selling_coupon_codes (
            id INT PRIMARY KEY AUTO_INCREMENT,
            code VARCHAR(50) UNIQUE NOT NULL,
            discount_percentage DECIMAL(5,2),
            discount_amount DECIMAL(10,2),
            min_order_value DECIMAL(10,2),
            max_uses INT,
            uses_count INT DEFAULT 0,
            valid_from DATE,
            valid_till DATE,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        },
        {
          name: 'setup_account_heads',
          query: `CREATE TABLE IF NOT EXISTS setup_account_heads (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            account_type VARCHAR(50),
            account_number VARCHAR(50),
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )`
        }
      ]

      for (const table of tables) {
        try {
          await this.db.execute(table.query)
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error(`Error creating table ${table.name}:`, error.message)
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring tables exist:', error.message)
    }
  }

  async getPaymentTerms() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_payment_terms WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultPaymentTerms()
    }
  }

  async getLetterHeads() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_letter_heads WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultLetterHeads()
    }
  }

  async getCampaigns() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_campaigns WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultCampaigns()
    }
  }

  async getTerritories() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_territories WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultTerritories()
    }
  }

  async getLeadSources() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_lead_sources WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultLeadSources()
    }
  }

  async getLostReasons() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_lost_reasons WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultLostReasons()
    }
  }

  async getTaxCategories() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_tax_categories WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultTaxCategories()
    }
  }

  async getShippingRules() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_shipping_rules WHERE is_active = true ORDER BY from_weight')
      return rows
    } catch (error) {
      return this.getDefaultShippingRules()
    }
  }

  async getIncoterms() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_incoterms WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultIncoterms()
    }
  }

  async getSalesTaxesChargesTemplate() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_sales_taxes_charges WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultSalesTaxesCharges()
    }
  }

  async getCostCenters() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_cost_centers WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultCostCenters()
    }
  }

  async getProjects() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_projects WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultProjects()
    }
  }

  async getPriceLists() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_price_lists WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultPriceLists()
    }
  }

  async getContactPersons() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM crm_contact_persons WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return []
    }
  }

  async getSalesPartners() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM crm_sales_partners WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultSalesPartners()
    }
  }

  async getCouponCodes() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM selling_coupon_codes WHERE is_active = true AND valid_till >= CURDATE() ORDER BY code')
      return rows
    } catch (error) {
      return []
    }
  }

  async getAccountHeads() {
    try {
      const [rows] = await this.db.execute('SELECT * FROM setup_account_heads WHERE is_active = true ORDER BY name')
      return rows
    } catch (error) {
      return this.getDefaultAccountHeads()
    }
  }

  async getUOMs() {
    try {
      // Try to fetch from database if table exists, otherwise return defaults
      const [rows] = await this.db.execute('SELECT DISTINCT uom FROM item WHERE uom IS NOT NULL ORDER BY uom')
      const dbUoms = rows.map(r => ({ name: r.uom }))
      
      // Merge with defaults
      const defaults = this.getDefaultUOMs()
      const allUoms = [...defaults]
      
      dbUoms.forEach(u => {
        if (!allUoms.some(d => d.name === u.name)) {
          allUoms.push(u)
        }
      })
      
      return allUoms
    } catch (error) {
      return this.getDefaultUOMs()
    }
  }

  getDefaultPaymentTerms() {
    return [
      { id: 1, name: 'Immediate (COD)', days: 0, months: 0 },
      { id: 2, name: '7 Days', days: 7, months: 0 },
      { id: 3, name: '14 Days', days: 14, months: 0 },
      { id: 4, name: '30 Days', days: 30, months: 0 },
      { id: 5, name: '60 Days', days: 60, months: 0 },
      { id: 6, name: '90 Days', days: 90, months: 0 },
      { id: 7, name: '1 Month', days: 0, months: 1 },
      { id: 8, name: '2 Months', days: 0, months: 2 },
      { id: 9, name: '3 Months', days: 0, months: 3 }
    ]
  }

  getDefaultLetterHeads() {
    return [
      { id: 1, name: 'Default Letter Head', company_id: 1, logo_url: null }
    ]
  }

  getDefaultCampaigns() {
    return [
      { id: 1, name: 'Summer Sale', description: 'Summer seasonal campaign' },
      { id: 2, name: 'New Year Offer', description: 'New Year promotional campaign' },
      { id: 3, name: 'Festival Sale', description: 'Festival season offers' }
    ]
  }

  getDefaultTerritories() {
    return [
      { id: 1, name: 'North', description: 'Northern Region' },
      { id: 2, name: 'South', description: 'Southern Region' },
      { id: 3, name: 'East', description: 'Eastern Region' },
      { id: 4, name: 'West', description: 'Western Region' },
      { id: 5, name: 'Central', description: 'Central Region' }
    ]
  }

  getDefaultLeadSources() {
    return [
      { id: 1, name: 'Website', source_type: 'Online' },
      { id: 2, name: 'Phone Call', source_type: 'Direct' },
      { id: 3, name: 'Email', source_type: 'Online' },
      { id: 4, name: 'Referral', source_type: 'Direct' },
      { id: 5, name: 'Trade Show', source_type: 'Event' },
      { id: 6, name: 'Social Media', source_type: 'Online' }
    ]
  }

  getDefaultLostReasons() {
    return [
      { id: 1, name: 'Price too high', description: 'Customer found better pricing' },
      { id: 2, name: 'Competitor won', description: 'Competitor secured the deal' },
      { id: 3, name: 'No response', description: 'Customer became non-responsive' },
      { id: 4, name: 'Quality concerns', description: 'Customer had quality concerns' },
      { id: 5, name: 'Timing issue', description: 'Not the right time for purchase' }
    ]
  }

  getDefaultTaxCategories() {
    return [
      { id: 1, name: 'GST 5%', tax_rate: 5 },
      { id: 2, name: 'GST 12%', tax_rate: 12 },
      { id: 3, name: 'GST 18%', tax_rate: 18 },
      { id: 4, name: 'GST 28%', tax_rate: 28 },
      { id: 5, name: 'Exempted', tax_rate: 0 }
    ]
  }

  getDefaultShippingRules() {
    return [
      { id: 1, from_weight: 0, to_weight: 5, shipping_cost: 50 },
      { id: 2, from_weight: 5, to_weight: 10, shipping_cost: 100 },
      { id: 3, from_weight: 10, to_weight: 25, shipping_cost: 200 },
      { id: 4, from_weight: 25, to_weight: 50, shipping_cost: 350 }
    ]
  }

  getDefaultIncoterms() {
    return [
      { id: 1, name: 'FOB', description: 'Free on Board' },
      { id: 2, name: 'CIF', description: 'Cost, Insurance and Freight' },
      { id: 3, name: 'CDD', description: 'Cash and Carry Delivery' },
      { id: 4, name: 'EXW', description: 'Ex Works' },
      { id: 5, name: 'DDP', description: 'Delivered Duty Paid' }
    ]
  }

  getDefaultSalesTaxesCharges() {
    return [
      { id: 1, name: 'CGST', tax_type: 'GST', tax_rate: 9 },
      { id: 2, name: 'SGST', tax_type: 'GST', tax_rate: 9 },
      { id: 3, name: 'IGST', tax_type: 'GST', tax_rate: 18 }
    ]
  }

  getDefaultCostCenters() {
    return [
      { id: 1, name: 'Operations', code: 'CC-001' },
      { id: 2, name: 'Sales', code: 'CC-002' },
      { id: 3, name: 'Administration', code: 'CC-003' },
      { id: 4, name: 'Finance', code: 'CC-004' }
    ]
  }

  getDefaultProjects() {
    return [
      { id: 1, name: 'Project Alpha', code: 'PRJ-001', status: 'Active' },
      { id: 2, name: 'Project Beta', code: 'PRJ-002', status: 'Active' }
    ]
  }

  getDefaultPriceLists() {
    return [
      { id: 1, name: 'Standard Price List', price_list_type: 'Selling', currency: 'INR' },
      { id: 2, name: 'Wholesale Price List', price_list_type: 'Selling', currency: 'INR' },
      { id: 3, name: 'Supplier Price List', price_list_type: 'Buying', currency: 'INR' }
    ]
  }

  getDefaultSalesPartners() {
    return [
      { id: 1, name: 'Partner A', partner_type: 'Distributor', commission_rate: 10 },
      { id: 2, name: 'Partner B', partner_type: 'Dealer', commission_rate: 15 }
    ]
  }

  getDefaultAccountHeads() {
    return [
      { id: 1, name: 'Cash', account_type: 'Asset' },
      { id: 2, name: 'Bank Account', account_type: 'Asset' },
      { id: 3, name: 'Accounts Receivable', account_type: 'Asset' },
      { id: 4, name: 'Accounts Payable', account_type: 'Liability' },
      { id: 5, name: 'Revenue', account_type: 'Income' },
      { id: 6, name: 'Expenses', account_type: 'Expense' }
    ]
  }

  getDefaultUOMs() {
    return [
      { name: 'Nos' },
      { name: 'Kg' },
      { name: 'Meter' },
      { name: 'Litre' },
      { name: 'Box' },
      { name: 'Bar' },
      { name: 'Set' }
    ]
  }
}
