const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const engineDir = path.join(rootDir, 'engine');
const tauriDir = path.join(rootDir, 'src-tauri');
const sidecarName = 'main-x86_64-pc-windows-msvc.exe';
const sourceBinary = path.join(engineDir, 'dist', 'main.exe');
const targetBinaryDir = path.join(tauriDir, 'binaries');
const targetBinary = path.join(targetBinaryDir, sidecarName);

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: 'inherit',
    cwd: rootDir,
    shell: false,
    ...options,
  });
}

fs.mkdirSync(targetBinaryDir, { recursive: true });

console.log('Running PyInstaller to bundle Python engine...');
run('uv', [
  'run',
  'pyinstaller',
  '--onefile',
  '--noconsole',
  '--hidden-import=uvicorn.logging',
  '--hidden-import=uvicorn.loops',
  '--hidden-import=uvicorn.loops.auto',
  '--hidden-import=uvicorn.protocols',
  '--hidden-import=uvicorn.protocols.http',
  '--hidden-import=uvicorn.protocols.http.auto',
  '--hidden-import=uvicorn.protocols.websockets',
  '--hidden-import=uvicorn.protocols.websockets.auto',
  '--hidden-import=uvicorn.lifespan',
  '--hidden-import=uvicorn.lifespan.on',
  '--hidden-import=fastapi',
  '--hidden-import=pydantic',
  '--hidden-import=playwright',
  '--collect-all=browser_use',
  '--collect-all=playwright',
  'main.py',
], {
  cwd: engineDir,
});

fs.copyFileSync(sourceBinary, targetBinary);
console.log(`Copied ${sourceBinary} -> ${targetBinary}`);

if (process.platform === 'win32') {
  run('cmd.exe', ['/d', '/s', '/c', 'pnpm exec tauri build']);
} else {
  run('pnpm', ['exec', 'tauri', 'build']);
}