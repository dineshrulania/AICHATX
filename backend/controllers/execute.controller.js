// Local code execution — child_process, no external API needed.
// Uses WebSocket session for interactive stdin (send input while running).

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const IS_WIN = process.platform === 'win32';

export const LANGUAGES = {
    javascript: { label: 'JavaScript (Node.js)', filename: 'main.js',    run: ['node', '{FILE}'] },
    typescript: { label: 'TypeScript',            filename: 'main.ts',    run: ['node', '--experimental-strip-types', '{FILE}'] },
    python:     { label: 'Python 3',              filename: 'main.py',    run: ['python', '{FILE}'] },
    cpp:        { label: 'C++ (g++)',              filename: 'main.cpp',   compile: ['g++', '{FILE}', '-o', '{OUT}', '-std=c++17'], run: ['{OUT}'] },
    c:          { label: 'C (gcc)',                filename: 'main.c',     compile: ['gcc', '{FILE}', '-o', '{OUT}', '-std=c11'],   run: ['{OUT}'] },
    java:       { label: 'Java',                   filename: 'Main.java',  compile: ['javac', '{FILE}'],                             run: ['java', '-cp', '{DIR}', 'Main'] },
    bash:       { label: 'Bash',                   filename: 'main.sh',    run: ['bash', '{FILE}'] },
    php:        { label: 'PHP',                    filename: 'main.php',   run: ['php', '{FILE}'] },
    ruby:       { label: 'Ruby',                   filename: 'main.rb',    run: ['ruby', '{FILE}'] },
    go:         { label: 'Go',                     filename: 'main.go',    run: ['go', 'run', '{FILE}'] },
    rust:       { label: 'Rust',                   filename: 'main.rs',    compile: ['rustc', '{FILE}', '-o', '{OUT}'], run: ['{OUT}'] },
    lua:        { label: 'Lua',                    filename: 'main.lua',   run: ['lua', '{FILE}'] },
    perl:       { label: 'Perl',                   filename: 'main.pl',    run: ['perl', '{FILE}'] },
};

function resolveArgs(args, vars) {
    return args.map(a => { let s = a; for (const [k, v] of Object.entries(vars)) s = s.replaceAll(k, v); return s; });
}

// Spawn processes directly so Windows executables receive clean argv values.
function spawnProc(args, opts = {}) {
    const [cmd, ...rest] = args;
    return spawn(cmd, rest, { ...opts, shell: false });
}

// Active process sessions keyed by sessionId  { process, workDir }
const sessions = new Map();

// ── Socket.io handler — called from server.js ──────────────────────────────
export function registerTerminalSocket(io) {
    io.of('/terminal').on('connection', socket => {

        // Client sends: { sessionId, language, code }
        socket.on('run', async ({ sessionId, language, code }) => {
            const lang = LANGUAGES[language];
            if (!lang) { socket.emit('output', { type: 'error', data: `Unsupported language: ${language}\n` }); return; }

            // Kill any existing session
            if (sessions.has(sessionId)) {
                try { sessions.get(sessionId).process.kill(); } catch {}
                sessions.delete(sessionId);
            }

            socket.emit('output', { type: 'info', data: `▶  Running [${lang.label}]...\n` });

            const workDir = path.join(os.tmpdir(), `aichatx_${crypto.randomBytes(6).toString('hex')}`);
            fs.mkdirSync(workDir, { recursive: true });
            const filePath = path.join(workDir, lang.filename);
            const outPath  = path.join(workDir, IS_WIN ? 'out.exe' : 'out');
            const vars     = { '{FILE}': filePath, '{OUT}': outPath, '{DIR}': workDir };

            fs.writeFileSync(filePath, code, { encoding: 'utf8' });

            // Compile step
            if (lang.compile) {
                socket.emit('output', { type: 'info', data: '🔨 Compiling...\n' });
                const ok = await runStep(socket, resolveArgs(lang.compile, vars), workDir);
                if (!ok) {
                    socket.emit('output', { type: 'error', data: '\n✗ Compilation failed\n' });
                    socket.emit('done', { code: 1 });
                    cleanup(workDir);
                    return;
                }
                socket.emit('output', { type: 'info', data: '✓ Compiled\n\n' });
            }

            // Run step — keep process alive for interactive stdin
            const runArgs = resolveArgs(lang.run, vars);
            const child   = spawnProc(runArgs, { cwd: workDir });

            sessions.set(sessionId, { process: child, workDir });
            socket.emit('input_state', { waiting: true });

            child.stdout.on('data', d => {
                const text = d.toString();
                socket.emit('output', { type: 'stdout', data: text });
            });
            child.stderr.on('data', d => socket.emit('output', { type: 'stderr', data: d.toString() }));

            child.on('close', code => {
                sessions.delete(sessionId);
                cleanup(workDir);
                socket.emit('input_state', { waiting: false });
                if (code === 0) {
                    socket.emit('output', { type: 'info', data: `\n✓ Exited with code 0\n` });
                } else {
                    socket.emit('output', { type: 'error', data: `\n✗ Exited with code ${code}\n` });
                }
                socket.emit('done', { code });
            });

            child.on('error', err => {
                sessions.delete(sessionId);
                cleanup(workDir);
                socket.emit('input_state', { waiting: false });
                socket.emit('output', { type: 'error', data: `\nCommand not found: ${runArgs[0]}\nIs it installed and in PATH?\n` });
                socket.emit('done', { code: -1 });
            });

            // Safety timeout 30s
            setTimeout(() => {
                if (sessions.has(sessionId)) {
                    try { sessions.get(sessionId).process.kill(); } catch {}
                    sessions.delete(sessionId);
                    cleanup(workDir);
                    socket.emit('input_state', { waiting: false });
                    socket.emit('output', { type: 'error', data: '\n⏱ Time limit exceeded (30s)\n' });
                    socket.emit('done', { code: -1 });
                }
            }, 30000);
        });

        // Client sends stdin while process is running
        socket.on('stdin', ({ sessionId, data }) => {
            const session = sessions.get(sessionId);
            if (session?.process) {
                try {
                    session.process.stdin.write(data);
                } catch {}
            }
        });

        // Client sends EOF (Ctrl+D)
        socket.on('stdin_end', ({ sessionId }) => {
            const session = sessions.get(sessionId);
            if (session?.process) {
                try { session.process.stdin.end(); } catch {}
            }
        });

        // Kill running process
        socket.on('kill', ({ sessionId }) => {
            const session = sessions.get(sessionId);
            if (session?.process) {
                try { session.process.kill(); } catch {}
                sessions.delete(sessionId);
                cleanup(session.workDir);
                socket.emit('input_state', { waiting: false });
                socket.emit('output', { type: 'error', data: '\n⛔ Process killed\n' });
                socket.emit('done', { code: -1 });
            }
        });

        socket.on('disconnect', () => {
            // Clean up all sessions for this socket on disconnect
            sessions.forEach((sess, id) => {
                try { sess.process.kill(); } catch {}
                cleanup(sess.workDir);
                sessions.delete(id);
            });
        });
    });
}

