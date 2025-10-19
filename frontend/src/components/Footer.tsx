const Footer = () => (
  <footer className="border-t border-slate-200 bg-white/80 backdrop-blur">
    <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-4 text-center text-sm text-slate-500 sm:px-6 sm:flex-row sm:justify-between">
      <p>© {new Date().getFullYear()} LeetCode Automation</p>
      <p className="text-xs sm:text-sm">Built with Vite, React, and Tailwind CSS.</p>
    </div>
  </footer>
);

export default Footer;
