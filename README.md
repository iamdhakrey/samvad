<div align="center">

# ⚡ Samvad (संवाद)

**The Blazing-Fast, Lightweight, Native Multi-Protocol API Client.**

[![GitHub Stars](https://img.shields.io/github/stars/iamdhakrey/samvad?style=for-the-badge&logo=github&color=FACC15)](https://github.com/iamdhakrey/samvad/stargazers)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Tauri 2](https://img.shields.io/badge/Tauri-2.0-24C8D8?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app/)
[![Rust](https://img.shields.io/badge/Rust-Backend-DEA584?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)

<p align="center">
  <a href="#-why-samvad">Why Samvad?</a> •
  <a href="#-key-features">Key Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-contributing">Contributing</a>
</p>

*Samvad (संवाद)* is the Sanskrit/Hindi word for *"dialogue"* or *"meaningful conversation"* - representing seamless, frictionless communication between clients and modern APIs.

---

</div>

## Why Samvad?

Tired of clunky API clients that consume 1 GB+ of RAM, take 10 seconds to open, and force cloud logins just to test a local endpoint? 

**Samvad is engineered differently:**

| Feature | Postman / Insomnia | ⚡ Samvad |
| :--- | :--- | :--- |
| **Engine** | Electron (Heavy Chromium bundle) | **Rust + Tauri 2 (Native OS Webview)** |
| **Memory Footprint** | ~500 MB – 1.2 GB RAM | **< 60 MB RAM** |
| **Startup Time** | 4 – 10 seconds | **< 100 milliseconds** |
| **Protocols** | Plugin/Tier-dependent | **REST, gRPC, WebSockets & GraphQL** |
| **Data Privacy** | Cloud-forced sync | **100% Offline-first (Local Files)** |
| **Code Editor** | Basic text inputs | **Full VS Code Monaco Editor** |

---

## Key Features

### Multi-Protocol Mastery
- **REST / HTTP**: Full support for `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`.
- **gRPC Studio**: 
  - Dynamic `.proto` file parsing and reflection.
  - Comprehensive streaming: **Unary**, **Client Streaming**, **Server Streaming**, and **Bidirectional Streaming**.
  - Detailed metadata, headers, trailers, and status code inspection.
- **WebSocket Inspector**:
  - Live WS/WSS connection manager.
  - Interactive bi-directional frame messaging with JSON formatting and message history.
- **GraphQL Explorer(In-Progress)**:
  - Write queries, mutations, and variables with real-time payload previews.

### Modern Developer Experience
- **Command Palette (`Cmd/Ctrl + K`)**: Instant keyboard-driven navigation across tabs, requests, collections, and tools.
- **Ultra-Sleek Titlebar Breadcrumb**: Switch Workspaces, Collections, and Environments in a single click straight from the header.
- **Monaco Editor**: The same editor engine that powers VS Code - featuring full syntax highlighting, folding, and JSON prettification.
- **Dynamic Environment Variables**: Seamless interpolation with `{{variable}}` syntax, secret masking, and instant environment swapping.
- **Workspaces & Nested Collections**: Organize endpoints into deep folder hierarchies with intuitive tab management.
- **Privacy First**: Your requests and environment variables stay on your machine.

---

## Tech Stack

<div align="center">

```
┌─────────────────────────────────────────────────────────┐
│                     SAMVAD ARCHITECTURE                 │
├────────────────────────────┬────────────────────────────┤
│         FRONTEND           │          BACKEND           │
│   • React 19               │   • Tauri 2.0 (Rust)       │
│   • TypeScript             │   • Tokio (Async Runtime)  │
│   • Tailwind CSS 4         │   • Reqwest (HTTP Engine)  │
│   • Monaco Editor          │   • Tonic / Prost (gRPC)   │
│   • Zustand (State Engine) │   • Local Storage          │
└────────────────────────────┴────────────────────────────┘
```

</div>

---

## Getting Started

### Prerequisites
Make sure you have installed:
- [Node.js](https://nodejs.org/) (v18+) or [Bun](https://bun.sh/)
- [Rust](https://www.rust-lang.org/tools/install) (1.75+)
- Platform build essentials (e.g., Xcode Command Line Tools on macOS, `build-essential` on Linux)

### Quick Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/iamdhakrey/samvad.git
   cd samvad
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or: npm install / pnpm install / yarn
   ```

3. **Run in Development Mode**
   ```bash
   bun run tauri dev
   # or: npm run tauri dev
   ```

### Building for Production

To create an optimized, native desktop binary (`.dmg`, `.deb`/`.AppImage`, or `.msi`/`.exe`):

```bash
bun run tauri build
```

The output bundle will be generated in `src-tauri/target/release/bundle/`.

---

## Contributing

Contributions make the open-source community thrive! Any contributions you make are **greatly appreciated**.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feat/AmazingFeature`)
5. Open a Pull Request

---

## Show Your Support

If you love the idea of a lightning-fast, native, privacy-first API client, please give **Samvad** a **Star (⭐️)**! It helps the project grow and motivates ongoing development.

---

## Author

**Hrithik Dhakrey**  
- GitHub: [@iamdhakrey](https://github.com/iamdhakrey)
