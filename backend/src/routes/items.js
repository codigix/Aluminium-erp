import express from 'express'
import * as controller from '../controllers/itemController.js'

const router = express.Router()

// More specific routes must come first
router.get('/groups', controller.getItemGroups)

// Stock information (specific route)
router.get('/:item_code/stock', controller.getItemStock)

// CRUD Operations (generic routes come last)
router.post('/', controller.createItem)
router.get('/', controller.listItems)
router.get('/:item_code', controller.getItem)
router.put('/:item_code', controller.updateItem)
router.delete('/:item_code', controller.deleteItem)

export default router