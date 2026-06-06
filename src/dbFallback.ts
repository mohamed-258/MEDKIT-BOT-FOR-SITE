import fs from "fs";
import path from "path";
import admin from "firebase-admin";

const LOCAL_DB_PATH = path.join(process.cwd(), "local-db.json");

interface Setting {
  botToken: string;
  adminChatId: string;
  welcomeMessage: string;
  seededMenus?: boolean;
  allowedEmails?: string[];
  devPollingEnabled?: boolean;
  activeInstanceUrl?: string; // The URL of the instance allowed to respond to Telegram
  masterInstanceId?: string; // The ID of the instance allowed to process Telegram updates
}

interface Menu {
  id: string;
  title: string;
  price: string;
  description: string;
  details: string;
}

interface SupportMessage {
  id: string;
  telegramUserId: string;
  telegramUsername: string;
  telegramName: string;
  messageText: string;
  createdAt: string;
  replied: boolean;
  replyText?: string;
  repliedAt?: string;
}

interface Ticket {
  id: string;
  userId: string;
  username: string;
  fullName: string;
  menuId: string;
  menuTitle: string;
  email: string;
  transactionImage: string;
  status: string;
  adminComment: string;
  createdAt: string;
  updatedAt: string;
  telegramUserId?: string;
  telegramUsername?: string;
  telegramName?: string;
  receiptPhotoUrl?: string;
  // Deprecated fields kept for compatibility with old records if any
  planId?: string;
  planTitle?: string;
}

interface Session {
  userId: string;
  step: string;
  selectedPlanId?: string;
  email?: string;
  transactionImage?: string;
}

interface LocalDB {
  settings: Record<string, Setting>;
  menus: Record<string, Menu>;
  tickets: Record<string, Ticket>;
  sessions: Record<string, Session>;
  supportMessages?: Record<string, SupportMessage>;
}

const DEFAULT_DB: LocalDB = {
  settings: {
    global: {
      botToken: "8974609042:AAHWOSlmsLQeerqi-neMeFm9iyu0m9uwOdg",
      adminChatId: "895138224",
      welcomeMessage: "أهلاً بك في بوت تفعيل اشتراكات منصة ميدكيت (MedKit) المعتمد! 🏥✨\n\nيرجى تحديد خطة الاشتراك المراد تفعيلها من القائمة بالأسفل لعرض تفاصيلها وطريقة التحويل وسنقوم بتفعيل حسابك فوراً:",
      allowedEmails: ["mhsn68503@gmail.com"]
    }
  },
  menus: {
    mid_rrs: {
      id: "mid_rrs",
      title: "mid RRS",
      price: "300 جنيه مصري",
      description: "باقة كود التشخيص والمراجعة السريعة RRS (سنتين)",
      details: "📍 باقة تفعيل كود منصة ميدكيت RRS:\n\nتشمل باقة التفعيل الميزات التالية:\n🟢 صلاحية كاملة لمدة سنتين كاملتين (24 شهراً).\n🟢 الوصول السريع إلى تشخيص الحالات والدعم اللا محدود.\n🟢 كود مراجعة مخصص.\n\n💰 قيمة الاشتراك: 300 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
    },
    mid_ecg: {
      id: "mid_ecg",
      title: "mid ECG",
      price: "200 جنيه مصري",
      description: "باقة كورس رسم القلب واشتراك 12 شهر",
      details: "📍 باقة التفعيل لكورس رسم القلب الشامل mid ECG:\n\nتشمل الباقة الميزات التالية:\n🟢 كورس رسم القلب الشامل لجميع المستويات.\n🟢 صلاحية وصول للمواد لمدة 12 شهر.\n🟢 شهادة إتمام رقمية مجانية للطلاب والممارسين.\n\n💰 قيمة الاشتراك: 200 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
    },
    mid_premium: {
      id: "mid_premium",
      title: "mid Premium الشامل",
      price: "500 جنيه مصري",
      description: "الاشتراك المميز لكافة كورسات وخدمات منصة ميدكيت",
      details: "📍 باقة تفعيل كود ميدكيت الشاملة mid Premium:\n\nتشمل هذه الباقة الحصرية الميزات التالية:\n🟢 الوصول لكافة الكورسات المتاحة بالمنصة والمستقبلية.\n🟢 تفعيل كود RRS وكورس ECG مدى الحياة.\n🟢 دعم طبي واستشارات فنية VIP.\n\n💰 قيمة الاشتراك: 500 جنيه مصري فقط.\n\n👈 لإتمام التفعيل، يرجى كتابة بريدك الإلكتروني المسجل في المنصة بالأسفل."
    }
  },
  tickets: {},
  sessions: {},
  supportMessages: {}
};

