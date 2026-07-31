[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$csv = Import-Csv "chat_history_anonymized_for_hackathon.csv" -Encoding UTF8
Write-Host "Total messages:" $csv.Count
Write-Host "Unique users:" ($csv | Select-Object -Property user_id -Unique | Measure-Object).Count
Write-Host "Unique conversations:" ($csv | Select-Object -Property conversation_id -Unique | Measure-Object).Count

Write-Host "`n--- Roles ---"
$csv | Group-Object role | ForEach-Object { Write-Host "$($_.Name): $($_.Count)" }

Write-Host "`n--- Move Used ---"
$csv | Where-Object { $_.move_used -ne '' } | Group-Object move_used | Sort-Object Count -Descending | ForEach-Object { Write-Host "$($_.Name): $($_.Count)" }

Write-Host "`n--- Ratings ---"
$csv | Where-Object { $_.rating -ne '' } | Group-Object rating | ForEach-Object { Write-Host "$($_.Name): $($_.Count)" }

Write-Host "`n--- Conversation Modes ---"
$csv | Group-Object conversation_mode | ForEach-Object { Write-Host "$($_.Name): $($_.Count)" }

Write-Host "`n--- Tutor citation analysis ---"
$tutor = $csv | Where-Object { $_.role -eq 'tutor' }
$emptyCitations = $tutor | Where-Object { $_.citations -eq '[]' }
Write-Host "Total tutor msgs: $($tutor.Count)"
Write-Host "Tutor msgs with empty citations: $($emptyCitations.Count)"

Write-Host "`n--- Down ratings ---"
$downRated = $csv | Where-Object { $_.rating -eq 'down' }
Write-Host "Down-rated count: $($downRated.Count)"
foreach ($row in $downRated | Select-Object -First 30) {
    $len = [Math]::Min(150, $row.content.Length)
    Write-Host "$($row.conversation_id) | $($row.role) | $($row.content.Substring(0,$len))"
}

Write-Host "`n--- Up ratings ---"
$upRated = $csv | Where-Object { $_.rating -eq 'up' }
Write-Host "Up-rated count: $($upRated.Count)"

Write-Host "`n--- Student message count ---"
$students = $csv | Where-Object { $_.role -eq 'student' }
Write-Host "Student messages: $($students.Count)"

Write-Host "`n--- Summary requests ---"
$summaryCount = ($students | Where-Object { $_.content -like '*summary*' -or $_.content -like '*summarize*' }).Count
Write-Host "Summary keyword: $summaryCount"

Write-Host "`n--- Explain requests ---"
$explainCount = ($students | Where-Object { $_.content -like '*explain*' -or $_.content -like '*Explain*' }).Count
Write-Host "Explain keyword: $explainCount"

Write-Host "`n--- Tutor failure patterns ---"
$failKw1 = ($tutor | Where-Object { $_.content -like '*sorry*' -or $_.content -like '*apologize*' -or $_.content -like '*not found*' -or $_.content -like '*unable*' }).Count
Write-Host "Tutor English failure keywords: $failKw1"

Write-Host "`n--- Conversations with multiple turns ---"
$turnCounts = $csv | Group-Object conversation_id | ForEach-Object { 
    [PSCustomObject]@{ConvId=$_.Name; TurnCount=($_.Group | Select-Object turn_id -Unique).Count; MsgCount=$_.Group.Count} 
}
$multiTurn = $turnCounts | Where-Object { $_.TurnCount -gt 3 }
Write-Host "Conversations with >3 turns: $($multiTurn.Count)"
Write-Host "Max turns: $(($turnCounts | Measure-Object -Property TurnCount -Maximum).Maximum)"
Write-Host "Avg turns: $([Math]::Round(($turnCounts | Measure-Object -Property TurnCount -Average).Average, 1))"
Write-Host "Max msgs in conv: $(($turnCounts | Measure-Object -Property MsgCount -Maximum).Maximum)"
Write-Host "Avg msgs per conv: $([Math]::Round(($turnCounts | Measure-Object -Property MsgCount -Average).Average, 1))"

Write-Host "`n--- Day code distribution ---"
$csv | Group-Object day_code | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object { Write-Host "$($_.Name): $($_.Count)" }

Write-Host "`n--- Top conversation (most messages) ---"
$topConvs = $turnCounts | Sort-Object MsgCount -Descending | Select-Object -First 10
foreach ($c in $topConvs) {
    Write-Host "$($c.ConvId): $($c.MsgCount) msgs, $($c.TurnCount) turns"
}
