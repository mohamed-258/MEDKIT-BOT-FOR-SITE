import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { BotSettings, BotMessage, TelegramUser, BroadcastLog, SystemLog, AutoResponse } from './src/types.ts';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_FILE = path.join(process.cwd(), 'data-store.json');

app.use(express.json());

// ─── Gemini AI Client ────────────────────────────────────────────────────────
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
  }
  return aiClient;
}

// ─── Database ────────────────────────────────────────────────────────────────
function loadDatabase() {
  const defaultData = {
    settings: {
      token: '',
      webhookEnabled: false,
      aiEnabled: false,
      aiSystemPrompt: 'أنت MEDKIT42، مساعد منصة ميدكيت التعليمية الطبية. تساعد المستخدمين في الاستفسار عن الاشتراكات والباقات. كن مختصراً وودوداً باللغة العربية.',
      autoResponses: [
        {
          id: 'rule_start',
          trigger: '/start',
          response: '🏥 أهلاً وسهلاً بك في بوت منصة MedKit 42!\n\nاختر ما تريد من القائمة أدناه 👇',
          buttonType: 'reply',
          buttonColumns: 2,
          buttons: [
            { id: 'btn_midrrs',  label: '🩺 Mid RRS',        responseText: '🩺 باقة Mid RRS\n\n📋 المحتوى:\n• محاضرات RRS المسجلة كاملة\n• ملخصات PDF شاملة\n• بنك أسئلة MCQ تفاعلي\n\n💰 السعر: تواصل معنا للاستفسار\n📅 المدة: فصل دراسي كامل\n\n✅ للاشتراك اكتب /subscribe' },
            { id: 'btn_fullpkg', label: '📚 الباقة الكاملة',  responseText: '📚 الباقة الكاملة — Full Package\n\n📋 المحتوى:\n• جميع المحاضرات المسجلة\n• ملخصات لكل المواد\n• بنك أسئلة MCQ شامل\n• متابعة دورية مع الفريق\n\n💰 السعر: تواصل معنا\n📅 المدة: السنة الدراسية كاملة\n\n✅ للاشتراك اكتب /subscribe' },
            { id: 'btn_prices',  label: '💳 الأسعار والدفع',  responseText: '💳 طرق الدفع المتاحة:\n\n• تحويل بنكي\n• فودافون كاش\n• اورنج كاش\n• انستا باي\n\n📞 للاستفسار عن الأسعار تواصل معنا مباشرةً عبر /contact' },
            { id: 'btn_contact', label: '📞 تواصل معنا',      responseText: '📞 تواصل مع فريق MedKit 42\n\n👨‍💻 للدعم والاشتراك:\n@MedKit42_Support\n\n🕐 أوقات الرد:\nالسبت - الخميس من 9 ص حتى 11 م\n\n⚡ سيتم الرد عليك في أقرب وقت!' },
            { id: 'btn_about',   label: 'ℹ️ من نحن',          responseText: '🏥 منصة MedKit 42\n\nمنصة تعليمية طبية متخصصة تقدم:\n✅ محاضرات مسجلة عالية الجودة\n✅ ملخصات علمية دقيقة\n✅ أسئلة MCQ تفاعلية\n✅ متابعة مستمرة من الفريق\n\n🎯 هدفنا: مساعدتك على النجاح والتفوق!' },
            { id: 'btn_sub',     label: '✅ اشترك الآن',       responseText: '✅ رائع! سعيد باهتمامك بالاشتراك 🎉\n\nللإتمام تواصل معنا مباشرةً:\n📱 @MedKit42_Support\n\nسيتواصل معك أحد أعضاء الفريق خلال دقائق 🚀' }
          ]
        },
        { id: 'rule_help',      trigger: '/help',      response: '📋 الأوامر المتاحة:\n\n/start — القائمة الرئيسية\n/subscribe — الاشتراك في الباقات\n/contact — التواصل مع الدعم\n/about — معلومات عن المنصة', buttonType: 'reply', buttonColumns: 1, buttons: [] },
        { id: 'rule_subscribe', trigger: '/subscribe', response: '✅ للاشتراك في إحدى باقات MedKit 42:\n\n1️⃣ اختر الباقة من /start\n2️⃣ تواصل مع الدعم @MedKit42_Support\n3️⃣ أتم عملية الدفع\n4️⃣ احصل على وصولك الفوري! 🚀', buttonType: 'reply', buttonColumns: 1, buttons: [] },
        { id: 'rule_contact',   trigger: '/contact',   response: '📞 تواصل مع فريق MedKit 42\n\n👨‍💻 للدعم والاشتراك:\n@MedKit42_Support\n\n🕐 أوقات الرد: السبت - الخميس 9ص - 11م', buttonType: 'reply', buttonColumns: 1, buttons: [] },
        { id: 'rule_about',     trigger: '/about',     response: '🏥 منصة MedKit 42\n\n✅ محاضرات مسجلة عالية الجودة\n✅ ملخصات علمية دقيقة\n✅ أسئلة MCQ تفاعلية\n✅ متابعة مستمرة\n\nللباقات والأسعار: /start', buttonType: 'reply', buttonColumns: 1, buttons: [] }
      ] as AutoResponse[],
      adminPassword: ''
    } as BotSettings,
    users: [] as TelegramUser[],
    messages: [] as BotMessage[],
    broadcasts: [] as BroadcastLog[],
    logs: [
      { id: 'log_init', timestamp: new Date().toISOString(), type: 'success', message: '✅ تم تهيئة بوت منصة MedKit 42 بنجاح. أضف التوكن من الإعدادات للبدء.' }
    ] as SystemLog[]
  };

  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(content);
    } else {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
  } catch (error) {
    console.error('Failed to load database:', error);
    return defaultData;
  }
}

