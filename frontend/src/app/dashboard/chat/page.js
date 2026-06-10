'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowsClockwise,
  ChatsCircle,
  DotsThreeVertical,
  ImageSquare,
  Info,
  PaperPlaneTilt,
  PencilSimple,
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

export default function ChatPage() {
  const { token, user } = useAuthStore();
  const toast = useToast();
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const selectedRoomIdRef = useRef('');
  const currentUserIdRef = useRef('');
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
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

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    currentUserIdRef.current = getId(user);
  }, [user]);

  const updateRoom = (nextRoom) => {
    setRooms((prev) => prev.map((room) => (getId(room) === getId(nextRoom) ? nextRoom : room)));
  };

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
      setMessages(res.data || []);
    } catch (err) {
      toast.error(err.message || 'Không thể tải tin nhắn.');
    } finally {
      setMessagesLoading(false);
    }
  }, [toast, token]);

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
      setMessages((prev) => {
        if (prev.some((item) => getId(item) === getId(message))) return prev;
        return [...prev, message];
      });
      setRooms((prev) =>
        prev.map((room) =>
          getId(room) === getId(message.roomId)
            ? { ...room, latestMessage: message, lastMessageAt: message.createdAt }
            : room
        )
      );
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
  }, [toast, token]);

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

  const handleSend = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !canSend || sending) return;

    setSending(true);
    socketRef.current?.emit('chat:typing', { roomId: selectedRoomId, isTyping: false });
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
      setMessages((prev) => [...prev, res.data]);
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
              const latest = room.latestMessage?.body || 'Chưa có tin nhắn';
              return (
                <button
                  key={roomId}
                  type="button"
                  className={[css.roomButton, selectedRoomId === roomId ? css.roomButtonActive : ''].filter(Boolean).join(' ')}
                  onClick={() => setSelectedRoomId(roomId)}
                >
                  <div className={css.roomName}>
                    <span className={css.roomTitleWrap}>
                      <span className={css.roomAvatar} style={getRoomAvatarStyle(room, user)} />
                      <span>{getRoomDisplayName(room, user)}</span>
                    </span>
                    {room.type === 'direct' && room.status === 'pending' && <Badge variant="warning">Chờ xác nhận</Badge>}
                    {getPendingGroupInvite(room, user) && <Badge variant="warning">Lời mời</Badge>}
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
            {messages.length === 0 ? (
              <div className={css.empty}>Chưa có tin nhắn trong phòng này.</div>
            ) : (
              messages.map((message) => {
                const mine = getId(message.senderId) === getId(user);
                return (
                  <div key={getId(message)} className={[css.messageRow, mine ? css.messageMine : ''].filter(Boolean).join(' ')}>
                    {!mine && <span className={css.messageAvatar} style={getUserAvatarStyle(message.senderId)} />}
                    <div className={css.bubble}>
                      {!mine && <p className={css.sender}>{getSenderName(message)}</p>}
                      <p className={css.body}>{message.body}</p>
                      <p className={css.time}>{formatDateTime(message.createdAt)}</p>
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
          <Button
            type="submit"
            disabled={!canSend || !draft.trim()}
            loading={sending}
            icon={<PaperPlaneTilt size={16} />}
          >
            Gửi
          </Button>
        </form>
      </section>

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
