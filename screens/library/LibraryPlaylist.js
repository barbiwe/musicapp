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
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyPlaylists, getPlaylistCoverUrl, getTrackCoverUrl, scale } from '../../api/api';

const { width, height } = Dimensions.get('window');

const getPlaylistId = (playlist) =>
    String(
        playlist?.id ||
        playlist?._id ||
        playlist?.playlistId ||
        playlist?.PlaylistId ||
        ''
    ).trim();

const getPlaylistName = (playlist, index) =>
    String(
        playlist?.name ||
        playlist?.Name ||
        playlist?.title ||
        playlist?.Title ||
        `Playlist ${index + 1}`
    ).trim();

const getPlaylistTracks = (playlist) => {
    if (Array.isArray(playlist?.tracks)) return playlist.tracks;
    if (Array.isArray(playlist?.Tracks)) return playlist.Tracks;
    if (Array.isArray(playlist?.playlistTracks)) {
        return playlist.playlistTracks.map((item) => item?.track || item).filter(Boolean);
    }
    if (Array.isArray(playlist?.PlaylistTracks)) {
        return playlist.PlaylistTracks.map((item) => item?.track || item).filter(Boolean);
    }
    return [];
};

const getTrackCount = (playlist, tracks) => {
    const directCount =
        playlist?.tracksCount ??
        playlist?.TracksCount ??
        playlist?.trackCount ??
        playlist?.TrackCount ??
        null;

    if (typeof directCount === 'number' && Number.isFinite(directCount)) return directCount;
    return Array.isArray(tracks) ? tracks.length : 0;
};

const getCoverUri = (playlist, tracks) => {
    const direct =
        playlist?.coverUrl ||
        playlist?.CoverUrl ||
        playlist?.imageUrl ||
        playlist?.ImageUrl ||
        null;
    if (direct && typeof direct === 'string') return direct;

    const firstTrack = Array.isArray(tracks) && tracks.length > 0 ? tracks[0] : null;
    return firstTrack ? getTrackCoverUrl(firstTrack) : null;
};

let libraryPlaylistSessionCache = null;

export default function LibraryPlaylist({ navigation }) {
    const isFocused = useIsFocused();
    const hasLoadedOnceRef = useRef(Boolean(libraryPlaylistSessionCache));
    const [loading, setLoading] = useState(!libraryPlaylistSessionCache);
    const [playlists, setPlaylists] = useState(() => libraryPlaylistSessionCache?.playlists || []);
    const [failedPrimaryCovers, setFailedPrimaryCovers] = useState({});
    const [brokenCovers, setBrokenCovers] = useState({});
    const [userToken, setUserToken] = useState(() => libraryPlaylistSessionCache?.userToken || null);

    useEffect(() => {
        if (!isFocused) return;
        if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            loadPlaylists({ force: false });
            return;
        }
        loadPlaylists({ force: true, silent: true });
    }, [isFocused]);

    const loadPlaylists = async ({ force = false, silent = false } = {}) => {
        if (!force && libraryPlaylistSessionCache) {
            setPlaylists(libraryPlaylistSessionCache.playlists || []);
            setUserToken(libraryPlaylistSessionCache.userToken || null);
            setFailedPrimaryCovers({});
            setBrokenCovers({});
            setLoading(false);
            hasLoadedOnceRef.current = true;
            return;
        }

        if (!silent) setLoading(true);
        try {
            const [raw, token] = await Promise.all([
                getMyPlaylists({ force }),
                AsyncStorage.getItem('userToken'),
            ]);
            const list = (Array.isArray(raw) ? raw : [])
                .map((item, index) => {
                    const id = getPlaylistId(item);
                    if (!id) return null;

                    const tracks = getPlaylistTracks(item);
                    const count = getTrackCount(item, tracks);

                    return {
                        id,
                        title: getPlaylistName(item, index),
                        subtitle: `${count} ${count === 1 ? 'track' : 'tracks'}`,
                        imagePrimary: getPlaylistCoverUrl(id),
                        imageFallback: getCoverUri(item, tracks),
                    };
                })
                .filter(Boolean);

            setPlaylists(list);
            setUserToken(token || null);
            setFailedPrimaryCovers({});
            setBrokenCovers({});
            libraryPlaylistSessionCache = {
                playlists: list,
                userToken: token || null,
            };
        } catch (_) {
            if (!silent) {
                hasLoadedOnceRef.current = false;
                setPlaylists([]);
                libraryPlaylistSessionCache = {
                    playlists: [],
                    userToken: null,
                };
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const sortedPlaylists = useMemo(() => {
        return [...playlists].sort((a, b) => a.title.localeCompare(b.title));
    }, [playlists]);

    const renderCard = (item) => {
        const failedPrimary = failedPrimaryCovers[item.id];
        const broken = brokenCovers[item.id];
        const imageUri = failedPrimary ? item.imageFallback : item.imagePrimary;
        const hasImage = imageUri && !broken;

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() =>
                    navigation?.navigate('PlaylistDetail', {
                        playlistId: item.id,
                        playlistName: item.title,
                    })
                }
            >
                <View style={styles.imageWrapper}>
                    {hasImage ? (
                        <Image
                            source={
                                userToken && !failedPrimary
                                    ? {
                                        uri: imageUri,
                                        headers: { Authorization: `Bearer ${userToken}` },
                                    }
                                    : { uri: imageUri }
                            }
                            style={styles.image}
                            resizeMode="cover"
                            onError={() => {
                                if (!failedPrimary && item.imageFallback) {
                                    setFailedPrimaryCovers((prev) => ({ ...prev, [item.id]: true }));
                                } else {
                                    setBrokenCovers((prev) => ({ ...prev, [item.id]: true }));
                                }
                            }}
                        />
                    ) : (
                        <View style={[styles.image, styles.imageFallback]}>
                            <Text style={styles.fallbackNote}>P</Text>
                        </View>
                    )}
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
        );
    };

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
                        {sortedPlaylists.length > 0 ? (
                            sortedPlaylists.map(renderCard)
                        ) : (
                            <Text style={styles.emptyText}>No playlists yet</Text>
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
    imageFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 10, 8, 0.9)',
    },
    fallbackNote: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(26),
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
        color: 'rgba(245, 216, 203, 0.8)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    emptyText: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        marginTop: scale(20),
    },
});
