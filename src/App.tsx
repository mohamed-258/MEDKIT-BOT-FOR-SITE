import { useState, useEffect, FormEvent } from "react";
import { 
  Bot, Key, Send, Copy, Check, X, ShieldAlert, Sparkles, 
  LayoutDashboard, Ticket, Settings, MenuSquare, CheckCircle2, 
  AlertCircle, Clock, ExternalLink, Image, RefreshCw, Plus, Trash2, 
  Edit2, LogOut, LogIn, UserCheck, HelpCircle, HeartPulse, ShieldCheck,
  ChevronLeft, MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  auth, db, googleProvider 
} from "./firebase";
import { 
  signInWithPopup, signOut, onAuthStateChanged, User 
} from "firebase/auth";
import { 
  collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, 
  query, orderBy, serverTimestamp 
} from "firebase/firestore";
import { Menu, Ticket as TicketType, Setting, SupportMessage } from "./types";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [unauthorizedEmail, setUnauthorizedEmail] = useState<string | null>(null);

  // Firestore synchronizations
  const [settings, setSettings] = useState<Setting | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);

  // Database fallback status if Firestore is failing / permissions restricted on client
  const [useFallbackDB, setUseFallbackDB] = useState(false);
  
  // UX states
  const [activeTab, setActiveTab] = useState<"overview" | "tickets" | "menus" | "support" | "settings">("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<TicketType | null>(null);
  const [ticketToDeleteId, setTicketToDeleteId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replySuccess, setReplySuccess] = useState(false);

  // Support message modal/action states
  const [selectedSupportMessage, setSelectedSupportMessage] = useState<SupportMessage | null>(null);
  const [supportReplyText, setSupportReplyText] = useState("");
  const [submittingSupportReply, setSubmittingSupportReply] = useState(false);
  const [supportReplySuccess, setSupportReplySuccess] = useState(false);
  const [allowedEmailInput, setAllowedEmailInput] = useState("");

  // Webhook states
  const [webhookStatus, setWebhookStatus] = useState<any>(null);
  const [fetchingWebhook, setFetchingWebhook] = useState(false);
  const [webhookSettingStatus, setWebhookSettingStatus] = useState<"idle" | "success" | "error">("idle");
  const [webhookErrorMsg, setWebhookErrorMsg] = useState("");

  // Edit fields
  const [tokenInput, setTokenInput] = useState("");
  const [adminChatIdInput, setAdminChatIdInput] = useState("");
  const [welcomeMsgInput, setWelcomeMsgInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Menu editor
  const [editingMenu, setEditingMenu] = useState<Partial<Menu> | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuActionStatus, setMenuActionStatus] = useState<"idle" | "success" | "error">("idle");
  const [menuActionMessage, setMenuActionMessage] = useState("");

  // Copied states
  const [copiedSetting, setCopiedSetting] = useState<string | null>(null);

  // Custom diagnostic error handling
  const triggerDiagnosticError = (error: unknown, operation: string, path: string) => {
    const errorPayload = {
      error: error instanceof Error ? error.message : String(error),
      operationType: operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified
      }
    };
    console.error("Firestore Diagnostic: ", JSON.stringify(errorPayload));
  };

  // 1. Listen for Authentication Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          // Fetch settings directly to get dynamic allowedEmails list
          const res = await fetch("/api/settings");
          let allowedList: string[] = [];
          if (res.ok) {
            const data = await res.json();
            if (data && data.allowedEmails) {
              allowedList = data.allowedEmails;
            }
          }
          
          const isAllowed = currentUser.email === "mhsn68503@gmail.com" || 
                            (currentUser.email && allowedList.includes(currentUser.email));
                            
          if (isAllowed) {
            setUser(currentUser);
            setUnauthorizedEmail(null);
          } else {
            setUnauthorizedEmail(currentUser.email);
            setUser(null);
            signOut(auth);
          }
        } catch (err) {
          // Fallback if network issue but user is primary admin
          if (currentUser.email === "mhsn68503@gmail.com") {
            setUser(currentUser);
            setUnauthorizedEmail(null);
          } else {
            setUnauthorizedEmail(currentUser.email);
            setUser(null);
            signOut(auth);
          }
        }
      } else {
        setUser(null);
      }
      setCheckingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Fallback REST fetch API helpers
  const fetchRESTSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setSettings(data);
          setTokenInput(data.botToken || "");
          setAdminChatIdInput(data.adminChatId || "");
          setWelcomeMsgInput(data.welcomeMessage || "");
        }
      }
    } catch (err) {
      console.warn("REST settings fetch failed:", err);
    }
  };

  const fetchRESTMenus = async () => {
    try {
      const res = await fetch("/api/menus");
      if (res.ok) {
        const list = await res.json();
        if (list) {
          setMenus(list);
        }
      }
    } catch (err) {
      console.warn("REST menus fetch failed:", err);
    }
  };

  const fetchRESTTickets = async () => {
    try {
      const res = await fetch("/api/tickets");
      if (res.ok) {
        const list = await res.json();
        if (list) {
          const sorted = list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setTickets(sorted);
        }
      }
    } catch (err) {
      console.warn("REST tickets fetch failed:", err);
    }
  };

  const fetchRESTSupportMessages = async () => {
    try {
      const res = await fetch("/api/support-messages");
      if (res.ok) {
        const list = await res.json();
        if (list) {
          const sorted = list.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setSupportMessages(sorted);
        }
      }
    } catch (err) {
      console.warn("REST support messages fetch failed:", err);
    }
  };

  // 2. Fetch or Synchronize settings in real-time
  useEffect(() => {
    if (!user) return;
    
    // Always load via API first
    fetchRESTSettings();

    const interval = setInterval(() => {
      fetchRESTSettings();
    }, 10000);

    return () => clearInterval(interval);
  }, [user]);

  // Synchronize support messages in real-time
  useEffect(() => {
    if (!user) return;

    fetchRESTSupportMessages();

    const interval = setInterval(() => {
      fetchRESTSupportMessages();
    }, 4000);

    return () => clearInterval(interval);
  }, [user]);

  // 3. Synchronize Menus in real-time
  useEffect(() => {
    if (!user) return;

    // Always load via API first
    fetchRESTMenus();

    const interval = setInterval(() => {
      fetchRESTMenus();
    }, 4000);

    return () => clearInterval(interval);
  }, [user]);

  // 4. Synchronize Tickets in real-time (order by newest)
  useEffect(() => {
    if (!user) return;

    // Always load via API first
    fetchRESTTickets();

    const interval = setInterval(() => {
      fetchRESTTickets();
    }, 4000);

    return () => clearInterval(interval);
  }, [user]);

  // Fetch Telegram Webhook Status from Server API
  const fetchTelegramWebhookStatus = async () => {
    setFetchingWebhook(true);
    try {
      const res = await fetch("/api/telegram-status");
      const data = await res.json();
      setWebhookStatus(data);
    } catch (err) {
      console.error("Failed to fetch bot webhook state:", err);
    } finally {
      setFetchingWebhook(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTelegramWebhookStatus();
    }
  }, [user, settings]);

  // Handle Google Login
  const handleLogin = async () => {
    try {
      setCheckingAuth(true);
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setCheckingAuth(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setUnauthorizedEmail(null);
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSetting(id);
    setTimeout(() => setCopiedSetting(null), 2000);
  };

  // Save Settings
  const saveGlobalSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveSuccess(false);
    const payload = {
      botToken: tokenInput.trim(),
      adminChatId: adminChatIdInput.trim(),
      welcomeMessage: welcomeMsgInput,
      allowedEmails: settings?.allowedEmails || []
    };
    try {
      // Always save safely via backend API (handles Firestore Admin and local DB)
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error("Failed to save settings via API");
      }

      setSettings(payload);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("Save global settings errored:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  // 4a. Accessibility accounts (allowedEmails) management
  const [allowedEmailError, setAllowedEmailError] = useState("");
  
  const handleAddAllowedEmail = async (e: FormEvent) => {
    e.preventDefault();
    setAllowedEmailError("");
    if (!allowedEmailInput || !allowedEmailInput.trim()) return;
    
    const cleanEmail = allowedEmailInput.trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      setAllowedEmailError("الرجاء إدخال بريد إلكتروني صحيح");
      return;
    }

    const currentEmails = settings?.allowedEmails || [];
    if (currentEmails.includes(cleanEmail)) {
      setAllowedEmailError("هذا الحساب مضاف مسبقاً");
      return;
    }

    const updatedAllowedEmails = [...currentEmails, cleanEmail];
    const payload = {
      botToken: settings?.botToken || "",
      adminChatId: settings?.adminChatId || "",
      welcomeMessage: settings?.welcomeMessage || "",
      allowedEmails: updatedAllowedEmails
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSettings({
          botToken: settings?.botToken || "",
          adminChatId: settings?.adminChatId || "",
          welcomeMessage: settings?.welcomeMessage || "",
          allowedEmails: updatedAllowedEmails
        });
        setAllowedEmailInput("");
      } else {
        setAllowedEmailError("فشل حفظ الحساب بالخادم");
      }
    } catch (err) {
      console.error("Failed to add allowed email:", err);
      setAllowedEmailError("حدث خطأ ما في الخادم");
    }
  };

  const handleRemoveAllowedEmail = async (emailToRemove: string) => {
    const currentEmails = settings?.allowedEmails || [];
    const updatedAllowedEmails = currentEmails.filter(e => e !== emailToRemove);
    const payload = {
      botToken: settings?.botToken || "",
      adminChatId: settings?.adminChatId || "",
      welcomeMessage: settings?.welcomeMessage || "",
      allowedEmails: updatedAllowedEmails
    };

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setSettings({
          botToken: settings?.botToken || "",
          adminChatId: settings?.adminChatId || "",
          welcomeMessage: settings?.welcomeMessage || "",
          allowedEmails: updatedAllowedEmails
        });
      }
    } catch (err) {
      console.error("Failed to remove allowed email:", err);
    }
  };

  // 4b. Support messages management
  const handleReplySupport = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSupportMessage || !supportReplyText.trim()) return;

    setSubmittingSupportReply(true);
    setSupportReplySuccess(false);

    try {
      const res = await fetch("/api/support-messages/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: selectedSupportMessage.id,
          replyText: supportReplyText
        })
      });

      if (res.ok) {
        setSupportReplySuccess(true);
        setSupportReplyText("");
        // Refresh immediately
        fetchRESTSupportMessages();
        setTimeout(() => {
          setSelectedSupportMessage(null);
          setSupportReplySuccess(false);
        }, 1800);
      } else {
        alert("تعذر تسليم الرد تلغرام");
      }
    } catch (err) {
      console.error("Error replying to support message:", err);
    } finally {
      setSubmittingSupportReply(false);
    }
  };

  const handleDeleteSupportMessage = async (msgId: string) => {
    try {
      const res = await fetch(`/api/support-messages/${msgId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchRESTSupportMessages();
        if (selectedSupportMessage?.id === msgId) {
          setSelectedSupportMessage(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete support message:", err);
    }
  };

  // Save / Update a Subscription Menu
  const handleSaveMenu = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingMenu.id || !editingMenu.title) return;
    
    setMenuActionStatus("idle");
    setMenuActionMessage("");
    const menuId = editingMenu.id.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    try {
      const payload = {
        id: menuId,
        title: editingMenu.title,
        price: editingMenu.price || "غير محدد",
        description: editingMenu.description || "",
        details: editingMenu.details || ""
      };

      // Always save safely via backend API (handles Firestore Admin and local DB)
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "خطأ أثناء محاولة حفظ وتحديث خطة الاشتراك على المزود.");
      }

      setMenuActionStatus("success");
      setMenuActionMessage("تم حفظ وتحديث باقة الاشتراك بنجاح!");
      setTimeout(() => {
        setMenuActionStatus("idle");
      }, 5000);

      // Refresh state
      fetchRESTMenus();

      setShowMenuModal(false);
      setEditingMenu(null);
    } catch (err: any) {
      console.error("Save menu errored:", err);
      setMenuActionStatus("error");
      setMenuActionMessage(err.message || "حدث خطأ غير متوقع أثناء حفظ باقة الاشتراك.");
    }
  };

  // Delete a Subscription Menu
  const handleDeleteMenu = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه الباقة؟ لن تظهر للمستخدمين على البوت.")) return;
    setMenuActionStatus("idle");
    setMenuActionMessage("");
    try {
      // Always delete safely via backend API (handles Firestore Admin and local DB)
      const res = await fetch(`/api/menus/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "فشل مزود الخدمة في حذف الباقة المطلوبة.");
      }

      setMenuActionStatus("success");
      setMenuActionMessage("تم حذف باقة الاشتراك بنجاح!");
      setTimeout(() => {
        setMenuActionStatus("idle");
      }, 5000);

      // Refresh state
      fetchRESTMenus();
    } catch (err: any) {
      console.error("Delete menu error:", err);
      setMenuActionStatus("error");
      setMenuActionMessage(err.message || "حدث خطأ أثناء محاولة حذف الباقة.");
    }
  };

  // Set / Register Bot Webhook via bot server API
  const activateBotWebhook = async () => {
    setWebhookSettingStatus("idle");
    setWebhookErrorMsg("");
    try {
      const res = await fetch("/api/setup-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل تفعيل الويب هوك");
      }
      setWebhookSettingStatus("success");
      fetchTelegramWebhookStatus();
    } catch (err: any) {
      setWebhookSettingStatus("error");
      setWebhookErrorMsg(err.message || "حدث خطأ غير متوقع");
    }
  };

  // Remove Bot Webhook to allow local testing
  const removeBotWebhook = async () => {
    setWebhookSettingStatus("idle");
    setWebhookErrorMsg("");
    if (!confirm("هل أنت متأكد أنك تريد إيقاف الويب هوك؟ هذا قد يوقف استلام البوت للرسائل إذا لم تكن تشغله محلياً.")) return;
    
    try {
      const res = await fetch("/api/remove-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل إيقاف الويب هوك");
      }
      setWebhookSettingStatus("success");
      fetchTelegramWebhookStatus();
    } catch (err: any) {
      setWebhookSettingStatus("error");
      setWebhookErrorMsg(err.message || "حدث خطأ غير متوقع");
    }
  };

  // Toggle Polling
  const handleTogglePolling = async (enabled: boolean, claimMaster: boolean = false) => {
    try {
      const res = await fetch("/api/polling/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, claimMaster })
      });
      if (res.ok) {
        fetchTelegramWebhookStatus();
      }
    } catch (err) {
      console.error("Failed to toggle polling:", err);
    }
  };

  // Direct Ticket Reply (Approvals / Rejections)
  const submitTicketReply = async (status: "approved" | "rejected") => {
    if (!selectedTicket) return;
    if (!replyMessage.trim()) {
      alert("يرجى كتابة رسالة توضيحية أو رد للعميل ليتم إرسالها إلى حسابه على التليجرام.");
      return;
    }

    setSubmittingReply(true);
    setReplySuccess(false);

    try {
      const res = await fetch("/api/admin/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: selectedTicket.id,
          replyMessage: replyMessage.trim(),
          newStatus: status
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "خطأ أثناء محاولة إرسال الرد وتحديث الطلب");
      }

      setReplySuccess(true);
      setReplyMessage("");
      
      // Update local state instantly so the admin sees the updated status
      setSelectedTicket((prev) => prev ? { ...prev, status, adminComment: replyMessage.trim() } : null);
      setTimeout(() => setReplySuccess(false), 3000);
    } catch (err: any) {
      alert(err.message || "حدث خطأ");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteTicket = async (id: string, force = false) => {
    if (!force) {
      setTicketToDeleteId(id);
      return;
    }

    try {
      // Optimistic update
      const ticketToDelete = tickets.find(t => t.id === id);
      setTickets(prev => prev.filter(t => t.id !== id));
      setTicketToDeleteId(null);
      
      const res = await fetch(`/api/tickets/${id}`, {
        method: "DELETE"
      });
      
      if (res.ok) {
        if (selectedTicket?.id === id) {
          setSelectedTicket(null);
        }
        // Force refresh from server to be sure
        fetchRESTTickets();
      } else {
        // Rollback on error
        if (ticketToDelete) {
          setTickets(prev => [ticketToDelete, ...prev].sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        }
        alert("فشل حذف الطلب من الخادم. يرجى المحاولة مرة أخرى.");
      }
    } catch (err) {
      console.error("Failed to delete ticket:", err);
      alert("حدث خطأ أثناء محاولة الحذف. تأكد من اتصالك بالإنترنت.");
    }
  };

  // Filtering Tickets
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.telegramName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.menuTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.telegramUsername && t.telegramUsername.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && t.status === statusFilter;
  });

  // Calculate stats for Dashboard
  const activeCount = tickets.filter(t => t.status === "approved").length;
  const pendingCount = tickets.filter(t => t.status === "new").length;
  const rejectedCount = tickets.filter(t => t.status === "rejected").length;
  const totalCount = tickets.length;
  const unrepliedSupportCount = supportMessages.filter(m => !m.replied).length;

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white font-sans" dir="rtl">
        <div className="relative flex flex-col items-center space-y-4">
          <div className="animate-spin h-10 w-10 border-4 border-cyan-500 rounded-full border-t-transparent shadow-lg shadow-cyan-500/20"></div>
          <p className="text-slate-400 text-sm font-medium animate-pulse">جاري فحص الاتصال الأمن...</p>
        </div>
      </div>
    );
  }

  // Unauthorized Warning
  if (unauthorizedEmail) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 font-sans text-right" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-md bg-slate-900 border border-red-500/30 p-8 rounded-2xl shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl"></div>
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-400">
              <ShieldAlert className="h-10 w-10" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-white text-center mb-4">الدخول مرفوض لحماية البيانات!</h2>
          <p className="text-slate-400 text-sm text-center leading-relaxed mb-6">
            عذراً، البريد الإلكتروني <span className="font-mono text-cyan-400 block mt-1 select-all">{unauthorizedEmail}</span> غير مصرح له بالوصول إلى لوحة تفعيل ومراجعة منصة ميدكيت.
            <br />
            المسؤول والمتحكم الوحيد بالبوت هو صاحب البريد الإلكتروني المعتمد.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all shadow-lg hover:shadow-red-600/10 flex items-center justify-center gap-2"
            >
              <LogOut className="h-5 w-5" />
              تسجيل الخروج والمحاولة مجدداً
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Not Logged In Landing Page
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 relative overflow-hidden font-sans" dir="rtl">
        {/* Background Gradients */}
        <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] bg-cyan-600/10 rounded-full blur-[100px] -z-10"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-teal-600/10 rounded-full blur-[80px] -z-10"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-white/5 p-8 rounded-3xl shadow-2xl relative"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-2xl flex items-center justify-center shadow-inner mb-4">
              <HeartPulse className="h-9 w-9 text-cyan-400" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">دكتور ميدكيت 🏥</h1>
            <p className="text-slate-400 text-sm mt-2 text-center text-slate-400 hover:text-slate-300 transition-colors">
              لوحة التحكم وبوت الاشتراكات وتفعيل الأكواد الذكي يعمل 24/7
            </p>
          </div>

          <div className="p-5 bg-slate-800/40 rounded-2xl border border-white/5 space-y-4 mb-8">
            <div className="flex gap-3 text-right">
              <div className="mt-1 p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400 h-fit">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong>أمن البيانات بالكامل:</strong> البوابة تضمن الدخول الحصري والتحقق من حساب الأدمن المعتمد للمبيعات.
              </p>
            </div>
            <div className="flex gap-3 text-right">
              <div className="mt-1 p-1.5 bg-cyan-500/10 rounded-lg text-cyan-400 h-fit">
                <Bot className="h-4 w-4" />
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong>ربط تليجرام فوري:</strong> تحكم بالباقات والتوكن، ووافق على الطلبات لتصل رسائل التفعيل للمستخدم على هاتفه فوراً.
              </p>
            </div>
          </div>

          <button
            onClick={handleLogin}
            className="w-full py-4 bg-gradient-to-l from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-semibold rounded-2xl transition-all shadow-xl shadow-cyan-500/10 hover:shadow-cyan-500/20 flex items-center justify-center gap-3 border border-white/10 dark:active:scale-95"
          >
            <LogIn className="h-5 w-5" />
            الدخول الآمن - دكتور ميدكيت
          </button>

          <p className="text-center text-slate-500 text-xs mt-6">
            محمي ومعزز بسحابة Google Cloud Run و Firebase 🔐
          </p>
        </motion.div>
      </div>
    );
  }

  // Signed In - Main Dashboard Interface
  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col md:flex-row relative" dir="rtl">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full md:w-80 bg-slate-900 border-l border-white/5 flex flex-col flex-shrink-0 z-10 p-5 gap-8">
        
        {/* Admin Header Info */}
        <div className="flex items-center gap-4 border-b border-white/5 pb-6">
          <div className="h-12 w-12 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl flex items-center justify-center">
            <HeartPulse className="h-7 w-7 text-cyan-400" />
          </div>
          <div className="overflow-hidden">
            <h2 className="font-bold text-white truncate text-base">دكتور ميدكيت 🏥</h2>
            <div className="flex items-center gap-2.5 mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <p className="text-xs text-slate-400 truncate font-mono">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Navigation Menus List */}
        <nav className="flex-1 flex flex-col gap-1.5">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full py-3.5 px-4 rounded-xl flex items-center gap-3.5 transition-all text-sm font-medium ${
              activeTab === "overview" 
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold" 
                : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            الرئيسية والإحصائيات
          </button>

          <button
            onClick={() => setActiveTab("tickets")}
            className={`w-full py-3.5 px-4 rounded-xl flex items-center gap-3.5 transition-all text-sm font-medium relative ${
              activeTab === "tickets" 
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold" 
                : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
            }`}
          >
            <Ticket className="h-5 w-5" />
            طلبات الاشتراكات
            {pendingCount > 0 && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-cyan-500 text-slate-950 animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("support")}
            className={`w-full py-3.5 px-4 rounded-xl flex items-center gap-3.5 transition-all text-sm font-medium relative ${
              activeTab === "support" 
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold" 
                : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            رسائل المستخدمين 👥
            {unrepliedSupportCount > 0 && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 px-2.5 py-0.5 text-xs font-bold rounded-lg bg-red-500 text-white animate-pulse">
                {unrepliedSupportCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("menus")}
            className={`w-full py-3.5 px-4 rounded-xl flex items-center gap-3.5 transition-all text-sm font-medium ${
              activeTab === "menus" 
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold" 
                : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
            }`}
          >
            <MenuSquare className="h-5 w-5" />
            باقات الاشتراكات
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full py-3.5 px-4 rounded-xl flex items-center gap-3.5 transition-all text-sm font-medium ${
              activeTab === "settings" 
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold" 
                : "text-slate-400 hover:bg-slate-800/40 hover:text-white"
            }`}
          >
            <Settings className="h-5 w-5" />
            إعدادات الويب هوك والبوت
            {!settings?.botToken && (
              <span className="absolute left-4 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-400"></span>
            )}
          </button>
        </nav>

        {/* Sidebar Footer Logout action */}
        <div className="border-t border-white/5 pt-6 flex flex-col gap-4">
          {/* Bot State Notification */}
          <div className="p-3.5 bg-slate-950/50 rounded-xl border border-white/5 text-right flex flex-col gap-1.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">حالة البوت</span>
            {webhookStatus?.configured ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-medium text-emerald-400 truncate">يعمل 24س مفعّل</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                <span className="text-xs font-medium text-red-300">غير معرّف أو متوقف</span>
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            تسجيل خروج الأدمن
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER CONTENT VIEW */}
      <main className="flex-1 flex flex-col overflow-y-auto px-4 py-8 md:px-10">

        {/* MAIN DASHBOARD CONTENT ROUTING */}
        <div className="flex-1 max-w-6xl w-full mx-auto">
          
          <AnimatePresence mode="wait">
            
            {/* TAB 1: OVERVIEW & GENERAL STATS */}
            {activeTab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                {/* Visual Banner */}
                <div className="bg-gradient-to-l from-slate-900 via-slate-900 to-cyan-950/20 border border-white/5 p-8 rounded-3xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
                  <div className="absolute top-0 left-0 w-44 h-44 bg-cyan-500/5 rounded-full blur-3xl"></div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-cyan-400">
                      <Sparkles className="h-5 w-5 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider">مرحباً بك مجدداً 🩺</span>
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-white">لوحة تحكم بوت اشتراك منصة ميدكيت</h1>
                    <p className="text-slate-400 text-sm max-w-xl">
                      من هنا يمكنك إدارة وتفعيل طلبات الأكواد للمشتركين الذين يرسلون إيصالات الدفع والبريد الإلكتروني عبر البوت، لتصل لهم التفعيلات على التليجرام مباشرة بشكل آلي 24 ساعة.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={fetchTelegramWebhookStatus}
                      className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-white/5 flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className={`h-4.5 w-4.5 text-cyan-400 ${fetchingWebhook ? "animate-spin" : ""}`} />
                      تحديث الحالة
                    </button>
                  </div>
                </div>

                {/* Dashboard Stats Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-medium">قيد المراجعة ⏳</p>
                      <p className="text-4xl font-extrabold text-cyan-400 font-mono">{pendingCount}</p>
                    </div>
                    <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20 text-cyan-500 shadow-inner">
                      <Clock className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-medium">الاشتراكات المفعلة ✅</p>
                      <p className="text-4xl font-extrabold text-emerald-400 font-mono">{activeCount}</p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500 shadow-inner">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-medium">الاشتراكات المرفوضة ❌</p>
                      <p className="text-4xl font-extrabold text-red-400 font-mono">{rejectedCount}</p>
                    </div>
                    <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-500 shadow-inner">
                      <X className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl flex items-center justify-between relative overflow-hidden">
                    <div className="space-y-1">
                      <p className="text-xs text-slate-400 font-medium">إجمالي الطلبات 📊</p>
                      <p className="text-4xl font-extrabold text-slate-200 font-mono">{totalCount}</p>
                    </div>
                    <div className="p-3 bg-slate-800 rounded-2xl border border-white/5 text-slate-400 shadow-inner">
                      <Ticket className="h-7 w-7" />
                    </div>
                  </div>
                </div>

                {/* Submissions Section Preview and Bot configuration Tips */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Latest unresolved requests */}
                  <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Ticket className="h-5 w-5 text-cyan-400" />
                        آخر طلبات بحاجة لمراجعة وتفعيل كود
                      </h3>
                      <button
                        onClick={() => setActiveTab("tickets")}
                        className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        عرض الكل
                      </button>
                    </div>

                    {tickets.filter(t => t.status === "new").length === 0 ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
                        <Check className="h-10 w-10 text-emerald-500/30 p-2 bg-emerald-500/10 rounded-full" />
                        <p className="text-sm">رائع! لا يوجد أي طلبات اشتراك معلقة بانتظارك حالياً.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {tickets.filter(t => t.status === "new").slice(0, 4).map((ticket) => (
                          <div
                            key={ticket.id}
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setActiveTab("tickets");
                            }}
                            className="py-4 flex items-center justify-between hover:bg-slate-800/10 px-2 rounded-xl transition-all cursor-pointer"
                          >
                            <div className="space-y-1">
                              <p className="font-bold text-xs text-white sm:text-sm">{ticket.telegramName}</p>
                              <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="font-mono">{ticket.email}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-cyan-400 font-semibold">{ticket.menuTitle}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(ticket.createdAt).toLocaleDateString("ar-EG")}
                              </span>
                              <ChevronLeft className="h-4.5 w-4.5 text-slate-600" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Telegram Tips and Connection Panel */}
                  <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 flex flex-col justify-between gap-6">
                    <div className="space-y-4">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Bot className="h-5 w-5 text-cyan-400" />
                        الارتباط بالبوت 🤖
                      </h3>
                      
                      <div className="p-4 bg-slate-950/60 border border-white/5 rounded-xl space-y-3.5 text-xs text-slate-300">
                        {webhookStatus?.configured ? (
                          <>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                              <p className="font-semibold text-emerald-400">البوت متصل ومنشط بالكامل</p>
                            </div>
                            <p className="text-slate-400 leading-relaxed text-[11px]">
                              يعمل البوت تلقائياً في الخلفية لاستقبال الرسائل وتفعيل الأكواد لعملائك دون الحاجة لترك متصفحك أو جهازك مفتوحاً.
                            </p>
                            {webhookStatus.botUser && (
                              <div className="pt-2.5 border-t border-white/5 font-mono text-[11px] text-cyan-400">
                                البوت: @{webhookStatus.botUser.username}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"></span>
                              <p className="font-semibold text-red-300">لم يتم ربط البوت بعد</p>
                            </div>
                            <p className="text-slate-400 leading-relaxed">
                              يرجى تزويد البوت بالتوكن في تبويب "الإعدادات" ثم الضغط على "تفعيل الويب هوك" لتنشيطه.
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab("settings")}
                      className="w-full py-3.5 bg-gradient-to-l from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all shadow-lg hover:shadow-cyan-500/10 flex items-center justify-center gap-2"
                    >
                      تهيئة إعدادات تليجرام وبدء التفعيل
                    </button>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 2: TICKETS INBOX FOR REVIEWING CREDITS */}
            {activeTab === "tickets" && (
              <motion.div
                key="tickets"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-white">وارد طلبات تفعيل الأكواد 📥</h1>
                    <p className="text-xs text-slate-400 mt-1">
                      راجع إيميلات المشتركين وصور التحويل البنكي أوVodafone Cash التي أرسلوها للبوت للتحقق والتفعيل.
                    </p>
                  </div>
                  
                  {/* Quick stats inline */}
                  <div className="flex items-center gap-2 text-xs font-mono font-bold">
                    <span className="px-3 py-1.5 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg">قيد الانتظار: {pendingCount}</span>
                    <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">مقبول: {activeCount}</span>
                  </div>
                </div>

                {/* Search and filter panel */}
                <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 border border-white/5 p-4 rounded-xl">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم، الإيميل، الباقة أو اسم العميل..."
                    className="flex-1 bg-slate-950/60 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />
                  
                  <div className="flex gap-2">
                    {["all", "new", "approved", "rejected"].map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setStatusFilter(filter)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                          statusFilter === filter 
                            ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/10" 
                            : "bg-slate-950 hover:bg-slate-800/60 text-slate-400 hover:text-white"
                        }`}
                      >
                        {filter === "all" && "الكل"}
                        {filter === "new" && "قيد الانتظار ⏳"}
                        {filter === "approved" && "مقبول ✅"}
                        {filter === "rejected" && "مرفوض ❌"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split layout: tickets list & details view */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Left Column: Tickets List */}
                  <div className="lg:col-span-5 bg-slate-900 border border-white/5 rounded-2xl max-h-[650px] overflow-y-auto divide-y divide-white/5">
                    {filteredTickets.length === 0 ? (
                      <div className="py-24 text-center text-slate-500 space-y-3">
                        <AlertCircle className="h-10 w-10 text-slate-600 mx-auto" />
                        <p className="text-xs">لا يوجد أي طلبات تطابق معايير البحث والفلترة حالياً.</p>
                      </div>
                    ) : (
                      filteredTickets.map((ticket) => {
                        const isSelected = selectedTicket?.id === ticket.id;
                        return (
                          <div
                            key={ticket.id}
                            onClick={() => {
                              setSelectedTicket(ticket);
                              setReplyMessage(ticket.adminComment || "");
                            }}
                            className={`p-4 flex flex-col gap-2.5 cursor-pointer transition-all ${
                              isSelected 
                                ? "bg-cyan-500/5 border-r-4 border-cyan-500" 
                                : "hover:bg-slate-800/20"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-xs text-white sm:text-sm">{ticket.telegramName}</h4>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  ticket.status === "approved" 
                                    ? "bg-emerald-500/10 text-emerald-400" 
                                    : ticket.status === "rejected" 
                                      ? "bg-red-500/10 text-red-500" 
                                      : "bg-cyan-500/10 text-cyan-400 animate-pulse"
                                }`}>
                                  {ticket.status === "approved" && "مقبول"}
                                  {ticket.status === "rejected" && "مرفوض"}
                                  {ticket.status === "new" && "جديد"}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  {ticketToDeleteId === ticket.id ? (
                                    <div className="flex items-center bg-red-500/20 rounded-xl p-1 animate-in fade-in slide-in-from-right-2 duration-300">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTicket(ticket.id, true);
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                                      >
                                        حذف؟
                                      </button>
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setTicketToDeleteId(null);
                                        }}
                                        className="p-1 text-slate-400 hover:text-white"
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTicket(ticket.id);
                                      }}
                                      className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded-xl transition-all relative z-10"
                                      title="حذف الطلب"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span className="font-mono truncate max-w-[200px]">{ticket.email}</span>
                              <span className="font-bold text-cyan-400 text-[11px] bg-slate-950 px-2 py-0.5 rounded-lg border border-white/5">
                                {ticket.menuTitle}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-white/5 pt-2 mt-1">
                              <span>@{ticket.telegramUsername || "بدون معرف"}</span>
                              <span className="font-mono">{new Date(ticket.createdAt).toLocaleDateString("ar-EG")}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Right Column: Dynamic Ticket Verification & Approvals Area */}
                  <div className="lg:col-span-7">
                    {selectedTicket ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6"
                      >
                        {/* Detail Header */}
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-white/5 pb-4">
                          <div className="flex-1">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">طلب تفعيل كود ميدكيت مشترك</span>
                            <div className="flex items-center justify-between mt-1">
                              <h3 className="text-lg font-bold text-white">{selectedTicket.telegramName}</h3>
                              {ticketToDeleteId === selectedTicket.id ? (
                                <div className="flex items-center gap-2 bg-red-500/10 p-1.5 rounded-xl border border-red-500/20 animate-in fade-in zoom-in-95 duration-200">
                                  <span className="text-[10px] font-bold text-red-400 px-1">تأكيد الحذف؟</span>
                                  <button 
                                    onClick={() => handleDeleteTicket(selectedTicket.id, true)}
                                    className="px-3 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-all"
                                  >
                                    نعم
                                  </button>
                                  <button 
                                    onClick={() => setTicketToDeleteId(null)}
                                    className="p-1 px-2 text-[10px] text-slate-400 hover:text-white"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                                  className="sm:hidden p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Active State indicator */}
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500">حالة الطلب:</span>
                              <span className={`px-2.5 py-1 text-xs font-bold rounded-xl border ${
                                selectedTicket.status === "approved" 
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                  : selectedTicket.status === "rejected" 
                                    ? "bg-red-500/10 text-red-500 border-red-500/20" 
                                    : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse"
                              }`}>
                                {selectedTicket.status === "approved" && "تم التفعيل مسبقاً ✅"}
                                {selectedTicket.status === "rejected" && "تم رفض الطلب ❌"}
                                {selectedTicket.status === "new" && "بانتظار المراجعة والتحويل ⏳"}
                              </span>
                            </div>
                            <button 
                              onClick={() => handleDeleteTicket(selectedTicket.id)}
                              className="hidden sm:flex p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all"
                              title="حذف الطلب نهائياً"
                            >
                              <Trash2 className="h-4.5 w-4.5" />
                            </button>
                          </div>
                        </div>

                        {/* User Metadata */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/40 p-4 border border-white/5 rounded-xl">
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 block">البريد الإلكتروني للعميل المسجل 📩</span>
                            <div className="flex items-center gap-1.5 font-mono text-xs text-cyan-400">
                              <span className="select-all truncate">{selectedTicket.email}</span>
                              <button 
                                onClick={() => handleCopy(selectedTicket.email, "email")}
                                className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                              >
                                {copiedSetting === "email" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 block">الباقة والاشتراك المطلوب 💳</span>
                            <span className="text-xs text-white font-bold block">{selectedTicket.menuTitle}</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 block">حساب التليجرام الخاص به 🔗</span>
                            {selectedTicket.telegramUsername ? (
                              <a 
                                href={`https://t.me/${selectedTicket.telegramUsername}`} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs text-cyan-400 font-semibold hover:underline flex items-center gap-1 w-fit"
                              >
                                @{selectedTicket.telegramUsername}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500">لا يوجد معرّف عالي (@)</span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 block">شات ID للرد تليجرام 🆔</span>
                            <span className="text-xs text-slate-400 font-mono block">{selectedTicket.telegramUserId}</span>
                          </div>
                        </div>

                        {/* Image Receipt Display */}
                        <div className="space-y-2">
                          <span className="text-xs text-slate-400 font-medium block">إيصال التحويل البنكي أو لقطة الشاشة 🖼️</span>
                          <div className="relative group bg-slate-950 rounded-xl overflow-hidden border border-white/5 flex items-center justify-center min-h-[300px]">
                            {selectedTicket.receiptPhotoUrl ? (
                              <img 
                                src={selectedTicket.receiptPhotoUrl} 
                                alt="Receipt" 
                                className="max-w-full max-h-[400px] object-contain"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-600 gap-2">
                                <Image className="h-10 w-10 animate-pulse text-slate-700" />
                                <p className="text-xs">حدث خطأ أو لم يتم تزويد البوت بصورة دقيقة</p>
                              </div>
                            )}
                            <div className="absolute top-3 left-3 flex gap-2">
                              <a 
                                href={selectedTicket.receiptPhotoUrl} 
                                download={`receipt-${selectedTicket.telegramName}.jpg`}
                                className="p-2.5 bg-slate-900/90 hover:bg-slate-800/100 backdrop-blur-sm rounded-lg text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
                              >
                                <ExternalLink className="h-4 w-4" />
                                فتح في نافذة مستقلة
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Form controls to Reply */}
                        <div className="space-y-3.5 border-t border-white/5 pt-5">
                          <label className="text-xs text-slate-400 font-bold block">
                            توجيه الرد والقرار للعميل (سيصله الرد والتفعيل في رسالة خاصة على التليجرام فورا) ✍️
                          </label>
                          <textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="مثال: تم تفعيل حسابك بنجاح! يمكنك الآن تسجيل الدخول للمنصة والمشاهدة. أو: الإيصال غير سليم يرجى التحقق وإعادة الإرسال."
                            rows={3}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                          />

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-row gap-3">
                            <button
                              onClick={() => submitTicketReply("approved")}
                              disabled={submittingReply}
                              className="flex-1 py-3.5 bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/20 bg-emerald-400 text-slate-950"
                            >
                              <Check className="h-4.5 w-4.5" />
                              تم التحقق والموافقة على الاشتراك ✅
                            </button>

                            <button
                              onClick={() => submitTicketReply("rejected")}
                              disabled={submittingReply}
                              className="flex-1 py-3.5 bg-gradient-to-l from-red-600 to-rose-600 hover:from-red-500 hover:from-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-red-950/20"
                            >
                              <X className="h-4.5 w-4.5" />
                              رفض الطلب وإرسال توضيح ❌
                            </button>
                          </div>

                          <AnimatePresence>
                            {replySuccess && (
                              <motion.div 
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs text-center flex items-center justify-center gap-2"
                              >
                                <CheckCircle2 className="h-4.5 w-4.5" />
                                تم إرسال رد الإدارة إلى المستخدم على حسابه التليجرام بنجاح وتحديث قاعدة البيانات!
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center text-slate-500 space-y-4 flex flex-col items-center justify-center min-h-[450px]">
                        <div className="h-16 w-16 bg-slate-950 border border-white/5 rounded-full flex items-center justify-center mb-2">
                          <Ticket className="h-8 w-8 text-slate-700 animate-pulse" />
                        </div>
                        <h3 className="text-white font-bold text-base">لا توجد تفاصيل معروضة</h3>
                        <p className="text-xs max-w-sm leading-relaxed">
                          اختر أي طلب اشتراك أو إيصال تفعيل من القائمة الجانبية في اليمين للتحقق وبدء عمل الإجراءات الفورية.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 3: SUBSCRIPTION PLANS MENUS LIST */}
            {activeTab === "menus" && (
              <motion.div
                key="menus"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                  <div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-white font-sans">باقات الاشتراكات وعروض التليجرام 💳</h1>
                    <p className="text-xs text-slate-400 mt-1">
                      قم بتهيئة وتعديل الأزرار التي تظهر لعملائك بالبوت، والمحتوى التفصيلي الخاص بالدفع التكميلي لكل باقة.
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      setEditingMenu({ id: "", title: "", price: "", description: "", details: "" });
                      setShowMenuModal(true);
                    }}
                    className="px-4 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/10"
                  >
                    <Plus className="h-4.5 w-4.5" />
                    اضافة باقة اشتراك جديدة
                  </button>
                </div>

                {/* Visual success/error notifications for actions on menus */}
                <AnimatePresence>
                  {menuActionStatus !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`p-4 rounded-xl text-xs text-center border font-semibold flex items-center justify-center gap-2 ${
                        menuActionStatus === "success"
                          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
                          : "bg-red-500/15 border-red-500/25 text-red-400"
                      }`}
                    >
                      <span>{menuActionMessage}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Grid of existing items */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {menus.map((menu) => (
                    <div 
                      key={menu.id} 
                      className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex flex-col justify-between gap-5 relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <h3 className="font-bold text-white text-base">{menu.title}</h3>
                          <span className="px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-mono font-bold">
                            {menu.price}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed font-sans mt-1">
                          {menu.description || "بدون وصف تمهيدي"}
                        </p>
                        <hr className="border-white/5 my-2" />
                        <div className="space-y-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">رسالة تفاصيل الشراء (تليجرام) 🩺</span>
                          <p className="text-[11px] text-slate-300 leading-relaxed font-mono truncate max-h-[80px]" style={{ whiteSpace: "pre-wrap" }}>
                            {menu.details}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-2.5 pt-4 border-t border-white/5">
                        <button
                          onClick={() => {
                            setEditingMenu(menu);
                            setShowMenuModal(true);
                          }}
                          className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/5"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          تعديل الباقة
                        </button>
                        
                        <button
                          onClick={() => handleDeleteMenu(menu.id)}
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs transition-all cursor-pointer border border-red-500/10"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* MODAL EDITOR */}
                {showMenuModal && editingMenu && (
                  <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-900 border border-white/5 p-6 rounded-2xl shadow-2xl w-full max-w-lg space-y-5"
                    >
                      <div className="flex justify-between items-center pb-3 border-b border-white/5">
                        <h3 className="font-bold text-white text-base">
                          {editingMenu.id ? "تعديل باقة الاشتراك" : "إضافة باقة اشتراك جديدة للبوت"}
                        </h3>
                        <button 
                          onClick={() => {
                            setShowMenuModal(false);
                            setEditingMenu(null);
                          }}
                          className="p-1 hover:bg-slate-850 rounded-lg text-slate-400 hover:text-white"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveMenu} className="space-y-4 text-right">
                        <div>
                          <label className="text-xs text-slate-400 block mb-1">رمز الباقة (ممنوع المسافات أو الرموز - مثلاً: mid_rrs) *</label>
                          <input
                            type="text"
                            required
                            disabled={!!editingMenu.id}
                            value={editingMenu.id || ""}
                            onChange={(e) => setEditingMenu({ ...editingMenu, id: e.target.value })}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-600 font-mono disabled:opacity-50"
                            placeholder="mid_rrs"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 block mb-1">اسم الباقة (سيظهر كزر على شات البوت - مثلاً: mid RRS) *</label>
                          <input
                            type="text"
                            required
                            value={editingMenu.title || ""}
                            onChange={(e) => setEditingMenu({ ...editingMenu, title: e.target.value })}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-600"
                            placeholder="mid RRS"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 block mb-1">سعر الباقة الإجمالي لكتابة التفاصيل (مثلاً: 300 جنيه)</label>
                          <input
                            type="text"
                            value={editingMenu.price || ""}
                            onChange={(e) => setEditingMenu({ ...editingMenu, price: e.target.value })}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200"
                            placeholder="300 جنيه"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 block mb-1">وصف تمهيدي مصغر (لإظهاره داخلياً باللوحة)</label>
                          <input
                            type="text"
                            value={editingMenu.description || ""}
                            onChange={(e) => setEditingMenu({ ...editingMenu, description: e.target.value })}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200"
                            placeholder="وصف الباقة لتفعيل مراجعة RRS"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 block mb-1">
                            التفاصيل الكاملة ورسالة الشراء المقترنة للبوت (تظهر للمشترك على تليجرام عند الضغط على الباقة) *
                          </label>
                          <textarea
                            rows={5}
                            required
                            value={editingMenu.details || ""}
                            onChange={(e) => setEditingMenu({ ...editingMenu, details: e.target.value })}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-xs text-slate-200 font-mono"
                            placeholder="يرجى تحويل مبلغ الاشتراك إلى فودافون كاش على الرقم (010x) ثم كتابة إيميلك المسجل بالمنصة وإرساله..."
                          />
                        </div>

                        <div className="flex gap-3 pt-3 border-t border-white/5">
                          <button
                            type="submit"
                            className="flex-1 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
                          >
                            حفظ الباقة والتحديث
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowMenuModal(false);
                              setEditingMenu(null);
                            }}
                            className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
                          >
                            إلغاء
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}

              </motion.div>
            )}

            {/* TAB 3.5: SUPPORT MESSAGES GROUP (تحدث مع الدعم) */}
            {activeTab === "support" && (
              <motion.div
                key="support"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="text-xl md:text-2xl font-extrabold text-white font-sans">رسائل المستخدمين والدعم الفني 💬</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    هنا تجد جميع الرسائل الواردة من مستخدمي البوت عند اختيارهم "تحدث مع الدعم"، ويمكنك الرد عليهم مباشرة وسيصلهم الرد على التليجرام فوراً.
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 p-4 border border-white/5 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={`px-4 py-2 text-xs rounded-xl transition-all cursor-pointer ${
                        statusFilter === "all"
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-white/5"
                      }`}
                    >
                      الكل ({supportMessages.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("pending")}
                      className={`px-4 py-2 text-xs rounded-xl transition-all cursor-pointer ${
                        statusFilter === "pending"
                          ? "bg-red-500 text-white font-bold"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-white/5"
                      }`}
                    >
                      بانتظار الرد ({supportMessages.filter(m => !m.replied).length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("replied")}
                      className={`px-4 py-2 text-xs rounded-xl transition-all cursor-pointer ${
                        statusFilter === "replied"
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-white/5"
                      }`}
                    >
                      تم الرد عليها ({supportMessages.filter(m => m.replied).length})
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="ابحث عن رسالة أو مستخدم..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950/60 border border-white/5 text-xs text-slate-200 px-4 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 w-full sm:w-64 text-right animate-all"
                  />
                </div>

                {/* Main section support messages */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                  
                  {/* Left list panel */}
                  <div className="xl:col-span-2 space-y-4 max-h-[600px] overflow-y-auto pr-1">
                    {(() => {
                      const filtered = supportMessages.filter(msg => {
                        // filter by status
                        if (statusFilter === "pending" && msg.replied) return false;
                        if (statusFilter === "replied" && !msg.replied) return false;
                        
                        // filter by search
                        if (searchQuery.trim()) {
                          const q = searchQuery.toLowerCase();
                          const matchesName = msg.telegramName?.toLowerCase().includes(q);
                          const matchesUsername = msg.telegramUsername?.toLowerCase().includes(q);
                          const matchesText = msg.messageText?.toLowerCase().includes(q);
                          return matchesName || matchesUsername || matchesText;
                        }
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="bg-slate-900 border border-white/5 rounded-2xl p-12 text-center text-slate-400 space-y-3">
                            <MessageSquare className="h-12 w-12 text-slate-600 mx-auto opacity-40 animate-pulse" />
                            <h3 className="font-bold text-white text-sm">لا يوجد رسائل دعم مطابقة</h3>
                            <p className="text-xs max-w-xs mx-auto leading-relaxed">
                              عند ورود رسالة فنية جديدة أو بمجرد بدء العملاء المحادثة مع الدعم ستظهر السجلات هنا.
                            </p>
                          </div>
                        );
                      }

                      return filtered.map((msg) => (
                        <div
                          key={msg.id}
                          onClick={() => {
                            setSelectedSupportMessage(msg);
                            setSupportReplyText("");
                          }}
                          className={`p-5 rounded-2xl border transition-all cursor-pointer text-right space-y-3.5 relative ${
                            selectedSupportMessage?.id === msg.id
                              ? "bg-slate-850/85 border-cyan-500/40 shadow-lg shadow-cyan-500/5 text-right"
                              : "bg-slate-900/60 border-white/5 hover:border-white/10 hover:bg-slate-850/30"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              {msg.replied ? (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400">
                                  تم الرد عليها ✅
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-500/10 text-red-400 animate-pulse">
                                  قيد الانتظار ⏳
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2.5">
                              <div className="text-right">
                                <h4 className="font-bold text-white text-xs">{msg.telegramName}</h4>
                                <span className="text-[10px] text-slate-500 font-mono">@{msg.telegramUsername || "no_user"}</span>
                              </div>
                              <div className="h-9 w-9 rounded-xl bg-slate-950 flex items-center justify-center text-xs font-black text-cyan-400 border border-white/5">
                                {msg.telegramName?.charAt(0) || "U"}
                              </div>
                            </div>
                          </div>

                          <div className="bg-slate-950 p-3.5 border border-white/5 rounded-xl text-right">
                            <p className="text-xs text-slate-350 leading-relaxed font-sans whitespace-pre-line select-text">{msg.messageText}</p>
                          </div>

                          {msg.replied && msg.replyText && (
                            <div className="bg-slate-850/40 p-3 border-r-2 border-emerald-500 rounded-l-xl text-xs space-y-1 text-right">
                              <p className="text-[10px] text-slate-500 font-bold">رد الإدارة:</p>
                              <p className="text-slate-350 leading-relaxed select-text">{msg.replyText}</p>
                            </div>
                          )}

                          <div className="flex justify-between items-center pt-2 text-[10px] text-slate-500">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSupportMessage(msg.id);
                              }}
                              className="text-red-400/80 hover:text-red-450 cursor-pointer flex items-center gap-1 transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              حذف السجل
                            </button>
                            <span className="font-mono">
                              {new Date(msg.createdAt).toLocaleString("ar-EG")}
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Right Reply details panel */}
                  <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6 text-right">
                    <h3 className="text-sm font-bold text-white border-b border-white/5 pb-3">إجراء الرد والتواصل ⚙️</h3>
                    
                    {selectedSupportMessage ? (
                      <form onSubmit={handleReplySupport} className="space-y-4 text-right">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold mb-1">المستقبل</span>
                          <p className="text-xs font-bold text-white">{selectedSupportMessage.telegramName}</p>
                          <p className="text-[10px] font-mono text-cyan-400">@{selectedSupportMessage.telegramUsername || "no_username"}</p>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-widest block font-bold mb-1">رسالته الأخيرة</span>
                          <div className="p-3 bg-slate-950 border border-white/5 rounded-xl text-xs text-slate-350 leading-relaxed font-sans max-h-[140px] overflow-y-auto select-text">
                            {selectedSupportMessage.messageText}
                          </div>
                        </div>

                        <div className="space-y-1 pb-2">
                          <label className="text-xs text-slate-400 block font-bold">رسالة الرد الخاص بك *</label>
                          <textarea
                            rows={4}
                            required
                            placeholder="اكتب رد الدعم الفني لدكتور ميدكيت وسيصل له مباشرة على حسابه الشخصي في تليجرام..."
                            value={supportReplyText}
                            onChange={(e) => setSupportReplyText(e.target.value)}
                            className="w-full bg-slate-950 border border-white/5 rounded-xl p-3.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500/50 text-right font-sans"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={submittingSupportReply}
                          className="w-full py-3.5 bg-gradient-to-l from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-cyan-500/10"
                        >
                          {submittingSupportReply ? "جاري تسليم الرد..." : "إرسال الرد عبر البوت 🚀"}
                        </button>

                        <AnimatePresence>
                          {supportReplySuccess && (
                            <motion.p
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-[11px] text-emerald-400 font-bold text-center mt-2 animate-pulse"
                            >
                              تم تسليم الرد على التليجرام للمشترك وتأكيده!
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </form>
                    ) : (
                      <div className="py-12 text-center text-slate-500 space-y-2">
                        <MessageSquare className="h-10 w-10 text-slate-800 mx-auto opacity-30 animate-bounce" />
                        <h4 className="text-xs font-bold text-white">لم يتم تحديد رسالة</h4>
                        <p className="text-[11px] leading-relaxed max-w-[180px] mx-auto text-slate-500">
                          اختر رسالة مستخدم من قائمة السجلات للبدء في كتابة رد مخصص يتم ترحيله للتليجرام.
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 4: WEBHOOK & TELEGRAM TOKEN SETTINGS */}
            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8 animate-all"
              >
                <div>
                  <h1 className="text-xl md:text-2xl font-extrabold text-white">إعدادات توكن تليجرام والويب هوك ⚙️</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    قم بربط البوت الخاص بك لمنصة ميدكيت ليتم تفعيله وتشغيله مجاناً 24 ساعة بدون انقطاع وبدون اتصال حاسوبك بالإنترنت.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  
                  {/* Token Configuration Form */}
                  <div className="lg:col-span-2 bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-6">
                    <h3 className="text-base font-bold text-white border-b border-white/5 pb-3">إعداد رموز الأمان وتليجرام</h3>
                    
                    <form onSubmit={saveGlobalSettings} className="space-y-5 text-right">
                      
                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 block font-bold">توكن بوت التليجرام (Telegram Bot Token) *</label>
                        <input
                          type="password"
                          required
                          value={tokenInput}
                          onChange={(e) => setTokenInput(e.target.value)}
                          placeholder="مثال: 568935711335:AAH3m..."
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-600 font-mono text-left focus:outline-none focus:border-cyan-500/50"
                        />
                        <span className="text-[10px] text-slate-500 leading-relaxed block mt-1">
                          توكن مأخوذ من حساب BotFather لتسمية وتلقين البوت.
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 block font-bold">معرف الشات الإداري (Admin Chat ID)</label>
                        <input
                          type="text"
                          value={adminChatIdInput}
                          onChange={(e) => setAdminChatIdInput(e.target.value)}
                          placeholder="مثال: 12345678"
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-slate-200 font-mono text-left focus:outline-none focus:border-cyan-500/50"
                        />
                        <span className="text-[10px] text-slate-500 leading-relaxed block mt-1">
                          قم بوضعه لتصلك تنبيهات طلبات المشتركين الجدد وإيصالاتهم على حسابك التليجرام الخاص بك على الفور!
                        </span>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-slate-400 block font-bold">رسالة الترحيب التلقائية بالبوت (/start)</label>
                        <textarea
                          rows={4}
                          value={welcomeMsgInput}
                          onChange={(e) => setWelcomeMsgInput(e.target.value)}
                          placeholder="اكتب الترحيب للمشترك..."
                          className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-500/50"
                        />
                      </div>

                      <div className="flex items-center gap-4 pt-3 border-t border-white/5">
                        <button
                          type="submit"
                          disabled={savingSettings}
                          className="px-6 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-50 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-lg hover:shadow-cyan-500/10"
                        >
                          {savingSettings ? "جاري الحفظ..." : "حفظ وحماية الإعدادات"}
                        </button>

                        <AnimatePresence>
                          {saveSuccess && (
                            <motion.span 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="text-xs text-emerald-400 font-semibold"
                            >
                              تم حفظ إعدادات الرموز بنجاح!
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>

                    </form>
                  </div>

                  {/* Webhook Connectivity Panel & Tutorial instructions */}
                  <div className="space-y-6">
                    
                    {/* Local Preview Control */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
                        التحكم في المعاينة والمزامنة 🔍
                        <span className="text-[10px] text-slate-400 font-normal bg-white/5 px-2 py-0.5 rounded-lg">ID: {webhookStatus?.instanceId}</span>
                      </h3>
                      
                      <div className="p-4 bg-slate-950 border border-white/5 rounded-xl space-y-4 text-right">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between flex-row-reverse">
                            <span className="text-slate-300 font-bold text-[11px]">حالة استجابة المعاينة:</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${webhookStatus?.isPollingActive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                              {webhookStatus?.isPollingActive ? "Active" : "Stopped"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between flex-row-reverse">
                            <span className="text-slate-300 font-bold text-[11px]">المنصب الحالي:</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${webhookStatus?.masterInstanceId === webhookStatus?.instanceId ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/20" : "bg-slate-800 text-slate-400"}`}>
                              {webhookStatus?.masterInstanceId === webhookStatus?.instanceId ? "MASTER" : "SLAVE"}
                            </span>
                          </div>
                        </div>

                        <p className="text-[10px] text-slate-500 leading-relaxed border-t border-white/5 pt-3">
                          لربط المعاينة (Local) بالنسخة المنشورة ومنع تكرار الرسائل، اجعل إحدى النسخ فقط هي الـ "Master".
                          النسخة المنشورة (ais-pre) هي النسخة الرسمية للمحتوى.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleTogglePolling(webhookStatus?.devPollingEnabled === false)}
                            className={`py-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                              webhookStatus?.devPollingEnabled !== false 
                                ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/15" 
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {webhookStatus?.devPollingEnabled !== false ? "إيقاف الاستجابة ⛔" : "تشغيل الاستجابة ▶️"}
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => handleTogglePolling(true, true)}
                            className={`py-2.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                              webhookStatus?.masterInstanceId === webhookStatus?.instanceId 
                                ? "bg-emerald-500/10 text-emerald-400 cursor-default opacity-50" 
                                : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                            }`}
                            disabled={webhookStatus?.masterInstanceId === webhookStatus?.instanceId}
                          >
                            {webhookStatus?.masterInstanceId === webhookStatus?.instanceId ? "أنت المسيطر حالياً ✅" : "اجعله الاستجابة الوحيدة ⭐"}
                          </button>
                        </div>
                        
                        {/* Instance Registry List */}
                        {webhookStatus?.activeInstances?.length > 1 && (
                          <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                            <h4 className="text-[9px] text-slate-400 font-bold uppercase">النسخ النشطة حالياً:</h4>
                            <div className="space-y-1.5">
                              {webhookStatus.activeInstances.map((inst: any) => (
                                <div key={inst.id} className="flex items-center justify-between flex-row-reverse bg-white/5 px-2 py-1.5 rounded-lg">
                                  <div className="flex items-center gap-2 flex-row-reverse">
                                    <span className={`w-1.5 h-1.5 rounded-full ${Date.now() - inst.lastSeen < 60000 ? "bg-emerald-500" : "bg-amber-500"}`}></span>
                                    <span className="text-[9px] text-slate-300 truncate max-w-[120px]">{inst.url || inst.id} {inst.id === webhookStatus.instanceId && "(أنت)"}</span>
                                  </div>
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${inst.id === webhookStatus.masterInstanceId ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-700 text-slate-500"}`}>
                                    {inst.id === webhookStatus.masterInstanceId ? "MASTER" : "SLAVE"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bot Setup status */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">حالة تشغيل 24 ساعة ⚡</h3>
                      
                      <div className="p-4 bg-slate-950 border border-white/5 rounded-xl space-y-4 text-xs">
                        {webhookStatus?.configured ? (
                          <div className="space-y-3.5 text-right">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              <span className="font-bold text-emerald-400">نشط ومتصل بالخادم</span>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 space-y-1 text-left bg-slate-900/50 p-2 border border-white/5 rounded-lg">
                              <div><strong>Webhook URL:</strong></div>
                              <div className="break-all text-xs text-cyan-400 mt-0.5">{webhookStatus.webhookInfo?.url || "مؤمن بالويب هوك"}</div>
                              <div className="mt-1"><strong>Pending updates:</strong> {webhookStatus.webhookInfo?.pending_update_count || 0}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                              <span className="font-bold text-red-300">غير متصل أو فاقد التنشيط</span>
                            </div>
                            <p className="text-slate-500 text-[11px] leading-relaxed">
                              توكن الأمان غير مهيأ أو لم يتم تشغيل الويب هوك الخاص بك.
                            </p>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={activateBotWebhook}
                        className="w-full py-3.5 bg-gradient-to-l from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-black rounded-xl text-xs transition-shadow shadow-md hover:shadow-cyan-500/15 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className="h-4.5 w-4.5 text-slate-100" />
                        ربط البوت بالويب هوك وتفعيله 🔌
                      </button>

                      {webhookStatus?.configured && webhookStatus.webhookInfo?.url && (
                        <button
                          onClick={removeBotWebhook}
                          className="w-full py-2 bg-slate-950 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-white/5 hover:border-red-500/30 rounded-xl text-[11px] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          إيقاف الويب هوك (للعودة لوضع التطوير المحلي)
                        </button>
                      )}

                      <AnimatePresence>
                        {webhookSettingStatus === "success" && (
                          <motion.p 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-emerald-400 font-semibold text-center mt-2"
                          >
                            تم ربط وتنشيط الويب هوك للبوت الخاص بك بجودة فائقة!
                          </motion.p>
                        )}
                        {webhookSettingStatus === "error" && (
                          <motion.p 
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-400 font-semibold text-center mt-2"
                          >
                            خطأ: {webhookErrorMsg}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Accessibility/Authentication Management Account List */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4 text-right">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                        حسابات إمكانية الوصول للـ Dashboard 🔐
                        <UserCheck className="h-4.5 w-4.5 text-cyan-400" />
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        أضف حسابات بريد Gmail مصرح لها الدخول والتحكم باللوحة وتفعيل الطلبات. الحساب المالك الرئيسي مصرح له دوماً.
                      </p>

                      <form onSubmit={handleAddAllowedEmail} className="flex gap-2.5">
                        <input
                          type="email"
                          required
                          placeholder="user@gmail.com"
                          value={allowedEmailInput}
                          onChange={(e) => setAllowedEmailInput(e.target.value)}
                          className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 font-mono text-left focus:outline-none focus:border-cyan-500/50"
                        />
                        <button
                          type="submit"
                          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </form>

                      {allowedEmailError && (
                        <p className="text-[10px] text-red-400 font-semibold">{allowedEmailError}</p>
                      )}

                      <hr className="border-white/5" />

                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">قائمة الحسابات المضافة</span>
                        {settings?.allowedEmails && settings.allowedEmails.length > 0 ? (
                          <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                            {settings.allowedEmails.map((email) => (
                              <div key={email} className="flex justify-between items-center p-2 bg-slate-950 rounded-xl border border-white/5">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveAllowedEmail(email)}
                                  className="text-red-400/70 hover:text-red-400 transition-colors p-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <span className="font-mono text-xs text-slate-300">{email}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500 italic">لا توجد حسابات فرعية إضافية. المالك فقط لديه الصلاحية حالياً.</p>
                        )}
                      </div>
                    </div>

                    {/* How to get Chat ID tutorials */}
                    <div className="bg-slate-900 border border-white/5 rounded-2xl p-6 space-y-4">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <HelpCircle className="h-4.5 w-4.5 text-cyan-400" />
                        مساعـد تليجرام السريع 🕯️
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        <strong>كيف أحصل على التوكن (Token)؟</strong>
                        <br />
                        ابحث في تليجرام عن الحساب المعتمد <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@BotFather</a>، وأرسل له الأمر <code className="bg-slate-950 px-1 py-0.5 rounded border border-white/5 font-mono text-cyan-400">/newbot</code> ثم اتبع الخطوات وسيمنحك التوكن.
                      </p>
                      <hr className="border-white/5" />
                      <p className="text-xs text-slate-400 leading-relaxed">
                        <strong>كيف أحصل على معرف الشات (Chat ID) الخاص بي؟</strong>
                        <br />
                        ابحث عن حساب <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@userinfobot</a> أو <a href="https://t.me/GetMyID_Bot" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@GetMyID_Bot</a> وأرسل له أي رسالة وسيعطيك رقم المعرف الخاص بك لتقوم بوضعه هنا.
                      </p>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </main>

    </div>
  );
}
