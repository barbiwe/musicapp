import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ScrollView,
    StatusBar,
    Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import {
    api,
    getIcons,
    getTrackCoverUrl,
    getTrackDetails,
    getAlbumCoverUrl,
    getPlaylistCoverUrl,
    getPodcastCoverUrl,
    getUserAvatarUrl,
    searchLibrary,
    scale,
} from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';
import { usePlayerStore } from '../../store/usePlayerStore';

const RECENT_KEY = 'library_search_recent_v1';
const API_BASE = api?.defaults?.baseURL || process.env.EXPO_PUBLIC_API_URL || 'http://54.144.57.220:8080';

const safeText = (value, fallback = '') => {
    const str = String(value || '').trim();
    return str || fallback;
};

const toAbsoluteUrl = (raw) => {
    const value = safeText(raw);
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    return `${API_BASE}${value.startsWith('/') ? '' : '/'}${value}`;
};

const itemImageUrl = (item) => {
    if (item.type === 'track') {
        return (
            toAbsoluteUrl(item.payload?.coverUrl || item.payload?.imageUrl || item.payload?.cover) ||
            getTrackCoverUrl(item.payload)
        );
    }
    if (item.type === 'album') {
        return (
            toAbsoluteUrl(item.payload?.coverUrl || item.payload?.imageUrl || item.payload?.cover) ||
            getAlbumCoverUrl(item.id)
        );
    }
    if (item.type === 'playlist') {
        return (
            toAbsoluteUrl(item.payload?.coverUrl || item.payload?.imageUrl || item.payload?.cover) ||
            getPlaylistCoverUrl(item.id)
        );
    }
    if (item.type === 'podcast') {
        return (
            toAbsoluteUrl(item.payload?.coverUrl || item.payload?.imageUrl || item.payload?.cover) ||
            getPodcastCoverUrl(item.payload)
        );
    }
    if (item.type === 'artist') {
        return (
            toAbsoluteUrl(item.payload?.avatarUrl || item.payload?.imageUrl || item.payload?.coverUrl) ||
            toAbsoluteUrl(item.payload?.imageUrl) ||
            getUserAvatarUrl(item.payload?.ownerId)
        );
    }
    return null;
};

const itemSubtitle = (item) => {
    if (item.type === 'track') {
        const artist =
            item.payload?.artistName ||
            item.payload?.artist?.name ||
            item.payload?.ownerName ||
            'Unknown Artist';
        return `Song / ${artist}`;
    }
    if (item.type === 'album') {
        const artist = item.payload?.artistName || item.payload?.artist?.name || 'Unknown Artist';
        return `Album / ${artist}`;
    }
    if (item.type === 'playlist') {
        return 'Playlist';
    }
    if (item.type === 'podcast') {
        const author = item.payload?.author || item.payload?.artistName || 'Podcast';
        return `Podcast / ${author}`;
    }
    if (item.type === 'artist') {
        return 'Artist';
    }
    return '';
};

const mapSearchResult = (data = {}) => {
    const tracks = (Array.isArray(data.tracks) ? data.tracks : []).map((track, index) => ({
        type: 'track',
        id: safeText(track?.id || track?._id || track?.trackId || `track-${index}`),
        title: safeText(track?.title, 'Untitled track'),
        payload: track,
    }));

    const albums = (Array.isArray(data.albums) ? data.albums : []).map((album, index) => ({
        type: 'album',
        id: safeText(album?.id || album?._id || album?.albumId || `album-${index}`),
        title: safeText(album?.title || album?.name, 'Untitled album'),
        payload: album,
    }));

    const playlists = (Array.isArray(data.playlists) ? data.playlists : []).map((playlist, index) => ({
        type: 'playlist',
        id: safeText(playlist?.id || playlist?._id || playlist?.playlistId || `playlist-${index}`),
        title: safeText(playlist?.name || playlist?.title, 'Untitled playlist'),
        payload: playlist,
    }));

    const podcasts = (Array.isArray(data.podcasts) ? data.podcasts : []).map((podcast, index) => ({
        type: 'podcast',
        id: safeText(podcast?.id || podcast?._id || podcast?.podcastId || `podcast-${index}`),
        title: safeText(podcast?.title || podcast?.name, 'Untitled podcast'),
        payload: podcast,
    }));

    const artists = (Array.isArray(data.artists) ? data.artists : []).map((artist, index) => ({
        type: 'artist',
        id: safeText(artist?.id || artist?.artistId || artist?._id || `artist-${index}`),
        title: safeText(artist?.name || artist?.artistName, 'Unknown artist'),
        payload: artist,
    }));
    return [...artists, ...tracks, ...playlists, ...albums, ...podcasts];
};

