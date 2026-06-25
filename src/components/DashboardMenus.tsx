import { motion } from "motion/react";
import { Plus, Edit2, Trash2, CheckCircle, Gift, Sparkles, AlertCircle } from "lucide-react";
import { Menu } from "../types";

interface DashboardMenusProps {
  menus: Menu[];
  onAddMenu: () => void;
  onEditMenu: (menu: Menu) => void;
  onDeleteMenu: (id: string) => void;
  menuActionStatus: "idle" | "success" | "error";
  menuActionMessage: string;
}

export default function DashboardMenus({
  menus,
  onAddMenu,
  onEditMenu,
  onDeleteMenu,
  menuActionStatus,
  menuActionMessage,
}: DashboardMenusProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 text-right font-sans"
    >
      {/* Header and Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] p-5 rounded-2xl">
        <div className="space-y-0.5">
          <h2 className="text-base font-black text-white">الباقات والاشتراكات المتاحة على البوت 💳</h2>
          <p className="text-xs text-zinc-400">تحكّم في خطط الأسعار والتعليمات التي تظهر للمستخدمين لتسهيل الدفع والتفعيل التلقائي.</p>
        </div>
        <button
          onClick={onAddMenu}
          className="py-2.5 px-5 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black rounded-xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-violet-500/15 shrink-0"
        >
          <Plus className="h-4 w-4" />
          إضافة باقة اشتراك جديدة
        </button>
      </div>

      {/* Action Feedbacks */}
      {menuActionStatus !== "idle" && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className={`p-4 rounded-xl text-xs flex items-center gap-2 flex-row-reverse border ${
            menuActionStatus === "success" 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          {menuActionStatus === "success" ? <CheckCircle className="h-4.5 w-4.5 shrink-0" /> : <AlertCircle className="h-4.5 w-4.5 shrink-0" />}
          <span className="font-medium">{menuActionMessage}</span>
        </motion.div>
      )}

      {/* Packages Grid */}
      {menus.length === 0 ? (
        <div className="py-20 bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-4">
          <Gift className="h-12 w-12 text-zinc-700 animate-bounce" />
          <p className="text-sm font-semibold">لم يتم إنشاء أي باقات اشتراك بعد.</p>
          <button
            onClick={onAddMenu}
            className="text-xs text-violet-400 hover:text-violet-300 underline font-bold cursor-pointer"
          >
            اضغط هنا لإنشاء أول باقة اشتراك للبوت الخاص بك
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menus.map((menu, idx) => {
            // Determine some color themes visually based on index to look spectacular
            const themes = [
              { border: "hover:border-violet-500/30", glow: "bg-violet-500/5", accent: "text-violet-400", bgAccent: "bg-violet-500/10" },
              { border: "hover:border-cyan-500/30", glow: "bg-cyan-500/5", accent: "text-cyan-400", bgAccent: "bg-cyan-500/10" },
              { border: "hover:border-emerald-500/30", glow: "bg-emerald-500/5", accent: "text-emerald-400", bgAccent: "bg-emerald-500/10" },
            ];
            const theme = themes[idx % themes.length];

            return (
              <motion.div
                key={menu.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`group relative overflow-hidden rounded-2xl bg-zinc-900/60 backdrop-blur-xl border border-white/[0.06] ${theme.border} p-6 flex flex-col justify-between space-y-6 transition-all duration-300`}
              >
                {/* Visual glowing spotlight */}
                <div className={`absolute -right-12 -top-12 w-32 h-32 ${theme.glow} rounded-full blur-3xl group-hover:scale-125 transition-transform duration-500`} />

                {/* Package header */}
                <div className="space-y-4 z-10 relative">
                  <div className="flex items-start justify-between">
                    <span className={`text-[10px] font-mono tracking-wider font-extrabold uppercase px-2.5 py-1 ${theme.bgAccent} ${theme.accent} rounded-lg border border-white/5`}>
                      ID: {menu.id}
                    </span>
                    <Sparkles className={`h-4.5 w-4.5 ${theme.accent} opacity-50`} />
                  </div>

                  <div className="space-y-1">
                    <h3 className="font-black text-white text-lg group-hover:text-violet-300 transition-colors">{menu.title}</h3>
                    {menu.description && (
                      <p className="text-xs text-zinc-400 leading-relaxed min-h-[32px] line-clamp-2">{menu.description}</p>
                    )}
                  </div>

                  {/* Pricing tag */}
                  <div className="py-4 border-y border-white/5 flex items-center justify-between flex-row-reverse">
                    <span className="text-zinc-500 text-xs">سعر تفعيل الباقة</span>
                    <span className="text-2xl font-black text-white font-mono tracking-tight">{menu.price}</span>
                  </div>

                  {/* Quick Feature highlights */}
                  <div className="space-y-2 pt-2 text-xs text-zinc-300">
                    <div className="flex items-center gap-2 justify-end">
                      <span>دعم الدفع الفوري الآمن</span>
                      <CheckCircle className={`h-3.5 w-3.5 ${theme.accent}`} />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span>إرسال لقطات الإيصال للإدارة</span>
                      <CheckCircle className={`h-3.5 w-3.5 ${theme.accent}`} />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <span>تفعيل فوري للكود وتنبيه تليجرام</span>
                      <CheckCircle className={`h-3.5 w-3.5 ${theme.accent}`} />
                    </div>
                  </div>
                </div>

                {/* Action controls */}
                <div className="flex items-center gap-2 z-10 pt-4 border-t border-white/5">
                  <button
                    onClick={() => onEditMenu(menu)}
                    className="flex-1 py-2 bg-zinc-950 hover:bg-zinc-900 border border-white/5 hover:border-violet-500/20 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    تعديل الباقة
                  </button>
                  
                  <button
                    onClick={() => onDeleteMenu(menu.id)}
                    className="py-2 px-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/20 text-rose-400 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                    title="حذف الباقة"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
