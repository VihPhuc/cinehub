Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $repoRoot 'frontend/public'

$configs = @(
    @{ Size = 192; Path = (Join-Path $publicDir 'icon-192.png'); Maskable = $false },
    @{ Size = 512; Path = (Join-Path $publicDir 'icon-512.png'); Maskable = $false },
    @{ Size = 512; Path = (Join-Path $publicDir 'icon-maskable-512.png'); Maskable = $true },
    @{ Size = 180; Path = (Join-Path $publicDir 'apple-touch-icon.png'); Maskable = $false }
)

foreach ($c in $configs) {
    $sz = [int]$c.Size
    $bmp = New-Object System.Drawing.Bitmap($sz, $sz)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($c.Maskable) {
        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 16, 21))
        $g.FillRectangle($bgBrush, 0, 0, $sz, $sz)
        $bgBrush.Dispose()
    } else {
        $g.Clear([System.Drawing.Color]::Transparent)
        $radius = [float]($sz * 0.22)
        $d = [float]($radius * 2)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0.0, 0.0, $d, $d, 180.0, 90.0)
        $path.AddArc([float]($sz - $d), 0.0, $d, $d, 270.0, 90.0)
        $path.AddArc([float]($sz - $d), [float]($sz - $d), $d, $d, 0.0, 90.0)
        $path.AddArc(0.0, [float]($sz - $d), $d, $d, 90.0, 90.0)
        $path.CloseFigure()

        $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, 16, 21))
        $g.FillPath($bgBrush, $path)
        $bgBrush.Dispose()
        $path.Dispose()
    }

    $scale = $sz / 192.0
    $p1 = New-Object System.Drawing.PointF([float](70.7 * $scale), [float](57.1 * $scale))
    $p2 = New-Object System.Drawing.PointF([float](70.7 * $scale), [float](134.9 * $scale))
    $p3 = New-Object System.Drawing.PointF([float](131.5 * $scale), [float](96.0 * $scale))
    $triangle = @($p1, $p2, $p3)

    $gradRect = New-Object System.Drawing.RectangleF([float](70.7 * $scale), [float](57.1 * $scale), [float]((131.5 - 70.7) * $scale), [float]((134.9 - 57.1) * $scale))
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $gradRect,
        [System.Drawing.Color]::FromArgb(220, 38, 38),
        [System.Drawing.Color]::FromArgb(245, 158, 11),
        [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal
    )
    $g.FillPolygon($gradBrush, $triangle)
    $gradBrush.Dispose()

    $g.Dispose()
    $bmp.Save($c.Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated $($c.Path) ($($sz)x$($sz))"
}
