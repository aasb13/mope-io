# Mope.io reverse engineered

A simple mope.io client that injects into the websocket. (Most packets were completely reverse engineered)

## Overview

This project builds and injects a userscript into mope.io to intercept all WebSocket packets. A Python controller manages the browser session via SeleniumBase (UC mode), injects the userscript, and drains packet logs.

## Installation

### Prerequisites

- Python 3.8+
- Chromium/Chrome browser

### Setup

1. Clone the repository:
```bash
git clone https://github.com/aasb13/mopeio
cd mopeio
```

2. Create a virtual environment:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Build the Userscript

```bash
python3 scripts/build_userscript.py
```

This compiles the source files from `src/userscript/` into a fat `userscript.js`.

### Launch the Controller

```bash
python3 run_controller.py
```

### Command-Line Options

- `--browser`: Browser to use (chromium, chrome, edge) [default: chromium]
- `--url`: Target URL [default: https://mope.io/]
- `--headless`: Run browser in headless mode
- `--browser-profile-dir`: Persistent browser profile directory
- `--no-browser-profile`: Use temporary profile instead
- `--skip-build`: Skip userscript rebuild
- `--script`: Path to prebuilt userscript.js
- `--packet-log-file`: Write packet logs to JSONL file [default: packet_logs.jsonl]
- `--no-packet-log-file`: Disable file logging
- `--packet-log-stdout`: Pretty-print packet logs to stdout
- `--packet-log-viewer`: Start web-based packet viewer
- `--no-open-packet-log-viewer`: Start viewer server without opening browser
- `--no-debug-log-viewer`: Disable debug viewer
- `--no-open-debug-log-viewer`: Start debug viewer without opening browser

## Project Structure

```
mopeai/
├── assets/                 # Deobfuscated game source files
│   └── deobf.js            # Primary reference for packet structure
├── controller/             # Python controller logic
│   ├── browser.py          # Browser configuration and driver creation
│   ├── inject.py           # Userscript injection
│   ├── browser_log_pump.py # Log collection from browser
│   ├── log_viewer.py       # Log viewer server setup
│   └── main.py             # Main entry point
├── scripts/
│   └── build_userscript.py # Userscript build script
├── src/userscript/         # Userscript source files
│   ├── core/               # Core packet handling
│   ├── event/              # Event system
│   ├── module/             # Modular features
│   ├── network/            # Packet parsers
│   ├── structures/         # Game data structures
│   ├── ui/                 # UI components
│   └── utils/              # Utility functions
├── viewer/                 # Web viewer HTML files
│   ├── index.html          # Packet viewer UI
│   └── debug.html          # Debug log viewer UI
├── userscript.js           # Built userscript (generated, excluded from git)
├── requirements.txt        # Python dependencies
└── run_controller.py       # Controller entry point
```

## Packet File Naming

Packet parsers in `src/userscript/network/` follow the pattern:
```
{ID}_{C/S}{PacketName}.js
```

- `ID`: Packet ID number
- `C`: Client-sent packet
- `S`: Server-sent packet
- `PacketName`: Descriptive packet name

Example: `5_CMovementPacket.js` (ID 5, client-sent, movement data)

## Dependencies

- seleniumbase>=4.40,<5
- python-socketio>=5.12,<6
