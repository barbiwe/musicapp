import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { jwtDecode } from 'jwt-decode';
import 'core-js/stable/atob';
import { Dimensions, Image } from 'react-native';

const API_URL = 'http://localhost:8080';
const AD_STREAM_COUNT_KEY = 'ad_stream_count_v1';
const iconsPrefetchCache = new Set();
let iconsMapCache = null;
let iconsMapRequest = null;
const svgXmlCache = {};
const svgXmlRequestCache = {};
let tracksCache = null;
let tracksRequest = null;
let genresCache = null;
let genresRequest = null;
let recentPlayedCache = null;
let recentPlayedRequest = null;

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

export const resolveArtistName = (track, fallback = 'Unknown Artist') => {
    if (!track) return fallback;
    if (typeof track === 'string') {
        const value = track.trim();
        return value || fallback;
    }

    const candidates = [
        track.artistName,
        track.artist?.name,
        typeof track.artist === 'string' ? track.artist : null,
        track.ownerName,
        track.userName,
        track.authorName,
        track.creatorName,
        track.albumArtistName,
        track.album?.artist?.name,
    ];

    const found = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return found ? found.trim() : fallback;
};

const parseRoleFromToken = (token) => {
    if (!token) return null;

    try {
        const decoded = jwtDecode(token);
        return (
            decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ||
            decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'] ||
            decoded.role ||
            null
        );
    } catch (_) {
        return null;
    }
};

export const isPremiumUser = async () => {
    try {
        const token = await AsyncStorage.getItem('userToken');
        const role = parseRoleFromToken(token);
        if (!role) return false;
        return String(role).toLowerCase() === 'premium' || String(role) === '3';
    } catch (_) {
        return false;
    }
};

export const shouldShowAdBeforeStream = async () => {
    try {
        const premium = await isPremiumUser();
        if (premium) return false;

        const raw = await AsyncStorage.getItem(AD_STREAM_COUNT_KEY);
        const current = Number.parseInt(raw || '0', 10) || 0;
        const next = current + 1;

        if (next >= 3) {
            await AsyncStorage.setItem(AD_STREAM_COUNT_KEY, '0');
            return true;
        }

        await AsyncStorage.setItem(AD_STREAM_COUNT_KEY, String(next));
        return false;
    } catch (_) {
        return false;
    }
};

export const getRandomAd = async () => {
    try {
        const res = await api.get('/api/ads/random');
        if (!res?.data || !res.data.id) return null;

        const rawImageUrl = res.data.imageUrl;
        const rawAudioUrl = res.data.audioUrl;
        const imageUrl =
            typeof rawImageUrl === 'string'
                ? (rawImageUrl.startsWith('http') ? rawImageUrl : `${API_URL}${rawImageUrl}`)
                : `${API_URL}/api/ads/${res.data.id}/image`;
        const audioUrl =
            typeof rawAudioUrl === 'string' && rawAudioUrl.length > 0
                ? (rawAudioUrl.startsWith('http') ? rawAudioUrl : `${API_URL}${rawAudioUrl}`)
                : `${API_URL}/api/ads/${res.data.id}/audio`;

        return {
            id: res.data.id,
            title: res.data.title || 'Advertisement',
            targetUrl: res.data.targetUrl || null,
            imageUrl,
            audioUrl,
        };
    } catch (e) {
        return null;
    }
};

export const getBanners = async () => {
    try {
        const res = await api.get('/api/banners');
        return Array.isArray(res?.data) ? res.data : [];
    } catch (_) {
        return [];
    }
};

