# 317 Stealer

This repository contains a Windows/Electron-based data collection and exfiltration program. The source code includes harmful behavior such as Discord token collection, browser data extraction, screenshot capture, live screen streaming, HVNC, Discord client injection, anti-VM/sandbox checks, and data delivery through Telegram or Discord webhooks.

For that reason, this project should not be run outside authorized security analysis, incident response, or code review. This README is intended to document the file structure and risks, not to provide operational deployment instructions.

## What Does It Do?

The code is designed to collect identity, account, browser, system, and screen data from Windows systems and send that data to a remote operator through Telegram, Discord webhooks, or file upload services. It also contains a license-based builder bot flow for generating customized builds, applying obfuscation, and packaging a Windows executable.

Observed capabilities:

- Searches for Discord tokens, validates them, and reports account details.
- Injects code into the Discord client to capture sessions, passwords, 2FA flows, and payment-related events.
- Attempts to extract passwords, cookies, cards, and profile data from Chromium/Firefox-based browsers.
- Captures screenshots and supports live screen streaming.
- Implements HVNC logic for hidden desktop creation, app launching, frame relay, and remote input.
- Collects system information, VPN status, installed games/launchers/wallets, and VM/sandbox indicators.
- Sends collected data through Telegram bots and Discord webhooks.
- Includes obfuscation, packaging, and signing logic that can make analysis and detection harder.

## How To Run

Do not run this project. The code contains credential theft and unauthorized data exfiltration capabilities. If analysis is required, inspect it only in an authorized, isolated virtual machine with networking disabled and with static analysis tooling.

Safe analysis recommendations:

- Do not run it on a real machine, a real user profile, or an internet-connected environment.
- Treat values in `.env`, `config.js`, and `data/database.json` as secrets.
- Revoke and rotate any webhook, bot token, license key, or certificate that may have been exposed.
- Treat `build/cert.pfx` as sensitive signing material; revoke it if exposure is possible.
- If dynamic analysis is necessary, use a malware analysis lab VM with blocked egress traffic and snapshots.

## Files and Directories

### Root Directory

| File | Description |
| --- | --- |
| `.env` | Environment variables. May contain bot tokens, webhooks, or other secrets. |
| `.gitignore` | Defines files and directories ignored by Git. |
| `package.json` | Node/Electron package metadata, dependencies, scripts, and electron-builder Windows packaging settings. |
| `package-lock.json` | Locked dependency tree. |
| `config.js` | Telegram, Discord webhook, stream server, browser paths, Discord paths, VPN/game/launcher/wallet detection, and anti-VM/sandbox configuration. |
| `index.js` | Main execution orchestrator: system collection, Discord token search, injection, browser data collection, screenshot capture, stream/HVNC, and exfiltration. |
| `license-bot.js` | Telegram-based license and builder bot. Handles customer settings, license keys, webhook/chat id/exe name settings, and build queue management. |
| `stream-server.js` | Relay and web panel server for remote screen/HVNC sessions. Manages active sessions, frames, chat, and remote commands. |
| `README_TR.md` | Turkish safe-analysis and file reference document. |
| `README_EN.md` | English safe-analysis and file reference document. |

### `src/`

| File | Description |
| --- | --- |
| `src/database/db.js` | JSON-backed manager for customers, license keys, builds, and admin records. |
| `src/modules/browser.js` | Browser data extraction module. Can download a temporary Python runtime, install packages, collect profile data, and archive it. |
| `src/modules/discord.js` | Discord token discovery, decryption, validation, account metadata, badge, friend, and server collection logic. |
| `src/modules/hvnc.js` | Hidden Windows desktop creation, app launching, screen capture, and remote input relay logic. |
| `src/modules/injection.js` | Module intended to inject code into Discord's Electron client to capture sessions and sensitive transaction data. |
| `src/modules/screenshot.js` | Uses PowerShell to capture multi-monitor screenshots into a temporary PNG file. |
| `src/modules/stream.js` | Electron desktopCapturer-based live screen streaming client and support chat window logic. |
| `src/modules/telegram.js` | Sends collected data through the Telegram Bot API as messages, documents, or upload links. |
| `src/modules/webhook.js` | Builds Discord webhook messages/embeds, attaches files/links, and sends reports. |
| `src/utils/crypto.js` | Base64, DPAPI, Chrome/Edge AES-GCM decryption helpers, plus a simple XOR string decoder. |
| `src/utils/gofile.js` | Helper for uploading archives to Gofile.io and alternative file upload services. |
| `src/utils/system.js` | System information, IP/country lookup, VPN detection, path expansion, process termination, and anti-VM/sandbox helpers. |

