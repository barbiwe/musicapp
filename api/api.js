import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================
   BASE CONFIG
========================= */

// ipconfig getifaddr en0
const API_URL = 'http://192.168.68.107:5000';

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

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
        }
        return res.data;
    } catch (e) {
        return { error: e.response?.data || 'Google auth error' };
    }
};

export const logoutUser = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('username');
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

export const createAlbum = async (title, artist, cover) => {
    try {
        const formData = new FormData();
        formData.append('title', title);

        if (artist) {
            formData.append('artist', artist);
        }

        if (cover) {
            formData.append('cover', {
                uri: cover.uri,
                name: 'cover.jpg',
                type: 'image/jpeg',
            });
        }

        const res = await api.post('/api/Album/create', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });

        return { success: true, data: res.data };
    } catch (e) {
        return { error: 'Create album failed' };
    }
};

export const uploadAlbumCover = async (albumId, cover) => {
    const formData = new FormData();
    formData.append('cover', {
        uri: cover.uri,
        name: 'cover.jpg',
        type: 'image/jpeg',
    });

    try {
        await api.post(`/api/Album/${albumId}/upload-cover`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return true;
    } catch (e) {
        console.error("Cover upload error:", e);
        return false;
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

    if (albumId) {
        formData.append('albumId', albumId);
    }

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
        console.error("Upload error:", e.response?.data);
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

export const getTrackCoverUrl = (track) => {
    if (!track) return null;

    const cleanId = (val) => {
        if (!val) return null;
        return typeof val === 'object' ? val.toString() : val;
    };

    const trackId = cleanId(track.id || track._id || track.Id);
    const coverId = cleanId(track.coverFileId || track.CoverFileId);

    if (coverId) {
        return `${API_URL}/api/Tracks/${trackId}/cover`;
    }

    const albId = cleanId(track.albumId || track.AlbumId);
    if (albId) {
        return getAlbumCoverUrl(albId);
    }

    return null;
};