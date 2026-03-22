import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgUri, SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import {
    getTracks,
    getUserAvatarUrl,
    getIcons,
    getTrackCoverUrl,
    getAlbums,       // 👇 Додано
    getAlbumCoverUrl, // 👇 Додано
    subscribeToArtist,
    unsubscribeFromArtist,
    getArtistSubscriptionStatus,
    getArtistFollowersCount,
    getTrackPlays,
    getSubscriptions,
    resolveArtistName,
    scale
} from '../api/api';
const { width, height } = Dimensions.get('window');
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const svgCache = {};
// 👇 Цей компонент завантажує SVG, чистить, фарбує і КЕШУЄ результат
const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        // 1. Якщо у нас вже є правильна картинка в кеші — беремо її і виходимо
        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }

        // 2. Якщо в кеші немає — вантажимо
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

                        // Зберігаємо в кеш
                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }

        return () => { isMounted = false; };
    }, [cacheKey]); // 🔥 Головне: реагуємо на зміну ключа, а не ігноруємо її

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

const resolveArtistId = (artist) =>
    artist?.artistId ||
    artist?.ArtistId ||
    artist?.artist?.artistId ||
    artist?.artist?.ArtistId ||
    artist?.artist?.id ||
    artist?.artist?._id ||
    artist?.id ||
    artist?.Id ||
    artist?._id ||
    null;

const formatFollowers = (value) => {
    const num = Number(value) || 0;
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return String(num);
};

const normalizeName = (value) => String(value || '').trim().toLowerCase();

const extractSubscriptionIds = (item) => (
    [
        item?.artistId,
        item?.ArtistId,
        item?.artist?.artistId,
        item?.artist?.ArtistId,
        item?.artist?.id,
        item?.artist?._id,
        item?.id,
        item?.Id,
        item?._id,
    ]
        .filter(Boolean)
        .map((id) => String(id))
);

const resolveSubscriptionArtistFromItem = (item) => {
    if (!item || typeof item !== 'object') return null;

    const ids = [...new Set(extractSubscriptionIds(item))];
    const id = ids[0] || null;

    const name =
        item.artistName ||
        item.name ||
        item.username ||
        item.displayName ||
        item.artist?.name ||
        null;

    if (!id && !name) return null;
    return { id: id ? String(id) : null, ids, name };
};

const collectArtistIdCandidates = (artist, artistTracks, explicitArtistId) => {
    const ids = [
        explicitArtistId,
        artist?.Id,
        artist?.artistId,
        artist?.ArtistId,
        artist?.artist?.id,
        artist?.artist?._id,
        artist?.artist?.artistId,
        artist?.artist?.ArtistId,
    ];

    (artistTracks || []).forEach((t) => {
        ids.push(
            t?.artistId,
            t?.ArtistId,
            t?.artist?.id,
            t?.artist?._id
        );
    });

    return [...new Set(ids.filter(Boolean).map((id) => String(id)))];
};

const resolveTrackId = (track) =>
    track?.id ||
    track?.Id ||
    track?._id ||
    track?.trackId ||
    track?.TrackId ||
    null;

const artistProfileSessionCache = new Map();

