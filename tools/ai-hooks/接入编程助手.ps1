# 达妮娅桌宠 · AI 编程助手 Hook 联动安装器
# 作用：把「达妮娅桌宠事件桥」（pet-hook.mjs）注册进 AI 编程助手的 hook 配置，
#       让桌宠在 AI 思考 / 写码 / 等待批准 / 完成时自动切换工作状态动画。
# 支持：Claude Code（~/.claude/settings.json）、Codex CLI（~/.codex/config.toml 的 notify）、
#       ZCode（~/.zcode/cli/config.json 的 hooks.events）。
# 运行：右键「使用 PowerShell 运行」，或 .\接入编程助手.ps1；撤销加 -Remove。
# 只读写本地配置文件（修改前自动备份），不联网、不执行其他程序。

param(
    [string]$HookScript = "",
    [switch]$Remove
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

if ([string]::IsNullOrWhiteSpace($HookScript)) {
    $HookScript = Join-Path $PSScriptRoot "pet-hook.mjs"
}
$HookScript = [System.IO.Path]::GetFullPath($HookScript)
if (-not (Test-Path -LiteralPath $HookScript)) {
    Write-Host "找不到事件桥脚本：$HookScript" -ForegroundColor Red
    exit 1
}

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
    Write-Host "未找到 node（Claude Code / Codex / ZCode 的运行前提），请先安装 Node.js。" -ForegroundColor Red
    exit 1
}
$node = [System.IO.Path]::GetFullPath($node)

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
function Backup-File([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        Copy-Item -LiteralPath $Path -Destination "$Path.bak-danya-$stamp"
        return $true
    }
    return $false
}

function Write-TextNoBom([string]$Path, [string]$Content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

# ---------- Claude Code：~/.claude/settings.json ----------
$claudeEvents = @('UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification', 'Stop', 'SessionEnd')
function Update-ClaudeCode {
    $path = Join-Path $env:USERPROFILE ".claude\settings.json"
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "  － Claude Code：未检测到（~/.claude/settings.json 不存在），跳过" -ForegroundColor DarkYellow
        return
    }
    Backup-File $path | Out-Null
    $cfg = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $cfg.PSObject.Properties["hooks"]) {
        Add-Member -InputObject $cfg -MemberType NoteProperty -Name "hooks" -Value (New-Object PSObject) -Force
    }
    $cmd = 'node "' + $HookScript + '" claude'
    $changed = $false
    foreach ($ev in $claudeEvents) {
        $prop = $cfg.hooks.PSObject.Properties[$ev]
        if ($Remove) {
            if (-not $prop) { continue }
            $kept = @($prop.Value | Where-Object {
                $entryJson = $_ | ConvertTo-Json -Depth 8 -Compress
                -not $entryJson.Contains($HookScript)
            })
            if ($kept.Count -ne @($prop.Value).Count) {
                if ($kept.Count -eq 0) { $cfg.hooks.PSObject.Properties.Remove($ev) }
                else { $prop.Value = $kept }
                $changed = $true
            }
            continue
        }
        $entry = @{ hooks = @( @{ type = "command"; command = $cmd; timeout = 10 } ) }
        if (-not $prop) {
            Add-Member -InputObject $cfg.hooks -MemberType NoteProperty -Name $ev -Value @($entry) -Force
            $changed = $true
            continue
        }
        $existing = @($prop.Value) | Where-Object {
            $entryJson = $_ | ConvertTo-Json -Depth 8 -Compress
            $entryJson.Contains($HookScript) -and $entryJson.Contains('"claude"')
        }
        if (-not $existing) {
            $list = @($prop.Value); $list += $entry
            $prop.Value = $list
            $changed = $true
        }
    }
    if ($changed) { Write-TextNoBom $path ($cfg | ConvertTo-Json -Depth 16) }
    $verb = if ($Remove) { "已移除" } else { "已写入" }
    Write-Host ("  ✔ Claude Code：{0}（~/.claude/settings.json）" -f $verb) -ForegroundColor Green
}

# ---------- Codex CLI：~/.codex/config.toml 的 notify ----------
function Update-Codex {
    $path = Join-Path $env:USERPROFILE ".codex\config.toml"
    $line = 'notify = ["node", "' + ($HookScript -replace '\\', '/') + '", "codex"]'
    if (-not (Test-Path -LiteralPath $path)) {
        if ($Remove) { Write-Host "  － Codex CLI：未检测到，跳过" -ForegroundColor DarkYellow; return }
        New-DirectoryFor $path
        Write-TextNoBom $path ($line + "`r`n")
        Write-Host "  ✔ Codex CLI：已写入（~/.codex/config.toml）" -ForegroundColor Green
        return
    }
    Backup-File $path | Out-Null
    $lines = [System.IO.File]::ReadAllLines($path)
    $hasNotify = $false
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*notify\s*=') {
            $hasNotify = $true
            if ($lines[$i].Contains($HookScript -replace '\\', '/')) {
                if ($Remove) { $lines = $lines[0..($i-1)] + $lines[($i+1)..($lines.Count-1)]; Write-TextNoBom $path (($lines -join "`r`n") + "`r`n"); Write-Host "  ✔ Codex CLI：已移除" -ForegroundColor Green }
                else { Write-Host "  ✔ Codex CLI：配置已是最新，跳过" -ForegroundColor DarkGray }
                return
            }
            if ($Remove) { continue }
            $lines[$i] = $line
            Write-TextNoBom $path (($lines -join "`r`n") + "`r`n")
            Write-Host "  ✔ Codex CLI：已替换既有 notify 配置" -ForegroundColor Green
            return
        }
    }
    if ($Remove) { Write-Host "  － Codex CLI：未发现达妮娅 notify 配置，跳过" -ForegroundColor DarkYellow; return }
    if ($hasNotify) { return }
    # notify 是顶层键：插到文件第一行，避免落入后面的 [section] 表
    $new = @($line) + $lines
    Write-TextNoBom $path (($new -join "`r`n") + "`r`n")
    Write-Host "  ✔ Codex CLI：已写入（~/.codex/config.toml 顶部）" -ForegroundColor Green
}

