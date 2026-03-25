import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { addTrackToPlaylist, getMyPlaylists, getPlaylistCoverUrl, scale } from '../../api/api';

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

const getPlaylistTracksCount = (playlist) => {
    const value =
        playlist?.tracksCount ??
        playlist?.TracksCount ??
        playlist?.trackCount ??
        playlist?.TrackCount ??
        (Array.isArray(playlist?.tracks) ? playlist.tracks.length : null) ??
        (Array.isArray(playlist?.Tracks) ? playlist.Tracks.length : null);

    return Number.isFinite(Number(value)) ? Number(value) : 0;
};

export default function AddToPlaylistScreen({ navigation, route }) {
    const title = String(route?.params?.title || 'Add to playlist').trim();
    const excludePlaylistId = String(route?.params?.excludePlaylistId || '').trim();
    const rawTrackIds = route?.params?.trackIds;

    const trackIds = useMemo(() => {
        const list = Array.isArray(rawTrackIds) ? rawTrackIds : [rawTrackIds];
        return Array.from(
            new Set(
                list
                    .map((item) => String(item || '').trim())
                    .filter(Boolean)
            )
        );
    }, [rawTrackIds]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [playlists, setPlaylists] = useState([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
    const [userToken, setUserToken] = useState(null);
    const [brokenCovers, setBrokenCovers] = useState({});

    useEffect(() => {
        let isMounted = true;
        AsyncStorage.getItem('userToken')
            .then((token) => {
                if (isMounted) setUserToken(token || null);
            })
            .catch(() => {
                if (isMounted) setUserToken(null);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadPlaylists = async () => {
            setLoading(true);
            try {
                const raw = await getMyPlaylists({ force: true });
                if (!isMounted) return;

                const list = (Array.isArray(raw) ? raw : [])
                    .map((item, index) => ({
                        id: getPlaylistId(item),
                        name: getPlaylistName(item, index),
                        tracksCount: getPlaylistTracksCount(item),
                    }))
                    .filter((item) => item.id && item.id !== excludePlaylistId);

                setPlaylists(list);
                setSelectedPlaylistId('');
            } catch (_) {
                if (!isMounted) return;
                setPlaylists([]);
                setSelectedPlaylistId('');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadPlaylists();

        return () => {
            isMounted = false;
        };
    }, [excludePlaylistId]);

    const handleConfirm = async () => {
        if (!selectedPlaylistId) return;
        if (!trackIds.length) return;
        if (saving) return;

        setSaving(true);
        let hasFatalError = false;

        try {
            for (const trackId of trackIds) {
                // eslint-disable-next-line no-await-in-loop
                await addTrackToPlaylist(selectedPlaylistId, trackId);
            }
        } catch (_) {
            hasFatalError = true;
        } finally {
            setSaving(false);
        }

        if (!hasFatalError) {
            navigation.goBack();
        }
    };

    const renderRow = ({ item }) => {
        const isSelected = item.id === selectedPlaylistId;
        const coverUrl = getPlaylistCoverUrl(item.id);
        const isCoverBroken = Boolean(brokenCovers[item.id]);

        return (
            <TouchableOpacity
                activeOpacity={0.85}
                style={styles.playlistRow}
                onPress={() => {
                    setSelectedPlaylistId((prev) => (prev === item.id ? '' : item.id));
                }}
            >
                {coverUrl && !isCoverBroken ? (
                    <Image
                        source={
                            userToken
                                ? { uri: coverUrl, headers: { Authorization: `Bearer ${userToken}` } }
                                : { uri: coverUrl }
                        }
                        style={styles.playlistCover}
                        resizeMode="cover"
                        onError={() => setBrokenCovers((prev) => ({ ...prev, [item.id]: true }))}
                    />
                ) : (
                    <View style={[styles.playlistCover, styles.playlistCoverFallback]}>
                        <Text style={styles.playlistCoverFallbackText}>
                            {(item.name || 'P').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                <View style={styles.playlistTextWrap}>
                    <Text style={styles.playlistName} numberOfLines={1}>
                        {item.name}
                    </Text>
                    <Text style={styles.playlistMeta} numberOfLines={1}>
                        {item.tracksCount} tracks
                    </Text>
                </View>

                <View style={styles.radioOuter}>
                    {isSelected ? <View style={styles.radioInner} /> : null}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <LinearGradient
            colors={['#9A4B39', '#80291E', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.8}>
                        <Text style={styles.backText}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{title}</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <Text style={styles.subtitle}>
                    {trackIds.length > 1 ? `${trackIds.length} tracks selected` : '1 track selected'}
                </Text>

                {loading ? (
                    <View style={styles.loaderWrap}>
                        <ActivityIndicator size="small" color="#F5D8CB" />
                    </View>
                ) : playlists.length === 0 ? (
                    <View style={styles.emptyWrap}>
                        <Text style={styles.emptyText}>No playlists available</Text>
                    </View>
                ) : (
                    <FlatList
                        data={playlists}
                        keyExtractor={(item) => item.id}
                        renderItem={renderRow}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                )}

                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleConfirm}
                    disabled={saving || !selectedPlaylistId}
                    style={[styles.confirmButton, (saving || !selectedPlaylistId) && styles.confirmButtonDisabled]}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#300C0A" />
                    ) : (
                        <Text style={styles.confirmText}>Confirm</Text>
                    )}
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingTop: scale(56),
        paddingHorizontal: scale(20),
        paddingBottom: scale(28),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(10),
    },
    backButton: {
        width: scale(28),
        height: scale(28),
        alignItems: 'center',
        justifyContent: 'center',
    },
    backText: {
        color: '#F5D8CB',
        fontSize: scale(30),
        lineHeight: scale(30),
        marginTop: scale(-3),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(20),
    },
    headerSpacer: {
        width: scale(28),
        height: scale(28),
    },
    subtitle: {
        color: 'rgba(245, 216, 203, 0.8)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        marginBottom: scale(14),
    },
    loaderWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: 'rgba(245, 216, 203, 0.8)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(15),
    },
    listContent: {
        paddingBottom: scale(110),
    },
    playlistRow: {
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: scale(72),
        borderRadius: scale(18),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: scale(16),
        marginBottom: scale(12),
    },
    playlistCover: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(12),
        marginRight: scale(12),
        backgroundColor: 'rgba(0,0,0,0.18)',
    },
    playlistCoverFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    playlistCoverFallbackText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(18),
    },
    radioOuter: {
        width: scale(22),
        height: scale(22),
        borderRadius: scale(11),
        borderWidth: 1.5,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: scale(12),
    },
    radioInner: {
        width: scale(10),
        height: scale(10),
        borderRadius: scale(5),
        backgroundColor: '#F5D8CB',
    },
    playlistTextWrap: {
        flex: 1,
    },
    playlistName: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(16),
    },
    playlistMeta: {
        color: 'rgba(245, 216, 203, 0.82)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
        marginTop: scale(3),
    },
    confirmButton: {
        position: 'absolute',
        left: scale(20),
        right: scale(20),
        bottom: scale(28),
        height: scale(54),
        borderRadius: scale(28),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonDisabled: {
        opacity: 0.55,
    },
    confirmText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(18),
    },
});
