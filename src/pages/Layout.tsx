/**
 * 主布局 — 顶部导航 + 内容区 + 背景动画
 */
import { Outlet } from 'react-router-dom';
import { TopNav } from '@/components/TopNav';
import { WaveBackground } from '@/components/WaveBackground';
import { ToastContainer } from '@/components/Toast';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <WaveBackground />
      <TopNav />
      <ToastContainer />
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
      <footer className="px-4 sm:px-6 py-4 border-t border-white/5 text-center text-[11px] text-white/30 font-mono">
        VoiceForge · 声音克隆工作台 · 演示版 · AI 引擎为 Mock 模拟,可插拔替换为真实服务
      </footer>
    </div>
  );
}
