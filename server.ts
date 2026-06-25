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

// ─── Deduplication & Rate Limit Locks ────────────────────────────────────────
const updatesInProgress = new Set<number>();
const ticketsInProgress = new Set<string>();

// ─── Firebase Admin Setup ───────────────────────────────────────────────────
let firestore: any;
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(firebaseConfigPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    
    let credentialOption: any = {};
    let serviceAccountJson: any = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccountJson = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        console.log("Firebase Init: Using service account from FIREBASE_SERVICE_ACCOUNT env variable.");
      } catch (e: any) {
        console.error("Firebase Init: Failed to parse FIREBASE_SERVICE_ACCOUNT env variable as JSON. Error:", e.message);
      }
    } else if (fs.existsSync(path.join(process.cwd(), "firebase-service-account.json"))) {
      try {
        serviceAccountJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-service-account.json"), "utf-8"));
        console.log("Firebase Init: Using service account from firebase-service-account.json file.");
      } catch (e: any) {
        console.error("Firebase Init: Failed to parse firebase-service-account.json. Error:", e.message);
      }
    }

    if (serviceAccountJson) {
      credentialOption = { credential: admin.credential.cert(serviceAccountJson) };
    } else {
      credentialOption = { projectId: firebaseConfig.projectId };
      console.log("Firebase Init: Using default credentials (suitable for Google Cloud environment).");
    }

    const adminApp = admin.apps.length 
      ? admin.app() 
      : admin.initializeApp({
          ...credentialOption,
          projectId: firebaseConfig.projectId
        });

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
  // Adjust timeout: getUpdates can wait up to payload.timeout (default 15s) plus network overhead.
  const timeoutMs = method === 'getUpdates' 
    ? ((payload?.timeout || 15) * 1000 + 10000) 
    : 15000; // 15 seconds for regular Telegram API calls to handle slow networks or cold boots
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
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
      errMsg = `انتهاء مهلة الاتصال بخوادم تليجرام (${Math.round(timeoutMs / 1000)} ثوانٍ)`;
    }
    if (method === 'getUpdates' && (errMsg.includes('Conflict') || errMsg.toLowerCase().includes('terminated by other'))) {
      console.warn(`Telegram API Call to ${method} gracefully handled conflict:`, errMsg);
    } else {
      console.error(`Telegram API Call to ${method} failed:`, errMsg);
    }
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

// parseUserIdAndTicketId helper function for parsing text reliably
function parseUserIdAndTicketId(text: string) {
  let userId: string | null = null;
  let ticketId: string | null = null;

  if (!text) return { userId, ticketId };

  const userFilters = [
    /(?:معرف العميل للرد|معرف العميل|العميل للرد|العميل|Client ID|User ID|ID|id)[^\d\n-]*[:\s]*(-?\d+)/i,
    /ID\s*:\s*(-?\d+)/i,
    /id\s*:\s*(-?\d+)/i,
    /(?:ID|id)[\s:]*(-?\d+)/i
  ];

  for (const filter of userFilters) {
    const match = text.match(filter);
    if (match && match[1]) {
      userId = match[1];
      break;
    }
  }

  const ticketFilters = [
    /(?:رقم الطلب|Ticket ID|رقم التذكرة|الطلب)[^\s\n:]*[:\s]*(tkt_[a-zA-Z0-9_]+)/i,
    /(tkt_[a-zA-Z0-9_]+)/i
  ];

  for (const filter of ticketFilters) {
    const match = text.match(filter);
    if (match && match[1]) {
      ticketId = match[1];
      break;
    }
  }

  return { userId, ticketId };
}

