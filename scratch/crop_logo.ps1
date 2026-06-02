Add-Type -AssemblyName System.Drawing

$src = Join-Path $PSScriptRoot '..\LOGO_TSSRQUIZZ.png'
$img = [System.Drawing.Bitmap]::new($src)
$width  = $img.Width
$height = $img.Height

$minX = $width;  $minY = $height
$maxX = 0;       $maxY = 0

for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $pixel = $img.GetPixel($x, $y)
        if ($pixel.A -gt 80) {
            if ($x -lt $minX) { $minX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$pad  = 12
$minX = [Math]::Max(0, $minX - $pad)
$minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($width  - 1, $maxX + $pad)
$maxY = [Math]::Min($height - 1, $maxY + $pad)

$cropW = $maxX - $minX + 1
$cropH = $maxY - $minY + 1

Write-Host "Original : $($width)x$($height)"
Write-Host "Cropped  : $($cropW)x$($cropH)"

$cropped = [System.Drawing.Bitmap]::new($cropW, $cropH)
$g = [System.Drawing.Graphics]::FromImage($cropped)
$src_rect  = [System.Drawing.Rectangle]::new($minX, $minY, $cropW, $cropH)
$dst_rect  = [System.Drawing.Rectangle]::new(0, 0, $cropW, $cropH)
$g.DrawImage($img, $dst_rect, $src_rect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$img.Dispose()

$cropped.Save($src, [System.Drawing.Imaging.ImageFormat]::Png)
$cropped.Dispose()
Write-Host "Saved!"
