// 317 NUMBER ONE - Clean Build Artifacts
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dirsToClean = [
    path.join(__dirname, '..', 'obfuscated'),
    path.join(__dirname, '..', 'dist'),
    path.join(__dirname, '..', 'electron', 'obfuscated')
];

console.log('🧹 Cleaning build artifacts...\n');

// Kill any running BakugoMukago processes that may lock dist/ files
try {
    execSync('taskkill /F /IM BakugoMukago.exe /T 2>nul', { stdio: 'ignore' });
    console.log('✓ Killed running BakugoMukago processes');
} catch (e) {
    // No process found — that's fine
}
try {
    execSync('taskkill /F /IM "BakugoMukago-3.1.7-Setup.exe" /T 2>nul', { stdio: 'ignore' });
} catch (e) {}

// Small delay to let file handles release
try { execSync('ping -n 2 127.0.0.1 >nul', { stdio: 'ignore' }); } catch(e) {}

for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
        try {
            fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
            console.log(`✓ Removed: ${path.basename(dir)}/`);
        } catch (err) {
            // If still locked, try with shell command
            if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOTEMPTY') {
                console.log(`⚠ ${path.basename(dir)}/ locked, trying forced removal...`);
                try {
                    execSync(`rmdir /S /Q "${dir}"`, { stdio: 'ignore', timeout: 10000 });
                    console.log(`✓ Force removed: ${path.basename(dir)}/`);
                } catch (e) {
                    console.log(`⚠ Could not remove ${path.basename(dir)}/ (files may be in use). Skipping...`);
                }
            } else {
                console.log(`⚠ Could not remove ${path.basename(dir)}/: ${err.message}. Skipping...`);
            }
        }
    }
}

console.log('\n✅ Clean complete!\n');