async function sendWelcomeMenu(token: string, chatIdStr: string, settings: any, prefixText = "") {
  try {
    const menus = await db.getMenus();
    const replyKeyboardButtons: any[][] = menus.map((menu) => ([{
      text: "🫁 " + menu.title
    }]));
    replyKeyboardButtons.push([{ text: "💬 تواصل مع الدعم الفني" }]);

    const welcomeText = (prefixText ? prefixText + "\n\n" : "") + 
      (settings.welcomeMessage || "🏥 أهلاً بك في بوت تفعيل اشتراكات منصة ميدكيت (MedKit)!\n\n📋 اختر الباقة المناسبة لك من القائمة أدناه 👇");

    await callTelegramAPI(token, "sendMessage", {
      chat_id: chatIdStr,
      text: welcomeText,
      parse_mode: "HTML",
      reply_markup: {
        keyboard: replyKeyboardButtons,
        resize_keyboard: true,
        one_time_keyboard: false,
        input_field_placeholder: "اختر باقة من القائمة..."
      }
    });
  } catch (err: any) {
    console.error("Failed to send welcome menu:", err.message);
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

        if (action !== 'reply') {
          if (ticketsInProgress.has(ticketId)) {
            await callTelegramAPI(settings.botToken, 'answerCallbackQuery', {
              callback_query_id: cb.id,
              text: "يرجى الانتظار، جاري معالجة هذا الإجراء حالياً...",
              show_alert: true
            });
            return;
          }
          ticketsInProgress.add(ticketId);
        }

        try {
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
              text: "تم تفعيل حقل كتابة الرد الفوري للعميل..."
            });

            const replyPrompt = `💬 <b>اكتب ردك الموجه للعميل أدناه:</b>\n\n👤 معرف العميل للرد: <code>${ticket.telegramUserId}</code>\n🆔 رقم الطلب: <code>${ticket.id}</code>\n\n👈 قم بـ Reply (رد) مباشرة على هذه الرسالة واكتب ردك الموجه للعميل وسيتم إرساله وتحديثه فوراً!`;

            await callTelegramAPI(settings.botToken, "sendMessage", {
              chat_id: chatIdStr,
              text: replyPrompt,
              parse_mode: "HTML",
              reply_to_message_id: cb.message?.message_id,
              reply_markup: {
                force_reply: true,
                selective: true
              }
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
        } finally {
          if (action !== 'reply') {
            ticketsInProgress.delete(ticketId);
          }
        }
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
          const { userId: targetUserId, ticketId } = parseUserIdAndTicketId(textToSearch);

          if (targetUserId) {
            try {
              // Send direct reply message to customer
              await sendTelegramMessage(settings.botToken, targetUserId, `💬 <b>رد من إدارة ميدكيت:</b>\n\n${replyText}`);
              await sendTelegramMessage(settings.botToken, chatIdStr, `✅ تم إرسال ردك الخاص بنجاح للعميل.`);

              // Find who replied
              const adminName = [from.first_name || '', from.last_name || ''].filter(Boolean).join(' ') || "مشرف الإدارة";

              // Broadcast notification to other admins
              const broadcastMsg = `💬 <b>البوت: تم إرسال رد مخصص للعميل!</b>\n\n👤 العميل: <b>معرف العميل (ID: ${targetUserId})</b>\n✍️ الرد: <b>${replyText}</b>\n\n👮 المشرف الذي قام بالرد: <b>${adminName}</b> (@${from.username || ''})`;
              for (const adminId of adminIds) {
                if (adminId !== chatIdStr && adminId !== from.id?.toString()) {
                  await sendTelegramMessage(settings.botToken, adminId, broadcastMsg).catch(e => {});
                }
              }

              // If a Ticket ID exists, update its status to replied
              if (ticketId) {
                const ticket = await db.getTicket(ticketId);
                if (ticket) {
                  ticket.status = "replied";
                  ticket.adminComment = replyText;
                  ticket.updatedAt = new Date().toISOString();
                  await db.saveTicket(ticket);

                  // Dismiss inline keyboards on decision
                  try {
                    const originalMessageId = replyTo.reply_to_message?.message_id;
                    if (originalMessageId && replyTo.reply_to_message?.chat?.id) {
                      const chat_id = replyTo.reply_to_message.chat.id;
                      if (replyTo.reply_to_message.photo) {
                        const originalCaption = replyTo.reply_to_message.caption || "";
                        const cleanCaption = originalCaption + `\n\n📥 <b>القرار: تم الرد المخصص (${adminName})</b>`;
                        await callTelegramAPI(settings.botToken, "editMessageCaption", {
                          chat_id,
                          message_id: originalMessageId,
                          caption: cleanCaption,
                          parse_mode: "HTML",
                          reply_markup: { inline_keyboard: [] }
                        }).catch(() => {});
                      } else {
                        const originalText = replyTo.reply_to_message.text || "";
                        const cleanText = originalText + `\n\n📥 <b>القرار: تم الرد المخصص (${adminName})</b>`;
                        await callTelegramAPI(settings.botToken, "editMessageText", {
                          chat_id,
                          message_id: originalMessageId,
                          text: cleanText,
                          parse_mode: "HTML",
                          reply_markup: { inline_keyboard: [] }
                        }).catch(() => {});
                      }
                    } else if (replyTo.message_id && replyTo.chat?.id) {
                      const chat_id = replyTo.chat.id;
                      const msg_id = replyTo.message_id;
                      if (replyTo.photo) {
                        const originalCaption = replyTo.caption || "";
                        const cleanCaption = originalCaption + `\n\n📥 <b>القرار: تم الرد المخصص (${adminName})</b>`;
                        await callTelegramAPI(settings.botToken, "editMessageCaption", {
                          chat_id,
                          message_id: msg_id,
                          caption: cleanCaption,
                          parse_mode: "HTML",
                          reply_markup: { inline_keyboard: [] }
                        }).catch(() => {});
                      } else {
                        const originalText = replyTo.text || "";
                        const cleanText = originalText + `\n\n📥 <b>القرار: تم الرد المخصص (${adminName})</b>`;
                        await callTelegramAPI(settings.botToken, "editMessageText", {
                          chat_id,
                          message_id: msg_id,
                          text: cleanText,
                          parse_mode: "HTML",
                          reply_markup: { inline_keyboard: [] }
                        }).catch(() => {});
                      }
                    }
                  } catch (e: any) {
                    console.error("Failed to dismiss inline keyboards in handleTelegramUpdate reply_to:", e.message);
                  }
                }
              }
            } catch (e: any) {
              console.error("Callback reply handler failed:", e.message);
            }
          }
          return;
        }
      }

      // Get / Create Session
      const session = await db.getSession(chatIdStr);

      // Check for cancel / back commands
      if (text.trim() === "❌ إلغاء الطلب" || text.trim().toLowerCase() === '/cancel' || text.trim() === "🔙 العودة للقائمة") {
        session.step = "idle";
        session.selectedPlanId = "";
        session.email = "";
        await db.saveSession(session);
        
        await sendWelcomeMenu(
          settings.botToken,
          chatIdStr,
          settings,
          "✅ <b>تم إلغاء الطلب الحالي وتصفير الاختيارات بنجاح!</b>"
        );
        return;
      }
      
      // Check for /start command
      if (text.trim().toLowerCase() === '/start') {
        session.step = "idle";
        session.selectedPlanId = "";
        await db.saveSession(session);
        
        await sendWelcomeMenu(settings.botToken, chatIdStr, settings);
        return;
      }

      // === أولوية قصوى: التحقق مما إذا كانت الرسالة عبارة عن باقة أو طلب دعم ===
      const menusList = await db.getMenus();
      const matchedMenu = text.trim() ? menusList.find((m) => {
        const cleanText = text.trim().toLowerCase().replace(/[^\w\d\u0600-\u06FF]/g, '');
        const cleanTitle = m.title.trim().toLowerCase().replace(/[^\w\d\u0600-\u06FF]/g, '');
        
        // Exact matches (e.g. clicking the keyboard menu buttons) are always processed as a preference
        const isExact = text.trim() === m.title.trim() || text.trim() === "🫁 " + m.title.trim();
        if (isExact) return true;

        // If user is actively typing details (email, support, or receipt proof), bypass fuzzy/loose matching
        if (session.step === "awaiting_info" || session.step === "awaiting_receipt" || session.step === "support") {
          return false;
        }

        return (
          text.trim().includes(m.title.trim()) ||
          (m.title.trim().length > 2 && text.trim().length > 2 && m.title.trim().includes(text.trim())) ||
          (cleanText.length > 2 && cleanTitle.length > 2 && (cleanText.includes(cleanTitle) || cleanTitle.includes(cleanText)))
        );
      }) : undefined;

      if (matchedMenu) {
        session.step = "awaiting_info";
        session.selectedPlanId = matchedMenu.id;
        await db.saveSession(session);

        // إرسال تفاصيل الباقة
        const detailsText = matchedMenu.details && matchedMenu.details.trim()
          ? matchedMenu.details
          : `📦 <b>باقة: ${matchedMenu.title}</b>\n\n💰 السعر: <b>${matchedMenu.price}</b>\n\n${matchedMenu.description || ""}`;

        await callTelegramAPI(settings.botToken, "sendMessage", {
          chat_id: chatIdStr,
          text: detailsText,
          parse_mode: "HTML",
          reply_markup: { remove_keyboard: true }
        });

        // طلب الإيميل
        await sendTelegramMessage(settings.botToken, chatIdStr, "📧 <b>يرجى إدخال بريدك الإلكتروني المرتبط بالمنصة:</b>\n\n<i>(أو اكتب <b>/cancel</b> لإلغاء وتغيير الباقة في أي وقت)</i>");
        return;
      }

      // زر الدعم الفني
      if (text.trim() === "💬 تواصل مع الدعم الفني") {
        session.step = "support";
        await db.saveSession(session);
        await sendTelegramMessage(
          settings.botToken,
          chatIdStr,
          "💬 <b>عميلنا العزيز، تواصل مع الدعم الفني</b>\n\nيرجى كتابة رسالتك أو استفسارك هنا مباشرة وسيقوم فريق الدعم الفني بالرد عليك في أقرب وقت ممكن! ⏱️"
        );
        return;
      }

      // === معالجة حالة إدخال البريد الإلكتروني (State Machine) ===
      if (session.step === "awaiting_info") {
        // تحقق من صحة البريد الإلكتروني
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(text.trim())) {
          await sendTelegramMessage(
            settings.botToken, 
            chatIdStr, 
            "⚠️ <b>البريد الإلكتروني الذي أدخلته غير صحيح.</b>\n\nيرجى إرسال إيميل صحيح ومطابق مثل:\n<code>example@gmail.com</code>\n\n<i>(أو اكتب <b>/cancel</b> لإلغاء وتعديل الاختيار).</i>"
          );
          return;
        }

        session.email = text.trim();
        session.step = "awaiting_receipt";
        await db.saveSession(session);
        
        const promptReceipt = `عظيم! لقد قمنا بتسجيل بريدك الإلكتروني بنجاح: <b>${text.trim()}</b>\n\nيرجى الآن إرفاق وإرسال صورة واضحة لإثبات التحويل (لقطة الشاشة للتحويل بالكامل أو الإيصال) ليتم إرسال طلبك فوراً لمراجعة الإدارة وتفعيل اشتراكك بالمنصة. 📸🧾\n\n<i>(لإلغاء الطلب بأي وقت، اكتب: <b>/cancel</b>)</i>`;
        await sendTelegramMessage(settings.botToken, chatIdStr, promptReceipt);
        return;
      }
      
      // === معالجة حالة إرسال إثبات التحويل (State Machine) ===
      if (session.step === "awaiting_receipt") {
        // Log photo parser or details if attached
        let promptPhotoUrl = "";
        if (photos.length > 0) {
          try {
            const fileId = photos[photos.length - 1].file_id;
            const fileInfo = await callTelegramAPI(settings.botToken, "getFile", { file_id: fileId });
            if (fileInfo?.result?.file_path) {
              promptPhotoUrl = `https://api.telegram.org/file/bot${settings.botToken}/${fileInfo.result.file_path}`;
            }
          } catch (e) {
            console.error("Failed to parse receipt photo:", e);
          }
        } else if (document) {
          try {
            const fileId = document.file_id;
            const fileInfo = await callTelegramAPI(settings.botToken, "getFile", { file_id: fileId });
            if (fileInfo?.result?.file_path) {
              promptPhotoUrl = `https://api.telegram.org/file/bot${settings.botToken}/${fileInfo.result.file_path}`;
            }
          } catch (e) {
            console.error("Failed to parse document for receipt:", e);
          }
        }

        if (photos.length > 0 || promptPhotoUrl) {
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
              receiptPhotoUrl: promptPhotoUrl,
              transactionImage: promptPhotoUrl,
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
              const adminNotifyText = `🔔 <b>طلب اشتراك جديد بانتظار المراجعة!</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `👤 <b>العميل:</b> ${fullname} (@${username || "لا يوجد"})\n` +
                `✉️ <b>الإيميل:</b> ${ticket.email}\n` +
                `📦 <b>الباقة المطلوبة:</b> ${menu.title}\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>معرف العميل:</b> <code>${chatIdStr}</code>\n` +
                `📋 <b>رقم الطلب:</b> <code>${ticketId}</code>\n` +
                `📅 <b>التاريخ:</b> ${new Date().toLocaleString("ar-EG")}\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `👈 اضغط ✅ لقبول الطلب أو ❌ لرفضه أو 💬 للرد المخصص.`;
              
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
                  if (promptPhotoUrl) {
                    await callTelegramAPI(settings.botToken, "sendPhoto", {
                      chat_id: adminId,
                      photo: promptPhotoUrl,
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

      // === إذا وصلنا هنا: الرسالة هي رسالة تواصل/دعم حقيقي (ليست ضمن سيناريو الاشتراك) ===
      // Log all other conversations to Support Messages so admin can check and chat manually
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

      // Forward general support messages to admins (with indicator if test message from admin itself)
      const isSelfAdmin = adminIds.includes(chatIdStr) || adminIds.includes(from.id?.toString());
      if (adminIds.length > 0) {
        const testIndicator = isSelfAdmin ? "🧪 <b>[رسالة تجريبية من حساب مشرف]</b>\n\n" : "";
        const adminNotifyText = `${testIndicator}💬 <b>رسالة دعم جديدة!</b>\n\n👤 العميل: <b>${fullname}</b> (@${username || "لا يوجد"})\n✉️ الرسالة: ${text || "[ملف/صورة]"}\n\n👤 معرف العميل: <code>${chatIdStr}</code>\n\n👈 للرد على هذه الرسالة، قم بعمل "Reply" عليها مباشرة واكتب ردك.`;
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
      
      // If the user's current step is "support", send a clean support-specific confirmation and return the user to "idle"
      if (session.step === "support") {
        session.step = "idle";
        await db.saveSession(session);
        await sendTelegramMessage(
          settings.botToken,
          chatIdStr,
          "✅ <b>تم تسليم رسالتك واستفسارك بنجاح لفريق الدعم الفني!</b>\n\nسيقوم أحد ممثلي الإدارة بمراجعة طلبك والرد عليك هنا مباشرة في أسرع وقت. 🏥✨"
        );
      } else {
        const replyFallback = "أهلاً بك! 👋 لقد استلمنا رسالتك وتم توجيهها للدعم الفني للمراجعة والرد عليك قريباً.\n\nلمشاهدة الباقات المتاحة وتفعيل اشتراكك، يرجى إرسال الأمر: /start أو اختيارها من القائمة بالأسفل. 🏥";
        await sendTelegramMessage(settings.botToken, chatIdStr, replyFallback);
      }
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

// Database Export/Sync endpoints
app.get('/api/sync-db', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const providedToken = authHeader?.split(' ')[1];
    
    const settings = await db.getSettings();
    const validToken = settings.botToken || settings.dashboardPassword || "admin";
    
    if (!providedToken || (providedToken !== settings.botToken && providedToken !== settings.dashboardPassword)) {
      return res.status(401).json({ error: "غير مصرح لك بالوصول لقاعدة البيانات السحابية." });
    }
    
    const data = await db.exportAllData();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sync-db', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const providedToken = authHeader?.split(' ')[1];
    
    const settings = await db.getSettings();
    
    if (!providedToken || (providedToken !== settings.botToken && providedToken !== settings.dashboardPassword)) {
      return res.status(401).json({ error: "غير مصرح لك بمزامنة قاعدة البيانات السحابية." });
    }
    
    await db.importAllData(req.body);
    res.json({ success: true, message: "تمت مزامنة واستيراد البيانات بنجاح!" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Proxy endpoints to handle server-to-server sync (bypasses CORS entirely)
app.post('/api/proxy-sync-pull', express.json(), async (req, res) => {
  try {
    const { railwayUrl, syncToken } = req.body;
    if (!railwayUrl || !syncToken) {
      return res.status(400).json({ error: "البيانات المطلوبة ناقصة (الرابط أو التوكن)." });
    }

    let cleanUrl = railwayUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (!cleanUrl.startsWith("http")) {
      cleanUrl = "https://" + cleanUrl;
    }

    // Server-to-server fetch using Node native fetch
    const remoteRes = await fetch(`${cleanUrl}/api/sync-db`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${syncToken}`
      }
    });

    if (!remoteRes.ok) {
      const errData = await remoteRes.json().catch(() => ({}));
      return res.status(remoteRes.status).json({ 
        error: errData.error || `فشل السيرفر السحابي في توفير البيانات (كود الاستجابة: ${remoteRes.status}).` 
      });
    }

    const dbData = await remoteRes.json();

    // Import into local database
    await db.importAllData(dbData);

    res.json({ success: true, message: "تمت مزامنة واستيراد البيانات السحابية بنجاح!", data: dbData });
  } catch (err: any) {
    res.status(500).json({ error: `خطأ اتصال بالسيرفر السحابي: ${err.message}` });
  }
});

app.post('/api/proxy-sync-push', express.json(), async (req, res) => {
  try {
    const { railwayUrl, syncToken } = req.body;
    if (!railwayUrl || !syncToken) {
      return res.status(400).json({ error: "البيانات المطلوبة ناقصة (الرابط أو التوكن)." });
    }

    let cleanUrl = railwayUrl.trim();
    if (cleanUrl.endsWith("/")) {
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (!cleanUrl.startsWith("http")) {
      cleanUrl = "https://" + cleanUrl;
    }

    // Export local data
    const localData = await db.exportAllData();

    // Server-to-server push using Node native fetch
    const remoteRes = await fetch(`${cleanUrl}/api/sync-db`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${syncToken}`
      },
      body: JSON.stringify(localData)
    });

    if (!remoteRes.ok) {
      const errData = await remoteRes.json().catch(() => ({}));
      return res.status(remoteRes.status).json({ 
        error: errData.error || `فشل سيرفر Railway في استقبال وحفظ البيانات (كود الاستجابة: ${remoteRes.status}).` 
      });
    }

    res.json({ success: true, message: "تم تحديث ورفع قاعدة بيانات سيرفر Railway بنجاح!" });
  } catch (err: any) {
    res.status(500).json({ error: `خطأ اتصال بالسيرفر السحابي: ${err.message}` });
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
      isFirestoreWorking: db.isFirestoreWorking(),
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
app.post(['/api/webhook/telegram', '/api/webhook', '/api/webhook/'], async (req, res) => {
  try {
    const update = req.body;
    // Send 200 OK immediately to Telegram/Railway to prevent retry timeouts
    res.status(200).send('OK');
    
    if (update && update.update_id) {
      if (updatesInProgress.has(update.update_id)) {
        return;
      }
      updatesInProgress.add(update.update_id);
      
      try {
        const claimed = await db.claimUpdate(update.update_id, instanceId);
        if (claimed) {
          await handleTelegramUpdate(update);
        }
      } finally {
        setTimeout(() => {
          updatesInProgress.delete(update.update_id);
        }, 12000); // 12-second retention to absorb duplication bursts
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
      
      // Standby / sleep if token missing, devPollingEnabled is set to false, or webhook is active
      if (!settings.botToken || settings.devPollingEnabled === false || settings.activeInstanceUrl) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      // Initialize lastUpdateId on boot to avoid processing old updates (anti-overlapping/anti-duplication)
      if (lastUpdateId === 0) {
        try {
          const processed = await (db as any).getProcessedUpdateIds();
          if (processed && processed.length > 0) {
            lastUpdateId = Math.max(...processed);
            console.log(`[Polling] Restored lastUpdateId from database: ${lastUpdateId}`);
          }
        } catch (e: any) {
          console.error("[Polling] Error reading processed updates:", e.message);
        }

        if (lastUpdateId === 0) {
          try {
            const initRes = await callTelegramAPI(settings.botToken, 'getUpdates', {
              offset: -1,
              limit: 1,
              timeout: 0
            });
            if (initRes && initRes.result && initRes.result.length > 0) {
              lastUpdateId = initRes.result[0].update_id;
              console.log(`[Polling] No local updates found. Initialized lastUpdateId to latest Telegram update ID ${lastUpdateId} to prevent replay of old updates.`);
            }
          } catch (e: any) {
            console.error("[Polling] Error fetching latest update_id from Telegram on bootstrap:", e.message);
          }
        }
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
          
          if (updatesInProgress.has(update.update_id)) {
            continue;
          }
          updatesInProgress.add(update.update_id);
          
          // Execute asynchronously so lock isn't held up and updates are decoupled
          (async () => {
             try {
               const claimed = await db.claimUpdate(update.update_id, instanceId);
               if (claimed) {
                 await handleTelegramUpdate(update);
               }
             } finally {
               setTimeout(() => {
                 updatesInProgress.delete(update.update_id);
               }, 15000); // 15s lock retention
             }
          })();
        }
      }
    } catch (err: any) {
      const errMsg = err.message || "";
      
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
        console.error('Long Polling encountered an error:', errMsg);
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
