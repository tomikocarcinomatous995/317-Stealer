# 317 NUMBER ONE / Oldblturer - Guvenlik Analizi

Bu depo, Windows/Electron tabanli bir veri toplama ve disari aktarma yazilimi icerir. Kaynak kodda Discord token toplama, tarayici verisi cikarma, ekran goruntusu alma, canli ekran aktarimi, HVNC, Discord istemcisine enjeksiyon, anti-VM/sandbox kontrolleri ve Telegram/Discord webhook uzerinden veri aktarimi gibi zararli davranislar bulunur.

Bu nedenle proje guvenli analiz, olay inceleme veya kod denetimi disinda calistirilmamalidir. Bu README calistirma veya dagitim talimati vermek icin degil, dosya yapisini ve riskleri aciklamak icin hazirlanmistir.

## Ne Ise Yarar?

Kodun amaci, Windows uzerinde calisan hedef sistemlerden kimlik, hesap, tarayici, sistem ve ekran verileri toplamak; bu verileri Telegram, Discord webhook veya dosya yukleme servisleri uzerinden uzak tarafa aktarmaktir. Ayrica lisansli "builder bot" mantigiyle kisilere ozel derleme uretme, obfuscation uygulama ve Windows icin paketleme imkani barindirir.

Tespit edilen ana islevler:

- Discord tokenlarini arar, dogrular ve hesap bilgileriyle birlikte raporlar.
- Discord istemcisine enjeksiyon yaparak oturum, sifre, 2FA ve odeme akislarini yakalamayi hedefler.
- Chromium/Firefox tabanli tarayicilardan sifre, cookie, kart ve profil verileri cikarmaya calisir.
- Ekran goruntusu ve canli ekran aktarimi saglar.
- HVNC ile gizli masaustu olusturma, uygulama baslatma, goruntu ve girdi aktarma mekanizmalari icerir.
- Sistem bilgisi, VPN, oyun/launcher/cuzdan varligi ve sanal makine/sandbox izleri toplar.
- Telegram botu ve Discord webhooklari ile veri aktarimi yapar.
- Kod karartma, paketleme ve imzalama adimlari ile tespitten kacmayi hedefleyen build sureci barindirir.

## Nasil Calistirilir?

Bu proje calistirilmamalidir. Kod, kimlik bilgisi hirsizligi ve yetkisiz veri aktarimi icin kullanilabilecek ozellikler icerir. Guvenli analiz gerekiyorsa yalnizca yetkili bir ortamda, ag baglantisi kapali izole bir sanal makinede ve statik analiz araclariyla incelenmelidir.

Guvenli inceleme onerileri:

- Gercek makinede, gercek kullanici profiliyle veya internete acik ortamda calistirmayin.
- `.env`, `config.js` ve `data/database.json` icindeki token, webhook, chat id ve musteri verilerini gizli kabul edin.
- Depoda gorunen webhook, bot tokeni, lisans anahtari veya sertifika kullanilmissa iptal edin ve yenileyin.
- `build/cert.pfx` gibi imzalama materyallerini guvenli kabul etmeyin; sizinti riski varsa iptal edin.
- Dinamik analiz gerekiyorsa sadece malware analiz laboratuvari kosullarinda, cikis trafigi engellenmis snapshot'li VM kullanin.

## Dosya ve Klasorler

### Kok Dizin

| Dosya | Aciklama |
| --- | --- |
| `.env` | Ortam degiskenleri icin kullanilir. Bot tokeni, webhook veya benzeri gizli bilgiler icerebilir. |
| `.gitignore` | Git tarafindan yok sayilacak dosya ve klasorleri tanimlar. |
| `package.json` | Node/Electron paket bilgileri, bagimliliklar, script'ler ve electron-builder Windows paketleme ayarlari. |
| `package-lock.json` | Bagimliliklarin kilitlenmis surum agaci. |
| `config.js` | Telegram, Discord webhook, stream sunucusu, tarayici yollari, Discord yollari, VPN/oyun/launcher/cuzdan tespiti ve anti-VM/sandbox ayarlari. |
| `index.js` | Ana calisma akisini yonetir: sistem bilgisi toplama, Discord token arama, enjeksiyon, tarayici verisi toplama, ekran goruntusu, stream/HVNC ve veri aktarimi. |
| `license-bot.js` | Telegram tabanli lisans ve builder botu. Musteri ayarlari, lisans anahtarlari, webhook/chat id/exe adi ve derleme kuyrugu yonetimi icerir. |
| `stream-server.js` | Uzak ekran/HVNC oturumlari icin relay ve web panel sunucusu. Aktif oturumlari, ekran karelerini, sohbeti ve uzaktan komutlari yonetir. |
| `README_TR.md` | Turkce guvenli analiz ve dosya aciklama dokumani. |
| `README_EN.md` | English safe-analysis and file reference document. |

### `src/`

