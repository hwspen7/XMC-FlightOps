# Creates a trusted LAN HTTPS endpoint for iPhone Safari.
# Run this script from the project root. It never stores CA private keys in the repo.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$LanIp,
    [ValidateRange(1, 65535)]
    [int]$Port = 8443
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

try {
    $address = [System.Net.IPAddress]::Parse($LanIp)
} catch {
    throw 'LanIp must be a valid IPv4 address assigned to this Windows computer.'
}
if ($address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw 'LanIp must be an IPv4 address.'
}
$octets = $address.GetAddressBytes()
$private = ($octets[0] -eq 10) -or
    ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) -or
    ($octets[0] -eq 192 -and $octets[1] -eq 168)
if (-not $private) { throw 'LanIp must be an RFC1918 private LAN address.' }
$local = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -eq $LanIp }
if (-not $local) {
    throw "The address $LanIp is not assigned to this Windows computer. Run Get-NetIPAddress -AddressFamily IPv4 to select your LAN address."
}
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
    throw 'mkcert is missing. Install it with: winget install -e --id FiloSottile.mkcert, then reopen VS Code.'
}

$certs = Join-Path $root 'certs'
New-Item -ItemType Directory -Path $certs -Force | Out-Null
$certFile = Join-Path $certs 'cert.pem'
$keyFile = Join-Path $certs 'key.pem'

# Establish a development CA on the PC. iPhone trust must be granted manually.
& mkcert -install
if ($LASTEXITCODE -ne 0) { throw 'mkcert -install failed.' }
& mkcert -cert-file $certFile -key-file $keyFile localhost 127.0.0.1 $LanIp
if ($LASTEXITCODE -ne 0) { throw 'mkcert certificate generation failed.' }

$caRoot = (& mkcert -CAROOT | Select-Object -First 1).Trim()
$caPublic = Join-Path $caRoot 'rootCA.pem'
if (-not (Test-Path -LiteralPath $caPublic)) { throw 'mkcert public root certificate not found.' }
Copy-Item -LiteralPath $caPublic -Destination (Join-Path $certs 'iphone-root-ca.pem') -Force

$envFile = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath (Join-Path $root '.env.example') -Destination $envFile
}
$content = [System.IO.File]::ReadAllText($envFile)
$values = [ordered]@{
    HOST = '0.0.0.0'
    PORT = [string]$Port
    TLS_CERT_FILE = 'certs/cert.pem'
    TLS_KEY_FILE = 'certs/key.pem'
    XPLANE_OUTPUT_ENABLED = 'false'
}
foreach ($name in $values.Keys) {
    $line = "$name=$($values[$name])"
    $pattern = '(?m)^' + [regex]::Escape($name) + '=.*$'
    if ([regex]::IsMatch($content, $pattern)) {
        $content = [regex]::Replace($content, $pattern, $line)
    } else {
        $content = $content.TrimEnd() + "`r`n" + $line + "`r`n"
    }
}
[System.IO.File]::WriteAllText($envFile, $content, (New-Object System.Text.UTF8Encoding($false)))

Write-Host ''
Write-Host 'HTTPS configured. Simulator control output remains DISABLED.'
Write-Host "iPhone Safari URL: https://${LanIp}:$Port/?view=mobile"
Write-Host "Transfer ONLY this public CA certificate to your own iPhone: $certs\iphone-root-ca.pem"
Write-Host 'Never transfer rootCA-key.pem or certs/key.pem.'
Write-Host 'On iPhone, install the downloaded profile and enable full trust in Settings > General > About > Certificate Trust Settings.'
Write-Host 'Then run: pnpm build; pnpm start:server'
Write-Host 'Allow TCP inbound on the selected port for the Private network and local subnet only, if Windows Firewall prompts.'
