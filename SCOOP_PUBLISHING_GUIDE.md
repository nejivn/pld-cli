# 📦 Hướng dẫn đưa pld-cli-send lên Scoop

## 🎯 Tổng quan

Scoop là một package manager cho Windows. Để publish ứng dụng lên Scoop, bạn cần:
1. ✅ Repository GitHub công khai
2. ✅ GitHub Releases với file binary/source code
3. ✅ Scoop manifest file (đã tạo: `pld-cli-send.json`)
4. ✅ Submit manifest vào Scoop bucket

---

## 📝 Bước 1: Chuẩn bị GitHub Repository

### 1.1. Tạo GitHub Repository (nếu chưa có)

```bash
# Khởi tạo git (nếu chưa có)
git init

# Thêm remote repository
git remote add origin https://github.com/YOUR_USERNAME/pld-cli-send.git

# Commit code
git add .
git commit -m "Initial release v1.0.0"
git push -u origin main
```

### 1.2. Đảm bảo file `.gitignore` đầy đủ

File `.gitignore` nên chứa:
```
node_modules/
.pld/
*.log
.DS_Store
```

---

## 📦 Bước 2: Tạo GitHub Release

### 2.1. Đóng gói source code

Bạn có 2 lựa chọn:

**Option A: Đóng gói source code (khuyến nghị cho Node.js CLI)**

```powershell
# Tạo folder release
mkdir release
cd release

# Copy files cần thiết (KHÔNG copy node_modules)
Copy-Item ..\index.js .
Copy-Item ..\package.json .
Copy-Item ..\package-lock.json .
Copy-Item ..\README.md .
Copy-Item ..\.gitignore .

# Tạo archive
Compress-Archive -Path * -DestinationPath ..\pld-cli-send-1.0.0.zip

cd ..
```

**Option B: Sử dụng GitHub để tự động tạo source code archive**

GitHub tự động tạo `.zip` và `.tar.gz` cho mỗi release. Bạn chỉ cần:
1. Tạo release trên GitHub
2. Sử dụng URL auto-generated của GitHub

### 2.2. Tính SHA256 hash của file .zip

```powershell
Get-FileHash pld-cli-send-1.0.0.zip -Algorithm SHA256
```

Copy hash này, bạn sẽ cần nó cho manifest.

### 2.3. Tạo Release trên GitHub

1. Truy cập: `https://github.com/YOUR_USERNAME/pld-cli-send/releases/new`
2. **Tag version:** `v1.0.0`
3. **Release title:** `v1.0.0 - Initial Release`
4. **Description:** 
   ```markdown
   ## ✨ Features
   - 🚀 Fast file uploads with Pixeldrain
   - 🎨 Beautiful terminal UI
   - 📋 Automatic clipboard integration
   - 📊 Upload history tracking
   - 🔐 Secure API key management

   ## 📦 Installation via Scoop
   \`\`\`
   scoop bucket add extras
   scoop install pld-cli-send
   \`\`\`
   ```
5. **Upload file:** Attach file `pld-cli-send-1.0.0.zip`
6. Click **Publish release**

---

## 🔧 Bước 3: Cập nhật Scoop Manifest

Mở file `pld-cli-send.json` và cập nhật:

```json
{
    "version": "1.0.0",
    "description": "Beautiful CLI tool for uploading and sharing files instantly via Pixeldrain",
    "homepage": "https://github.com/YOUR_USERNAME/pld-cli-send",
    "license": "MIT",
    "architecture": {
        "64bit": {
            "url": "https://github.com/YOUR_USERNAME/pld-cli-send/releases/download/v1.0.0/pld-cli-send-1.0.0.zip",
            "hash": "YOUR_SHA256_HASH_HERE"
        }
    },
    "extract_dir": "pld-cli-send-1.0.0",
    ...
}
```

**Thay thế:**
- `YOUR_USERNAME` → GitHub username của bạn
- `YOUR_SHA256_HASH_HERE` → SHA256 hash từ bước 2.2

---

## 🚀 Bước 4: Test Manifest Locally

Trước khi submit, test manifest trên máy local:

```powershell
# Cài đặt Scoop (nếu chưa có)
# irm get.scoop.sh | iex

# Test install từ local manifest
scoop install .\pld-cli-send.json

# Test command
pld --help

# Uninstall để test lại
scoop uninstall pld-cli-send
```

---

## 📤 Bước 5: Submit vào Scoop Bucket

Có 2 cách submit:

### Cách 1: Submit vào Official Scoop Bucket (Khuyến nghị)

1. **Fork repository:**
   - Main bucket: https://github.com/ScoopInstaller/Main
   - Extras bucket: https://github.com/ScoopInstaller/Extras (cho GUI/CLI apps)

