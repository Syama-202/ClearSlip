import { simulateTax } from '../services/taxSimulator.js'
import { validate, simulateRequestSchema } from '../utils/validateInput.js'

export function handleSimulate(req, res, next) {
  try {
    const input = validate(simulateRequestSchema, req.body)
    return res.status(200).json({ success: true, data: simulateTax(input) })
  } catch (err) {
    next(err)
  }
}