### `electron/`

| File | Description |
| --- | --- |
| `electron/main.js` | Electron main process. Handles hidden windows, screen capture, logging, loading `index.js`, and starting the main flow. |

### `build/`

| File | Description |
| --- | --- |
| `build/clean.js` | Attempts to remove `obfuscated`, `dist`, and related build artifact directories. |
| `build/obfuscator.js` | Applies two-stage JavaScript obfuscation to `src`, `index.js`, `config.js`, and Electron files. |
| `build/sign-exe.js` | Attempts to sign the Windows EXE in `dist` using a PFX certificate and signtool. |
| `build/cert.pfx` | Windows code-signing certificate file. Treat as confidential and sensitive. |
| `build/resources/README.md` | General notes for Electron icon and branding resources. |
| `build/resources/installer.nsh` | NSIS installer hook/macro file. |
| `build/resources/icon.ico` | Application icon file. |
| `build/resources/icon_default.ico` | Default icon file. |

### `data/`

| File | Description |
| --- | --- |
| `data/database.json` | Stores customers, license keys, builds, and admin records. May contain webhook URLs, Telegram IDs, and other sensitive data. |

### `obfuscated/`

This directory contains obfuscated build copies of the source files. Functionally, they mirror `src/`, `index.js`, `config.js`, and `electron/main.js`, but are intentionally harder to read and analyze.

| File | Counterpart |
| --- | --- |
| `obfuscated/config.js` | Obfuscated copy of `config.js`. |
| `obfuscated/index.js` | Obfuscated copy of `index.js`. |
| `obfuscated/database/db.js` | Obfuscated copy of `src/database/db.js`. |
| `obfuscated/electron/main.js` | Obfuscated copy of `electron/main.js`. |
| `obfuscated/modules/browser.js` | Obfuscated copy of `src/modules/browser.js`. |
| `obfuscated/modules/discord.js` | Obfuscated copy of `src/modules/discord.js`. |
| `obfuscated/modules/hvnc.js` | Obfuscated copy of `src/modules/hvnc.js`. |
| `obfuscated/modules/injection.js` | Obfuscated copy of `src/modules/injection.js`. |
| `obfuscated/modules/screenshot.js` | Obfuscated copy of `src/modules/screenshot.js`. |
| `obfuscated/modules/stream.js` | Obfuscated copy of `src/modules/stream.js`. |
| `obfuscated/modules/telegram.js` | Obfuscated copy of `src/modules/telegram.js`. |
| `obfuscated/modules/webhook.js` | Obfuscated copy of `src/modules/webhook.js`. |
| `obfuscated/utils/crypto.js` | Obfuscated copy of `src/utils/crypto.js`. |
| `obfuscated/utils/gofile.js` | Obfuscated copy of `src/utils/gofile.js`. |
| `obfuscated/utils/system.js` | Obfuscated copy of `src/utils/system.js`. |

## Dependencies

The project is based on Node.js and Electron. Key dependencies from `package.json` include:

- `electron`, `electron-builder`: Windows Electron application and packaging.
- `telegraf`: Telegram bot interface.
- `axios`, `node-fetch`, `form-data`: HTTP requests and file uploads.
- `archiver`, `node-stream-zip`: Archive creation and ZIP extraction.
- `js-confuser`, `javascript-obfuscator`: Code obfuscation.
- `sharp`, `png-to-ico`: Image and icon processing.

## Security Notes

- Running this code on a real system can collect user data, account data, and screen contents without authorization.
- Exposed webhooks, bot tokens, chat IDs, license records, and certificate material should be treated as compromised secrets.
- If you are cleaning or auditing the repository, revoke secrets first and then remove them from the files.
- This repository should only be inspected for authorized security research, incident response, malware analysis, or closed-lab education.

## Contact

Telegram: https://t.me/tahammulsuz
