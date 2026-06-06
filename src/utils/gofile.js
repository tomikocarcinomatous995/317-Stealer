// 317 NUMBER ONE - Gofile.io Upload Utility

/**
 * Upload file to Gofile.io and return download link
 */
async function uploadToGofile(filePath, filename = null) {
  const fs = require('fs');
  const path = require('path');
  const FormData = require('form-data');
  const axios = require('axios');
  
  if (!filename) {
    filename = path.basename(filePath);
  }
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`[Gofile] Uploading ${filename} (${sizeMB} MB)...`);
    
    // Step 1: Get best server
    console.log('[Gofile] Getting best server...');
    const serverResponse = await axios.get('https://api.gofile.io/servers', {
      timeout: 30000
    });
    
    if (!serverResponse.data || serverResponse.data.status !== 'ok') {
      throw new Error('Failed to get Gofile server');
    }
    
    const server = serverResponse.data.data.servers[0].name;
    console.log(`[Gofile] Using server: ${server}`);
    
    // Step 2: Upload file
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: filename,
      contentType: 'application/zip'
    });
    
    console.log(`[Gofile] Uploading to https://${server}.gofile.io/contents/uploadfile`);
    
    const uploadResponse = await axios.post(
      `https://${server}.gofile.io/contents/uploadfile`,
      form,
      {
        headers: {
          ...form.getHeaders()
        },
        timeout: 300000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    console.log(`[Gofile] Upload response status: ${uploadResponse.status}`);
    
    if (uploadResponse.data && uploadResponse.data.status === 'ok' && uploadResponse.data.data.downloadPage) {
      const downloadLink = uploadResponse.data.data.downloadPage;
      console.log(`[Gofile] Upload success: ${downloadLink}`);
      return {
        success: true,
        link: downloadLink,
        fileId: uploadResponse.data.data.fileId || null,
        filename: filename,
        size: sizeMB
      };
    }
    
    throw new Error('Gofile upload failed - no download URL in response');
    
  } catch (error) {
    console.error(`[Gofile] Upload failed:`, error.message);
    return {
      success: false,
      error: error.message,
      filename: filename
    };
  }
}


/**
 * Alternative upload to Catbox.moe (reliable, no limits)
 */
async function uploadToCatbox(filePath, filename = null) {
  const fs = require('fs');
  const path = require('path');
  const FormData = require('form-data');
  const fetch = require('node-fetch');
  
  if (!filename) {
    filename = path.basename(filePath);
  }
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    
    console.log(`[Catbox] Uploading ${filename} (${sizeMB} MB)...`);
    
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('fileToUpload', fs.createReadStream(filePath), {
      filename: filename
    });
    
    const uploadResp = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    if (!uploadResp.ok) {
      throw new Error(`Upload failed: ${uploadResp.status}`);
    }
    
    const uploadUrl = await uploadResp.text();
    
    if (uploadUrl && uploadUrl.startsWith('https://')) {
      console.log(`[Catbox] Upload success: ${uploadUrl}`);
      return {
        success: true,
        link: uploadUrl.trim(),
        filename: filename,
        size: sizeMB
      };
    } else {
      throw new Error(`Invalid response: ${uploadUrl}`);
    }
    
  } catch (error) {
    console.error(`[Catbox] Upload failed:`, error.message);
    return {
      success: false,
      error: error.message,
      filename: filename
    };
  }
}



/**
 * Smart upload with automatic fallback (multiple services)
 */
async function smartUpload(filePath, filename = null) {
  console.log('[Upload] Starting smart upload with fallback...');
  
  // Try Gofile first (best option - 5 GB, permanent)
  let result = await uploadToGofile(filePath, filename);
  if (result.success) {
    return result;
  }
  
  // Try Catbox (reliable - 200 MB, permanent)
  console.log('[Upload] Gofile failed, trying Catbox...');
  result = await uploadToCatbox(filePath, filename);
  if (result.success) {
    return result;
  }

  
  // All failed
  console.error('[Upload] All upload services failed');
  return {
    success: false,
    error: 'All upload services failed',
    filename: filename || 'unknown'
  };
}

module.exports = {
  uploadToGofile,
  uploadToCatbox,
  smartUpload
};
