import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const IS_WIN = process.platform === 'win32';

function spawnProc(args, opts = {}) {
    if (IS_WIN) {
        const quoted = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
        console.log('CMD:', 'cmd /c', quoted);
        return spawn('cmd', ['/c', quoted], { ...opts, shell: false });
    }
    const [cmd, ...rest] = args;
    return spawn(cmd, rest, { ...opts, shell: false });
}

// Test 1: Python
const pyFile = path.join(os.tmpdir(), 'test_py.py');
fs.writeFileSync(pyFile, 'print("Python OK")\n', 'utf8');
console.log('\n--- Python test ---');
const py = spawnProc(['python', pyFile]);
py.stdout.on('data', d => console.log('stdout:', d.toString().trim()));
py.stderr.on('data', d => console.log('stderr:', d.toString().trim()));
py.on('close', code => {
    console.log('Python exit:', code);

    // Test 2: C++
    const cppFile = path.join(os.tmpdir(), 'test_cpp.cpp');
    const outFile = path.join(os.tmpdir(), IS_WIN ? 'test_cpp.exe' : 'test_cpp');
    fs.writeFileSync(cppFile, '#include<iostream>\nint main(){std::cout<<"C++ OK"<<std::endl;return 0;}\n', 'utf8');
    console.log('\n--- C++ compile test ---');
    const compile = spawnProc(['g++', cppFile, '-o', outFile, '-std=c++17']);
    compile.stdout.on('data', d => console.log('stdout:', d.toString().trim()));
    compile.stderr.on('data', d => console.log('stderr:', d.toString().trim()));
    compile.on('close', code2 => {
        console.log('Compile exit:', code2);
        if (code2 === 0) {
            console.log('\n--- C++ run test ---');
            const run = spawnProc([outFile]);
            run.stdout.on('data', d => console.log('stdout:', d.toString().trim()));
            run.stderr.on('data', d => console.log('stderr:', d.toString().trim()));
            run.on('close', code3 => console.log('Run exit:', code3));
            run.on('error', e => console.log('Run error:', e.message));
        }
    });
    compile.on('error', e => console.log('Compile error:', e.message));
});
py.on('error', e => console.log('Python error:', e.message));
