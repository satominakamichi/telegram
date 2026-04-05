import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger.js";
import { generateSatomiResponse } from "./satomi-ai.js";
import { synthesizeSpeech } from "./satomi-tts.js";
import { satomiConfig } from "./satomi.config.js";
import { broadcastToClients } from "./satomi-ws.js";
import { satomiState, addLog } from "./satomi-state.js";
import { persistLog } from "./satomi-db-logs.js";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const ELEVENLABS_API_KEY  = process.env.ELEVENLABS_API_KEY ?? "";

const recentMessages = new Map<string, number>();

function shouldProcess(userId: string, message: string): boolean {
  const key = `${userId}:${message.trim().toLowerCase()}`;
  const lastSeen = recentMessages.get(key) ?? 0;
  const now = Date.now();
  if (now - lastSeen < satomiConfig.spamWindowMs) return false;
  recentMessages.set(key, now);
  return true;
}

async function transcribeVoice(fileBuffer: Buffer): Promise<string> {
  if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY not set");

  const blob = new Blob([fileBuffer], { type: "audio/ogg" });
  const form = new FormData();
  form.append("file", blob, "voice.ogg");
  form.append("model_id", "scribe_v1");

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs STT ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

async function downloadFile(bot: TelegramBot, fileId: string): Promise<Buffer> {
  const fileLink = await bot.getFileLink(fileId);
  const res = await fetch(fileLink, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`File download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function handleMessage(
  bot: TelegramBot,
  botUsername: string,
  msg: TelegramBot.Message,
  overrideText?: string,
): Promise<void> {
  const chatId   = msg.chat.id;
  const userId   = String(msg.from?.id ?? "unknown");
  const username = msg.from?.username ?? msg.from?.first_name ?? `user_${userId.slice(-4)}`;

  const text = overrideText ?? msg.text ?? "";
  if (!text.trim()) return;
  if (!shouldProcess(userId, text)) return;

  satomiState.messagesReceived++;

  // Broadcast trigger to web app — avatar "sees" the question
  broadcastToClients({ type: "trigger", username, message: text, timestamp: Date.now() });

  try {
    await bot.sendChatAction(chatId, "record_voice");

    const { text: responseText, gesture } = await generateSatomiResponse(username, text);
    satomiState.responsesGenerated++;

    // Broadcast response to web app — avatar speaks + animates
    broadcastToClients({
      type: "response",
      username,
      question: text,
      response: responseText,
      gesture,
      timestamp: Date.now(),
    });

    addLog({ username, question: text, response: responseText, timestamp: new Date() });
    void persistLog(username, text, responseText);

    // Also send voice message back to the Telegram chat
    const voiceBuffer = await synthesizeSpeech(responseText);
    await bot.sendVoice(chatId, voiceBuffer, {
      reply_to_message_id: msg.message_id,
    } as TelegramBot.SendVoiceOptions);

    logger.info({ username, question: text, response: responseText }, "Telegram voice reply sent");
  } catch (err) {
    logger.error({ err }, "Failed to handle Telegram message");
  }
}

let bot: TelegramBot | null = null;

export async function startTelegramBot(): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set — Telegram bot not started");
    return false;
  }

  bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

  let botUsername = "";
  try {
    const me = await bot.getMe();
    botUsername = me.username ?? "";
    logger.info({ botUsername }, "Telegram bot connected");
  } catch (err) {
    logger.error({ err }, "Failed to get bot info");
  }

  bot.on("message", async (msg) => {
    if (!bot) return;

    const isGroup   = msg.chat.type === "group" || msg.chat.type === "supergroup";
    const isPrivate = msg.chat.type === "private";
    const isMention = (msg.text ?? "").includes(`@${botUsername}`) ||
                      (msg.caption ?? "").includes(`@${botUsername}`);
    const isReplyToBot = msg.reply_to_message?.from?.username === botUsername;
    const shouldRespond = isPrivate || isMention || isReplyToBot;

    if (isGroup && !shouldRespond) return;

    if (msg.voice) {
      logger.info({ username: msg.from?.username }, "Voice note received");
      try {
        await bot.sendChatAction(msg.chat.id, "typing");
        const fileBuffer  = await downloadFile(bot, msg.voice.file_id);
        const transcribed = await transcribeVoice(fileBuffer);

        if (!transcribed) {
          logger.warn("Empty transcription — ignoring voice note");
          return;
        }

        logger.info({ transcribed }, "Voice note transcribed");
        await handleMessage(bot, botUsername, msg, transcribed);
      } catch (err) {
        logger.error({ err }, "Voice note transcription failed");
      }
      return;
    }

    if (msg.text) {
      const cleanText = msg.text.replace(new RegExp(`@${botUsername}`, "gi"), "").trim();
      await handleMessage(bot, botUsername, msg, cleanText);
    }
  });

  bot.on("polling_error", (err) => {
    logger.error({ err: (err as Error).message }, "Telegram polling error");
  });

  bot.on("error", (err) => {
    logger.error({ err: err.message }, "Telegram bot error");
  });

  return true;
}

export function stopTelegramBot(): void {
  if (bot) {
    void bot.stopPolling();
    bot = null;
    logger.info("Telegram bot stopped");
  }
}
