# 达妮娅桌宠 · AI 工具一键接入
# 作用：把达妮娅桌宠的 MCP 服务写入常见 AI 工具的配置文件（修改前自动备份）。
# 运行：右键该文件 →「使用 PowerShell 运行」，或在 PowerShell 中执行 .\接入AI工具.ps1
# 仅修改 JSON 配置文件，不执行任何网络请求，不改动其他键值。

param(
    # 达妮娅桌宠安装目录，默认使用标准安装位置
    [string]$InstallDir = ""
)

$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$defaultDir = Join-Path $env:LOCALAPPDATA "Programs\DanyaPet"
if ([string]::IsNullOrWhiteSpace($InstallDir)) { $InstallDir = $defaultDir }

$exePath = Join-Path $InstallDir "运行时\达妮娅桌宠.exe"
$mcpPath = Join-Path $InstallDir "源码\dsh-pet\standalone\mcp.mjs"

if (-not ((Test-Path -LiteralPath $exePath) -and (Test-Path -LiteralPath $mcpPath))) {
    Write-Host ""
    Write-Host "未在默认位置找到桌宠：$defaultDir" -ForegroundColor Yellow
    $InstallDir = (Read-Host "请输入达妮娅桌宠的安装目录完整路径").Trim('"', ' ')
    $exePath = Join-Path $InstallDir "运行时\达妮娅桌宠.exe"
    $mcpPath = Join-Path $InstallDir "源码\dsh-pet\standalone\mcp.mjs"
    if (-not ((Test-Path -LiteralPath $exePath) -and (Test-Path -LiteralPath $mcpPath))) {
        Write-Host "该目录下缺少 运行时\达妮娅桌宠.exe 或 源码\dsh-pet\standalone\mcp.mjs，已退出。" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "已定位桌宠：$InstallDir" -ForegroundColor Green

# MCP 服务器条目
$serverEntry = [ordered]@{
    command = $exePath
    args    = @($mcpPath)
    env     = [ordered]@{ ELECTRON_RUN_AS_NODE = "1" }
}

# 把 danya-pet 条目合并进一个 JSON 配置文件的 mcpServers 键
function Add-DanyaServer {
    param([string]$ConfigPath)

    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        return @{ status = "absent"; path = $ConfigPath }
    }

    $raw = [System.IO.File]::ReadAllText($ConfigPath)
    if ([string]::IsNullOrWhiteSpace($raw)) {
        $config = New-Object System.Management.Automation.PSObject
    }
    else {
        try { $config = $raw | ConvertFrom-Json }
        catch {
            return @{ status = "parse-error"; path = $ConfigPath }
        }
    }

    $serversProp = $config.PSObject.Properties["mcpServers"]
    if (-not $serversProp) {
        $empty = New-Object System.Management.Automation.PSObject
        Add-Member -InputObject $config -MemberType NoteProperty -Name "mcpServers" -Value $empty -Force
        $serversProp = $config.PSObject.Properties["mcpServers"]
    }
    $servers = $serversProp.Value

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = "$ConfigPath.bak-danya-$stamp"

    $existing = $servers.PSObject.Properties["danya-pet"]
    if ($existing) {
        $old = $existing.Value | ConvertTo-Json -Depth 10 -Compress
        $new = $serverEntry | ConvertTo-Json -Depth 10 -Compress
        if ($old -eq $new) {
            return @{ status = "same"; path = $ConfigPath }
        }
        Copy-Item -LiteralPath $ConfigPath -Destination $backup
        $existing.Value = $serverEntry
    }
    else {
        Copy-Item -LiteralPath $ConfigPath -Destination $backup
        Add-Member -InputObject $servers -MemberType NoteProperty -Name "danya-pet" -Value $serverEntry -Force
    }

    $json = $config | ConvertTo-Json -Depth 10
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ConfigPath, $json, $utf8NoBom)
    return @{ status = "written"; path = $ConfigPath; backup = $backup }
}

$targets = @(
    @{ name = "Claude Desktop"; path = Join-Path $env:APPDATA "Claude\claude_desktop_config.json" },
    @{ name = "Cursor";         path = Join-Path $env:USERPROFILE ".cursor\mcp.json" },
    @{ name = "Claude Code";    path = Join-Path $env:USERPROFILE ".claude.json" }
)

Write-Host ""
Write-Host "将把「danya-pet」MCP 服务写入以下检测到的工具（原文件会先备份）：" -ForegroundColor Cyan
foreach ($t in $targets) {
    $mark = if (Test-Path -LiteralPath $t.path) { "✔" } else { "－" }
    Write-Host ("  {0} {1}" -f $mark, $t.name)
}
Write-Host "  － 其他工具（ZCode / Cline 等）：生成配置片段，手动粘贴"
Write-Host ""
$confirm = Read-Host "继续吗？(Y/n)"
if ($confirm -match '^[nN]') {
    Write-Host "已取消，未做任何修改。"
    exit 0
}

foreach ($t in $targets) {
    $result = Add-DanyaServer -ConfigPath $t.path
    switch ($result.status) {
        "written"     { Write-Host ("  ✔ {0}：已写入（备份：{1}）" -f $t.name, $result.backup) -ForegroundColor Green }
        "same"        { Write-Host ("  ✔ {0}：配置已是最新的，跳过" -f $t.name) -ForegroundColor DarkGray }
        "absent"      { Write-Host ("  － {0}：未检测到，跳过" -f $t.name) -ForegroundColor DarkYellow }
        "parse-error" { Write-Host ("  ✖ {0}：JSON 解析失败，未改动，请手动处理" -f $t.name) -ForegroundColor Red }
    }
}

# 其余工具：复制配置片段到剪贴板
$snippet = $serverEntry | ConvertTo-Json -Depth 10 | Out-String
try { Set-Clipboard -Value $snippet; $clipMsg = "JSON 片段已复制到剪贴板" } catch { $clipMsg = "请手动复制下方 JSON" }
Write-Host ""
Write-Host "其他工具（ZCode / Cline / Cherry Studio 等）请在其 MCP 设置中新增名为 danya-pet 的 stdio 服务器，$clipMsg：" -ForegroundColor Cyan
Write-Host $snippet

Write-Host ""
Write-Host "完成。重启对应的 AI 工具后生效；然后试着让它「看看达妮娅在干嘛」或「让她挥挥手」。" -ForegroundColor Green
Write-Host "如需撤销：删除各配置文件里 mcpServers 的 danya-pet 键，或恢复同目录的 .bak-danya-* 备份。"
pause
