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
      botToken: "",
      adminChatId: "",
      welcomeMessage: "أهلاً بك في بوت تفعيل اشتراكات منصة ميدكيت (MedKit) المعتمد! 🏥✨\n\nيرجى تحديد خطة الاشتراك المراد تفعيلها من القائمة بالأسفل لعرض تفاصيلها وطريقة التحويل وسنقوم بتفعيل حسابك فوراً:",
      allowedEmails: []
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

// Read JSON DB
function readLocalDB(): LocalDB {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const data = fs.readFileSync(LOCAL_DB_PATH, "utf-8");
      return { ...DEFAULT_DB, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error("Failed to read local DB, fallback to default:", error);
  }
  return DEFAULT_DB;
}

// Write JSON DB
function writeLocalDB(db: LocalDB) {
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
    // Try to get setting/global with a slightly longer timeout for cloud cold starts
    const testPromise = firestoreInstance.collection("settings").doc("global").get();
    const timeoutPromise = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Firestore check timed out")), 5000));
    const snap = await Promise.race([testPromise, timeoutPromise]);
    firestoreWorking = snap.exists || !snap.exists; // operational if we got a response back
    console.log(`Database Link: FIRESTORE ACTIVE (operational=${firestoreWorking})`);
  } catch (err: any) {
    console.error("Database Link: FIRESTORE RESTRICTED (using local JSON storage layer). Error:", err.message);
    firestoreWorking = false;
  }
  return firestoreWorking;
}

// Expose Methods with Auto Fallback
export class DatabaseController {
  private fsDb: admin.firestore.Firestore;

  constructor(fsDb: admin.firestore.Firestore) {
    this.fsDb = fsDb;
  }

  // settings/global
  async getSettings(): Promise<Setting> {
    if (!firestoreWorking) {
      console.log("Database Fallback: Loading settings from LOCAL DB");
      return readLocalDB().settings.global || DEFAULT_DB.settings.global;
    }

    try {
      console.log("Firestore: Fetching settings/global...");
      const snap = await this.fsDb.collection("settings").doc("global").get();
      if (snap.exists) {
        return snap.data() as Setting;
      }
      console.log("Firestore: settings/global document does not exist.");
    } catch (err: any) {
      console.error("Firestore getSettings failed. Error:", err.message);
      // Extra safety fallback on error
      return readLocalDB().settings.global || DEFAULT_DB.settings.global;
    }
    return DEFAULT_DB.settings.global;
  }

  async saveSettings(settings: Setting): Promise<void> {
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
    if (!firestoreWorking) {
      return readLocalDB().sessions[userId] || { userId, step: "idle" };
    }

    try {
      const snap = await this.fsDb.collection("sessions").doc(userId).get();
      if (snap.exists) {
        return { userId, ...snap.data() } as Session;
      }
    } catch (err: any) {
      console.error("Firestore getSession failed:", err.message);
      return readLocalDB().sessions[userId] || { userId, step: "idle" };
    }
    return { userId, step: "idle" };
  }

  async saveSession(session: Session): Promise<void> {
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

    // 1. Local Memory/JSON check first
    const db = readLocalDB();
    if (!(db as any).processedUpdates) (db as any).processedUpdates = {};
    const localMap = (db as any).processedUpdates;

    if (localMap[id]) {
      console.log(`[${instanceId || "DB"}] Update ${id} already processed (LOCAL).`);
      return false;
    }

    // Mark as processed locally
    localMap[id] = true;
    // Keep internal history clean (last 1000)
    if (Object.keys(localMap).length > 2000) {
      const keys = Object.keys(localMap).sort();
      const newMap: Record<string, boolean> = {};
      keys.slice(-1000).forEach(k => newMap[k] = true);
      (db as any).processedUpdates = newMap;
    }
    writeLocalDB(db);

    // 2. Global Sync (Firestore)
    if (!firestoreWorking) {
      // If Firestore is down, we must rely solely on local state.
      // In multiple-instance scenarios, this avoids duplication ONLY IF they share the same disk.
      // Since they don't, we return TRUE but acknowledge the risk.
      console.log(`[${instanceId || "DB"}] Firestore not working, returning TRUE for update ${id} (Bypassed sync).`);
      return true;
    }

    try {
      // Use doc().create() which fails if the document already exists (atomic claim)
      await this.fsDb.collection("processed_updates").doc(id).create({ 
        createdAt: new Date().toISOString(),
        instanceId: instanceId || "unknown",
        claimedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`[${instanceId || "DB"}] Successfully CLAIMED update ${id} in Firestore.`);
      return true;
    } catch (err: any) {
      // Error code 6 is "ALREADY_EXISTS"
      if (err.code === 6 || (err.message && err.message.toLowerCase().includes("already exists"))) {
        console.log(`[${instanceId || "DB"}] Update ${id} already claimed in Firestore by another instance.`);
        return false;
      }
      console.log(`[${instanceId || "DB"}] Firestore error claiming update ${id}:`, err.message);
      // On unknown errors, we'd rather risk a duplicate than a lost message
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

}

