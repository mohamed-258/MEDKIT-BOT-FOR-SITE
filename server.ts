import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { DatabaseController, checkDatabaseStatus } from "./src/dbFallback";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 1. Initialize Firebase Admin SDK
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const firestore = admin.firestore();
if (firebaseConfig.firestoreDatabaseId) {
  firestore.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
}

// Instantiate database wrapper
const db = new DatabaseController(firestore);

// --- Telegram Long Polling System ---
let isPollingActive = false;
let lastOffset = 0;
let pollingTimeoutId: NodeJS.Timeout | null = null;

async function startTelegramPolling() {
  if (isPollingActive) return;

  const settings = await db.getSettings().catch(() => null);
  const botToken = settings?.botToken;
  if (!botToken) {
    console.log("Telegram Token is empty, skipping polling startup.");
    return;
  }

  isPollingActive = true;
  console.log("Starting Telegram Long Polling...");

  // Delete webhook so Telegram knows to queue messages for getUpdates
  try {
    await callTelegram(botToken, "deleteWebhook", { drop_pending_updates: false });
    console.log("Telegram Webhook deleted successfully to enable Long Polling.");
  } catch (err: any) {
    console.warn("Could not delete webhook before starting polling:", err.message);
  }

  poll(botToken);
}

async function stopTelegramPolling() {
  isPollingActive = false;
  if (pollingTimeoutId) {
    clearTimeout(pollingTimeoutId);
    pollingTimeoutId = null;
  }
  console.log("Stopped Telegram Long Polling.");
}

async function restartTelegramPolling() {
  await stopTelegramPolling();
  setTimeout(async () => {
    await startTelegramPolling();
  }, 1000);
}

async function poll(botToken: string) {
  if (!isPollingActive) return;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastOffset + 1}&timeout=10&limit=50`);
    if (!response.ok) {
      throw new Error(`getUpdates request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (data.ok && data.result && data.result.length > 0) {
      for (const update of data.result) {
        lastOffset = Math.max(lastOffset, update.update_id);
        await processTelegramUpdate(update).catch((err: any) => {
          console.error("Error processing update from polling:", err);
        });
      }
    }
  } catch (err: any) {
    console.error("Error in Telegram polling ticks:", err.message);
    // Wait standard timeout to prevent spam on connectivity failure
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  if (isPollingActive) {
    pollingTimeoutId = setTimeout(() => poll(botToken), 500);
  }
}

// Telegram Call Helper
async function callTelegram(botToken: string, method: string, payload: any) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      console.error(`Telegram API error during ${method}:`, data);
      throw new Error(data.description || `Telegram API ${method} failed`);
    }
    return data;
  } catch (error) {
    console.error(`Fetch error during Telegram ${method}:`, error);
    throw error;
  }
}

// Translate Status
function translateStatus(status: string) {
  switch (status) {
    case "approved":
      return "تم التفعيل والنشاط بنجاح! ✅";
    case "rejected":
      return "مرفوض ومرفق السبب بالتفاصيل ❌";
    default:
      return "قيد التدقيق والمراجعة من قبل الإدارة 🕒";
  }
}

