'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowsClockwise,
  ChatsCircle,
  DownloadSimple,
  DotsThreeVertical,
  File,
  ImageSquare,
  Info,
  MagnifyingGlass,
  Paperclip,
  PaperPlaneTilt,
  PencilSimple,
  Smiley,
  Trash,
  X,
  UserCheck,
  UserPlus,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import api from '@/services/api';
import useAuthStore from '@/store/auth.store';
import { getAvatarUrl } from '@/lib/avatar';
import { formatDateTime } from '@/lib/utils';
import css from './page.module.css';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const SOCKET_URL = API_BASE_URL.replace('/api/v1', '');
const DEFAULT_GROUP_AVATAR_URL = process.env.NEXT_PUBLIC_DEFAULT_GROUP_AVATAR_URL || 'https://cdn-icons-png.flaticon.com/512/166/166258.png';
const CHAT_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '👏', '🔥', '✅', '📌', '💡', '👀', '🚀'];
const CHAT_ATTACHMENT_LIMIT = 30 * 1024 * 1024;

function getId(value) {
  return String(value?._id || value?.id || value || '');
}

function getSenderName(message) {
  return message.senderId?.fullName || message.senderId?.email || 'Người dùng';
}

function getRoomDisplayName(room, user) {
  if (!room) return 'Chọn phòng chat';
  if (room.type === 'direct') {
    const otherMember = (room.memberIds || []).find((member) => getId(member) !== getId(user));
    return otherMember?.fullName || otherMember?.email || 'Chat riêng';
  }
  return room.name;
}

function getGroupAvatarUrl(room) {
  return room?.groupId?.avatarUrl || DEFAULT_GROUP_AVATAR_URL;
}

function getRoomAvatarStyle(room, user) {
  if (room?.type === 'group') {
    return { backgroundImage: `url("${getGroupAvatarUrl(room)}")` };
  }
  const otherMember = (room?.memberIds || []).find((member) => getId(member) !== getId(user));
  return getUserAvatarStyle(otherMember);
}

function getUserAvatarStyle(userLike) {
  return { backgroundImage: `url("${getAvatarUrl(userLike?.avatarUrl)}")` };
}

function getPendingGroupInvite(room, user) {
  if (room?.type !== 'group') return null;
  return (room.groupTeacherInvites || []).find(
    (invite) => getId(invite.lecturerUserId) === getId(user) && invite.status === 'pending'
  );
}

function getAttachmentLabel(message) {
  const firstAttachment = message?.attachments?.[0];
  if (!firstAttachment) return 'Chưa có tin nhắn';
  return firstAttachment.kind === 'image' ? 'Đã gửi một ảnh' : `Đã gửi tệp ${firstAttachment.originalName || ''}`.trim();
}

function getLatestMessageText(message) {
  if (!message) return 'Chưa có tin nhắn';
  return message.body || getAttachmentLabel(message);
}