function saveDatabase(data: any) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

function addLog(db: any, type: 'info' | 'success' | 'warn' | 'error', message: string) {
  const newLog: SystemLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toISOString(),
    type,
    message
  };
  db.logs.unshift(newLog);
  if (db.logs.length > 150) db.logs = db.logs.slice(0, 150);
}

// ─── Telegram API ────────────────────────────────────────────────────────────
async function callTelegramAPI(token: string, method: string, payload: any) {
  if (!token) throw new Error('Token is missing');
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Telegram API Error (${response.status}): ${errText}`);
  }
  return response.json();
}

async function sendTelegramMessage(token: string, chatId: string, text: string, replyMarkup?: any) {
  try {
    const payload: any = { chat_id: chatId, text, parse_mode: 'HTML' };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    return await callTelegramAPI(token, 'sendMessage', payload);
  } catch (error: any) {
    console.error('sendMessage failed:', error.message);
    throw error;
  }
}

async function setupTelegramWebhook(token: string, enable: boolean, appUrl: string) {
  try {
    if (enable) {
      const targetUrl = `${appUrl}/api/webhook/telegram`.replace('//api/webhook', '/api/webhook');
      console.log(`Setting up Webhook to ${targetUrl}`);
      return await callTelegramAPI(token, 'setWebhook', { url: targetUrl });
    } else {
      console.log('Removing Telegram Webhook');
      return await callTelegramAPI(token, 'deleteWebhook', {});
    }
  } catch (error: any) {
    console.error('setWebhook failed:', error.message);
    throw error;
  }
}

// ─── Gemini History Sanitizer ────────────────────────────────────────────────
function sanitizeChatHistory(history: { role: string; parts: { text: string }[] }[]) {
  const sanitized: { role: string; parts: { text: string }[] }[] = [];
  for (const turn of history) {
    if (sanitized.length > 0 && sanitized[sanitized.length - 1].role === turn.role) {
      sanitized[sanitized.length - 1].parts[0].text += '\n' + turn.parts[0].text;
    } else {
      sanitized.push({ role: turn.role, parts: [{ text: turn.parts[0].text }] });
    }
  }
  return sanitized;
}

// ─── Core Message Processor ──────────────────────────────────────────────────
async function processIncomingMessage(db: any, userId: string, username: string, fullName: string, text: string, isSimulated: boolean) {
  // 1. Register / update user
  let user = db.users.find((u: TelegramUser) => u.id === userId);
  if (!user) {
    user = { id: userId, first_name: fullName, username: username || '', last_interaction: new Date().toISOString(), is_simulated: isSimulated };
    db.users.push(user);
    addLog(db, 'info', `مستخدم جديد: ${fullName} (@${username || 'بلا_اسم'})`);
  } else {
    user.last_interaction = new Date().toISOString();
    user.first_name = fullName;
    user.username = username || '';
  }

  // 2. Save incoming message
  const incomingMsg: BotMessage = {
    id: `msg_${Date.now()}_in`, userId, username: username || 'user',
    text, type: 'incoming', sender: 'user', timestamp: new Date().toISOString()
  };
  db.messages.push(incomingMsg);

  // 3. Match auto-response rule
  const cleanText = text.trim();
  const matchedRule = db.settings.autoResponses.find((rule: AutoResponse) =>
    rule.trigger.toLowerCase() === cleanText.toLowerCase()
  );

  if (matchedRule) {
    const outgoingMsg: BotMessage = {
      id: `msg_${Date.now()}_out`, userId, username: username || 'user',
      text: matchedRule.response, type: 'outgoing', sender: 'bot_rule',
      timestamp: new Date().toISOString(), ruleId: matchedRule.id,
      buttons: matchedRule.buttons, buttonType: matchedRule.buttonType || 'inline',
      buttonColumns: matchedRule.buttonColumns || 1
    };
    db.messages.push(outgoingMsg);

    let replyMarkup: any = undefined;
    if (matchedRule.buttons && matchedRule.buttons.length > 0) {
      const bType = matchedRule.buttonType || 'inline';
      const colCount = matchedRule.buttonColumns || 1;
      if (bType === 'reply') {
        const keyboardRows: any[] = [];
        for (let i = 0; i < matchedRule.buttons.length; i += colCount) {
          keyboardRows.push(matchedRule.buttons.slice(i, i + colCount).map((btn: any) => ({ text: btn.label })));
        }
        replyMarkup = { keyboard: keyboardRows, resize_keyboard: true, one_time_keyboard: false };
      } else {
        const inlineRows: any[] = [];
        for (let i = 0; i < matchedRule.buttons.length; i += colCount) {
          inlineRows.push(matchedRule.buttons.slice(i, i + colCount).map((btn: any) => ({
            text: btn.label, callback_data: `btn:${matchedRule.id}:${btn.id}`
          })));
        }
        replyMarkup = { inline_keyboard: inlineRows };
      }
    }

    if (!isSimulated && db.settings.token) {
      try {
        await sendTelegramMessage(db.settings.token, userId, matchedRule.response, replyMarkup);
        addLog(db, 'success', `رد تلقائي أُرسل إلى ${fullName}`);
      } catch (err: any) {
        addLog(db, 'error', `فشل إرسال الرد التلقائي لـ ${fullName}: ${err.message}`);
      }
    } else {
      addLog(db, 'info', `[محاكاة] رد تلقائي: (${cleanText})`);
    }

    saveDatabase(db);
    return outgoingMsg;
  }

  // 4. Gemini AI fallback
  if (db.settings.aiEnabled) {
    addLog(db, 'info', `Gemini AI يعالج رد لـ ${fullName}...`);
    const ai = getGeminiClient();
    let aiResponseText = '';

    if (!ai) {
      aiResponseText = '⚠️ لم يتم ضبط مفتاح Gemini API. يرجى مراجعة الإعدادات.';
      addLog(db, 'warn', 'GEMINI_API_KEY غير مضبوط.');
    } else {
      try {
        const rawHistory = db.messages
          .filter((m: BotMessage) => m.userId === userId)
          .slice(-10)
          .map((m: BotMessage) => ({ role: m.type === 'incoming' ? 'user' : 'model', parts: [{ text: m.text }] }));
        const userHistory = sanitizeChatHistory(rawHistory);
        const systemInstruction = db.settings.aiSystemPrompt || 'أنت مساعد تواصل ذكي لبوت تليجرام.';
        const responseObj = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: userHistory,
          config: { systemInstruction }
        });
        aiResponseText = responseObj.text || 'لم يتمكن Gemini من صياغة إجابة حالياً.';
        addLog(db, 'success', `رد Gemini لـ ${fullName} تم بنجاح.`);
      } catch (err: any) {
        console.error('Gemini call failed:', err);
        aiResponseText = 'وصلنا استفسارك، سنرد عليك يدوياً قريباً. شكراً لتفهمك.';
        addLog(db, 'error', `فشل Gemini API: ${err.message}`);
      }
    }

    const outgoingMsg: BotMessage = {
      id: `msg_${Date.now()}_out`, userId, username: username || 'user',
      text: aiResponseText, type: 'outgoing', sender: 'ai', timestamp: new Date().toISOString()
    };
    db.messages.push(outgoingMsg);

    if (!isSimulated && db.settings.token) {
      try {
        await sendTelegramMessage(db.settings.token, userId, aiResponseText);
      } catch (err: any) {
        addLog(db, 'error', `فشل إرسال رد Gemini لـ ${fullName}: ${err.message}`);
      }
    }

    saveDatabase(db);
    return outgoingMsg;
  }

  // 5. Default fallback
  const defaultReply = 'تم استلام رسالتك! سيتواصل معك مشرف خدمة العملاء في أقرب وقت.';
  const fallbackMsg: BotMessage = {
    id: `msg_${Date.now()}_out`, userId, username: username || 'user',
    text: defaultReply, type: 'outgoing', sender: 'bot_manual', timestamp: new Date().toISOString()
  };
  db.messages.push(fallbackMsg);

  if (!isSimulated && db.settings.token) {
    try {
      await sendTelegramMessage(db.settings.token, userId, defaultReply);
    } catch (err: any) {
      addLog(db, 'error', `فشل الرد الافتراضي لـ ${fullName}: ${err.message}`);
    }
  }

  saveDatabase(db);
  return fallbackMsg;
}

// ─── API Routes ───────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  const db = loadDatabase();
  const host = req.get('host');
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  let appUrl = process.env.APP_URL || '';
  if (!appUrl || appUrl === 'MY_APP_URL' || !appUrl.startsWith('http')) {
    appUrl = host ? `${protocol}://${host}` : '';
  }
  res.json({ settings: db.settings, appUrl });
});

