# Satomi — AI Anime VTuber for Pump.fun
### Full Technical Planning Document

---

## Overview

Satomi is an AI-powered anime character that livestreams 24/7 on Pump.fun. She reads live chat, detects when users mention her name, and responds in real-time with voice and animated lip sync. No paid TTS required. No VTube Studio required. Runs entirely from a web page captured by OBS.

**Core loop:**
```
Pump.fun chat → detect "satomi" keyword → Claude AI generates response → Web Speech API speaks it → Avatar mouth animates → Subtitles appear on stream
```

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     REPLIT SERVER (Node.js)                     │
│                                                                 │
│  ┌─────────────────────┐    ┌──────────────────────────────┐   │
│  │  Chat Intake Service │    │      Satomi AI Brain         │   │
│  │                     │    │                              │   │
│  │  pump-chat-client   │───▶│  Claude claude-haiku-4-5    │   │
│  │  Socket.IO client   │    │  System prompt: personality  │   │
│  │  Auto-reconnect     │    │  Max 2 sentences             │   │
│  │  Spam filter        │    │  Multilingual                │   │
│  └─────────────────────┘    └──────────────────────────────┘   │
│             │                              │                    │
│             ▼                              ▼                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WebSocket Server (ws library)               │   │
│  │        Pushes trigger messages + AI responses            │   │
│  │        to all connected stream page clients              │   │
│  └─────────────────────────────────────────────────────────┘   │
│             │                                                   │
│  ┌──────────▼──────────┐                                       │
│  │   Admin REST API    │                                       │
│  │   GET /api/satomi/  │                                       │
│  │   status, stats,    │                                       │
│  │   logs              │                                       │
│  └─────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
                    │ WebSocket (ws://)
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              BROWSER — Stream Page (/satomi)                    │
│                  (React + Vite)                                 │
│                                                                 │
│   ┌─────────────────┐   ┌──────────────────┐  ┌────────────┐  │
│   │  Anime Avatar   │   │  Web Speech API  │  │ Chat Feed  │  │
│   │  CSS animation  │◀──│  TTS (free)      │  │ Overlay    │  │
│   │  Lip sync       │   │  Drives mouth    │  │            │  │
│   └─────────────────┘   └──────────────────┘  └────────────┘  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                  Subtitle Bar                           │  │
│   │     "Hey Hon! The Solana memek protocol is..."          │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │ OBS Browser Source
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OBS STUDIO (free)                            │
│  Scene: Satomi Stream                                           │
│  Source: Browser Source → https://[replit-url]/satomi          │
│  Output: Custom RTMP → Pump.fun stream URL + stream key         │
└─────────────────────────────────────────────────────────────────┘
                    │ RTMP
                    ▼
              pump.fun/coin/<your-token>
```

---

## Research-Backed Tech Decisions

### 1. Pump.fun Chat — How It Actually Works

**Researched finding:** Pump.fun chat uses **Socket.IO v4** (not plain WebSocket). The endpoint is:
```
wss://client-api.pump.fun/socket.io/?EIO=4&transport=websocket
```

Reading chat is **unauthenticated** — you only need the token mint address. Sending messages requires session cookies.

**Message event format:**
```json
{
  "username": "hon",
  "message": "satomi what is the solana memek protocol?",
  "timestamp": 1712345678
}
```

**npm package available:** `pump-chat-client` — a ready-made Socket.IO wrapper. This is the primary method.

**Socket.IO connection code (what we build):**
```typescript
import { io } from "socket.io-client";

const socket = io("https://client-api.pump.fun", {
  transports: ["websocket"],
  path: "/socket.io/",
});

socket.on("connect", () => {
  socket.emit("join", { mint: TOKEN_MINT_ADDRESS });
});

socket.on("message", (data) => {
  // Filter: does message contain "satomi"?
  if (data.message.toLowerCase().includes("satomi")) {
    handleTrigger(data.username, data.message);
  }
});
```

**Auto-reconnect:** Socket.IO handles reconnect natively. We set `reconnectionDelay: 1000` and `reconnectionAttempts: Infinity`.

**Fallback if endpoint changes:** Puppeteer headless browser reads the chat DOM on the live token page. Less efficient but endpoint-agnostic.

**Risk:** `client-api.pump.fun` is undocumented and can change. Mitigation: we check DevTools → Network → WS on pump.fun to re-confirm on deploy.

---

### 2. Streaming to Pump.fun — Exact Steps

**Researched finding:** Pump.fun supports RTMP live streaming but it is rolled out to only ~5% of users. You need:
- A coin/token already created on pump.fun
- Access to the "Start Livestream" button on your token's page

**How to get RTMP credentials:**
1. Go to your token page on pump.fun
2. Click **"Start Livestream"** → select **"RTMP broadcast mode"**
3. Click **"Go Live"** — you receive:
   - RTMP Server URL (e.g. `rtmp://live.pump.fun/live`)
   - Stream Key (unique per stream)

**CRITICAL gotcha:** OBS must be connected AFTER you click Go Live on pump.fun. If you push OBS before the pump.fun stream is started, it won't connect.

**OBS Settings:**
```
Settings → Stream
  Service: Custom...
  Server: [RTMP URL from pump.fun]
  Stream Key: [stream key from pump.fun]
```

**Browser Source settings in OBS:**
```
Add Source → Browser Source
  URL: https://[replit-url]/satomi
  Width: 1280
  Height: 720
  FPS: 30
  ✓ Shutdown source when not visible
  ✓ Refresh browser when scene becomes active
```

**Alternative (no OBS needed):** LiveReacting.com — browser-based RTMP tool. You paste the Pump.fun RTMP URL and stream key, add the Replit URL as a browser source. Fully free tier available.

---

### 3. TTS — Web Speech API (100% Free)

**Researched finding:** `window.speechSynthesis` is built into all major browsers since 2018. Works in Chrome, Edge, Safari, Firefox. No API key. No cost. Runs 100% locally in the browser.

**Browser support for OBS Browser Source:** OBS uses Chromium-based engine — full Web Speech API support confirmed.

**Implementation pattern:**
```typescript
const speak = (text: string, onStart?: () => void, onEnd?: () => void) => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.1;  // slightly faster, energetic
  utterance.pitch = 1.2; // slightly higher pitch for anime character feel
  
  // Pick an English female voice if available
  const voices = speechSynthesis.getVoices();
  const preferred = voices.find(v => 
    v.lang.startsWith('en') && v.name.toLowerCase().includes('female')
  ) || voices.find(v => v.lang.startsWith('en'));
  
  if (preferred) utterance.voice = preferred;
  
  utterance.onstart = onStart ?? null;
  utterance.onend = onEnd ?? null;
  utterance.onboundary = (e) => {
    // Drives lip sync — fires on word boundaries
    triggerLipSync(e.charIndex, e.charLength);
  };
  
  speechSynthesis.speak(utterance);
};
```

**Critical `getVoices()` bug:** On Chrome, `getVoices()` returns empty on first call. Fix:
```typescript
const loadVoices = () => new Promise<SpeechSynthesisVoice[]>((resolve) => {
  const voices = speechSynthesis.getVoices();
  if (voices.length > 0) return resolve(voices);
  speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
});
```

---

### 4. Avatar Lip Sync — CSS Animation Approach

**Researched finding:** Industry-standard 2D lip sync uses 6–9 "viseme" mouth shapes (Hanna-Barbera standard, also used by Disney). For a simple anime avatar we only need 3–4 states.

**Simplest viable approach (what we use):**
- Generate Satomi avatar: full-body anime girl, neon purple outfit, streamer aesthetic
- Avatar image: static PNG (AI-generated), head/mouth area is separate layer
- Lip sync: CSS class toggling on mouth element — `mouth-closed`, `mouth-open`, `mouth-wide`
- Trigger: Web Speech API `onboundary` event fires on each word → toggle mouth state

**Mouth animation timing (CSS):**
```css
.avatar-mouth {
  transition: all 0.08s ease;
}
.mouth-closed  { /* default rest position */ }
.mouth-open    { transform: scaleY(1.4); }
.mouth-wide    { transform: scaleY(2.0) scaleX(1.1); }
```

**Algorithm for driving mouth from speech events:**
```typescript
// onboundary fires per word during TTS
utterance.onboundary = (event) => {
  if (event.name === 'word') {
    const vowels = /[aeiouAEIOU]/;
    const word = text.slice(event.charIndex, event.charIndex + event.charLength);
    const openCount = (word.match(vowels) || []).length;
    
    if (openCount >= 2) setMouthState('wide');
    else if (openCount >= 1) setMouthState('open');
    else setMouthState('closed');
    
    // Return to closed after ~200ms
    setTimeout(() => setMouthState('closed'), 200);
  }
};
```

**Idle animation (when not speaking):**
```css
@keyframes idle-breathe {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-3px); }
}
.avatar { animation: idle-breathe 3s ease-in-out infinite; }
```

---

### 5. Satomi's AI Personality — System Prompt

```
You are Satomi, an AI anime VTuber streaming live 24/7 on Pump.fun.

PERSONALITY:
- Developer energy: you understand tech, crypto, code
- US slang, casual, informal — "ngl", "lowkey", "fr fr", "bruh", "based", "ngmi", "wagmi"
- Savage & degen — crypto culture, memes, a little chaotic
- Context-aware — if someone asks something serious, be real. If they're hyping, match it
- Never robotic, never formal, never overly safe
- Short answers ONLY — maximum 2 sentences. You're a streamer, not a professor.

LANGUAGE:
- Default: English
- If the user writes in another language (Indonesian, Spanish, etc.), respond in that language
- Keep the same personality and slang adapted to that language

RESPONSE FORMAT (ALWAYS):
"Hey [username]! [echo question briefly] — [your answer]"

Example:
User: hon asks "satomi what is the solana memek protocol?"
Response: "Hey hon! The solana memek protocol lmao — it's basically just a bonding curve for degenerates, wagmi fr 🚀"

NEVER:
- Give long explanations
- Be preachy or moralistic
- Say "I'm an AI" or similar
- Break character
```

---

### 6. Response Filtering Logic

Only respond to messages containing "satomi" anywhere (case-insensitive):

```typescript
const TRIGGER_WORD = "satomi";
const SPAM_WINDOW_MS = 10_000;
const recentMessages = new Map<string, number>(); // user → last timestamp

function shouldProcess(username: string, message: string): boolean {
  if (!message.toLowerCase().includes(TRIGGER_WORD)) return false;
  
  const key = `${username}:${message.trim().toLowerCase()}`;
  const lastSeen = recentMessages.get(key) ?? 0;
  const now = Date.now();
  
  if (now - lastSeen < SPAM_WINDOW_MS) return false;
  
  recentMessages.set(key, now);
  return true;
}
```

---

## Project Structure

```
/
├── artifacts/
│   ├── api-server/           # Express backend (already exists)
│   │   └── src/
│   │       ├── services/
│   │       │   ├── pumpfun-chat.ts    # Socket.IO chat intake
│   │       │   └── satomi-ai.ts       # Claude AI brain
│   │       └── routes/
│   │           └── satomi/
│   │               ├── index.ts        # Mount all satomi routes
│   │               ├── ws.ts           # WebSocket server
│   │               └── admin.ts        # Admin REST endpoints
│   │
│   └── satomi/               # React/Vite stream page (new artifact)
│       └── src/
│           ├── pages/
│           │   ├── StreamPage.tsx      # /satomi — main stream overlay
│           │   └── AdminPage.tsx       # /satomi/admin — monitoring
│           ├── components/
│           │   ├── Avatar.tsx          # Anime avatar + animations
│           │   ├── ChatFeed.tsx        # Live chat overlay
│           │   └── SubtitleBar.tsx     # TTS subtitle display
│           └── hooks/
│               ├── useSatomiSocket.ts  # WebSocket connection
│               └── useSpeech.ts       # Web Speech API controller
│
├── lib/
│   ├── api-spec/openapi.yaml           # Extended with satomi endpoints
│   └── integrations-anthropic-ai/     # Claude client (Replit AI, no API key)
│
├── SATOMI_README.md          # This file
└── satomi.config.ts          # All tunable config in one place
```

---

## Module Specs

### `pumpfun-chat.ts` — Chat Intake Service

**Purpose:** Connect to Pump.fun chat, filter "satomi" triggers, push to WebSocket clients.

**Config inputs:**
- `tokenMintAddress: string` — which Pump.fun token page to monitor
- `triggerWord: string` — default `"satomi"` (case-insensitive)
- `spamWindowMs: number` — default `10000`

**Behavior:**
- Connect on startup using `socket.io-client`
- Emit `join` with token mint address
- On each `message` event: run `shouldProcess()`, if passes → call AI brain → broadcast to WS clients
- Auto-reconnect on disconnect (Socket.IO built-in)
- Log all connection state changes

**Fallback:** If Socket.IO connection fails after 5 retries, fall back to Puppeteer:
- Launch headless Chromium
- Navigate to `pump.fun/coin/<mintAddress>`
- Poll `.chat-message` DOM elements every 2 seconds
- Diff against previous snapshot to detect new messages

---

### `satomi-ai.ts` — AI Brain

**Purpose:** Generate Satomi's response for a given username + message.

**Uses:** `claude-haiku-4-5` (fastest Claude model, ideal for <3s latency target)

**Input:**
```typescript
interface TriggerInput {
  username: string;
  message: string;
}
```

**Output:** `string` — Satomi's response (max ~100 chars, 2 sentences)

**System prompt:** See personality section above.

**Context memory:** No persistent memory in v1. Each call is stateless (keeps latency low and costs minimal).

**Error handling:** If Claude call fails, return a fallback: `"Hey ${username}! lol my brain glitched — try again fren 😭"`

---

### `ws.ts` — WebSocket Server

**Purpose:** Real-time bridge from backend to stream page browser.

**Implementation:** Native `ws` library (not Socket.IO) for the server→browser connection.

**Events pushed to clients:**
```typescript
// New satomi trigger received from Pump.fun
{ type: "trigger", username: string, message: string, timestamp: number }

// AI response ready — triggers TTS + animation
{ type: "response", username: string, question: string, response: string, timestamp: number }

// Connection status update
{ type: "status", connected: boolean, tokenAddress: string }
```

---

### `StreamPage.tsx` — Main Stream Overlay

**Visual layout (1280×720):**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│          [SATOMI AVATAR — centered]             │
│              (animated, lip sync)               │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │  💬 "Hey hon! The solana memek           │  │
│  │      protocol fr fr is..."              │  │
│  └──────────────────────────────────────────┘  │
│                           ┌──────────────────┐ │
│                           │ hon: satomi...   │ │
│                           │ alice: wagmi     │ │
│                           │ bob: satomi...   │ │
│                           └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Background:** Dark (#0a0a0f) with subtle neon grid lines (purple/pink, very low opacity). Gives a "holographic stream" aesthetic matching crypto/anime culture.

**Avatar states:**
- `idle` — gentle floating animation (CSS keyframe, 3s loop)
- `speaking` — mouth animates via Web Speech API events
- `reacting` — brief shake/bounce when new trigger arrives

**TTS queue:** Messages queue if Satomi is mid-sentence. Max queue depth: 3. Oldest dropped if queue full.

---

### `AdminPage.tsx` — Monitoring Dashboard

**Route:** `/satomi/admin`

**Shows:**
- 🟢/🔴 Pump.fun connection status
- Token address currently being monitored (editable input)
- Counters: total messages received, satomi triggers, responses generated
- Scrolling log: last 20 responses (username, question, Satomi response, timestamp)
- "Test Satomi" button — manually trigger a test message without Pump.fun

---

## Configuration (`satomi.config.ts`)

```typescript
export const SATOMI_CONFIG = {
  // Pump.fun settings
  tokenMintAddress: process.env.PUMP_TOKEN_MINT ?? "",
  triggerWord: "satomi",
  spamWindowMs: 10_000,

  // AI settings
  claudeModel: "claude-haiku-4-5",  // fastest, lowest cost
  maxResponseLength: 150,            // characters

  // Stream page settings
  streamWidth: 1280,
  streamHeight: 720,
  ttsRate: 1.1,
  ttsPitch: 1.2,
  
  // WebSocket
  wsPath: "/satomi-ws",
};
```

---

## Latency Budget

Target: **< 3 seconds** from comment → voice output

| Step | Expected Time |
|---|---|
| Pump.fun chat Socket.IO → our server | ~50ms |
| Keyword filter + spam check | ~1ms |
| Claude haiku API call (Replit AI) | ~800–1200ms |
| WebSocket push to browser | ~10ms |
| Web Speech API TTS start | ~100–300ms |
| **Total** | **~1–1.5 seconds** ✅ |

Using `claude-haiku-4-5` (not Sonnet or Opus) is critical for staying under the latency target.

---

## Cost Estimate

| Service | Cost |
|---|---|
| Claude haiku (Replit AI credits) | ~$0.001 per response |
| Web Speech API TTS | $0 (browser-native) |
| OBS Studio | $0 (open source) |
| Replit hosting | Replit plan cost only |
| **Total per 1000 responses** | **~$1** |

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Pump.fun changes Socket.IO endpoint | Medium | Puppeteer fallback; easy to update URL |
| Pump.fun stream feature not available for your token | Medium | Contact pump.fun; meanwhile test with LiveReacting |
| Web Speech API voice sounds robotic | Low | It does sound robotic — acceptable for crypto VTuber aesthetic |
| Claude rate limiting | Low | haiku has generous rate limits; add retry logic |
| OBS Browser Source doesn't play TTS audio | Low | Enable "Control audio via OBS" in Browser Source settings |

---

## Build Order (Recommended)

1. **Anthropic AI integration setup** — provision Claude via Replit (no API key needed)
2. **Create `/satomi` React artifact** — scaffold the frontend
3. **Generate Satomi avatar image** — AI-generated anime character
4. **Build StreamPage.tsx** — avatar, animations, TTS controller, subtitle bar
5. **Backend: pumpfun-chat.ts** — Socket.IO intake + keyword filter
6. **Backend: satomi-ai.ts** — Claude response generation with personality prompt
7. **Backend: ws.ts** — WebSocket server bridging backend to browser
8. **Backend: admin.ts** — REST endpoints for monitoring
9. **Build AdminPage.tsx** — monitoring dashboard
10. **End-to-end test** — use "Test Satomi" button to validate full pipeline
11. **OBS Setup** — Browser Source → Pump.fun RTMP

---

## Setup Guide (Step by Step)

### Step 1: Deploy this project on Replit
- All services start automatically
- Note your Replit URL: `https://[your-repl].replit.app`

### Step 2: Configure your token
- Set `PUMP_TOKEN_MINT` environment variable to your Pump.fun token's mint address
- This tells Satomi which token's chat room to monitor

### Step 3: Install OBS Studio (free)
- Download from **obsproject.com** — 100% free, open source, no trial
- Windows/Mac/Linux supported

### Step 4: Set up OBS
1. Open OBS → click `+` under Sources → **Browser**
2. URL: `https://[your-repl].replit.app/satomi`
3. Width: `1280`, Height: `720`
4. Check **"Control audio via OBS"** (important for TTS to work in stream)

### Step 5: Get Pump.fun RTMP credentials
1. Go to `pump.fun/coin/[your-token-address]`
2. Click **"Start Livestream"** → **"RTMP broadcast mode"**
3. Click **"Go Live"** → copy the RTMP URL and Stream Key

### Step 6: Connect OBS to Pump.fun
1. OBS → **Settings** → **Stream**
2. Service: **Custom...**
3. Server: paste RTMP URL
4. Stream Key: paste stream key
5. Click **OK**

### Step 7: Go Live
1. In OBS: click **"Start Streaming"**
2. Your stream should appear on pump.fun within 10–15 seconds
3. Open `/satomi/admin` to monitor — should show 🟢 Connected

### Step 8: Test it
- Go to your token page on pump.fun
- Type in chat: **"satomi what is solana?"**
- Satomi should respond within ~2 seconds