// Seed Menus if empty
async function seedMenusIfEmpty() {
  try {
    const settings = await db.getSettings().catch(() => null);
    if (settings && settings.seededMenus) {
      console.log("Database already seeded, skipping default menus generation.");
      return;
    }

    const menus = await db.getMenus();
    if (!menus || menus.length === 0) {
      console.log("Seeding default medkit menus...");
      const defaultMenus = [
        {
          id: "mid_rrs",
          title: "mid RRS",
          price: "300 جنيه مصري",
          description: "باقة كود التشخيص والمراجعة السريعة RRS (سنتين)",
          details: "📍 باقة تفعيل كود منصة ميدكيت الطبية RRS:\n\nتشمل باقة التفعيل الميزات التالية:\n🟢 صلاحية كاملة لمدة سنتين كاملتين (24 شهراً).\n🟢 الوصول السريع إلى تشخيص الحالات والدعم اللا محدود.\n🟢 كود مراجعة مخصص.\n\n💰 قيمة الاشتراك: 300 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
        },
        {
          id: "mid_ecg",
          title: "mid ECG",
          price: "200 جنيه مصري",
          description: "باقة كورس رسم القلب واشتراك 12 شهر",
          details: "📍 باقة التفعيل لكورس رسم القلب الشامل mid ECG:\n\nتشمل الباقة الميزات التالية:\n🟢 كورس رسم القلب الشامل لجميع المستويات.\n🟢 صلاحية وصول للمواد الطبية لمدة 12 شهر.\n🟢 شهادة إتمام رقمية مجانية للطلاب والممارسين.\n\n💰 قيمة الاشتراك: 200 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
        },
        {
          id: "mid_premium",
          title: "mid Premium الشامل",
          price: "500 جنيه مصري",
          description: "الاشتراك المميز لكافة كورسات وخدمات منصة ميدكيت",
          details: "📍 باقة التفعيل الشاملة mid Premium:\n\nتشمل هذه الباقة الحصرية الميزات التالية:\n🟢 الوصول لكافة الكورسات الطبية المتاحة بالمنصة والمستقبلية.\n🟢 تفعيل كود RRS وكورس ECG مدى الحياة.\n🟢 دعم طبي واستشارات فنية VIP.\n\n💰 قيمة الاشتراك: 500 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
        }
      ];

      for (const item of defaultMenus) {
        await db.saveMenu(item);
      }

      // Mark menus as seeded in settings
      const currentSettings = await db.getSettings().catch(() => null);
      if (currentSettings) {
        await db.saveSettings({
          ...currentSettings,
          seededMenus: true
        });
      } else {
        await db.saveSettings({
          botToken: "",
          adminChatId: "",
          welcomeMessage: "أهلاً بك في بوت تفعيل اشتراكات منصة ميدكيت (MedKit) المعتمد! 🏥✨\n\nيرجى تحديد خطة الاشتراك المراد تفعيلها من القائمة بالأسفل لعرض تفاصيلها وطريقة التحويل وسنقوم بتفعيل حسابك فوراً:",
          seededMenus: true
        });
      }

      console.log("Medkit menus seeded successfully!");
    }
  } catch (error) {
    console.error("Error seeding menus:", error);
  }
}

// Seed Global Settings if empty
async function seedSettingsIfEmpty() {
  try {
    const settings = await db.getSettings();
    if (!settings || !settings.welcomeMessage) {
      console.log("Seeding default medkit settings...");
      await db.saveSettings({
        botToken: "",
        adminChatId: "",
        welcomeMessage: "أهلاً بك في بوت تفعيل اشتراكات منصة ميدكيت (MedKit) المعتمد! 🏥✨\n\nيرجى تحديد خطة الاشتراك المراد تفعيلها من القائمة بالأسفل لعرض تفاصيلها وطريقة التحويل وسنقوم بتفعيل حسابك فوراً:"
      });
    }
  } catch (error) {
    console.error("Error seeding settings:", error);
  }
}

// Initialize database setup (will dynamically choose Firestore vs local fallback)
async function initDatabase() {
  await checkDatabaseStatus(firestore);

  // Clear trial/demo menus programmatically as requested by user
  try {
    const trialIds = ["mid_rrs", "mid_ecg", "mid_premium"];
    for (const id of trialIds) {
      await db.deleteMenu(id).catch(() => null);
    }
    const currentSettings = await db.getSettings().catch(() => null);
    if (currentSettings) {
      await db.saveSettings({ ...currentSettings, seededMenus: true });
    } else {
      await db.saveSettings({
        botToken: "",
        adminChatId: "",
        welcomeMessage: "أهلاً بك في بوت تفعيل اشتراكات منصة ميدكيت (MedKit) المعتمد! 🏥✨\n\nيرجى تحديد خطة الاشتراك المراد تفعيلها من القائمة بالأسفل لعرض تفاصيلها وطريقة التحويل وسنقوم بتفعيل حسابك فوراً:",
        seededMenus: true
      });
    }
    console.log("Success: Demo/trial menus clean up completed successfully on database initialize.");
  } catch (err) {
    console.error("Warning: Error cleaning up trial menus:", err);
  }

  await seedMenusIfEmpty();
  await seedSettingsIfEmpty();

  // Start Long Polling if token is available
  const settings = await db.getSettings().catch(() => null);
  if (settings && settings.botToken) {
    startTelegramPolling();
  }
}
initDatabase();

