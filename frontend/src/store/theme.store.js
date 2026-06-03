import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // 'dark' | 'light'
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        document.documentElement.setAttribute('data-theme', next);
      },
      applyTheme: () => {
        document.documentElement.setAttribute('data-theme', get().theme);
      },
    }),
    { name: 'episteme-theme' }
  )
);

export default useThemeStore;
