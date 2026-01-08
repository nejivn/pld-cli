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
    console.log(chalk.yellow('⚠ Warning: Could not load config file'));
  }
  return null;
}

// Save config for a specific service
function saveConfig(service, apiKey) {
  ensureConfigDir();
  let config = loadConfig() || { services: {} };

  if (!config.services) {
    config.services = {};
  }

  config.services[service] = {
    apiKey: apiKey,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// Get API key for a specific service
function getServiceApiKey(service) {
  const config = loadConfig();
  if (!config) return null;

  // Handle old config format (backward compatibility)
  if (config.apiKey && !config.services && service === 'pixeldrain') {
    // Migrate old format to new format
    saveConfig('pixeldrain', config.apiKey);
    return config.apiKey;
  }

  // Handle new format
  if (config.services && config.services[service]) {
    return config.services[service].apiKey;
  }

  return null;
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
      const serviceLabel = item.service === 'gofile' ? chalk.magenta('[Gofile]') : chalk.green('[Pixeldrain]');
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
    console.log(chalk.cyan('3. ') + chalk.white('Exit\n'));

    rl.question(chalk.yellow('Select service (1-3): '), (answer) => {
      rl.close();
      const choice = answer.trim();
      if (choice === '1') resolve('pixeldrain');
      else if (choice === '2') resolve('gofile');
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

  const apiKey = getServiceApiKey(service);
  const serviceName = service === 'pixeldrain' ? 'Pixeldrain' : 'Gofile';

  // If no API key exists, directly prompt for one
  if (!apiKey) {
    const newApiKey = await promptApiKey(service);

    if (!newApiKey) {
      console.log(chalk.red('\n❌ API key cannot be empty\n'));
      process.exit(1);
    }

    saveConfig(service, newApiKey);
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
        if (config.services[service].updatedAt) {
          console.log(chalk.gray('Updated: ' + formatTimestamp(config.services[service].updatedAt) + '\n'));
        }
        break;

      case '2':
        // Change API key
        const newApiKey = await promptApiKey(service);
        if (!newApiKey) {
          console.log(chalk.red('\n❌ API key cannot be empty\n'));
          break;
        }
        saveConfig(service, newApiKey);
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

// Main upload router
async function uploadFile(filePath, serviceFlag) {
  // Validate file path  
  if (!filePath) {
    console.log(chalk.red('❌ Error: Please provide a file path'));
    console.log(chalk.yellow('Usage: pld -s <file-path> [gf|pd]'));
    process.exit(1);
  }

  // Determine service from flag
  let service = 'gofile'; // default
  if (serviceFlag === 'gf') {
    service = 'gofile';
  } else if (serviceFlag === 'pd') {
    service = 'pixeldrain';
  }

  // Check for API key
  const apiKey = getServiceApiKey(service);

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
  .option('-s, --send <file> [service]', 'Upload a file (service: pd=Pixeldrain, gf=Gofile)')
  .option('-ls, --list', 'Show upload history');

program.parse(process.argv);

const options = program.opts();

// Handle commands
if (options.config) {
  configureApiKey();
} else if (options.send) {
  // Get service flag from additional args
  const serviceFlag = program.args[0]; // Will be 'gf', 'pd', or undefined
  uploadFile(options.send, serviceFlag);
} else if (options.list) {
  displayHistory();
} else {
  // Show tool information
  console.log('\n');
  console.log(chalk.cyan.bold('  ██████╗ ██╗     ██████╗      ██████╗██╗     ██╗'));
  console.log(chalk.cyan.bold('  ██╔══██╗██║     ██╔══██╗    ██╔════╝██║     ██║'));
  console.log(chalk.cyan.bold('  ██████╔╝██║     ██║  ██║    ██║     ██║     ██║'));
  console.log(chalk.cyan.bold('  ██╔═══╝ ██║     ██║  ██║    ██║     ██║     ██║'));
  console.log(chalk.cyan.bold('  ██║     ███████╗██████╔╝    ╚██████╗███████╗██║'));
  console.log(chalk.cyan.bold('  ╚═╝     ╚══════╝╚═════╝      ╚═════╝╚══════╝╚═╝'));
  console.log('\n');
  console.log(chalk.white('  Version: ') + chalk.green('1.0.0'));
  console.log(chalk.white('  Author: ') + chalk.yellow('laiduc1312'));
  console.log('\n');
  console.log(chalk.white('  📡 Supported Services:'));
  console.log(chalk.magenta('    • Gofile ') + chalk.gray('(Default, Anonymous, API Key)'));
  console.log(chalk.green('    • Pixeldrain ') + chalk.gray('(Requires API Key, Free: 10GB limit, limit speed upload)'));
  console.log('\n');
  console.log(chalk.white('  Quick Start:'));
  console.log(chalk.cyan('    pld -s <file> gf    ') + chalk.gray('Upload to Gofile'));
  console.log(chalk.cyan('    pld -s <file> pd    ') + chalk.gray('Upload to Pixeldrain'));
  console.log(chalk.cyan('    pld -ls             ') + chalk.gray('Show history'));
  console.log(chalk.cyan('    pld --config        ') + chalk.gray('Configure API keys'));
  console.log(chalk.cyan('    pld -h              ') + chalk.gray('Show help'));
  console.log('\n');
}