app.post('/api/settings', async (req, res) => {
  const db = loadDatabase();
  const { token, webhookEnabled, aiEnabled, aiSystemPrompt, autoResponses, adminPassword } = req.body;

  if (token !== undefined) db.settings.token = token;
  if (webhookEnabled !== undefined) db.settings.webhookEnabled = webhookEnabled;
  if (aiEnabled !== undefined) db.settings.aiEnabled = aiEnabled;
  if (aiSystemPrompt !== undefined) db.settings.aiSystemPrompt = aiSystemPrompt;
  if (autoResponses !== undefined) db.settings.autoResponses = autoResponses;
  if (adminPassword !== undefined) db.settings.adminPassword = adminPassword;

  addLog(db, 'info', 'تم تحديث إعدادات البوت.');

  if (db.settings.token) {
    try {
      const host = req.get('host');
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      let appUrl = process.env.APP_URL || '';
      if (!appUrl || appUrl === 'MY_APP_URL' || !appUrl.startsWith('http')) {
        appUrl = host ? `${protocol}://${host}` : '';
      }
      if (appUrl) {
        await setupTelegramWebhook(db.settings.token, db.settings.webhookEnabled, appUrl);
        addLog(db, 'success', `Webhook ${db.settings.webhookEnabled ? 'مفعّل' : 'معطّل'} على: ${appUrl}/api/webhook/telegram`);
      } else {
        addLog(db, 'warn', 'تعذر تهيئة Webhook: رابط التطبيق غير محدد.');
      }
    } catch (err: any) {
      addLog(db, 'error', `فشل ربط Webhook: ${err.message}`);
    }
  }

  saveDatabase(db);
  res.json({ success: true, settings: db.settings });
});

