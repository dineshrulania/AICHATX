import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'project',
        required: true,
        index: true
    },
    sender: {
        _id: { type: String, required: true },
        email: { type: String, required: true }
    },
    message: {
        type: String,
        required: true
    },
    mentions: [
        {
            type: String
        }
    ],
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
});

const Message = mongoose.model('message', messageSchema);
export default Message;
