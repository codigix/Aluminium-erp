#!/usr/bin/env node

import fetch from 'node-fetch'

const API_URL = 'http://localhost:3000/api'

async function createDemoUser() {
  try {
    console.log('📝 Creating demo user via API...\n')
    
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        fullName: 'Demo User',
        password: 'password123',
        confirmPassword: 'password123',
        department: 'buying'
      })
    })
    
    const data = await response.json()
    
    if (!response.ok) {
      if (data.error?.includes('already registered')) {
        console.log('✓ Demo user already exists')
        console.log(`  Email: test@example.com`)
        console.log(`  Password: password123`)
      } else {
        throw new Error(data.error || 'Failed to create user')
      }
    } else {
      console.log('✓ Demo user created successfully')
      console.log(`  Email: test@example.com`)
      console.log(`  Password: password123`)
      console.log(`  Token: ${data.token.substring(0, 20)}...`)
    }
    
    process.exit(0)
  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

createDemoUser()