// In-memory cache for performance
let cachedLocalDB: LocalDB | null = null;
let cachedSettings: Setting | null = null;
let settingsCacheExpiry = 0;

// Read JSON DB
function readLocalDB(): LocalDB {
  if (cachedLocalDB) return cachedLocalDB;
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      cachedLocalDB = { ...DEFAULT_DB, ...JSON.parse(data) };
      return cachedLocalDB!;
    }
  } catch (error) {
    console.error("Failed to read local DB, fallback to default:", error);
  }
  cachedLocalDB = { ...DEFAULT_DB };
  return cachedLocalDB;
}

// Write JSON DB
function writeLocalDB(db: LocalDB) {
  cachedLocalDB = db; // Sync cache
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write local DB:", error);
  }
}

// Check if Firestore is Operational (not disabled or permissions denied)
let firestoreWorking = true;

export async function checkDatabaseStatus(firestoreInstance: admin.firestore.Firestore): Promise<boolean> {
  try {
    // Try to get setting/global with a longer timeout
    const testPromise = firestoreInstance.collection("settings").doc("global").get();
    const timeoutPromise = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Firestore check timed out")), 15000));
    const snap = await Promise.race([testPromise, timeoutPromise]);
    firestoreWorking = true; // operational if we got a response back
    console.log(`Database Link: FIRESTORE ACTIVE (operational=${firestoreWorking})`);
  } catch (err: any) {
    console.error("Database Link: FIRESTORE CHECK ERROR:", err.message);
    if (err.message === "Firestore check timed out") {
      console.log("Will assume Firestore is working but slow.");
      firestoreWorking = true;
    } else if (err.code && (err.code === 7 || err.code === 16 || String(err.code).includes("PERMISSION_DENIED") || String(err.code).includes("UNAUTHENTICATED"))) {
      console.log("Database Link: FIRESTORE RESTRICTED (using local JSON storage layer).");
      firestoreWorking = false;
    } else {
      console.log("Assuming Firestore is working after catching unknown error:", err.message);
      firestoreWorking = true;
    }
  }
  return firestoreWorking;
}

// Cache for claimed updates to avoid repeated LocalDB parsing
const claimedUpdatesCache = new Set<string>();

// Cache for user sessions to speed up rapid interactions
const sessionCache = new Map<string, { data: Session, expiry: number }>();

// Expose Methods with Auto Fallback
export class DatabaseController {
  private fsDb: admin.firestore.Firestore;

  constructor(fsDb: admin.firestore.Firestore) {
    this.fsDb = fsDb;
  }

  // settings/global
  async getSettings(): Promise<Setting> {
    const now = Date.now();
    if (cachedSettings && now < settingsCacheExpiry) {
      return cachedSettings;
    }

    if (!firestoreWorking) {
      const settings = readLocalDB().settings.global || DEFAULT_DB.settings.global;
      cachedSettings = settings;
      settingsCacheExpiry = now + 60000; // Cache local for 60s
      return settings;
    }

    try {
      const snap = await this.fsDb.collection("settings").doc("global").get();
      if (snap.exists) {
        const settings = snap.data() as Setting;
        cachedSettings = settings;
        settingsCacheExpiry = now + 30000; // Cache Firestore for 30s
        return settings;
      }
    } catch (err: any) {
      console.error("Firestore getSettings failed. Error:", err.message);
      const settings = readLocalDB().settings.global || DEFAULT_DB.settings.global;
      cachedSettings = settings;
      settingsCacheExpiry = now + 10000; // Error fallback cache
      return settings;
    }
    return DEFAULT_DB.settings.global;
  }

