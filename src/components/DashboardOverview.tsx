import { motion } from "motion/react";
import { 
  Clock, CheckCircle2, Ticket, MenuSquare, ChevronLeft, Check, 
  Settings, Database, Bot, RefreshCw
} from "lucide-react";
import { Ticket as TicketType } from "../types";

interface DashboardOverviewProps {
  pendingCount: number;
  approvedCount: number;
  totalCount: number;
  menusCount: number;
  tickets: TicketType[];
  onSelectTicket: (ticket: TicketType) => void;
  setActiveTab: (tab: "overview" | "tickets" | "menus" | "support" | "settings") => void;
  railwayUrl: string;
  syncToken: string;
  webhookStatus: any;
  activateBotWebhook: () => void;
}

export default function DashboardOverview({
  pendingCount,
  approvedCount,
  totalCount,
  menusCount,
  tickets,
  onSelectTicket,
  setActiveTab,
  railwayUrl,
  syncToken,
  webhookStatus,
  activateBotWebhook,
}: DashboardOverviewProps) {
  // Simple calculations
  const rejectedCount = totalCount - approvedCount - pendingCount;
  const approvedPercent = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;
  const pendingPercent = totalCount > 0 ? (pendingCount / totalCount) * 100 : 0;
  const rejectedPercent = totalCount > 0 ? (Math.max(0, rejectedCount) / totalCount) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="space-y-8 text-right font-sans"
    >
      {/* 4 Premium Stat Cards with Hover Glow Underlay */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Card 1: Pending */}
        <div className="relative group overflow-hidden rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] hover:border-amber-500/30 p-6 flex items-center justify-between transition-all duration-300">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all duration-300" />
          <div className="space-y-1 z-10">
            <p className="text-xs text-zinc-400 font-medium">طلبات بانتظار المراجعة</p>
            <p className="text-3xl font-black text-amber-400 font-mono tracking-tight">{pendingCount}</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl z-10 border border-amber-500/20 group-hover:scale-110 transition-transform duration-300">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Card 2: Approved */}
        <div className="relative group overflow-hidden rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] hover:border-emerald-500/30 p-6 flex items-center justify-between transition-all duration-300">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all duration-300" />
          <div className="space-y-1 z-10">
            <p className="text-xs text-zinc-400 font-medium">الاشتراكات المفعّلة</p>
            <p className="text-3xl font-black text-emerald-400 font-mono tracking-tight">{approvedCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl z-10 border border-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Card 3: Total */}
        <div className="relative group overflow-hidden rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] hover:border-indigo-500/30 p-6 flex items-center justify-between transition-all duration-300">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-300" />
          <div className="space-y-1 z-10">
            <p className="text-xs text-zinc-400 font-medium">إجمالي الطلبات المستلمة</p>
            <p className="text-3xl font-black text-zinc-100 font-mono tracking-tight">{totalCount}</p>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl z-10 border border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
            <Ticket className="h-5 w-5" />
          </div>
        </div>

        {/* Card 4: Packages */}
        <div className="relative group overflow-hidden rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] hover:border-violet-500/30 p-6 flex items-center justify-between transition-all duration-300">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl group-hover:bg-violet-500/10 transition-all duration-300" />
          <div className="space-y-1 z-10">
            <p className="text-xs text-zinc-400 font-medium">باقات الاشتراك النشطة</p>
            <p className="text-3xl font-black text-violet-400 font-mono tracking-tight">{menusCount}</p>
          </div>
          <div className="p-3 bg-violet-500/10 text-violet-400 rounded-xl z-10 border border-violet-500/20 group-hover:scale-110 transition-transform duration-300">
            <MenuSquare className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* Grid: Trends Visualizer & Recent Tickets feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Pending Tickets & Visual Status Charts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Custom Pure-CSS Statistics Visualizer */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between flex-row-reverse">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                مؤشرات أداء الاشتراكات ونسب المعالجة 📊
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">Real-time status metrics</span>
            </div>

            <div className="space-y-4">
              {/* Progress 1: Approved */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs flex-row-reverse">
                  <span className="font-bold text-emerald-400">{approvedPercent.toFixed(1)}% ({approvedCount} طلب)</span>
                  <span className="text-zinc-400">الطلبات المقبولة والمفعّلة</span>
                </div>
                <div className="h-2 bg-zinc-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-l from-emerald-500 to-teal-400 rounded-full transition-all duration-1000" 
                    style={{ width: `${approvedPercent || 2}%` }}
                  />
                </div>
              </div>

              {/* Progress 2: Pending */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs flex-row-reverse">
                  <span className="font-bold text-amber-400">{pendingPercent.toFixed(1)}% ({pendingCount} طلب)</span>
                  <span className="text-zinc-400">الطلبات المعلقة بانتظار التحقق</span>
                </div>
                <div className="h-2 bg-zinc-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-l from-amber-500 to-orange-400 rounded-full transition-all duration-1000" 
                    style={{ width: `${pendingPercent || 2}%` }}
                  />
                </div>
              </div>

              {/* Progress 3: Rejected */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs flex-row-reverse">
                  <span className="font-bold text-rose-400">{rejectedPercent.toFixed(1)}% ({Math.max(0, rejectedCount)} طلب)</span>
                  <span className="text-zinc-400">الطلبات المرفوضة</span>
                </div>
                <div className="h-2 bg-zinc-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-l from-rose-500 to-red-400 rounded-full transition-all duration-1000" 
                    style={{ width: `${rejectedPercent || 2}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Pending Tickets feed */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-row-reverse">
              <button
                onClick={() => setActiveTab("tickets")}
                className="text-xs font-bold text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
              >
                عرض كافة الطلبات
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Ticket className="h-4.5 w-4.5 text-violet-400" />
                آخر طلبات الأكواد المعلقة 🎟️
              </h3>
            </div>

            {tickets.filter(t => t.status === "new").length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-3 border border-dashed border-white/5 rounded-xl">
                <Check className="h-10 w-10 text-emerald-500/20 p-2.5 bg-emerald-500/10 rounded-full animate-pulse" />
                <p className="text-xs font-medium">رائع! لا توجد طلبات اشتراك معلقة بانتظارك حالياً.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {tickets.filter(t => t.status === "new").slice(0, 4).map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => {
                      onSelectTicket(ticket);
                      setActiveTab("tickets");
                    }}
                    className="py-3.5 flex items-center justify-between hover:bg-white/[0.02] px-3 -mx-3 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(ticket.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                      <ChevronLeft className="h-4 w-4 text-zinc-600" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-xs text-white">{ticket.telegramName}</p>
                      <div className="flex items-center gap-2.5 text-[11px] text-zinc-400 justify-end">
                        <span className="text-violet-400 font-medium">{ticket.menuTitle}</span>
                        <span className="text-zinc-700">•</span>
                        <span className="font-mono text-zinc-500">{ticket.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Server Integrations Overview */}
        <div className="space-y-6">
          
          {/* Railway Sync Overview */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 justify-end">
              مزامنة السيرفر السحابي 🔁
              <Database className="h-4 w-4 text-violet-400" />
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              تساعدك المزامنة في نسخ وحماية بيانات باقات الاشتراك وطلبات الأكواد لتشغيلها سحابياً على Railway دون انقطاع.
            </p>

            <div className="pt-3 border-t border-white/5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-zinc-300 max-w-[140px] truncate block">
                  {railwayUrl ? railwayUrl.replace("https://", "") : "غير مبرمج"}
                </span>
                <span className="text-zinc-500">عنوان Railway:</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className={`font-bold ${syncToken ? "text-violet-400" : "text-amber-500"}`}>
                  {syncToken ? "🔑 جاهز وموثق" : "⚠️ بحاجة لتوكن"}
                </span>
                <span className="text-zinc-500">مفتاح المصادقة:</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab("settings")}
              className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-900 text-violet-400 hover:text-violet-300 border border-violet-500/10 hover:border-violet-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Settings className="h-4 w-4" />
              الذهاب لإعدادات المزامنة
            </button>
          </div>

          {/* Webhook Connection Card */}
          <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 justify-end">
              حالة اتصال البوت بالتلجرام 🤖
              <Bot className="h-4 w-4 text-violet-400" />
            </h3>

            <div className="p-3 bg-zinc-950 rounded-xl text-xs flex items-center justify-between border border-white/5">
              <span className={`w-2 h-2 rounded-full ${webhookStatus?.configured ? "bg-emerald-500 animate-pulse" : "bg-amber-500 animate-pulse"}`}></span>
              <span className="font-bold text-zinc-300">
                {webhookStatus?.configured ? "الويب هوك السحابي نشط" : "طريقة الاستطلاع (Polling)"}
              </span>
            </div>

            <button
              onClick={activateBotWebhook}
              className="w-full py-2.5 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-500/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              تحديث/تنشيط اتصال الويب هوك
            </button>
          </div>

        </div>

      </div>
    </motion.div>
  );
}
