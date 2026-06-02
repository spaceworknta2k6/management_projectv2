'use client';

import { create } from 'zustand';
import Cookies from 'js-cookie';

const COOKIE_KEY = 'episteme_token';

const useAuthStore = create((set) => ({
  token: null,
  user: null,       // { _id, email, role, studentId?, lecturerId? }
  isLoading: true,

  // Called on app boot to restore session from cookie
  hydrate: () => {
    const token = Cookies.get(COOKIE_KEY) || null;
    set({ token, isLoading: false });
  },

  setAuth: (token, user) => {
    Cookies.set(COOKIE_KEY, token, { expires: 7, sameSite: 'strict' });
    set({ token, user });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    Cookies.remove(COOKIE_KEY);
    set({ token: null, user: null });
  },
}));

export default useAuthStore;
