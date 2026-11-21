// Builds the Windows desktop app (Atlas Imperium.exe) from dist/ into release/.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
fs.rmSync('desktop/game', { recursive: true, force: true });
fs.mkdirSync('desktop/game', { recursive: true });
for (const f of fs.readdirSync('dist')) fs.copyFileSync('dist/' + f, 'desktop/game/' + f);
execSync('npx --yes @electron/packager desktop "Atlas Imperium" --platform=win32 --arch=x64 --electron-version=33.4.11 --icon=desktop/icon.ico --out=release --overwrite', { stdio: 'inherit' });
console.log('Done: release/Atlas Imperium-win32-x64/Atlas Imperium.exe');
