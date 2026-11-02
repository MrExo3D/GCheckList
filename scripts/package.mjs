// Copies just what gSender needs (manifest + built ui/) into
// release/job-checklist/ and zips it for sharing.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = join(root, 'release');
const outDir = join(releaseDir, 'job-checklist');

if (!existsSync(join(root, 'ui', 'index.html'))) {
    throw new Error('ui/index.html is missing. Run "npm run build" first.');
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(root, 'gsender-plugin.json'), join(outDir, 'gsender-plugin.json'));
cpSync(join(root, 'ui'), join(outDir, 'ui'), { recursive: true });

// zip from a temp copy: sync tools like Dropbox briefly lock freshly
// written files, which makes Compress-Archive fail
const stageDir = mkdtempSync(join(tmpdir(), 'job-checklist-'));
const stagedPlugin = join(stageDir, 'job-checklist');
const stagedZip = join(stageDir, 'job-checklist.zip');
cpSync(root, stagedPlugin, {
    recursive: true,
    filter: (src) => {
        const rel = relative(root, src);
        return (
            rel === '' ||
            rel === 'gsender-plugin.json' ||
            rel === 'ui' ||
            rel.startsWith(`ui${sep}`)
        );
    },
});
if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path '${stagedPlugin}' -DestinationPath '${stagedZip}' -Force`,
    ]);
} else {
    execFileSync('zip', ['-r', 'job-checklist.zip', 'job-checklist'], {
        cwd: stageDir,
    });
}
const zipPath = join(releaseDir, 'job-checklist.zip');
cpSync(stagedZip, zipPath);
rmSync(stageDir, { recursive: true, force: true });

console.log(`Plugin folder: ${outDir}`);
console.log(`Zip:           ${zipPath}`);
