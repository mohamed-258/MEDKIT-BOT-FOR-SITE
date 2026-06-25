import { 
  Bot, LayoutDashboard, Ticket, Settings, MenuSquare, MessageSquare, LogOut, ShieldCheck 
} from "lucide-react";

interface SidebarProps {
  activeTab: "overview" | "tickets" | "menus" | "support" | "settings";
  setActiveTab: (tab: "overview" | "tickets" | "menus" | "support" | "settings") => void;
  pendingCount: number;
  menusCount: number;
  unreadSupportCount: number;
  webhookStatus: any;
  handleLogout: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingCount,
  menusCount,
  unreadSupportCount,
  webhookStatus,
  handleLogout
}: SidebarProps) {
  const isWebhookActive = webhookStatus?.configured;

  return (
    <aside className="w-full md:w-80 bg-zinc-900/60 backdrop-blur-xl border-l border-white/[0.06] flex flex-col justify-between shrink-0 relative z-20" dir="rtl">
      {/* Decorative Light Glow inside Sidebar */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
      
      <div>
        {/* Brand Section */}
        <div className="p-6 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-violet-500/10 to-indigo-500/10 border border-violet-500/20 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/5">
              <Bot className="h-5.5 w-5.5 text-violet-400 animate-pulse" />
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-black text-white tracking-wide">لوحة MedKit 🛡️</h2>
                <ShieldCheck className="h-4 w-4 text-violet-400" />
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`w-2 h-2 rounded-full ${isWebhookActive ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`}></span>
                <span className="text-[10px] font-bold text-zinc-400">
                  {isWebhookActive ? "البوت متصل بالكامل" : "طريقة الاستعلام (Polling)"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="p-4 space-y-1.5">
          {/* Overview */}
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between cursor-pointer group ${
              activeTab === "overview" 
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/25 shadow-md shadow-violet-500/5" 
                : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${activeTab === "overview" ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
              <span>لوحة القيادة والمؤشرات</span>
            </div>
          </button>

          {/* Subscription Menus */}
          <button
            onClick={() => setActiveTab("menus")}
            className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between cursor-pointer group ${
              activeTab === "menus" 
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/25 shadow-md shadow-violet-500/5" 
                : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3">
              <MenuSquare className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${activeTab === "menus" ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
              <span>عروض باقات الاشتراك</span>
            </div>
            <span className="text-[9px] font-mono bg-zinc-950 px-2 py-0.5 rounded-full border border-white/5 text-zinc-400 font-extrabold shadow-sm">
              {menusCount}
            </span>
          </button>

          {/* Tickets */}
          <button
            onClick={() => setActiveTab("tickets")}
            className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between cursor-pointer group ${
              activeTab === "tickets" 
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/25 shadow-md shadow-violet-500/5" 
                : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Ticket className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${activeTab === "tickets" ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
              <span>طلبات التفعيل والكودات</span>
            </div>
            {pendingCount > 0 && (
              <span className="text-[9px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-extrabold animate-pulse shadow-sm">
                {pendingCount} معلق
              </span>
            )}
          </button>

          {/* Support Chats */}
          <button
            onClick={() => setActiveTab("support")}
            className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between cursor-pointer group ${
              activeTab === "support" 
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/25 shadow-md shadow-violet-500/5" 
                : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3">
              <MessageSquare className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${activeTab === "support" ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
              <span>محادثات الدعم الفني</span>
            </div>
            {unreadSupportCount > 0 && (
              <span className="text-[9px] bg-violet-500/10 text-violet-400 px-2 py-0.5 rounded-full border border-violet-500/20 font-extrabold shadow-sm">
                {unreadSupportCount} غير مقروء
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full text-right px-4 py-3.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-between cursor-pointer group ${
              activeTab === "settings" 
                ? "bg-violet-500/10 text-violet-400 border border-violet-500/25 shadow-md shadow-violet-500/5" 
                : "text-zinc-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className={`h-4.5 w-4.5 transition-transform duration-300 group-hover:scale-110 ${activeTab === "settings" ? "text-violet-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
              <span>الإعدادات والمزامنة</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Sidebar Footer with user session and log-out */}
      <div className="p-4 border-t border-white/[0.06] space-y-4 bg-zinc-950/20">
        <div className="flex items-center justify-between text-xs px-2 flex-row-reverse">
          <span className="text-[10px] text-zinc-500 font-bold">صلاحية الوصول</span>
          <span className="font-mono text-[9px] bg-violet-500/5 border border-violet-500/10 text-violet-400 px-2 py-0.5 rounded-lg font-bold">مدير اللوحة</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-zinc-950 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 border border-white/5 hover:border-rose-500/20 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-sm animate-pulse-slow"
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج الآمن
        </button>
      </div>
    </aside>
  );
}
