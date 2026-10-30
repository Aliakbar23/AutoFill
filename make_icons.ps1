Add-Type -AssemblyName System.Drawing

function New-Icon {
    param([int]$Size, [string]$Path)
    $bmp = [System.Drawing.Bitmap]::new($Size, $Size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # --- background: rounded square, gradient indigo -> violet ---
    $rect = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
    $c1 = [System.Drawing.Color]::FromArgb(255, 99, 102, 241)   # indigo-500
    $c2 = [System.Drawing.Color]::FromArgb(255, 139, 92, 246)   # violet-500
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $c1, $c2, [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal)

    $r = [int]($Size * 0.22)
    $gp = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $w = $Size; $h = $Size
    $gp.AddArc(0, 0, (2 * $r), (2 * $r), 180, 90)
    $gp.AddArc(($w - 2 * $r), 0, (2 * $r), (2 * $r), 270, 90)
    $gp.AddArc(($w - 2 * $r), ($h - 2 * $r), (2 * $r), (2 * $r), 0, 90)
    $gp.AddArc(0, ($h - 2 * $r), (2 * $r), (2 * $r), 90, 90)
    $gp.CloseFigure()
    $g.FillPath($brush, $gp)

    # --- logo: petir (lightning bolt) putih ---
    $f = $Size / 128.0
    $raw = @(@(68,24),@(28,72),@(64,72),@(60,104),@(100,56),@(64,56))
    $pts = [System.Drawing.PointF[]]::new($raw.Count)
    for ($i = 0; $i -lt $raw.Count; $i++) {
        $pts[$i] = [System.Drawing.PointF]::new([float]($raw[$i][0] * $f), [float]($raw[$i][1] * $f))
    }
    $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $g.FillPolygon($white, $pts)

    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "OK $Path ($([int](Get-Item $Path).Length) bytes)"
}

# Path folder ekstensi = folder script ini (jalan di PC mana pun)
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
New-Icon -Size 16  -Path "$dir\icons\icon16.png"
New-Icon -Size 32  -Path "$dir\icons\icon32.png"
New-Icon -Size 48  -Path "$dir\icons\icon48.png"
New-Icon -Size 128 -Path "$dir\icons\icon128.png"