export const getBannerImageUrl = (banner) => {
    if (!banner) return null;

    const toAbsolute = (raw) => {
        if (!raw || typeof raw !== 'string') return null;
        if (raw.startsWith('http')) return raw;
        return raw.startsWith('/') ? `${API_URL}${raw}` : `${API_URL}/${raw}`;
    };

    if (typeof banner === 'string') return toAbsolute(banner);

    const directUrl =
        toAbsolute(banner.imageUrl) ||
        toAbsolute(banner.image) ||
        toAbsolute(banner.bannerImageUrl);
    if (directUrl) return directUrl;

    const id = banner.id || banner.bannerId;
    if (!id) return null;
    return `${API_URL}/api/banners/image/${id}`;
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

export const confirmEmailCode = async (email, code) => {
    try {
        const res = await api.post('/api/Auth/confirm', {
            email,
            code,
        });

        if (res.data?.token) {
            await AsyncStorage.setItem('userToken', res.data.token);

            if (res.data.username) {
                await AsyncStorage.setItem('username', res.data.username);
            }

            await saveUserIdFromToken(res.data.token);
        }

        return { success: true, data: res.data };
    } catch (e) {
        return { error: e?.response?.data || 'Email confirmation failed' };
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

export const requestPasswordReset = async (email) => {
    try {
        const res = await api.post('/api/Auth/forgot-password', { email });
        const data = res?.data;
        return { success: true, data };
    } catch (e) {
        return { error: e?.response?.data || 'Password reset request failed' };
    }
};

export const confirmPasswordReset = async ({ email, code, newPassword }) => {
    try {
        const res = await api.post('/api/Auth/reset-password', {
            email,
            code,
            newPassword,
        });
        const data = res?.data;
        return { success: true, data };
    } catch (e) {
        return { error: e?.response?.data || 'Password reset failed' };
    }
};

export const verifyPasswordResetCode = async ({ email, code }) => {
    try {
        const res = await api.post('/api/Auth/verify-reset-code', {
            email,
            code,
        });
        return { success: true, data: res?.data };
    } catch (e) {
        return { error: e?.response?.data || 'Invalid or expired code' };
    }
};

export const getCountries = async () => {
    try {
        const res = await api.get('/api/countries');
        return Array.isArray(res?.data) ? res.data : [];
    } catch (e) {
        return [];
    }
};

export const becomeAuthor = async ({ country }) => {
    try {
        const res = await api.post('/api/Auth/become-author', { country });
        return { success: true, data: res?.data };
    } catch (e) {
        return { error: e?.response?.data || 'Become author request failed' };
    }
};

export const saveFavoriteGenres = async (genreIds) => {
    try {
        await api.post('/api/radio/favorite-genres', {
            genreIds: Array.isArray(genreIds) ? genreIds : [],
        });
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Save favorite genres failed',
            status: e?.response?.status || null,
        };
    }
};

const OFFLINE_DOWNLOADS_KEY = 'offline_downloads_v1';
const OFFLINE_STORAGE_DIR = `${FileSystem.documentDirectory}offline`;
const OFFLINE_DOWNLOADS_MANIFEST = `${OFFLINE_STORAGE_DIR}/downloads.json`;

const ensureOfflineStorageDir = async () => {
    const dirInfo = await FileSystem.getInfoAsync(OFFLINE_STORAGE_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(OFFLINE_STORAGE_DIR, { intermediates: true });
    }
};

const readOfflineDownloadsManifest = async () => {
    try {
        await ensureOfflineStorageDir();
        const fileInfo = await FileSystem.getInfoAsync(OFFLINE_DOWNLOADS_MANIFEST);
        if (!fileInfo.exists) return null;

        const raw = await FileSystem.readAsStringAsync(OFFLINE_DOWNLOADS_MANIFEST);
        if (!raw) return [];

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return null;
    }
};

const writeOfflineDownloadsManifest = async (items) => {
    await ensureOfflineStorageDir();
    await FileSystem.writeAsStringAsync(
        OFFLINE_DOWNLOADS_MANIFEST,
        JSON.stringify(Array.isArray(items) ? items : [])
    );
};

export const getOfflineDownloads = async () => {
    try {
        const fileData = await readOfflineDownloadsManifest();
        if (Array.isArray(fileData)) {
            return fileData;
        }

        // Міграція зі старого AsyncStorage формату
        const raw = await AsyncStorage.getItem(OFFLINE_DOWNLOADS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const safeParsed = Array.isArray(parsed) ? parsed : [];
        await writeOfflineDownloadsManifest(safeParsed);
        return safeParsed;
    } catch (_) {
        return [];
    }
};

export const saveOfflineDownload = async (track) => {
    try {
        if (!track?.id && !track?._id) return { error: 'Invalid track' };

        const current = await getOfflineDownloads();
        const trackId = String(track.id || track._id);
        const next = [track, ...current.filter((t) => String(t.id || t._id) !== trackId)];

        await writeOfflineDownloadsManifest(next);
        // Back-compat на перехідний період
        await AsyncStorage.setItem(OFFLINE_DOWNLOADS_KEY, JSON.stringify(next));
        return { success: true };
    } catch (e) {
        return { error: e?.message || 'Failed to save offline track' };
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

export const getCachedIcons = () => iconsMapCache || null;

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
        ['pause.svg', '#F5D8CB'],
        ['play.svg', '#F5D8CB'],
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

export const clearSearchCache = () => {
    tracksCache = null;
    tracksRequest = null;
    genresCache = null;
    genresRequest = null;
    recentPlayedCache = null;
    recentPlayedRequest = null;
};

export const getCachedTracks = () => tracksCache || null;
export const getCachedGenres = () => genresCache || null;
export const getCachedRecentlyPlayed = () => recentPlayedCache || null;

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
    clearIconsCache();
    clearSearchCache();
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
    if (tracksCache) return tracksCache;
    if (tracksRequest) return tracksRequest;

    tracksRequest = (async () => {
        try {
            const res = await api.get('/api/Tracks');
            tracksCache = Array.isArray(res.data) ? res.data : [];
            return tracksCache;
        } catch {
            return [];
        } finally {
            tracksRequest = null;
        }
    })();

    return tracksRequest;
};

export const getTrackDetails = async (trackId) => {
    const id = String(trackId || '').trim();
    if (!id) return null;

    try {
        const res = await api.get(`/api/Tracks/${id}`);
        return res?.data || null;
    } catch {
        return null;
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

export const searchTracksByTitle = async (query) => {
    const q = String(query || '').trim();
    if (!q) return [];
    try {
        const res = await api.get('/api/Tracks/search', { params: { query: q } });
        return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
        console.log('Search title error:', e?.response?.status || e?.message);
        return [];
    }
};

export const searchTracksByArtist = async (query) => {
    const q = String(query || '').trim();
    if (!q) return [];
    try {
        const res = await api.get('/api/Tracks/search/artist', { params: { query: q } });
        return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
        console.log('Search artist error:', e?.response?.status || e?.message);
        return [];
    }
};

export const searchTracksByGenre = async (query) => {
    const q = String(query || '').trim();
    if (!q) return [];

    // 1) Пробуємо кілька можливих роутів (у різних збірках беку можуть відрізнятися)
    const endpoints = [
        '/api/Tracks/search/genre',
        '/api/Tracks/search/genres',
        '/api/Tracks/search/by-genre',
    ];

    for (const endpoint of endpoints) {
        try {
            const res = await api.get(endpoint, { params: { query: q } });
            return Array.isArray(res.data) ? res.data : [];
        } catch (e) {
            if (e?.response?.status !== 404) {
                console.log('Search genre error:', e?.response?.status || e?.message);
                return [];
            }
        }
    }

    // 2) Fallback: якщо genre-search не існує, фільтруємо локально по загальному списку треків
    try {
        const allTracks = await getTracks();
        const queryLower = q.toLowerCase();

        return (Array.isArray(allTracks) ? allTracks : []).filter((track) => {
            const names = [];
            const ids = [];

            if (typeof track.genre === 'string') names.push(track.genre.toLowerCase());
            if (track.genre?.name) names.push(String(track.genre.name).toLowerCase());
            if (Array.isArray(track.genres)) {
                track.genres.forEach((g) => {
                    if (typeof g === 'string') names.push(g.toLowerCase());
                    if (g?.name) names.push(String(g.name).toLowerCase());
                    if (g?.title) names.push(String(g.title).toLowerCase());
                    if (g?.id || g?._id || g?.genreId) ids.push(String(g.id || g._id || g.genreId).toLowerCase());
                });
            }

            if (track.genreId) ids.push(String(track.genreId).toLowerCase());
            if (Array.isArray(track.genreIds)) {
                track.genreIds.forEach((id) => ids.push(String(id).toLowerCase()));
            }

            return names.some((n) => n.includes(queryLower)) || ids.some((id) => id.includes(queryLower));
        });
    } catch {
        return [];
    }
};

export const searchTracksCombined = async (query) => {
    const q = String(query || '').trim();
    if (!q) return [];

    const [byTitle, byArtist, byGenre] = await Promise.all([
        searchTracksByTitle(q),
        searchTracksByArtist(q),
        searchTracksByGenre(q),
    ]);

    const merged = [...byTitle, ...byArtist, ...byGenre];
    const used = new Set();
    return merged.filter((track) => {
        const key = String(track?.id || track?._id || `${track?.title}-${track?.artistName || ''}`).toLowerCase();
        if (used.has(key)) return false;
        used.add(key);
        return true;
    });
};


// 1. Додай функцію отримання жанрів (припустимо, що контролер GenreController існує)
// Якщо бекендер не зробив окремий контролер, спитай його.
// Але зазвичай це /api/Genre або /api/Icon/genres
export const getGenres = async () => {
    if (genresCache) return genresCache;
    if (genresRequest) return genresRequest;

    genresRequest = (async () => {
        try {
            const res = await api.get('/api/Tracks/genres');
            genresCache = Array.isArray(res.data) ? res.data : [];
            return genresCache;
        } catch (e) {
            console.log('Get genres error:', e);
            return [];
        } finally {
            genresRequest = null;
        }
    })();

    return genresRequest;
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

export const subscribeToArtist = async (artistId) => {
    const id = String(artistId || '').trim();
    if (!id) return { error: 'Invalid artistId' };

    try {
        await api.post(`/api/Auth/subscribe/${id}`);
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Subscribe failed',
            status: e?.response?.status || null,
        };
    }
};

export const unsubscribeFromArtist = async (artistId) => {
    const id = String(artistId || '').trim();
    if (!id) return { error: 'Invalid artistId' };

    try {
        await api.delete(`/api/Auth/unsubscribe/${id}`);
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Unsubscribe failed',
            status: e?.response?.status || null,
        };
    }
};

export const getSubscriptions = async () => {
    try {
        const res = await api.get('/api/Auth/subscriptions');
        return Array.isArray(res?.data) ? res.data : [];
    } catch (_) {
        return [];
    }
};

export const getArtistSubscriptionStatus = async (artistId) => {
    const id = String(artistId || '').trim();
    if (!id) return false;

    try {
        const res = await api.get(`/api/Auth/subscriptions/${id}`);
        const data = res?.data;

        if (typeof data === 'boolean') return data;
        if (typeof data?.isSubscribed === 'boolean') return data.isSubscribed;
        if (typeof data?.subscribed === 'boolean') return data.subscribed;
        if (typeof data?.value === 'boolean') return data.value;

        return !!data;
    } catch (_) {
        return false;
    }
};

export const getArtistFollowersCount = async (artistId) => {
    const id = String(artistId || '').trim();
    if (!id) return 0;

    try {
        const res = await api.get(`/api/Auth/artists/${id}/followers-count`);
        const data = res?.data;

        const parseAnyNumber = (value, depth = 0) => {
            if (depth > 3 || value === null || value === undefined) return null;

            if (typeof value === 'number' && Number.isFinite(value)) return value;

            if (typeof value === 'string') {
                const cleaned = value.trim();
                if (!cleaned) return null;
                const parsed = Number(cleaned);
                return Number.isFinite(parsed) ? parsed : null;
            }

            if (typeof value === 'object') {
                const preferredKeys = [
                    'count',
                    'Count',
                    'followersCount',
                    'FollowersCount',
                    'followers',
                    'Followers',
                    'total',
                    'Total',
                    'value',
                    'Value',
                    'data',
                    'Data',
                ];

                for (const key of preferredKeys) {
                    if (Object.prototype.hasOwnProperty.call(value, key)) {
                        const nested = parseAnyNumber(value[key], depth + 1);
                        if (nested !== null) return nested;
                    }
                }

                for (const key of Object.keys(value)) {
                    const nested = parseAnyNumber(value[key], depth + 1);
                    if (nested !== null) return nested;
                }
            }

            return null;
        };

        const parsed = parseAnyNumber(data);
        return parsed !== null ? parsed : 0;
    } catch (_) {
        return 0;
    }
};

// 3. Нещодавно програні (Квадрати)
export const getRecentlyPlayed = async (forceRefresh = false) => {
    if (!forceRefresh && recentPlayedCache) return recentPlayedCache;
    if (!forceRefresh && recentPlayedRequest) return recentPlayedRequest;

    recentPlayedRequest = (async () => {
        try {
            const res = await api.get('/api/radio/history');
            recentPlayedCache = Array.isArray(res.data) ? res.data : [];
            return recentPlayedCache;
        } catch (e) {
            console.log('Get recent error:', e);
            return [];
        } finally {
            recentPlayedRequest = null;
        }
    })();

    return recentPlayedRequest;
};

export const warmSearchData = async () => {
    await Promise.allSettled([
        getTracks(),
        getGenres(),
        getRecentlyPlayed(),
        getIcons(),
    ]);
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

const TRACK_COVER_CACHE_DIR = `${FileSystem.cacheDirectory}track-covers`;

export const getCachedTrackCoverUri = async (trackId) => {
    const id = String(trackId || '').trim();
    if (!id) return null;

    try {
        const dirInfo = await FileSystem.getInfoAsync(TRACK_COVER_CACHE_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(TRACK_COVER_CACHE_DIR, { intermediates: true });
        }

        const localPath = `${TRACK_COVER_CACHE_DIR}/${id}.jpg`;
        const localInfo = await FileSystem.getInfoAsync(localPath);
        if (localInfo.exists) {
            return localPath;
        }

        const token = await AsyncStorage.getItem('userToken');
        const remoteUrl = `${API_URL}/api/Tracks/${id}/cover`;
        await FileSystem.downloadAsync(remoteUrl, localPath, {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        return localPath;
    } catch (_) {
        return null;
    }
};