export default function ArtistProfileScreen({ navigation, route }) {
    const { artist } = route.params || {};
    const artistId = resolveArtistId(artist);
    const profileCacheKey = `${String(artistId || '')}:${normalizeName(artist?.name)}`;

    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [trackPlaysMap, setTrackPlaysMap] = useState({});
    const [albums, setAlbums] = useState([]); // 👇 Стейт для альбомів
    const [icons, setIcons] = useState({});
    const [isFollowing, setIsFollowing] = useState(false);
    const [followersCount, setFollowersCount] = useState(0);
    const [followBusy, setFollowBusy] = useState(false);
    const [subscriptionArtistId, setSubscriptionArtistId] = useState(artistId ? String(artistId) : null);
    const loadReqIdRef = useRef(0);

    useEffect(() => {
        const cached = artistProfileSessionCache.get(profileCacheKey);
        if (cached) {
            setTracks(cached.tracks || []);
            setTrackPlaysMap(cached.trackPlaysMap || {});
            setAlbums(cached.albums || []);
            setIcons(cached.icons || {});
            setSubscriptionArtistId(cached.subscriptionArtistId || (artistId ? String(artistId) : null));
            setIsFollowing(!!cached.isFollowing);
            setFollowersCount(Number(cached.followersCount) || 0);
            setLoading(false);
            return;
        }

        loadData({ withLoader: true, cacheKey: profileCacheKey });
    }, [profileCacheKey]);

    const loadData = async ({ withLoader = false, cacheKey = profileCacheKey } = {}) => {
        const reqId = ++loadReqIdRef.current;
        if (withLoader) {
            setLoading(true);
        }

        try {
            // 👇 Завантажуємо треки, АЛЬБОМИ та іконки
            const [tracksRes, albumsRes, iconsRes] = await Promise.all([
                getTracks(),
                getAlbums(),
                getIcons()
            ]);

            if (reqId !== loadReqIdRef.current) return;

            setIcons(iconsRes || {});
            const artistNameKey = normalizeName(artist?.name);

            // 1. Фільтруємо ТРЕКИ артиста
            const artistTracks = tracksRes.filter(t =>
                (t.artistId && String(t.artistId) === String(artistId)) ||
                (t.ArtistId && String(t.ArtistId) === String(artistId)) ||
                normalizeName(resolveArtistName(t, '')) === artistNameKey
            );
            setTracks(artistTracks);

            const playPairs = await Promise.all(
                artistTracks.map(async (track) => {
                    const id = resolveTrackId(track);
                    if (!id) return [null, 0];
                    const plays = await getTrackPlays(id);
                    return [String(id), Number(plays) || 0];
                })
            );
            const nextTrackPlaysMap = playPairs.reduce((acc, [id, plays]) => {
                if (!id) return acc;
                acc[id] = plays;
                return acc;
            }, {});
            setTrackPlaysMap(nextTrackPlaysMap);

            // 2. Фільтруємо АЛЬБОМИ артиста (за ownerId або artist name)
            const artistAlbums = Array.isArray(albumsRes) ? albumsRes.filter(a =>
                (a.artistId && String(a.artistId) === String(artistId)) ||
                (a.ArtistId && String(a.ArtistId) === String(artistId)) ||
                normalizeName(a.artist || a.artistName || a.artist?.name || '') === artistNameKey
            ) : [];
            setAlbums(artistAlbums);

            // Unblock UI early: subscription/followers details can load in background.
            if (withLoader && reqId === loadReqIdRef.current) {
                setLoading(false);
            }

            const subscriptionsRaw = await getSubscriptions();
            const subscriptions = (Array.isArray(subscriptionsRaw) ? subscriptionsRaw : [])
                .map(resolveSubscriptionArtistFromItem)
                .filter(Boolean);

            const matchedSubscription =
                subscriptions.find((s) => artistId && s.ids.includes(String(artistId))) ||
                subscriptions.find((s) => normalizeName(s.name) === artistNameKey) ||
                null;

            const candidateIds = collectArtistIdCandidates(artist, artistTracks, artistId);
            if (matchedSubscription?.ids?.length) {
                matchedSubscription.ids.forEach((id) => {
                    if (!candidateIds.includes(String(id))) {
                        candidateIds.unshift(String(id));
                    }
                });
            }

            let detectedSubscribed = !!matchedSubscription;
            let detectedArtistId = matchedSubscription?.id || candidateIds[0] || null;

            if (!detectedSubscribed && candidateIds.length > 0) {
                const statusPairs = await Promise.all(
                    candidateIds.map(async (candidateId) => {
                        const subscribed = await getArtistSubscriptionStatus(candidateId);
                        return [candidateId, !!subscribed];
                    })
                );
                const firstSubscribed = statusPairs.find(([, subscribed]) => subscribed);
                if (firstSubscribed) {
                    detectedSubscribed = true;
                    detectedArtistId = firstSubscribed[0];
                }
            }

            const countIds = [...new Set([detectedArtistId, ...candidateIds].filter(Boolean).map((id) => String(id)))];
            const countValues = await Promise.all(
                countIds.map(async (countId) => Number(await getArtistFollowersCount(countId)) || 0)
            );
            const nextFollowers = countValues.reduce((max, value) => (value > max ? value : max), 0);

            if (reqId !== loadReqIdRef.current) return;

            setSubscriptionArtistId(detectedArtistId || null);
            setIsFollowing(detectedSubscribed);
            setFollowersCount(Number(nextFollowers) || 0);
            artistProfileSessionCache.set(cacheKey, {
                tracks: artistTracks,
                trackPlaysMap: nextTrackPlaysMap,
                albums: artistAlbums,
                icons: iconsRes || {},
                subscriptionArtistId: detectedArtistId || null,
                isFollowing: detectedSubscribed,
                followersCount: Number(nextFollowers) || 0,
            });

        } catch (e) {
            console.log('Profile load error', e);
        } finally {
            if (withLoader && reqId === loadReqIdRef.current) {
                setLoading(false);
            }
        }
    };

    const handleToggleFollow = async () => {
        const targetArtistId = subscriptionArtistId || (artistId ? String(artistId) : null);
        if (!targetArtistId || followBusy) return;

        setFollowBusy(true);

        const result = !isFollowing
            ? await subscribeToArtist(targetArtistId)
            : await unsubscribeFromArtist(targetArtistId);

        if (result?.error) {
            setFollowBusy(false);
            return;
        }

        await loadData({ withLoader: false });

        setFollowBusy(false);
    };

    // 👇 ВИПРАВЛЕНА ФУНКЦІЯ (3 аргументи замість 4)
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

            // PNG
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

        // Якщо іконки немає — повертаємо null, щоб не було помилки з об'єктом
        return null;
    };

    const avatarSourceUserId =
        artist?.ownerId ||
        artist?.OwnerId ||
        artist?.userId ||
        artist?.UserId ||
        artistId;
    const avatarUrl = avatarSourceUserId ? getUserAvatarUrl(avatarSourceUserId) : null;
    const artistCountry = artist?.country || artist?.location || artist?.artistCountry || 'USA';
    const artistRole = artist?.role || artist?.type || 'Rapper';

    const popularTracks = useMemo(() => {
        const withPlays = tracks.map((track, index) => {
            const id = resolveTrackId(track);
            return {
                track,
                index,
                id: id ? String(id) : `idx-${index}`,
                plays: id ? Number(trackPlaysMap[String(id)]) || 0 : 0,
            };
        });

        return withPlays
            .sort((a, b) => (b.plays - a.plays) || (a.index - b.index))
            .slice(0, 3)
            .map((item) => item.track);
    }, [tracks, trackPlaysMap]);

    const allSongsTracks = useMemo(() => {
        const popularIds = new Set(
            popularTracks
                .map((track) => resolveTrackId(track))
                .filter(Boolean)
                .map((id) => String(id))
        );
        return tracks.filter((track) => {
            const id = resolveTrackId(track);
            return !id || !popularIds.has(String(id));
        });
    }, [tracks, popularTracks]);

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                        bounces={false}
                        overScrollMode="never">

                <LinearGradient
                    colors={['#AC654F', '#883426', '#190707',]}
                    locations={[0, 0.2, 0.3,]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.gradient, { paddingBottom: 100 }]}
                >
                    {/* --- HERO / AVATAR --- */}
                    <View style={styles.heroContainer}>
                        <Image
                            source={{ uri: avatarUrl }}
                            style={styles.heroImage}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.heroOverlay}
                        />

                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
                        >
                            {renderIcon('arrow-left.svg', { width: 24, height: 24 }, '#fff')}
                        </TouchableOpacity>

                        <View style={styles.heroTextContainer}>
                            <View style={styles.metaRowMock}>
                                <Text style={styles.metaTextMock}>{artistRole}</Text>
                                <Text style={styles.metaDotMock}>•</Text>
                                <Text style={styles.metaTextMock}>{artistCountry}</Text>
                            </View>
                            <View style={styles.nameRow}>
                                <Text style={styles.artistNameText}>{artist?.name || 'Unknown Artist'}</Text>
                                <TouchableOpacity
                                    onPress={handleToggleFollow}
                                    style={styles.followIconButton}
                                    activeOpacity={0.85}
                                    disabled={!(subscriptionArtistId || artistId) || followBusy}
                                >
                                    {renderIcon(
                                        isFollowing ? 'unfollow.svg' : 'follow.svg',
                                        { width: scale(24), height: scale(24) },
                                        '#F5D8CB'
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* --- STATS: Виправлений колір (Sandwich method) --- */}
                    <LinearGradient
                        colors={[
                            'rgba(255, 255, 255, 0.0)',
                            'rgba(255, 255, 255, 0.0)',
                            'rgba(255, 255, 255, 0.0)',
                            'rgba(255, 255, 255, 0.0)'
                        ]}
                        locations={[0, 0.09, 0.7, 1]}
                        start={{ x: 1, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={{
                            marginHorizontal: scale(16),
                            marginTop: scale(-30),
                            borderRadius: scale(100),
                            padding: 1, //
                        }}
                    >
                        {/* Важливо: borderRadius тут, щоб обрізати внутрішній кольоровий фон */}
                        <BlurView
                            intensity={20}
                            tint="dark" // Використовуємо dark для темної теми
                            style={styles.statsGlassContainer}
                        >
                            {/* 👇 ЦЕЙ ШАР ВІДПОВІДАЄ ЗА КОЛІР.
                                Він лежить поверх розмиття і фарбує його в потрібний відтінок.
                                Я поставив 0.55 - регулюй прозорість тут (від 0.4 до 0.8) */}
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(48,12,10,0.6)' }]} />

                            {/* Контент */}
                            <View style={styles.statsContentRow}>
                                <View style={styles.statItem}>
                                    <Text style={[styles.statNumber, styles.realStatNumber]}>{formatFollowers(followersCount)}</Text>
                                    <Text style={[styles.statLabel, styles.realStatLabel]}>followers</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>18.6 M</Text>
                                    <Text style={styles.statLabel}>listeners</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>12.6 B</Text>
                                    <Text style={styles.statLabel}>listeners</Text>
                                </View>
                            </View>
                        </BlurView>
                    </LinearGradient>
                    {/* --- BIO --- */}
                    <Text style={styles.bioText}>
                        An American artist who broke the rules of the modern pop and hip-hop scene.
                        He became a global sensation after his hit Old Town Road.
                    </Text>

                    {/* --- ALBUMS (REAL DATA) --- */}
                    {/* Секція показується тільки якщо є альбоми */}
                    {albums.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Albums</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: scale(16) }}>
                                {albums.map((album, index) => {
                                    // Отримуємо ID та обкладинку
                                    const rawAlbumIds = [
                                        album.id,
                                        album.Id,
                                        album._id,
                                        album.albumId,
                                        album.AlbumId
                                    ].filter(Boolean);
                                    const albumId =
                                        rawAlbumIds.find((v) => GUID_REGEX.test(String(v))) ||
                                        rawAlbumIds[0] ||
                                        null;
                                    const coverUrl = (album.coverFileId || album.CoverFileId) && albumId
                                        ? getAlbumCoverUrl(albumId)
                                        : null;

                                    return (
                                        <TouchableOpacity
                                            key={albumId || index}
                                            style={styles.albumCard}
                                            onPress={() => {
                                                if (!albumId || !GUID_REGEX.test(String(albumId))) return;
                                                navigation.navigate('AlbumDetail', {
                                                    id: albumId,
                                                    albumId: albumId,
                                                    album,
                                                });
                                            }}
                                        >
                                            {coverUrl ? (
                                                <Image
                                                    source={{ uri: coverUrl }}
                                                    style={styles.albumImage} // Змінив стиль на Image
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={styles.albumImagePlaceholder} />
                                            )}

                                            <Text style={styles.albumTitle} numberOfLines={1}>
                                                {album.title}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- POPULAR SONGS --- */}
                    {popularTracks.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Popular Songs</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScrollContent}>
                                {popularTracks.map((track, index) => {
                                    const cover = getTrackCoverUrl(track);
                                    return (
                                        <TouchableOpacity
                                            key={resolveTrackId(track) || `popular-${index}`}
                                            style={styles.popularCard}
                                            onPress={() => navigation.navigate('Player', { track })}
                                        >
                                            {cover ? (
                                                <Image source={{ uri: cover }} style={styles.popularImage} resizeMode="cover" />
                                            ) : (
                                                <View style={styles.popularImagePlaceholder} />
                                            )}
                                            <Text style={styles.popularTitle} numberOfLines={1}>{track?.title || 'Unknown'}</Text>
                                            <Text style={styles.popularArtist} numberOfLines={1}>
                                                {resolveArtistName(track, artist?.name || 'Unknown')}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- ALL SONGS --- */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>All Songs</Text>
                        <View style={{ paddingHorizontal: scale(16) }}>
                            {allSongsTracks.map((t, i) => {
                                const cover = getTrackCoverUrl(t);
                                return (
                                    <View key={resolveTrackId(t) || `song-${i}`}>
                                        <TouchableOpacity
                                            style={styles.songRow}
                                            onPress={() => navigation.navigate('Player', { track: t })}
                                        >
                                            <View style={styles.vinylContainer}>
                                                {cover ? (
                                                    <Image
                                                        source={{ uri: cover }}
                                                        style={styles.innerCover}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View style={[styles.innerCover, { backgroundColor: '#555' }]} />
                                                )}

                                                <View style={styles.vinylOverlayWrapper}>
                                                    {renderIcon('vinyl.svg', { width: scale(50), height: scale(50) }, null)}
                                                </View>
                                            </View>

                                            <View style={styles.songInfo}>
                                                <Text style={styles.songTitle} numberOfLines={1}>{t.title}</Text>
                                                <Text style={styles.songArtist} numberOfLines={1}>{resolveArtistName(t, artist?.name || 'Unknown')}</Text>
                                            </View>

                                            <TouchableOpacity>
                                                {renderIcon('hurt.svg', { width: 24, height: 24 }, '#fff')}
                                            </TouchableOpacity>
                                        </TouchableOpacity>

                                        {i < allSongsTracks.length - 1 && <View style={styles.separator} />}
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                </LinearGradient>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    gradient: {
        minHeight: height,
    },
    heroContainer: {
        width: '100%',
        height: scale(450),
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: '40%',
    },
    backButton: {
        position: 'absolute',
        top: scale(50),
        left: scale(20),
        zIndex: 10,
    },
    heroTextContainer: {
        position: 'absolute',
        bottom: scale(30),
        left: scale(16),
        right: scale(16),
    },
    metaRowMock: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(6),
    },
    metaTextMock: {
        color: '#F5D8CB',
        fontSize: scale(18),
        fontFamily: 'Unbounded-SemiBold',
        textTransform: 'uppercase',
    },
    metaDotMock: {
        color: '#F5D8CB',
        marginHorizontal: scale(10),
        fontSize: scale(18),
        fontFamily: 'Unbounded-SemiBold',
        lineHeight: scale(18),
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    artistNameText: {
        color: '#F5D8CB',
        fontSize: scale(36),
        fontFamily: 'Unbounded-SemiBold',

    },
    followIconButton: {
        marginLeft: scale(10),
        width: scale(40),
        height: scale(40),
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(-3),
    },
    statsGlassContainer: {
        borderRadius: scale(100),
        overflow: 'hidden',
    },
    statsContentRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: scale(14),
        width: '100%', // Важливо, щоб розтягнути контент
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        color: '#F5D8CB',
        fontSize: scale(20),
        fontFamily: 'Unbounded-Regular',
    },
    realStatNumber: {
        color: '#F5D8CB',
    },
    statLabel: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    realStatLabel: {
        color: '#F5D8CB',
    },
    bioText: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        lineHeight: scale(20),
        marginHorizontal: scale(16),
        marginTop: scale(20),
        marginBottom: scale(20),
    },
    section: {
        marginTop: scale(10),
        marginBottom: scale(20),
    },
    popularScrollContent: {
        paddingHorizontal: scale(16),
    },
    popularCard: {
        width: scale(120),
        marginRight: scale(16),
    },
    popularImage: {
        width: scale(120),
        height: scale(120),
        borderRadius: scale(20),
        marginBottom: scale(8),
    },
    popularImagePlaceholder: {
        width: scale(120),
        height: scale(120),
        borderRadius: scale(20),
        marginBottom: scale(8),
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    popularTitle: {
        color: '#FFFFFF',
        fontSize: scale(14),
        fontFamily: 'Poppins-Medium',
    },
    popularArtist: {
        color: '#B9B9B9',
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
        marginTop: scale(2),
    },
    sectionTitle: {
        fontSize: scale(24),
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        marginLeft: scale(16),
        marginBottom: scale(15),
    },
    albumCard: {
        marginRight: scale(15),
        width: scale(140),
    },
    albumImage: {
        width: scale(120),
        height: scale(120),
        borderRadius: scale(20),
        marginBottom: scale(8),
    },
    albumImagePlaceholder: {
        width: scale(140),
        height: scale(140),
        backgroundColor: '#444',
        borderRadius: scale(20),
        marginBottom: scale(8),
    },
    albumTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Regular',
        textAlign: 'left',
        width: '100%',
        marginLeft: scale(4),
    },
    songRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
    },
    vinylContainer: {
        width: scale(50),
        height: scale(50),
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    innerCover: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        position: 'absolute',
        zIndex: 1,
    },
    vinylOverlayWrapper: {
        width: '100%',
        height: '100%',
        zIndex: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    songInfo: {
        flex: 1,
        marginLeft: scale(15),
    },
    songTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-SemiBold',
    },
    songArtist: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        marginTop: 2,
    },
    separator: {
        height: 1,
        backgroundColor: '#F5D8CB',
        marginVertical: scale(8)
    },
});