// --- HELPERS ---
function getPublicAppUrl(req: express.Request): string {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const forwardedHost = req.headers["x-forwarded-host"] as string;
  const hostHeader = req.headers["host"] as string;

  // Prioritize public domains over localhost/local IPs
  if (forwardedHost && !forwardedHost.includes("localhost") && !forwardedHost.includes("127.0.0.1")) {
    return `${proto}://${forwardedHost}`;
  }
  if (hostHeader && !hostHeader.includes("localhost") && !hostHeader.includes("127.0.0.1")) {
    return `${proto}://${hostHeader}`;
  }

  // Fallback to body origin
  if (req.body && req.body.appUrl) {
    return req.body.appUrl.replace(/\/$/, "");
  }

  // Final fallback (production / current environment metadata domain)
  return "https://ais-dev-4kvme67znt7t7krxejpyoe-51222879362.europe-west2.run.app";
}

// --- API ROUTES ---

// 1. Get Telegram Webhook and configuration status
app.get("/api/telegram-status", async (req, res) => {
  try {
    const settings = await db.getSettings();
    const botToken = settings.botToken || "";
    const adminChatId = settings.adminChatId || "";

    if (!botToken) {
      return res.json({ configured: false, detail: "Bot token is empty. Please configure it." });
    }

    // Fail-safe: Automatically kickstart polling loop if inactive but token is provided
    if (!isPollingActive) {
      console.log("Fail-safe: Kickstarting Telegram Long Polling from API status call...");
      startTelegramPolling().catch((e) => console.error("Error startTelegramPolling:", e));
    }

    // Call GetWebhookInfo
    const hookData = await callTelegram(botToken, "getWebhookInfo", {});
    const botInfo = await callTelegram(botToken, "getMe", {}).catch(() => null);

    res.json({
      configured: true,
      botToken: botToken ? `${botToken.substring(0, 8)}...` : "",
      adminChatId,
      botUser: botInfo ? botInfo.result : null,
      webhookInfo: hookData.result
    });
  } catch (err: any) {
    res.json({ configured: false, error: err.message });
  }
});

