import { useEffect, useState } from "react";
import { ExternalLink, Clock, Bot, Sparkles } from "lucide-react";

interface HeaderProps {
  activeTab: "overview" | "tickets" | "menus" | "support" | "settings";
  webhookStatus: any;
}

export default function Header({ activeTab, webhookStatus }: HeaderProps) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTitle = () => {
    switch (activeTab) {
      case "overview": return "لوحة التحكم العامة 📊";
      case "menus": return "إدارة باقات الاشتراك 💳";
      case "tickets": return "طلبات كودات التفعيل 🎟️";
      case "support": return "محادثات الدعم الفني 💬";
      case "settings": return "المزامنة والإعدادات السحابية ⚙️";
      default: return "الرئيسية";
    }
  };

  const botUsername = webhookStatus?.botUser?.username;
  const botLink = botUsername ? `https://t.me/${botUsername}` : "#";

  return (
    <header className="h-20 border-b border-white/[0.06] px-6 sm:px-8 flex items-center justify-between bg-zinc-900/10 backdrop-blur-md relative z-10" dir="rtl">
      {/* Decorative subtle background light */}
      <div className="absolute top-0 left-0 w-80 h-10 bg-violet-500/[0.02] blur-xl pointer-events-none" />

      {/* Title */}
      <div className="text-right">
        <h1 className="text-sm sm:text-base font-black text-white tracking-wide flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-violet-400" />
          {getTitle()}
        </h1>
      </div>

      {/* Right-aligned Stats / Quick Actions */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Arabized live clock */}
        <div className="hidden sm:flex items-center gap-2 bg-zinc-950 border border-white/5 px-3 py-1.5 rounded-xl text-zinc-400 text-xs font-bold shadow-inner font-mono">
          <Clock className="h-3.5 w-3.5 text-violet-500" />
          <span>{time}</span>
        </div>

        {/* Live Bot URL link */}
        <a 
          href={botLink} 
          target="_blank" 
          rel="noreferrer" 
          className="bg-violet-500/10 border border-violet-500/20 hover:border-violet-500/40 text-violet-400 hover:text-violet-300 px-4 py-2 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 cursor-pointer shadow-lg shadow-violet-500/[0.03]"
        >
          <Bot className="h-3.5 w-3.5" />
          <span>رابط البوت المباشر</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </header>
  );
}
