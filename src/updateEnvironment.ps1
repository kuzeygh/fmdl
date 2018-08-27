param(
  [string]$CertPath,
  [int]$Port,
  [switch]$EnableProxy,
  [switch]$Debug
)

function Out-Info ($Message) {
  if ($Debug) {
    Write-Host -ForegroundColor "DarkGray" $Message
  }
}
function Out-Error ($Message) {
  if ($Debug) {
    Write-Host -ForegroundColor "Red" $Message
  }
}

function Refresh-InternetOptions {
  $Signature = @'
[DllImport("wininet.dll", SetLastError = true, CharSet=CharSet.Auto)]
public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
'@

  $INTERNET_OPTION_SETTINGS_CHANGED = 39
  $INTERNET_OPTION_REFRESH = 37
  $Type = Add-Type -MemberDefinition $Signature -Name wininet -Namespace pinvoke -Passthru
  $SettingsChanged = $Type::InternetSetOption(0,$INTERNET_OPTION_SETTINGS_CHANGED,0,0)
  $OptionsRefreshed = $Type::InternetSetOption(0,$INTERNET_OPTION_REFRESH,0,0)
  return $SettingsChanged -and $OptionsRefreshed
}

$InternetSettingsKey = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"

if ($CertPath) {
  Out-Info "importing root cert $CertPath..."
  Import-Certificate -FilePath $CertPath -CertStoreLocation Cert:\\CurrentUser\\Root | Out-Null
}

if ($EnableProxy -and $Port) {
  Out-Info "enabling HTTP proxy server on port $Port..."
  Set-ItemProperty -Force -Path $InternetSettingsKey -Name ProxyEnable -Value 1
  Set-ItemProperty -Force -Path $InternetSettingsKey -Name ProxyServer -Value "localhost:$Port"
} else {
  Out-Info "disabling HTTP proxy..."
  Set-ItemProperty -Force -Path $InternetSettingsKey -Name ProxyEnable -Value 0
  Remove-ItemProperty -Force -Path $InternetSettingsKey -Name ProxyServer
}

if (Refresh-InternetOptions) {
  Out-Info "internet settings refreshed successfully"
} else {
  Out-Error "error refreshing internet settings"
}
