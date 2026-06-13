import crypto from 'crypto';
import userModel from '../models/user.model.js';
import projectModel from '../models/project.model.js';
import Invite from '../models/invite.model.js';
import { sendInviteEmail } from '../services/email.service.js';

// POST /invites/send
// Body: { projectId, email }
export const sendInvite = async (req, res) => {
    try {
        const { projectId, email } = req.body;

        if (!projectId || !email) {
            return res.status(400).json({ error: 'projectId and email are required' });
        }

        // Resolve the inviter
        const inviter = await userModel.findOne({ email: req.user.email });
        if (!inviter) return res.status(401).json({ error: 'Unauthorized' });

        // Check project exists and inviter belongs to it
        const project = await projectModel.findOne({ _id: projectId, users: inviter._id });
        if (!project) return res.status(403).json({ error: 'Project not found or access denied' });

        // Determine frontend URL dynamically from Origin if environment variable is missing or points to localhost
        const reqOrigin = req.headers.origin || req.get('origin');
        let FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
        if (FRONTEND_URL.includes('localhost') && reqOrigin && !reqOrigin.includes('localhost')) {
            FRONTEND_URL = reqOrigin;
        } else if (!process.env.FRONTEND_URL && reqOrigin) {
            FRONTEND_URL = reqOrigin;
        }

        // Check for existing pending invite. If one exists, resend it instead of blocking the user.
        const existing = await Invite.findOne({
            projectId,
            invitedEmail: email.toLowerCase().trim(),
            status: 'pending',
            expiresAt: { $gt: new Date() },
        });
        if (existing) {
            const inviteUrl = `${FRONTEND_URL}/invite/accept?token=${existing.token}`;

            try {
                await sendInviteEmail({
                    toEmail: email,
                    inviterEmail: inviter.email,
                    projectName: project.name,
                    inviteUrl,
                });
            } catch (emailError) {
                throw emailError;
            }

            return res.status(200).json({
                message: `Invitation resent to ${email}`,
                inviteUrl,
            });
        }

        // Check if already a member (only if they have an account)
        const invitedUser = await userModel.findOne({ email: email.toLowerCase().trim() });
        if (invitedUser) {
            const alreadyMember = project.users.some(uid => uid.toString() === invitedUser._id.toString());
            if (alreadyMember) {
                return res.status(409).json({ error: 'This user is already a member of the project' });
            }
        }

        // Generate a secure token
        const token = crypto.randomBytes(32).toString('hex');

        // Save invite first so the accept link can be generated, but roll back if email delivery fails
        const invite = await Invite.create({
            projectId,
            invitedEmail: email.toLowerCase().trim(),
            invitedBy: inviter._id,
            token,
        });

        // Build the accept URL
        const inviteUrl = `${FRONTEND_URL}/invite/accept?token=${token}`;

        // Send email
        try {
            await sendInviteEmail({
                toEmail: email,
                inviterEmail: inviter.email,
                projectName: project.name,
                inviteUrl,
            });
        } catch (emailError) {
            await Invite.deleteOne({ _id: invite._id });
            throw emailError;
        }

        return res.status(200).json({
            message: `Invitation sent to ${email}`,
            inviteUrl,
        });

    } catch (err) {
        console.error('sendInvite error:', err.message || err);
        return res.status(500).json({ error: err.message || 'Failed to send invitation. Check email config.' });
    }
};

// GET /invites/accept?token=xxx  (called when user clicks link in email)
export const acceptInvite = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        const invite = await Invite.findOne({ token });

        if (!invite) return res.status(404).json({ error: 'Invite not found or already used' });
        if (invite.status !== 'pending') return res.status(410).json({ error: `Invite already ${invite.status}` });
        if (invite.expiresAt < new Date()) {
            invite.status = 'expired';
            await invite.save();
            return res.status(410).json({ error: 'Invite has expired' });
        }

        // Find the invited user — they may have just registered
        const user = await userModel.findOne({ email: invite.invitedEmail });
        if (!user) {
            // Not registered yet — tell frontend to redirect to register
            return res.status(403).json({
                error: 'Please create an account first to join the project.',
                needsRegistration: true,
                invitedEmail: invite.invitedEmail,
            });
        }

        // Add user to project
        const projectDoc = await projectModel.findById(invite.projectId);
        if (projectDoc) {
            const alreadyMember = projectDoc.users.some(uid => uid.toString() === user._id.toString());
            if (!alreadyMember) {
                projectDoc.users.push(user._id);
            }
            if (!projectDoc.userJoinedAt) {
                projectDoc.userJoinedAt = new Map();
            }
            const uStr = user._id.toString();
            if (!projectDoc.userJoinedAt.has(uStr)) {
                projectDoc.userJoinedAt.set(uStr, new Date());
            }
            await projectDoc.save();
        }

        // Mark invite accepted
        invite.status = 'accepted';
        await invite.save();

        // Get project details to send back
        const project = await projectModel.findById(invite.projectId);

        return res.status(200).json({
            message: 'Invitation accepted! You have been added to the project.',
            project: { _id: project._id, name: project.name },
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to accept invitation' });
    }
};

// GET /invites/preview?token=xxx  (frontend calls this to show invite details before accepting)
export const previewInvite = async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        const invite = await Invite.findOne({ token }).populate('invitedBy', 'email').populate('projectId', 'name');

        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.status !== 'pending') return res.status(410).json({ error: `Invite already ${invite.status}` });
        if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'Invite has expired' });

        return res.status(200).json({
            invitedEmail: invite.invitedEmail,
            invitedBy: invite.invitedBy?.email,
            projectName: invite.projectId?.name,
            expiresAt: invite.expiresAt,
        });

    } catch (err) {
        return res.status(500).json({ error: 'Failed to load invite' });
    }
};
