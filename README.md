# 📤 PLD CLI - File Sharing Tool

A beautiful and professional command-line tool for uploading and sharing files instantly using Pixeldrain and Gofile. Features a gorgeous terminal UI with colors, loading animations, automatic clipboard integration, upload history tracking, and secure API key management.

## ✨ Features

- 🚀 **Lightning Fast** - Upload files instantly with streaming support for large files
- 🎨 **Beautiful Terminal UI** - Gorgeous interface with colors, animations, and smooth progress indicators
- 📋 **Auto Clipboard** - Download links automatically copied to your clipboard
- 📊 **Upload History** - Track all your uploads with timestamps and file info
- 🔐 **Secure & Private** - API keys stored locally and encrypted. All uploads use HTTPS
- 💾 **Memory Efficient** - Handles files of any size without consuming excessive memory
- 🔄 **Dual Service Support** - Choose between Gofile and Pixeldrain for uploads
- 💻 **Open Source** - Free and open-source software on GitHub

## 📦 Installation

### Scoop (Recommended)

The easiest way to install PLD CLI on Windows is via Scoop package manager.

**If you don't have Scoop installed:**

1. Set execution policy (run in PowerShell):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

2. Install Scoop:
```powershell
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

**Then install PLD CLI:**
```powershell
scoop bucket add pld-bucket https://github.com/laiduc1312209/scoop-bucket
scoop install pld-cli
```

### Manual Installation

Clone from GitHub and install dependencies:

```bash
git clone https://github.com/laiduc1312209/pld-cli.git
cd pld-cli
npm install
npm link
```

## 🚀 Quick Start

### Step 1: Configure API Key

Run the configuration wizard:
```bash
pld --config
```

You'll be prompted to enter your API key for either:
- **Gofile** - Get your API key at [Gofile API](https://gofile.io/api)
- **Pixeldrain** - Get your API key at [Pixeldrain API Keys](https://pixeldrain.com/user/api_keys)

Your API key will be securely stored in `~/.pld/config.json`

### Step 2: Upload Files

Upload a file to Gofile (default):
```bash
pld -s document.pdf
```

Upload a file to Pixeldrain:
```bash
pld -s photo.jpg pd
```

## 📖 Usage

### Available Commands

| Command | Description |
|---------|-------------|
| `pld --config` | Configure your Gofile or Pixeldrain API key |
| `pld -s <file>` | Upload a file to Gofile (default) |
| `pld -s <file> pd` | Upload a file to Pixeldrain |
| `pld --list` | Show upload history (last 10 uploads) |
| `pld --help` | Display help and all available commands |

### Examples

#### Configure API Key
```bash
pld --config
```

#### Upload to Gofile (default)
```bash
pld -s document.pdf
pld -s large-video.mp4
pld -s C:\Users\Documents\image.png
```

#### Upload to Pixeldrain
```bash
pld -s document.pdf pd
pld -s photo.jpg pd
```

#### View Upload History
```bash
pld --list

## 🗂️ File Structure

The tool creates a `.pld` directory in your home folder to store configuration and history:

```
~/.pld/
├── config.json    # Your API key (keep this secure!)
└── history.json   # Upload history (last 50 uploads)
```

## 🛠️ Technical Details

### Dependencies

- **axios** - HTTP client for API requests
- **form-data** - Multipart form data for file uploads
- **chalk** - Terminal color styling
- **ora** - Elegant terminal spinner
- **clipboardy** - Cross-platform clipboard access
- **commander** - Command-line interface framework

### Supported Services

- **Gofile** - Fast and reliable file sharing service
- **Pixeldrain** - Privacy-focused file hosting

### Security

- Your API key is stored locally in `~/.pld/config.json`
- Never share your config file with others
- The API key is never logged or displayed
- All uploads are encrypted in transit (HTTPS)

## 📝 Features in Detail

### Upload History

The tool automatically tracks your uploads and stores:
- Timestamp of upload
- Filename
- File size
- Service used (Gofile/Pixeldrain)
- Download link

View your history anytime with `pld --list`

### Progress Tracking

For large files, you'll see a real-time progress indicator:
```
⠹ Uploading... 45%
```

### Clipboard Integration

Every successful upload automatically copies the download link to your clipboard - just paste it anywhere!

## 🐛 Troubleshooting

### Command not found after installation

**For Scoop users:**
Try reinstalling:
```bash
scoop uninstall pld-cli
scoop install pld-cli
```

**For manual installation:**
Try running:
```bash
npm unlink
npm link
```

Or restart your terminal.

### Upload fails with 401/403 error

Your API key is invalid or expired. Reconfigure it:
```bash
pld --config
```

### Network errors

- Check your internet connection
- Verify the service is accessible (Gofile/Pixeldrain)
- Check if you're behind a proxy or firewall

### File not found

- Verify the file path is correct
- Use absolute paths for files outside the current directory
- Ensure the file exists and is readable

## 🎯 Roadmap

Future features planned:
- [ ] Multiple file upload support
- [ ] Custom expiry time for uploads
- [ ] Download files from services
- [ ] File encryption before upload
- [ ] Upload to custom folders/collections
- [ ] Export history to CSV
- [ ] Support for more file sharing services

## 📄 License

MIT

## 🔗 Links

- **GitHub**: [github.com/laiduc1312209/pld-cli](https://github.com/laiduc1312209/pld-cli)
- **Gofile**: [gofile.io](https://gofile.io)
- **Pixeldrain**: [pixeldrain.com](https://pixeldrain.com)

---

Made with ❤️ for easy file sharing

**Get Started:** `pld --config`