| Dosya | Aciklama |
| --- | --- |
| `src/database/db.js` | JSON tabanli musteri, lisans anahtari, build ve admin kayit yoneticisi. |
| `src/modules/browser.js` | Tarayici verisi cikarma modulu. Gerekirse gecici Python ortami indirir, paketler kurar, profil verilerini toplar ve arsivler. |
| `src/modules/discord.js` | Discord token arama, sifre cozme, token dogrulama, hesap/rozeti/arkadas/sunucu bilgisi toplama islevleri. |
| `src/modules/hvnc.js` | Gizli Windows masaustu olusturma, uygulama baslatma, ekran yakalama ve uzaktan girdi aktarma mantigi. |
| `src/modules/injection.js` | Discord Electron istemcisine kod enjekte ederek oturum ve hassas islem verilerini yakalamayi hedefleyen modul. |
| `src/modules/screenshot.js` | PowerShell ile coklu ekran goruntusu alip gecici PNG dosyasi olusturur. |
| `src/modules/stream.js` | Electron desktopCapturer tabanli canli ekran aktarimi istemcisi ve destek sohbeti penceresi mantigi. |
| `src/modules/telegram.js` | Toplanan verileri Telegram Bot API uzerinden mesaj veya dosya/link olarak aktarmak icin kullanilir. |
| `src/modules/webhook.js` | Discord webhook mesajlari, embed olusturma, dosya/link ekleme ve raporlama mantigi. |
| `src/utils/crypto.js` | Base64, DPAPI ve Chrome/Edge AES-GCM sifre cozme yardimcilari; ayrica basit XOR string cozucu. |
| `src/utils/gofile.js` | Gofile.io ve alternatif dosya yukleme servislerine arsiv yukleme yardimcisi. |
| `src/utils/system.js` | Sistem bilgisi, IP/ulke, VPN tespiti, path genisletme, process sonlandirma ve anti-VM/sandbox yardimcilari. |

### `electron/`

| Dosya | Aciklama |
| --- | --- |
| `electron/main.js` | Electron ana sureci. Arka planda pencere gizleme, ekran yakalama, loglama, `index.js` yukleme ve ana akis baslatma islevleri icerir. |

### `build/`

| Dosya | Aciklama |
| --- | --- |
| `build/clean.js` | `obfuscated`, `dist` ve ilgili build kalintilarini temizlemeye calisir. |
| `build/obfuscator.js` | `src`, `index.js`, `config.js` ve Electron dosyalarina iki asamali JavaScript obfuscation uygular. |
| `build/sign-exe.js` | `dist` icindeki Windows EXE dosyasini PFX sertifikasi ve signtool ile imzalamaya calisir. |
| `build/cert.pfx` | Windows kod imzalama sertifikasi dosyasi. Gizli ve hassas kabul edilmelidir. |
| `build/resources/README.md` | Electron icon ve marka kaynaklari icin genel notlar. |
| `build/resources/installer.nsh` | NSIS installer hook/makro dosyasi. |
| `build/resources/icon.ico` | Uygulama icon dosyasi. |
| `build/resources/icon_default.ico` | Varsayilan icon dosyasi. |

### `data/`

| Dosya | Aciklama |
| --- | --- |
| `data/database.json` | Musteri, lisans anahtari, build ve admin kayitlarini tutar. Webhook URL'leri, Telegram ID'leri ve benzeri hassas veriler icerebilir. |

### `obfuscated/`

Bu klasor kaynak dosyalarin karartilmis build kopyalarini icerir. Islev olarak `src/`, `index.js`, `config.js` ve `electron/main.js` ile ayni rolleri tasir, fakat okunmasi ve analiz edilmesi zorlastirilmistir.

| Dosya | Karsiligi |
| --- | --- |
| `obfuscated/config.js` | `config.js` karartilmis kopyasi. |
| `obfuscated/index.js` | `index.js` karartilmis kopyasi. |
| `obfuscated/database/db.js` | `src/database/db.js` karartilmis kopyasi. |
| `obfuscated/electron/main.js` | `electron/main.js` karartilmis kopyasi. |
| `obfuscated/modules/browser.js` | `src/modules/browser.js` karartilmis kopyasi. |
| `obfuscated/modules/discord.js` | `src/modules/discord.js` karartilmis kopyasi. |
| `obfuscated/modules/hvnc.js` | `src/modules/hvnc.js` karartilmis kopyasi. |
| `obfuscated/modules/injection.js` | `src/modules/injection.js` karartilmis kopyasi. |
| `obfuscated/modules/screenshot.js` | `src/modules/screenshot.js` karartilmis kopyasi. |
| `obfuscated/modules/stream.js` | `src/modules/stream.js` karartilmis kopyasi. |
| `obfuscated/modules/telegram.js` | `src/modules/telegram.js` karartilmis kopyasi. |
| `obfuscated/modules/webhook.js` | `src/modules/webhook.js` karartilmis kopyasi. |
| `obfuscated/utils/crypto.js` | `src/utils/crypto.js` karartilmis kopyasi. |
| `obfuscated/utils/gofile.js` | `src/utils/gofile.js` karartilmis kopyasi. |
| `obfuscated/utils/system.js` | `src/utils/system.js` karartilmis kopyasi. |

## Bagimliliklar

Proje Node.js ve Electron ekosistemine dayanir. `package.json` icindeki baslica bagimliliklar:

- `electron`, `electron-builder`: Windows Electron uygulamasi ve paketleme.
- `telegraf`: Telegram bot arayuzu.
- `axios`, `node-fetch`, `form-data`: HTTP istekleri ve dosya yukleme.
- `archiver`, `node-stream-zip`: Arsiv olusturma ve zip acma.
- `js-confuser`, `javascript-obfuscator`: Kod karartma.
- `sharp`, `png-to-ico`: Icon/gorsel isleme.

## Guvenlik Notlari

- Bu kod gercek sistemlerde calistirildiginda kullanici verilerini, hesap bilgilerini ve ekran icerigini yetkisiz bicimde toplayabilir.
- Depoda acikta duran webhooklar, bot tokenleri, chat id'leri, lisans kayitlari ve sertifika materyalleri gizli veri sayilmalidir.
- Kod analizi veya temizleme yapilacaksa once tum gizli degerleri iptal edin, ardindan dosyalardan kaldirin.
- Bu depo ancak yetkili guvenlik arastirmasi, olay mudahalesi, malware analizi veya egitim amacli kapali laboratuvar ortaminda incelenmelidir.

## Iletisim

Telegram: https://t.me/tahammulsuz
