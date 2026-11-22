# Rhema Pro — User Installation & Setup Guide

*A step-by-step guide for media teams, sound operators, and church volunteers.*

---

## 🪟 Windows Installation Guide

Follow these steps to install and run the Windows setup file (`.exe`):

### 1. Open the Installer
- Locate and double-click the downloaded setup file: **`Rhema-windows-x64-setup.exe`**.

### 2. If Windows Shows a Blue Warning ("Windows protected your PC")
Because Rhema Pro is a newly released independent application, Windows SmartScreen may show an alert on the first launch:
1. Click the underlined text that says **"More info"**.
2. Click the **"Run anyway"** button that appears at the bottom-right.

### 3. Complete Setup
- Follow the on-screen prompts and click **Next** &rarr; **Install** &rarr; **Finish**.
- Rhema Pro is now installed and ready in your Start Menu and Desktop.

### 4. Allow Microphone Access
- When you first open the app, Windows will ask for permission to use your **Microphone**.
- Click **Yes / Allow**. *(This is required so the app can hear the sermon audio and detect Bible verses in real time.)*

---

## 🍎 Mac Installation Guide (Apple Silicon — M1, M2, M3, M4)

Follow these steps to install and run the Mac disk image (`.dmg`):

### 1. Open the File & Install
1. Double-click the downloaded file: **`Rhema Pro_0.3.4_aarch64.dmg`**.
2. A window will open showing **Rhema Pro** and your **Applications** folder.
3. Drag the **Rhema Pro** icon into the **Applications** folder.
4. Close the window and eject the disk image.

### 2. Opening for the First Time (Mac Security Notice)
On the very first launch, macOS will show a message that the app cannot be opened because it is from an unidentified developer. Here is how to open it:

1. Open your **Applications** folder and double-click **Rhema Pro**. When the alert pops up, click **Done** or **Cancel**.
2. Open your Mac's **System Settings** (click the Apple menu  at the top-left of your screen &rarr; **System Settings**).
3. In the left sidebar, click **Privacy & Security**.
4. Scroll down on the right until you see the **Security** section. You will see a note:
   > *"Rhema Pro was blocked from use because it is not from an identified developer."*
5. Click the **"Open Anyway"** button next to it.
6. Enter your Mac login password or Touch ID, then click **Open** on the final confirmation.

*(You only have to do this once. After this, Rhema Pro opens normally like any other Mac app.)*

### 3. Allow Microphone Access
- When prompted: *"Rhema Pro would like to access the microphone"*, click **OK / Allow**.

---

## 🚀 Setting Up for Your Church Service (3 Simple Steps)

### Step 1: Connect Your Pulpit Sound / Microphone
1. In Rhema Pro, click the **Settings** gear icon (⚙️ bottom-left corner).
2. Under **Audio Input Device**, select your active microphone, USB sound mixer, or audio interface (e.g. Focusrite, Behringer, Yamaha).
3. Speak into the microphone and confirm that the green volume meter is moving.

### Step 2: Connect Your Projector / TV Screen
1. Connect your HDMI cable from your computer to your church projector or second screen.
2. In the top bar of Rhema Pro, click **Outputs** (or open **Broadcast Outputs**).
3. Under **Display Output**, select your projector screen and click **Open Output Window**.
4. Full-screen Bible scriptures and hymns will now display on your projector.

### Step 3: Presenting Scriptures & Hymns During the Service
- **Automatic Bible Detection**: As the preacher speaks a scripture (e.g., *"Turn with me to John chapter 3 verse 16"*), Rhema Pro will automatically detect and highlight the verse on your screen.
- **Service Schedule**: Add your planned songs and scripture readings into the Schedule panel on the left.
- **Smooth Stepping**: Press the <kbd>↓</kbd> (Down Arrow) and <kbd>↑</kbd> (Up Arrow) keys on your keyboard to step from item to item.
- **Live Switch**: Turn the **Auto Live** toggle ON to project items immediately as you select them, or click the **Play** button on any verse or song slide.

---

## ❓ Quick Troubleshooting

| What you see | How to fix it |
| :--- | :--- |
| **"Windows protected your PC"** | Click **More info**, then click **Run anyway**. |
| **"Rhema Pro cannot be opened" on Mac** | Go to **System Settings → Privacy & Security**, scroll down, and click **Open Anyway**. |
| **Speech is not detecting verses** | In Settings (⚙️), make sure your microphone or soundboard is selected and the green audio meter responds to voice. |
| **Sending graphics to OBS or vMix** | Open **Outputs** and turn on **NDI Output**. In OBS or vMix, add an NDI Source to receive clean, transparent lower-thirds. |
