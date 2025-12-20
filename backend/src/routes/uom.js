import express from 'express'
import { SetupController } from '../controllers/SetupController.js'

const router = express.Router()

router.get('/', SetupController.getUOMs)

export default router