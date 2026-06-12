import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'project',
        required: true,
    },
    invitedEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    invitedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: true,
    },
    token: {
        type: String,
        required: true,
        unique: true,
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'expired'],
        default: 'pending',
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    },
}, { timestamps: true });

// Auto-expire index
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Invite = mongoose.model('invite', inviteSchema);
export default Invite;
