import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/AuthContext'
import { Lock, Mail, User, Eye, EyeOff, Building2, CheckCircle, AlertCircle } from 'lucide-react'
import '../styles/LoginPage.css'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('test@example.com')
  const [password, setPassword] = useState('password123')
  const [fullName, setFullName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [department, setDepartment] = useState('buying')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const departments = [
    { value: 'buying', label: 'Buying/Procurement', color: '#4F46E5' },
    { value: 'selling', label: 'Selling/Sales', color: '#7C3AED' },
    { value: 'inventory', label: 'Inventory/Stock', color: '#059669' },
    { value: 'production', label: 'Production/Manufacturing', color: '#F59E0B' },
    { value: 'toolroom', label: 'Tool Room/Maintenance', color: '#8B5CF6' },
    { value: 'quality', label: 'Quality Control/QC', color: '#06B6D4' },
    { value: 'dispatch', label: 'Dispatch/Logistics', color: '#EC4899' },
    { value: 'accounts', label: 'Accounts/Finance', color: '#14B8A6' },
    { value: 'hr', label: 'HR/Payroll', color: '#3B82F6' },
    { value: 'admin', label: 'Administration', color: '#DC2626' }
  ]
  
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (isLogin) {
        // Login
        if (!email || !password) {
          throw new Error('Please enter email and password')
        }
        await login(email, password)
        setSuccess('Login successful! Redirecting...')
        setTimeout(() => {
          const from = location.state?.from?.pathname || '/dashboard'
          navigate(from)
        }, 1000)
      } else {
        // Register
        if (!email || !fullName || !password || !confirmPassword || !department) {
          throw new Error('Please fill all fields')
        }
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match')
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters')
        }
        await register(email, fullName, password, confirmPassword, department)
        setSuccess('Registration successful! Redirecting...')
        setTimeout(() => {
          navigate('/dashboard')
        }, 1000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-wrapper">
        <div className="login-box">
          <div className="login-header">
            <div className="login-header-icon">
              <Building2 size={40} />
            </div>
            <h1>Aluminium ERP</h1>
            <p>Buying Module - Procurement Management System</p>
          </div>

          <div className="login-tabs">
            <button
              className={`tab ${isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(true)
                setError('')
                setSuccess('')
              }}
            >
              Login
            </button>
            <button
              className={`tab ${!isLogin ? 'active' : ''}`}
              onClick={() => {
                setIsLogin(false)
                setError('')
                setSuccess('')
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="alert alert-error"><AlertCircle size={18} style={{display: 'inline-block', marginRight: '8px'}} />{error}</div>}
            {success && <div className="alert alert-success"><CheckCircle size={18} style={{display: 'inline-block', marginRight: '8px'}} />{success}</div>}

            {!isLogin && (
              <div className="form-group">
                <label><User size={16} style={{display: 'inline', marginRight: '6px'}} />Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  disabled={loading}
                />
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label><Building2 size={16} style={{display: 'inline', marginRight: '6px'}} />Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s'
                  }}
                >
                  {departments.map(dept => (
                    <option key={dept.value} value={dept.value}>{dept.label}</option>
                  ))}
                </select>
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {departments.map(dept => (
                    <div
                      key={dept.value}
                      onClick={() => !loading && setDepartment(dept.value)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        border: department === dept.value ? '2px solid ' + dept.color : '1px solid #e5e7eb',
                        backgroundColor: department === dept.value ? dept.color + '10' : '#f9fafb',
                        color: department === dept.value ? dept.color : '#666',
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {dept.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label><Mail size={16} style={{display: 'inline', marginRight: '6px'}} />Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label><Lock size={16} style={{display: 'inline', marginRight: '6px'}} />Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label><Lock size={16} style={{display: 'inline', marginRight: '6px'}} />Confirm Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn-submit"
              disabled={loading}
            >
              {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
            </button>
          </form>

          <div className="login-footer">
            <p><Lock size={16} style={{display: 'inline', marginRight: '6px'}} />Your data is secure and encrypted</p>
            {isLogin && (
              <div className="demo-credentials">
                <strong>Demo Credentials (Any Department):</strong><br/>
                Email: test@example.com<br/>
                Password: password123<br/>
                <br/>
                <strong>Or Register New:</strong><br/>
                1. Enter your name & email<br/>
                2. Select any department<br/>
                3. Password: password123<br/>
                <br/>
                <small>🎯 Available Departments: Buying, Selling, Inventory, Production, Tool Room, Quality, Dispatch, Accounts, HR, Admin</small>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}