function New-DirectoryFor([string]$Path) {
    $dir = Split-Path $Path -Parent
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}

# ---------- ZCode：~/.zcode/cli/config.json 的 hooks.events ----------
$zcodeEvents = @('SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop', 'PermissionRequest')
function Update-ZCode {
    $path = Join-Path $env:USERPROFILE ".zcode\cli\config.json"
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "  － ZCode：未检测到（~/.zcode/cli/config.json 不存在），跳过" -ForegroundColor DarkYellow
        return
    }
    Backup-File $path | Out-Null
    $cfg = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
    if (-not $cfg.PSObject.Properties["hooks"]) {
        Add-Member -InputObject $cfg -MemberType NoteProperty -Name "hooks" -Value (New-Object PSObject) -Force
    }
    if (-not $cfg.hooks.PSObject.Properties["enabled"]) {
        # ZCode 配置文件 hooks 默认关闭；未显式设置过才打开，绝不覆盖用户显式的 false
        Add-Member -InputObject $cfg.hooks -MemberType NoteProperty -Name "enabled" -Value $true -Force
    }
    if (-not $cfg.hooks.PSObject.Properties["events"]) {
        Add-Member -InputObject $cfg.hooks -MemberType NoteProperty -Name "events" -Value (New-Object PSObject) -Force
    }
    $changed = $false
    foreach ($ev in $zcodeEvents) {
        $prop = $cfg.hooks.events.PSObject.Properties[$ev]
        if ($Remove) {
            if (-not $prop) { continue }
            $kept = @($prop.Value | Where-Object {
                $entryJson = $_ | ConvertTo-Json -Depth 8 -Compress
                -not $entryJson.Contains($HookScript)
            })
            if ($kept.Count -ne @($prop.Value).Count) {
                if ($kept.Count -eq 0) { $cfg.hooks.events.PSObject.Properties.Remove($ev) }
                else { $prop.Value = $kept }
                $changed = $true
            }
            continue
        }
        $entry = @{ hooks = @( @{ type = "process"; command = $node; args = @($HookScript, "zcode", $ev); timeoutMs = 8000 } ) }
        if (-not $prop) {
            Add-Member -InputObject $cfg.hooks.events -MemberType NoteProperty -Name $ev -Value @($entry) -Force
            $changed = $true
            continue
        }
        $existing = @($prop.Value) | Where-Object {
            $entryJson = $_ | ConvertTo-Json -Depth 8 -Compress
            $entryJson.Contains($HookScript) -and $entryJson.Contains($ev)
        }
        if (-not $existing) {
            $list = @($prop.Value); $list += $entry
            $prop.Value = $list
            $changed = $true
        }
    }
    if ($changed) { Write-TextNoBom $path ($cfg | ConvertTo-Json -Depth 16) }
    $verb = if ($Remove) { "已移除" } else { "已写入" }
    Write-Host ("  ✔ ZCode：{0}（~/.zcode/cli/config.json）" -f $verb) -ForegroundColor Green
}

Write-Host ""
if ($Remove) { Write-Host "将从以下工具移除达妮娅 hook（配置先备份）：" -ForegroundColor Cyan }
else { Write-Host "将把达妮娅 hook 写入以下检测到的工具（配置先备份）：" -ForegroundColor Cyan }
Write-Host "  · Claude Code（~/.claude/settings.json）"
Write-Host "  · Codex CLI（~/.codex/config.toml）"
Write-Host "  · ZCode（~/.zcode/cli/config.json）"
Write-Host ""
$confirm = Read-Host "继续吗？(Y/n)"
if ($confirm -match '^[nN]') { Write-Host "已取消，未做任何修改。"; exit 0 }

Update-ClaudeCode
Update-Codex
Update-ZCode

Write-Host ""
Write-Host "完成。重启对应工具后生效；桌宠运行时即可看到她在思考 / 写码 / 等待批准 / 完成时切换动作。" -ForegroundColor Green
Write-Host "如需撤销：重新运行本脚本并加 -Remove，或恢复各配置同目录的 .bak-danya-* 备份。"
pause
