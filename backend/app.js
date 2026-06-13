import express from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import executeRoutes from './routes/execute.routes.js';
import inviteRoutes from './routes/invite.routes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

connect();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/users', userRoutes);
app.use('/projects', projectRoutes);
app.use("/ai", aiRoutes);
app.use("/execute", executeRoutes);
app.use("/invites", inviteRoutes);

// Serve frontend static files if they exist (production deployment)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback for SPA routing: serve index.html for any unmatched non-API routes
app.get('*', (req, res) => {
    // If it's an API request, do not redirect to index.html; just return 404
    const apiPrefixes = ['/users', '/projects', '/ai', '/execute', '/invites'];
    if (apiPrefixes.some(prefix => req.path.startsWith(prefix))) {
        return res.status(404).json({ error: 'Not Found' });
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
        if (err) {
            // If index.html doesn't exist, fall back to hello world or 404
            res.status(404).send('Not Found (Static frontend build not found)');
        }
    });
});

export default app; 
