import axios from 'axios';

const API_URL = 'http://127.0.0.1:5000';

/* =========================
   Axios instance
========================= */
const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

/* =========================
   AUTH
========================= */
export const registerUser = async (username, email, phone, password) => {
    try {
        const res = await api.post('/api/Auth/register', {
            Username: username,
            Email: email,
            PhoneNumber: phone, // ✅ ВАЖЛИВО
            Password: password
        });
        return res.data;
    } catch (e) {
        return {
            error: e.response?.data || 'Register error'
        };
    }
};

export const loginUser = async (username, password) => {
    try {
        const res = await api.post('/api/Auth/login', {
            Username: username,
            Password: password
        });
        return res.data;
    } catch (e) {
        return {
            error: e.response?.data || 'Login error'
        };
    }
};

/* =========================
   ALBUMS
========================= */
export const getAlbums = async () => {
    try {
        const res = await api.get('/api/Album/all');
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

export const createAlbum = async (title, artist, cover) => {
    const formData = new FormData();
    formData.append('title', title);
    formData.append('artist', artist);

    if (cover) {
        formData.append('cover', {
            uri: cover.uri,
            name: 'cover.jpg',
            type: 'image/jpeg'
        });
    }

    try {
        await api.post('/api/Album/create', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return { success: true };
    } catch {
        return { error: 'Create album failed' };
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

export const uploadTrack = async (file, title, artist, albumId, cover) => {
    const formData = new FormData();

    formData.append('file', {
        uri: file.uri,
        name: file.name || 'audio.mp3',
        type: 'audio/mpeg'
    });
    formData.append('title', title);
    formData.append('artist', artist);

    if (albumId) {
        formData.append('albumId', albumId);
    }

    if (cover) {
        formData.append('cover', {
            uri: cover.uri,
            name: 'cover.jpg',
            type: 'image/jpeg'
        });
    }

    try {
        const res = await api.post('/api/Tracks/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return { success: true, data: res.data };
    } catch {
        return { error: 'Upload failed' };
    }
};

/* =========================
   MEDIA URLS
========================= */
export const getStreamUrl = (id) =>
    `${API_URL}/api/Tracks/stream/${id}`;

export const getTrackCoverUrl = (id) =>
    `${API_URL}/api/Tracks/cover/${id}`;

export const getAlbumCoverUrl = (id) =>
    `${API_URL}/api/Album/cover/${id}`;
