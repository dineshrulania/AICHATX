import { Router } from 'express';
import { sendInvite, acceptInvite, previewInvite } from '../controllers/invite.controller.js';
import * as authMiddleware from '../middleware/auth.middleware.js';

const router = Router();

// Send an invite email
router.post('/send', authMiddleware.authUser, sendInvite);

// Preview invite details (public — user may not be logged in yet)
router.get('/preview', previewInvite);

// Accept invite (public — token is the auth)
router.get('/accept', acceptInvite);

export default router;
