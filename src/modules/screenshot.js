const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function GetScreenShot() {
    const screenshotPath = path.join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp', `screenshot_${Date.now()}.png`);

    try {
        const powershellScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

try {
$screens = [System.Windows.Forms.Screen]::AllScreens
$totalWidth = 0
$totalHeight = 0
$screenBounds = @()

foreach ($screen in $screens) {
    $totalWidth += $screen.Bounds.Width
    if ($screen.Bounds.Height -gt $totalHeight) {
        $totalHeight = $screen.Bounds.Height
    }
    $screenBounds += $screen.Bounds
}

$bitmap = New-Object System.Drawing.Bitmap $totalWidth, $totalHeight
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

$currentX = 0
foreach ($bounds in $screenBounds) {
    $graphics.CopyFromScreen($bounds.X, $bounds.Y, $currentX, 0, $bounds.Size)
    $currentX += $bounds.Width
}

$bitmap.Save('${screenshotPath}', [System.Drawing.Imaging.ImageFormat]::Png)

$graphics.Dispose()
$bitmap.Dispose()

$file = Get-Item '${screenshotPath}' -ErrorAction SilentlyContinue
if ($file -and $file.Length -gt 1024) {
    Write-Output "SUCCESS:$($file.Length)"
} else {
    Write-Output "FAILED:File too small or not found"
}
} catch {
Write-Output "FAILED:$($_.Exception.Message)"
}
`;

        const result = await new Promise((resolve) => {
            const proc = spawn('powershell', ['-Command', powershellScript], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    resolve(`FAILED:Exit code ${code}`);
                }
            });

            setTimeout(() => {
                proc.kill();
                resolve('FAILED:Timeout');
            }, 15000);
        });

        if (result.startsWith('SUCCESS')) {
            const fileSize = result.split(':')[1];

            if (fs.existsSync(screenshotPath)) {
                const stats = fs.statSync(screenshotPath);
                if (stats.size > 1024) {
                    return {
                        success: true,
                        path: screenshotPath,
                        size: fileSize
                    };
                } else {
                    try {
                        fs.unlinkSync(screenshotPath);
                    } catch {}
                }
            }
        }

    } catch (error) {
        console.error('Screenshot error:', error);
    }

    return {
        success: false,
        path: null,
        size: 0
    };
}

module.exports = {
    GetScreenShot
};
