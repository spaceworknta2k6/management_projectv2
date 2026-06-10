const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');

export const DEFAULT_AVATAR_URL = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export function getAvatarUrl(avatarUrl) {
  if (!avatarUrl) return DEFAULT_AVATAR_URL;
  if (avatarUrl.startsWith('http')) return avatarUrl;
  return `${API_ORIGIN}${avatarUrl}`;
}