const buildDropdownResults = (items) => {
    const list = Array.isArray(items) ? items : [];
    if (list.length <= 8) return list;

    const byType = {
        artist: list.filter((item) => item.type === 'artist'),
        track: list.filter((item) => item.type === 'track'),
        album: list.filter((item) => item.type === 'album'),
        playlist: list.filter((item) => item.type === 'playlist'),
        podcast: list.filter((item) => item.type === 'podcast'),
    };

    const picked = [];
    const used = new Set();
    const pushUnique = (item) => {
        if (!item) return;
        const key = `${item.type}-${item.id}`;
        if (used.has(key)) return;
        used.add(key);
        picked.push(item);
    };

    // Guarantees mixed result types in dropdown.
    pushUnique(byType.artist[0]);
    pushUnique(byType.track[0]);
    pushUnique(byType.album[0]);
    pushUnique(byType.playlist[0]);
    pushUnique(byType.podcast[0]);
    pushUnique(byType.track[1]);
    pushUnique(byType.album[1]);
    pushUnique(byType.artist[1]);

    if (picked.length < 8) {
        list.forEach((item) => {
            if (picked.length >= 8) return;
            pushUnique(item);
        });
    }

    return picked.slice(0, 8);
};

export default function LibrarySearchScreen({ navigation }) {
    const { setTrack } = usePlayerStore();
    const searchReqIdRef = useRef(0);
    const [icons, setIcons] = useState({});
    const [userToken, setUserToken] = useState(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [recent, setRecent] = useState([]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const [iconsMap, recentRaw, token] = await Promise.all([
                    getIcons(),
                    AsyncStorage.getItem(RECENT_KEY),
                    AsyncStorage.getItem('userToken'),
                ]);
                if (!mounted) return;
                setIcons(iconsMap || {});
                setUserToken(token || null);
                const parsed = recentRaw ? JSON.parse(recentRaw) : [];
                setRecent(Array.isArray(parsed) ? parsed : []);
            } catch (_) {}
        };
        load();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const q = query.trim();
        const reqId = ++searchReqIdRef.current;
        if (!q) {
            setResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            const response = await searchLibrary(q);
            if (reqId !== searchReqIdRef.current) return;
            setResults(mapSearchResult(response));
        }, 250);

        return () => clearTimeout(timeoutId);
    }, [query]);

    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };

    const visibleRecent = useMemo(() => recent.slice(0, 12), [recent]);
    const recentTrackCards = useMemo(
        () => visibleRecent.filter((item) => item?.type === 'track').slice(0, 20),
        [visibleRecent]
    );
    const dropdownResults = useMemo(
        () => (query.trim() ? buildDropdownResults(results) : []),
        [query, results]
    );
    const listToRender = useMemo(
        () => (query.trim() ? results : recentTrackCards),
        [query, results, recentTrackCards]
    );

    const persistRecent = async (item) => {
        try {
            const normalized = {
                type: item.type,
                id: item.id,
                title: item.title,
                subtitle: itemSubtitle(item),
                imageUrl: itemImageUrl(item),
                payload: item.payload,
            };
            const next = [normalized, ...recent.filter((x) => !(x.type === item.type && x.id === item.id))].slice(0, 20);
            setRecent(next);
            await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
        } catch (_) {}
    };

    const clearRecent = async () => {
        setRecent([]);
        await AsyncStorage.removeItem(RECENT_KEY);
    };

    const getImageSource = (item, imageUrl) => {
        if (!imageUrl) return null;

        if (item?.type === 'playlist' && userToken) {
            return {
                uri: imageUrl,
                headers: { Authorization: `Bearer ${userToken}` },
            };
        }

        return { uri: imageUrl };
    };

    const isRoundImageType = (item) => item?.type === 'artist';

    const onOpenItem = async (item) => {
        await persistRecent(item);

        if (item.type === 'track') {
            const detailedTrack = await getTrackDetails(item.id);
            setTrack(detailedTrack || item.payload);
            return;
        }

        if (item.type === 'album') {
            navigation.navigate('AlbumDetail', { id: item.id });
            return;
        }

        if (item.type === 'playlist') {
            navigation.navigate('PlaylistDetail', {
                playlistId: item.id,
                playlistName: item.title,
            });
            return;
        }

        if (item.type === 'podcast') {
            navigation.navigate('PodcastDetail', {
                podcastId: item.id,
                podcast: item.payload,
            });
            return;
        }

        if (item.type === 'artist') {
            const artistPayload = item.payload || {};
            navigation.navigate('ArtistProfile', {
                artist: {
                    id: artistPayload?.id || item.id,
                    artistId: artistPayload?.id || item.id,
                    ownerId: artistPayload?.ownerId || null,
                    name: artistPayload?.name || item.title,
                    country: artistPayload?.country || null,
                    aboutMe: artistPayload?.aboutMe || null,
                    specialization: artistPayload?.specialization || null,
                },
            });
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.8} style={styles.backButton}>
                            <RemoteTintIcon
                                icons={icons}
                                iconName={resolveIconName('arrow-left.svg')}
                                width={scale(24)}
                                height={scale(24)}
                                color="#F5D8CB"
                                fallback=""
                            />
                        </TouchableOpacity>
                        <Text style={styles.title}>Search</Text>
                        <View style={styles.backButton} />
                    </View>

                    <View style={styles.searchWrap}>
                        <View style={styles.searchBox}>
                            <BlurView intensity={58} tint="dark" style={StyleSheet.absoluteFill} />
                            <RemoteTintIcon
                                icons={icons}
                                iconName={resolveIconName('search.svg')}
                                width={scale(24)}
                                height={scale(24)}
                                color="#F5D8CB"
                                fallback=""
                                style={styles.searchIcon}
                            />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search in library"
                            placeholderTextColor="rgba(245,216,203,0.45)"
                            style={styles.searchInput}
                            selectionColor="#F5D8CB"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        </View>

                        {dropdownResults.length > 0 ? (
                            <View style={styles.dropdownContainer}>
                                <BlurView intensity={58} tint="dark" style={StyleSheet.absoluteFill} />
                                <LinearGradient
                                    colors={['rgba(48,12,10,0.75)', 'rgba(48,12,10,0.62)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <ScrollView showsVerticalScrollIndicator={false} style={styles.dropdownScroll}>
                                    {dropdownResults.map((item) => {
                                        const imageUrl = itemImageUrl(item);
                                        const imageSource = getImageSource(item, imageUrl);
                                        return (
                                            <TouchableOpacity
                                                key={`drop-${item.type}-${item.id}`}
                                                style={styles.dropdownItem}
                                                activeOpacity={0.85}
                                                onPress={() => onOpenItem(item)}
                                            >
                                                {imageSource ? (
                                                    <Image
                                                        source={imageSource}
                                                        style={[
                                                            styles.dropdownImage,
                                                            !isRoundImageType(item) && styles.dropdownImageSquare,
                                                        ]}
                                                    />
                                                ) : (
                                                    <View
                                                        style={[
                                                            styles.dropdownImage,
                                                            !isRoundImageType(item) && styles.dropdownImageSquare,
                                                            styles.dropdownFallback,
                                                        ]}
                                                    >
                                                        <Text style={styles.dropdownFallbackText}>
                                                            {String(item.title || '?').charAt(0).toUpperCase()}
                                                        </Text>
                                                    </View>
                                                )}
                                                <View style={styles.dropdownTextWrap}>
                                                    <Text style={styles.dropdownTitle} numberOfLines={1}>
                                                        {item.title}
                                                    </Text>
                                                    <Text style={styles.dropdownSubtitle} numberOfLines={1}>
                                                        {itemSubtitle(item)}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent</Text>
                        <TouchableOpacity onPress={clearRecent} activeOpacity={0.8}>
                            <Text style={styles.clearAll}>Clear all</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
                        {visibleRecent.slice(0, 6).map((item) => {
                            const imageSource = getImageSource(item, item.imageUrl);
                            return (
                                <TouchableOpacity key={`recent-${item.type}-${item.id}`} onPress={() => onOpenItem(item)} style={styles.recentItem}>
                                    {imageSource ? (
                                        <Image
                                            source={imageSource}
                                            style={[
                                                styles.recentImage,
                                                !isRoundImageType(item) && styles.recentImageSquare,
                                            ]}
                                        />
                                    ) : (
                                        <View
                                            style={[
                                                styles.recentImage,
                                                !isRoundImageType(item) && styles.recentImageSquare,
                                                styles.dropdownFallback,
                                            ]}
                                        >
                                            <Text style={styles.dropdownFallbackText}>
                                                {String(item.title || '?').charAt(0).toUpperCase()}
                                            </Text>
                                        </View>
                                    )}
                                    <Text style={styles.recentTitle} numberOfLines={1}>{item.title}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
                        {listToRender.map((item) => {
                            const imageUrl = itemImageUrl(item) || item.imageUrl;
                            const imageSource = getImageSource(item, imageUrl);
                            return (
                            <TouchableOpacity
                                key={`${item.type}-${item.id}`}
                                style={styles.resultCard}
                                activeOpacity={0.85}
                                onPress={() => onOpenItem(item)}
                            >
                                {imageSource ? (
                                    <Image
                                        source={imageSource}
                                        style={styles.resultImage}
                                    />
                                ) : (
                                    <View style={[styles.resultImage, styles.resultFallback]} />
                                )}
                                <View style={styles.resultTextWrap}>
                                    <Text style={styles.resultTitle} numberOfLines={1}>
                                        {item.title}
                                    </Text>
                                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                                        {item.subtitle || itemSubtitle(item) || 'Song / Unknown'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    gradient: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingTop: scale(54),
        paddingHorizontal: scale(20),
    },
    headerRow: {
        height: scale(40),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(16),
    },
    backButton: {
        width: scale(24),
        height: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(24),
    },
    searchBox: {
        height: scale(38),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.45)',
        borderRadius: scale(26),
        backgroundColor: 'rgba(48,12,10,0.35)',
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        zIndex: 23,
    },
    searchWrap: {
        position: 'relative',
        zIndex: 20,
        marginBottom: scale(22),
    },
    searchIcon: {
        marginRight: scale(10),
    },
    searchInput: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(20),
        paddingVertical: 0,
    },
    dropdownContainer: {
        position: 'absolute',
        top: scale(18),
        left: 0,
        right: 0,
        maxHeight: scale(280),
        borderBottomLeftRadius: scale(28),
        borderBottomRightRadius: scale(28),
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: 'rgba(245,216,203,0.45)',
        overflow: 'hidden',
        zIndex: 22,
    },
    dropdownScroll: {
        paddingHorizontal: scale(14),
        paddingTop: scale(34),
        paddingBottom: scale(10),
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    dropdownImage: {
        width: scale(72),
        height: scale(72),
        borderRadius: scale(36),
        backgroundColor: 'rgba(26, 8, 8, 0.8)',
        marginRight: scale(12),
    },
    dropdownImageSquare: {
        borderRadius: scale(15),
    },
    dropdownFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropdownFallbackText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(18),
    },
    dropdownTextWrap: {
        flex: 1,
    },
    dropdownTitle: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-SemiBold',
        fontSize: scale(17),
        marginBottom: scale(2),
    },
    dropdownSubtitle: {
        color: '#F5D8CB',
        opacity: 0.95,
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(12),
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(24),
    },
    clearAll: {
        color: 'rgba(245,216,203,0.6)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    recentRow: {
        gap: scale(16),
        paddingBottom: scale(18),
    },
    recentItem: {
        width: scale(94),
        alignItems: 'center',
    },
    recentImage: {
        width: scale(82),
        height: scale(82),
        borderRadius: scale(41),
        marginBottom: scale(8),
        backgroundColor: 'rgba(48,12,10,0.5)',
    },
    recentImageSquare: {
        borderRadius: scale(15),
    },
    recentTitle: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12),
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: scale(120),
        gap: scale(0),
    },
    resultCard: {
        width: '100%',
        minHeight: scale(80),
        marginBottom: scale(16),
        borderRadius: scale(20),
        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(12),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    resultImage: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(15),
        backgroundColor: '#333',
        marginRight: scale(12),
    },
    resultFallback: {
        backgroundColor: 'rgba(20, 8, 8, 0.8)',
    },
    resultTextWrap: {
        flex: 1,
    },
    resultTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Medium',
        fontSize: scale(16),
        marginBottom: scale(4),
    },
    resultSubtitle: {
        color: 'rgba(245, 216, 203, 0.85)',
        fontFamily: 'Poppins-Light',
        fontSize: scale(14),
    },
});