function formatFileSize(size) {
  const value = Number(size) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function getAttachmentId(attachment) {
  return getId(attachment?.fileId) || getId(attachment);
}

function MessageAttachment({ attachment, token, onDownload, onPreview }) {
  const [imageUrl, setImageUrl] = useState('');
  const isImage = attachment.kind === 'image';
  const fileId = getAttachmentId(attachment);

  useEffect(() => {
    if (!isImage || !fileId || !token) return undefined;

    let cancelled = false;
    const loadImageUrl = async () => {
      try {
        const res = await api.get(`/files/${fileId}/download-url`, token);
        let nextUrl = res.data?.downloadUrl || '';
        if (nextUrl.startsWith('/')) {
          nextUrl = `${SOCKET_URL}${nextUrl}`;
        }
        if (!cancelled) setImageUrl(nextUrl);
      } catch {
        if (!cancelled) setImageUrl('');
      }
    };

    loadImageUrl();
    return () => {
      cancelled = true;
    };
  }, [fileId, isImage, token]);

  return (
    <div className={isImage ? css.imageAttachment : css.fileAttachment}>
      {isImage && imageUrl ? (
        <button
          type="button"
          className={css.imagePreviewButton}
          style={{ backgroundImage: `url("${imageUrl}")` }}
          onClick={() => onPreview({ url: imageUrl, name: attachment.originalName || 'Ảnh đính kèm', fileId })}
          aria-label={attachment.originalName || 'Ảnh đính kèm'}
        />
      ) : (
        <span className={css.fileIcon}>
          {isImage ? <ImageSquare size={20} /> : <File size={20} />}
        </span>
      )}
      <button type="button" className={css.fileInfo} onClick={() => onDownload(fileId)}>
        <strong>{attachment.originalName || 'Tệp đính kèm'}</strong>
        <span>{formatFileSize(attachment.size)}</span>
      </button>
      <Button
        variant="ghost"
        size="sm"
        title="Tải xuống"
        onClick={() => onDownload(fileId)}
        icon={<DownloadSimple size={15} />}
      />
    </div>
  );
}

export default function ChatPage() {
  const { token, user } = useAuthStore();
  const toast = useToast();
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const selectedRoomIdRef = useRef('');
  const previousRoomIdRef = useRef('');
  const currentUserIdRef = useRef('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [deletingMessageId, setDeletingMessageId] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [lecturers, setLecturers] = useState([]);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [configMode, setConfigMode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupAvatarFile, setGroupAvatarFile] = useState(null);
  const [selectedLecturerUserId, setSelectedLecturerUserId] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => getId(room) === selectedRoomId),
    [rooms, selectedRoomId]
  );
  const selectedRoomTitle = getRoomDisplayName(selectedRoom, user);
  const pendingGroupInvite = getPendingGroupInvite(selectedRoom, user);
  const isPendingDirect = selectedRoom?.type === 'direct' && selectedRoom.status === 'pending';
  const canAcceptDirect = isPendingDirect && getId(selectedRoom?.requestedBy) !== getId(user);
  const canAcceptGroup = Boolean(pendingGroupInvite);
  const canSend = Boolean(selectedRoomId) && !isPendingDirect && !pendingGroupInvite;
  const isUploadingAttachment = sending && Boolean(attachmentFile);
  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => {
      const body = String(message.body || '').toLowerCase();
      const attachmentNames = (message.attachments || [])
        .map((attachment) => attachment.originalName || '')
        .join(' ')
        .toLowerCase();
      return body.includes(query) || attachmentNames.includes(query);
    });
  }, [messages, searchQuery]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    currentUserIdRef.current = getId(user);
  }, [user]);

  const updateRoom = (nextRoom) => {
    setRooms((prev) => prev.map((room) => (getId(room) === getId(nextRoom) ? nextRoom : room)));
  };

  const markRoomRead = useCallback(async (roomId) => {
    if (!token || !roomId) return;
    try {
      await api.post(`/chat/rooms/${roomId}/read`, {}, token);
      setRooms((prev) => prev.map((room) => (
        getId(room) === getId(roomId) ? { ...room, unreadCount: 0 } : room
      )));
    } catch {
      // Read receipts are best-effort and should not interrupt chat.
    }
  }, [token]);

  const appendMessage = useCallback((message, { incrementUnread = false } = {}) => {
    setMessages((prev) => {
      if (prev.some((item) => getId(item) === getId(message))) return prev;
      return [...prev, message];
    });
    setRooms((prev) =>
      prev.map((room) =>
        getId(room) === getId(message.roomId)
          ? {
              ...room,
              latestMessage: message,
              lastMessageAt: message.createdAt,
              unreadCount: incrementUnread ? (Number(room.unreadCount) || 0) + 1 : room.unreadCount,
            }
          : room
      )
    );
  }, []);

  const fetchRooms = useCallback(async () => {
    if (!token) return;
    setRoomsLoading(true);
    try {
      const res = await api.get('/chat/rooms', token);
      const nextRooms = res.data || [];
      setRooms(nextRooms);
      setSelectedRoomId((current) => current || getId(nextRooms[0]) || '');
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách phòng chat.');
    } finally {
      setRoomsLoading(false);
    }
  }, [toast, token]);

  const fetchMessages = useCallback(async (roomId) => {
    if (!token || !roomId) return;
    setMessagesLoading(true);
    try {
      const res = await api.get(`/chat/rooms/${roomId}/messages`, token);
      const nextMessages = res.data || [];
      setMessages(nextMessages);
      setHasOlderMessages(nextMessages.length >= 50);
      markRoomRead(roomId);
    } catch (err) {
      toast.error(err.message || 'Không thể tải tin nhắn.');
    } finally {
      setMessagesLoading(false);
    }
  }, [markRoomRead, toast, token]);

  const loadOlderMessages = useCallback(async () => {
    if (!token || !selectedRoomId || olderLoading || messages.length === 0) return;
    setOlderLoading(true);
    try {
      const before = encodeURIComponent(messages[0].createdAt);
      const res = await api.get(`/chat/rooms/${selectedRoomId}/messages?before=${before}`, token);
      const olderMessages = res.data || [];
      setMessages((prev) => {
        const seen = new Set(prev.map((message) => getId(message)));
        return [...olderMessages.filter((message) => !seen.has(getId(message))), ...prev];
      });
      setHasOlderMessages(olderMessages.length >= 50);
    } catch (err) {
      toast.error(err.message || 'Không thể tải tin nhắn cũ.');
    } finally {
      setOlderLoading(false);
    }
  }, [messages, olderLoading, selectedRoomId, toast, token]);

  const fetchLecturers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/auth/lecturers', token);
      setLecturers(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải danh sách giảng viên.');
    }
  }, [toast, token]);

  useEffect(() => {
    fetchRooms();
    fetchLecturers();
  }, [fetchLecturers, fetchRooms]);

  useEffect(() => {
    if (typeof window === 'undefined' || rooms.length === 0) return;
    const roomId = new URLSearchParams(window.location.search).get('room');
    if (roomId && rooms.some((room) => getId(room) === roomId)) {
      setSelectedRoomId(roomId);
    }
  }, [rooms]);

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect_error', () => {
      toast.error('Không thể kết nối chat realtime.');
    });

    socket.on('chat:message', (message) => {
      setTypingUsers((prev) => prev.filter((item) => getId(item) !== getId(message.senderId)));
      const isCurrentRoom = getId(message.roomId) === selectedRoomIdRef.current;
      const isMine = getId(message.senderId) === currentUserIdRef.current;
      appendMessage(message, { incrementUnread: !isCurrentRoom && !isMine });
      if (isCurrentRoom && !isMine) {
        markRoomRead(message.roomId);
      }
    });

    socket.on('chat:message-deleted', ({ roomId, messageId }) => {
      setMessages((prev) => prev.filter((message) => getId(message) !== getId(messageId)));
      setRooms((prev) => prev.map((room) => (
        getId(room) === getId(roomId) && getId(room.latestMessage) === getId(messageId)
          ? { ...room, latestMessage: null }
          : room
      )));
    });

    socket.on('chat:typing', ({ roomId, isTyping, user: typingUser }) => {
      if (getId(roomId) !== selectedRoomIdRef.current || getId(typingUser) === currentUserIdRef.current) return;
      setTypingUsers((prev) => {
        const next = prev.filter((item) => getId(item) !== getId(typingUser));
        return isTyping ? [...next, typingUser] : next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [appendMessage, markRoomRead, toast, token]);

  useEffect(() => {
    if (!selectedRoomId) {
      setMessages([]);
      setTypingUsers([]);
      return undefined;
    }

    setTypingUsers([]);
    fetchMessages(selectedRoomId);
    const socket = socketRef.current;
    socket?.emit('chat:join', { roomId: selectedRoomId }, (ack) => {
      if (ack && !ack.success) {
        toast.error(ack.message || 'Không thể tham gia phòng chat.');
      }
    });

    return () => {
      socket?.emit('chat:typing', { roomId: selectedRoomId, isTyping: false });
      socket?.emit('chat:leave', { roomId: selectedRoomId });
    };
  }, [fetchMessages, selectedRoomId, toast]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConfig = (mode) => {
    setGroupMenuOpen(false);
    setConfigMode(mode);
    setGroupName(selectedRoom?.name || '');
    setGroupAvatarFile(null);
    setSelectedLecturerUserId('');
  };

  const clearAttachment = () => {
    setAttachmentFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  useEffect(() => {
    if (!selectedRoomId) return;
    if (!previousRoomIdRef.current) {
      previousRoomIdRef.current = selectedRoomId;
      return;
    }
    if (previousRoomIdRef.current === selectedRoomId || isUploadingAttachment) return;

    clearAttachment();
    setDraft('');
    setEmojiOpen(false);
    setSearchQuery('');
    previousRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId, isUploadingAttachment]);

  const handleSelectRoom = (roomId) => {
    if (isUploadingAttachment) {
      toast.error('Vui lòng chờ tệp tải lên xong trước khi đổi phòng chat.');
      return;
    }
    if (roomId === selectedRoomId) return;
    clearAttachment();
    setDraft('');
    setEmojiOpen(false);
    setSelectedRoomId(roomId);
    setSearchQuery('');
  };

  const selectAttachment = (file, imageOnly = false) => {
    if (!file) return;
    if (file.size > CHAT_ATTACHMENT_LIMIT) {
      toast.error('Tệp gửi trong chat không được vượt quá 30MB.');
      clearAttachment();
      return;
    }
    if (imageOnly && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Ảnh chat chỉ hỗ trợ JPG, PNG hoặc WEBP.');
      clearAttachment();
      return;
    }
    setAttachmentFile(file);
  };

  const handleDownloadAttachment = async (fileId) => {
    if (!fileId) return;
    try {
      const res = await api.get(`/files/${fileId}/download-url`, token);
      let downloadUrl = res.data?.downloadUrl;
      if (downloadUrl?.startsWith('/')) {
        downloadUrl = `${SOCKET_URL}${downloadUrl}`;
      }
      window.open(downloadUrl || `${SOCKET_URL}/api/v1/files/${fileId}/download`, '_blank');
    } catch (err) {
      toast.error(err.message || 'Không thể tải tệp đính kèm.');
    }
  };

  const handleDeleteMessage = async (message) => {
    const messageId = getId(message);
    if (!selectedRoomId || !messageId || deletingMessageId) return;

    setDeletingMessageId(messageId);
    try {
      await api.delete(`/chat/rooms/${selectedRoomId}/messages/${messageId}`, token);
      setMessages((prev) => prev.filter((item) => getId(item) !== messageId));
      setRooms((prev) => prev.map((room) => (
        getId(room) === selectedRoomId && getId(room.latestMessage) === messageId
          ? { ...room, latestMessage: null }
          : room
      )));
      toast.success('Đã thu hồi tin nhắn.');
    } catch (err) {
      toast.error(err.message || 'Không thể thu hồi tin nhắn.');
    } finally {
      setDeletingMessageId('');
    }
  };

  const uploadAttachmentMessage = async (body) => {
    const formData = new FormData();
    formData.append('file', attachmentFile);
    formData.append('body', body);

    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/chat/rooms/${selectedRoomId}/messages/attachments`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        setUploadProgress(Math.max(1, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText || '{}');
        } catch {
          data = {};
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data.message || 'Không thể gửi tệp đính kèm.'));
          return;
        }
        resolve(data.data);
      };
      xhr.onerror = () => reject(new Error('Không thể gửi tệp đính kèm.'));
      xhr.send(formData);
    });
  };

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !attachmentFile) || !canSend || sending) return;

    setSending(true);
    setUploadProgress(attachmentFile ? 1 : 0);
    socketRef.current?.emit('chat:typing', { roomId: selectedRoomId, isTyping: false });
    if (attachmentFile) {
      try {
        const message = await uploadAttachmentMessage(body);
        appendMessage(message);
        setDraft('');
        clearAttachment();
        setEmojiOpen(false);
      } catch (err) {
        toast.error(err.message || 'Không thể gửi tệp đính kèm.');
      } finally {
        setUploadProgress(0);
        setSending(false);
      }
      return;
    }

    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('chat:message', { roomId: selectedRoomId, body }, (ack) => {
        setSending(false);
        if (!ack?.success) {
          toast.error(ack?.message || 'Không thể gửi tin nhắn.');
          return;
        }
        setDraft('');
      });
      return;
    }

    try {
      const res = await api.post(`/chat/rooms/${selectedRoomId}/messages`, { body }, token);
      appendMessage(res.data);
      setDraft('');
    } catch (err) {
      toast.error(err.message || 'Không thể gửi tin nhắn.');
    } finally {
      setSending(false);
    }
  };

  const emitTyping = (value) => {
    setDraft(value);
    if (!canSend || !selectedRoomId) return;

    const socket = socketRef.current;
    if (!socket?.connected) return;

    if (!value.trim()) {
      socket.emit('chat:typing', { roomId: selectedRoomId, isTyping: false });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);
      typingTimeoutRef.current = null;
      return;
    }

    if (!typingTimeoutRef.current) {
      socket.emit('chat:typing', { roomId: selectedRoomId, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (typingStopTimeoutRef.current) clearTimeout(typingStopTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1200);
    typingStopTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing', { roomId: selectedRoomId, isTyping: false });
      typingTimeoutRef.current = null;
    }, 1600);
  };

  const handleAcceptDirect = async () => {
    if (!selectedRoomId || accepting) return;

    setAccepting(true);
    try {
      const res = await api.post(`/chat/rooms/${selectedRoomId}/accept`, {}, token);
      updateRoom(res.data);
      toast.success('Đã chấp nhận lời mời chat.');
    } catch (err) {
      toast.error(err.message || 'Không thể chấp nhận lời mời chat.');
    } finally {
      setAccepting(false);
    }
  };

  const handleAcceptGroupInvite = async () => {
    if (!selectedRoomId || accepting) return;

    setAccepting(true);
    try {
      const res = await api.post(`/chat/rooms/${selectedRoomId}/group-invites/accept`, {}, token);
      updateRoom(res.data);
      toast.success('Đã tham gia nhóm chat.');
    } catch (err) {
      toast.error(err.message || 'Không thể chấp nhận lời mời nhóm.');
    } finally {
      setAccepting(false);
    }
  };

  const handleSaveGroupSettings = async (event) => {
    event.preventDefault();
    if (!selectedRoomId || savingGroup) return;

    const payload = {};
    if (configMode === 'rename') payload.name = groupName.trim();

    setSavingGroup(true);
    try {
      const res = await api.patch(`/chat/rooms/${selectedRoomId}/group-settings`, payload, token);
      updateRoom(res.data);
      setConfigMode('');
      toast.success('Đã cập nhật nhóm.');
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật nhóm.');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleUploadGroupAvatar = async (event) => {
    event.preventDefault();
    if (!selectedRoomId || !groupAvatarFile || savingGroup) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(groupAvatarFile.type)) {
      toast.error('Ảnh nhóm chỉ hỗ trợ JPG, PNG hoặc WEBP.');
      return;
    }

    if (groupAvatarFile.size > 2 * 1024 * 1024) {
      toast.error('Ảnh nhóm không được vượt quá 2MB.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', groupAvatarFile);

    setSavingGroup(true);
    try {
      const res = await fetch(`${API_BASE_URL}/chat/rooms/${selectedRoomId}/group-avatar`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Không thể cập nhật ảnh nhóm.');
      }
      updateRoom(data.data);
      setConfigMode('');
      setGroupAvatarFile(null);
      toast.success('Đã cập nhật ảnh nhóm.');
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật ảnh nhóm.');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleInviteLecturerToGroup = async (event) => {
    event.preventDefault();
    if (!selectedLecturerUserId || savingGroup) return;

    setSavingGroup(true);
    try {
      const res = await api.post(`/chat/rooms/${selectedRoomId}/group-invites`, { lecturerUserId: selectedLecturerUserId }, token);
      updateRoom(res.data);
      setConfigMode('');
      toast.success('Đã gửi lời mời thầy/cô vào nhóm.');
    } catch (err) {
      toast.error(err.message || 'Không thể mời thầy/cô vào nhóm.');
    } finally {
      setSavingGroup(false);
    }
  };

  return (
    <div className={css.shell}>
      <section className={css.roomsPanel}>
        <div className={css.panelHeader}>
          <div>
            <h1 className={css.title}>
              <ChatsCircle size={22} />
              Chat
            </h1>
            <p className={css.subtitle}>Tin nhắn nhóm và trò chuyện riêng</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            title="Làm mới"
            onClick={fetchRooms}
            icon={<ArrowsClockwise size={16} />}
          />
        </div>

        {roomsLoading ? (
          <div className={css.loading}><Spinner /></div>
        ) : rooms.length === 0 ? (
          <div className={css.empty}>Chưa có phòng chat nào.</div>
        ) : (
          <div className={css.roomList}>
            {rooms.map((room) => {
              const roomId = getId(room);
              const latest = getLatestMessageText(room.latestMessage);
              return (
                <button
                  key={roomId}
                  disabled={isUploadingAttachment}
                  type="button"
                  className={[css.roomButton, selectedRoomId === roomId ? css.roomButtonActive : ''].filter(Boolean).join(' ')}
                  onClick={() => handleSelectRoom(roomId)}
                >
                  <div className={css.roomName}>
                    <span className={css.roomTitleWrap}>
                      <span className={css.roomAvatar} style={getRoomAvatarStyle(room, user)} />
                      <span>{getRoomDisplayName(room, user)}</span>
                    </span>
                    {room.type === 'direct' && room.status === 'pending' && <Badge variant="warning">Chờ xác nhận</Badge>}
                    {getPendingGroupInvite(room, user) && <Badge variant="warning">Lời mời</Badge>}
                    {Number(room.unreadCount) > 0 && <Badge variant="info">{room.unreadCount}</Badge>}
                  </div>
                  <p className={css.roomMeta}>{latest}</p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className={css.chatPanel}>
        <div className={css.panelHeader}>
          <div>
            <h2 className={css.title}>
              {selectedRoom && (
                <span className={css.headerAvatar} style={getRoomAvatarStyle(selectedRoom, user)} />
              )}
              {selectedRoomTitle}
            </h2>
            {selectedRoom && (
              <p className={css.subtitle}>
                {selectedRoom.type === 'group'
                  ? `${selectedRoom.memberIds?.length || 0} thành viên`
                  : selectedRoom.status === 'pending'
                    ? 'Lời mời chat đang chờ xác nhận'
                    : 'Chat riêng'}
              </p>
            )}
          </div>
          <div className={css.headerActions}>
            {selectedRoomId && !isPendingDirect && !pendingGroupInvite && (
              <label className={css.searchBox}>
                <MagnifyingGlass size={15} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tìm trong chat"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery('')} aria-label="Xóa tìm kiếm">
                    <X size={13} />
                  </button>
                )}
              </label>
            )}
            {canAcceptDirect && (
              <Button
                variant="primary"
                size="sm"
                loading={accepting}
                onClick={handleAcceptDirect}
                icon={<UserCheck size={16} />}
              >
                Chấp nhận
              </Button>
            )}
            {canAcceptGroup && (
              <Button
                variant="primary"
                size="sm"
                loading={accepting}
                onClick={handleAcceptGroupInvite}
                icon={<UserCheck size={16} />}
              >
                Tham gia
              </Button>
            )}
            {selectedRoom?.type === 'group' && !pendingGroupInvite && (
              <div className={css.menuWrap}>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Cấu hình nhóm"
                  onClick={() => setGroupMenuOpen((prev) => !prev)}
                  icon={<DotsThreeVertical size={18} />}
                />
                {groupMenuOpen && (
                  <div className={css.menu}>
                    <button type="button" onClick={() => openConfig('info')}><Info size={15} /> Thông tin nhóm</button>
                    <button type="button" onClick={() => openConfig('invite')}><UserPlus size={15} /> Thêm thầy/cô</button>
                    <button type="button" onClick={() => openConfig('rename')}><PencilSimple size={15} /> Đổi tên nhóm</button>
                    <button type="button" onClick={() => openConfig('avatar')}><ImageSquare size={15} /> Đổi ảnh nhóm</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!selectedRoomId ? (
          <div className={css.empty}>Chọn một phòng để bắt đầu trò chuyện.</div>
        ) : isPendingDirect ? (
          <div className={css.empty}>
            {canAcceptDirect
              ? 'Sinh viên đã gửi lời mời chat. Chấp nhận để bắt đầu nhắn tin.'
              : 'Đang chờ thầy cô chấp nhận lời mời chat.'}
          </div>
        ) : pendingGroupInvite ? (
          <div className={css.empty}>Bạn được mời vào nhóm chat này. Hãy tham gia để xem và nhắn tin.</div>
        ) : messagesLoading ? (
          <div className={css.loading}><Spinner /></div>
        ) : (
          <div className={css.messages}>
            {hasOlderMessages && !searchQuery && messages.length > 0 && (
              <button
                type="button"
                className={css.loadOlderButton}
                onClick={loadOlderMessages}
                disabled={olderLoading}
              >
                {olderLoading ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}
              </button>
            )}
            {visibleMessages.length === 0 ? (
              <div className={css.empty}>
                {searchQuery ? 'Không tìm thấy tin nhắn phù hợp.' : 'Chưa có tin nhắn trong phòng này.'}
              </div>
            ) : (
              visibleMessages.map((message) => {
                const mine = getId(message.senderId) === getId(user);
                return (
                  <div key={getId(message)} className={[css.messageRow, mine ? css.messageMine : ''].filter(Boolean).join(' ')}>
                    {!mine && <span className={css.messageAvatar} style={getUserAvatarStyle(message.senderId)} />}
                    <div className={css.bubble}>
                      {!mine && <p className={css.sender}>{getSenderName(message)}</p>}
                      {message.body && <p className={css.body}>{message.body}</p>}
                      {(message.attachments || []).map((attachment) => (
                        <MessageAttachment
                          key={getAttachmentId(attachment)}
                          attachment={attachment}
                          token={token}
                          onDownload={handleDownloadAttachment}
                          onPreview={setPreviewImage}
                        />
                      ))}
                      <p className={css.time}>{formatDateTime(message.createdAt)}</p>
                      {mine && (
                        <button
                          type="button"
                          className={css.deleteMessageButton}
                          onClick={() => handleDeleteMessage(message)}
                          disabled={deletingMessageId === getId(message)}
                          title="Thu hồi tin nhắn"
                        >
                          <Trash size={13} />
                          Thu hồi
                        </button>
                      )}
                    </div>
                    {mine && <span className={css.messageAvatar} style={getUserAvatarStyle(user)} />}
                  </div>
                );
              })
            )}
            {typingUsers.length > 0 && (
              <div className={css.typingLine}>
                <span className={css.messageAvatar} style={getUserAvatarStyle(typingUsers[0])} />
                <span className={css.typingDots} aria-label="Đang nhập">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        <form className={css.composer} onSubmit={handleSend}>
          <input
            ref={fileInputRef}
            type="file"
            className={css.hiddenFileInput}
            accept=".pdf,.zip,.docx,.pptx,.xlsx,image/png,image/jpeg,image/webp"
            onChange={(event) => selectAttachment(event.target.files?.[0] || null)}
          />
          <input
            ref={imageInputRef}
            type="file"
            className={css.hiddenFileInput}
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => selectAttachment(event.target.files?.[0] || null, true)}
          />
          <div className={css.composerTools}>
            <Button
              variant="ghost"
              size="sm"
              title="Gửi tệp"
              disabled={!canSend || sending}
              onClick={() => fileInputRef.current?.click()}
              icon={<Paperclip size={17} />}
            />
            <Button
              variant="ghost"
              size="sm"
              title="Gửi ảnh"
              disabled={!canSend || sending}
              onClick={() => imageInputRef.current?.click()}
              icon={<ImageSquare size={17} />}
            />
            <div className={css.emojiWrap}>
              <Button
                variant="ghost"
                size="sm"
                title="Chèn icon"
                disabled={!canSend || sending}
                onClick={() => setEmojiOpen((prev) => !prev)}
                icon={<Smiley size={17} />}
              />
              {emojiOpen && (
                <div className={css.emojiMenu}>
                  {CHAT_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        emitTyping(`${draft}${emoji}`);
                        setEmojiOpen(false);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className={css.composerField}>
            {attachmentFile && (
              <div className={css.pendingAttachment}>
                <span>{attachmentFile.type.startsWith('image/') ? <ImageSquare size={16} /> : <File size={16} />}</span>
                <strong>{attachmentFile.name}</strong>
                <em>{isUploadingAttachment ? `${uploadProgress || 1}%` : formatFileSize(attachmentFile.size)}</em>
                <button type="button" onClick={clearAttachment} disabled={isUploadingAttachment} aria-label="Bỏ tệp đính kèm">
                  <X size={14} />
                </button>
                {isUploadingAttachment && (
                  <span className={css.uploadProgressTrack}>
                    <span style={{ width: `${uploadProgress || 1}%` }} />
                  </span>
                )}
              </div>
            )}
            <textarea
              className={css.input}
              value={draft}
              onChange={(event) => emitTyping(event.target.value)}
              placeholder={selectedRoomId ? 'Nhập tin nhắn...' : 'Chọn phòng chat trước'}
              disabled={!canSend || sending}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend(event);
                }
              }}
            />
          </div>
          <Button
            type="submit"
            disabled={!canSend || (!draft.trim() && !attachmentFile)}
            loading={sending}
            icon={<PaperPlaneTilt size={16} />}
          >
            Gửi
          </Button>
        </form>
      </section>

      {previewImage && (
        <div className={css.modalBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPreviewImage(null);
        }}>
          <div className={css.imageModal}>
            <div className={css.imageModalHeader}>
              <strong>{previewImage.name}</strong>
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  title="Tải xuống"
                  onClick={() => handleDownloadAttachment(previewImage.fileId)}
                  icon={<DownloadSimple size={16} />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  title="Đóng"
                  onClick={() => setPreviewImage(null)}
                  icon={<X size={16} />}
                />
              </div>
            </div>
            <div className={css.imageModalBody} style={{ backgroundImage: `url("${previewImage.url}")` }} />
          </div>
        </div>
      )}

      {configMode && (
        <div className={css.modalBackdrop} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !savingGroup) setConfigMode('');
        }}>
          <div className={css.modal}>
            {configMode === 'info' && (
              <>
                <h3>Thông tin nhóm</h3>
                <p className={css.modalText}>{selectedRoom?.name}</p>
                <p className={css.modalText}>{selectedRoom?.memberIds?.length || 0} thành viên</p>
                <div className={css.memberList}>
                  {(selectedRoom?.memberIds || []).map((member) => (
                    <span key={getId(member)}>{member.fullName || member.email}</span>
                  ))}
                </div>
              </>
            )}

            {configMode === 'invite' && (
              <form onSubmit={handleInviteLecturerToGroup} className={css.modalForm}>
                <h3>Thêm thầy/cô</h3>
                <select
                  className={css.select}
                  value={selectedLecturerUserId}
                  onChange={(event) => setSelectedLecturerUserId(event.target.value)}
                >
                  <option value="">Chọn thầy/cô</option>
                  {lecturers.map((lecturer) => (
                    <option key={lecturer._id} value={lecturer.userId?._id || ''}>
                      {lecturer.userId?.fullName || lecturer.userId?.email}
                    </option>
                  ))}
                </select>
                <div className={css.modalActions}>
                  <Button variant="secondary" onClick={() => setConfigMode('')} disabled={savingGroup}>Hủy</Button>
                  <Button type="submit" loading={savingGroup} disabled={!selectedLecturerUserId}>Gửi lời mời</Button>
                </div>
              </form>
            )}

            {configMode === 'rename' && (
              <form onSubmit={handleSaveGroupSettings} className={css.modalForm}>
                <h3>Đổi tên nhóm</h3>
                <input className={css.textInput} value={groupName} onChange={(event) => setGroupName(event.target.value)} />
                <div className={css.modalActions}>
                  <Button variant="secondary" onClick={() => setConfigMode('')} disabled={savingGroup}>Hủy</Button>
                  <Button type="submit" loading={savingGroup} disabled={!groupName.trim()}>Lưu</Button>
                </div>
              </form>
            )}

            {configMode === 'avatar' && (
              <form onSubmit={handleUploadGroupAvatar} className={css.modalForm}>
                <h3>Đổi ảnh nhóm</h3>
                <label className={css.filePicker}>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => setGroupAvatarFile(event.target.files?.[0] || null)}
                  />
                  <span>Chọn ảnh</span>
                  <em>{groupAvatarFile?.name || 'Chưa chọn ảnh'}</em>
                </label>
                <p className={css.hint}>JPG, PNG hoặc WEBP, tối đa 2MB. Ảnh sẽ được upload online.</p>
                <div className={css.modalActions}>
                  <Button variant="secondary" onClick={() => setConfigMode('')} disabled={savingGroup}>Hủy</Button>
                  <Button type="submit" loading={savingGroup} disabled={!groupAvatarFile}>Lưu</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
