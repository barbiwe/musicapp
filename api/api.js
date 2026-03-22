import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { jwtDecode } from 'jwt-decode';
import 'core-js/stable/atob';
import { Dimensions, Image } from 'react-native';

const FALLBACK_API_URL = 'http://54.144.57.220:8080';
const API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL;
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
let albumsCache = null;
let albumsRequest = null;
let artistsCache = null;
let artistsRequest = null;
let recommendationsCache = null;
let recommendationsRequest = null;
let bannersCache = null;
let bannersRequest = null;
let myPlaylistsCache = null;
let myPlaylistsRequest = null;
let myAlbumsCache = null;
let myAlbumsRequest = null;
let myTracksCache = null;
let myTracksRequest = null;
let likedTracksCache = null;
let likedTracksRequest = null;
let likedAlbumsCache = null;
let likedAlbumsRequest = null;
let subscriptionsCache = null;
let subscriptionsRequest = null;
let myPodcastsCache = null;
let myPodcastsRequest = null;
let allPodcastsCache = null;
let allPodcastsRequest = null;
let podcastGenresCache = null;
let podcastGenresRequest = null;
let countriesCache = null;
let countriesRequest = null;
let specializationsCache = null;
let specializationsRequest = null;

const trackDetailsCache = new Map();
const trackDetailsRequest = new Map();
const albumDetailsCache = new Map();
const albumDetailsRequest = new Map();
const albumTracksCache = new Map();
const albumTracksRequest = new Map();
const playlistDetailsCache = new Map();
const playlistDetailsRequest = new Map();
const podcastDetailsCache = new Map();
const podcastDetailsRequest = new Map();
const podcastEpisodesCache = new Map();
const podcastEpisodesRequest = new Map();
let refreshTokenRequest = null;

const APP_CACHE_PREFIX = 'vox_cache_v1';
const CACHE_MAX_BYTES = 2_500_000;
const CACHE_TTL = {
    tracks: 10 * 60 * 1000,
    genres: 20 * 60 * 1000,
    recentPlayed: 3 * 60 * 1000,
    albums: 10 * 60 * 1000,
    artists: 10 * 60 * 1000,
    recommendations: 3 * 60 * 1000,
    banners: 15 * 60 * 1000,
    myPlaylists: 5 * 60 * 1000,
    myAlbums: 5 * 60 * 1000,
    myTracks: 5 * 60 * 1000,
    likedTracks: 2 * 60 * 1000,
    likedAlbums: 2 * 60 * 1000,
    subscriptions: 2 * 60 * 1000,
    myPodcasts: 5 * 60 * 1000,
    allPodcasts: 5 * 60 * 1000,
    podcastGenres: 20 * 60 * 1000,
    countries: 24 * 60 * 60 * 1000,
    specializations: 24 * 60 * 60 * 1000,
    details: 5 * 60 * 1000,
};

const getCacheStorageKey = (name) => `${APP_CACHE_PREFIX}:${name}`;

const readArrayCache = async (name, ttlMs, allowStale = true) => {
    try {
        const raw = await AsyncStorage.getItem(getCacheStorageKey(name));
        if (!raw) return { data: null, stale: false };

        const parsed = JSON.parse(raw);
        const ts = Number(parsed?.ts || 0);
        const data = parsed?.data;
        if (!Array.isArray(data)) return { data: null, stale: false };

        const stale = !(ts > 0 && Date.now() - ts <= ttlMs);
        if (!stale || allowStale) {
            return { data, stale };
        }
    } catch (_) {
        // ignore cache read errors
    }

    return { data: null, stale: false };
};

const writeArrayCache = async (name, data) => {
    try {
        if (!Array.isArray(data)) return;
        const payload = JSON.stringify({ ts: Date.now(), data });
        if (payload.length > CACHE_MAX_BYTES) return;
        await AsyncStorage.setItem(getCacheStorageKey(name), payload);
    } catch (_) {
        // ignore cache write errors
    }
};

const getDetailFromCache = (map, id, ttlMs = CACHE_TTL.details) => {
    const key = String(id || '').trim();
    if (!key || !map.has(key)) return null;

    const cached = map.get(key);
    const ts = Number(cached?.ts || 0);
    if (!(ts > 0) || Date.now() - ts > ttlMs) {
        map.delete(key);
        return null;
    }
    return cached?.data ?? null;
};

const setDetailCache = (map, id, data) => {
    const key = String(id || '').trim();
    if (!key) return;
    map.set(key, { ts: Date.now(), data });
};

const clearMapCache = (map) => {
    if (map?.clear) map.clear();
};

const PERSISTED_PUBLIC_ARRAY_CACHE_KEYS = [
    'tracks',
    'genres',
    'albums',
    'artists',
    'recommendations',
    'banners',
    'all_podcasts',
    'podcast_genres',
    'countries',
    'specializations',
].map(getCacheStorageKey);

const PERSISTED_PRIVATE_ARRAY_CACHE_KEYS = [
    'recent_played',
    'my_playlists',
    'my_albums',
    'my_tracks',
    'liked_tracks',
    'liked_albums',
    'subscriptions',
    'my_podcasts',
].map(getCacheStorageKey);

const PERSISTED_ARRAY_CACHE_KEYS = [
    ...PERSISTED_PUBLIC_ARRAY_CACHE_KEYS,
    ...PERSISTED_PRIVATE_ARRAY_CACHE_KEYS,
];

const clearPersistedArrayCaches = async () => {
    try {
        await AsyncStorage.multiRemove(PERSISTED_ARRAY_CACHE_KEYS);
    } catch (_) {
        // ignore cleanup errors
    }
};

const clearPersistedPrivateCaches = async () => {
    try {
        await AsyncStorage.multiRemove(PERSISTED_PRIVATE_ARRAY_CACHE_KEYS);
    } catch (_) {
        // ignore cleanup errors
    }
};

const removePersistedArrayCache = (name) => {
    AsyncStorage.removeItem(getCacheStorageKey(name)).catch(() => {});
};

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
        const status = error?.response?.status;
        const originalRequest = error?.config || {};
        const requestUrl = String(originalRequest?.url || '');

        const skipRefresh =
            requestUrl.includes('/api/Auth/login') ||
            requestUrl.includes('/api/Auth/register') ||
            requestUrl.includes('/api/Auth/confirm') ||
            requestUrl.includes('/api/Auth/google') ||
            requestUrl.includes('/api/Auth/forgot-password') ||
            requestUrl.includes('/api/Auth/reset-password') ||
            requestUrl.includes('/api/Auth/verify-reset-code') ||
            requestUrl.includes('/api/Auth/refresh-token');

        if (status === 401 && !skipRefresh && !originalRequest?._retry) {
            try {
                const currentToken = await AsyncStorage.getItem('userToken');
                if (currentToken) {
                    if (!refreshTokenRequest) {
                        refreshTokenRequest = axios
                            .post(
                                `${API_URL}/api/Auth/refresh-token`,
                                {},
                                { headers: { Authorization: `Bearer ${currentToken}` }, timeout: 15000 }
                            )
                            .then(async (res) => {
                                await saveAuthMeta(res?.data);
                                return res?.data;
                            })
                            .finally(() => {
                                refreshTokenRequest = null;
                            });
                    }

                    await refreshTokenRequest;

                    const nextToken = await AsyncStorage.getItem('userToken');
                    if (nextToken) {
                        originalRequest._retry = true;
                        originalRequest.headers = {
                            ...(originalRequest.headers || {}),
                            Authorization: `Bearer ${nextToken}`,
                        };
                        return api(originalRequest);
                    }
                }
            } catch (_) {
                // fallback to logout below
            }
        }

        if (status === 401) {
            console.log("🔒 TOKEN EXPIRED. Logging out...");
            // Чистимо правильні ключі
            await AsyncStorage.multiRemove(['userToken', 'userId', 'username', 'userRole']);
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
        const candidates = [
            decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
            decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
            decoded.role,
            decoded.Role,
        ];

        for (const value of candidates) {
            if (value === null || value === undefined) continue;
            return value;
        }
        return null;
    } catch (_) {
        return null;
    }
};