// 2. Setup/Force Webhook URL
app.post("/api/setup-webhook", async (req, res) => {
  try {
    const settings = await db.getSettings();
    const botToken = settings.botToken;

    if (!botToken) {
      return res.status(400).json({ error: "توكن البوت فارغ! الرجاء تقديمه وحفظه أولاً." });
    }

    // Stop polling so that standard webhook can take over if the user configures it
    await stopTelegramPolling();

    const appUrl = getPublicAppUrl(req);
    const webhookUrl = `${appUrl}/api/telegram-webhook`;
    console.log(`Setting telegram webhook to: ${webhookUrl}`);

    await callTelegram(botToken, "setWebhook", { url: webhookUrl });

    res.json({ success: true, webhookUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Admin Direct Replying
app.post("/api/admin/reply", async (req, res) => {
  try {
    const { ticketId, replyMessage, newStatus } = req.body;
    if (!ticketId || !replyMessage || !newStatus) {
      return res.status(400).json({ error: "Missing reply parameters" });
    }

    const ticket = await db.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "طلب الاشتراك غير موجود" });
    }

    // Fetch Settings for token
    const settings = await db.getSettings();
    const botToken = settings.botToken;

    if (botToken && ticket.telegramUserId) {
      const botId = botToken.split(":")[0];
      if (ticket.telegramUserId.toString() === botId) {
        console.warn("Skipping sending message to telegramUserId as it is identical to Bot ID.");
      } else {
        let statusIcon = newStatus === "approved" ? "✅" : "❌";
        let statusTxt = newStatus === "approved" ? "مقبول ومفعل" : "مرفوض";

        let textMessage = `🏥 *رسالة من إدارة منصة ميدكيت:*\n\n`;
        textMessage += `بخصوص طلب تفعيل اشتراكك في: *${ticket.menuTitle}*\n`;
        textMessage += `الإيميل المسجل: \`${ticket.email}\`\n\n`;
        textMessage += `📌 *قرار الإدارة:* ${statusIcon} ${statusTxt}\n\n`;
        textMessage += `💬 *ملاحظة الإدارة:*\n${replyMessage}\n\n`;
        textMessage += `شكراً لاختيارك منصة ميدكيت الطبية! ❤️`;

        await callTelegram(botToken, "sendMessage", {
          chat_id: ticket.telegramUserId,
          text: textMessage,
          parse_mode: "Markdown"
        }).catch(err => {
          console.error("Failed to deliver Telegram reply directly to user:", err);
        });
      }
    }

    // Update Ticket document
    ticket.status = newStatus;
    ticket.adminComment = replyMessage;
    ticket.updatedAt = new Date().toISOString();
    await db.saveTicket(ticket);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- ADMIN CLIENT PARALLEL REST ENDPOINTS ---

// Get Settings
app.get("/api/settings", async (req, res) => {
  try {
    const data = await db.getSettings();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Settings
app.post("/api/settings", async (req, res) => {
  try {
    const { botToken, adminChatId, welcomeMessage, allowedEmails } = req.body;
    await db.saveSettings({ botToken, adminChatId, welcomeMessage, allowedEmails: allowedEmails || [] });
    
    // Automatically stop and restart polling to use the updated token
    restartTelegramPolling();
    
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Menus
app.get("/api/menus", async (req, res) => {
  try {
    const data = await db.getMenus();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save Menu
app.post("/api/menus", async (req, res) => {
  try {
    const menu = req.body;
    await db.saveMenu(menu);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Menu
app.delete("/api/menus/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await db.deleteMenu(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Tickets
app.get("/api/tickets", async (req, res) => {
  try {
    const data = await db.getTickets();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Support Messages
app.get("/api/support-messages", async (req, res) => {
  try {
    const data = await db.getSupportMessages();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reply to Support Message
app.post("/api/support-messages/reply", async (req, res) => {
  try {
    const { messageId, replyText } = req.body;
    if (!messageId || !replyText) {
      return res.status(400).json({ error: "Missing reply parameters" });
    }

    const msgs = await db.getSupportMessages();
    const msg = msgs.find(m => m.id === messageId);
    if (!msg) {
      return res.status(404).json({ error: "رسالة الدعم غير موجودة" });
    }

    const settings = await db.getSettings();
    const botToken = settings.botToken;

    if (botToken && msg.telegramUserId) {
      let textMessage = `💬 *رد الدعم الفني لدكتور ميدكيت:*\n\n`;
      textMessage += `بخصوص رسالتك السابقة: _"${msg.messageText}"_\n\n`;
      textMessage += `*الرد:* ${replyText}\n\n`;
      textMessage += `كيف يمكننا مساعدتك أيضاً؟ ❤️`;

      await callTelegram(botToken, "sendMessage", {
        chat_id: msg.telegramUserId,
        text: textMessage,
        parse_mode: "Markdown"
      }).catch(err => {
        console.error("Failed to deliver Telegram reply directly to user:", err);
      });
    }

    msg.replied = true;
    msg.replyText = replyText;
    msg.repliedAt = new Date().toISOString();
    await db.saveSupportMessage(msg);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Support Message
app.delete("/api/support-messages/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await db.deleteSupportMessage(id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Telegram Webhook Listener
app.post("/api/telegram-webhook", async (req, res) => {
  // Always return 200 immediately to avoid Telegram timeout retries
  res.status(200).send("OK");

  try {
    const update = req.body;
    await processTelegramUpdate(update);
  } catch (error) {
    console.error("Critical error in Telegram Webhook processor proxy:", error);
  }
});

// Refactored helper to process updates from both Webhook & Long Polling
async function processTelegramUpdate(update: any) {
  if (!update || (!update.message && !update.callback_query)) return;

  const settings = await db.getSettings();
  const botToken = settings.botToken;
  if (!botToken) return;

  const botId = botToken.split(":")[0];

  if (update.message) {
    const message = update.message;
    
    // Ignore updates originating from a bot or whose sender is a bot to avoid loops / 403 errors
    if (message.from && (message.from.is_bot || message.from.id.toString() === botId)) {
      console.log(`Ignoring bot interaction: message from bot ID ${message.from?.id}`);
      return;
    }

    const chatId = message.chat.id;
    // Also ignore if the chat itself is the bot
    if (chatId.toString() === botId) {
      console.log("Ignoring bot interaction: chat ID is identical to Bot ID");
      return;
    }

    const userId = message.from.id.toString();
    const text = message.text ? message.text.trim() : "";
    const username = message.from.username || "";
    const firstName = message.from.first_name || "";
    const lastName = message.from.last_name || "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    // Get user session
    let session = await db.getSession(userId);
    if (!session || !session.step) {
      session = {
        userId,
        step: "idle"
      };
    }

    // 1. Force state reset on commands
    if (text === "/start" || text === "/status" || text === "البداية 🏠") {
      session.step = "idle";
      session.email = undefined;
      session.selectedPlanId = undefined;
      await db.saveSession(session);

      // Fetch menus
      const menusList = await db.getMenus();

      // Dynamic Keyboard layout
      const keyboardButtons = [];
      for (let i = 0; i < menusList.length; i += 2) {
        const row = [{ text: menusList[i].title }];
        if (menusList[i + 1]) {
          row.push({ text: menusList[i + 1].title });
        }
        keyboardButtons.push(row);
      }
      keyboardButtons.push([
        { text: "التحقق من حالة اشتراكي 🔍" },
        { text: "تحدث مع الدعم 📞" }
      ]);

      const welcomeText = settings.welcomeMessage || "أهلاً بك في بوت اشتراك منصة ميدكيت المعتمد!";
      await callTelegram(botToken, "sendMessage", {
        chat_id: chatId,
        text: `أهلاً بك يا ${firstName} 👋\n\n${welcomeText}`,
        reply_markup: {
          keyboard: keyboardButtons,
          resize_keyboard: true
        }
      }).catch((err) => console.error("Error sending welcome message:", err));
      return;
    }

    // 2. Query status button check
    if (text === "التحقق من حالة اشتراكي 🔍") {
      const tickets = await db.getTickets();
      const userTicket = tickets.find(t => t.telegramUserId === userId);

      if (!userTicket) {
        await callTelegram(botToken, "sendMessage", {
          chat_id: chatId,
          text: "🔍 ليس لديك أي طلبات اشتراك سابقة حالياً.\nيمكنك البدء باختيار باقة اشتراك من الأزرار بالأسفل!"
        }).catch((err) => console.error("Error sending no tickets msg:", err));
      } else {
        const pStatus = translateStatus(userTicket.status);
        const formattedDate = new Date(userTicket.createdAt).toLocaleDateString("ar-EG");

        let statusMsg = `ℹ️ *حالة آخر طلب اشتراك لك:*\n\n`;
        statusMsg += ` الباقة: *${userTicket.planTitle}*\n`;
        statusMsg += ` البريد المسجل: \`${userTicket.email}\`\n`;
        statusMsg += ` حالة التفعيل: *${pStatus}*\n`;
        statusMsg += ` تاريخ الطلب: ${formattedDate}\n\n`;
        if (userTicket.adminComment) {
          statusMsg += `💬 *رد الإدارة:* ${userTicket.adminComment}\n`;
        }

        await callTelegram(botToken, "sendMessage", {
          chat_id: chatId,
          text: statusMsg,
          parse_mode: "Markdown"
        }).catch((err) => console.error("Error sending user status msg:", err));
      }
      return;
    }

    // 3. Talk with support button
    if (text === "تحدث مع الدعم 📞") {
      session.step = "support";
      await db.saveSession(session);

      await callTelegram(botToken, "sendMessage", {
        chat_id: chatId,
        text: "💬 أنت الآن متصل بالدعم الفني المباشر لمنصة ميدكيت.\nيرجى كتابة رسالتك بوضوح وسيقوم المسؤول بالرد عليك هنا فوراً."
      }).catch((err) => console.error("Error sending support invitation:", err));
      return;
    }

    // 4. Check if text matches subscription options
    const menusList = await db.getMenus();
    const matchedMenu = menusList.find(m => m.title.trim().toLowerCase() === text.toLowerCase());

    if (matchedMenu) {
      session.step = "awaiting_email";
      session.selectedPlanId = matchedMenu.id;
      await db.saveSession(session);

      await callTelegram(botToken, "sendMessage", {
        chat_id: chatId,
        text: `${matchedMenu.details}`
      }).catch((err) => console.error("Error sending plan details:", err));
      return;
    }

    // 5. Handling session state "awaiting_email"
    if (session.step === "awaiting_email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(text)) {
        session.step = "awaiting_receipt";
        session.email = text;
        await db.saveSession(session);

        // Get plan title
        const selectedPlan = menusList.find(m => m.id === session.selectedPlanId);
        const planTitle = selectedPlan ? selectedPlan.title : "طلب تفعيل ميدكيت";

        let replyText = `📩 تم تسجيل بريدك الإلكتروني بنجاح: \`${text}\`\n\n`;
        replyText += `💳 *الخطوة الأخيرة للحصول على باقة (${planTitle}):*\n`;
        replyText += `يرجى إرسال لقطة الشاشة (إيصال التحويل المالي أو كود الدفع) هنا كصورة لتفعيل حسابك على الفور:`;

        await callTelegram(botToken, "sendMessage", {
          chat_id: chatId,
          text: replyText,
          parse_mode: "Markdown"
        }).catch((err) => console.error("Error sending email success message:", err));
      } else {
        await callTelegram(botToken, "sendMessage", {
          chat_id: chatId,
          text: "❌ البريد الإلكتروني المدخل غير صحيح.\nيرجى إعادة إرسال البريد الإلكتروني الصحيح الذي سجلت به في المنصة لتتم المراجعة بشكل صحيح (مثال: example@gmail.com):"
        }).catch((err) => console.error("Error sending invalid email warning:", err));
      }
      return;
    }

    // 6. Handling session state "support"
    if (session.step === "support") {
      // Save support message dynamically to DB for dashboard viewing
      try {
        const msgId = "msg_" + Math.random().toString(36).substring(2, 11);
        await db.saveSupportMessage({
          id: msgId,
          telegramUserId: userId,
          telegramUsername: username,
          telegramName: fullName,
          messageText: text || "[ملف أو رسالة ليست نصية]",
          createdAt: new Date().toISOString(),
          replied: false
        });
        console.log(`Success: saved user support message from ${fullName} to database`);
      } catch (err) {
        console.error("Warning: Error saving support message to database:", err);
      }

      const adminChatId = settings.adminChatId;
      if (adminChatId && adminChatId.toString().trim() !== botId && !adminChatId.toString().trim().includes(":")) {
        let supportMsgToAdmin = `🚨 *رسالة دعم فني جديدة:*\n\n`;
        supportMsgToAdmin += `👤 المرسل: ${fullName} (@${username})\n`;
        supportMsgToAdmin += `🆔 شات ID: \`${chatId}\`\n\n`;
        supportMsgToAdmin += `✉️ الرسالة:\n_${text}_`;

        await callTelegram(botToken, "sendMessage", {
          chat_id: adminChatId,
          text: supportMsgToAdmin,
          parse_mode: "Markdown"
        }).catch((err) => console.error("Error sending support notification to adminChatId:", err));
      }

      await callTelegram(botToken, "sendMessage", {
        chat_id: chatId,
        text: "✅ تم تسليم رسالتك لإدارة ميدكيت. شكراً لك وسنرد عليك قريباً."
      }).catch((err) => console.error("Error sending support confirmation to user:", err));
      return;
    }

    // 7. Handling photo upload if in "awaiting_receipt"
    if (message.photo && message.photo.length > 0) {
      if (session.step === "awaiting_receipt") {
        const photoObj = message.photo[message.photo.length - 1]; // largest resolution
        const fileId = photoObj.file_id;

        // Retrieve file path
        const fileInfo = await callTelegram(botToken, "getFile", { file_id: fileId });
        const filePath = fileInfo.result.file_path;

        // Download image and convert to Base64
        const fileDownloadUrl = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
        const downloadResponse = await fetch(fileDownloadUrl);
        const arrayBuffer = await downloadResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64Image = `data:image/jpeg;base64,${buffer.toString("base64")}`;

        // Create ticket
        const ticketId = "tick_" + Math.random().toString(36).substring(2, 11);
        const selectedPlan = menusList.find(m => m.id === session.selectedPlanId);
        const planTitle = selectedPlan ? selectedPlan.title : "باقة تفعيل ميدكيت";

        const ticket = {
          id: ticketId,
          userId: userId, // required by types/schema
          telegramUserId: userId,
          telegramUsername: username,
          telegramName: fullName,
          username: username,
          fullName: fullName,
          email: session.email || "",
          planId: session.selectedPlanId || "custom",
          planTitle: planTitle,
          receiptPhotoUrl: base64Image,
          transactionImage: base64Image, // match schema key
          status: "new",
          adminComment: "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await db.saveTicket(ticket);

        // Reset user session
        session.step = "idle";
        session.email = undefined;
        session.selectedPlanId = undefined;
        await db.saveSession(session);

        // Confirmation message to subscriber
        let clientDoneMsg = `🎉 *تم طلب تفعيل الاشتراك بنجاح!*\n\n`;
        clientDoneMsg += `📦 الباقة: *${ticket.planTitle}*\n`;
        clientDoneMsg += `📩 بريدك: \`${ticket.email}\`\n\n`;
        clientDoneMsg += `🔍 نقوم حالياً بمراجعة تحويلك وإيصال الدفع وسنقوم بالرد عليك برسالة تأكيد هنا في غضون دقائق قليلة! دمتم بصحة وعافية.`;

        await callTelegram(botToken, "sendMessage", {
          chat_id: chatId,
          text: clientDoneMsg,
          parse_mode: "Markdown"
        }).catch((err) => console.error("Error sending subscription confirmation to user:", err));

        // Forward to Admin Chat ID
        const adminChatId = settings.adminChatId;
        if (adminChatId && adminChatId.toString().trim() !== botId && !adminChatId.toString().trim().includes(":")) {
          let adminAlertMsg = `🔔 *طلب اشتراك جديد قيد المراجعــة!*\n\n`;
          adminAlertMsg += `👤 اسم العميل: *${fullName}*\n`;
          adminAlertMsg += `🔗 المعرف: @${username}\n`;
          adminAlertMsg += `✉️ بريد التفعيل: \`${ticket.email}\`\n`;
          adminAlertMsg += `📦 الباقة المطلوبة: *${ticket.planTitle}*\n`;
          adminAlertMsg += `🆔 تذكرة رقم: \`${ticketId}\`\n\n`;
          adminAlertMsg += `👇 صورة التحويل مرفقة بالأسفل:`;

          await callTelegram(botToken, "sendMessage", {
            chat_id: adminChatId,
            text: adminAlertMsg,
            parse_mode: "Markdown"
          }).catch((err) => console.error("Error sending alert to adminChatId:", err));

          // Forward the photo payload
          await callTelegram(botToken, "sendPhoto", {
            chat_id: adminChatId,
            photo: fileId
          }).catch((err) => console.error("Error forwarding receipt to adminChatId:", err));
        }
      } else {
        await callTelegram(botToken, "sendMessage", {
          chat_id: chatId,
          text: "💡 يرجى اختيار الباقة المطلوبة أولاً بالضغط عليها من الأزرار بالأسفل، ثم قم بإدخال بريدك لإتمام عملية إرسال الإيصال بشكل صحيح."
        }).catch((err) => console.error("Error sending select plan suggestion:", err));
      }
      return;
    }

    // Default response
    await callTelegram(botToken, "sendMessage", {
      chat_id: chatId,
      text: "💡 الرجاء استخدام أزرار التحكم بالأسفل لاختيار إحدى باقات التفعيل أو التواصل مع الدعم الفني."
    }).catch((err) => console.error("Error sending default greeting template:", err));
  }
}

// Setup Vite & Static Assets serving
async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Loading Vite server middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at heat 24/7 on port ${PORT}`);
  });
}

bootstrap();
