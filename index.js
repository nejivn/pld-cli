#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const FormData = require('form-data');
const chalk = require('chalk');
const ora = require('ora');
const clipboardy = require('clipboardy');
const { Command } = require('commander');
const readline = require('readline');
const { google } = require('googleapis');
const open = require('open');

const GOOGLE_DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const GOOGLE_DRIVE_TOKEN_PATH = 'google_drive_token.json'; // Will be stored in config dir


// Constants
const CONFIG_DIR = path.join(os.homedir(), '.pld');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const HISTORY_FILE = path.join(CONFIG_DIR, 'history.json');
const PIXELDRAIN_UPLOAD_URL = 'https://pixeldrain.com/api/file';
const GOFILE_UPLOAD_URL = 'https://store1.gofile.io/uploadFile';

// ==================== UTILITY FUNCTIONS ====================

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Format timestamp
function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ==================== CONFIG MANAGEMENT ====================

// Ensure config directory exists
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// Load config
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Ignore errors, will return null
  }
  return null;
}

// Save config for a specific service or Google Drive
function saveConfig(serviceType, credentials) {
  ensureConfigDir();
  let config = loadConfig() || {};

  if (serviceType === 'googleDrive') {
    config.googleDrive = {
      ...credentials, // contains clientId, clientSecret, refreshToken
      updatedAt: new Date().toISOString()
    };
  } else {
    // For Pixeldrain/Gofile
    if (!config.services) {
      config.services = {};
    }
    config.services[serviceType] = {
      apiKey: credentials.apiKey, // For backward compatibility, apiKey is used
      updatedAt: new Date().toISOString()
    };
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Get API key or credentials for a specific service
function getServiceCredentials(serviceType) {
  const config = loadConfig();
  if (!config) return null;

  if (serviceType === 'googleDrive') {
    return config.googleDrive || null;
  } else if (config.services && config.services[serviceType]) {
    // Handle old config format (backward compatibility)
    if (config.apiKey && !config.services && serviceType === 'pixeldrain') {
      // Migrate old format to new format
      saveConfig('pixeldrain', { apiKey: config.apiKey });
      return { apiKey: config.apiKey };
    }
    // Handle new format
    return config.services[serviceType];
  }

  return null;
}


// Create OAuth2 client
function createOAuth2Client(clientId, clientSecret) {
  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    'http://localhost:3000/callback'
  );
}

// Get Google Drive OAuth2 client with valid credentials
async function getGoogleDriveClient() {
  const credentials = getServiceCredentials('googleDrive');

  if (!credentials || !credentials.clientId || !credentials.clientSecret) {
    return null;
  }

  const oauth2Client = createOAuth2Client(credentials.clientId, credentials.clientSecret);

  if (credentials.refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken
    });
    return oauth2Client;
  }

  return null;
}

// Start local server to receive OAuth callback
function startCallbackServer() {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const url = require('url');

    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url, true);

      if (parsedUrl.pathname === '/callback') {
        const code = parsedUrl.query.code;
        const error = parsedUrl.query.error;

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h1>Authorization Failed</h1><p>You can close this window.</p></body></html>');
          server.close();
          reject(new Error(error));
        } else if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h1>Authorization Successful!</h1><p>You can close this window and return to the terminal.</p></body></html>');
          server.close();
          resolve(code);
        }
      }
    });

    server.listen(3000, () => {
      // Server started
    });

    server.on('error', (err) => {
      reject(err);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 120000);
  });
}

// Authenticate with Google Drive (full OAuth flow)
async function authenticateGoogleDrive(clientId, clientSecret) {
  const oauth2Client = createOAuth2Client(clientId, clientSecret);

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_DRIVE_SCOPES,
    prompt: 'consent' // Force to get refresh token
  });

  console.log(chalk.white('\n🔗 Opening browser for Google authorization...'));
  console.log(chalk.gray('If browser does not open, visit this URL:\n'));
  console.log(chalk.cyan.underline(authUrl) + '\n');

  // Open browser
  try {
    await open(authUrl);
  } catch (err) {
    console.log(chalk.yellow('Could not open browser automatically.'));
  }

  // Start callback server and wait for authorization code
  const spinner = ora(chalk.yellow('Waiting for authorization...')).start();

  try {
    const code = await startCallbackServer();
    spinner.succeed(chalk.green('Authorization received!'));

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error('No refresh token received. Please try again.');
    }

    return {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token
    };
  } catch (error) {
    spinner.fail(chalk.red('Authorization failed!'));
    throw error;
  }
}

