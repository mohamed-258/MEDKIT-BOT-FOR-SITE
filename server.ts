import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { DatabaseController, checkDatabaseStatus } from './src/dbFallback.ts';
import { Setting, SupportMessage, Menu, Ticket } from './src/types.ts';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// Generate a random instance id for multi-instance identification and master polling logic
const instanceId = `inst_${Math.random().toString(36).substring(2, 11)}`;

// ─── Firebase Admin Setup ───────────────────────────────────────────────────
let firestore: any;
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const adminApp = admin.apps.length ? admin.app() : admin.initializeApp({ projectId: firebaseConfig.projectId });
    firestore = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    firestore.settings({ ignoreUndefinedProperties: true });
    console.log("Firebase Admin SDK successfully configured with Firestore ID:", firebaseConfig.firestoreDatabaseId);
  } else {
    console.warn("firebase-applet-config.json not found. Operating with local memory/JSON database.");
  }
} catch (e: any) {
  console.error("Failed to initialize Firebase Admin SDK. Fallback to local store enabled. Error:", e.message);
}

// Instantiate DatabaseController
const db = new DatabaseController(firestore);
checkDatabaseStatus(firestore).catch((err) => console.error("Database status check error:", err.message));

// ─── Telegram API Helper ────────────────────────────────────────────────────
async function callTelegramAPI(token: string, method: string, payload: any) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const resData = await res.json();
    clearTimeout(timeoutId);
    
    if (!res.ok || !resData.ok) {
      throw new Error(resData.description || `HTTP ${res.status}`);
    }
    return resData;
  } catch (err: any) {
    clearTimeout(timeoutId);
    let errMsg = err.message;
    if (err.name === 'AbortError') {
      errMsg = "انتهاء مهلة الاتصال بخوادم تليجرام (8 ثوانٍ)";
    }
    console.error(`Telegram API Call to ${method} failed:`, errMsg);
    throw new Error(errMsg);
  }
}

async function sendTelegramMessage(token: string, chatId: string, text: string, replyMarkup?: any) {
  const payload: any = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  };
  if (replyMarkup) {
    if (replyMarkup.inline_keyboard) {
      payload.reply_markup = { inline_keyboard: replyMarkup.inline_keyboard };
    } else {
      payload.reply_markup = replyMarkup;
    }
  }
  return await callTelegramAPI(token, "sendMessage", payload);
}

async function setupTelegramWebhook(token: string, enable: boolean, appUrl: string) {
  try {
    if (enable) {
      const targetUrl = `${appUrl}/api/webhook/telegram`;
      console.log(`Setting up setWebhook to target URL: ${targetUrl}`);
      return await callTelegramAPI(token, "setWebhook", { url: targetUrl });
    } else {
      console.log("Deleting Telegram Webhook...");
      return await callTelegramAPI(token, "deleteWebhook", {});
    }
  } catch (err: any) {
    console.error("setupTelegramWebhook failed:", err.message);
    throw err;
  }
}