2. **Clone fork của bạn:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Extras.git
   cd Extras
   ```

3. **Thêm manifest:**
   ```bash
   # Copy manifest vào bucket/
   cp /path/to/pld-cli-send.json bucket/pld-cli-send.json

   # Commit
   git add bucket/pld-cli-send.json
   git commit -m "pld-cli-send: Add version 1.0.0"
   git push
   ```

4. **Tạo Pull Request:**
   - Truy cập: `https://github.com/ScoopInstaller/Extras/compare`
   - Chọn fork của bạn
   - Tạo PR với title: `pld-cli-send: Add version 1.0.0`
   - Mô tả PR:
     ```markdown
     ## Description
     Add pld-cli-send, a beautiful CLI tool for uploading and sharing files via Pixeldrain.

     ## Features
     - Fast file uploads with streaming support
     - Beautiful terminal UI with colors and animations
     - Automatic clipboard integration
     - Upload history tracking
     - Secure API key management

     ## Checklist
     - [x] Manifest follows Scoop guidelines
     - [x] App installs and runs correctly
     - [x] License is specified (MIT)
     - [x] Homepage link is valid
     - [x] Hash is correct
     ```

5. **Đợi review:**
   - Scoop maintainers sẽ review PR
   - Họ có thể yêu cầu thay đổi
   - Sau khi approve, manifest sẽ được merge

### Cách 2: Tạo Custom Bucket (Nhanh hơn)

Nếu muốn publish nhanh mà không đợi review:

1. **Tạo bucket repository:**
   ```bash
   # Tạo repo mới trên GitHub: scoop-bucket

   git clone https://github.com/YOUR_USERNAME/scoop-bucket.git
   cd scoop-bucket

   # Thêm manifest
   cp /path/to/pld-cli-send.json pld-cli-send.json

   # Commit & push
   git add pld-cli-send.json
   git commit -m "Add pld-cli-send manifest"
   git push
   ```

2. **Hướng dẫn users cài đặt:**
   ```powershell
   # Add custom bucket
   scoop bucket add YOUR_USERNAME https://github.com/YOUR_USERNAME/scoop-bucket

   # Install
   scoop install pld-cli-send
   ```

---

## 🎯 Bước 6: Cập nhật README

Thêm hướng dẫn cài đặt qua Scoop vào `README.md`:

```markdown
## 📦 Installation

### Via Scoop (Recommended for Windows)

```powershell
# Official bucket (sau khi được approve)
scoop bucket add extras
scoop install pld-cli-send
```

### Via npm (Alternative)

```bash
npm install -g pld-cli-send
```
```

---

## 🔄 Update Versions Trong Tương Lai

Khi release version mới:

1. **Update package.json:**
   ```json
   "version": "1.1.0"
   ```

2. **Tạo GitHub release mới:**
   - Tag: `v1.1.0`
   - Upload file: `pld-cli-send-1.1.0.zip`

3. **Update manifest:**
   - Nếu dùng official bucket: Tạo PR với updated manifest
   - Nếu dùng custom bucket: Update và push

4. **Test:**
   ```powershell
   scoop update
   scoop update pld-cli-send
   ```

---

## ✅ Checklist Hoàn Chỉnh

- [ ] Repository GitHub công khai đã tạo
- [ ] Code đã push lên GitHub
- [ ] Đã tạo GitHub Release v1.0.0
- [ ] File .zip đã upload vào release
- [ ] SHA256 hash đã tính và update vào manifest
- [ ] Manifest đã test thành công locally
- [ ] Đã fork Scoop Extras bucket
- [ ] Đã tạo Pull Request
- [ ] README đã update với hướng dẫn Scoop

---

## 📚 Tài Liệu Tham Khảo

- [Scoop Documentation](https://scoop.sh/)
- [Creating Manifests Guide](https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests)
- [Scoop Extras Bucket](https://github.com/ScoopInstaller/Extras)
- [Contributing to Scoop](https://github.com/ScoopInstaller/Scoop/wiki/Contributing)

---

## 🆘 Troubleshooting

### Hash mismatch error
```powershell
# Tính lại hash
Get-FileHash path\to\file.zip -Algorithm SHA256
# Update hash trong manifest
```

### Install fails
```powershell
# Check logs
scoop install pld-cli-send --verbose

# Clean cache
scoop cache rm pld-cli-send
scoop uninstall pld-cli-send
scoop install pld-cli-send
```

### PR bị reject
- Đọc comments từ maintainers
- Fix theo yêu cầu
- Push thêm commits vào cùng branch

---

**Good luck! 🚀**
