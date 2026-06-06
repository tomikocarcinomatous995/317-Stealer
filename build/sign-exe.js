// Post-build: Sign the output exe with our certificate
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const certFile = path.join(ROOT, 'build', 'cert.pfx');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const certPassword = (pkg.build && pkg.build.win && pkg.build.win.certificatePassword) || 'test123';
const signtool = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.26100.0\\x64\\signtool.exe';

// Find exe in dist/
const files = fs.readdirSync(DIST_DIR);
const exe = files.find(f => f.endsWith('.exe'));

if (!exe) {
  console.log('[Sign] No exe found in dist/, skipping.');
  process.exit(0);
}

const exePath = path.join(DIST_DIR, exe);

if (!fs.existsSync(certFile)) {
  console.error('[Sign] Certificate not found:', certFile);
  process.exit(0);
}

if (!fs.existsSync(signtool)) {
  console.error('[Sign] signtool.exe not found:', signtool);
  process.exit(0);
}

console.log(`[Sign] Signing ${exe}...`);

const timestampServers = [
  'http://timestamp.digicert.com',
  'http://timestamp.sectigo.com',
  'http://timestamp.comodoca.com'
];

let signed = false;
for (const ts of timestampServers) {
  try {
    const cmd = `"${signtool}" sign /f "${certFile}" /p "${certPassword}" /fd SHA256 /tr "${ts}" /td SHA256 "${exePath}"`;
    execSync(cmd, { stdio: 'pipe' });
    console.log(`[Sign] ✓ Signed successfully (timestamp: ${ts})`);
    signed = true;
    break;
  } catch (e) {
    console.log(`[Sign] ⚠ Timestamp ${ts} failed, trying next...`);
  }
}

if (!signed) {
  try {
    const cmd = `"${signtool}" sign /f "${certFile}" /p "${certPassword}" /fd SHA256 "${exePath}"`;
    execSync(cmd, { stdio: 'pipe' });
    console.log('[Sign] ✓ Signed (without timestamp)');
  } catch (e) {
    console.error('[Sign] ✗ Signing failed:', e.message);
  }
}
