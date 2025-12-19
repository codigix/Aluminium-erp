import express from 'express'
import { ClientController } from '../controllers/ClientController.js'

const router = express.Router()

router.post('/clients', ClientController.create)
router.get('/clients', ClientController.getAll)
router.get('/clients/:id', ClientController.getById)
router.put('/clients/:id', ClientController.update)
router.delete('/clients/:id', ClientController.delete)

export default router
