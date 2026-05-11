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

run('uv', [
  'run',
  'pyinstaller',
  '--onefile',
  '--hidden-import=uvicorn',
  '--hidden-import=fastapi',
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