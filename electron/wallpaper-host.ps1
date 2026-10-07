param(
  [Int64]$WindowHandle = 0,
  [Int32]$Width = 0,
  [Int32]$Height = 0,
  [Int32]$X = 0,
  [Int32]$Y = 0,
  [switch]$ProbeOnly,
  [switch]$CheckOnly,
  [Int64]$ExpectedParent = 0,
  [Int64]$ExpectedIcons = 0
)

$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class GenshinWallpaperHost {
    private delegate bool EnumWindowsProc(IntPtr window, IntPtr extra);
    private const uint SWP_NOACTIVATE = 0x0010;
    private const uint SWP_SHOWWINDOW = 0x0040;
    private const uint SWP_FRAMECHANGED = 0x0020;
    private const uint SWP_NOSIZE = 0x0001;
    private const uint SWP_NOMOVE = 0x0002;
    private static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
    private const int GWL_STYLE = -16, GWL_EXSTYLE = -20;
    private const long WS_CHILD = 0x40000000L, WS_POPUP = 0x80000000L;
    private const long WS_CAPTION = 0x00C00000L, WS_THICKFRAME = 0x00040000L;
    private const long WS_EX_LAYERED = 0x00080000L, WS_EX_NOREDIRECTIONBITMAP = 0x00200000L;

    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int x, y; }

    public class Result {
        public bool attached;
        public string layout;
        public long parent, worker, icons;
        public int x, y, width, height;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindow(string className, string title);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string className, string title);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr extra);
    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")]
    private static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetParent(IntPtr child, IntPtr parent);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr(IntPtr window, int index, IntPtr value);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetLayeredWindowAttributes(IntPtr window, uint color, byte alpha, uint flags);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern int MapWindowPoints(IntPtr from, IntPtr to, ref Point point, uint count);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr awareness);
    [DllImport("kernel32.dll", EntryPoint = "SetLastError")]
    private static extern void ClearError(uint error);

    private static void SetStyle(IntPtr window, int index, long value) {
        ClearError(0);
        var previous = SetWindowLongPtr(window, index, new IntPtr(value));
        var error = Marshal.GetLastWin32Error();
        if (previous == IntPtr.Zero && error != 0) throw new Win32Exception(error, "SetWindowLongPtr failed");
    }

    public static Result Attach(IntPtr window, int x, int y, int width, int height, bool probeOnly) {
        if (!probeOnly && (!IsWindow(window) || width <= 0 || height <= 0))
            throw new ArgumentException("Invalid wallpaper window or dimensions");
        // Coordinates received from Electron are physical pixels.
        try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) { }
        var progman = FindWindow("Progman", null);
        if (progman == IntPtr.Zero) throw new InvalidOperationException("Windows desktop (Progman) was not found");

        IntPtr ignored;
        if (SendMessageTimeout(progman, 0x052C, new IntPtr(0xD), new IntPtr(1), 0, 1000, out ignored) == IntPtr.Zero)
            throw new InvalidOperationException("Windows Explorer did not respond to desktop initialization");

        IntPtr worker = IntPtr.Zero, icons = IntPtr.Zero;
        bool raised = false;
        for (int attempt = 0; attempt < 10; attempt++) {
            icons = FindWindowEx(progman, IntPtr.Zero, "SHELLDLL_DefView", null);
            worker = FindWindowEx(progman, IntPtr.Zero, "WorkerW", null);
            raised = (GetWindowLongPtr(progman, GWL_EXSTYLE).ToInt64() & WS_EX_NOREDIRECTIONBITMAP) != 0;
            raised = raised || (worker != IntPtr.Zero && icons != IntPtr.Zero);
            if (raised && icons != IntPtr.Zero && worker != IntPtr.Zero) break;
            worker = IntPtr.Zero;
            EnumWindows((top, extra) => {
                var shell = FindWindowEx(top, IntPtr.Zero, "SHELLDLL_DefView", null);
                if (shell != IntPtr.Zero) {
                    var candidate = FindWindowEx(IntPtr.Zero, top, "WorkerW", null);
                    if (candidate != IntPtr.Zero && FindWindowEx(candidate, IntPtr.Zero, "SHELLDLL_DefView", null) == IntPtr.Zero) {
                        worker = candidate;
                        icons = shell;
                        return false;
                    }
                }
                return true;
            }, IntPtr.Zero);
            if (!raised && worker != IntPtr.Zero) break;
            System.Threading.Thread.Sleep(100);
        }
        if (worker == IntPtr.Zero || icons == IntPtr.Zero || (raised && GetParent(icons) != progman))
            throw new InvalidOperationException("A compatible Windows desktop wallpaper layer was not found");

        // Newer Windows desktops compose layered siblings beneath DefView.
        // A child of Progman at HWND_BOTTOM would sit behind the system wallpaper.
        var parent = raised ? progman : worker;
        var result = new Result { attached = false, layout = raised ? "raised-desktop" : "classic-workerw", parent = parent.ToInt64(), worker = worker.ToInt64(), icons = icons.ToInt64(), x = x, y = y, width = width, height = height };
        if (probeOnly) return result;

        long originalStyle = GetWindowLongPtr(window, GWL_STYLE).ToInt64();
        long originalExtendedStyle = GetWindowLongPtr(window, GWL_EXSTYLE).ToInt64();
        var originalParent = GetParent(window);
        try {
            // Electron's frameless top-level window still carries caption bits.
            // After SetParent, Windows adds non-client borders unless they are removed.
            SetStyle(window, GWL_STYLE, (originalStyle | WS_CHILD) & ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME));
            if (raised) {
                SetStyle(window, GWL_EXSTYLE, originalExtendedStyle | WS_EX_LAYERED);
                if (!SetLayeredWindowAttributes(window, 0, 255, 2))
                    throw new Win32Exception(Marshal.GetLastWin32Error(), "Layered wallpaper initialization failed");
            }
            if (GetParent(window) != parent) {
                ClearError(0);
                SetParent(window, parent);
                if (GetParent(window) != parent)
                    throw new Win32Exception(Marshal.GetLastWin32Error(), "SetParent failed");
            }
            var location = new Point { x = x, y = y };
            ClearError(0);
            var mapping = MapWindowPoints(IntPtr.Zero, parent, ref location, 1);
            if (mapping == 0 && Marshal.GetLastWin32Error() != 0)
                throw new Win32Exception(Marshal.GetLastWin32Error(), "MapWindowPoints failed");
            if (!SetWindowPos(window, raised ? icons : HWND_BOTTOM, location.x, location.y, width, height, SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Wallpaper positioning failed");
            if (raised && !SetWindowPos(worker, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOACTIVATE | SWP_NOMOVE | SWP_NOSIZE))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Desktop wallpaper ordering failed");
            result.attached = true;
            return result;
        } catch {
            SetParent(window, originalParent);
            SetStyle(window, GWL_STYLE, originalStyle);
            SetStyle(window, GWL_EXSTYLE, originalExtendedStyle);
            throw;
        }
    }

    public static object Check(IntPtr window, IntPtr parent, IntPtr icons) {
        bool valid = IsWindow(window);
        return new { windowValid = valid, attached = valid && IsWindow(parent) && IsWindow(icons) && GetParent(window) == parent };
    }
}
'@

try {
  if ($CheckOnly) {
    [GenshinWallpaperHost]::Check([IntPtr]::new($WindowHandle), [IntPtr]::new($ExpectedParent), [IntPtr]::new($ExpectedIcons)) | ConvertTo-Json -Compress
  } else {
    [GenshinWallpaperHost]::Attach([IntPtr]::new($WindowHandle), $X, $Y, $Width, $Height, $ProbeOnly.IsPresent) | ConvertTo-Json -Compress
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.ToString())
  exit 1
}
