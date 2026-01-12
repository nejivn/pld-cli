#!/bin/bash
# PLD CLI - Quick Install Script for Linux/macOS
# Usage: curl -fsSL https://raw.githubusercontent.com/laiduc1312209/pld-cli/main/install.sh | bash

set -e

echo "📤 Installing PLD CLI..."

# Configuration
VERSION="1.0.0"
INSTALL_DIR="$HOME/.local/share/pld-cli"
ZIP_URL="https://github.com/laiduc1312209/pld-cli/archive/refs/tags/$VERSION.zip"
TEMP_ZIP="/tmp/pld-cli.zip"

# Check Node.js
echo "Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is required but not installed."
    echo "Please install Node.js from: https://nodejs.org"
    exit 1
fi

# Download
echo "Downloading PLD CLI v$VERSION..."
curl -fsSL "$ZIP_URL" -o "$TEMP_ZIP"

# Extract
echo "Extracting..."
rm -rf "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR"
unzip -q "$TEMP_ZIP" -d /tmp
mv "/tmp/pld-cli-$VERSION"/* "$INSTALL_DIR/"
rm -rf "/tmp/pld-cli-$VERSION" "$TEMP_ZIP"

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR"
npm install --production --silent

# Create executable wrapper
cat > "$INSTALL_DIR/pld" << 'EOF'
#!/bin/bash
node "$HOME/.local/share/pld-cli/index.js" "$@"
EOF
chmod +x "$INSTALL_DIR/pld"

# Add to PATH
echo "Adding to PATH..."
mkdir -p "$HOME/.local/bin"
ln -sf "$INSTALL_DIR/pld" "$HOME/.local/bin/pld"

# Update PATH in shell config
SHELL_CONFIG=""
if [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
fi

if [ -n "$SHELL_CONFIG" ]; then
    if ! grep -q '.local/bin' "$SHELL_CONFIG"; then
        echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_CONFIG"
    fi
fi

echo ""
echo "✅ PLD CLI installed successfully!"
echo ""
echo "📝 Next steps:"
echo "  1. Restart your terminal (or run: source $SHELL_CONFIG)"
echo "  2. Run: pld --config"
echo "  3. Run: pld -s <file>"
echo ""
echo "Installed to: $INSTALL_DIR"
