import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import 'core-js/stable/atob';
import { Dimensions, Image } from 'react-native';

const API_URL = 'http://localhost:8080';
const iconsPrefetchCache = new Set();
let iconsMapCache = null;
let iconsMapRequest = null;
const svgXmlCache = {};
const svgXmlRequestCache = {};

export const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
});

// 👇 ЄДИНИЙ І ПРАВИЛЬНИЙ INTERCEPTOR
api.interceptors.request.use(
    async (config) => {
        // Ми використовуємо ключ 'userToken' всюди
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 👇 ОБРОБКА ВТРАТИ АВТОРИЗАЦІЇ (401)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            console.log("🔒 TOKEN EXPIRED. Logging out...");
            // Чистимо правильні ключі
            await AsyncStorage.multiRemove(['userToken', 'userId', 'username']);
        }
        return Promise.reject(error);
    }
);

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

const { width } = Dimensions.get('window');
const guidelineBaseWidth = 375;
export const scale = (size) => (width / guidelineBaseWidth) * size;
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
   HISTORY
========================= */


export const markTrackAsPlayed = async (trackId, seconds) => {
    try {
        // Бекенд очікує TrackPlayedDto { PlayedSeconds: double }
        await api.post(`/api/Tracks/${trackId}/played`, {
            playedSeconds: seconds
        });
        console.log(`✅ History saved for track ${trackId} (${seconds}s)`);
    } catch (e) {
        console.log('❌ History save error:', e);
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
   RADIO
========================= */

export const getRadioQueue = async (seedTrackId) => {
    try {
        const res = await api.get(`/api/radio/${seedTrackId}`);
        return res.data; // Повертає масив треків (RadioQueueItemDto)
    } catch (e) {
        console.error("Radio error:", e);
        return [];
    }
};

/* =========================
   ICONS
========================= */

export const getIcons = async () => {
    if (iconsMapCache) return iconsMapCache;
    if (iconsMapRequest) return iconsMapRequest;

    iconsMapRequest = (async () => {
        try {
            const res = await api.get('/api/Icon/all');
            const iconsMap = {};

            if (Array.isArray(res.data)) {
                res.data.forEach(icon => {
                    iconsMap[icon.fileName] = `${API_URL}${icon.url}`;
                });
            }

            iconsMapCache = iconsMap;
            return iconsMapCache;
        } catch (e) {
            console.error("Get icons error:", e);
            return {};
        } finally {
            iconsMapRequest = null;
        }
    })();

    return iconsMapRequest;
};

const getSvgCacheKey = (uri, color) => `${uri}_${color || 'original'}`;

const paintSvgXml = (svgContent, color) => {
    let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');

    if (color) {
        cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
        cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
    }

    return cleanXml.replace(/###NONE###/g, 'fill="none"');
};

export const peekColoredSvgXml = (uri, color) => {
    if (!uri) return null;
    return svgXmlCache[getSvgCacheKey(uri, color)] || null;
};

export const getColoredSvgXml = async (uri, color) => {
    if (!uri) return null;
    const cacheKey = getSvgCacheKey(uri, color);

    if (svgXmlCache[cacheKey]) return svgXmlCache[cacheKey];
    if (svgXmlRequestCache[cacheKey]) return svgXmlRequestCache[cacheKey];

    svgXmlRequestCache[cacheKey] = fetch(uri)
        .then((response) => response.text())
        .then((svgContent) => {
            const processed = paintSvgXml(svgContent, color);
            svgXmlCache[cacheKey] = processed;
            return processed;
        })
        .finally(() => {
            delete svgXmlRequestCache[cacheKey];
        });

    return svgXmlRequestCache[cacheKey];
};

export const warmPlayerAssets = async () => {
    const icons = await getIcons();

    const playerSvgAssets = [
        ['background.svg', null],
        ['vinyl.svg', null],
        ['arrow-left.svg', '#F5D8CB'],
        ['more.svg', '#F5D8CB'],
        ['added.svg', '#F5D8CB'],
        ['add to another playlist.svg', '#F5D8CB'],
        ['shuffle.svg', '#F5D8CB'],
        ['previous.svg', '#F5D8CB'],
        ['next.svg', '#F5D8CB'],
        ['pause.svg', '#300C0A'],
        ['play.svg', '#300C0A'],
        ['previous-1.svg', '#F5D8CB'],
        ['play next.svg', '#F5D8CB'],
        ['download.svg', '#F5D8CB'],
        ['share.svg', '#F5D8CB'],
        ['add to queue.svg', '#F5D8CB'],
        ['cancel queue.svg', '#F5D8CB'],
        ['album.svg', '#F5D8CB'],
        ['song information.svg', '#F5D8CB'],
        ['artist.svg', '#F5D8CB'],
        ['radio.svg', '#F5D8CB'],
    ];

    await Promise.allSettled(
        playerSvgAssets.map(([name, color]) => {
            const uri = icons[name];
            if (!uri) return Promise.resolve();
            return getColoredSvgXml(uri, color);
        })
    );

    Object.values(icons).forEach((uri) => {
        if (!uri || iconsPrefetchCache.has(uri)) return;
        iconsPrefetchCache.add(uri);
        Image.prefetch(uri).catch(() => {
            iconsPrefetchCache.delete(uri);
        });
    });

    return icons;
};

export const clearIconsCache = () => {
    iconsMapCache = null;
    iconsMapRequest = null;
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
    } catch (e) {
        console.error("❌ Error fetching albums:", e.message);
        if (e.response) {
            console.error("❌ Server Error Data:", e.response.data);
            console.error("❌ Server Error Status:", e.response.status);
        }
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

//create albums

export const createAlbum = async (title, cover) => {
    const formData = new FormData();

    formData.append('title', title);

    if (cover) {
        const filename = cover.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        let type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('cover', {
            uri: cover.uri,
            name: filename || 'cover.jpg',
            type: type,
        });
    }

    try {
        const res = await api.post('/api/Album/create', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return { success: true, data: res.data };
    } catch (e) {
        console.log('Create album error:', e.response?.data);
        return { error: typeof e.response?.data === 'string' ? e.response.data : 'Create album failed' };
    }
};

/* =========================
   TRACKS
========================= */

/**
 * @returns {Promise<Track[]>}
 */
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


// 1. Додай функцію отримання жанрів (припустимо, що контролер GenreController існує)
// Якщо бекендер не зробив окремий контролер, спитай його.
// Але зазвичай це /api/Genre або /api/Icon/genres
export const getGenres = async () => {
    try {
        const res = await api.get('/api/Tracks/genres');
        return res.data;
    } catch (e) {
        console.log('Get genres error:', e);
        return [];
    }
};

export const uploadTrack = async (file, title, artistId, albumId, cover, genreIds, lyrics) => {
    console.log("🚀 STARTING UPLOAD...");

    const formData = new FormData();

    formData.append('artistId', artistId);
    formData.append('title', title);
    formData.append('lyrics', lyrics || "");

    // Логуємо файл
    console.log(`📂 Audio: ${file.name} (${file.uri})`);
    formData.append('file', {
        uri: file.uri,
        name: file.name || 'audio.mp3',
        type: 'audio/mpeg',
    });

    // Логуємо обкладинку
    if (cover) {
        console.log(`🖼️ Cover: ${cover.uri}`);
        const filename = cover.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        let type = match ? `image/${match[1]}` : 'image/jpeg';
        formData.append('cover', {
            uri: cover.uri,
            name: filename || 'cover.jpg',
            type: type,
        });
    }

    // Логуємо жанри
    if (genreIds && Array.isArray(genreIds)) {
        console.log("🎵 Genres to upload:", genreIds);
        genreIds.forEach(id => {
            formData.append('genreIds', id);
        });
    }

    try {

        // Додаємо timeout, щоб не чекати вічно (10 секунд)
        const res = await api.post('/api/Tracks/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 15000
        });

        return { success: true, data: res.data };

    } catch (e) {
        if (e.response) {
            return { error: JSON.stringify(e.response.data) };
        } else if (e.request) {
            return { error: "Server not responding. Check IP address." };
        } else {
            return { error: e.message };
        }
    }
};

/* =========================
   DISCOVER
========================= */

// 1. Рекомендовані (Артисти)
export const getRecommendedArtists = async () => {
    try {
        // Припустимий ендпоінт. Коли зробиш на бекенді - перевір шлях.
        const res = await api.get('/api/Artists/recommended');
        return res.data;
    } catch (e) {
        console.log('Get recommended error:', e);
        return [];
    }
};

export const getRecommendations = async () => {
    try {
        const res = await api.get('/api/radio/recommendations?limit=10');
        console.log("🔥 RECOMMENDATIONS:", res.data.length);
        return res.data;
    } catch (e) {
        console.log('Get recommendations error:', e);
        return [];
    }
};

// 2. Всі артисти (Кружечки)
export const getAllArtists = async () => {
    try {
        const res = await api.get('/api/Artists');
        return res.data;
    } catch (e) {
        console.log('Get artists error:', e);
        return [];
    }
};

// 3. Нещодавно програні (Квадрати)
export const getRecentlyPlayed = async () => {
    try {
        const res = await api.get('/api/radio/history');
        console.log("📜 RAW HISTORY RESPONSE:", JSON.stringify(res.data, null, 2));
        return res.data;
    } catch (e) {
        console.log('Get recent error:', e);
        return [];
    }
};

// 4. Heritage (Рандомні/Спеціальні)
export const getHeritageTracks = async () => {
    try {
        const res = await api.get('/api/Tracks/heritage');
        return res.data;
    } catch (e) {
        console.log('Get heritage error:', e);
        return [];
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

    // 1. Якщо сервер дав прямий ID картинки (найшвидший варіант)
    if (track.coverFileId) {
        return `${API_URL}/api/Tracks/${track.id}/cover`;
        // Або якщо у тебе старий варіант був через files/download,
        // то краще використовувати універсальний шлях через контролер треків:
    }

    // 2. 👇 РЯТУВАЛЬНИЙ ВАРІАНТ (Для рекомендацій)
    // Якщо ID картинки немає, але є ID треку — просимо сервер знайти картинку самому
    if (track.id) {
        return `${API_URL}/api/Tracks/${track.id}/cover`;
    }

    return null;
};
