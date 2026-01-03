import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
})

export const apiGet = async (url, config = {}) => {
  const response = await client.get(url, config)
  return response.data?.data ?? response.data ?? []
}
