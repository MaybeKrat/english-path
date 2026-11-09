# Starts a program in the normal user environment through an open Explorer window (see AGENTS.md).
param([Parameter(Mandatory)] [string]$File, [string]$Arguments = '', [string]$Directory = '')
$shell = New-Object -ComObject Shell.Application
$explorer = @($shell.Windows()) | Where-Object { $_.FullName -like '*\explorer.exe' } | Select-Object -First 1
if (-not $explorer) { throw 'No open Explorer window.' }
$explorer.Document.Application.ShellExecute($File, $Arguments, $Directory, 'open', 1)