// Prompt for Google Drive Client ID
function promptGoogleDriveClientId() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(chalk.white('\n🔑 Please enter your Google OAuth Client ID:'));
    console.log(chalk.gray('Get it from: ') + chalk.cyan.underline('https://console.cloud.google.com/apis/credentials\n'));

    rl.question(chalk.yellow('Client ID: '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Prompt for Google Drive Client Secret
function promptGoogleDriveClientSecret() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(chalk.yellow('Client Secret: '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Configure Google Drive
async function configureGoogleDrive() {
  const existingCredentials = getServiceCredentials('googleDrive');

  if (existingCredentials && existingCredentials.refreshToken) {
    // Already configured, show menu
    while (true) {
      console.log(chalk.white.bold('\n⚙️  Google Drive Configuration\n'));
      console.log(chalk.cyan('1. ') + chalk.white('View current configuration'));
      console.log(chalk.cyan('2. ') + chalk.white('Re-authorize (get new token)'));
      console.log(chalk.cyan('3. ') + chalk.white('Delete configuration'));
      console.log(chalk.cyan('4. ') + chalk.white('Exit\n'));

      const choice = await new Promise((resolve) => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question(chalk.yellow('Select an option (1-4): '), (answer) => {
          rl.close();
          resolve(answer.trim());
        });
      });

      switch (choice) {
        case '1':
          // View current config (masked)
          const maskedClientId = existingCredentials.clientId.substring(0, 10) + '...';
          const maskedSecret = existingCredentials.clientSecret.substring(0, 4) + '...';
          console.log(chalk.white('\n📋 Current Configuration:'));
          console.log(chalk.gray('  Client ID: ') + chalk.cyan(maskedClientId));
          console.log(chalk.gray('  Client Secret: ') + chalk.cyan(maskedSecret));
          console.log(chalk.gray('  Status: ') + chalk.green('Authorized'));
          if (existingCredentials.updatedAt) {
            console.log(chalk.gray('  Updated: ') + chalk.white(formatTimestamp(existingCredentials.updatedAt)));
          }
          console.log('');
          break;

        case '2':
          // Re-authorize
          try {
            const tokens = await authenticateGoogleDrive(
              existingCredentials.clientId,
              existingCredentials.clientSecret
            );
            saveConfig('googleDrive', {
              clientId: existingCredentials.clientId,
              clientSecret: existingCredentials.clientSecret,
              refreshToken: tokens.refreshToken
            });
            console.log(chalk.green('\n✓ Google Drive re-authorized successfully!\n'));
            return;
          } catch (error) {
            console.log(chalk.red('\n❌ Re-authorization failed: ' + error.message + '\n'));
          }
          break;

        case '3':
          // Delete config
          const confirmed = await promptConfirmDelete();
          if (confirmed) {
            const config = loadConfig();
            if (config && config.googleDrive) {
              delete config.googleDrive;
              fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
              console.log(chalk.green('\n✓ Google Drive configuration deleted!\n'));
              return;
            }
          } else {
            console.log(chalk.gray('\n→ Deletion cancelled.\n'));
          }
          break;

        case '4':
          console.log(chalk.gray('\n→ Exiting configuration.\n'));
          return;

        default:
          console.log(chalk.red('\n❌ Invalid option. Please select 1-4.\n'));
      }
    }
  } else {
    // New configuration
    console.log(chalk.white.bold('\n🔧 Google Drive Setup\n'));
    console.log(chalk.gray('You need to create OAuth 2.0 credentials in Google Cloud Console.'));
    console.log(chalk.gray('Make sure to add ') + chalk.cyan('http://localhost:3000/callback') + chalk.gray(' as a redirect URI.\n'));

    const clientId = await promptGoogleDriveClientId();
    if (!clientId) {
      console.log(chalk.red('\n❌ Client ID cannot be empty\n'));
      return;
    }

    const clientSecret = await promptGoogleDriveClientSecret();
    if (!clientSecret) {
      console.log(chalk.red('\n❌ Client Secret cannot be empty\n'));
      return;
    }

    try {
      const tokens = await authenticateGoogleDrive(clientId, clientSecret);

      saveConfig('googleDrive', {
        clientId: clientId,
        clientSecret: clientSecret,
        refreshToken: tokens.refreshToken
      });

      console.log(chalk.green('\n✓ Google Drive configured successfully!\n'));
      console.log(chalk.white('You can now upload files: ') + chalk.cyan('pld -s <file> gd\n'));
    } catch (error) {
      console.log(chalk.red('\n❌ Setup failed: ' + error.message + '\n'));
    }
  }
}

// ==================== HISTORY MANAGEMENT ====================

// Load history
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log(chalk.yellow('⚠ Warning: Could not load history file'));
  }
  return [];
}

// Save history entry
function saveHistory(entry) {
  ensureConfigDir();
  const history = loadHistory();
  history.unshift(entry); // Add to beginning

  // Keep only last 50 entries
  if (history.length > 50) {
    history.splice(50);
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// Delete history
function deleteHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      fs.unlinkSync(HISTORY_FILE);
      console.log(chalk.green('\n✓ Upload history cleared successfully!\n'));
    } else {
      console.log(chalk.yellow('\n⚠️  No history found to delete.\n'));
    }
  } catch (error) {
    console.log(chalk.red('\n❌ Error deleting history: ' + error.message + '\n'));
  }
}

