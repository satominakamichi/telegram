# Satomi Stream — Setup Guide

## Prerequisites

- A Pump.fun token already created
- OBS Studio (free) — download from **obsproject.com**

---

## Step 1: Deploy on Replit

All backend services start automatically when the project runs.

Note your Replit URL — it looks like `https://[your-repl].replit.app`

---

## Step 2: Configure Your Pump.fun Token

Set the `PUMP_TOKEN_MINT` environment variable in Replit Secrets to your token's mint address.

This tells Satomi which Pump.fun token page's chat to monitor. Without this, Satomi will not watch any chat (but all other features still work — you can use the test button).

---

## Step 3: Install OBS Studio

Download from **[obsproject.com](https://obsproject.com)** — 100% free, open source, no trial, no payment.

Available for Windows, Mac, and Linux.

---

## Step 4: Add Browser Source in OBS

1. Open OBS Studio
2. Under **Sources**, click `+` → **Browser**
3. Name it "Satomi Stream" → click **OK**
4. Set:
   - **URL**: `https://[your-repl].replit.app/satomi/`
   - **Width**: `1280`
   - **Height**: `720`
5. Check **"Control audio via OBS"** — this is required for Satomi's voice to play in the stream
6. Click **OK**

---

## Step 5: Get Pump.fun RTMP Credentials

1. Go to `pump.fun/coin/[your-token-address]`
2. Click **"Start Livestream"** → **"RTMP broadcast mode"**
3. Click **"Go Live"** — you receive:
   - RTMP Server URL (e.g. `rtmp://live.pump.fun/live`)
   - Stream Key (unique per session)

> **Critical:** OBS must connect AFTER you click "Go Live" on pump.fun. If OBS is already streaming when pump.fun expects to start, it will not connect.

> **Note:** The Pump.fun livestream feature is currently in limited rollout (~5% of users). If you don't see "Start Livestream" on your token page, it may not be available yet.

---

## Step 6: Connect OBS to Pump.fun

1. In OBS: **Settings** → **Stream**
2. Service: **Custom...**
3. Server: paste RTMP URL from pump.fun
4. Stream Key: paste stream key from pump.fun
5. Click **OK**

---

## Step 7: Go Live

1. First, go to your pump.fun token page and click **Go Live** to start the stream on their end
2. Then in OBS: click **Start Streaming**
3. Your stream should appear on pump.fun within 10–15 seconds

---

## Step 8: Test Satomi

1. Open `https://[your-repl].replit.app/satomi/admin` in your browser
2. The admin panel shows Pump.fun connection status
3. Click **"Test Satomi"** to trigger a test response without using Pump.fun chat
4. On pump.fun, type in chat: **"satomi what is solana?"**
5. Satomi should respond within ~2 seconds

---

## Monitoring

The admin panel at `/satomi/admin` shows:

- Live Pump.fun connection status
- Total messages received / trigger count / responses generated
- Last 20 AI responses (username, question, Satomi's reply, timestamp)
- Token address input — change which Pump.fun token to monitor without restarting

---

## Configuration

Edit `satomi.config.ts` at the project root to tune:

```typescript
export const SATOMI_CONFIG = {
  tokenMintAddress: process.env.PUMP_TOKEN_MINT ?? "",
  triggerWord: "satomi",      // keyword that triggers a response
  spamWindowMs: 10_000,        // 10s dedup window per user+message

  claudeModel: "claude-haiku-4-5",   // fastest Claude model for low latency
  maxResponseLength: 150,             // max character length of responses

  streamWidth: 1280,           // OBS Browser Source width
  streamHeight: 720,           // OBS Browser Source height
  ttsRate: 1.1,                // TTS speech rate (1.0 = normal)
  ttsPitch: 1.2,               // TTS pitch (1.0 = normal)

  wsPath: "/satomi-ws",        // WebSocket path
};
```

---

## Alternative: LiveReacting (No OBS Required)

If you do not want to install OBS:

1. Go to [livereacting.com](https://livereacting.com) — free tier available
2. Create a project → Settings → Stream Destinations
3. Add **Custom RTMP** → paste Pump.fun RTMP URL and stream key
4. Add a **Browser Source** layer → enter your Replit `/satomi/` URL
5. Click **Go Live**

---

## Cost

| Service | Cost |
|---|---|
| Satomi AI responses (Claude haiku) | ~$0.001 per response |
| Web Speech TTS | $0 (browser-native) |
| OBS Studio | $0 (open source) |
| **Per 1,000 responses** | **~$1** |
