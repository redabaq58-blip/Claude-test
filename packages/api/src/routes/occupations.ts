import { Router } from 'express'
import { ok, fail } from '../middleware/response.js'
import { OCCUPATIONS, getOccupation, getOccupationsByCategory } from '../data/occupations.js'

export const occupationsRouter = Router()

// GET /api/occupations — list all occupations
occupationsRouter.get('/', (_req, res) => {
  ok(res, OCCUPATIONS)
})

// GET /api/occupations/category/:category — occupations by category
occupationsRouter.get('/category/:category', (req, res) => {
  const occupations = getOccupationsByCategory(req.params.category)
  ok(res, occupations)
})

// GET /api/occupations/:id — get a single occupation
occupationsRouter.get('/:id', (req, res) => {
  const occupation = getOccupation(req.params.id)
  if (!occupation) return fail(res, 'Occupation not found', 404)
  ok(res, occupation)
})