const isRolePremiumValue = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(isRolePremiumValue);

    const raw = String(value).trim().toLowerCase();
    if (!raw) return false;

    return raw === '3' || raw === 'premium' || raw.includes('premium');
};

const saveAuthMeta = async (authData, fallbackUsername = null) => {
    if (!authData || typeof authData !== 'object') return;

    if (authData.token) {
        await AsyncStorage.setItem('userToken', authData.token);
        await saveUserIdFromToken(authData.token);

        const roleFromToken = parseRoleFromToken(authData.token);
        if (roleFromToken !== null && roleFromToken !== undefined) {
            await AsyncStorage.setItem('userRole', String(Array.isArray(roleFromToken) ? roleFromToken[0] : roleFromToken));
        }
    }

    const username = authData.username || authData.Username || fallbackUsername;
    if (username) {
        await AsyncStorage.setItem('username', String(username));
    }

    const responseRole =
        authData.role ??
        authData.Role ??
        authData.userRole ??
        authData.UserRole ??
        null;

    if (responseRole !== null && responseRole !== undefined) {
        await AsyncStorage.setItem('userRole', String(responseRole));
    }
};

export const isPremiumUser = async () => {
    try {
        const storedRole = await AsyncStorage.getItem('userRole');
        if (isRolePremiumValue(storedRole)) return true;

        const token = await AsyncStorage.getItem('userToken');
        const role = parseRoleFromToken(token);
        if (!role) return false;
        return isRolePremiumValue(role);
    } catch (_) {
        return false;
    }
};

export const shouldShowAdBeforeStream = async () => {
    try {
        const premium = await isPremiumUser();
        if (premium) {
            await AsyncStorage.setItem(AD_STREAM_COUNT_KEY, '0');
            return false;
        }

        const raw = await AsyncStorage.getItem(AD_STREAM_COUNT_KEY);
        const current = Number.parseInt(raw || '0', 10) || 0;
        const next = current + 1;

        if (next >= 3) {
            // Keep threshold reached until ad was actually shown successfully.
            // This avoids losing ad display when backend returns no ad/audio.
            await AsyncStorage.setItem(AD_STREAM_COUNT_KEY, '2');
            return true;
        }

        await AsyncStorage.setItem(AD_STREAM_COUNT_KEY, String(next));
        return false;
    } catch (_) {
        return false;
    }
};

export const markAdShown = async () => {
    try {
        await AsyncStorage.setItem(AD_STREAM_COUNT_KEY, '0');
    } catch (_) {
        // ignore
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

const fetchBannersFromApi = async () => {
    try {
        const res = await api.get('/api/banners');
        const data = Array.isArray(res?.data) ? res.data : [];
        bannersCache = data;
        await writeArrayCache('banners', data);
        return data;
    } catch (_) {
        return [];
    }
};

const refreshBannersInBackground = () => {
    if (bannersRequest) return;
    bannersRequest = (async () => {
        try {
            return await fetchBannersFromApi();
        } finally {
            bannersRequest = null;
        }
    })();
};

export const getBanners = async () => {
    if (bannersCache) return bannersCache;
    if (bannersRequest) return bannersRequest;

    bannersRequest = (async () => {
        const cached = await readArrayCache('banners', CACHE_TTL.banners, true);
        if (cached.data) {
            bannersCache = cached.data;
            if (cached.stale) setTimeout(() => refreshBannersInBackground(), 0);
            return bannersCache;
        }
        return fetchBannersFromApi();
    })().finally(() => {
        bannersRequest = null;
    });

    return bannersRequest;
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

        await saveAuthMeta(res.data, username);

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

        await saveAuthMeta(res.data);

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

        await saveAuthMeta(res.data);

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

        await saveAuthMeta(res.data);

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

const pickArrayPayload = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result)) return payload.result;
    return null;
};

const getFirstArrayFromEndpoints = async (endpoints = []) => {
    for (const endpoint of endpoints) {
        try {
            const res = await api.get(endpoint);
            const list = pickArrayPayload(res?.data);
            if (Array.isArray(list)) return list;
        } catch (_) {
            // try next endpoint
        }
    }
    return [];
};

export const getCountries = async () => {
    if (countriesCache) return countriesCache;
    if (countriesRequest) return countriesRequest;

    countriesRequest = (async () => {
        const cached = await readArrayCache('countries', CACHE_TTL.countries, true);
        if (cached.data) {
            countriesCache = cached.data;
            return countriesCache;
        }

        try {
            const data = await getFirstArrayFromEndpoints([
            '/api/Auth/countries',
            '/api/auth/countries',
            '/api/countries',
            ]);
            countriesCache = Array.isArray(data) ? data : [];
            await writeArrayCache('countries', countriesCache);
            return countriesCache;
        } catch (e) {
            return [];
        }
    })().finally(() => {
        countriesRequest = null;
    });

    return countriesRequest;
};

export const getArtistSpecializations = async () => {
    if (specializationsCache) return specializationsCache;
    if (specializationsRequest) return specializationsRequest;

    specializationsRequest = (async () => {
        const cached = await readArrayCache('specializations', CACHE_TTL.specializations, true);
        if (cached.data) {
            specializationsCache = cached.data;
            return specializationsCache;
        }

        try {
            const data = await getFirstArrayFromEndpoints([
            '/api/Auth/artist-specializations',
            '/api/auth/artist-specializations',
            '/api/artist-specializations',
            ]);
            specializationsCache = Array.isArray(data) ? data : [];
            await writeArrayCache('specializations', specializationsCache);
            return specializationsCache;
        } catch (e) {
            return [];
        }
    })().finally(() => {
        specializationsRequest = null;
    });

    return specializationsRequest;
};

export const becomeAuthor = async ({ username, country, aboutMe, specialization }) => {
    const countryId = Number(country);
    const specializationId = Number(specialization);
    if (!Number.isFinite(countryId) || !Number.isFinite(specializationId)) {
        return { error: 'Invalid country or specialization' };
    }

    try {
        const res = await api.post('/api/Auth/become-author', {
            username: String(username || '').trim(),
            country: countryId,
            aboutMe: String(aboutMe || '').trim(),
            specialization: specializationId,
        });
        return { success: true, data: res?.data };
    } catch (e) {
        return { error: e?.response?.data || 'Become author request failed' };
    }
};

export const refreshUserToken = async () => {
    try {
        const res = await api.post('/api/Auth/refresh-token', {});
        await saveAuthMeta(res?.data);
        return { success: true, data: res?.data };
    } catch (e) {
        return { error: e?.response?.data || 'Refresh token failed' };
    }
};

export const searchLibrary = async (query) => {
    const q = String(query || '').trim();
    if (!q) {
        return { tracks: [], playlists: [], albums: [], podcasts: [], artists: [] };
    }

    try {
        const res = await api.get('/api/Auth/library/search', { params: { query: q } });
        const data = res?.data || {};

        return {
            tracks: Array.isArray(data?.tracks) ? data.tracks : [],
            playlists: Array.isArray(data?.playlists) ? data.playlists : [],
            albums: Array.isArray(data?.albums) ? data.albums : [],
            podcasts: Array.isArray(data?.podcasts) ? data.podcasts : [],
            artists: Array.isArray(data?.artists) ? data.artists : [],
        };
    } catch (_) {
        return { tracks: [], playlists: [], albums: [], podcasts: [], artists: [] };
    }
};

