# AIChatX — Collaborative Real-Time Coding & AI Workspace

AIChatX is a unified, real-time collaborative development workspace built to address the friction of modern software team collaboration. It consolidates **coding**, **real-time chat**, **context-aware AI assistance**, and **multi-language code execution** into a single cohesive interface.

---

## 🚀 The Problem & Solution

### The Friction in Modern Collaboration
* **Broken Workflows:** Developers frequently toggle between external chat applications, separate code editors, web search, AI tools, and local terminal screens, causing context-switching fatigue.
* **"Works on My Machine" Syndrome:** Different local environments and system setups lead to discrepancies in code execution when testing and debugging collaboratively.
* **Collaboration Silos:** Sharing files and pair programming in real time is often complex, requiring heavy external tool configuration.

### The AIChatX Solution
AIChatX brings your entire environment under one roof:
1. **Consolidated Interface:** Code editor, live chat, multi-language runner, and interactive AI assistant in a single browser window.
2. **Zero-Setup Code Execution:** Run code immediately on the backend server with dynamic, interactive WebSocket terminals, standardizing code runtime behavior.
3. **Instant Syncing:** Collaborator additions, real-time message feeds, and folder/file trees are kept in sync automatically.

---

## 🛠 Features

* **Real-time Live Chat:** Connect with teammates immediately using Socket.io. Mention teammates in the chat via `@email`.
* **Context-Aware AI Assistant (`@ai`):** Call the AI assistant directly inside the chat using `@ai`. Mention files with `@filename.ext` (e.g., `@app.js`) to feed their contents directly into the AI's prompt. The AI automatically compiles changes and applies them as a delta patch, automatically updating the workspace files.
* **Rich Code Editor:** Full-featured code editing powered by Monaco Editor (`@monaco-editor/react`) with custom syntax highlighting, automatic saving, and tab-based file navigation.
* **Dynamic File System Management:** Create files, upload multiple files or entire folder directories at once via standard pickers, or drag-and-drop files directly into the workspace tree.
* **Secure, Interactive Multi-Language Sandbox:** Write and execute code in 12+ programming languages. Interactive terminals allow running processes, feeding inputs via `stdin`, streaming outputs via `stdout`/`stderr`, or terminating long-running processes via WebSockets.
* **Dynamic Invitation Pipeline:** Secure invitation links with cryptographic tokens generated and dispatched via email services (e.g. SendGrid).

---

## 🏗 System Architecture

AIChatX is built on a modular MERN stack (MongoDB, Express, React, Node.js) paired with WebSockets:

```mermaid
graph TD
    subgraph Frontend [React Client]
        UI[Workspace View]
        Editor[Monaco Editor]
        Chat[Chat & Team Mentions]
        FS[File Tree Manager / DND Upload]
    end

    subgraph Transport [Real-time Pipeline]
        WS[Socket.io WebSockets]
        WSTerm[/terminal Namespace]
        API[HTTP REST API]
    end

    subgraph Backend [Node.js Server]
        Exp[Express.js App]
        AiService[Gemini AI Handler]
        ExecCtrl[Interactive Execution Controller]
    end

    subgraph Runtime [Local Execution Sandbox]
        CP[Child Process Spawn]
        TmpDir[Isolated Temp Directories]
    end

    subgraph Database [Storage / Services]
        MDB[(MongoDB Atlas)]
        SG[SendGrid / SMTP API]
    end

    UI --> Editor
    UI --> Chat
    UI --> FS
    
    Editor & Chat & FS --> WS
    UI --> API
    
    WS --> Exp
    WSTerm --> ExecCtrl
    API --> Exp
    
    Exp --> AiService
    AiService -->|Gemini API| GAI[Google Generative AI]
    
    ExecCtrl --> CP
    CP --> TmpDir
    
    Exp --> MDB
    Exp --> SG
```

### Supported Execution Runtimes

The platform securely compiles and executes files inside isolated temporary directories:

| Language | Runtime Tooling | Input/Output |
| :--- | :--- | :--- |
| **JavaScript / Node.js** | Node.js Engine | Yes (Interactive Stdin / Live Stdout) |
| **TypeScript** | Node.js (`--experimental-strip-types`) | Yes (Interactive Stdin / Live Stdout) |
| **Python** | Python 3 | Yes (Interactive Stdin / Live Stdout) |
| **C / C++** | GCC / G++ (Compile step + Execution) | Yes (Interactive Stdin / Live Stdout) |
| **Java** | Javac Compiler + Java VM | Yes (Interactive Stdin / Live Stdout) |
| **Go** | Go runtime (`go run`) | Yes (Interactive Stdin / Live Stdout) |
| **Rust** | Rustc Compiler + Binary | Yes (Interactive Stdin / Live Stdout) |
| **Bash, PHP, Ruby, Lua, Perl** | Standard System Interpreters | Yes (Interactive Stdin / Live Stdout) |

---

## 💻 Tech Stack

### Frontend
* **Core:** React 18, Vite
* **Styling:** Tailwind CSS, PostCSS
* **Code Editor:** Monaco Editor
* **Icons:** Remix Icon
* **Real-time Comms:** Socket.io-client
* **Utilities:** Highlight.js, Markdown-to-JSX

### Backend
* **Runtime:** Node.js, Express
* **Database:** MongoDB (via Mongoose), Redis (via ioredis)
* **Real-time Pipeline:** Socket.io
* **AI Engine:** Google Generative AI (Gemini SDK)
* **Authentication:** JWT, Bcrypt, Cookie Parser
* **Email dispatch:** SendGrid Node Mailer / SMTP

---

## 🚀 Setup & Installation

Follow these steps to set up AIChatX on your local environment:

### Prerequisites
* **Node.js** (v18+ recommended)
* **MongoDB** instance (local or Atlas)
* **Redis** server running locally or hosted
* **Google Gemini API Key** (Get one from Google AI Studio)
* Compiler runtimes (`gcc`, `g++`, `python3`, `go`, `rustc`, `javac`) if you plan to compile/execute code in those languages locally.

### 1. Clone the Repository
```bash
git clone <repository-url>
cd AIChatX/AICHATX
```

### 2. Configure Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
4. Update the `.env` variables:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/aichatx
   JWT_SECRET=your_super_secret_jwt_key
   GOOGLE_AI_KEY=your_gemini_api_key
   GEMINI_MODEL=gemini-2.5-flash
   REDIS_HOST=127.0.0.1
   REDIS_PORT=6379
   REDIS_PASSWORD=
   FRONTEND_URL=http://localhost:5173
   
   # Setup Mail Provider (SendGrid recommended)
   MAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDGRID_FROM_EMAIL="AIChatX <no-reply@yourdomain.com>"
   ```
5. Start the backend server:
   ```bash
   npm start
   ```

### 3. Configure Frontend Setup
1. Open a new terminal session and navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```bash
   echo "VITE_API_URL=http://localhost:3000" > .env
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```

Open your browser and navigate to `http://localhost:5173` to register your account and build your first workspace!

---

## 🤝 Using Collaborative Features

### Inviting Teammates
1. Click **Add member** in the top navigation bar.
2. Enter your teammate's email address and send the invitation.
3. Your teammate will receive an email containing a secure invite link to register/login and join your workspace.

### Working with the AI Assistant
You can mention `@ai` in the project chat to generate code or troubleshoot:
* **Ask Questions:** `@ai Explain how async-await works in Node.js.`
* **Update Code Editor:** `@ai Create a new utility function to calculate dates.`
* **File-Specific Context:** `@ai Refactor the code in @main.js to handle exceptions.` (The contents of `main.js` will automatically be loaded as prompt context).
* The AI returns a JSON structure mapping file updates. AIChatX reads this and applies the new file/code directly into your editor, instantly sync-updating all active collaborators' screens!

### Compiling & Running Code
1. Select a code file from the **Files** panel.
2. Ensure you have selected a supported language extension.
3. Click the **Run** button at the top right.
4. A terminal overlay opens at the bottom, running your compiled or interpreted program.
5. If the program requests console inputs (`stdin`), type in the terminal input box and press **Enter** to stream the input into the running child process.
6. Click **Kill** to terminate a running program or infinite loop.