// ─── Telegram Update Handler ───────────────────────────────────────────────
async function handleTelegramUpdate(update: any) {
  try {
    const settings = await db.getSettings();
    if (!settings.botToken) return;

    const adminIds = settings.adminChatId ? settings.adminChatId.split(/[\s,]+/).filter(Boolean) : [];

    // 1. Check for Callback Query
    if (update.callback_query) {
      const cb = update.callback_query;
      const from = cb.from || {};
      const data = cb.data || '';
      const userIdStr = from.id?.toString();
      const chat = cb.message?.chat || {};
      const chatIdStr = chat.id?.toString() || userIdStr;
      
      if (!chatIdStr) return;
      
      const isAdmin = adminIds.includes(userIdStr) || adminIds.includes(chatIdStr);

      // 1.a Admin Buttons Handler (Approve / Reject / Reply)
      if (data.startsWith('admin_approve:') || data.startsWith('admin_reject:') || data.startsWith('admin_reply:')) {
        if (!isAdmin) {
          await callTelegramAPI(settings.botToken, 'answerCallbackQuery', {
            callback_query_id: cb.id,
            text: "عذراً، هذا الإجراء متاح للمشرفين فقط.",
            show_alert: true
          });
          return;
        }

        const action = data.startsWith('admin_approve:') ? 'approve' : data.startsWith('admin_reject:') ? 'reject' : 'reply';
        const ticketId = data.substring(data.indexOf(':') + 1);

        const ticket = await db.getTicket(ticketId);
        if (!ticket) {
          await callTelegramAPI(settings.botToken, 'answerCallbackQuery', {
            callback_query_id: cb.id,
            text: "عذراً، لم يتم العثور على هذا الطلب في الخادم.",
            show_alert: true
          });
          return;
        }

        if (action === 'reply') {
          await callTelegramAPI(settings.botToken, 'answerCallbackQuery', {
            callback_query_id: cb.id,
            text: "للرد برسالة مخصصة، يرجى كتابة الرد بعمل Reply مباشرةً على هذه الرسالة.",
            show_alert: true
          });
          return;
        }

        if (ticket.status !== 'new') {
          await callTelegramAPI(settings.botToken, 'answerCallbackQuery', {
            callback_query_id: cb.id,
            text: `عذراً، تم اتخاذ إجراء مسبق على هذا الطلب وهو: ${ticket.status === 'approved' ? 'مقبول ✅' : 'مرفوض ❌'}`,
            show_alert: true
          });
          return;
        }

        const adminName = [from.first_name || '', from.last_name || ''].filter(Boolean).join(' ') || "مشرف الإدارة";

        if (action === 'approve') {
          ticket.status = 'approved';
          ticket.updatedAt = new Date().toISOString();
          ticket.adminComment = `تم القبول والتشغيل من تيليجرام بواسطة المشرف: ${adminName}`;
          await db.saveTicket(ticket);

          // Inform user
          if (ticket.telegramUserId) {
            const userMsg = `🎉 <b>تم قبول والموافقة على طلب تفعيل الباقة (${ticket.menuTitle}) الخاص بك بنجاح!</b>\n\nيسعدنا انضمامك وتفعيله في المنصة. 🏥✨\n\n📝 <b>ملاحظة الإدارة:</b> تم المراجعة والتفعيل الفوري لحسابك.`;
            await sendTelegramMessage(settings.botToken, ticket.telegramUserId, userMsg).catch(e => {});
          }

          // Broadcast status to other admins
          for (const adminId of adminIds) {
            const broadcastMsg = `✅ <b>البوت: تم تفعيل الطلب!</b>\n\n👤 العميل: <b>${ticket.fullName}</b>\n📦 الباقة: <b>${ticket.menuTitle}</b>\n\n👮 تمت الموافقة والتفعيل بواسطة المشرف: <b>${adminName}</b> (@${from.username || ''})`;
            await sendTelegramMessage(settings.botToken, adminId, broadcastMsg).catch(e => {});
          }
        } else if (action === 'reject') {
          ticket.status = 'rejected';
          ticket.updatedAt = new Date().toISOString();
          ticket.adminComment = `تم الرفض من تيليجرام بواسطة المشرف: ${adminName}`;
          await db.saveTicket(ticket);

          // Inform user
          if (ticket.telegramUserId) {
            const userMsg = `❌ <b>معذرةً، تم رفض طلب تفعيل باقة (${ticket.menuTitle}) الخاص بك لعدم استيفاء الشروط.</b>\n\nيرجى إعادة إرسال الطلب بصورة صحيحة وواضحة للإيصال أو التواصل مع الدعم الفني للمنصة.`;
            await sendTelegramMessage(settings.botToken, ticket.telegramUserId, userMsg).catch(e => {});
          }

          // Broadcast status to other admins
          for (const adminId of adminIds) {
            const broadcastMsg = `❌ <b>البوت: تم رفض الطلب!</b>\n\n👤 العميل: <b>${ticket.fullName}</b>\n📦 الباقة: <b>${ticket.menuTitle}</b>\n\n👮 تم الرفض بواسطة المشرف: <b>${adminName}</b> (@${from.username || ''})`;
            await sendTelegramMessage(settings.botToken, adminId, broadcastMsg).catch(e => {});
          }
        }

        // Remove keyboard from the current message and update message text to show completion
        try {
          const chat_id = cb.message?.chat?.id;
          const message_id = cb.message?.message_id;
          if (chat_id && message_id) {
            const label = action === 'approve' ? 'مقبول ✅' : 'مرفوض ❌';
            if (cb.message.photo) {
              const originalCaption = cb.message.caption || "";
              const cleanCaption = originalCaption + `\n\n📥 <b>القرار: تم معالجة الطلب (${label}) بواسطة: ${adminName}</b>`;
              await callTelegramAPI(settings.botToken, "editMessageCaption", {
                chat_id,
                message_id,
                caption: cleanCaption,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: [] }
              });
            } else {
              const originalText = cb.message.text || "";
              const cleanText = originalText + `\n\n📥 <b>القرار: تم معالجة الطلب (${label}) بواسطة: ${adminName}</b>`;
              await callTelegramAPI(settings.botToken, "editMessageText", {
                chat_id,
                message_id,
                text: cleanText,
                parse_mode: "HTML",
                reply_markup: { inline_keyboard: [] }
              });
            }
          }
        } catch (e: any) {
          console.error("Failed to edit inline message:", e.message);
        }

        await callTelegramAPI(settings.botToken, 'answerCallbackQuery', {
          callback_query_id: cb.id,
          text: `تم حفظ الإجراء وإشعار العميل.`
        });
        return;
      }

      // 1.b User Subscription Selected Plan Callback Handler
      if (data.startsWith('select_plan:')) {
        const planId = data.replace('select_plan:', '');
        const menus = await db.getMenus();
        const menu = menus.find((m) => m.id === planId);
        
        if (menu) {
          // Update Session
          const session = await db.getSession(userIdStr);
          session.step = "awaiting_info";
          session.selectedPlanId = planId;
          await db.saveSession(session);
          
          try {
            // Acknowledge the callback query
            await callTelegramAPI(settings.botToken, 'answerCallbackQuery', { callback_query_id: cb.id });
            
            // Send details and prompt for email
            await sendTelegramMessage(settings.botToken, chatIdStr, menu.details || `باقة ${menu.title}\nالسعر: ${menu.price}`);
          } catch (e: any) {
            console.error("Callback select_plan handler failed:", e.message);
          }
        }
      }
      return;
    }

    // 2. Check for Incoming Message
    if (update.message) {
      const msg = update.message;
      const from = msg.from || {};
      const chat = msg.chat || {};
      const chatIdStr = chat.id?.toString();
      const text = msg.text || '';
      const photos = msg.photo || [];
      const document = msg.document;
      
      if (!chatIdStr) return;
      
      const fullname = [from.first_name || '', from.last_name || ''].filter(Boolean).join(' ') || "مستخدم تلغرام";
      const username = from.username || "";

      // 2.a Intercept Admin replies (Replying to general support messages or ticket notices)
      if (msg.reply_to_message) {
        const replyTo = msg.reply_to_message;
        const replyText = text.trim();
        const isAdmin = adminIds.includes(chatIdStr) || adminIds.includes(from.id?.toString());

        if (isAdmin && replyText) {
          const textToSearch = (replyTo.text || replyTo.caption || "");
          const userIdMatch = textToSearch.match(/(?:معرف العميل|معرف العميل للرد):\s*(\d+)/) || textToSearch.match(/id:\s*([^\s\n]+)/i);
          const ticketIdMatch = textToSearch.match(/(?:رقم الطلب|Ticket ID):\s*([a-zA-Z0-9_]+)/);

          if (userIdMatch) {
            const targetUserId = userIdMatch[1];
            try {
              // Send direct reply message to customer
              await sendTelegramMessage(settings.botToken, targetUserId, `💬 <b>رد من إدارة ميدكيت:</b>\n\n${replyText}`);
              await sendTelegramMessage(settings.botToken, chatIdStr, `✅ تم إرسال ردك الخاص بنجاح للعميل.`);

              // If a Ticket ID exists in the original forwarded message, update its status
              if (ticketIdMatch) {
                const ticketId = ticketIdMatch[1];
                const ticket = await db.getTicket(ticketId);
                if (ticket) {
                  ticket.status = "replied";
                  ticket.adminComment = replyText;
                  ticket.updatedAt = new Date().toISOString();
                  await db.saveTicket(ticket);
                }
              }
            } catch (err: any) {
              await sendTelegramMessage(settings.botToken, chatIdStr, `❌ فشل إرسال الرد للعميل: ${err.message}`);
            }
            return;
          }
        }
      }
      
      // Get or initialize User Session
      const session = await db.getSession(chatIdStr);
      
      // Check for /start command
      if (text.trim().toLowerCase() === '/start') {
        session.step = "idle";
        session.selectedPlanId = "";
        await db.saveSession(session);
        
        const menus = await db.getMenus();
        const inlineKeyboard: any[] = [];
        
        for (const menu of menus) {
          inlineKeyboard.push([{
            text: `🟢 ${menu.title} (${menu.price})`,
            callback_data: `select_plan:${menu.id}`
          }]);
        }
        
        const welcomeText = settings.welcomeMessage || "🏥 مرحباً بك في مساعد تفعيل باقات ميدكيت!";
        await sendTelegramMessage(settings.botToken, chatIdStr, welcomeText, {
          inline_keyboard: inlineKeyboard
        });
        return;
      }
      
      // Log all conversations to Support Messages so admin can check and chat manually
      let photoUrl = "";
      if (photos.length > 0) {
        try {
          const fileId = photos[photos.length - 1].file_id;
          const fileInfo = await callTelegramAPI(settings.botToken, "getFile", { file_id: fileId });
          if (fileInfo?.result?.file_path) {
            photoUrl = `https://api.telegram.org/file/bot${settings.botToken}/${fileInfo.result.file_path}`;
          }
        } catch (e) {
          console.error("Failed to parse message photo for support logs:", e);
        }
      } else if (document) {
        try {
          const fileId = document.file_id;
          const fileInfo = await callTelegramAPI(settings.botToken, "getFile", { file_id: fileId });
          if (fileInfo?.result?.file_path) {
            photoUrl = `https://api.telegram.org/file/bot${settings.botToken}/${fileInfo.result.file_path}`;
          }
        } catch (e) {
          console.error("Failed to parse document for support logs:", e);
        }
      }
      
      const supportMsg: SupportMessage = {
        id: `supp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        telegramUserId: chatIdStr,
        telegramUsername: username,
        telegramName: fullname,
        messageText: text || (photos.length > 0 ? "[أرسل إثبات تحويل كصورة]" : "[أرسل مستند]"),
        messagePhotoUrl: photoUrl || undefined,
        createdAt: new Date().toISOString(),
        replied: false
      };
      await db.saveSupportMessage(supportMsg);

      // Forward general support messages to admins if user is NOT currently in an active step machine
      if ((session.step === "idle" || !session.step) && text.trim().toLowerCase() !== '/start') {
        const isSelfAdmin = adminIds.includes(chatIdStr) || adminIds.includes(from.id?.toString());
        if (!isSelfAdmin && adminIds.length > 0) {
          const adminNotifyText = `💬 <b>رسالة دعم جديدة!</b>\n\n👤 العميل: <b>${fullname}</b> (@${username})\n✉️ الرسالة: ${text || "[ملف/صورة]"}\n\n👤 معرف العميل: <code>${chatIdStr}</code>\n\n👈 للرد على هذه الرسالة، قم بعمل "Reply" عليها مباشرة واكتب ردك.`;
          for (const adminId of adminIds) {
            try {
              if (photoUrl) {
                await callTelegramAPI(settings.botToken, "sendPhoto", {
                  chat_id: adminId,
                  photo: photoUrl,
                  caption: adminNotifyText,
                  parse_mode: "HTML"
                });
              } else {
                await sendTelegramMessage(settings.botToken, adminId, adminNotifyText);
              }
            } catch (e: any) {
              console.error(`Failed to forward support text to admin ${adminId}:`, e.message);
            }
          }
        }
      }
      
      // State Machine handling
      if (session.step === "awaiting_info") {
        session.email = text.trim();
        session.step = "awaiting_receipt";
        await db.saveSession(session);
        
        const promptReceipt = `عظيم! لقد قمنا بتسجيل بريدك الإلكتروني بنجاح: <b>${text.trim()}</b>\n\nيرجى الآن إرفاق وإرسال صورة واضحة لإثبات التحويل (لقطة الشاشة للتحويل بالكامل أو الإيصال) ليتم إرسال طلبك فوراً لمراجعة الإدارة وتفعيل اشتراكك بالمنصة. 📸🧾`;
        await sendTelegramMessage(settings.botToken, chatIdStr, promptReceipt);
        return;
      }
      
      if (session.step === "awaiting_receipt") {
        if (photos.length > 0 || photoUrl) {
          try {
            // Get Plan Detail
            const menus = await db.getMenus();
            const pId = session.selectedPlanId || "m";
            const menu = menus.find((m) => m.id === pId) || { title: "باقة ميدكيت مخصصة" };
            
            // Create a Ticket
            const ticketId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const ticket: any = {
              id: ticketId,
              telegramUserId: chatIdStr,
              telegramUsername: username,
              telegramName: fullname,
              userId: chatIdStr,
              username: username,
              fullName: fullname,
              email: session.email || "",
              menuId: pId,
              menuTitle: menu.title,
              receiptPhotoUrl: photoUrl,
              transactionImage: photoUrl,
              status: "new",
              adminComment: "",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            await db.saveTicket(ticket as any);
            
            // Reset Session
            session.step = "idle";
            session.selectedPlanId = "";
            await db.saveSession(session);
            
            const successMsg = `تم استقبال إثبات التحويل بنجاح! 🎉\n\nلقد أرسلنا طلبك المرفق للمشرفين لمراجعته وتفعيله. سيصلك إشعار فوري هنا على تيليجرام فور الموافقة والتفعيل! 👍`;
            await sendTelegramMessage(settings.botToken, chatIdStr, successMsg);
            
            // Notify Admins
            if (adminIds.length > 0) {
              const adminNotifyText = `🔔 <b>طلب تفعيل واشتراك جديد!</b>\n\n👤 العميل: <b>${fullname}</b> (@${username})\n✉️ الايميل: <b>${ticket.email}</b>\n📦 الباقة: <b>${menu.title}</b>\n\n👤 معرف العميل: <code>${chatIdStr}</code>\n🆔 رقم الطلب: <code>${ticketId}</code>\n\n👈 يمكنك قبول أو رفض الطلب فوراً باستخدام الأزرار أدناه، أو عمل Reply والرد برسالة مخصصة مباشرة.`;
              
              const inlineKeyboard = {
                inline_keyboard: [
                  [
                    { text: "✅ قبول الطلب", callback_data: `admin_approve:${ticketId}` },
                    { text: "❌ رفض الطلب", callback_data: `admin_reject:${ticketId}` }
                  ],
                  [
                    { text: "💬 الرد مخصص", callback_data: `admin_reply:${ticketId}` }
                  ]
                ]
              };
              
              for (const adminId of adminIds) {
                try {
                  if (photoUrl) {
                    await callTelegramAPI(settings.botToken, "sendPhoto", {
                      chat_id: adminId,
                      photo: photoUrl,
                      caption: adminNotifyText,
                      parse_mode: "HTML",
                      reply_markup: inlineKeyboard
                    });
                  } else {
                    await sendTelegramMessage(settings.botToken, adminId, adminNotifyText, inlineKeyboard);
                  }
                } catch (e: any) {
                  console.error(`Failed to notify admin ${adminId}:`, e.message);
                }
              }
            }
          } catch (err: any) {
            console.error("Failed to process transaction receipt photo:", err.message);
            await sendTelegramMessage(settings.botToken, chatIdStr, "⚠️ حدث خطأ أثناء معالجة الصورة وإرسالها للإدارة. يرجى محاولة إرسال الصورة بشكل صحيح مرة أخرى.");
          }
          return;
        } else {
          await sendTelegramMessage(settings.botToken, chatIdStr, "⚠️ يرجى إرسال صورة إثبات تحويل المبلغ (كلفتة شاشة أو صورة إيصال واضحة) للمواصلة وتفعيل الباقة.");
          return;
        }
      }
      
      const replyFallback = "أهلاً بك! لعرض خطط الأسعار والاشتراكات المتاحة وتفعيل الإشتراك، يرجى كتابة أو الضغط على /start .";
      await sendTelegramMessage(settings.botToken, chatIdStr, replyFallback);
    }
  } catch (e: any) {
    console.error("Critical error in handleTelegramUpdate loop:", e.message);
  }
}

// ─── API REST Endpoints ─────────────────────────────────────────────────────

// Get Settings
app.get('/api/settings', async (req, res) => {
  try {
    const data = await db.getSettings();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update Settings
app.post('/api/settings', async (req, res) => {
  try {
    const { botToken, adminChatId, welcomeMessage, dashboardPassword, devPollingEnabled } = req.body;
    const settings = await db.getSettings();
    
    if (botToken !== undefined) settings.botToken = botToken;
    if (adminChatId !== undefined) settings.adminChatId = adminChatId;
    if (welcomeMessage !== undefined) settings.welcomeMessage = welcomeMessage;
    if (dashboardPassword !== undefined) settings.dashboardPassword = dashboardPassword;
    if (devPollingEnabled !== undefined) settings.devPollingEnabled = devPollingEnabled;
    
    await db.saveSettings(settings);
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Menus
app.get('/api/menus', async (req, res) => {
  try {
    const menus = await db.getMenus();
    res.json(menus);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Save Menu
app.post('/api/menus', async (req, res) => {
  try {
    const menu = req.body;
    await db.saveMenu(menu);
    res.json({ success: true, menu });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Menu
app.delete('/api/menus/:id', async (req, res) => {
  try {
    await db.deleteMenu(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Tickets
app.get('/api/tickets', async (req, res) => {
  try {
    const tickets = await db.getTickets();
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Ticket
app.delete('/api/tickets/:id', async (req, res) => {
  try {
    await db.deleteTicket(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Support Messages
app.get('/api/support-messages', async (req, res) => {
  try {
    const messages = await db.getSupportMessages();
    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Support Message
app.delete('/api/support-messages/:id', async (req, res) => {
  try {
    await db.deleteSupportMessage(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reply Support Message on Telegram
app.post('/api/support-messages/reply', async (req, res) => {
  try {
    const { messageId, replyText } = req.body;
    const msg = await db.getSupportMessage(messageId);
    if (!msg) {
      return res.status(404).json({ error: "الرسالة غير موجودة بالخادم" });
    }
    
    const settings = await db.getSettings();
    if (!settings.botToken) {
      return res.status(400).json({ error: "يرجى تهيئة توكن البوت في الإعدادات أولاً." });
    }
    
    // Send Telegram message
    await sendTelegramMessage(settings.botToken, msg.telegramUserId, replyText);
    
    // Update DB record
    msg.replied = true;
    msg.replyText = replyText;
    msg.repliedAt = new Date().toISOString();
    await db.saveSupportMessage(msg);
    
    res.json({ success: true, message: msg });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل إرسال الرد للعميل" });
  }
});

// Accept/Reject Ticket & Notify user
app.post('/api/admin/reply', async (req, res) => {
  try {
    const { ticketId, replyMessage, newStatus } = req.body;
    const ticket = await db.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: "الطلب غير موجود بالخادم" });
    }
    
    const settings = await db.getSettings();
    if (!settings.botToken) {
      return res.status(400).json({ error: "يرجى تهيئة توكن البوت في الإعدادات أولاً." });
    }
    
    // Update ticket status
    ticket.status = newStatus;
    ticket.adminComment = replyMessage;
    ticket.updatedAt = new Date().toISOString();
    await db.saveTicket(ticket);
    
    // Notify Telegram user if possible
    if (ticket.telegramUserId) {
      let textMsg = "";
      if (newStatus === "approved") {
        textMsg = `🎉 <b>تم قبول والموافقة على طلب تفعيل الباقة (${ticket.menuTitle}) الخاص بك بنجاح!</b>\n\nيسعدنا انضمامك وتفعيله في المنصة. 🏥✨ \n\n📝 <b>ملاحظة الإدارة:</b> ${replyMessage}`;
      } else if (newStatus === "rejected") {
        textMsg = `❌ <b>معذرةً، تم رفض طلب التفعيل لعدم استيفاء الشروط.</b>\n\n📝 <b>السبب وملاحظة الإدارة:</b> ${replyMessage}\n\nيرجى إعادة تقديم الطلب ببيانات وصورة صحيحة أو التواصل معنا.`;
      } else {
        textMsg = `🔔 <b>تحديث من الإدارة بخصوص طلب التفعيل الخاص بك:</b>\n\n${replyMessage}`;
      }
      await sendTelegramMessage(settings.botToken, ticket.telegramUserId, textMsg);
    }
    
    res.json({ success: true, ticket });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل تحديث حالة الطلب" });
  }
});

// Get Telegram integration status checks
app.get('/api/telegram-status', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const hasToken = !!settings.botToken;
    
    let webhookInfo = null;
    let botUser = null;
    
    if (hasToken) {
      try {
        const meRes = await callTelegramAPI(settings.botToken, "getMe", {});
        if (meRes?.result) {
          botUser = meRes.result;
        }
        
        const webhookRes = await callTelegramAPI(settings.botToken, "getWebhookInfo", {});
        if (webhookRes?.result) {
          webhookInfo = webhookRes.result;
        }
      } catch (e: any) {
        console.error("Failed to dynamically fetch Telegram stats for bot info:", e.message);
      }
    }
    
    const activeInstances = await db.getActiveInstances();
    
    res.json({
      configured: hasToken,
      botUser,
      instanceId,
      isPollingActive: pollingActive && settings.devPollingEnabled !== false,
      masterInstanceId: settings.masterInstanceId || instanceId,
      devPollingEnabled: settings.devPollingEnabled !== false,
      activeInstances,
      webhookInfo
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Configure Bot Webhook
app.post('/api/setup-webhook', async (req, res) => {
  try {
    const settings = await db.getSettings();
    if (!settings.botToken) {
      return res.status(400).json({ error: "يرجى تهيئة توكن البوت في الإعدادات أولاً." });
    }
    
    const host = req.get('host');
    // Telegram webhooks strictly require secure (HTTPS) URLs. Force HTTPS for zero deployment friction on cloud environments.
    let appUrl = process.env.APP_URL || '';
    if (!appUrl || appUrl === 'MY_APP_URL' || !appUrl.startsWith('http')) {
      appUrl = host ? `https://${host}` : '';
    } else if (appUrl.startsWith("http://")) {
      appUrl = appUrl.replace("http://", "https://");
    }
    
    if (!appUrl) {
      return res.status(400).json({ error: "تعذر تحديد رابط خادم الويب هوك الخاص بك." });
    }
    
    settings.activeInstanceUrl = appUrl;
    await db.saveSettings(settings);
    
    const result = await setupTelegramWebhook(settings.botToken, true, appUrl);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "حدث خطأ أثناء تفعيل الويب هوك" });
  }
});