export const createPremiumCheckout = async () => {
    try {
        const res = await api.post('/api/Payments/create', {});
        const url = res?.data?.url;

        if (!url || typeof url !== 'string') {
            return { error: 'Invalid checkout URL' };
        }

        return { success: true, url };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Failed to create checkout session',
            status: e?.response?.status || null,
        };
    }
};

export const confirmPremiumCheckout = async (sessionId) => {
    const safeSessionId = String(sessionId || '').trim();
    if (!safeSessionId) {
        return { error: 'Missing sessionId' };
    }

    try {
        const res = await api.post('/api/Payments/confirm', { sessionId: safeSessionId });
        return { success: true, data: res?.data || null };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Failed to confirm payment session',
            status: e?.response?.status || null,
        };
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

/* =========================
   PLAYLISTS
========================= */

export const createPlaylist = async ({ name, description = '' }) => {
    const safeName = String(name || '').trim();
    const safeDescription = String(description || '').trim();

    if (!safeName) {
        return { error: 'Playlist name is required' };
    }

    try {
        const res = await api.post('/api/Playlists', {
            name: safeName,
            description: safeDescription,
        });
        myPlaylistsCache = null;
        myPlaylistsRequest = null;
        clearMapCache(playlistDetailsCache);
        clearMapCache(playlistDetailsRequest);
        removePersistedArrayCache('my_playlists');
        return { success: true, data: res?.data || null };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Create playlist failed',
            status: e?.response?.status || null,
        };
    }
};

export const getMyPlaylists = async () => {
    if (myPlaylistsCache) return myPlaylistsCache;
    if (myPlaylistsRequest) return myPlaylistsRequest;

    myPlaylistsRequest = (async () => {
        const cached = await readArrayCache('my_playlists', CACHE_TTL.myPlaylists, true);
        if (cached.data) {
            myPlaylistsCache = cached.data;
            return myPlaylistsCache;
        }

        try {
            const res = await api.get('/api/Playlists/my');
            const data = Array.isArray(res?.data) ? res.data : [];
            myPlaylistsCache = data;
            await writeArrayCache('my_playlists', data);
            return data;
        } catch (_) {
            return [];
        }
    })().finally(() => {
        myPlaylistsRequest = null;
    });

    return myPlaylistsRequest;
};

export const getPlaylistDetails = async (playlistId) => {
    const id = String(playlistId || '').trim();
    if (!id) return null;

    const cached = getDetailFromCache(playlistDetailsCache, id);
    if (cached) return cached;
    if (playlistDetailsRequest.has(id)) return playlistDetailsRequest.get(id);

    const request = (async () => {
        try {
            const res = await api.get(`/api/Playlists/${id}`);
            const data = res?.data || null;
            if (data) setDetailCache(playlistDetailsCache, id, data);
            return data;
        } catch (_) {
            return null;
        } finally {
            playlistDetailsRequest.delete(id);
        }
    })();

    playlistDetailsRequest.set(id, request);
    return request;
};

export const addTrackToPlaylist = async (playlistId, trackId) => {
    const playlist = String(playlistId || '').trim();
    const track = String(trackId || '').trim();
    if (!playlist || !track) return { error: 'Invalid playlist or track id' };

    try {
        await api.post(`/api/Playlists/${playlist}/tracks`, { trackId: track });
        myPlaylistsCache = null;
        myPlaylistsRequest = null;
        playlistDetailsCache.delete(playlist);
        playlistDetailsRequest.delete(playlist);
        removePersistedArrayCache('my_playlists');
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Add track to playlist failed',
            status: e?.response?.status || null,
        };
    }
};

export const removeTrackFromPlaylist = async (playlistId, trackId) => {
    const playlist = String(playlistId || '').trim();
    const track = String(trackId || '').trim();
    if (!playlist || !track) return { error: 'Invalid playlist or track id' };

    try {
        await api.delete(`/api/Playlists/${playlist}/tracks/${track}`);
        myPlaylistsCache = null;
        myPlaylistsRequest = null;
        playlistDetailsCache.delete(playlist);
        playlistDetailsRequest.delete(playlist);
        removePersistedArrayCache('my_playlists');
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Remove track from playlist failed',
            status: e?.response?.status || null,
        };
    }
};

export const deletePlaylist = async (playlistId) => {
    const id = String(playlistId || '').trim();
    if (!id) return { error: 'Invalid playlist id' };

    try {
        await api.delete(`/api/Playlists/${id}`);
        myPlaylistsCache = null;
        myPlaylistsRequest = null;
        playlistDetailsCache.delete(id);
        playlistDetailsRequest.delete(id);
        removePersistedArrayCache('my_playlists');
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Delete playlist failed',
            status: e?.response?.status || null,
        };
    }
};

export const uploadPlaylistCover = async (playlistId, cover) => {
    const id = String(playlistId || '').trim();
    if (!id) return { error: 'Invalid playlist id' };
    if (!cover?.uri) return { error: 'Cover file is required' };

    const formData = new FormData();
    const uriName = cover.uri.split('/').pop();
    const filename = cover.fileName || uriName || `playlist-cover-${Date.now()}.jpg`;
    const match = /\.(\w+)$/.exec(filename || '');
    let type = cover.mimeType || cover.type || (match ? `image/${match[1]}` : 'image/jpeg');
    if (type === 'image/jpg') type = 'image/jpeg';
    if (!String(type).startsWith('image/')) type = 'image/jpeg';

    formData.append('cover', {
        uri: cover.uri,
        name: filename,
        type,
    });

    try {
        await api.post(`/api/Playlists/${id}/cover`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        myPlaylistsCache = null;
        myPlaylistsRequest = null;
        playlistDetailsCache.delete(id);
        playlistDetailsRequest.delete(id);
        removePersistedArrayCache('my_playlists');
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Upload playlist cover failed',
            status: e?.response?.status || null,
        };
    }
};

