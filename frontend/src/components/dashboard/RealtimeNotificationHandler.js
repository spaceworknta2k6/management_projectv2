'use client';

import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '@/store/auth.store';
import useNotificationStore from '@/store/notification.store';
import { useToast } from '@/components/ui/Toast';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const SOCKET_URL = API_BASE_URL.replace('/api/v1', '');

export default function RealtimeNotificationHandler() {
  const { token, user } = useAuthStore();
  const { addNotification } = useNotificationStore();
  const toast = useToast();

  useEffect(() => {
    if (!token || !user) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('notification:new', (notification) => {
      toast.info(
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'left' }}>
          <strong style={{ fontSize: '13px', color: 'inherit' }}>{notification.title}</strong>
          <span style={{ fontSize: '12px', opacity: 0.9 }}>{notification.body}</span>
        </div>
      );

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav');
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch (soundErr) {
        // Audio is best-effort only; browsers can block it.
      }

      window.dispatchEvent(new CustomEvent('notification:new', { detail: notification }));
      addNotification(notification);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, user, toast, addNotification]);

  return null;
}
