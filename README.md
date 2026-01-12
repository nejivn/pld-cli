# 📤 PLD CLI - File Sharing Tool

A beautiful and professional command-line tool for uploading and sharing files instantly using Pixeldrain, Gofile, and Google Drive. Features a gorgeous terminal UI with colors, loading animations, automatic clipboard integration, upload history tracking, and secure API key management.

## ✨ Features

- 🚀 **Lightning Fast** - Upload files instantly with streaming support for large files
- 🎨 **Beautiful Terminal UI** - Gorgeous interface with colors, animations, and smooth progress indicators
- 📱 **QR Code Display** - Automatic QR code generation for easy mobile sharing
- 📋 **Auto Clipboard** - Download links automatically copied to your clipboard
- 🔄 **Auto-Update** - Automatically checks and updates to the latest version
- 📊 **Upload History** - Track all your uploads with timestamps and file info
- 🔐 **Secure & Private** - API keys stored locally and encrypted. All uploads use HTTPS
- 💾 **Memory Efficient** - Handles files of any size without consuming excessive memory
- 🔄 **Multi Service Support** - Choose between Gofile, Pixeldrain, and Google Drive for uploads
- 💻 **Open Source** - Free and open-source software on GitHub

## 📦 Installation


### Irm

The easiest way to install PLD CLI on Windows.


1. Run in PowerShell:
```powershell
irm https://raw.githubusercontent.com/laiduc1312209/pld-cli/main/install.ps1 | iex
```
### Scoop

The way to install PLD CLI on Windows is via Scoop package manager.

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

You'll be prompted to select a service and enter your credentials:
- **Gofile** - Get your API key at [Gofile API](https://gofile.io/api) (optional, can upload anonymously)
- **Pixeldrain** - Get your API key at [Pixeldrain API Keys](https://pixeldrain.com/user/api_keys)
- **Google Drive** - Requires OAuth setup (see [Google Drive Setup](#-google-drive-setup) below)

Your credentials will be securely stored in `~/.pld/config.json`

### Step 2: Upload Files

Upload a file to Gofile (default):
```bash
pld -s document.pdf
```

Upload a file to Pixeldrain:
```bash
pld -s photo.jpg pd
```

Upload a file to Google Drive:
```bash
pld -s video.mp4 gd
```

## 📖 Usage

### Available Commands

| Command | Description |
|---------|-------------|
| `pld --config` | Configure your API keys and credentials |
| `pld -s <file>` | Upload a file to Gofile (default) |
| `pld -s <file> gf` | Upload a file to Gofile |
| `pld -s <file> pd` | Upload a file to Pixeldrain |
| `pld -s <file> gd` | Upload a file to Google Drive |
| `pld -ls` | Show upload history (last 10 uploads) |
| `pld -h` | Display help and all available commands |

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

#### Upload to Google Drive
```bash
pld -s document.pdf gd
pld -s video.mp4 gd
```

#### View Upload History
```bash
pld -ls
```

## 🔷 Google Drive Setup

To use Google Drive, you need to create OAuth 2.0 credentials:

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API** for your project

### Step 2: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Select **Web application** as the application type
4. Add `http://localhost:3000/callback` to **Authorized redirect URIs**
5. Click **Create** and save your **Client ID** and **Client Secret**

### Step 3: Configure PLD CLI

```bash
pld --config
```

1. Select **Google Drive** (option 3)
2. Enter your **Client ID**
3. Enter your **Client Secret**
4. A browser window will open for you to authorize the application
5. Log in with your Google account and grant permissions

After authorization, you can upload files to Google Drive using:
```bash
pld -s <file> gd
```

## 📡 Supported Services

| Service | Flag | API Key Required | Notes |
|---------|------|------------------|-------|
| Gofile | `gf` | Optional | Default service, anonymous uploads allowed |
| Pixeldrain | `pd` | Required | Free tier: 10GB limit, limited upload speed |
| Google Drive | `gd` | OAuth Required | 15GB free storage |

## 🗂️ File Structure

The tool creates a `.pld` directory in your home folder to store configuration and history:

```
~/.pld/
├── config.json    # Your API keys and credentials (keep this secure!)
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
- **googleapis** - Google APIs client library
- **open** - Open URLs in the default browser

### Security

- Your API keys and tokens are stored locally in `~/.pld/config.json`
- Never share your config file with others
- The API key is never logged or displayed
- All uploads are encrypted in transit (HTTPS)
- Google Drive uses OAuth 2.0 with refresh tokens

## 📝 Features in Detail

### Upload History

The tool automatically tracks your uploads and stores:
- Timestamp of upload
- Filename
- File size
- Service used (Gofile/Pixeldrain/Google Drive)
- Download link

View your history anytime with `pld -ls`

### Progress Tracking

For large files, you'll see a real-time progress indicator:
```
⠹ Uploading... 45% [2.5 MB/s] ETA: 30s
```

### Clipboard Integration

Every successful upload automatically copies the download link to your clipboard - just paste it anywhere!

### QR Code Display

After each successful upload, a QR code is automatically generated and displayed in the terminal:

```
🔗 Download Link:
   https://pixeldrain.com/u/abc123

📱 QR Code:
█▀▀▀▀▀█ ▄ ▀▄▄ █▀▀▀▀▀█
█ ███ █ ▀▀ ▄█ █ ███ █
█ ▀▀▀ █ ▄▀█▄█ █ ▀▀▀ █

✓ Link copied to clipboard!
```

Simply scan the QR code with your phone to instantly access the download link!

### Auto-Update

PLD CLI automatically checks for updates once per day when you run any command. If a new version is available, it will:

1. Notify you about the new version
2. Automatically download and install the update
3. You just need to restart your terminal or run the command again

No manual update needed - you'll always have the latest features and bug fixes!

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

### Google Drive authorization issues

If you encounter authorization errors:
1. Run `pld --config` and select Google Drive
2. Choose **Re-authorize** to get a new token
3. Make sure you've added `http://localhost:3000/callback` as a redirect URI in Google Cloud Console

### Network errors

- Check your internet connection
- Verify the service is accessible (Gofile/Pixeldrain/Google)
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
- [x] Support for more file sharing services (Google Drive)

## 📄 License

MIT

## 🔗 Links

- **GitHub**: [github.com/laiduc1312209/pld-cli](https://github.com/laiduc1312209/pld-cli)
- **Gofile**: [gofile.io](https://gofile.io)
- **Pixeldrain**: [pixeldrain.com](https://pixeldrain.com)
- **Google Drive**: [drive.google.com](https://drive.google.com)

---

Made with ❤️ for easy file sharing

**Get Started:** `pld --config`
