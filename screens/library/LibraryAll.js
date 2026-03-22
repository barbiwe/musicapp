import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { useIsFocused } from '@react-navigation/native';
import {
    getAllArtists,
    getAllPodcasts,
    getAlbumCoverUrl,
    getAlbums,
    getIcons,
    getLikedAlbums,
    getLikedTracks,
    getMyPlaylists,
    getMyAlbums,
    getPlaylistCoverUrl,
    getPodcastCoverUrl,
    getSubscriptions,
    getUserAvatarUrl,
    isPodcastLiked,
    scale,
} from '../../api/api';

const { width, height } = Dimensions.get('window');
const svgCache = {};

const ColoredSvg = ({ uri, width: iconWidth, height: iconHeight, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return () => {
                isMounted = false;
            };
        }

        if (uri) {
            fetch(uri)
                .then((response) => response.text())
                .then((svgContent) => {
                    if (!isMounted) return;
                    let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');
                    if (color) {
                        cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
                        cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
                    }
                    cleanXml = cleanXml.replace(/###NONE###/g, 'fill="none"');
                    svgCache[cacheKey] = cleanXml;
                    setXml(cleanXml);
                })
                .catch(() => {});
        }

        return () => {
            isMounted = false;
        };
    }, [cacheKey, color, uri]);

    if (!xml) return <View style={{ width: iconWidth, height: iconHeight }} />;
    return <SvgXml xml={xml} width={iconWidth} height={iconHeight} />;
};

const toArray = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.result)) return value.result;
    return [];
};

const normalizeId = (value) => String(value || '').trim();
const extractLikedTrackIds = (raw) => {
    if (!Array.isArray(raw)) return [];
    const ids = new Set();
    raw.forEach((item) => {
        if (typeof item === 'string') {
            const id = normalizeId(item);
            if (id) ids.add(id);
            return;
        }
        const src = item?.track || item;
        const id = normalizeId(src?.id || src?._id || src?.trackId || item?.id || item?._id || item?.trackId);
        if (id) ids.add(id);
    });
    return Array.from(ids);
};

const normalizeArtistFromSource = (item, index) => {
    const id = normalizeId(
        item?.artistId || item?.id || item?._id || item?.ownerId || item?.userId || item?.artist?.id
    );
    const name = String(
        item?.artistName || item?.name || item?.username || item?.displayName || item?.artist?.name || ''
    ).trim();

    if (!id || !name) return null;

    return {
        id: `artist-${id}`,
        type: 'artist',
        title: name,
        subtitle: 'Artist',
        imagePrimary:
            item?.avatarUrl ||
            item?.artistAvatarUrl ||
            item?.imageUrl ||
            item?.coverUrl ||
            null,
        imageFallback: getUserAvatarUrl(id),
        artistId: id,
        ownerId: normalizeId(item?.ownerId || item?.userId || item?.artist?.ownerId || item?.artist?.userId),
        initial: name.charAt(0).toUpperCase(),
        order: index,
    };
};

let libraryAllSessionCache = null;