function promptHistoryMenu() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(chalk.cyan('\n1. ') + chalk.white('Copy a link to clipboard'));
    console.log(chalk.cyan('2. ') + chalk.white('Clear all history'));
    console.log(chalk.cyan('3. ') + chalk.white('Exit\n'));

    rl.question(chalk.yellow('Select an option (1-3): '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptSelectLink(maxIndex) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(chalk.yellow(`\nEnter number (1-${maxIndex}): `), (answer) => {
      rl.close();
      resolve(parseInt(answer.trim()));
    });
  });
}

function promptConfirmClear() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(chalk.red('\n⚠️  Are you sure you want to clear all history? (y/n): '), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

// Display history
async function displayHistory() {
  let history = loadHistory();

  if (history.length === 0) {
    console.log(chalk.yellow('📭 No upload history yet.\n'));
    console.log(chalk.white('Upload a file first: ') + chalk.cyan('pld -s <file>\n'));
    return;
  }

  while (true) {
    console.log(chalk.white.bold('\n📜 Upload History (Last 10):\n'));

    const displayLimit = Math.min(10, history.length);

    for (let i = 0; i < displayLimit; i++) {
      const item = history[i];
      let serviceLabel;
      if (item.service === 'gofile') {
        serviceLabel = chalk.magenta('[Gofile]');
      } else if (item.service === 'googledrive') {
        serviceLabel = chalk.blue('[Google Drive]');
      } else {
        serviceLabel = chalk.green('[Pixeldrain]');
      }
      console.log(chalk.cyan(`${i + 1}. `) + serviceLabel + ' ' + chalk.white.bold(item.filename));
      console.log(chalk.gray(`   Time: ${formatTimestamp(item.timestamp)}`));
      console.log(chalk.gray(`   Size: ${item.fileSize}`));
      console.log(chalk.blue(`   Link: ${item.downloadLink}`));
      console.log('');
    }

    console.log(chalk.gray(`Total uploads: ${history.length}`));

    const choice = await promptHistoryMenu();

    switch (choice) {
      case '1':
        // Copy link to clipboard
        const linkIndex = await promptSelectLink(displayLimit);
        if (linkIndex >= 1 && linkIndex <= displayLimit) {
          try {
            await clipboardy.write(history[linkIndex - 1].downloadLink);
            console.log(chalk.green('\n✓ Link copied to clipboard!\n'));
          } catch (error) {
            console.log(chalk.red('\n❌ Failed to copy link: ' + error.message + '\n'));
          }
        } else {
          console.log(chalk.red('\n❌ Invalid selection.\n'));
        }
        break;

      case '2':
        // Clear all history
        const confirmed = await promptConfirmClear();
        if (confirmed) {
          deleteHistory();
          return;
        } else {
          console.log(chalk.gray('\n→ Clear cancelled.\n'));
        }
        break;

      case '3':
        // Exit
        console.log(chalk.gray('\n→ Exiting history.\n'));
        return;

      default:
        console.log(chalk.red('\n❌ Invalid option. Please select 1-3.\n'));
    }
  }
}

// ==================== CONFIG COMMAND ====================

function promptServiceSelection() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log(chalk.white.bold('\n⚙️  Select Service to Configure\n'));
    console.log(chalk.cyan('1. ') + chalk.green('Pixeldrain'));
    console.log(chalk.cyan('2. ') + chalk.magenta('Gofile'));
    console.log(chalk.cyan('3. ') + chalk.blue('Google Drive'));
    console.log(chalk.cyan('4. ') + chalk.white('Exit\n'));

    rl.question(chalk.yellow('Select service (1-4): '), (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '1') resolve('pixeldrain');
      else if (choice === '2') resolve('gofile');
      else if (choice === '3') resolve('googledrive');
      else resolve(null);
    });
  });
}

