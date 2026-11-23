param($dir)
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Heami Desktop')
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$list = Get-Content -Raw -Encoding UTF8 (Join-Path $dir 'sentences.json') | ConvertFrom-Json
foreach ($rate in 0, 3) {
  foreach ($x in $list) {
    $s.Rate = $rate
    $s.SetOutputToWaveFile((Join-Path $dir ("r$rate-" + $x.id + '.wav')), $fmt)
    $s.Speak($x.text)
  }
}
$s.SetOutputToNull()
