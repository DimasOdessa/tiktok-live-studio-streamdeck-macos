# TikTok LIVE Studio Stream Deck plugin for macOS

An **unofficial macOS adaptation** of the TikTok LIVE Studio Stream Deck plugin for Windows, version 1.1.5. This project adapts the existing plugin for macOS; it is not an independently developed replacement or an official TikTok release.

**Original plugin:** [TikTok LIVE Studio on Elgato Marketplace](https://marketplace.elgato.com/product/tiktok-live-studio-ba05f173-6d92-4b6e-9f23-fbf0d61ee79e), published by **TikTok LIVE Studio**.

The original JavaScript logic, translations and artwork are retained. This repository contains macOS compatibility changes and a few packaging fixes. It is not affiliated with, endorsed by, or supported by TikTok or Elgato.

## Download and install

1. [Download the macOS plugin](https://github.com/DimasOdessa/tiktok-live-studio-streamdeck-macos/raw/refs/heads/main/TikTok-LIVE-Studio-1.1.5.1-macOS.streamDeckPlugin).
2. Double-click the `.streamDeckPlugin` file and confirm installation in Stream Deck.
3. Open TikTok LIVE Studio, sign in and enter its main workspace.
4. Find **TikTok LIVE Studio (macOS)** in the Stream Deck actions list.
5. Add an action to a key or dial and configure its scene, source or audio device.

Start by testing scene switching. Test recording and broadcast controls only when you intend to activate them.

The plugin keeps the original `com.tiktok.livestudio` identity. Installing it may replace an existing version of that plugin. A microphone dial configured with the original incorrect `MicControl` identifier must be added again.

## Requirements

- macOS 13 or later, as declared in the adapted manifest.
- Stream Deck 6.4 or later, as declared in the adapted manifest.
- TikTok LIVE Studio for macOS, open in its main workspace.
- A suitable Stream Deck device; dial actions require dial-capable hardware.

The connection was verified against TikTok LIVE Studio **1.38.0**. Compatibility with all earlier or later versions is not established. Some Studio configurations require a connected Elgato USB device to issue a local authentication token; this adaptation does not bypass that requirement.

## What changed

- Enabled macOS installation and application monitoring using `com.tiktok.livestudio.desktop`.
- Added support for Studio's local token authentication while retaining the original WebSocket subprotocol.
- Corrected the microphone dial action identifier to `miccontrol`.
- Restored missing audio dial icons using artwork from the original package.
- Updated package metadata to identify this macOS adaptation.

All 26 action definitions are retained, including scene/source controls, microphone/audio controls, recording, broadcast controls, effects and LIVE tools. Individual features depend on Studio, account eligibility and the current broadcast state.

See [CHANGES.txt](CHANGES.txt) for the exact changes and original package checksum.

## Verification and limitations

- Manifest, entry points and action image resources checked.
- Authentication success and failure scenarios tested.
- Scene state, scene key presses and microphone dial handling tested with a simulated Studio server.
- The adapted JavaScript bundle connected to real macOS Studio and received settings through a Node-based test harness. Real-server tests allowed only room joining and settings synchronization.

**These checks do not establish execution inside Stream Deck's Chromium runtime or physical-device operation. All 26 actions have not been manually verified.** No broadcast, recording or device-control commands were sent during the real-server test.

The integration uses Studio's local protocol and may require updates when Studio changes. Authentication tokens introduced by the adaptation remain in memory and are not logged or saved by the authentication helper.

## Source and tests

The ready-to-run plugin is in `com.tiktok.livestudio.sdPlugin/`. No JavaScript compilation is required.

Run the simulated checks with Node.js 24 or later:

```sh
node tests/verify.cjs
```

Optionally check the local connection to an already running Studio instance, without sending control actions:

```sh
node tests/verify.cjs --live
```

Rebuild the installer with Python 3:

```sh
python3 package.py
```

## Attribution and rights

Original plugin code, translations and artwork belong to their respective rights holders, including TikTok LIVE Studio. TikTok and Elgato trademarks remain the property of their respective owners.

No redistribution license was found in the supplied original package. This repository does not relicense the original materials or claim ownership of them; attribution alone does not grant redistribution rights. No endorsement or permission from TikTok is claimed. A blanket open-source license is therefore not assigned to this adaptation.

Original plugin support: **sd.feedback@tiktok.com**, as listed on its [Marketplace page](https://marketplace.elgato.com/product/tiktok-live-studio-ba05f173-6d92-4b6e-9f23-fbf0d61ee79e). For issues specific to this adaptation, please use this repository's issue tracker.

The macOS adaptation and its tests/documentation were prepared with AI assistance.
