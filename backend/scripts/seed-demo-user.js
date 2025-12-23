#!/usr/bin/env node

import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aluminium_erp',
  port: process.env.DB_PORT || 3306
}

async function seedDemoUser() {
  let connection

  try {
    console.log('🔌 Connecting to database...')
    console.log(`   Host: ${dbConfig.host}`)
    console.log(`   User: ${dbConfig.user}`)
    console.log(`   Database: ${dbConfig.database}`)
    
    connection = await mysql.createConnection(dbConfig)
    console.log('✅ Connected successfully\n')

    const email = 'test@example.com'
    const password = 'password123'
    const hashedPassword = await bcrypt.hash(password, 10)

    const [existing] = await connection.execute(
      'SELECT user_id FROM users WHERE email = ?',
      [email]
    )

    if (existing.length > 0) {
      console.log('✓ Demo user already exists')
      console.log(`  Email: ${email}`)
      console.log(`  Password: ${password}`)
      await connection.end()
      process.exit(0)
    }

    await connection.execute(
      'INSERT INTO users (full_name, email, password, department, role, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      ['Demo User', email, hashedPassword, 'buying', 'admin', true]
    )

    console.log('✓ Demo user created successfully')
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}`)
    console.log(`  Department: buying`)
    console.log(`  Role: admin`)

    await connection.end()
    process.exit(0)
  } catch (error) {
    console.error('✗ Error seeding demo user:', error.message)
    if (connection) await connection.end()
    process.exit(1)
  }
}

seedDemoUser()
