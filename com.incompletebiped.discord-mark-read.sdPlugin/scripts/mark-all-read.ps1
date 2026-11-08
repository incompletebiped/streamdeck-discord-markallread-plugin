# Focuses Discord or Vesktop and marks servers read with the app's own shortcuts.
# Shift+Esc marks the current server. Ctrl+Alt+Up/Down changes servers.
# Auto uses the foreground client, or the topmost visible one when several are open.
# Aborts without sending keys when that window is not in front.
#Requires -Version 5.1
param(
    [int]$ServerCount = 60,
    [int]$DelayMs = 120,
    [string]$ProcessName = "Auto",
    [string]$ClimbToTop = "true",
    [switch]$SelfTest,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

function Write-Line([string]$Text) {
    [Console]::Out.WriteLine($Text)
    [Console]::Out.Flush()
}

function Clamp-Int([int]$Value, [int]$Min, [int]$Max) {
    if ($Value -lt $Min) { return $Min }
    if ($Value -gt $Max) { return $Max }
    return $Value
}

function Get-Steps([int]$Count, [bool]$Climb) {
    $steps = New-Object System.Collections.Generic.List[string]
    if ($Climb) {
        $climbCount = $Count + 10
        for ($i = 0; $i -lt $climbCount; $i++) {
            $steps.Add("CLIMB")
        }
        $steps.Add("LEAVE_HOME")
    }
    for ($i = 1; $i -le $Count; $i++) {
        $steps.Add("MARK")
        if ($i -lt $Count) {
            $steps.Add("NEXT")
        }
    }
    return $steps
}

$allowed = @("Auto", "Discord", "DiscordPTB", "DiscordCanary", "vesktop")
if ($allowed -notcontains $ProcessName) {
    Write-Line "ERROR PROCESS Unsupported app"
    exit 1
}

$ServerCount = Clamp-Int $ServerCount 1 200
$DelayMs = Clamp-Int $DelayMs 40 1000
$Climb = $ClimbToTop -eq "true" -or $ClimbToTop -eq "1"

try {
if (-not ("DiscordMarkRead.Native" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

namespace DiscordMarkRead {
public static class Native {
public const uint INPUT_KEYBOARD = 1;
public const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
public const uint KEYEVENTF_KEYUP = 0x0002;
public const ushort VK_SHIFT = 0x10;
public const ushort VK_CONTROL = 0x11;
public const ushort VK_MENU = 0x12;
public const ushort VK_ESCAPE = 0x1B;
public const ushort VK_UP = 0x26;
public const ushort VK_DOWN = 0x28;

[DllImport("user32.dll")]
public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

[DllImport("user32.dll")]
public static extern uint MapVirtualKey(uint uCode, uint uMapType);

[DllImport("user32.dll")]
public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);

[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

[DllImport("user32.dll")]
public static extern bool IsIconic(IntPtr hWnd);

[DllImport("user32.dll")]
public static extern IntPtr GetForegroundWindow();

[DllImport("user32.dll")]
public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);

[DllImport("user32.dll")]
public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

[DllImport("kernel32.dll")]
public static extern uint GetCurrentThreadId();

[DllImport("user32.dll")]
public static extern bool BringWindowToTop(IntPtr hWnd);

[DllImport("user32.dll")]
public static extern IntPtr GetTopWindow(IntPtr hWnd);

[DllImport("user32.dll")]
public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

[DllImport("user32.dll")]
public static extern bool IsWindowVisible(IntPtr hWnd);

[StructLayout(LayoutKind.Sequential)]
public struct KEYBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
}

[StructLayout(LayoutKind.Sequential)]
public struct MOUSEINPUT {
    public int dx;
    public int dy;
    public uint mouseData;
    public uint dwFlags;
    public uint time;
    public IntPtr dwExtraInfo;
}

[StructLayout(LayoutKind.Explicit)]
public struct INPUTUNION {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KEYBDINPUT ki;
}

[StructLayout(LayoutKind.Sequential)]
public struct INPUT {
    public uint type;
    public INPUTUNION U;
}

public static int InputSize() {
    return System.Runtime.InteropServices.Marshal.SizeOf(typeof(INPUT));
}

public static void ReleaseModifiers() {
    keybd_event((byte)VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    keybd_event((byte)VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    keybd_event((byte)VK_MENU, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
}

public static uint ForegroundProcessId() {
    uint pid;
    GetWindowThreadProcessId(GetForegroundWindow(), out pid);
    return pid;
}

public static uint WindowProcessId(IntPtr hWnd) {
    uint pid;
    GetWindowThreadProcessId(hWnd, out pid);
    return pid;
}

public static bool FocusWindow(IntPtr hWnd) {
    if (hWnd == IntPtr.Zero) return false;
    if (IsIconic(hWnd)) ShowWindow(hWnd, 9);
    else ShowWindow(hWnd, 5);

    uint unused;
    IntPtr foreground = GetForegroundWindow();
    uint foregroundThread = GetWindowThreadProcessId(foreground, out unused);
    uint targetThread = GetWindowThreadProcessId(hWnd, out unused);
    uint currentThread = GetCurrentThreadId();

    bool attachedForeground = false;
    bool attachedTarget = false;
    if (foregroundThread != 0 && foregroundThread != currentThread) {
        attachedForeground = AttachThreadInput(currentThread, foregroundThread, true);
    }
    if (targetThread != 0 && targetThread != currentThread && targetThread != foregroundThread) {
        attachedTarget = AttachThreadInput(currentThread, targetThread, true);
    }

    BringWindowToTop(hWnd);
    SetForegroundWindow(hWnd);

    if (attachedTarget) AttachThreadInput(currentThread, targetThread, false);
    if (attachedForeground) AttachThreadInput(currentThread, foregroundThread, false);

    return GetForegroundWindow() == hWnd;
}

public static uint Key(ushort vk, bool up, bool extended) {
    INPUT[] inputs = new INPUT[1];
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].U.ki.wVk = vk;
    inputs[0].U.ki.wScan = (ushort)MapVirtualKey(vk, 0);
    uint flags = 0;
    if (up) flags |= KEYEVENTF_KEYUP;
    if (extended) flags |= KEYEVENTF_EXTENDEDKEY;
    inputs[0].U.ki.dwFlags = flags;
    return SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
}
}
}
"@
}
}
catch {
    Write-Line ("ERROR FAILED " + $_.Exception.Message)
    exit 1
}

function Send-Chord([uint16[]]$Keys, [bool]$Arrows) {
    foreach ($vk in $Keys) {
        $extended = $Arrows -and ($vk -eq 0x26 -or $vk -eq 0x28)
        $sent = [DiscordMarkRead.Native]::Key($vk, $false, $extended)
        if ($sent -ne 1) {
            throw "SendInput did not deliver a key."
        }
    }
    Start-Sleep -Milliseconds 30
    for ($i = $Keys.Length - 1; $i -ge 0; $i--) {
        $vk = $Keys[$i]
        $extended = $Arrows -and ($vk -eq 0x26 -or $vk -eq 0x28)
        [void][DiscordMarkRead.Native]::Key($vk, $true, $extended)
    }
    $rest = $DelayMs - 30
    if ($rest -lt 20) { $rest = 20 }
    Start-Sleep -Milliseconds $rest
}

function Find-ClientWindow([string]$Name) {
    $names = @($Name)
    if ($Name -eq "Auto") {
        $names = @("vesktop", "Discord", "DiscordPTB", "DiscordCanary")
    }

    $candidates = New-Object System.Collections.Generic.List[System.Diagnostics.Process]
    foreach ($name in $names) {
        foreach ($proc in @(Get-Process -Name $name -ErrorAction SilentlyContinue)) {
            if ($null -ne $proc -and $proc.MainWindowHandle -ne [IntPtr]::Zero -and $proc.MainWindowTitle) {
                $candidates.Add($proc)
            }
        }
    }

    if ($candidates.Count -eq 0) {
        return $null
    }

    $foreground = [DiscordMarkRead.Native]::ForegroundProcessId()
    foreach ($candidate in $candidates) {
        if ([uint32]$candidate.Id -eq $foreground) {
            return $candidate
        }
    }

    if ($candidates.Count -eq 1) {
        return $candidates[0]
    }

    $hwnd = [DiscordMarkRead.Native]::GetTopWindow([IntPtr]::Zero)
    for ($guard = 0; $guard -lt 512 -and $hwnd -ne [IntPtr]::Zero; $guard++) {
        if ([DiscordMarkRead.Native]::IsWindowVisible($hwnd) -and -not [DiscordMarkRead.Native]::IsIconic($hwnd)) {
            $owner = [DiscordMarkRead.Native]::WindowProcessId($hwnd)
            foreach ($candidate in $candidates) {
                if ([uint32]$candidate.Id -eq $owner) {
                    return $candidate
                }
            }
        }
        $hwnd = [DiscordMarkRead.Native]::GetWindow($hwnd, [uint32]2)
    }

    return $null
}

function Focus-Discord([IntPtr]$Window) {
    for ($try = 0; $try -lt 8; $try++) {
        [DiscordMarkRead.Native]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
        [DiscordMarkRead.Native]::keybd_event(0x12, 0, 0x0002, [UIntPtr]::Zero)
        if ([DiscordMarkRead.Native]::FocusWindow($Window)) {
            return $true
        }
        Start-Sleep -Milliseconds 60
    }
    return $false
}

if ($SelfTest) {
    $size = [DiscordMarkRead.Native]::InputSize()
    if ($size -ne 40 -and $size -ne 28) {
        Write-Line "ERROR INPUT Unexpected INPUT size $size"
        exit 1
    }
    Write-Line "INFO size=$size count=$ServerCount delay=$DelayMs climb=$Climb"
    foreach ($step in (Get-Steps $ServerCount $Climb)) {
        Write-Line "STEP $step"
    }
    Write-Line "DONE"
    exit 0
}

$window = Find-ClientWindow $ProcessName

if (-not $window) {
    Write-Line "ERROR NOT_RUNNING Discord or Vesktop is not open"
    exit 2
}

if ($CheckOnly) {
    Write-Line ("INFO found process=" + $window.ProcessName + " pid=" + $window.Id + " title=" + $window.MainWindowTitle)
    Write-Line "DONE"
    exit 0
}

$steps = Get-Steps $ServerCount $Climb
$marked = 0
try {
    Write-Line "INFO focusing"
    if (-not (Focus-Discord ([IntPtr]$window.MainWindowHandle))) {
        Write-Line "ERROR FOCUS Could not focus the app"
        exit 3
    }
    Start-Sleep -Milliseconds 200
    if ([DiscordMarkRead.Native]::ForegroundProcessId() -ne [uint32]$window.Id) {
        Write-Line "ERROR FOCUS The app did not stay in front"
        exit 3
    }
    Write-Line "INFO focused"

    foreach ($step in $steps) {
        if ([DiscordMarkRead.Native]::ForegroundProcessId() -ne [uint32]$window.Id) {
            Write-Line "ERROR FOCUS The app lost focus"
            exit 3
        }
        switch ($step) {
            "CLIMB" { Send-Chord @([uint16]0x11, [uint16]0x12, [uint16]0x26) $true }
            "LEAVE_HOME" { Send-Chord @([uint16]0x11, [uint16]0x12, [uint16]0x28) $true }
            "NEXT" { Send-Chord @([uint16]0x11, [uint16]0x12, [uint16]0x28) $true }
            "MARK" {
                Send-Chord @([uint16]0x10, [uint16]0x1B) $false
                $marked++
                Write-Line "PROGRESS $marked $ServerCount"
            }
            default { throw "Unknown step $step" }
        }
    }
}
catch {
    Write-Line ("ERROR FAILED " + $_.Exception.Message)
    exit 1
}
finally {
    [DiscordMarkRead.Native]::ReleaseModifiers()
}

Write-Line "DONE"
exit 0
