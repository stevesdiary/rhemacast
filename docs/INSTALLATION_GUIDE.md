# Rhema Pro — Installation & Setup Guide

Real-time AI-powered Bible verse detection, hymn presentation, and Strong's lexicon for live church services and broadcasts.

---

## 🪟 Windows Installation (Windows 10 / 11 x64)

### Step 1: Download
Download the latest Windows installer from the release downloads:
- **`Rhema-windows-x64-setup.exe`** (or `.msi`)

### Step 2: Run the Installer
1. Double-click the downloaded setup file.
2. Follow the standard installation wizard prompts to choose your install location and complete the setup.

### Step 3: Bypass Windows SmartScreen (First Launch)
Because Rhema Pro is an independent open-source release without an enterprise code-signing certificate, Windows Defender SmartScreen may display a warning:
1. When the blue **"Windows protected your PC"** dialog appears, click the **"More info"** link.
2. Click the **"Run anyway"** button that appears.

### Step 4: Grant Microphone Access
- When prompted, grant Rhema Pro access to your **Microphone / Audio input**. This enables real-time speech-to-text and AI verse detection.

---

## 🍎 macOS Installation (Apple Silicon — M1/M2/M3/M4)

### Step 1: Download
Download the latest macOS disk image:
- **`Rhema Pro_0.3.4_aarch64.dmg`**

### Step 2: Install
1. Double-click the `.dmg` file to open it.
2. Drag the **Rhema Pro.app** icon into your **Applications** folder.
3. Eject the disk image.

### Step 3: macOS Gatekeeper Authorization (First Launch Only)
Because the app is not notarized through Apple's paid Developer Program, macOS Gatekeeper will protectively block the first run:

#### Method A: Via System Settings (Recommended)
1. In your **Applications** folder, double-click **Rhema Pro**. Click **Cancel** on the alert.
2. Open **System Settings** → **Privacy & Security**.
3. Scroll down to the **Security** section where you will see:
   > *"Rhema Pro was blocked from use because it is not from an identified developer."*
4. Click **Open Anyway** and enter your Mac password or Touch ID.
5. Click **Open** on the final confirmation prompt.

#### Method B: Via Terminal (Fastest)
Open the **Terminal** app and paste the following command, then press Enter:
```bash
xattr -cr "/Applications/Rhema Pro.app"
```
*(This safely clears the browser quarantine attribute from the app bundle.)*

### Step 4: Grant Microphone Permission
- On the first run, macOS will prompt: *"Rhema Pro would like to access the microphone."* Click **OK / Allow**.

---

## ⚙️ Post-Installation Setup & Configuration

Once Rhema Pro is open, take 60 seconds to configure your hardware:

### 1. Audio Source (Pulpit / Preacher Microphone)
1. Click **Settings** (⚙️ gear icon, bottom-left of the sidebar).
2. Under **Audio Input Device**, select your active microphone, USB mixer, or audio interface.
3. Verify that the audio level meter moves when speaking.

### 2. Live Broadcast & Projection Display
1. In the header bar, click **Outputs** (or open **Broadcast Outputs**).
2. Choose your destination:
   - **External Display / Projector**: Select your second monitor or church projector.
   - **NDI Output**: Enable NDI to stream transparency-keyed lower-thirds directly into OBS, vMix, or ATEM.
3. Select an active theme from the **Theme Designer** (or use the default Modern Dark theme).

### 3. Service Schedule
- Add songs from the **Songs** library and scriptures from the **Bible** panel to build your service schedule.
- Use arrow keys (<kbd>↓</kbd> / <kbd>↑</kbd>) to step smoothly through items.
- Toggle **Auto Live** to immediately push selected scriptures or song lyrics to the live display.

---

## ❓ Frequently Asked Questions & Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **"App is damaged and can't be opened" on macOS** | Run `xattr -cr "/Applications/Rhema Pro.app"` in Terminal to clear the quarantine flag. |
| **Speech is not transcribing** | Check **Settings → Audio Device** and make sure your input gain is sufficient and permission is granted. |
| **Need lower thirds for OBS / vMix** | Use the NDI output mode with alpha channel enabled, or create a lower-third theme in the **Theme Designer**. |