function promptApiKey(service) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const serviceName = service === 'pixeldrain' ? 'Pixeldrain' : 'Gofile';
    const apiUrl = service === 'pixeldrain'
      ? 'https://pixeldrain.com/user/api_keys'
      : 'https://gofile.io/myProfile';

    console.log(chalk.white(`\n🔑 Please enter your ${serviceName} API key:`));
    console.log(chalk.gray('Get your API key from: ') + chalk.cyan.underline(apiUrl + '\n'));

    rl.question(chalk.yellow('API Key: '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptConfigMenu(service) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const serviceName = service === 'pixeldrain' ? 'Pixeldrain' : 'Gofile';
    console.log(chalk.white.bold(`\n⚙️  ${serviceName} API Key Configuration\n`));
    console.log(chalk.cyan('1. ') + chalk.white('View current API key'));
    console.log(chalk.cyan('2. ') + chalk.white('Change API key'));
    console.log(chalk.cyan('3. ') + chalk.white('Delete API key'));
    console.log(chalk.cyan('4. ') + chalk.white('Exit\n'));

    rl.question(chalk.yellow('Select an option (1-4): '), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptConfirmDelete() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(chalk.red('\n⚠️  Are you sure you want to delete the API key? (y/n): '), (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

function deleteServiceConfig(service) {
  try {
    const config = loadConfig();
    if (config && config.services && config.services[service]) {
      delete config.services[service];
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log(chalk.green('\n✓ API key deleted successfully!\n'));
    } else {
      console.log(chalk.yellow('\n⚠️  No API key found to delete.\n'));
    }
  } catch (error) {
    console.log(chalk.red('\n❌ Error deleting API key: ' + error.message + '\n'));
  }
}

async function configureApiKey() {
  const service = await promptServiceSelection();

  if (!service) {
    console.log(chalk.gray('\n→ Exiting configuration.\n'));
    return;
  }

  // Handle Google Drive separately
  if (service === 'googledrive') {
    await configureGoogleDrive();
    return;
  }

  const credentials = getServiceCredentials(service);
  const apiKey = credentials ? credentials.apiKey : null;
  const serviceName = service === 'pixeldrain' ? 'Pixeldrain' : 'Gofile';

  // If no API key exists, directly prompt for one
  if (!apiKey) {
    const newApiKey = await promptApiKey(service);

    if (!newApiKey) {
      console.log(chalk.red('\n❌ API key cannot be empty\n'));
      process.exit(1);
    }

    saveConfig(service, { apiKey: newApiKey });
    console.log(chalk.green(`\n✓ ${serviceName} API key saved successfully!\n`));
    console.log(chalk.white('You can now upload files: ') + chalk.cyan(`pld -s <file> ${service === 'gofile' ? 'gf' : 'pd'}\n`));
    return;
  }

  // If API key exists, show menu
  while (true) {
    const choice = await promptConfigMenu(service);

    switch (choice) {
      case '1':
        // View current API key (masked)
        const maskedKey = apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4);
        console.log(chalk.white('\n🔑 Current API Key: ') + chalk.cyan(maskedKey));
        const config = loadConfig();
        if (config.services && config.services[service] && config.services[service].updatedAt) {
          console.log(chalk.gray('Updated: ' + formatTimestamp(config.services[service].updatedAt) + '\n'));
        }
        break;

      case '2':
        // Change API key
        const newKey = await promptApiKey(service);
        if (!newKey) {
          console.log(chalk.red('\n❌ API key cannot be empty\n'));
          break;
        }
        saveConfig(service, { apiKey: newKey });
        console.log(chalk.green('\n✓ API key updated successfully!\n'));
        return;

      case '3':
        // Delete API key
        const confirmed = await promptConfirmDelete();
        if (confirmed) {
          deleteServiceConfig(service);
          return;
        } else {
          console.log(chalk.gray('\n→ Deletion cancelled.\n'));
        }
        break;

      case '4':
        // Exit
        console.log(chalk.gray('\n→ Exiting configuration.\n'));
        return;

      default:
        console.log(chalk.red('\n❌ Invalid option. Please select 1-4.\n'));
    }
  }
}

// ==================== UPLOAD FUNCTIONS ====================

// Upload to Pixeldrain
async function uploadToPixeldrain(filePath, apiKey) {
  const spinner = ora();

  try {
    // Resolve absolute path
    const absolutePath = path.resolve(filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.log(chalk.red(`❌ Error: File not found: ${filePath}`));
      process.exit(1);
    }

    // Get file stats
    const stats = fs.statSync(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileSize = formatFileSize(stats.size);

    console.log(chalk.green('[Pixeldrain]') + chalk.white(` 📁 File: ${chalk.cyan(fileName)}`));
    console.log(chalk.white(`📊 Size: ${chalk.cyan(fileSize)}\n`));

    // Create form data with streaming
    const form = new FormData();
    const fileStream = fs.createReadStream(absolutePath);
    form.append('file', fileStream, {
      filename: fileName,
      contentType: 'application/octet-stream'
    });

    // Start spinner
    spinner.start(chalk.yellow('Uploading to Pixeldrain...'));

    // Prepare headers with API key
    const headers = {
      ...form.getHeaders(),
      'Authorization': `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`
    };

    // Track upload progress
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    // Create abort controller for cancellable upload
    const abortController = new AbortController();

    // Handle Ctrl+C to cancel upload
    const handleCancel = () => {
      spinner.fail(chalk.yellow('\n⚠️  Upload cancelled by user'));
      console.log(chalk.gray('Cleaning up...\n'));
      abortController.abort();
      process.exit(0);
    };

    process.on('SIGINT', handleCancel);

    // Upload file
    const response = await axios.post(PIXELDRAIN_UPLOAD_URL, form, {
      headers: headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      signal: abortController.signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);

          // Calculate speed
          const currentTime = Date.now();
          const timeDiff = (currentTime - lastTime) / 1000; // seconds
          const loadedDiff = progressEvent.loaded - lastLoaded;

          if (timeDiff > 0) {
            const speedBps = loadedDiff / timeDiff; // bytes per second
            const speedMbps = (speedBps / (1024 * 1024)).toFixed(2); // MB/s

            // Calculate ETA
            const remainingBytes = progressEvent.total - progressEvent.loaded;
            const etaSeconds = Math.round(remainingBytes / speedBps);
            const etaMin = Math.floor(etaSeconds / 60);
            const etaSec = etaSeconds % 60;
            const etaDisplay = etaMin > 0 ? `${etaMin}m ${etaSec}s` : `${etaSec}s`;

            spinner.text = chalk.yellow(`Uploading... ${percentCompleted}% `) +
              chalk.cyan(`[${speedMbps} MB/s]`) +
              chalk.gray(` ETA: ${etaDisplay}`) +
              chalk.gray(` (Press Ctrl+C to cancel)`);

            lastLoaded = progressEvent.loaded;
            lastTime = currentTime;
          }
        }
      }
    });

    // Remove signal handler after upload completes
    process.removeListener('SIGINT', handleCancel);

    spinner.succeed(chalk.green('Upload complete! ✨'));

    // Extract file ID from response
    const fileId = response.data.id;
    const downloadLink = `https://pixeldrain.com/u/${fileId}`;

    // Save to history
    const historyEntry = {
      service: 'pixeldrain',
      timestamp: new Date().toISOString(),
      filename: fileName,
      fileSize: fileSize,
      fileId: fileId,
      downloadLink: downloadLink
    };
    saveHistory(historyEntry);

    // Display results
    console.log(chalk.green('\n✓ Upload Successful! 🎉\n'));

    console.log(chalk.white('🔗 Download Link:'));
    console.log(chalk.cyan.underline.bold(`   ${downloadLink}\n`));

    // Copy to clipboard
    try {
      await clipboardy.write(downloadLink);
      console.log(chalk.green('✓ Link copied to clipboard!\n'));
    } catch (clipError) {
      console.log(chalk.yellow('⚠ Could not copy to clipboard\n'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Upload failed!'));

    if (error.response) {
      console.log(chalk.red(`\n❌ Server Error: ${error.response.status}`));

      if (error.response.status === 401 || error.response.status === 403) {
        console.log(chalk.red('Invalid API key. Please reconfigure: ') + chalk.cyan('pld --config\n'));
      } else {
        console.log(chalk.red(`Message: ${error.response.data?.message || error.response.statusText || 'Unknown error'}\n`));
      }
    } else if (error.request) {
      console.log(chalk.red('\n❌ Network Error: Could not reach the server'));
      console.log(chalk.yellow('Please check your internet connection\n'));
    } else {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }

    process.exit(1);
  }
}

// Upload to Gofile
async function uploadToGofile(filePath, token) {
  const spinner = ora();

  try {
    // Resolve absolute path
    const absolutePath = path.resolve(filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.log(chalk.red(`❌ Error: File not found: ${filePath}`));
      process.exit(1);
    }

    // Get file stats
    const stats = fs.statSync(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileSize = formatFileSize(stats.size);

    console.log(chalk.magenta('[Gofile]') + chalk.white(` 📁 File: ${chalk.cyan(fileName)}`));
    console.log(chalk.white(`📊 Size: ${chalk.cyan(fileSize)}\n`));

    // Create form data with streaming
    const form = new FormData();
    const fileStream = fs.createReadStream(absolutePath);
    form.append('file', fileStream, {
      filename: fileName
    });

    // Start spinner
    spinner.start(chalk.yellow('Uploading to Gofile...'));

    // Prepare headers with optional token
    const headers = {
      ...form.getHeaders()
    };

    // Add token if provided (otherwise upload as anonymous)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Track upload progress
    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    // Create abort controller for cancellable upload
    const abortController = new AbortController();

    // Handle Ctrl+C to cancel upload
    const handleCancel = () => {
      spinner.fail(chalk.yellow('\n⚠️  Upload cancelled by user'));
      console.log(chalk.gray('Cleaning up...\n'));
      abortController.abort();
      process.exit(0);
    };

    process.on('SIGINT', handleCancel);

    // Upload file
    const response = await axios.post('https://upload.gofile.io/uploadfile', form, {
      headers: headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      signal: abortController.signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);

          // Calculate speed
          const currentTime = Date.now();
          const timeDiff = (currentTime - lastTime) / 1000; // seconds
          const loadedDiff = progressEvent.loaded - lastLoaded;

          if (timeDiff > 0) {
            const speedBps = loadedDiff / timeDiff; // bytes per second
            const speedMbps = (speedBps / (1024 * 1024)).toFixed(2); // MB/s

            // Calculate ETA
            const remainingBytes = progressEvent.total - progressEvent.loaded;
            const etaSeconds = Math.round(remainingBytes / speedBps);
            const etaMin = Math.floor(etaSeconds / 60);
            const etaSec = etaSeconds % 60;
            const etaDisplay = etaMin > 0 ? `${etaMin}m ${etaSec}s` : `${etaSec}s`;

            spinner.text = chalk.yellow(`Uploading... ${percentCompleted}% `) +
              chalk.cyan(`[${speedMbps} MB/s]`) +
              chalk.gray(` ETA: ${etaDisplay}`) +
              chalk.gray(` (Press Ctrl+C to cancel)`);

            lastLoaded = progressEvent.loaded;
            lastTime = currentTime;
          }
        }
      }
    });

    // Remove signal handler after upload completes
    process.removeListener('SIGINT', handleCancel);

    spinner.succeed(chalk.green('Upload complete! ✨'));

    // Extract file ID and download link from Gofile response
    const fileId = response.data.data.fileId;
    const downloadLink = response.data.data.downloadPage;

    // Save to history
    const historyEntry = {
      service: 'gofile',
      timestamp: new Date().toISOString(),
      filename: fileName,
      fileSize: fileSize,
      fileId: fileId,
      downloadLink: downloadLink
    };
    saveHistory(historyEntry);

    // Display results
    console.log(chalk.green('\n✓ Upload Successful! 🎉\n'));

    console.log(chalk.white('🔗 Download Link:'));
    console.log(chalk.cyan.underline.bold(`   ${downloadLink}\n`));

    // Copy to clipboard
    try {
      await clipboardy.write(downloadLink);
      console.log(chalk.green('✓ Link copied to clipboard!\n'));
    } catch (clipError) {
      console.log(chalk.yellow('⚠ Could not copy to clipboard\n'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Upload failed!'));

    if (error.response) {
      console.log(chalk.red(`\n❌ Server Error: ${error.response.status}`));

      if (error.response.status === 401 || error.response.status === 403) {
        console.log(chalk.red('Invalid API token. Please reconfigure: ') + chalk.cyan('pld --config\n'));
      } else {
        console.log(chalk.red(`Message: ${error.response.data?.message || error.response.statusText || 'Unknown error'}\n`));
      }
    } else if (error.request) {
      console.log(chalk.red('\n❌ Network Error: Could not reach the server'));
      console.log(chalk.yellow('Please check your internet connection\n'));
    } else {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }

    process.exit(1);
  }
}

// Upload to Google Drive
async function uploadToGoogleDrive(filePath) {
  const spinner = ora();

  try {
    // Resolve absolute path
    const absolutePath = path.resolve(filePath);

    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.log(chalk.red(`❌ Error: File not found: ${filePath}`));
      process.exit(1);
    }

    // Get file stats
    const stats = fs.statSync(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileSize = formatFileSize(stats.size);

    console.log(chalk.blue('[Google Drive]') + chalk.white(` 📁 File: ${chalk.cyan(fileName)}`));
    console.log(chalk.white(`📊 Size: ${chalk.cyan(fileSize)}\n`));

    // Get OAuth2 client
    const auth = await getGoogleDriveClient();
    if (!auth) {
      console.log(chalk.red('❌ Error: Google Drive not configured\n'));
      console.log(chalk.white('Please configure Google Drive first: ') + chalk.cyan('pld --config\n'));
      process.exit(1);
    }

    // Create Drive client
    const drive = google.drive({ version: 'v3', auth });

    // Start spinner
    spinner.start(chalk.yellow('Uploading to Google Drive...'));

    // Create file metadata
    const fileMetadata = {
      name: fileName
    };

    // Create media object
    const media = {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(absolutePath)
    };

    // Upload file
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink'
    });

    // Set file to be publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Get updated file info with sharing link
    const file = await drive.files.get({
      fileId: response.data.id,
      fields: 'id, name, webViewLink, webContentLink'
    });

    spinner.succeed(chalk.green('Upload complete! ✨'));

    const fileId = file.data.id;
    const downloadLink = file.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

    // Save to history
    const historyEntry = {
      service: 'googledrive',
      timestamp: new Date().toISOString(),
      filename: fileName,
      fileSize: fileSize,
      fileId: fileId,
      downloadLink: downloadLink
    };
    saveHistory(historyEntry);

    // Display results
    console.log(chalk.green('\n✓ Upload Successful! 🎉\n'));

    console.log(chalk.white('🔗 Share Link:'));
    console.log(chalk.cyan.underline.bold(`   ${downloadLink}\n`));

    // Copy to clipboard
    try {
      await clipboardy.write(downloadLink);
      console.log(chalk.green('✓ Link copied to clipboard!\n'));
    } catch (clipError) {
      console.log(chalk.yellow('⚠ Could not copy to clipboard\n'));
    }

  } catch (error) {
    spinner.fail(chalk.red('Upload failed!'));

    if (error.code === 401 || error.code === 403) {
      console.log(chalk.red('\n❌ Authentication Error'));
      console.log(chalk.yellow('Please re-authorize Google Drive: ') + chalk.cyan('pld --config\n'));
    } else if (error.code === 'ENOTFOUND' || error.code === 'ENETUNREACH') {
      console.log(chalk.red('\n❌ Network Error: Could not reach Google Drive'));
      console.log(chalk.yellow('Please check your internet connection\n'));
    } else {
      console.log(chalk.red(`\n❌ Error: ${error.message}\n`));
    }

    process.exit(1);
  }
}

// Main upload router
async function uploadFile(filePath, serviceFlag) {
  // Validate file path
  if (!filePath) {
    console.log(chalk.red('❌ Error: Please provide a file path'));
    console.log(chalk.yellow('Usage: pld -s <file-path> [gf|pd|gd]'));
    process.exit(1);
  }

  // Determine service from flag
  let service = 'gofile'; // default
  if (serviceFlag === 'gf') {
    service = 'gofile';
  } else if (serviceFlag === 'pd') {
    service = 'pixeldrain';
  } else if (serviceFlag === 'gd') {
    service = 'googledrive';
  }

  // Handle Google Drive upload
  if (service === 'googledrive') {
    await uploadToGoogleDrive(filePath);
    return;
  }

  // Check for API key
  const credentials = getServiceCredentials(service);
  const apiKey = credentials ? credentials.apiKey : null;

  // Pre-upload validation: Check file size for Pixeldrain
  if (service === 'pixeldrain') {
    try {
      const absolutePath = path.resolve(filePath);
      if (fs.existsSync(absolutePath)) {
        const stats = fs.statSync(absolutePath);
        const fileSizeGB = stats.size / (1024 * 1024 * 1024);
        const maxSizeGB = 10;

        if (fileSizeGB > maxSizeGB) {
          console.log(chalk.yellow('\n⚠️  Warning: File size exceeds Pixeldrain free tier limit!'));
          console.log(chalk.white('  File size: ') + chalk.red(`${fileSizeGB.toFixed(2)} GB`));
          console.log(chalk.white('  Free limit: ') + chalk.green(`${maxSizeGB} GB`));
          console.log(chalk.gray('\n  Pixeldrain free accounts have a 10GB upload limit.'));
          console.log(chalk.gray('  Consider using Gofile for larger files or upgrade Pixeldrain.\n'));

          // Ask user confirmation
          const readline = require('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          const answer = await new Promise((resolve) => {
            rl.question(chalk.cyan('Continue upload anyway? (y/N): '), (ans) => {
              rl.close();
              resolve(ans);
            });
          });

          if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
            console.log(chalk.yellow('\n✋ Upload cancelled\n'));
            process.exit(0);
          }
        }
      }
    } catch (error) {
      // If file check fails, continue anyway (will fail later with proper error)
    }
  }

  // Pixeldrain requires API key, Gofile is optional (can upload anonymously)
  if (!apiKey && service === 'pixeldrain') {
    console.log(chalk.red(`❌ Error: No Pixeldrain API key found\n`));
    console.log(chalk.white('Please configure your API key first: ') + chalk.cyan('pld --config\n'));
    process.exit(1);
  }

  // Upload to the appropriate service
  if (service === 'gofile') {
    // Pass token (can be null for anonymous upload)
    await uploadToGofile(filePath, apiKey);
  } else {
    await uploadToPixeldrain(filePath, apiKey);
  }
}

// ==================== CLI SETUP ====================

const program = new Command();

program
  .name('pld')
  .description('📤 File Upload CLI')
  .version('1.0.0');

program
  .option('--config', 'Configure API keys')
  .option('-s, --send <file> [service]', 'Upload a file (service: pd=Pixeldrain, gf=Gofile, gd=Google Drive)')
  .option('-ls, --list', 'Show upload history');

program.parse(process.argv);

const options = program.opts();

// Handle commands
if (options.config) {
  configureApiKey();
} else if (options.send) {
  // Get service flag from additional args
  const serviceFlag = program.args[0]; // Will be 'gf', 'pd', 'gd', or undefined
  uploadFile(options.send, serviceFlag);
} else if (options.list) {
  displayHistory();
} else {
  // Show tool information
  console.log('\n');
  console.log(chalk.cyan('  ██████╗ ██╗     ██████╗      ██████╗██╗     ██╗'));
  console.log(chalk.cyan('  ██╔══██╗██║     ██╔══██╗    ██╔════╝██║     ██║'));
  console.log(chalk.cyan('  ██████╔╝██║     ██║  ██║    ██║     ██║     ██║'));
  console.log(chalk.cyan('  ██╔═══╝ ██║     ██║  ██║    ██║     ██║     ██║'));
  console.log(chalk.cyan('  ██║     ███████╗██████╔╝    ╚██████╗███████╗██║'));
  console.log(chalk.cyan('  ╚═╝     ╚══════╝╚═════╝      ╚═════╝╚══════╝╚═╝'));
  console.log('\n');
  console.log(chalk.white('  Version: ') + chalk.green('1.0.1'));
  console.log(chalk.white('  Author: ') + chalk.yellow('laiduc1312'));
  console.log('\n');
  console.log(chalk.white('  📡 Supported Services:'));
  console.log(chalk.magenta('    • Gofile ') + chalk.gray('(Default, Anonymous, API Key)'));
  console.log(chalk.green('    • Pixeldrain ') + chalk.gray('(Requires API Key, Free: 10GB limit, limit speed upload)'));
  console.log(chalk.blue('    • Google Drive ') + chalk.gray('(Requires OAuth setup, 15GB free storage)'));
  console.log('\n');
  console.log(chalk.white('  Quick Start:'));
  console.log(chalk.cyan('    pld -s <file> gf    ') + chalk.gray('Upload to Gofile'));
  console.log(chalk.cyan('    pld -s <file> pd    ') + chalk.gray('Upload to Pixeldrain'));
  console.log(chalk.cyan('    pld -s <file> gd    ') + chalk.gray('Upload to Google Drive'));
  console.log(chalk.cyan('    pld -ls             ') + chalk.gray('Show history'));
  console.log(chalk.cyan('    pld --config        ') + chalk.gray('Configure API keys'));
  console.log(chalk.cyan('    pld -h              ') + chalk.gray('Show help'));
  console.log('\n');
}
