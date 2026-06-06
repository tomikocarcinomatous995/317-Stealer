# Build Resources

## Icon Files

Place your custom icon files here:

- `icon.ico` - Main application icon (256x256 recommended)
- `installer.ico` - NSIS installer icon (optional)
- `uninstaller.ico` - NSIS uninstaller icon (optional)

## Icon Requirements

### Windows ICO Format
- **Size**: 256x256 pixels (recommended)
- **Format**: ICO (Windows Icon)
- **Bit Depth**: 32-bit with alpha channel
- **Multiple Sizes**: Include 16x16, 32x32, 48x48, 256x256

### Creating Icons

#### From PNG
```bash
# Using ImageMagick
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

#### Online Tools
- https://icoconvert.com/
- https://convertio.co/png-ico/
- https://www.favicon-generator.org/

#### Desktop Tools
- **IcoFX** (Windows)
- **GIMP** (Cross-platform)
- **Photoshop** (Cross-platform)

## Default Icon

If no custom icon is provided, Electron will use the default icon.

To use a custom icon:

1. Place `icon.ico` in this directory
2. Update `package.json`:
```json
{
  "build": {
    "win": {
      "icon": "build/resources/icon.ico"
    }
  }
}
```

3. Rebuild:
```bash
npm run build
```

## Branding

For complete branding customization:

1. **Application Icon**: `icon.ico`
2. **Installer Icon**: `installer.ico`
3. **Product Name**: Edit `package.json` > `build.productName`
4. **Company Name**: Edit `package.json` > `build.win.publisherName`
5. **Copyright**: Edit `package.json` > `build.copyright`

Example:
```json
{
  "build": {
    "productName": "YourApp",
    "copyright": "Copyright © 2024 YourCompany",
    "win": {
      "icon": "build/resources/icon.ico",
      "publisherName": "YourCompany"
    }
  }
}
```
