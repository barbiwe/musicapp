import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import 'core-js/stable/atob';

/* =========================
   BASE CONFIG
========================= */

//ipconfig getifaddr en0

const API_URL = 'http://172.32.172.67:8080';

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
});

// Автоматично підставляємо JWT
api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/* =========================
   HELPERS
========================= */

const saveUserIdFromToken = async (token) => {
    try {
        const decoded = jwtDecode(token);

        const userId =
            decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ||
            decoded.sub ||
            decoded.nameid;

        if (userId) {
            await AsyncStorage.setItem('userId', userId.toString());
        }
    } catch (e) {
        console.log('JWT decode error:', e);
    }
};

/* =========================
   AUTH
========================= */

export const registerUser = async (username, email, phone, password) => {
    try {
        const res = await api.post('/api/Auth/register', {
            Username: username,
            Email: email,
            PhoneNumber: phone,
            Password: password,
        });

        if (res.data.token) {
            await AsyncStorage.setItem('userToken', res.data.token);
            await AsyncStorage.setItem('username', username);
            await saveUserIdFromToken(res.data.token);
        }

        return res.data;
    } catch (e) {
        return { error: e.response?.data || 'Register error' };
    }
};

export const loginUser = async (email, password) => {
    try {
        const res = await api.post('/api/Auth/login', {
            Email: email,
            Password: password,
        });

        if (res.data.token) {
            await AsyncStorage.setItem('userToken', res.data.token);

            if (res.data.username) {
                await AsyncStorage.setItem('username', res.data.username);
            }

            await saveUserIdFromToken(res.data.token);
        }

        return res.data;
    } catch (e) {
        return { error: e.response?.data || 'Login error' };
    }
};

export const googleLogin = async (idToken) => {
    try {
        const res = await api.post('/api/Auth/google', {
            IdToken: idToken,
        });

        if (res.data.token) {
            await AsyncStorage.setItem('userToken', res.data.token);

            if (res.data.username) {
                await AsyncStorage.setItem('username', res.data.username);
            }

            await saveUserIdFromToken(res.data.token);
        }

        return res.data;
    } catch (e) {
        return { error: e.response?.data || 'Google auth error' };
    }
};

/* =========================
   LIKES
========================= */

export const likeTrack = async (trackId) => {
    try {
        await api.post('/api/Auth/like', { trackId });
        return true;
    } catch (e) {
        console.error("Like error:", e);
        return false;
    }
};

export const unlikeTrack = async (trackId) => {
    try {
        await api.post('/api/Auth/unlike', { trackId });
        return true;
    } catch (e) {
        console.error("Unlike error:", e);
        return false;
    }
};

export const getLikedTracks = async () => {
    try {
        const res = await api.get('/api/Auth/liked-tracks');
        return res.data; // Повертає список ID лайкнутих треків
    } catch (e) {
        console.error("Get liked error:", e);
        return [];
    }
};

/* =========================
   ICONS (НОВА СЕКЦІЯ)
========================= */

export const getIcons = async () => {
    try {
        // Отримуємо список всіх іконок з бекенду
        const res = await api.get('/api/Icon/all');
        const iconsMap = {};

        // Перетворюємо масив у зручний об'єкт: { "play.png": "http://.../files/id" }
        if (Array.isArray(res.data)) {
            res.data.forEach(icon => {
                iconsMap[icon.fileName] = `${API_URL}${icon.url}`;
            });
        }
        return iconsMap;
    } catch (e) {
        console.error("Get icons error:", e);
        return {};
    }
};

/* =========================
   AVATAR
========================= */

export const changeAvatar = async (imageUri) => {
    const formData = new FormData();

    const filename = imageUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    let type = match ? `image/${match[1]}` : 'image/jpeg';
    if (type === 'image/jpg') type = 'image/jpeg';

    formData.append('avatar', {
        uri: imageUri,
        name: filename || 'avatar.jpg',
        type,
    });

    const token = await AsyncStorage.getItem('userToken');

    try {
        const res = await api.post('/api/Auth/change-avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                Authorization: `Bearer ${token}`,
            },
        });

        return { success: true, data: res.data };
    } catch (e) {
        console.log('Avatar upload error:', e.response?.data);
        return { error: e.response?.data || 'Avatar upload failed' };
    }
};

export const logoutUser = async () => {
    await AsyncStorage.multiRemove(['userToken', 'username', 'userId']);
};

/* =========================
   ALBUMS
========================= */

export const getAlbums = async () => {
    try {
        const res = await api.get('/api/Album/all/bum');
        return res.data;
    } catch {
        return [];
    }
};

export const getMyAlbums = async () => {
    try {
        const res = await api.get('/api/Album/my');
        return res.data;
    } catch {
        return [];
    }
};

export const getAlbumDetails = async (id) => {
    try {
        const res = await api.get(`/api/Album/${id}`);
        return res.data;
    } catch {
        return null;
    }
};

export const getAlbumTracks = async (albumId) => {
    try {
        const res = await api.get(`/api/Album/${albumId}/tracks`);
        return res.data;
    } catch {
        return [];
    }
};

/* =========================
   TRACKS
========================= */

export const getTracks = async () => {
    try {
        const res = await api.get('/api/Tracks');
        return res.data;
    } catch {
        return [];
    }
};

export const getMyTracks = async () => {
    try {
        const res = await api.get('/api/Tracks/my');
        return res.data;
    } catch {
        return [];
    }
};

export const uploadTrack = async (file, title, artist, albumId, cover) => {
    const formData = new FormData();

    formData.append('file', {
        uri: file.uri,
        name: file.name || 'audio.mp3',
        type: 'audio/mpeg',
    });

    formData.append('title', title);

    if (albumId) formData.append('albumId', albumId);

    if (cover) {
        formData.append('cover', {
            uri: cover.uri,
            name: 'cover.jpg',
            type: 'image/jpeg',
        });
    }

    try {
        const res = await api.post('/api/Tracks/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return { success: true, data: res.data };
    } catch (e) {
        return { error: 'Upload failed' };
    }
};

/* =========================
   MEDIA URLS
========================= */

export const getStreamUrl = (id) =>
    `${API_URL}/api/Tracks/stream/${id}`;

export const getAlbumCoverUrl = (id) =>
    `${API_URL}/api/Album/${id}/cover`;

export const getUserAvatarUrl = (userId) =>
    userId ? `${API_URL}/api/Auth/avatar/${userId}` : null;

export const getTrackCoverUrl = (track) => {
    if (!track) return null;

    const trackId = track.id || track._id || track.Id;
    const coverId = track.coverFileId || track.CoverFileId;

    if (coverId) {
        return `${API_URL}/api/Tracks/${trackId}/cover`;
    }

    const albumId = track.albumId || track.AlbumId;
    return albumId ? getAlbumCoverUrl(albumId) : null;
};