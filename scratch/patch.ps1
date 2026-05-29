$gamePath = "c:\Users\quizztssr\Desktop\quizztssr-main\quizztssr-main\js\game.js"
$logicPath = "c:\Users\quizztssr\Desktop\quizztssr-main\quizztssr-main\scratch\online_logic.js"

$allLines = Get-Content $gamePath -Encoding UTF8
$newLogic = Get-Content $logicPath -Encoding UTF8

# Find start line (line with "// DUEL EN LIGNE V2")
$startLine = -1
$endLine = -1

for ($i = 0; $i -lt $allLines.Count; $i++) {
    if ($allLines[$i] -match "DUEL EN LIGNE V2" -and $startLine -eq -1) {
        # Go back to find the comment block
        $startLine = $i - 1
        if ($startLine -lt 0) { $startLine = 0 }
    }
    if ($allLines[$i] -match "Adapter wizLaunch" -and $startLine -ne -1 -and $endLine -eq -1) {
        $endLine = $i
    }
}

Write-Host "Start: $startLine, End: $endLine, Total: $($allLines.Count)"

if ($startLine -ne -1 -and $endLine -ne -1) {
    $before = $allLines[0..($startLine - 1)]
    $after  = $allLines[$endLine..($allLines.Count - 1)]
    
    $newContent = ($before + $newLogic + $after) -join "`n"
    [IO.File]::WriteAllText($gamePath, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "Success!"
} else {
    Write-Host "Error: markers not found"
}
