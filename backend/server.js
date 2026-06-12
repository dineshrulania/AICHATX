import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';
import { registerTerminalSocket } from './controllers/execute.controller.js';

const port = process.env.PORT || 3000;



const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});

server.on('error', err => {
    if (err?.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Stop the running backend or set a different PORT.`);
        process.exit(1);
    }
    throw err;
});


io.use(async (socket, next) => {

    try {

        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[ 1 ];
        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }


        socket.project = await projectModel.findById(projectId).populate('users', 'email');


        if (!token) {
            return next(new Error('Authentication error'))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error'))
        }


        socket.user = decoded;

        next();

    } catch (error) {
        next(error)
    }

})


io.on('connection', socket => {
    socket.roomId = socket.project._id.toString()


    console.log('a user connected');



    socket.join(socket.roomId);

    function extractMentionedFiles(message) {
        const matches = [...message.matchAll(/@([A-Za-z0-9._/-]+\.[A-Za-z0-9]+)/g)]
            .map(match => match[1])
            .filter(fileName => fileName.toLowerCase() !== 'ai')

        return [ ...new Set(matches) ]
    }

    function extractMentionedPeople(message) {
        const projectUsers = socket.project?.users || []
        const mentionedEmails = projectUsers
            .map(user => user.email)
            .filter(Boolean)
            .filter(email => message.toLowerCase().includes(`@${email.toLowerCase()}`))

        return [ ...new Set(mentionedEmails) ]
    }

    function buildAiPrompt(message) {
        const userMessage = message.replace(/@ai\b/gi, '').trim()
        const mentionedFiles = extractMentionedFiles(message)
        const mentionedPeople = extractMentionedPeople(message)
        const fileTree = socket.project?.fileTree || {}

        const referencedFiles = mentionedFiles.map(fileName => {
            const fileEntry = fileTree[fileName]
            if (!fileEntry?.file?.contents) {
                return `FILE: ${fileName}\nSTATUS: not found in the current project.`
            }

            return `FILE: ${fileName}\nCONTENT:\n${fileEntry.file.contents}`
        }).join('\n\n---\n\n')

        return `
User request:
${userMessage}

Targeted files mentioned by the user:
${mentionedFiles.length > 0 ? mentionedFiles.join(', ') : 'None'}

Targeted people mentioned by the user:
${mentionedPeople.length > 0 ? mentionedPeople.join(', ') : 'None'}

Referenced file contents:
${referencedFiles || 'None'}

Important rules:
- If the user mentions @filename, treat that as the primary file to update.
- If the user mentions a teammate email like @person@example.com, treat it as a person mention in the project chat and preserve it in the response when relevant.
- Do not delete unrelated files.
- Return only the files that changed in fileTree; the client will merge them into the existing project.
- If you only need to explain something, return a JSON object with text only.
        `.trim()
    }

    socket.on('project-message', async data => {

        const message = data.message;

        const aiIsPresentInMessage = message.includes('@ai');
        const mentionedPeople = extractMentionedPeople(message);
        const enrichedMessage = {
            ...data,
            mentions: mentionedPeople,
        }
        socket.broadcast.to(socket.roomId).emit('project-message', enrichedMessage)

        if (aiIsPresentInMessage) {

            try {
                const prompt = buildAiPrompt(message);
                const result = await generateResult(prompt);

                io.to(socket.roomId).emit('project-message', {
                    message: result,
                    sender: {
                        _id: 'ai',
                        email: 'AI'
                    }
                })
            } catch (error) {
                console.error('AI generation error:', error.message || error);
                io.to(socket.roomId).emit('project-message', {
                    message: JSON.stringify({
                        text: `AI is temporarily unavailable: ${error.message || 'Unknown error'}`
                    }),
                    sender: {
                        _id: 'ai',
                        email: 'AI'
                    }
                })
            }

            return
        }

        if (mentionedPeople.length > 0) {
            io.to(socket.roomId).emit('project-message', {
                message: JSON.stringify({
                    text: `Mentioned teammate(s): ${mentionedPeople.map(email => `@${email}`).join(', ')}`,
                    mentions: mentionedPeople,
                }),
                sender: {
                    _id: 'ai',
                    email: 'AI'
                }
            })
        }


    })

    socket.on('disconnect', () => {
        console.log('user disconnected');
        socket.leave(socket.roomId)
    });
});




server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})

// Register interactive terminal socket namespace
registerTerminalSocket(io);