  async saveSettings(settings: Setting): Promise<void> {
    // Invalidate/Update cache
    cachedSettings = settings;
    settingsCacheExpiry = Date.now() + 60000;

    // Save to local for fallback
    const db = readLocalDB();
    db.settings.global = settings;
    writeLocalDB(db);

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("settings").doc("global").set(settings, { merge: true });
    } catch (err: any) {
      console.error("Firestore saveSettings failed:", err.message);
      throw err;
    }
  }

  // menus
  async getMenus(): Promise<Menu[]> {
    if (!firestoreWorking) {
      console.log("Database Fallback: Loading menus from LOCAL DB");
      return Object.values(readLocalDB().menus);
    }

    try {
      console.log("Firestore: Fetching menus list...");
      const snap = await this.fsDb.collection("menus").get();
      const list: Menu[] = [];
      if (!snap.empty) {
        snap.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Menu);
        });
      }
      console.log(`Firestore: Found ${list.length} menus.`);
      return list;
    } catch (err: any) {
      console.error("Firestore getMenus failed. Error:", err.message);
      return Object.values(readLocalDB().menus);
    }
  }

  async saveMenu(menu: Menu): Promise<void> {
    const db = readLocalDB();
    db.menus[menu.id] = menu;
    writeLocalDB(db);

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("menus").doc(menu.id).set(menu);
    } catch (err: any) {
      console.error("Firestore saveMenu failed:", err.message);
      throw err;
    }
  }

  async deleteMenu(id: string): Promise<void> {
    const db = readLocalDB();
    delete db.menus[id];
    writeLocalDB(db);

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("menus").doc(id).delete();
    } catch (err: any) {
      console.error("Firestore deleteMenu failed:", err.message);
      throw err;
    }
  }

  // tickets
  async getTickets(): Promise<Ticket[]> {
    if (!firestoreWorking) {
      console.log("Database Fallback: Loading tickets from LOCAL DB");
      return Object.values(readLocalDB().tickets).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    try {
      const snap = await this.fsDb.collection("tickets").orderBy("createdAt", "desc").get();
      const list: Ticket[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Ticket);
      });
      return list;
    } catch (err: any) {
      console.error("Firestore getTickets failed:", err.message);
      return Object.values(readLocalDB().tickets).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  async saveTicket(ticket: Ticket): Promise<void> {
    const db = readLocalDB();
    db.tickets[ticket.id] = ticket;
    writeLocalDB(db);

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("tickets").doc(ticket.id).set(ticket);
    } catch (err: any) {
      console.error("Firestore saveTicket failed:", err.message);
      throw err;
    }
  }

  async getTicket(id: string): Promise<Ticket | null> {
    if (!firestoreWorking) {
      return readLocalDB().tickets[id] || null;
    }

    try {
      const snap = await this.fsDb.collection("tickets").doc(id).get();
      if (snap.exists) {
        return { id: snap.id, ...snap.data() } as Ticket;
      }
    } catch (err: any) {
      console.error("Firestore getTicket failed:", err.message);
      return readLocalDB().tickets[id] || null;
    }
    return null;
  }

  async deleteTicket(id: string): Promise<void> {
    const db = readLocalDB();
    delete db.tickets[id];
    writeLocalDB(db);

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("tickets").doc(id).delete();
    } catch (err: any) {
      console.error("Firestore deleteTicket failed:", err.message);
      throw err;
    }
  }

  // sessions (Telegram bot session tracking)
  async getSession(userId: string): Promise<Session> {
    const now = Date.now();
    const cached = sessionCache.get(userId);
    if (cached && now < cached.expiry) {
      return cached.data;
    }

    if (!firestoreWorking) {
      const session = readLocalDB().sessions[userId] || { userId, step: "idle" };
      sessionCache.set(userId, { data: session, expiry: now + 30000 });
      return session;
    }

    try {
      const snap = await this.fsDb.collection("sessions").doc(userId).get();
      if (snap.exists) {
        const session = { userId, ...snap.data() } as Session;
        sessionCache.set(userId, { data: session, expiry: now + 15000 }); // 15s cache
        return session;
      }
    } catch (err: any) {
      console.error("Firestore getSession failed:", err.message);
      const session = readLocalDB().sessions[userId] || { userId, step: "idle" };
      sessionCache.set(userId, { data: session, expiry: now + 5000 });
      return session;
    }
    return { userId, step: "idle" };
  }

  async saveSession(session: Session): Promise<void> {
    // Sync cache
    sessionCache.set(session.userId, { data: session, expiry: Date.now() + 15000 });

    const db = readLocalDB();
    db.sessions[session.userId] = session;
    writeLocalDB(db);

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("sessions").doc(session.userId).set(session);
    } catch (err: any) {
      console.error("Firestore saveSession failed:", err.message);
      throw err;
    }
  }

  // support messages
  async getSupportMessages(): Promise<SupportMessage[]> {
    if (!firestoreWorking) {
      return Object.values(readLocalDB().supportMessages || {}).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    try {
      const snap = await this.fsDb.collection("support_messages").orderBy("createdAt", "desc").get();
      const list: SupportMessage[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as SupportMessage);
      });
      return list;
    } catch (err: any) {
      console.error("Firestore getSupportMessages failed:", err.message);
      return Object.values(readLocalDB().supportMessages || {}).sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  }

  async saveSupportMessage(msg: SupportMessage): Promise<void> {
    const db = readLocalDB();
    if (!db.supportMessages) db.supportMessages = {};
    db.supportMessages[msg.id] = msg;
    writeLocalDB(db);

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("support_messages").doc(msg.id).set(msg);
    } catch (err: any) {
      console.error("Firestore saveSupportMessage failed:", err.message);
      throw err;
    }
  }

  async deleteSupportMessage(id: string): Promise<void> {
    const db = readLocalDB();
    if (db.supportMessages) {
      delete db.supportMessages[id];
      writeLocalDB(db);
    }

    if (!firestoreWorking) return;

    try {
      await this.fsDb.collection("support_messages").doc(id).delete();
    } catch (err: any) {
      console.error("Firestore deleteSupportMessage failed:", err.message);
      throw err;
    }
  }

  /**
   * Atomic check-and-claim for a Telegram update_id.
   * Returns true if this instance successfully claimed the update.
   * Returns false if the update was already processed by another instance.
   */
  async claimUpdate(updateId: number, instanceId?: string): Promise<boolean> {
    if (!updateId) return true;
    const id = updateId.toString();

    // 1. Instant memory cache check
    if (claimedUpdatesCache.has(id)) {
      return false;
    }

    // 2. Local fallback check (to persist across restarts)
    const db = readLocalDB();
    if (!(db as any).processedUpdates) (db as any).processedUpdates = {};
    const localMap = (db as any).processedUpdates;

    if (localMap[id]) {
      claimedUpdatesCache.add(id);
      return false;
    }

    // Mark as processed locally
    localMap[id] = true;
    claimedUpdatesCache.add(id);

    // Keep memory cache and disk history clean
    if (claimedUpdatesCache.size > 2000) {
       // Just clear it, we don't need infinite history in memory
       claimedUpdatesCache.clear();
       claimedUpdatesCache.add(id);
    }

    if (Object.keys(localMap).length > 2000) {
      const keys = Object.keys(localMap).sort();
      const newMap: Record<string, boolean> = {};
      keys.slice(-1000).forEach(k => newMap[k] = true);
      (db as any).processedUpdates = newMap;
    }
    
    // We only write to disk if it's a NEW update we haven't seen before
    writeLocalDB(db);

    // 3. Global Sync (Firestore)
    if (!firestoreWorking) {
      return true;
    }

    try {
      await this.fsDb.collection("processed_updates").doc(id).create({ 
        createdAt: new Date().toISOString(),
        instanceId: instanceId || "unknown",
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
      return true;
    } catch (err: any) {
      if (err.code === 6 || (err.message && err.message.toLowerCase().includes("already exists"))) {
        return false;
      }
      return true; 
    }
  }

  /**
   * Acquisition of a global polling lock to ensure only one instance polls at a time.
   * instanceId: unique ID for this bot process
   * Returns true if lock acquired or held.
   */
  async acquirePollingLock(instanceId: string): Promise<boolean> {
    if (!firestoreWorking) return true; // Local dev usually has no competition or no firestore sync

    try {
      const lockRef = this.fsDb.collection("system").doc("polling_lock");
      const snap = await lockRef.get();
      const now = Date.now();

      if (snap.exists) {
        const data = snap.data();
        // If the lock is fresh (last heartbeat < 45s) and held by someone else
        if (data && data.instanceId !== instanceId && (now - data.timestamp) < 45000) {
          return false;
        }
      }

      // Claim or refresh the lock
      await lockRef.set({
        instanceId,
        timestamp: now,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Error acquiring polling lock:", err);
      return true; // Fallback to allowing polling on failure
    }
  }

  async releasePollingLock(instanceId: string): Promise<void> {
    if (!firestoreWorking) return;
    try {
      const lockRef = this.fsDb.collection("system").doc("polling_lock");
      const snap = await lockRef.get();
      if (snap.exists && snap.data()?.instanceId === instanceId) {
        await lockRef.delete();
      }
    } catch (err) {}
  }

  /**
   * Heartbeat for this specific instance to register itself in the global registry.
   */
  async registerInstance(instanceId: string, metadata: any): Promise<void> {
    if (!firestoreWorking) return;
    try {
      await this.fsDb.collection("instances").doc(instanceId).set({
        ...metadata,
        lastSeen: Date.now(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {}
  }

  async getActiveInstances(): Promise<any[]> {
    if (!firestoreWorking) return [];
    try {
      const snap = await this.fsDb.collection("instances").where("lastSeen", ">", Date.now() - 300000).get(); // 5 min freshness
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (err) {
      return [];
    }
  }

}

