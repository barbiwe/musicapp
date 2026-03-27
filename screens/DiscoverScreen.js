import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Platform,
    Linking,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { usePlayerStore } from '../store/usePlayerStore';

import {
    getTracks,
    getAlbums,
    getCachedTracks,
    getCachedAlbums,
    getCachedRecentlyPlayed,
    getCachedRecommendations,
    getTrackCoverUrl,
    getUserAvatarUrl,
    getRecentlyPlayed,
    getRecommendations,
    getIcons,
    getBanners,
    getBannerImageUrl,
    isPremiumUser,
    refreshUserToken,
    getArtistFollowersCount,
    getTrackPlays,
    scale
} from '../api/api';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const svgCache = {};
const PREMIUM_BANNER_INVALIDATE_KEY = 'premium_banner_invalidate_v1';
const getTrackId = (track) =>
    String(track?.id || track?._id || track?.trackId || track?.track?.id || '').trim();

const mapRecentHistoryItems = (recentRes) => {
    const safeRecent = Array.isArray(recentRes) ? recentRes : [];
    return safeRecent.map((item) => {
        if (item?.track) {
            return {
                ...item.track,
                artist: { name: item.track.artistName || 'Unknown' },
            };
        }
        return item;
    });
};

const extractArtistsFromTracks = (tracks) => {
    const safeTracks = Array.isArray(tracks) ? tracks : [];
    const map = new Map();
    safeTracks.forEach((t) => {
        const artistName = t.artistName || t.artist?.name || 'Unknown Artist';
        const backendArtistId = t.artistId || t.ArtistId || t.artist?.id || t.artist?._id;
        if (backendArtistId && !map.has(String(backendArtistId))) {
            map.set(String(backendArtistId), {
                id: String(backendArtistId),
                artistId: String(backendArtistId),
                name: artistName,
                userId: t.ownerId || t.OwnerId || null,
            });
        }
    });
    return [...map.values()];
};

const ArtistAvatar = ({ uri, name }) => {
    const [imgError, setImgError] = useState(false);

    if (imgError || !uri) {
        return (
            <View style={[styles.artistAvatar, styles.center, { backgroundColor: '#555' }]}>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>
                    {name ? name.charAt(0).toUpperCase() : '?'}
                </Text>
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={styles.artistAvatar}
            onError={() => setImgError(true)}
        />
    );
};

const formatFollowersCount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
    return String(Math.floor(n));
};