// Disable/Remove Bot Webhook
app.post('/api/remove-webhook', async (req, res) => {
  try {
    const settings = await db.getSettings();
    settings.activeInstanceUrl = "";
    await db.saveSettings(settings);
    
    if (settings.botToken) {
      await setupTelegramWebhook(settings.botToken, false, "");
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "فشل إيقاف الويب هوك" });
  }
});

// Toggle Polling
app.post('/api/polling/toggle', async (req, res) => {
  try {
    const { enabled, claimMaster } = req.body;
    const settings = await db.getSettings();
    
    settings.devPollingEnabled = enabled;
    if (claimMaster) {
      settings.masterInstanceId = instanceId;
    }
    
    await db.saveSettings(settings);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Incoming Telegram Webhook
app.post('/api/webhook/telegram', async (req, res) => {
  try {
    const update = req.body;
    // Send 200 OK immediately to Telegram to prevent retry timeouts
    res.status(200).send('OK');
    
    if (update && update.update_id) {
      const claimed = await db.claimUpdate(update.update_id, instanceId);
      if (claimed) {
        await handleTelegramUpdate(update);
      }
    }
  } catch (err: any) {
    console.error("Webhook processing error:", err.message);
  }
});

// ─── Long Polling Executor ───────────────────────────────────────────────────
let pollingActive = false;
let lastUpdateId = 0;
let lastWebhookCheck = 0;
let isWebhookCurrentlyActive = false;

async function runLongPolling() {
  if (pollingActive) return;
  pollingActive = true;
  console.log('MedKit Telegram Long Polling service started on thread.');

  while (pollingActive) {
    try {
      const settings = await db.getSettings();
      
      // Standby / sleep if token missing or devPollingEnabled is set to false
      if (!settings.botToken || settings.devPollingEnabled === false) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Check if Webhook is active on Telegram periodically to avoid Conflicts
      const now = Date.now();
      if (now - lastWebhookCheck > 45000) {
        lastWebhookCheck = now;
        try {
          const webhookRes = await callTelegramAPI(settings.botToken, "getWebhookInfo", {});
          isWebhookCurrentlyActive = !!(webhookRes && webhookRes.result && webhookRes.result.url);
          if (isWebhookCurrentlyActive) {
            console.log(`🤖 [Webhook Active] Telegram Webhook is currently active (${webhookRes.result.url}). Suspending long polling to avoid conflicts.`);
          }
        } catch (e: any) {
          console.error("Failed to check Webhook status in polling cycle:", e.message);
        }
      }

      if (isWebhookCurrentlyActive) {
        // Standby/Sleep for 30s and re-evaluate
        await new Promise(resolve => setTimeout(resolve, 30000));
        continue;
      }

      // Try acquiring multi-instance authorization lock
      const hasLock = await db.acquirePollingLock(instanceId);
      if (!hasLock) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        continue;
      }

      // Heartbeat self-register
      await db.registerInstance(instanceId, {
        url: process.env.APP_URL || "Railway Deployment",
        lastSeen: Date.now()
      });

      const response = await callTelegramAPI(settings.botToken, 'getUpdates', {
        offset: lastUpdateId + 1,
        limit: 20,
        timeout: 15
      });

      if (response && response.result) {
        for (const update of response.result) {
          lastUpdateId = Math.max(lastUpdateId, update.update_id);
          
          const claimed = await db.claimUpdate(update.update_id, instanceId);
          if (claimed) {
            await handleTelegramUpdate(update);
          }
        }
      }
    } catch (err: any) {
      const errMsg = err.message || "";
      console.error('Long Polling encountered an error:', errMsg);
      
      // Self-healing backoff logic for multi-instance getUpdates conflicts
      if (errMsg.includes('terminated by other getUpdates') || errMsg.toLowerCase().includes('terminated by other')) {
        console.warn(`⚠️ [Polling Standby] Another active instance detected calling getUpdates for this bot! This instance (${instanceId}) will step down and sleep for 90 seconds to prevent conflicts and ensure production runs smoothly.`);
        await new Promise(resolve => setTimeout(resolve, 90000));
      } 
      // Safe guard for Webhook active conflicts
      else if (errMsg.includes("can't use getUpdates") || errMsg.toLowerCase().includes('webhook is active') || errMsg.includes('409')) {
        console.warn(`🚨 [Webhook Active] A Telegram Webhook is active. This instance (${instanceId}) will suspend long-polling and standby for 120 seconds.`);
        isWebhookCurrentlyActive = true;
        lastWebhookCheck = Date.now();
        await new Promise(resolve => setTimeout(resolve, 120000));
      } 
      // Generic error backoff
      else {
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }
    await new Promise(resolve => setTimeout(resolve, 600));
  }
}

// ─── Server Start ────────────────────────────────────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MedKit Bot Management Server listening on http://0.0.0.0:${PORT}`);
    runLongPolling().catch(err => console.error('Error starting long polling:', err.message));
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
