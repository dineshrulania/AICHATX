import { Router } from 'express';
import { runCode, getRuntimes } from '../controllers/execute.controller.js';
import * as authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// Returns list of supported languages (for frontend dropdown)
router.get('/runtimes', authMiddleware.authUser, getRuntimes);

// Execute code
router.post('/run', authMiddleware.authUser, runCode);

export default router;
