param(
  [int]$Port = 3306,
  [string]$AdminUser = 'root'
)

$ErrorActionPreference = 'Stop'
$mysqlExe = 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe'
$advancedSqlPath = Join-Path $PSScriptRoot 'advanced_concepts.sql'
$demoSeedPath = Join-Path $PSScriptRoot 'advanced_concepts_demo_seed.sql'
$tempSqlPath = Join-Path $env:TEMP ("paperloom-advanced-db-{0}.sql" -f [guid]::NewGuid())

if (-not (Test-Path -LiteralPath $mysqlExe)) { throw "MySQL client not found at $mysqlExe" }
if (-not (Test-Path -LiteralPath $advancedSqlPath) -or -not (Test-Path -LiteralPath $demoSeedPath)) {
  throw 'Advanced MySQL SQL files are missing.'
}

$sql = "USE atlas_research;`r`n"
$sql += [System.IO.File]::ReadAllText($advancedSqlPath) + "`r`n"
$sql += [System.IO.File]::ReadAllText($demoSeedPath) + "`r`n"
$sql += "GRANT EXECUTE ON PROCEDURE atlas_research.sp_search_papers TO 'atlas_app'@'127.0.0.1';`r`n"
$sql += "GRANT EXECUTE ON PROCEDURE atlas_research.sp_save_paper_bookmark TO 'atlas_app'@'127.0.0.1';`r`n"

try {
  [System.IO.File]::WriteAllText($tempSqlPath, $sql, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Installing repeatable MySQL evaluation objects on 127.0.0.1:$Port. Enter the MySQL administrator password when prompted."
  & $mysqlExe "--host=127.0.0.1" "--port=$Port" "--user=$AdminUser" '--password' '--default-character-set=utf8mb4' "--execute=source $($tempSqlPath.Replace('\','/'))"
  if ($LASTEXITCODE -ne 0) { throw "Advanced MySQL installation failed with exit code $LASTEXITCODE." }
  Write-Host 'Advanced evaluation objects are installed. No paper records were changed.'
}
finally {
  if (Test-Path -LiteralPath $tempSqlPath) { Remove-Item -LiteralPath $tempSqlPath -Force }
  $sql = $null
}
