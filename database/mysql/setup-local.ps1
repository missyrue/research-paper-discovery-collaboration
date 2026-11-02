param(
  [int]$Port = 3306,
  [string]$AdminUser = 'root'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$mysqlExe = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe'
$schemaPath = Join-Path $PSScriptRoot 'schema.sql'
$seedPath = Join-Path $PSScriptRoot 'seed.sql'
$envPath = Join-Path $repoRoot 'apps\web\.env.local'
$preservedVectorConfig = @()
if (Test-Path -LiteralPath $envPath) {
  $optionalConfigKeys = @('MYSQL_SSL', 'MYSQL_SSL_CA', 'OPENAI_API_KEY', 'EMBEDDING_MODEL', 'EMBEDDING_DIMENSIONS', 'MONGODB_URI', 'MONGODB_DATABASE', 'MONGODB_COLLECTION', 'ATLAS_VECTOR_INDEX')
  foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
    foreach ($key in $optionalConfigKeys) {
      if ($line.StartsWith("$key=")) { $preservedVectorConfig += $line; break }
    }
  }
}
$tempSqlPath = Join-Path $env:TEMP ("atlas-mysql-setup-{0}.sql" -f [guid]::NewGuid())

if (-not (Test-Path -LiteralPath $mysqlExe)) { throw "MySQL client not found at $mysqlExe" }
if (-not (Test-Path -LiteralPath $schemaPath) -or -not (Test-Path -LiteralPath $seedPath)) { throw 'MySQL schema or seed file is missing.' }

$randomBytes = New-Object byte[] 24
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $rng.GetBytes($randomBytes)
}
finally {
  $rng.Dispose()
}
# BitConverter is available in Windows PowerShell/.NET Framework, unlike
# RandomNumberGenerator.Fill and Convert.ToHexString (newer .NET APIs).
$appPassword = ([BitConverter]::ToString($randomBytes) -replace '-', '').ToLowerInvariant()
$authBytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $rng.GetBytes($authBytes) } finally { $rng.Dispose() }
$authSecret = [Convert]::ToBase64String($authBytes)
$escapedPassword = $appPassword.Replace("'", "''")
$sql = @"
CREATE DATABASE IF NOT EXISTS atlas_research CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'atlas_app'@'127.0.0.1' IDENTIFIED BY '$escapedPassword';
ALTER USER 'atlas_app'@'127.0.0.1' IDENTIFIED BY '$escapedPassword';
GRANT SELECT, INSERT, UPDATE, DELETE ON atlas_research.* TO 'atlas_app'@'127.0.0.1';
USE atlas_research;
"@
$sql += [System.IO.File]::ReadAllText($schemaPath) + "`r`n"
$sql += "INSERT IGNORE INTO roles (role_name) VALUES ('Researcher'), ('Admin');`r`n"
$sql += [System.IO.File]::ReadAllText($seedPath) + "`r`n"

try {
  [System.IO.File]::WriteAllText($tempSqlPath, $sql, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Setting up atlas_research on 127.0.0.1:$Port. Enter the MySQL administrator password when prompted."
  & $mysqlExe "--host=127.0.0.1" "--port=$Port" "--user=$AdminUser" '--password' "--default-character-set=utf8mb4" "--execute=source $($tempSqlPath.Replace('\','/'))"
  if ($LASTEXITCODE -ne 0) { throw "MySQL setup failed with exit code $LASTEXITCODE. No app credentials were written." }

  $envContents = @"
MYSQL_HOST=127.0.0.1
MYSQL_PORT=$Port
MYSQL_DATABASE=atlas_research
MYSQL_USER=atlas_app
MYSQL_PASSWORD=$appPassword
AUTH_SECRET=$authSecret
"@
  if ($preservedVectorConfig.Count -gt 0) { $envContents += "`r`n" + ($preservedVectorConfig -join "`r`n") + "`r`n" }
  [System.IO.File]::WriteAllText($envPath, $envContents, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Database and sample papers are ready. Local app credentials were written to apps/web/.env.local."
}
finally {
  if (Test-Path -LiteralPath $tempSqlPath) { Remove-Item -LiteralPath $tempSqlPath -Force }
  [Array]::Clear($randomBytes, 0, $randomBytes.Length)
  [Array]::Clear($authBytes, 0, $authBytes.Length)
  $appPassword = $null
  $sql = $null
}