app.get('/api/bot-info', async (req, res) => {
  const db = loadDatabase();
  if (!db.settings.token) return res.status(400).json({ status: 'error', message: 'لم يتم إدخال Bot Token بعد.' });
  try {
    const me = await callTelegramAPI(db.settings.token, 'getMe', {});
    const webhookInfoRes = await callTelegramAPI(db.settings.token, 'getWebhookInfo', {});
    res.json({
      status: 'success',
      bot: { id: me.result.id, first_name: me.result.first_name, username: me.result.username },
      webhook: webhookInfoRes.result
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get('/api/users', (req, res) => {
  const db = loadDatabase();
  res.json(db.users);
});

app.get('/api/messages', (req, res) => {
  const db = loadDatabase();
  const userId = req.query.userId as string;
  res.json(userId ? db.messages.filter((m: BotMessage) => m.userId === userId) : db.messages);
});

app.post('/api/messages/reply', async (req, res) => {
  const db = loadDatabase();
  const { userId, text } = req.body;
  if (!userId || !text) return res.status(400).json({ error: 'مطلوب userId ونص الرسالة.' });
  const user = db.users.find((u: TelegramUser) => u.id === userId);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود.' });

  const outgoingMsg: BotMessage = {
    id: `msg_${Date.now()}_reply`, userId, username: user.username || 'user',
    text, type: 'outgoing', sender: 'bot_manual', timestamp: new Date().toISOString()
  };
  db.messages.push(outgoingMsg);
  addLog(db, 'info', `رد يدوي إلى ${user.first_name}: ${text.substring(0, 30)}...`);

  if (!user.is_simulated && db.settings.token) {
    try {
      await sendTelegramMessage(db.settings.token, userId, text);
      addLog(db, 'success', `تم إرسال الرد اليدوي إلى ${user.first_name}.`);
    } catch (err: any) {
      addLog(db, 'error', `فشل إرسال الرد اليدوي لـ ${user.first_name}: ${err.message}`);
    }
  } else {
    addLog(db, 'info', `[محاكاة] تم حفظ الرد اليدوي.`);
  }

  saveDatabase(db);
  res.json({ success: true, message: outgoingMsg });
});

app.post('/api/messages/simulate', async (req, res) => {
  const db = loadDatabase();
  const { userId, first_name, username, text } = req.body;
  if (!userId || !text) return res.status(400).json({ error: 'عناصر المحاكاة غير مكتملة.' });
  const botReply = await processIncomingMessage(db, userId, username || 'ahmed_sim', first_name || 'أحمد', text, true);
  res.json({ success: true, incoming: db.messages[db.messages.length - 2], reply: botReply });
});

app.post('/api/messages/broadcast', async (req, res) => {
  const db = loadDatabase();
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'نص البث فارغ!' });
  if (db.users.length === 0) return res.status(400).json({ error: 'لا يوجد مستخدمون مسجلون.' });

  addLog(db, 'info', `بدء بث جماعي: "${text.substring(0, 40)}..."`);
  let sentReal = 0, sentSim = 0, failedReal = 0;

  for (const user of db.users) {
    db.messages.push({
      id: `msg_${Date.now()}_bct_${user.id}`, userId: user.id,
      username: user.username || 'user', text, type: 'outgoing',
      sender: 'bot_manual', timestamp: new Date().toISOString()
    } as BotMessage);
    if (!user.is_simulated && db.settings.token) {
      try { await sendTelegramMessage(db.settings.token, user.id, text); sentReal++; }
      catch { failedReal++; }
    } else { sentSim++; }
  }

  const resultMsg = `اكتمل البث لـ ${sentReal + sentSim} مستخدم. (حقيقي: ${sentReal}، محاكاة: ${sentSim}، فشل: ${failedReal})`;
  db.broadcasts.push({ id: `bct_${Date.now()}`, text, timestamp: new Date().toISOString(), recipientCount: sentReal + sentSim } as BroadcastLog);
  addLog(db, 'success', resultMsg);
  saveDatabase(db);
  res.json({ success: true, summary: resultMsg });
});

app.get('/api/logs', (req, res) => {
  const db = loadDatabase();
  res.json(db.logs);
});

app.delete('/api/users/:id', (req, res) => {
  const db = loadDatabase();
  const userId = req.params.id;
  db.users = db.users.filter((u: TelegramUser) => u.id !== userId);
  db.messages = db.messages.filter((m: BotMessage) => m.userId !== userId);
  addLog(db, 'warn', `تم حذف المستخدم: ${userId}`);
  saveDatabase(db);
  res.json({ success: true });
});

app.post('/api/messages/simulate-click', async (req, res) => {
  const db = loadDatabase();
  const { userId, ruleId, buttonId, first_name, username } = req.body;
  if (!userId || !ruleId || !buttonId) return res.status(400).json({ error: 'عناصر النقر غير مكتملة.' });

  const rule = db.settings.autoResponses.find((r: any) => r.id === ruleId);
  if (!rule?.buttons) return res.status(404).json({ error: 'القاعدة غير موجودة.' });

  const button = rule.buttons.find((b: any) => b.id === buttonId);
  if (!button) return res.status(404).json({ error: 'الزر غير موجود.' });

  const targetName = first_name || 'أحمد';
  const targetUser = username || 'ahmed_sim';

  let user = db.users.find((u: TelegramUser) => u.id === userId);
  if (!user) {
    user = { id: userId, first_name: targetName, username: targetUser, last_interaction: new Date().toISOString(), is_simulated: true };
    db.users.push(user);
  } else { user.last_interaction = new Date().toISOString(); }

  const incomingMsg: BotMessage = {
    id: `msg_${Date.now()}_in`, userId, username: targetUser,
    text: `🔘 [اختيار]: ${button.label}`, type: 'incoming', sender: 'user', timestamp: new Date().toISOString()
  };
  const outgoingMsg: BotMessage = {
    id: `msg_${Date.now()}_out`, userId, username: targetUser,
    text: button.responseText, type: 'outgoing', sender: 'bot_rule', timestamp: new Date().toISOString()
  };
  db.messages.push(incomingMsg, outgoingMsg);
  addLog(db, 'info', `[محاكاة] نقر زر: "${button.label}"`);
  addLog(db, 'success', `[محاكاة] رد: "${button.responseText.substring(0, 30)}..."`);
  saveDatabase(db);
  res.json({ success: true, incoming: incomingMsg, reply: outgoingMsg });
});

// ─── Webhook & Callback Handler ──────────────────────────────────────────────
async function handleCallbackQuery(db: any, cb: any) {
  const from = cb.from || {};
  const data = cb.data || '';
  const userIdStr = from.id?.toString();
  if (!userIdStr || (!data.startsWith('btn:') && !data.startsWith('btn_'))) return;

  let ruleId = '', btnId = '';
  if (data.startsWith('btn:')) {
    const parts = data.split(':');
    ruleId = parts[1]; btnId = parts[2];
  } else {
    const parts = data.split('_');
    ruleId = parts[1]; btnId = parts[2];
  }

  const rule = db.settings.autoResponses.find((r: any) => r.id === ruleId);
  if (!rule?.buttons) return;
  const button = rule.buttons.find((b: any) => b.id === btnId);
  if (!button) return;

  const fullName = [from.first_name, from.last_name || ''].filter(Boolean).join(' ') || 'مستخدم';
  const username = from.username || '';

  let user = db.users.find((u: TelegramUser) => u.id === userIdStr);
  if (!user) {
    user = { id: userIdStr, first_name: fullName, username, last_interaction: new Date().toISOString(), is_simulated: false };
    db.users.push(user);
    addLog(db, 'info', `مستخدم جديد عبر زر: ${fullName}`);
  } else { user.last_interaction = new Date().toISOString(); }

  db.messages.push(
    { id: `msg_${Date.now()}_in`, userId: userIdStr, username: username || 'user', text: `🔘 [اختيار]: ${button.label}`, type: 'incoming', sender: 'user', timestamp: new Date().toISOString() } as BotMessage,
    { id: `msg_${Date.now()}_out`, userId: userIdStr, username: username || 'user', text: button.responseText, type: 'outgoing', sender: 'bot_rule', timestamp: new Date().toISOString() } as BotMessage
  );
  addLog(db, 'success', `زر "${button.label}" → رد أُرسل لـ ${fullName}`);
  saveDatabase(db);

  if (db.settings.token) {
    try {
      await callTelegramAPI(db.settings.token, 'answerCallbackQuery', { callback_query_id: cb.id });
      await sendTelegramMessage(db.settings.token, userIdStr, button.responseText);
    } catch (err: any) {
      console.error('Callback handler error:', err.message);
    }
  }
}

app.post('/api/webhook/telegram', async (req, res) => {
  const db = loadDatabase();
  const update = req.body;
  res.status(200).send('OK');
  if (!update) return;

  if (update.callback_query) {
    await handleCallbackQuery(db, update.callback_query);
    return;
  }

  if (!update.message) return;
  const msg = update.message;
  const from = msg.from;
  const chatId = msg.chat?.id;
  const text = msg.text;
  if (!chatId || !text) return;

  const userIdStr = chatId.toString();
  const username = from.username || '';
  const fullName = [from.first_name, from.last_name || ''].filter(Boolean).join(' ') || 'مستخدم';
  addLog(db, 'info', `← Webhook: ${fullName} (@${username}): "${text.substring(0, 30)}"`);
  await processIncomingMessage(db, userIdStr, username, fullName, text, false);
});

// ─── Long Polling ─────────────────────────────────────────────────────────────
let pollingActive = false;
let lastUpdateId = 0;

async function runPolling() {
  if (pollingActive) return;
  pollingActive = true;
  console.log('Starting Long Polling service...');

  while (true) {
    let token = '', webhookEnabled = false;
    try {
      const db = loadDatabase();
      token = db.settings.token;
      webhookEnabled = db.settings.webhookEnabled;
    } catch (e) {}

    if (!token || webhookEnabled) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      continue;
    }

    try {
      const response = await callTelegramAPI(token, 'getUpdates', {
        offset: lastUpdateId + 1, limit: 50, timeout: 15
      });
      const updates = response.result || [];
      for (const update of updates) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);
        const freshDb = loadDatabase();
        if (update.callback_query) {
          await handleCallbackQuery(freshDb, update.callback_query);
        } else if (update.message?.text && update.message.chat?.id) {
          const msg = update.message;
          const from = msg.from || {};
          const chatId = msg.chat.id.toString();
          const fullName = [from.first_name, from.last_name || ''].filter(Boolean).join(' ') || 'مستخدم';
          addLog(freshDb, 'info', `← Polling: ${fullName}: "${msg.text.substring(0, 30)}"`);
          await processIncomingMessage(freshDb, chatId, from.username || '', fullName, msg.text, false);
        }
      }
    } catch (err: any) {
      console.error('Polling error:', err.message);
      if (err.message?.includes('409') || err.message?.toLowerCase().includes('conflict')) {
        try {
          await callTelegramAPI(token, 'deleteWebhook', { drop_pending_updates: true });
          const freshDb = loadDatabase();
          addLog(freshDb, 'success', '🔧 تم حل تعارض Webhook تلقائياً.');
          saveDatabase(freshDb);
        } catch (delError: any) {
          console.error('Failed to delete conflicting webhook:', delError.message);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 6000));
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// ─── Server Start ─────────────────────────────────────────────────────────────
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
    console.log(`MedKit42 Bot Dashboard running on http://0.0.0.0:${PORT}`);
    runPolling().catch(err => console.error('Polling service error:', err));
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