export const getPlaylistCoverUrl = (playlistId) => {
    const id = String(playlistId || '').trim();
    if (!id) return null;
    return `${API_URL}/api/Playlists/${id}/cover`;
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

export const addTrackPlay = async (trackId) => {
    const id = String(trackId || '').trim();
    if (!id) return false;

    try {
        await api.post(`/api/Tracks/${id}/play`);
        return true;
    } catch (e) {
        console.log('❌ Track play add error:', e);
        return false;
    }
};

export const getTrackPlays = async (trackId) => {
    const id = String(trackId || '').trim();
    if (!id) return 0;

    try {
        const res = await api.get(`/api/Tracks/${id}/plays`);
        const value = Number(res?.data?.plays);
        return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (_) {
        return 0;
    }
};

export const getTrackPlaysYesterday = async (trackId) => {
    const id = String(trackId || '').trim();
    if (!id) return 0;

    try {
        const res = await api.get(`/api/Tracks/${id}/plays/yesterday`);
        const value = Number(res?.data?.plays);
        return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch (_) {
        return 0;
    }
};

/* =========================
   LIKES
========================= */

export const likeTrack = async (trackId) => {
    try {
        await api.post('/api/Auth/like', { trackId });
        likedTracksCache = null;
        likedTracksRequest = null;
        removePersistedArrayCache('liked_tracks');
        return true;
    } catch (e) {
        console.error("Like error:", e);
        return false;
    }
};

export const unlikeTrack = async (trackId) => {
    try {
        await api.post('/api/Auth/unlike', { trackId });
        likedTracksCache = null;
        likedTracksRequest = null;
        removePersistedArrayCache('liked_tracks');
        return true;
    } catch (e) {
        console.error("Unlike error:", e);
        return false;
    }
};

export const getLikedTracks = async () => {
    if (likedTracksCache) return likedTracksCache;
    if (likedTracksRequest) return likedTracksRequest;

    likedTracksRequest = (async () => {
        const cached = await readArrayCache('liked_tracks', CACHE_TTL.likedTracks, true);
        if (cached.data) {
            likedTracksCache = cached.data;
            return likedTracksCache;
        }

        try {
            const res = await api.get('/api/Auth/liked-tracks');
            const data = Array.isArray(res?.data) ? res.data : [];
            likedTracksCache = data;
            await writeArrayCache('liked_tracks', data);
            return data;
        } catch (e) {
            console.error("Get liked error:", e);
            return [];
        }
    })().finally(() => {
        likedTracksRequest = null;
    });

    return likedTracksRequest;
};

export const likeAlbum = async (albumId) => {
    try {
        await api.post('/api/Auth/like-album', { albumId: String(albumId || '').trim() });
        likedAlbumsCache = null;
        likedAlbumsRequest = null;
        removePersistedArrayCache('liked_albums');
        return true;
    } catch (e) {
        console.error('Like album error:', e);
        return false;
    }
};

export const unlikeAlbum = async (albumId) => {
    try {
        await api.post('/api/Auth/unlike-album', { albumId: String(albumId || '').trim() });
        likedAlbumsCache = null;
        likedAlbumsRequest = null;
        removePersistedArrayCache('liked_albums');
        return true;
    } catch (e) {
        console.error('Unlike album error:', e);
        return false;
    }
};

export const getLikedAlbums = async () => {
    if (likedAlbumsCache) return likedAlbumsCache;
    if (likedAlbumsRequest) return likedAlbumsRequest;

    likedAlbumsRequest = (async () => {
        const cached = await readArrayCache('liked_albums', CACHE_TTL.likedAlbums, true);
        if (cached.data) {
            likedAlbumsCache = cached.data;
            return likedAlbumsCache;
        }

        try {
            const res = await api.get('/api/Auth/liked-albums');
            const data = Array.isArray(res?.data) ? res.data : [];
            likedAlbumsCache = data;
            await writeArrayCache('liked_albums', data);
            return data;
        } catch (e) {
            console.error('Get liked albums error:', e);
            return [];
        }
    })().finally(() => {
        likedAlbumsRequest = null;
    });

    return likedAlbumsRequest;
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
            const toAbsoluteIconUrl = (rawUrl) => {
                const value = String(rawUrl || '').trim();
                if (!value) return null;

                const absolute = /^https?:\/\//i.test(value)
                    ? value
                    : `${API_URL}${value.startsWith('/') ? '' : '/'}${value}`;

                return encodeURI(absolute);
            };

            if (Array.isArray(res.data)) {
                res.data.forEach(icon => {
                    const fileName = icon?.fileName || icon?.name || icon?.file || '';
                    const iconUrl = toAbsoluteIconUrl(icon?.url || icon?.path || icon?.uri);
                    if (fileName && iconUrl) {
                        iconsMap[fileName] = iconUrl;
                    }
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
    albumsCache = null;
    albumsRequest = null;
    artistsCache = null;
    artistsRequest = null;
    recommendationsCache = null;
    recommendationsRequest = null;
    bannersCache = null;
    bannersRequest = null;
    myPlaylistsCache = null;
    myPlaylistsRequest = null;
    myAlbumsCache = null;
    myAlbumsRequest = null;
    myTracksCache = null;
    myTracksRequest = null;
    likedTracksCache = null;
    likedTracksRequest = null;
    likedAlbumsCache = null;
    likedAlbumsRequest = null;
    subscriptionsCache = null;
    subscriptionsRequest = null;
    myPodcastsCache = null;
    myPodcastsRequest = null;
    allPodcastsCache = null;
    allPodcastsRequest = null;
    podcastGenresCache = null;
    podcastGenresRequest = null;
    countriesCache = null;
    countriesRequest = null;
    specializationsCache = null;
    specializationsRequest = null;
    clearMapCache(trackDetailsCache);
    clearMapCache(trackDetailsRequest);
    clearMapCache(albumDetailsCache);
    clearMapCache(albumDetailsRequest);
    clearMapCache(albumTracksCache);
    clearMapCache(albumTracksRequest);
    clearMapCache(playlistDetailsCache);
    clearMapCache(playlistDetailsRequest);
    clearMapCache(podcastDetailsCache);
    clearMapCache(podcastDetailsRequest);
    clearMapCache(podcastEpisodesCache);
    clearMapCache(podcastEpisodesRequest);
};

const clearUserScopedRuntimeCaches = () => {
    recentPlayedCache = null;
    recentPlayedRequest = null;
    myPlaylistsCache = null;
    myPlaylistsRequest = null;
    myAlbumsCache = null;
    myAlbumsRequest = null;
    myTracksCache = null;
    myTracksRequest = null;
    likedTracksCache = null;
    likedTracksRequest = null;
    likedAlbumsCache = null;
    likedAlbumsRequest = null;
    subscriptionsCache = null;
    subscriptionsRequest = null;
    myPodcastsCache = null;
    myPodcastsRequest = null;
    clearMapCache(playlistDetailsCache);
    clearMapCache(playlistDetailsRequest);
    clearMapCache(podcastDetailsCache);
    clearMapCache(podcastDetailsRequest);
    clearMapCache(podcastEpisodesCache);
    clearMapCache(podcastEpisodesRequest);
};

export const getCachedTracks = () => tracksCache || null;
export const getCachedGenres = () => genresCache || null;
export const getCachedRecentlyPlayed = () => recentPlayedCache || null;
export const getCachedAlbums = () => albumsCache || null;
export const getCachedArtists = () => artistsCache || null;
export const getCachedRecommendations = () => recommendationsCache || null;
export const getCachedBanners = () => bannersCache || null;

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
    await AsyncStorage.multiRemove(['userToken', 'username', 'userId', 'userRole']);
    clearUserScopedRuntimeCaches();
    await clearPersistedPrivateCaches();
};

/* =========================
   ALBUMS
========================= */

const fetchAlbumsFromApi = async () => {
    try {
        const res = await api.get('/api/Album/all/bum');
        const data = Array.isArray(res?.data) ? res.data : [];
        albumsCache = data;
        await writeArrayCache('albums', data);
        return data;
    } catch (e) {
        console.error("❌ Error fetching albums:", e.message);
        if (e.response) {
            console.error("❌ Server Error Data:", e.response.data);
            console.error("❌ Server Error Status:", e.response.status);
        }
        return [];
    }
};

const refreshAlbumsInBackground = () => {
    if (albumsRequest) return;
    albumsRequest = (async () => {
        try {
            return await fetchAlbumsFromApi();
        } finally {
            albumsRequest = null;
        }
    })();
};

export const getAlbums = async () => {
    if (albumsCache) return albumsCache;
    if (albumsRequest) return albumsRequest;

    albumsRequest = (async () => {
        const cached = await readArrayCache('albums', CACHE_TTL.albums, true);
        if (cached.data) {
            albumsCache = cached.data;
            if (cached.stale) setTimeout(() => refreshAlbumsInBackground(), 0);
            return albumsCache;
        }
        return fetchAlbumsFromApi();
    })().finally(() => {
        albumsRequest = null;
    });

    return albumsRequest;
};
export const getMyAlbums = async () => {
    if (myAlbumsCache) return myAlbumsCache;
    if (myAlbumsRequest) return myAlbumsRequest;

    myAlbumsRequest = (async () => {
        const cached = await readArrayCache('my_albums', CACHE_TTL.myAlbums, true);
        if (cached.data) {
            myAlbumsCache = cached.data;
            return myAlbumsCache;
        }
        try {
            const res = await api.get('/api/Album/my');
            const data = Array.isArray(res?.data) ? res.data : [];
            myAlbumsCache = data;
            await writeArrayCache('my_albums', data);
            return data;
        } catch {
            return [];
        }
    })().finally(() => {
        myAlbumsRequest = null;
    });

    return myAlbumsRequest;
};

export const getAlbumDetails = async (id) => {
    const albumId = String(id || '').trim();
    if (!albumId) return null;

    const cached = getDetailFromCache(albumDetailsCache, albumId);
    if (cached) return cached;
    if (albumDetailsRequest.has(albumId)) return albumDetailsRequest.get(albumId);

    const request = (async () => {
        try {
            const res = await api.get(`/api/Album/${albumId}`);
            const data = res?.data || null;
            if (data) setDetailCache(albumDetailsCache, albumId, data);
            return data;
        } catch {
            return null;
        } finally {
            albumDetailsRequest.delete(albumId);
        }
    })();

    albumDetailsRequest.set(albumId, request);
    return request;
};

export const getAlbumTracks = async (albumId) => {
    const id = String(albumId || '').trim();
    if (!id) return [];

    const cached = getDetailFromCache(albumTracksCache, id);
    if (Array.isArray(cached)) return cached;
    if (albumTracksRequest.has(id)) return albumTracksRequest.get(id);

    const request = (async () => {
        try {
            const res = await api.get(`/api/Album/${id}/tracks`);
            const data = Array.isArray(res?.data) ? res.data : [];
            setDetailCache(albumTracksCache, id, data);
            return data;
        } catch {
            return [];
        } finally {
            albumTracksRequest.delete(id);
        }
    })();

    albumTracksRequest.set(id, request);
    return request;
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
        albumsCache = null;
        albumsRequest = null;
        myAlbumsCache = null;
        myAlbumsRequest = null;
        clearMapCache(albumDetailsCache);
        clearMapCache(albumDetailsRequest);
        clearMapCache(albumTracksCache);
        clearMapCache(albumTracksRequest);
        removePersistedArrayCache('albums');
        removePersistedArrayCache('my_albums');
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
const fetchTracksFromApi = async () => {
    try {
        const res = await api.get('/api/Tracks');
        const data = Array.isArray(res?.data) ? res.data : [];
        tracksCache = data;
        await writeArrayCache('tracks', data);
        return data;
    } catch {
        return [];
    }
};

const refreshTracksInBackground = () => {
    if (tracksRequest) return;
    tracksRequest = (async () => {
        try {
            return await fetchTracksFromApi();
        } finally {
            tracksRequest = null;
        }
    })();
};

export const getTracks = async () => {
    if (tracksCache) return tracksCache;
    if (tracksRequest) return tracksRequest;

    tracksRequest = (async () => {
        const cached = await readArrayCache('tracks', CACHE_TTL.tracks, true);
        if (cached.data) {
            tracksCache = cached.data;
            if (cached.stale) setTimeout(() => refreshTracksInBackground(), 0);
            return tracksCache;
        }
        return fetchTracksFromApi();
    })().finally(() => {
        tracksRequest = null;
    })();

    return tracksRequest;
};

export const getTrackDetails = async (trackId) => {
    const id = String(trackId || '').trim();
    if (!id) return null;

    const cached = getDetailFromCache(trackDetailsCache, id);
    if (cached) return cached;
    if (trackDetailsRequest.has(id)) return trackDetailsRequest.get(id);

    const request = (async () => {
        try {
            const res = await api.get(`/api/Tracks/${id}`);
            const data = res?.data || null;
            if (data) setDetailCache(trackDetailsCache, id, data);
            return data;
        } catch {
            return null;
        } finally {
            trackDetailsRequest.delete(id);
        }
    })();

    trackDetailsRequest.set(id, request);
    return request;
};

export const getMyTracks = async () => {
    if (myTracksCache) return myTracksCache;
    if (myTracksRequest) return myTracksRequest;

    myTracksRequest = (async () => {
        const cached = await readArrayCache('my_tracks', CACHE_TTL.myTracks, true);
        if (cached.data) {
            myTracksCache = cached.data;
            return myTracksCache;
        }
        try {
            const res = await api.get('/api/Tracks/my');
            const data = Array.isArray(res?.data) ? res.data : [];
            myTracksCache = data;
            await writeArrayCache('my_tracks', data);
            return data;
        } catch {
            return [];
        }
    })().finally(() => {
        myTracksRequest = null;
    });

    return myTracksRequest;
};

const normalizeTrackListResponse = (data) => {
    if (!Array.isArray(data)) return [];

    return data
        .map((item) => {
            if (!item) return null;
            if (item?.track && typeof item.track === 'object') {
                return { ...item.track };
            }
            return item;
        })
        .filter(Boolean);
};

export const searchTracksByTitle = async (query) => {
    const q = String(query || '').trim();
    if (!q) return [];
    try {
        const res = await api.get('/api/Tracks/search', { params: { query: q } });
        return normalizeTrackListResponse(res.data);
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
        return normalizeTrackListResponse(res.data);
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
            return normalizeTrackListResponse(res.data);
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
const fetchGenresFromApi = async () => {
    try {
        const res = await api.get('/api/Tracks/genres');
        const data = Array.isArray(res?.data) ? res.data : [];
        genresCache = data;
        await writeArrayCache('genres', data);
        return data;
    } catch (e) {
        console.log('Get genres error:', e);
        return [];
    }
};

const refreshGenresInBackground = () => {
    if (genresRequest) return;
    genresRequest = (async () => {
        try {
            return await fetchGenresFromApi();
        } finally {
            genresRequest = null;
        }
    })();
};

export const getGenres = async () => {
    if (genresCache) return genresCache;
    if (genresRequest) return genresRequest;

    genresRequest = (async () => {
        const cached = await readArrayCache('genres', CACHE_TTL.genres, true);
        if (cached.data) {
            genresCache = cached.data;
            if (cached.stale) setTimeout(() => refreshGenresInBackground(), 0);
            return genresCache;
        }
        return fetchGenresFromApi();
    })().finally(() => {
        genresRequest = null;
    })();

    return genresRequest;
};

const toStringList = (value) => {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }

    return [];
};

export const uploadTrack = async (
    file,
    title,
    artistId,
    albumId,
    cover,
    genreIds,
    lyrics,
    producers = [],
    lyricists = []
) => {
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

    // Нові поля (бек: optional, repeatable або CSV)
    const producersList = toStringList(producers);
    producersList.forEach((value) => formData.append('producers', value));

    const lyricistsList = toStringList(lyricists);
    lyricistsList.forEach((value) => formData.append('lyricists', value));

    try {

        // Додаємо timeout, щоб не чекати вічно (10 секунд)
        const res = await api.post('/api/Tracks/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 15000
        });

        tracksCache = null;
        tracksRequest = null;
        myTracksCache = null;
        myTracksRequest = null;
        clearMapCache(trackDetailsCache);
        clearMapCache(trackDetailsRequest);
        removePersistedArrayCache('tracks');
        removePersistedArrayCache('my_tracks');

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
   PODCASTS
========================= */

const toAbsoluteApiUrl = (raw) => {
    if (!raw || typeof raw !== 'string') return null;
    if (raw.startsWith('http')) return raw;
    return raw.startsWith('/') ? `${API_URL}${raw}` : `${API_URL}/${raw}`;
};

const getFileTypeFromUri = (uri, fallback) => {
    const ext = String(uri || '').split('.').pop()?.toLowerCase();
    if (!ext) return fallback;

    if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
    if (ext === 'png') return 'image/png';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'svg') return 'image/svg+xml';

    if (ext === 'mp3') return 'audio/mpeg';
    if (ext === 'm4a') return 'audio/mp4';
    if (ext === 'aac') return 'audio/aac';
    if (ext === 'wav') return 'audio/wav';
    if (ext === 'ogg') return 'audio/ogg';

    return fallback;
};

const getAssetSizeBytes = (asset) => {
    const raw =
        asset?.size ??
        asset?.fileSize ??
        asset?.filesize ??
        asset?.file?.size ??
        0;

    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : 0;
};

export const getPodcastGenres = async () => {
    if (podcastGenresCache) return podcastGenresCache;
    if (podcastGenresRequest) return podcastGenresRequest;

    podcastGenresRequest = (async () => {
        const cached = await readArrayCache('podcast_genres', CACHE_TTL.podcastGenres, true);
        if (cached.data) {
            podcastGenresCache = cached.data;
            return podcastGenresCache;
        }
        try {
            const res = await api.get('/api/Podcasts/genres');
            const data = Array.isArray(res?.data) ? res.data : [];
            podcastGenresCache = data;
            await writeArrayCache('podcast_genres', data);
            return data;
        } catch (_) {
            return [];
        }
    })().finally(() => {
        podcastGenresRequest = null;
    });

    return podcastGenresRequest;
};

export const createPodcast = async ({
    title,
    cover,
    audio,
    genreIds = [],
    episodes = [],
    submit = true,
}) => {
    const safeTitle = String(title || '').trim();
    const safeGenreIds = Array.isArray(genreIds)
        ? genreIds.map((id) => String(id || '').trim()).filter(Boolean)
        : [];

    if (!safeTitle) {
        return { error: 'Podcast title is required' };
    }
    if (!cover?.uri) {
        return { error: 'Cover file is required' };
    }
    if (!audio?.uri) {
        return { error: 'Audio file is required' };
    }
    if (!safeGenreIds.length) {
        return { error: 'At least one genreId is required' };
    }

    const safeEpisodes = Array.isArray(episodes)
        ? episodes
            .map((episode, index) => {
                const safeEpTitle = String(episode?.title || '').trim() || `Episode ${index + 2}`;
                const safeEpDescription = String(episode?.description || '').trim();
                const epAudio = episode?.audio;
                if (!epAudio?.uri) return null;
                return {
                    title: safeEpTitle,
                    description: safeEpDescription,
                    audio: epAudio,
                };
            })
            .filter(Boolean)
        : [];

    // Backend currently limits multipart body to 200MB.
    const backendLimitBytes = 200 * 1024 * 1024;
    const totalPayloadBytes =
        getAssetSizeBytes(cover) +
        getAssetSizeBytes(audio) +
        safeEpisodes.reduce((sum, ep) => sum + getAssetSizeBytes(ep.audio), 0);

    if (totalPayloadBytes > backendLimitBytes) {
        const toMb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);
        return {
            error: `Payload too large (${toMb(totalPayloadBytes)}MB). Backend limit is 200MB. Upload fewer/smaller episodes.`,
            status: 413,
        };
    }

    const formData = new FormData();
    formData.append('title', safeTitle);
    formData.append('cover', {
        uri: cover.uri,
        name: cover.fileName || cover.name || cover.uri.split('/').pop() || 'podcast-cover.jpg',
        type: getFileTypeFromUri(cover.uri, 'image/jpeg'),
    });
    formData.append('audio', {
        uri: audio.uri,
        name: audio.name || audio.fileName || audio.uri.split('/').pop() || 'podcast-audio.mp3',
        type: getFileTypeFromUri(audio.uri, 'audio/mpeg'),
    });
    safeGenreIds.forEach((id) => {
        formData.append('genreIds', id);
    });
    safeEpisodes.forEach((episode) => {
        formData.append('episodeAudios', {
            uri: episode.audio.uri,
            name: episode.audio.name || episode.audio.fileName || episode.audio.uri.split('/').pop() || 'episode.mp3',
            type: getFileTypeFromUri(episode.audio.uri, 'audio/mpeg'),
        });
        formData.append('episodeTitles', episode.title);
        formData.append('episodeDescriptions', episode.description || '');
    });
    formData.append('submit', submit ? 'true' : 'false');

    try {
        const res = await api.post('/api/Podcasts/create', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 0,
        });
        myPodcastsCache = null;
        myPodcastsRequest = null;
        allPodcastsCache = null;
        allPodcastsRequest = null;
        clearMapCache(podcastDetailsCache);
        clearMapCache(podcastDetailsRequest);
        clearMapCache(podcastEpisodesCache);
        clearMapCache(podcastEpisodesRequest);
        removePersistedArrayCache('my_podcasts');
        removePersistedArrayCache('all_podcasts');
        return { success: true, data: res?.data };
    } catch (e) {
        if (e?.code === 'ECONNABORTED') {
            return {
                error: 'Request timeout. Try fewer/smaller files, or publish in parts.',
                status: null,
            };
        }

        if (e?.response?.status === 413) {
            return {
                error: 'Payload too large for backend limit (200MB). Reduce total upload size.',
                status: 413,
            };
        }

        return {
            error: e?.response?.data || e?.message || 'Create podcast failed',
            status: e?.response?.status || null,
        };
    }
};

export const getMyPodcasts = async () => {
    if (myPodcastsCache) return myPodcastsCache;
    if (myPodcastsRequest) return myPodcastsRequest;

    myPodcastsRequest = (async () => {
        const cached = await readArrayCache('my_podcasts', CACHE_TTL.myPodcasts, true);
        if (cached.data) {
            myPodcastsCache = cached.data;
            return myPodcastsCache;
        }
        try {
            const res = await api.get('/api/Podcasts/my');
            const data = Array.isArray(res?.data) ? res.data : [];
            myPodcastsCache = data;
            await writeArrayCache('my_podcasts', data);
            return data;
        } catch (_) {
            return [];
        }
    })().finally(() => {
        myPodcastsRequest = null;
    });

    return myPodcastsRequest;
};

export const getAllPodcasts = async () => {
    if (allPodcastsCache) return allPodcastsCache;
    if (allPodcastsRequest) return allPodcastsRequest;

    allPodcastsRequest = (async () => {
        const cached = await readArrayCache('all_podcasts', CACHE_TTL.allPodcasts, true);
        if (cached.data) {
            allPodcastsCache = cached.data;
            return allPodcastsCache;
        }
        try {
            const res = await api.get('/api/Podcasts/all');
            const data = Array.isArray(res?.data) ? res.data : [];
            allPodcastsCache = data;
            await writeArrayCache('all_podcasts', data);
            return data;
        } catch (_) {
            return [];
        }
    })().finally(() => {
        allPodcastsRequest = null;
    });

    return allPodcastsRequest;
};

export const getPodcastById = async (podcastId) => {
    const id = String(podcastId || '').trim();
    if (!id) return null;

    const cached = getDetailFromCache(podcastDetailsCache, id);
    if (cached) return cached;
    if (podcastDetailsRequest.has(id)) return podcastDetailsRequest.get(id);

    const request = (async () => {
        try {
            const res = await api.get(`/api/Podcasts/${id}`);
            const data = res?.data || null;
            if (data) setDetailCache(podcastDetailsCache, id, data);
            return data;
        } catch (_) {
            return null;
        } finally {
            podcastDetailsRequest.delete(id);
        }
    })();

    podcastDetailsRequest.set(id, request);
    return request;
};

export const getPodcastEpisodes = async (podcastId) => {
    const id = String(podcastId || '').trim();
    if (!id) return [];

    const cached = getDetailFromCache(podcastEpisodesCache, id);
    if (Array.isArray(cached)) return cached;
    if (podcastEpisodesRequest.has(id)) return podcastEpisodesRequest.get(id);

    const request = (async () => {
        try {
            const res = await api.get(`/api/Podcasts/${id}/episodes`);
            const data = Array.isArray(res?.data) ? res.data : [];
            setDetailCache(podcastEpisodesCache, id, data);
            return data;
        } catch (_) {
            return [];
        } finally {
            podcastEpisodesRequest.delete(id);
        }
    })();

    podcastEpisodesRequest.set(id, request);
    return request;
};

export const addPodcastEpisode = async ({ podcastId, file, title = '', description = '' }) => {
    const id = String(podcastId || '').trim();
    if (!id) return { error: 'Podcast id is required' };
    if (!file?.uri) return { error: 'Episode audio file is required' };

    const formData = new FormData();
    const fileName = file.name || file.uri.split('/').pop() || 'episode.mp3';
    const fileType = getFileTypeFromUri(file.uri, 'audio/mpeg');

    // Поле файлу може відрізнятись на бек-гілках; подаємо audio/file.
    const audioPayload = {
        uri: file.uri,
        name: fileName,
        type: fileType,
    };
    formData.append('audio', audioPayload);
    formData.append('file', audioPayload);

    const safeTitle = String(title || '').trim();
    const safeDescription = String(description || '').trim();
    if (safeTitle) {
        formData.append('title', safeTitle);
        formData.append('name', safeTitle);
    }
    if (safeDescription) {
        formData.append('description', safeDescription);
    }

    try {
        const res = await api.post(`/api/Podcasts/${id}/episodes`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
        });
        podcastEpisodesCache.delete(id);
        podcastEpisodesRequest.delete(id);
        podcastDetailsCache.delete(id);
        podcastDetailsRequest.delete(id);
        myPodcastsCache = null;
        myPodcastsRequest = null;
        removePersistedArrayCache('my_podcasts');
        return { success: true, data: res?.data };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Upload podcast episode failed',
            status: e?.response?.status || null,
        };
    }
};

export const uploadPodcastCover = async ({ podcastId, cover }) => {
    const id = String(podcastId || '').trim();
    if (!id) return { error: 'Podcast id is required' };
    if (!cover?.uri) return { error: 'Cover image is required' };

    const formData = new FormData();
    const fileName = cover.fileName || cover.name || cover.uri.split('/').pop() || 'cover.jpg';
    const fileType = getFileTypeFromUri(cover.uri, 'image/jpeg');

    formData.append('cover', {
        uri: cover.uri,
        name: fileName,
        type: fileType,
    });

    try {
        const res = await api.post(`/api/Podcasts/${id}/cover`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        podcastDetailsCache.delete(id);
        podcastDetailsRequest.delete(id);
        myPodcastsCache = null;
        myPodcastsRequest = null;
        allPodcastsCache = null;
        allPodcastsRequest = null;
        removePersistedArrayCache('my_podcasts');
        removePersistedArrayCache('all_podcasts');
        return { success: true, data: res?.data };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Upload podcast cover failed',
            status: e?.response?.status || null,
        };
    }
};

export const submitPodcast = async (podcastId) => {
    const id = String(podcastId || '').trim();
    if (!id) return { error: 'Podcast id is required' };

    try {
        const res = await api.post(`/api/Podcasts/${id}/submit`, {});
        podcastDetailsCache.delete(id);
        podcastDetailsRequest.delete(id);
        myPodcastsCache = null;
        myPodcastsRequest = null;
        removePersistedArrayCache('my_podcasts');
        return { success: true, data: res?.data };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Submit podcast failed',
            status: e?.response?.status || null,
        };
    }
};

export const getPodcastCoverUrl = (podcast) => {
    if (!podcast) return null;

    const direct =
        toAbsoluteApiUrl(podcast.coverUrl) ||
        toAbsoluteApiUrl(podcast.imageUrl) ||
        toAbsoluteApiUrl(podcast.cover);
    if (direct) return direct;

    const id = podcast.id || podcast.podcastId;
    if (!id) return null;
    return `${API_URL}/api/Podcasts/${id}/cover`;
};

export const getPodcastAudioUrl = (podcast) => {
    if (!podcast) return null;

    const direct = toAbsoluteApiUrl(podcast.audioUrl);
    if (direct) return direct;

    const id = podcast.id || podcast.podcastId;
    if (!id) return null;
    return `${API_URL}/api/Podcasts/${id}/audio`;
};

export const getPodcastEpisodeStreamUrl = (episodeId) => {
    const id = String(episodeId || '').trim();
    if (!id) return null;
    return `${API_URL}/api/Podcasts/episodes/${id}/stream`;
};

export const likePodcast = async (podcastId) => {
    const id = String(podcastId || '').trim();
    if (!id) return { error: 'Podcast id is required' };
    try {
        const res = await api.post(`/api/Podcasts/${id}/like`, {});
        podcastDetailsCache.delete(id);
        podcastDetailsRequest.delete(id);
        myPodcastsCache = null;
        myPodcastsRequest = null;
        allPodcastsCache = null;
        allPodcastsRequest = null;
        removePersistedArrayCache('my_podcasts');
        removePersistedArrayCache('all_podcasts');
        return { success: true, data: res?.data };
    } catch (e) {
        return { error: e?.response?.data || e?.message || 'Like podcast failed' };
    }
};

export const unlikePodcast = async (podcastId) => {
    const id = String(podcastId || '').trim();
    if (!id) return { error: 'Podcast id is required' };
    try {
        const res = await api.post(`/api/Podcasts/${id}/unlike`, {});
        podcastDetailsCache.delete(id);
        podcastDetailsRequest.delete(id);
        myPodcastsCache = null;
        myPodcastsRequest = null;
        allPodcastsCache = null;
        allPodcastsRequest = null;
        removePersistedArrayCache('my_podcasts');
        removePersistedArrayCache('all_podcasts');
        return { success: true, data: res?.data };
    } catch (e) {
        return { error: e?.response?.data || e?.message || 'Unlike podcast failed' };
    }
};

export const getPodcastLikesCount = async (podcastId) => {
    const id = String(podcastId || '').trim();
    if (!id) return 0;

    try {
        const res = await api.get(`/api/Podcasts/${id}/likes-count`);
        const raw = res?.data;
        const value = typeof raw === 'number' ? raw : raw?.likesCount ?? raw?.count ?? 0;
        return Number(value) || 0;
    } catch (_) {
        return 0;
    }
};

export const isPodcastLiked = async (podcastId) => {
    const id = String(podcastId || '').trim();
    if (!id) return false;

    try {
        const res = await api.get(`/api/Podcasts/${id}/liked`);
        const raw = res?.data;
        if (typeof raw === 'boolean') return raw;
        return Boolean(raw?.liked);
    } catch (_) {
        return false;
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

const fetchRecommendationsFromApi = async () => {
    try {
        const res = await api.get('/api/radio/recommendations?limit=10');
        const data = Array.isArray(res?.data) ? res.data : [];
        recommendationsCache = data;
        await writeArrayCache('recommendations', data);
        return data;
    } catch (e) {
        console.log('Get recommendations error:', e);
        return [];
    }
};

const refreshRecommendationsInBackground = () => {
    if (recommendationsRequest) return;
    recommendationsRequest = (async () => {
        try {
            return await fetchRecommendationsFromApi();
        } finally {
            recommendationsRequest = null;
        }
    })();
};

export const getRecommendations = async () => {
    if (recommendationsCache) return recommendationsCache;
    if (recommendationsRequest) return recommendationsRequest;

    recommendationsRequest = (async () => {
        const cached = await readArrayCache('recommendations', CACHE_TTL.recommendations, true);
        if (cached.data) {
            recommendationsCache = cached.data;
            if (cached.stale) setTimeout(() => refreshRecommendationsInBackground(), 0);
            return recommendationsCache;
        }
        return fetchRecommendationsFromApi();
    })().finally(() => {
        recommendationsRequest = null;
    });

    return recommendationsRequest;
};

// 2. Всі артисти (Кружечки)
const fetchAllArtistsFromApi = async () => {
    try {
        // Current backend route lives in TracksController: GET /api/Tracks/artists
        const res = await api.get('/api/Tracks/artists');
        const data = Array.isArray(res?.data) ? res.data : [];
        artistsCache = data;
        await writeArrayCache('artists', data);
        return data;
    } catch (e) {
        // Backward compatibility with older backend snapshots
        try {
            const legacy = await api.get('/api/Artists');
            const data = Array.isArray(legacy?.data) ? legacy.data : [];
            artistsCache = data;
            await writeArrayCache('artists', data);
            return data;
        } catch (legacyErr) {
            console.log('Get artists error:', legacyErr);
            return [];
        }
    }
};

const refreshAllArtistsInBackground = () => {
    if (artistsRequest) return;
    artistsRequest = (async () => {
        try {
            return await fetchAllArtistsFromApi();
        } finally {
            artistsRequest = null;
        }
    })();
};

export const getAllArtists = async () => {
    if (artistsCache) return artistsCache;
    if (artistsRequest) return artistsRequest;

    artistsRequest = (async () => {
        const cached = await readArrayCache('artists', CACHE_TTL.artists, true);
        if (cached.data) {
            artistsCache = cached.data;
            if (cached.stale) setTimeout(() => refreshAllArtistsInBackground(), 0);
            return artistsCache;
        }
        return fetchAllArtistsFromApi();
    })().finally(() => {
        artistsRequest = null;
    });

    return artistsRequest;
};

export const subscribeToArtist = async (artistId) => {
    const id = String(artistId || '').trim();
    if (!id) return { error: 'Invalid artistId' };

    try {
        await api.post(`/api/Auth/subscribe/${id}`);
        subscriptionsCache = null;
        subscriptionsRequest = null;
        removePersistedArrayCache('subscriptions');
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
        subscriptionsCache = null;
        subscriptionsRequest = null;
        removePersistedArrayCache('subscriptions');
        return { success: true };
    } catch (e) {
        return {
            error: e?.response?.data || e?.message || 'Unsubscribe failed',
            status: e?.response?.status || null,
        };
    }
};

export const getSubscriptions = async () => {
    if (subscriptionsCache) return subscriptionsCache;
    if (subscriptionsRequest) return subscriptionsRequest;

    subscriptionsRequest = (async () => {
        const cached = await readArrayCache('subscriptions', CACHE_TTL.subscriptions, true);
        if (cached.data) {
            subscriptionsCache = cached.data;
            return subscriptionsCache;
        }
        try {
            const res = await api.get('/api/Auth/subscriptions');
            const data = Array.isArray(res?.data) ? res.data : [];
            subscriptionsCache = data;
            await writeArrayCache('subscriptions', data);
            return data;
        } catch (_) {
            return [];
        }
    })().finally(() => {
        subscriptionsRequest = null;
    });

    return subscriptionsRequest;
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
const fetchRecentlyPlayedFromApi = async () => {
    try {
        const res = await api.get('/api/radio/history');
        const data = Array.isArray(res?.data) ? res.data : [];
        recentPlayedCache = data;
        await writeArrayCache('recent_played', data);
        return data;
    } catch (e) {
        console.log('Get recent error:', e);
        return [];
    }
};

const refreshRecentlyPlayedInBackground = () => {
    if (recentPlayedRequest) return;
    recentPlayedRequest = (async () => {
        try {
            return await fetchRecentlyPlayedFromApi();
        } finally {
            recentPlayedRequest = null;
        }
    })();
};

export const getRecentlyPlayed = async (forceRefresh = false) => {
    if (!forceRefresh && recentPlayedCache) return recentPlayedCache;
    if (recentPlayedRequest) return recentPlayedRequest;

    recentPlayedRequest = (async () => {
        if (!forceRefresh) {
            const cached = await readArrayCache('recent_played', CACHE_TTL.recentPlayed, true);
            if (cached.data) {
                recentPlayedCache = cached.data;
                if (cached.stale) setTimeout(() => refreshRecentlyPlayedInBackground(), 0);
                return recentPlayedCache;
            }
        }
        return fetchRecentlyPlayedFromApi();
    })().finally(() => {
        recentPlayedRequest = null;
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

const prefetchImageUrls = async (urls, limit = 24) => {
    const uniqueUrls = Array.from(
        new Set(
            (Array.isArray(urls) ? urls : [])
                .map((item) => String(item || '').trim())
                .filter((item) => /^https?:\/\//i.test(item))
        )
    ).slice(0, limit);

    if (uniqueUrls.length === 0) return;

    await Promise.allSettled(
        uniqueUrls.map(async (uri) => {
            if (iconsPrefetchCache.has(uri)) return;
            iconsPrefetchCache.add(uri);
            try {
                await Image.prefetch(uri);
            } catch (_) {
                iconsPrefetchCache.delete(uri);
            }
        })
    );
};

/**
 * Warm core app data on startup to reduce "first open" delays on Discover/Search/Library/Profile.
 * Runs in background and never throws.
 */
export const warmAppStartupData = async () => {
    try {
        const hasToken = !!(await AsyncStorage.getItem('userToken'));
        const safeList = async (fn) => {
            try {
                const value = await fn();
                return Array.isArray(value) ? value : [];
            } catch (_) {
                return [];
            }
        };

        await warmPlayerAssets().catch(() => {});

        const [tracks, recommendations, albums, artists, banners, allPodcasts] = await Promise.all([
            safeList(getTracks),
            safeList(getRecommendations),
            safeList(getAlbums),
            safeList(getAllArtists),
            safeList(getBanners),
            safeList(getAllPodcasts),
            safeList(getPodcastGenres),
            safeList(getGenres),
            safeList(getRecentlyPlayed),
            safeList(getCountries),
            safeList(getArtistSpecializations),
        ]);

        const publicImageUrls = [
            ...tracks.slice(0, 10).map((track) => getTrackCoverUrl(track)),
            ...recommendations.slice(0, 10).map((track) => getTrackCoverUrl(track)),
            ...albums.slice(0, 8).map((album) => getAlbumCoverUrl(album?.id)),
            ...artists.slice(0, 10).map((artist) => toAbsoluteApiUrl(artist?.avatarUrl) || getUserAvatarUrl(artist?.userId || artist?.ownerId || artist?.id)),
            ...banners.slice(0, 2).map((banner) => getBannerImageUrl(banner)),
            ...allPodcasts.slice(0, 8).map((podcast) => getPodcastCoverUrl(podcast)),
        ];
        await prefetchImageUrls(publicImageUrls, 30);

        if (!hasToken) return;

        const [myPlaylists, myAlbums, myTracks, subscriptions, myPodcasts] = await Promise.all([
            safeList(getMyPlaylists),
            safeList(getMyAlbums),
            safeList(getMyTracks),
            safeList(getSubscriptions),
            safeList(getMyPodcasts),
            safeList(getLikedTracks),
            safeList(getLikedAlbums),
            safeList(() => getRecentlyPlayed(true)),
        ]);

        const privateImageUrls = [
            ...myTracks.slice(0, 12).map((track) => getTrackCoverUrl(track)),
            ...myAlbums.slice(0, 8).map((album) => getAlbumCoverUrl(album?.id)),
            ...myPlaylists.slice(0, 8).map((playlist) => getPlaylistCoverUrl(playlist?.id)),
            ...subscriptions.slice(0, 8).map((artist) => toAbsoluteApiUrl(artist?.avatarUrl) || getUserAvatarUrl(artist?.id || artist?.artistId || artist?.userId)),
            ...myPodcasts.slice(0, 8).map((podcast) => getPodcastCoverUrl(podcast)),
        ];
        await prefetchImageUrls(privateImageUrls, 36);
    } catch (_) {
        // warmup should never block app launch
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

    const directCover = track.coverUrl || track.imageUrl || track.cover;
    if (typeof directCover === 'string' && directCover.trim().length > 0) {
        if (directCover.startsWith('http')) return directCover;
        return directCover.startsWith('/') ? `${API_URL}${directCover}` : `${API_URL}/${directCover}`;
    }

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
