// 317 NUMBER ONE - JSON Database Manager
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Database path
const DB_PATH = path.join(__dirname, '../../data/database.json');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database structure
let database = {
  customers: [],
  keys: [],
  builds: [],
  admin: null
};

/**
 * Load database from file
 */
function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      database = JSON.parse(data);
    } else {
      saveDatabase();
    }
  } catch (error) {
    console.error('[Database] Load error:', error.message);
    database = { customers: [], keys: [], builds: [], admin: null };
    saveDatabase();
  }
}

/**
 * Save database to file
 */
function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(database, null, 2), 'utf8');
  } catch (error) {
    console.error('[Database] Save error:', error.message);
  }
}

/**
 * Generate unique key code
 */
function generateKeyCode() {
  return '317-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Calculate expiration date
 */
function calculateExpirationDate(durationType) {
  const now = new Date();
  const durationMap = {
    '1day': 1,
    '3days': 3,
    '7days': 7,
    '1month': 30,
    '3months': 90,
    '1year': 365,
    'lifetime': 36500
  };

  const days = durationMap[durationType] || 1;
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

/**
 * Get duration days from type
 */
function getDurationDays(durationType) {
  const durationMap = {
    '1day': 1,
    '3days': 3,
    '7days': 7,
    '1month': 30,
    '3months': 90,
    '1year': 365,
    'lifetime': 36500
  };
  return durationMap[durationType] || 1;
}

/**
 * Set admin
 */
function setAdmin(telegramId) {
  database.admin = String(telegramId);
  saveDatabase();
  return true;
}

/**
 * Get admin
 */
function getAdmin() {
  return database.admin;
}

/**
 * Check if user is admin
 */
function isAdmin(telegramId) {
  return database.admin === String(telegramId);
}

/**
 * Create key (Admin only)
 */
function createKey(durationType, count = 1) {
  const keys = [];

  for (let i = 0; i < count; i++) {
    const keyCode = generateKeyCode();
    const durationDays = getDurationDays(durationType);
    const expiresAt = calculateExpirationDate(durationType);

    const key = {
      id: database.keys.length + 1,
      keyCode,
      durationType,
      durationDays,
      expiresAt,
      isUsed: false,
      usedAt: null,
      customerId: null,
      createdAt: new Date().toISOString()
    };

    database.keys.push(key);
    keys.push({
      keyCode,
      durationType,
      durationDays,
      expiresAt
    });
  }

  saveDatabase();
  return keys;
}

/**
 * Delete key (Admin only)
 */
function deleteKey(keyCode) {
  const index = database.keys.findIndex(k => k.keyCode === keyCode);
  if (index !== -1) {
    database.keys.splice(index, 1);
    saveDatabase();
    return true;
  }
  return false;
}

/**
 * Get all keys (Admin only)
 */
function getAllKeys() {
  return database.keys.map(key => {
    const customer = database.customers.find(c => c.id === key.customerId);
    return {
      ...key,
      usedBy: customer ? customer.username : null
    };
  });
}

/**
 * Validate key
 */
function validateKey(keyCode) {
  const key = database.keys.find(k => k.keyCode === keyCode);
  if (!key) return false;
  if (key.isUsed) return false;
  if (new Date(key.expiresAt) < new Date()) return false;
  return true;
}

/**
 * Get key info
 */
function getKeyInfo(keyCode) {
  return database.keys.find(k => k.keyCode === keyCode);
}

/**
 * Use key (mark as used and assign to customer)
 */
function useKey(keyCode, customerId) {
  const key = database.keys.find(k => k.keyCode === keyCode);
  if (key && !key.isUsed) {
    key.isUsed = true;
    key.usedAt = new Date().toISOString();
    key.customerId = customerId;
    saveDatabase();
    return true;
  }
  return false;
}

/**
 * Get or create customer
 */
function getOrCreateCustomer(telegramId, username) {
  let customer = database.customers.find(c => c.telegramId === String(telegramId));

  if (!customer) {
    customer = {
      id: database.customers.length + 1,
      telegramId: String(telegramId),
      username,
      webhook_url: null,
      telegram_chat_id: null,
      exe_name: 'RapidStealer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    database.customers.push(customer);
    saveDatabase();
  }

  return customer;
}

/**
 * Get customer by telegram ID
 */
function getCustomer(telegramId) {
  return database.customers.find(c => c.telegramId === String(telegramId));
}

/**
 * Update customer webhook
 */
function updateCustomerWebhook(telegramId, webhookUrl) {
  const customer = database.customers.find(c => c.telegramId === String(telegramId));
  if (customer) {
    customer.webhook_url = webhookUrl;
    customer.updatedAt = new Date().toISOString();
    saveDatabase();
    return true;
  }
  return false;
}

/**
 * Update customer telegram chat ID
 */
function updateCustomerChatId(telegramId, chatId) {
  const customer = database.customers.find(c => c.telegramId === String(telegramId));
  if (customer) {
    customer.telegram_chat_id = chatId;
    customer.updatedAt = new Date().toISOString();
    saveDatabase();
    return true;
  }
  return false;
}

/**
 * Update customer exe name
 */
function updateCustomerExeName(telegramId, exeName) {
  const customer = database.customers.find(c => c.telegramId === String(telegramId));
  if (customer) {
    customer.exe_name = exeName;
    customer.updatedAt = new Date().toISOString();
    saveDatabase();
    return true;
  }
  return false;
}

/**
 * Record build
 */
function recordBuild(customerId, keyId, exeName, webhookUrl, telegramChatId) {
  const build = {
    id: database.builds.length + 1,
    customerId,
    keyId,
    exeName,
    webhookUrl,
    telegramChatId,
    buildDate: new Date().toISOString()
  };
  database.builds.push(build);
  saveDatabase();
  return build.id;
}

/**
 * Get active key for a customer (used, not expired)
 */
function getCustomerActiveKey(customerId) {
  return database.keys.find(k => 
    k.customerId === customerId && 
    k.isUsed && 
    new Date(k.expiresAt) > new Date()
  ) || null;
}

/**
 * Get customer builds
 */
function getCustomerBuilds(customerId) {
  return database.builds
    .filter(b => b.customerId === customerId)
    .map(build => {
      const key = database.keys.find(k => k.id === build.keyId);
      return {
        ...build,
        keyCode: key ? key.keyCode : null,
        durationType: key ? key.durationType : null
      };
    })
    .sort((a, b) => new Date(b.buildDate) - new Date(a.buildDate));
}

/**
 * Get all customers (Admin only)
 */
function getAllCustomers() {
  return database.customers.map(customer => {
    const builds = database.builds.filter(b => b.customerId === customer.id);
    const keys = database.keys.filter(k => k.customerId === customer.id);
    return {
      ...customer,
      totalBuilds: builds.length,
      totalKeysUsed: keys.length
    };
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get statistics (Admin only)
 */
function getStatistics() {
  const totalKeys = database.keys.length;
  const usedKeys = database.keys.filter(k => k.isUsed).length;
  const activeKeys = database.keys.filter(k => !k.isUsed && new Date(k.expiresAt) > new Date()).length;
  const expiredKeys = database.keys.filter(k => !k.isUsed && new Date(k.expiresAt) <= new Date()).length;
  const totalCustomers = database.customers.length;
  const totalBuilds = database.builds.length;

  return {
    totalKeys,
    usedKeys,
    activeKeys,
    expiredKeys,
    totalCustomers,
    totalBuilds
  };
}

// Initialize database on module load
loadDatabase();
console.log('[Database] JSON database loaded successfully');

module.exports = {
  loadDatabase,
  saveDatabase,
  setAdmin,
  getAdmin,
  isAdmin,
  createKey,
  deleteKey,
  getAllKeys,
  validateKey,
  getKeyInfo,
  useKey,
  getOrCreateCustomer,
  getCustomer,
  updateCustomerWebhook,
  updateCustomerChatId,
  updateCustomerExeName,
  recordBuild,
  getCustomerActiveKey,
  getCustomerBuilds,
  getAllCustomers,
  getStatistics
};
