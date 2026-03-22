import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import {
    getAlbums,
    getAlbumDetails,
    getAlbumCoverUrl,
    getLikedAlbums,
    getMyAlbums,
    scale,
} from '../../api/api';

const { width, height } = Dimensions.get('window');

const normalizeAlbumId = (album) =>
    String(
        album?.id ||
            album?.Id ||
            album?._id ||
            album?.albumId ||
            album?.AlbumId ||
            ''
    ).trim();

const resolveAlbumArtist = (album) =>
    String(
        album?.artist?.name ||
            album?.artistName ||
            album?.artist ||
            'Unknown Artist'
    ).trim();

const resolveAlbumTitle = (album) =>
    String(album?.title || album?.name || 'Untitled album').trim();

let libraryAlbumSessionCache = null;

export default function LibraryAlbum({ navigation }) {
    const isFocused = useIsFocused();
    const hasLoadedOnceRef = useRef(Boolean(libraryAlbumSessionCache));
    const [loading, setLoading] = useState(!libraryAlbumSessionCache);
    const [albums, setAlbums] = useState(() => libraryAlbumSessionCache?.albums || []);

    const toArray = (value) => {
        if (Array.isArray(value)) return value;
        if (Array.isArray(value?.items)) return value.items;
        if (Array.isArray(value?.data)) return value.data;
        if (Array.isArray(value?.result)) return value.result;
        return [];
    };

    const loadAlbums = useCallback(async ({ force = false, silent = false } = {}) => {
        if (!force && libraryAlbumSessionCache) {
            setAlbums(libraryAlbumSessionCache.albums || []);
            setLoading(false);
            hasLoadedOnceRef.current = true;
            return;
        }

        if (!silent) setLoading(true);
        try {
            const [myAlbumsRaw, likedAlbumIdsRaw, allAlbumsRaw] = await Promise.all([
                getMyAlbums({ force }),
                getLikedAlbums({ force }),
                getAlbums({ force }),
            ]);

            const myAlbums = toArray(myAlbumsRaw);
            const allAlbums = toArray(allAlbumsRaw);
            const likedAlbumIds = (Array.isArray(likedAlbumIdsRaw) ? likedAlbumIdsRaw : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean);

            const likedIdSet = new Set(likedAlbumIds);
            const likedFromAll = allAlbums.filter((album) => likedIdSet.has(normalizeAlbumId(album)));

            const unresolvedLikedIds = likedAlbumIds.filter(
                (albumId) => !likedFromAll.some((album) => normalizeAlbumId(album) === albumId)
            );

            const likedDetailsFallbackRaw = await Promise.all(
                unresolvedLikedIds.map(async (albumId) => {
                    try {
                        const album = await getAlbumDetails(albumId);
                        if (!album) return null;
                        return { ...album, id: normalizeAlbumId(album) || albumId };
                    } catch (_) {
                        return null;
                    }
                })
            );
            const likedDetailsFallback = likedDetailsFallbackRaw.filter(Boolean);

            const uniqueById = new Map();
            [...myAlbums, ...likedFromAll, ...likedDetailsFallback].forEach((album) => {
                const id = normalizeAlbumId(album);
                if (!id) return;
                if (!uniqueById.has(id)) {
                    uniqueById.set(id, album);
                }
            });

            const mapped = Array.from(uniqueById.values())
                .map((album) => {
                    const id = normalizeAlbumId(album);
                    return {
                        id,
                        raw: album,
                        title: resolveAlbumTitle(album),
                        subtitle: `Album / ${resolveAlbumArtist(album)}`,
                        image: getAlbumCoverUrl(id),
                    };
                })
                .sort((a, b) => a.title.localeCompare(b.title));

            setAlbums(mapped);
            libraryAlbumSessionCache = { albums: mapped };
        } catch (_) {
            if (!silent) {
                hasLoadedOnceRef.current = false;
                setAlbums([]);
                libraryAlbumSessionCache = { albums: [] };
            }
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isFocused) return;
        if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            loadAlbums({ force: false });
            return;
        }
        loadAlbums({ force: true, silent: true });
    }, [isFocused, loadAlbums]);

    const content = useMemo(() => {
        if (loading) {
            return (
                <View style={styles.centerState}>
                    <ActivityIndicator size="small" color="#F5D8CB" />
                </View>
            );
        }

        if (albums.length === 0) {
            return (
                <View style={styles.centerState}>
                    <Text style={styles.emptyText}>No albums yet</Text>
                </View>
            );
        }

        return albums.map((item) => (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('AlbumDetail', { id: item.id, album: item.raw })}
            >
                <View style={styles.imageWrapper}>
                    <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                    </Text>
                </View>
            </TouchableOpacity>
        ));
    }, [albums, loading, navigation]);

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

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {content}
                    <View style={{ height: scale(100) }} />
                </ScrollView>
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
    scrollContent: {
        paddingHorizontal: scale(16),
        paddingTop: scale(8),
        paddingBottom: scale(100),
    },
    centerState: {
        minHeight: scale(140),
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: 'rgba(245,216,203,0.85)',
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
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        opacity: 0.9,
    },
});