// Run a compile step synchronously (no interactive stdin needed)
function runStep(socket, args, cwd) {
    return new Promise(resolve => {
        const child = spawnProc(args, { cwd });
        child.stdout.on('data', d => socket.emit('output', { type: 'stdout', data: d.toString() }));
        child.stderr.on('data', d => socket.emit('output', { type: 'stderr', data: d.toString() }));
        child.on('close', code => resolve(code === 0));
        child.on('error', err => {
            socket.emit('output', { type: 'error', data: `${err.message}\n` });
            resolve(false);
        });
        setTimeout(() => { child.kill(); resolve(false); }, 30000);
    });
}

function cleanup(workDir) {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
}

// HTTP endpoint — returns supported languages list
export const getRuntimes = (_req, res) => {
    res.json(Object.entries(LANGUAGES).map(([key, val]) => ({ key, label: val.label })));
};

// HTTP fallback for the legacy /execute/run route.
// This is non-interactive; the live terminal socket remains the interactive path.
export const runCode = async (req, res) => {
    const { language, code, stdin = '' } = req.body || {};
    const lang = LANGUAGES[language];

    if (!lang) {
        return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const workDir = path.join(os.tmpdir(), `aichatx_${crypto.randomBytes(6).toString('hex')}`);
    fs.mkdirSync(workDir, { recursive: true });

    try {
        const filePath = path.join(workDir, lang.filename);
        const outPath = path.join(workDir, IS_WIN ? 'out.exe' : 'out');
        const vars = { '{FILE}': filePath, '{OUT}': outPath, '{DIR}': workDir };
        const logs = [];

        fs.writeFileSync(filePath, code || '', { encoding: 'utf8' });

        if (lang.compile) {
            const compileOk = await runStep({ emit: (event, payload) => {
                if (event === 'output') logs.push(payload);
            } }, resolveArgs(lang.compile, vars), workDir);

            if (!compileOk) {
                return res.status(400).json({ error: 'Compilation failed', logs });
            }
        }

        const runArgs = resolveArgs(lang.run, vars);
        const child = spawnProc(runArgs, { cwd: workDir });
        let stdout = '';
        let stderr = '';

        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => { stderr += d.toString(); });

        if (stdin) {
            child.stdin.write(stdin);
        }
        child.stdin.end();

        const exitCode = await new Promise(resolve => {
            child.on('close', code => resolve(code));
            child.on('error', () => resolve(-1));
        });

        return res.json({
            code: exitCode,
            stdout,
            stderr,
            logs
        });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Execution failed' });
    } finally {
        cleanup(workDir);
    }
};