const formatPlaysCount = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace('.0', '')}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}K`;
    return String(Math.floor(n));
};


const ArtistCard = ({ artist, onPress, getAvatar, bgColor }) => {
    const followers = Number.isFinite(artist.followersCount) ? artist.followersCount : 0;
    const compactFollowers = formatFollowersCount(followers);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={styles.artistCardWrapper}
        >
            {/* Підключаємо динамічний колір фону */}
            <View style={[styles.artistCard, { backgroundColor: bgColor || '#290A09' }]}>
                <View style={styles.artistCardInfo}>
                    <Text style={styles.artistCardName} numberOfLines={2}>
                        {artist.name}
                    </Text>

                    <Text style={styles.artistCardListeners}>
                        {compactFollowers} listeners
                    </Text>
                </View>

                <Image
                    source={{ uri: getAvatar(artist.userId || artist.ownerId || artist.id) }}
                    style={styles.artistCardImage}
                    resizeMode="cover"
                />
            </View>
        </TouchableOpacity>
    );
};

const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }

        if (uri) {
            fetch(uri)
                .then(response => response.text())
                .then(svgContent => {
                    if (isMounted) {
                        let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');

                        if (color) {
                            cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
                            cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
                        }

                        cleanXml = cleanXml.replace(/###NONE###/g, 'fill="none"');

                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }

        return () => { isMounted = false; };
    }, [cacheKey]);

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

export default function DiscoverScreen({ navigation }) {
    const isFocused = useIsFocused();
    const setTrack = usePlayerStore((state) => state.setTrack);
    const initialTracks = getCachedTracks() || [];
    const initialAlbums = getCachedAlbums() || [];
    const initialRecommendations = getCachedRecommendations() || [];
    const initialRecentTracks = mapRecentHistoryItems(getCachedRecentlyPlayed() || []);
    const initialArtists = extractArtistsFromTracks(initialTracks);
    const hasInitialWarmData =
        initialTracks.length > 0 ||
        initialAlbums.length > 0 ||
        initialRecommendations.length > 0 ||
        initialRecentTracks.length > 0;
    const [loading, setLoading] = useState(!hasInitialWarmData);
    const [tracks, setTracks] = useState(initialTracks);
    const [popularTracks, setPopularTracks] = useState(
        initialTracks.map((track) => ({ ...track, playsCount: 0 }))
    );
    const [recentTracks, setRecentTracks] = useState(initialRecentTracks);
    const [recommendations, setRecommendations] = useState(initialRecommendations);
    const [artists, setArtists] = useState(initialArtists);
    const [albums, setAlbums] = useState(initialAlbums);
    const [icons, setIcons] = useState({});
    const [discoverBanner, setDiscoverBanner] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const [myId, setMyId] = useState(null);
    const loadReqIdRef = useRef(0);
    const hasLoadedOnceRef = useRef(false);
    const syncingPremiumBannerRef = useRef(false);
    const syncingRecentRef = useRef(false);

    const mapRecentHistory = useCallback((recentRes) => mapRecentHistoryItems(recentRes), []);

    const syncPremiumBanner = useCallback(async (options = {}) => {
        const forceRefreshToken = !!options?.forceRefreshToken;
        const forceBannerRefresh = !!options?.forceBannerRefresh;
        if (syncingPremiumBannerRef.current) return;
        syncingPremiumBannerRef.current = true;
        try {
            if (forceRefreshToken) {
                await refreshUserToken();
            }
            const premium = await isPremiumUser();
            setIsPremium(!!premium);
            if (premium) {
                setDiscoverBanner(null);
                return;
            }
            const bannersRes = await getBanners({ force: forceBannerRefresh });
            const firstBanner = (Array.isArray(bannersRes) ? bannersRes : [])
                .find((banner) => !!getBannerImageUrl(banner)) || null;
            setDiscoverBanner(firstBanner);
        } catch (_) {
            // keep current UI state on soft sync errors
        } finally {
            syncingPremiumBannerRef.current = false;
        }
    }, []);

    const syncPremiumBannerIfInvalidated = useCallback(async () => {
        try {
            const invalidateAt = await AsyncStorage.getItem(PREMIUM_BANNER_INVALIDATE_KEY);
            if (!invalidateAt) return false;
            await AsyncStorage.removeItem(PREMIUM_BANNER_INVALIDATE_KEY);
            // Payment just happened -> refresh token first, then refresh only banner state.
            await syncPremiumBanner({ forceRefreshToken: true, forceBannerRefresh: true });
            return true;
        } catch (_) {
            // ignore invalidation sync errors
            return false;
        }
    }, [syncPremiumBanner]);

    const syncRecentPlayed = useCallback(async ({ force = true } = {}) => {
        if (syncingRecentRef.current) return;
        syncingRecentRef.current = true;
        try {
            const recentRes = await getRecentlyPlayed(!!force);
            setRecentTracks(mapRecentHistory(recentRes));
        } catch (_) {
            // keep current UI state on soft sync errors
        } finally {
            syncingRecentRef.current = false;
        }
    }, [mapRecentHistory]);

    useEffect(() => {
        if (!isFocused) return;
        if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            load();
            return;
        }
        if (tracks.length === 0 || recommendations.length === 0) {
            load();
            return;
        }
        void (async () => {
            const invalidated = await syncPremiumBannerIfInvalidated();
            if (!invalidated) {
                // Lightweight focus sync: keep banner/premium state in sync without reloading Discover data.
                await syncPremiumBanner({ forceBannerRefresh: true });
            }
            // Lightweight focus sync for "Recently played" without full Discover reload.
            await syncRecentPlayed({ force: true });
        })();
    }, [isFocused, tracks.length, recommendations.length, syncPremiumBannerIfInvalidated, syncPremiumBanner, syncRecentPlayed]);

    const load = async () => {
        const reqId = ++loadReqIdRef.current;
        const hasWarmData =
            tracks.length > 0 ||
            recommendations.length > 0 ||
            recentTracks.length > 0 ||
            albums.length > 0;
        if (!hasWarmData) setLoading(true);

        try {
            const currentUserId = await AsyncStorage.getItem('userId');
            if (currentUserId && reqId === loadReqIdRef.current) setMyId(currentUserId);

            const [tracksRes, albumsRes, iconsRes, recentRes, recsRes, premium] = await Promise.all([
                getTracks({ force: !hasWarmData }),
                getAlbums({ force: !hasWarmData }),
                Object.keys(icons || {}).length === 0 ? getIcons() : Promise.resolve(icons),
                getRecentlyPlayed(!hasWarmData),
                getRecommendations({ force: !hasWarmData }),
                isPremiumUser(),
            ]);

            if (reqId !== loadReqIdRef.current) return;

            setIsPremium(!!premium);

            const safeTracks = Array.isArray(tracksRes) ? tracksRes : [];
            const safeAlbums = Array.isArray(albumsRes) ? albumsRes : [];
            const safeRecent = Array.isArray(recentRes) ? recentRes : [];
            const safeRecs = Array.isArray(recsRes) ? recsRes : [];

            setTracks(safeTracks);
            setAlbums(safeAlbums);
            setIcons(iconsRes || {});
            setPopularTracks(safeTracks.map((track) => ({ ...track, playsCount: 0 })));

            const formattedHistory = mapRecentHistory(safeRecent);
            setRecentTracks(formattedHistory);

            const map = new Map();
            safeTracks.forEach(t => {
                const artistName = t.artistName || t.artist?.name || 'Unknown Artist';
                const backendArtistId = t.artistId || t.ArtistId || t.artist?.id || t.artist?._id;
                if (backendArtistId && !map.has(String(backendArtistId))) {
                    map.set(String(backendArtistId), {
                        id: String(backendArtistId),
                        artistId: String(backendArtistId),
                        name: artistName,
                        userId: t.ownerId || t.OwnerId || null,
                    });
                }
            });
            const mappedArtists = [...map.values()];
            setArtists(mappedArtists);
            const formattedRecs = safeRecs.map(r => ({
                id: r.trackId,
                title: r.title,
                artist: { name: r.artistName || 'Unknown' },
                reasons: r.reasons,
                coverFileId: r.coverFileId,
                fileId: r.fileId
            }));
            setRecommendations(formattedRecs);

            // Do not block UI with heavy counters/followers/banner requests.
            if (!hasWarmData) setLoading(false);

            Promise.all(
                safeTracks.map(async (track) => {
                    const trackId = getTrackId(track);
                    if (!trackId) return [trackId, 0];
                    try {
                        const plays = await getTrackPlays(trackId);
                        return [trackId, Number.isFinite(plays) ? plays : 0];
                    } catch (_) {
                        return [trackId, 0];
                    }
                })
            ).then((pairs) => {
                if (reqId !== loadReqIdRef.current) return;
                const playsByTrackId = Object.fromEntries((pairs || []).filter(([id]) => !!id));
                const sortedByPlays = [...safeTracks].sort((a, b) => {
                    const aPlays = playsByTrackId[getTrackId(a)] ?? 0;
                    const bPlays = playsByTrackId[getTrackId(b)] ?? 0;
                    return bPlays - aPlays;
                });
                setPopularTracks(
                    sortedByPlays.map((track) => ({
                        ...track,
                        playsCount: playsByTrackId[getTrackId(track)] ?? 0,
                    }))
                );
            }).catch(() => {});

            Promise.all(
                mappedArtists.map(async (artist) => {
                    try {
                        const count = await getArtistFollowersCount(artist.artistId || artist.id);
                        return [artist.id, Number.isFinite(count) ? count : 0];
                    } catch (_) {
                        return [artist.id, 0];
                    }
                })
            ).then((followersPairs) => {
                if (reqId !== loadReqIdRef.current) return;
                const followersByArtistId = Object.fromEntries(followersPairs || []);
                setArtists((prev) => prev.map((artist) => ({
                    ...artist,
                    followersCount: followersByArtistId[artist.id] ?? 0,
                })));
            }).catch(() => {});

            if (!premium) {
                getBanners()
                    .then((bannersRes) => {
                        if (reqId !== loadReqIdRef.current) return;
                        const firstBanner = (Array.isArray(bannersRes) ? bannersRes : [])
                            .find((banner) => !!getBannerImageUrl(banner)) || null;
                        setDiscoverBanner(firstBanner);
                    })
                    .catch(() => {});
            } else {
                setDiscoverBanner(null);
            }

        } catch (e) {
            console.log('Discover load error', e);
            hasLoadedOnceRef.current = false;
            if (reqId === loadReqIdRef.current && !hasWarmData) {
                setLoading(false);
            }
        } finally {
            if (reqId === loadReqIdRef.current && !hasWarmData) {
                setLoading(false);
            }
        }
    };


    const getAvatar = (userId) => getUserAvatarUrl(userId);

    const normalizeExternalUrl = (rawUrl) => {
        if (!rawUrl || typeof rawUrl !== 'string') return null;
        const trimmed = rawUrl.trim();
        if (!trimmed) return null;

        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
            return trimmed;
        }

        return `https://${trimmed}`;
    };

    const discoverBannerLink = normalizeExternalUrl(
        discoverBanner?.link ||
        discoverBanner?.Link ||
        discoverBanner?.url ||
        discoverBanner?.Url ||
        discoverBanner?.targetUrl ||
        discoverBanner?.TargetUrl ||
        discoverBanner?.targetURL ||
        discoverBanner?.TargetURL ||
        null
    );

    const handleDiscoverBannerPress = async () => {
        if (!discoverBannerLink) return;
        try {
            const supported = await Linking.canOpenURL(discoverBannerLink);
            if (supported) {
                await Linking.openURL(discoverBannerLink);
            }
        } catch (_) {
            // ignore invalid link from backend
        }
    };

    const handlePlayRandomTrack = async () => {
        const pool = [...tracks, ...recentTracks, ...recommendations]
            .filter((track) => !!getTrackId(track));

        if (pool.length === 0) return;

        const randomIndex = Math.floor(Math.random() * pool.length);
        const randomTrack = pool[randomIndex];

        try {
            await setTrack(randomTrack);
        } catch (_) {
            // ignore random play error
        }
    };

    const renderIcon = (iconName, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;

                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={width}
                        height={height}
                        color={tintColor}
                    />
                );
            }

            const imageStyle = [style];
            if (tintColor) {
                imageStyle.push({ tintColor: tintColor });
            }

            return (
                <Image
                    source={{ uri: iconUrl }}
                    style={imageStyle}
                    resizeMode="contain"
                />
            );
        }

        return null;
    };

    const chunkArray = (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    };

    const artistPairs = chunkArray(artists, 2);

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#fff"/>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="light-content"
                translucent={true}
                backgroundColor="transparent"
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.gradient}
                >
                    <SafeAreaView style={styles.safeArea}>

                        {/* HEADER */}
                        <View style={styles.headerContainer}>
                            <View style={styles.watermarkLogo}>
                                {renderIcon('VOX.svg', { width: scale(209), height: scale(84) }, '#fff')}
                            </View>

                            <View style={styles.headerContentRow}>
                                <Text style={styles.headerTitle}>
                                    Discover
                                </Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity
                                        style={{ marginRight: scale(16) }}
                                        onPress={() => navigation.navigate('ProScreen')}
                                        activeOpacity={0.7}
                                    >
                                        {renderIcon('pro1.svg', { width: 24, height: 24 }, '#fff')}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('Profile')}
                                        activeOpacity={0.7}

                                    >
                                        {renderIcon('Profile.svg', { width: 24, height: 24 }, '#fff')}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* RECOMMENDED FOR YOU */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Recommended for you
                            </Text>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 20 }}
                                snapToInterval={CARD_WIDTH + 12}
                                decelerationRate="fast"
                            >
                                {artistPairs.map((pair, columnIndex) => (
                                    <View key={columnIndex} style={{ marginRight: 12 }}>
                                        {pair.map((artist, i) => (
                                            <ArtistCard
                                                key={artist.id || i}
                                                artist={artist}
                                                icons={icons}
                                                getAvatar={getAvatar}
                                                onPress={() => navigation.navigate('ArtistProfile', { artist: artist })}
                                                // 👇 Додаємо різні кольори для 1-ї та 2-ї картки в колонці
                                                bgColor={i === 0 ? '#1B0707' : '#290A09'}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </ScrollView>
                        </View>

                        {/* DISCOVER BANNER */}
                        {discoverBanner && !isPremium ? (
                            <View style={styles.bannerSection}>
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={handleDiscoverBannerPress}
                                    disabled={!discoverBannerLink}
                                    style={styles.bannerTouch}
                                >
                                    <Image
                                        source={{ uri: getBannerImageUrl(discoverBanner) }}
                                        style={styles.discoverBannerImage}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            </View>
                        ) : null}


                        {/* RECENTLY PLAYED */}
                        <View style={styles.section}>
                            {/* Заголовок з кубиком */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginLeft: scale(16),
                                marginRight: scale(16),
                                marginBottom: scale(16)
                            }}>
                                <Text style={[styles.sectionTitle, { marginLeft: 0, marginBottom: 0 }]}>
                                    Recently played
                                </Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={handlePlayRandomTrack}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    {renderIcon('cube.svg', { width: scale(36), height: scale(36) }, '#F5D8CB')}
                                </TouchableOpacity>
                            </View>

                            {recentTracks.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.row}>
                                        {recentTracks.map((t, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.square}
                                                onPress={() => { setTrack(t); }}
                                            >
                                                <Image
                                                    source={{ uri: getTrackCoverUrl(t) }}
                                                    style={styles.squareImage}
                                                />
                                                <Text style={styles.trackTitle} numberOfLines={1}>
                                                    {t.title}
                                                </Text>
                                                <Text style={styles.trackArtist} numberOfLines={1}>
                                                    {t.artistName || t.artist?.name || 'Unknown Artist'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            ) : (
                                <Text style={{ textAlign: 'center', color: '#B9B9B9', fontFamily: 'Poppins-Regular', fontSize: scale(14), marginVertical: scale(20) }}>
                                    No recently played
                                </Text>
                            )}
                        </View>


                        {/* POPULAR SONGS */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Popular songs
                            </Text>

                            {popularTracks.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.row}>
                                        {popularTracks.slice(0, 10).map((t, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.square}
                                                onPress={() => { setTrack(t); }}
                                            >
                                                <View style={{ position: 'relative' }}>
                                                    <Image
                                                        source={{ uri: getTrackCoverUrl(t) }}
                                                        style={styles.squareImage}
                                                    />

                                                    {/* Кружечок з текстом */}
                                                    <View style={{
                                                        position: 'absolute',
                                                        bottom: scale(14),
                                                        left: '50%',
                                                        transform: [{ translateX: -scale(16) }], // Центруємо відносно ширини 32
                                                        width: scale(32), // Трохи ширше для тексту
                                                        height: scale(20), // Менша висота для овальної форми, або 24 для кола
                                                        borderRadius: scale(10), // Половина висоти для округлих країв
                                                        overflow: 'hidden'
                                                    }}>
                                                        <BlurView intensity={60} tint="dark" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                                            <Text style={{
                                                                color: '#F5D8CB',
                                                                fontSize: scale(9),
                                                                fontFamily: 'Poppins-Medium',
                                                                textAlign: 'center'
                                                            }}>
                                                                {formatPlaysCount(t.playsCount || 0)}
                                                            </Text>
                                                        </BlurView>
                                                    </View>
                                                </View>

                                                <Text style={styles.trackTitle} numberOfLines={1}>
                                                    {t.title}
                                                </Text>
                                                <Text style={styles.trackArtist} numberOfLines={1}>
                                                    {t.artistName || t.artist?.name || 'Unknown Artist'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            )}
                        </View>


                        {/* ARTISTS */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Artist
                            </Text>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.row}>
                                    {artists.map((a, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={styles.artist}
                                            onPress={() => navigation.navigate('ArtistProfile', { artist: a })}
                                        >
                                            <ArtistAvatar
                                                uri={getAvatar(a.userId || a.ownerId || a.id)}
                                                name={a.name}
                                            />
                                            <Text style={styles.artistName} numberOfLines={1}>
                                                {a.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>


                        {/* YOUR HERITAGE */}
                        <View style={[styles.section, { marginBottom: scale(150) }]}>
                            <Text style={styles.sectionTitle}>
                                Your heritage
                            </Text>

                            {recommendations.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.row}>
                                        {recommendations.map((t, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.square}
                                                onPress={() => { setTrack(t); }}
                                            >
                                                <Image
                                                    source={{ uri: getTrackCoverUrl(t) }}
                                                    style={styles.squareImage}
                                                />
                                                <Text style={styles.trackTitle} numberOfLines={1}>
                                                    {t.title}
                                                </Text>
                                                <Text style={styles.trackArtist} numberOfLines={1}>
                                                    {t.artist?.name || 'Unknown'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            ) : (
                                <Text style={{
                                    color: 'rgba(255,255,255,0.5)',
                                    marginLeft: 20,
                                    fontFamily: 'Poppins-Regular',
                                    fontSize: 12
                                }}>
                                    Listen to more music to get recommendations...
                                </Text>
                            )}
                        </View>

                    </SafeAreaView>
                </LinearGradient>
            </ScrollView>
        </View>
    );
}

// СТИЛІ БЕЗ ЗМІН
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707'
    },
    gradient: {
        minHeight: height,
        paddingBottom: scale(100),

    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 60 : 0,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerContainer: {
        position: 'relative',
        marginHorizontal: scale(20),
        marginTop: scale(-30),
        marginBottom: scale(60),
        height: scale(80),
        justifyContent: 'flex-end',
    },
    watermarkLogo: {
        position: 'absolute',
        top: scale(10),
        left: scale(-10),
        zIndex: 0,
        opacity: 0.8,
    },
    headerContentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1,
    },
    headerTitle: {
        fontSize: scale(32),
        fontFamily: 'Unbounded-Regular',
        color: '#fff',
        letterSpacing: 0.5,
    },
    section: {
        marginBottom: scale(32)
    },
    bannerSection: {
        marginBottom: scale(32),
        alignItems: 'center',
    },
    bannerTouch: {
        width: scale(341),
        height: scale(160),
    },
    discoverBannerImage: {
        width: scale(341),
        height: scale(160),
        borderRadius: scale(24),
    },
    sectionTitle: {
        marginLeft: scale(20),
        marginBottom: scale(16),
        fontSize: scale(15),
        fontFamily: 'Unbounded-Medium',
        color: '#fff',
    },
    artistCardWrapper: {
        marginBottom: scale(8),
        borderRadius: scale(24),

    },
    artistCard: {
        width: scale(335),
        height: scale(132),
        borderRadius: scale(24),
        flexDirection: 'row',
        padding: scale(6),
        overflow: 'hidden',
        backgroundColor: '#290A09',
        backgroundOpacity: 0.9 ,
    },
    artistCardInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: scale(8),
        paddingHorizontal: scale(8),
    },
    artistCardName: {
        fontSize: scale(24),
        fontFamily: 'Unbounded-Regular',
        color: '#fff',
        lineHeight: scale(26),
    },
    artistCardListeners: {
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        color: '#B9B9B9',
        fontWeight: '500',
    },
    artistCardImage: {
        width: scale(120),
        height: '100%',
        borderRadius: scale(20),
        backgroundColor: '#333',
    },
    row: {
        paddingHorizontal: scale(20),
        flexDirection: 'row'
    },
    artist: {
        width: scale(75),
        marginRight: scale(16),
        alignItems: 'center'
    },
    artistAvatar: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(56),
        backgroundColor: '#777'
    },
    artistName: {
        marginTop: scale(8),
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        color: '#B9B9B9',
        textAlign: 'center'
    },
    square: {
        width: scale(120),
        marginRight: scale(16)
    },
    squareImage: {
        width: scale(120),
        height: scale(120),
        borderRadius: scale(18),
        backgroundColor: '#333',
        marginBottom: scale(8)
    },
    trackTitle: {
        fontSize: scale(14),
        fontFamily: 'Unbounded-Medium',
        color: '#fff',
        fontWeight: '600'
    },
    trackArtist: {
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
        color: '#B9B9B9'
    },
    emptyStateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        opacity: 0.7
    },
    emptyVinyl: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(25),
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(15)
    },
    emptyStateTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Medium',
        fontSize: scale(14),
        marginBottom: 2
    },
    emptyStateSubtitle: {
        color: '#B9B9B9',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12)
    }
});