export default function LibraryAll({ navigation }) {
    const isFocused = useIsFocused();
    const hasLoadedOnceRef = useRef(Boolean(libraryAllSessionCache));

    const [loading, setLoading] = useState(!libraryAllSessionCache);
    const [icons, setIcons] = useState(() => libraryAllSessionCache?.icons || {});
    const [cards, setCards] = useState(() => libraryAllSessionCache?.cards || []);
    const [userToken, setUserToken] = useState(() => libraryAllSessionCache?.userToken || null);

    const [failedPrimaryCovers, setFailedPrimaryCovers] = useState({});
    const [brokenCovers, setBrokenCovers] = useState({});

    const loadData = async ({ force = false } = {}) => {
        if (!force && libraryAllSessionCache) {
            setIcons(libraryAllSessionCache.icons || {});
            setCards(libraryAllSessionCache.cards || []);
            setUserToken(libraryAllSessionCache.userToken || null);
            setFailedPrimaryCovers({});
            setBrokenCovers({});
            setLoading(false);
            hasLoadedOnceRef.current = true;
            return;
        }

        setLoading(true);

        try {
            const [
                loadedIcons,
                token,
                likedTracksRaw,
                myPlaylistsRaw,
                myAlbumsRaw,
                likedAlbumIdsRaw,
                allAlbumsRaw,
                allPodcastsRaw,
                subscriptionsRaw,
                allArtistsRaw,
            ] = await Promise.all([
                getIcons(),
                AsyncStorage.getItem('userToken'),
                getLikedTracks(),
                getMyPlaylists(),
                getMyAlbums(),
                getLikedAlbums(),
                getAlbums(),
                getAllPodcasts(),
                getSubscriptions(),
                getAllArtists(),
            ]);

            const likedTrackIds = extractLikedTrackIds(likedTracksRaw);

            const myPlaylists = Array.isArray(myPlaylistsRaw) ? myPlaylistsRaw : [];
            const playlistCards = myPlaylists
                .map((playlist, index) => {
                    const id = normalizeId(playlist?.id || playlist?._id || playlist?.playlistId || playlist?.PlaylistId);
                    if (!id) return null;

                    const title =
                        String(playlist?.name || playlist?.Name || playlist?.title || playlist?.Title || '').trim() ||
                        `Playlist ${index + 1}`;

                    return {
                        id: `playlist-${id}`,
                        type: 'playlist',
                        title,
                        subtitle: 'Playlist',
                        imagePrimary: getPlaylistCoverUrl(id),
                        imageFallback: null,
                        playlistId: id,
                    };
                })
                .filter(Boolean)
                .sort((a, b) => a.title.localeCompare(b.title));

            const myAlbums = toArray(myAlbumsRaw);
            const allAlbums = toArray(allAlbumsRaw);
            const likedAlbumIds = (Array.isArray(likedAlbumIdsRaw) ? likedAlbumIdsRaw : [])
                .map((id) => normalizeId(id))
                .filter(Boolean);

            const likedAlbumSet = new Set(likedAlbumIds);
            const mergedAlbumsMap = new Map();
            [...myAlbums, ...allAlbums.filter((album) => likedAlbumSet.has(normalizeId(album?.id || album?.Id)))].forEach(
                (album) => {
                    const id = normalizeId(album?.id || album?.Id || album?._id || album?.albumId);
                    if (!id || mergedAlbumsMap.has(id)) return;
                    mergedAlbumsMap.set(id, album);
                }
            );

            const albumCards = Array.from(mergedAlbumsMap.values())
                .map((album) => {
                    const id = normalizeId(album?.id || album?.Id || album?._id || album?.albumId);
                    const title = String(album?.title || album?.name || 'Untitled album').trim() || 'Untitled album';
                    const artist = String(album?.artist?.name || album?.artistName || album?.artist || 'Unknown Artist').trim();

                    return {
                        id: `album-${id}`,
                        type: 'album',
                        title,
                        subtitle: `Album / ${artist || 'Unknown Artist'}`,
                        imagePrimary: getAlbumCoverUrl(id),
                        albumId: id,
                        raw: album,
                    };
                })
                .sort((a, b) => a.title.localeCompare(b.title));

            const allPodcasts = (Array.isArray(allPodcastsRaw) ? allPodcastsRaw : []).filter((podcast) => {
                const status = String(podcast?.status || '').trim().toLowerCase();
                return !status || status === 'approved';
            });

            const likedPodcastChecks = await Promise.all(
                allPodcasts.map(async (podcast) => {
                    const id = normalizeId(podcast?.id || podcast?._id || podcast?.podcastId);
                    if (!id) return null;
                    const liked = await isPodcastLiked(id);
                    return liked ? id : null;
                })
            );
            const likedPodcastSet = new Set(likedPodcastChecks.filter(Boolean));

            const podcastCards = allPodcasts
                .filter((podcast) => likedPodcastSet.has(normalizeId(podcast?.id || podcast?._id || podcast?.podcastId)))
                .map((podcast) => {
                    const id = normalizeId(podcast?.id || podcast?._id || podcast?.podcastId);
                    const title = String(podcast?.title || podcast?.name || 'Untitled podcast').trim() || 'Untitled podcast';
                    const author =
                        String(podcast?.author || podcast?.artistName || podcast?.ownerName || 'Unknown').trim() || 'Unknown';
                    return {
                        id: `podcast-${id}`,
                        type: 'podcast',
                        title,
                        subtitle: `Podcast / ${author}`,
                        imagePrimary: getPodcastCoverUrl(podcast),
                        podcastId: id,
                        raw: podcast,
                    };
                })
                .sort((a, b) => a.title.localeCompare(b.title));

            const subscriptions = Array.isArray(subscriptionsRaw) ? subscriptionsRaw : [];
            const allArtists = Array.isArray(allArtistsRaw) ? allArtistsRaw : [];

            const allArtistsById = new Map();
            const allArtistsByName = new Map();
            allArtists.forEach((artist) => {
                const artistId = normalizeId(artist?.artistId || artist?.id || artist?._id);
                const artistName = String(artist?.artistName || artist?.name || artist?.username || '').trim();
                if (artistId) allArtistsById.set(artistId, artist);
                if (artistName) allArtistsByName.set(artistName.toLowerCase(), artist);
            });

            const sourceArtists = subscriptions.length > 0 ? subscriptions : allArtists;
            const normalizedArtists = sourceArtists
                .map((item, index) => normalizeArtistFromSource(item, index))
                .filter(Boolean);

            const enrichedArtists = normalizedArtists.map((artist) => {
                const byId = allArtistsById.get(artist.artistId);
                const byName = allArtistsByName.get(String(artist.title || '').toLowerCase());
                const matched = byId || byName || null;
                const ownerId = normalizeId(
                    artist.ownerId ||
                        matched?.ownerId ||
                        matched?.userId ||
                        matched?.artist?.ownerId ||
                        matched?.artist?.userId
                );
                const image =
                    artist.imagePrimary ||
                    matched?.avatarUrl ||
                    matched?.artistAvatarUrl ||
                    matched?.imageUrl ||
                    matched?.coverUrl ||
                    (ownerId ? getUserAvatarUrl(ownerId) : null) ||
                    null;

                return {
                    ...artist,
                    ownerId,
                    imagePrimary: image,
                    imageFallback: artist.imageFallback || getUserAvatarUrl(artist.artistId),
                };
            });

            const uniqArtistsMap = new Map();
            enrichedArtists.forEach((artist) => {
                if (!uniqArtistsMap.has(artist.id)) uniqArtistsMap.set(artist.id, artist);
            });
            const artistCards = Array.from(uniqArtistsMap.values()).sort((a, b) => a.title.localeCompare(b.title));

            const likedCard = {
                id: 'liked',
                type: 'liked',
                title: 'Liked songs',
                subtitle: `${likedTrackIds.length} songs`,
                imagePrimary: null,
            };

            setIcons(loadedIcons || {});
            setUserToken(token || null);
            const nextCards = [likedCard, ...playlistCards, ...albumCards, ...podcastCards, ...artistCards];
            setCards(nextCards);
            setFailedPrimaryCovers({});
            setBrokenCovers({});
            libraryAllSessionCache = {
                icons: loadedIcons || {},
                userToken: token || null,
                cards: nextCards,
            };
        } catch (_) {
            hasLoadedOnceRef.current = false;
            const fallbackCards = [
                {
                    id: 'liked',
                    type: 'liked',
                    title: 'Liked songs',
                    subtitle: '0 songs',
                    imagePrimary: null,
                },
            ];
            setCards(fallbackCards);
            libraryAllSessionCache = {
                icons: icons || {},
                userToken: userToken || null,
                cards: fallbackCards,
            };
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isFocused) return;
        if (hasLoadedOnceRef.current) return;
        hasLoadedOnceRef.current = true;
        loadData({ force: false });
    }, [isFocused]);

    const renderIcon = (iconName, style, tintColor = null) => {
        const iconUrl = icons?.[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const iconWidth = flatStyle?.width || 24;
                const iconHeight = flatStyle?.height || 24;

                return <ColoredSvg uri={iconUrl} width={iconWidth} height={iconHeight} color={tintColor} />;
            }

            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor });
            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }

        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    const openCard = (item) => {
        if (item.type === 'liked') {
            navigation?.navigate('LikedSongs');
            return;
        }

        if (item.type === 'artist') {
            navigation?.navigate('ArtistProfile', {
                artist: {
                    id: item.artistId,
                    artistId: item.artistId,
                    name: item.title,
                },
            });
            return;
        }

        if (item.type === 'playlist') {
            navigation?.navigate('PlaylistDetail', {
                playlistId: item.playlistId,
                playlistName: item.title,
            });
            return;
        }

        if (item.type === 'album') {
            navigation?.navigate('AlbumDetail', { id: item.albumId, album: item.raw });
            return;
        }

        if (item.type === 'podcast') {
            navigation?.navigate('PodcastDetail', {
                podcastId: item.podcastId,
                podcast: item.raw,
            });
        }
    };

    const renderCardImage = (item) => {
        const failedPrimary = failedPrimaryCovers[item.id];
        const broken = brokenCovers[item.id];
        const imageUri = failedPrimary || !item.imagePrimary ? item.imageFallback : item.imagePrimary;
        const hasImage = Boolean(imageUri) && !broken;

        const useRound = item.type === 'artist';

        if (item.type === 'liked') {
            return (
                <View style={styles.vinylContainer}>
                    {renderIcon('vinyl.svg', styles.vinylImage)}
                    <View style={styles.vinylCenter}>
                        {renderIcon('added.svg', { width: scale(65), height: scale(65) }, '#F5D8CB')}
                    </View>
                </View>
            );
        }

        if (hasImage) {
            const source =
                item.type === 'playlist' && userToken
                    ? { uri: imageUri, headers: { Authorization: `Bearer ${userToken}` } }
                    : { uri: imageUri };

            return (
                <Image
                    source={source}
                    style={[styles.image, useRound && styles.roundImage]}
                    resizeMode="cover"
                    onError={() => {
                        if (!failedPrimary && item.imageFallback) {
                            setFailedPrimaryCovers((prev) => ({ ...prev, [item.id]: true }));
                        } else {
                            setBrokenCovers((prev) => ({ ...prev, [item.id]: true }));
                        }
                    }}
                />
            );
        }

        if (useRound) {
            return (
                <View style={[styles.image, styles.roundImage, styles.artistFallback]}>
                    <Text style={styles.artistFallbackText}>{item.initial || '?'}</Text>
                </View>
            );
        }

        return <View style={[styles.image, styles.imageFallback]} />;
    };

    const renderCard = (item) => (
        <TouchableOpacity
            key={item.id}
            style={styles.cardContainer}
            activeOpacity={0.75}
            onPress={() => openCard(item)}
        >
            <View style={styles.imageWrapper}>{renderCardImage(item)}</View>

            <View style={styles.textContainer}>
                <Text style={styles.title} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                    {item.subtitle}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const visibleCards = useMemo(() => cards, [cards]);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <View style={{ height: 208 }} />

                {loading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="small" color="#F5D8CB" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {visibleCards.length > 0 ? (
                            visibleCards.map(renderCard)
                        ) : (
                            <Text style={styles.emptyText}>No items in library yet</Text>
                        )}
                        <View style={{ height: scale(100) }} />
                    </ScrollView>
                )}
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        width,
        height,
    },
    loader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: scale(16),
        paddingTop: scale(8),
        paddingBottom: scale(100),
    },
    emptyText: {
        color: 'rgba(245, 216, 203, 0.85)',
        textAlign: 'center',
        marginTop: scale(18),
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',
        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    imageWrapper: {
        marginRight: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(15),
        backgroundColor: '#333',
    },
    roundImage: {
        borderRadius: scale(45),
    },
    imageFallback: {
        backgroundColor: 'rgba(20, 8, 8, 0.8)',
    },
    artistFallback: {
        backgroundColor: 'rgba(30, 10, 8, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    artistFallbackText: {
        color: '#F5D8CB',
        fontSize: scale(26),
        fontFamily: 'Unbounded-SemiBold',
    },
    vinylContainer: {
        width: scale(80),
        height: scale(80),
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    vinylImage: {
        width: '100%',
        height: '100%',
        borderRadius: scale(45),
    },
    vinylCenter: {
        paddingTop: scale(7),
        position: 'absolute',
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: '#2A1414',
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: scale(10),
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Medium',
        marginBottom: scale(4),
    },
    subtitle: {
        color: 'rgba(245, 216, 203, 0.7)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
});
