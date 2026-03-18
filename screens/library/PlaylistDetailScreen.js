import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    addTrackToPlaylist,
    deletePlaylist,
    getIcons,
    getPlaylistCoverUrl,
    getPlaylistDetails,
    getTrackCoverUrl,
    getTracks,
    resolveArtistName,
    scale,
    uploadPlaylistCover,
} from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';
import { usePlayerStore } from '../../store/usePlayerStore';

const getTrackId = (track) =>
    String(
        track?.id ||
        track?._id ||
        track?.trackId ||
        track?.TrackId ||
        track?.track?.id ||
        ''
    ).trim();

const normalizeTrack = (item) => {
    const src = item?.track || item;
    const id = getTrackId(src) || getTrackId(item);
    if (!id) return null;
    return {
        ...item,
        ...src,
        id,
        _id: id,
    };
};

const mergeTracksWithCatalog = (playlistTracks, catalogTracks) => {
    const map = new Map(
        (Array.isArray(catalogTracks) ? catalogTracks : []).map((item) => [getTrackId(item), item])
    );

    return (Array.isArray(playlistTracks) ? playlistTracks : [])
        .map((track) => {
            const id = getTrackId(track);
            if (!id) return null;
            const base = map.get(id) || {};
            return {
                ...base,
                ...track,
                id,
                _id: id,
                artistName:
                    track?.artistName ||
                    base?.artistName ||
                    track?.artist?.name ||
                    base?.artist?.name ||
                    null,
                artist:
                    track?.artist ||
                    base?.artist ||
                    null,
                coverFileId:
                    track?.coverFileId ||
                    base?.coverFileId ||
                    null,
                ownerId:
                    track?.ownerId ||
                    base?.ownerId ||
                    track?.artistId ||
                    base?.artistId ||
                    null,
            };
        })
        .filter(Boolean);
};

const extractPlaylistTracks = (playlist) => {
    if (Array.isArray(playlist?.tracks)) return playlist.tracks.map(normalizeTrack).filter(Boolean);
    if (Array.isArray(playlist?.Tracks)) return playlist.Tracks.map(normalizeTrack).filter(Boolean);
    if (Array.isArray(playlist?.playlistTracks)) {
        return playlist.playlistTracks.map((item) => normalizeTrack(item?.track || item)).filter(Boolean);
    }
    if (Array.isArray(playlist?.PlaylistTracks)) {
        return playlist.PlaylistTracks.map((item) => normalizeTrack(item?.track || item)).filter(Boolean);
    }
    return [];
};

const getPlaylistId = (playlist, fallbackId = '') =>
    String(
        playlist?.id ||
        playlist?._id ||
        playlist?.playlistId ||
        playlist?.PlaylistId ||
        fallbackId ||
        ''
    ).trim();

const getPlaylistName = (playlist, fallbackName = 'Playlist') =>
    String(
        playlist?.name ||
        playlist?.Name ||
        playlist?.title ||
        playlist?.Title ||
        fallbackName ||
        'Playlist'
    ).trim();

const getPlaylistDescription = (playlist) =>
    String(
        playlist?.description ||
        playlist?.Description ||
        ''
    ).trim();

export default function PlaylistDetailScreen({ navigation, route }) {
    const isFocused = useIsFocused();
    const setTrack = usePlayerStore((state) => state.setTrack);

    const initialPlaylistId = String(route?.params?.playlistId || '').trim();
    const initialPlaylistName = String(route?.params?.playlistName || 'Playlist').trim();

    const [icons, setIcons] = useState({});
    const [loading, setLoading] = useState(true);
    const [playlist, setPlaylist] = useState({ id: initialPlaylistId, name: initialPlaylistName, description: '' });
    const [tracks, setTracks] = useState([]);
    const [allTracks, setAllTracks] = useState([]);
    const [userToken, setUserToken] = useState(null);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [addingTrackId, setAddingTrackId] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [coverVersion, setCoverVersion] = useState(0);
    const [localCoverUri, setLocalCoverUri] = useState(null);
    const [mainCoverBroken, setMainCoverBroken] = useState(false);
    const [brokenTrackCovers, setBrokenTrackCovers] = useState({});

    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };

    const loadData = async () => {
        if (!initialPlaylistId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const [iconsMap, details, tracksRaw] = await Promise.all([
                getIcons(),
                getPlaylistDetails(initialPlaylistId),
                getTracks(),
            ]);

            const normalizedTracks = extractPlaylistTracks(details);
            const normalizedAll = (Array.isArray(tracksRaw) ? tracksRaw : [])
                .map(normalizeTrack)
                .filter(Boolean);
            const mergedTracks = mergeTracksWithCatalog(normalizedTracks, normalizedAll);
            const token = await AsyncStorage.getItem('userToken');

            setIcons(iconsMap || {});
            setPlaylist({
                id: getPlaylistId(details, initialPlaylistId),
                name: getPlaylistName(details, initialPlaylistName),
                description: getPlaylistDescription(details),
            });
            setTracks(mergedTracks);
            setAllTracks(normalizedAll);
            setUserToken(token || null);
            setMainCoverBroken(false);
            setLocalCoverUri(null);
            setBrokenTrackCovers({});
        } catch (_) {
            setPlaylist({ id: initialPlaylistId, name: initialPlaylistName, description: '' });
            setTracks([]);
            setAllTracks([]);
        } finally {
            setLoading(false);
        }
    };

    const refreshDetailsOnly = async () => {
        if (!playlist?.id) return;
        const details = await getPlaylistDetails(playlist.id);
        const normalizedTracks = extractPlaylistTracks(details);
        setTracks(mergeTracksWithCatalog(normalizedTracks, allTracks));
        setPlaylist((prev) => ({
            id: getPlaylistId(details, prev.id),
            name: getPlaylistName(details, prev.name),
            description: getPlaylistDescription(details),
        }));
    };

    useEffect(() => {
        if (isFocused) {
            loadData();
        }
    }, [isFocused, initialPlaylistId]);

    const playlistCoverUri = useMemo(() => {
        const id = playlist?.id;
        if (!id) return null;
        const base = getPlaylistCoverUrl(id);
        if (!base) return null;
        const query = coverVersion ? `?t=${coverVersion}` : '';
        return `${base}${query}`;
    }, [playlist?.id, coverVersion]);

    const availableTracks = useMemo(() => {
        const used = new Set(tracks.map((item) => getTrackId(item)));
        return allTracks.filter((item) => {
            const id = getTrackId(item);
            return id && !used.has(id);
        });
    }, [allTracks, tracks]);

    const onPlayTrack = async (track) => {
        const trackId = getTrackId(track);
        const fullTrack = allTracks.find((item) => getTrackId(item) === trackId);
        await setTrack(fullTrack || track);
    };

    const onAddTrack = async (track) => {
        const trackId = getTrackId(track);
        if (!trackId || !playlist?.id || addingTrackId) return;

        setAddingTrackId(trackId);
        const res = await addTrackToPlaylist(playlist.id, trackId);
        setAddingTrackId('');

        if (res?.error) {
            Alert.alert('Playlist', typeof res.error === 'string' ? res.error : 'Failed to add track');
            return;
        }

        await refreshDetailsOnly();
    };

    const onDeletePlaylist = () => {
        if (!playlist?.id || deleting) return;

        Alert.alert('Delete playlist', 'Are you sure you want to delete this playlist?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setDeleting(true);
                    const res = await deletePlaylist(playlist.id);
                    setDeleting(false);

                    if (res?.error) {
                        Alert.alert('Playlist', typeof res.error === 'string' ? res.error : 'Delete failed');
                        return;
                    }

                    navigation.goBack();
                },
            },
        ]);
    };

    const onChangeCover = async () => {
        if (!playlist?.id || uploadingCover) return;

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission?.granted) {
            Alert.alert('Playlist', 'Allow photo access to upload playlist cover.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.9,
        });

        if (result.canceled || !result.assets?.[0]) return;

        setUploadingCover(true);
        const res = await uploadPlaylistCover(playlist.id, result.assets[0]);
        setUploadingCover(false);

        if (res?.error) {
            Alert.alert('Playlist', typeof res.error === 'string' ? res.error : 'Cover upload failed');
            return;
        }

        setMainCoverBroken(false);
        setLocalCoverUri(result.assets[0].uri);
        setCoverVersion(Date.now());
        await refreshDetailsOnly();
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
                    <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8} onPress={() => navigation.goBack()}>
                        <RemoteTintIcon
                            icons={icons}
                            iconName={resolveIconName('arrow-left.svg')}
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback=""
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle} numberOfLines={1}>{playlist.name || 'Playlist'}</Text>

                    <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8} onPress={onDeletePlaylist} disabled={deleting}>
                        {deleting ? <ActivityIndicator size="small" color="#FF4D4F" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loaderWrap}>
                        <ActivityIndicator size="small" color="#F5D8CB" />
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                        <View style={styles.coverWrap}>
                            {(localCoverUri || playlistCoverUri) && !mainCoverBroken ? (
                                <Image
                                    source={
                                        userToken && !localCoverUri
                                            ? {
                                                uri: playlistCoverUri,
                                                headers: { Authorization: `Bearer ${userToken}` },
                                            }
                                            : { uri: localCoverUri || playlistCoverUri }
                                    }
                                    style={styles.mainCover}
                                    resizeMode="cover"
                                    onError={() => setMainCoverBroken(true)}
                                />
                            ) : (
                                <View style={[styles.mainCover, styles.mainCoverFallback]}>
                                    <Text style={styles.mainCoverFallbackText}>
                                        {(playlist.name || 'P').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <Text style={styles.playlistName}>{playlist.name || 'Playlist'}</Text>
                        {playlist.description ? (
                            <Text style={styles.playlistDescription}>{playlist.description}</Text>
                        ) : null}
                        <Text style={styles.playlistMeta}>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}</Text>

                        <View style={styles.actionsRow}>
                            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={() => setAddModalVisible(true)}>
                                <Text style={styles.actionBtnText}>Add tracks</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={onChangeCover} disabled={uploadingCover}>
                                {uploadingCover
                                    ? <ActivityIndicator size="small" color="#F5D8CB" />
                                    : <Text style={styles.actionBtnText}>Change cover</Text>}
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.sectionTitle}>Tracks</Text>

                        {tracks.length === 0 ? (
                            <Text style={styles.emptyText}>No tracks in this playlist yet</Text>
                        ) : (
                            tracks.map((track) => {
                                const id = getTrackId(track);
                                const coverUri = getTrackCoverUrl(track);
                                const broken = brokenTrackCovers[id];

                                return (
                                    <TouchableOpacity
                                        key={id}
                                        style={styles.trackRow}
                                        activeOpacity={0.8}
                                        onPress={() => onPlayTrack(track)}
                                    >
                                        {coverUri && !broken ? (
                                            <Image
                                                source={{ uri: coverUri }}
                                                style={styles.trackCover}
                                                resizeMode="cover"
                                                onError={() => setBrokenTrackCovers((prev) => ({ ...prev, [id]: true }))}
                                            />
                                        ) : (
                                            <View style={[styles.trackCover, styles.trackCoverFallback]} />
                                        )}

                                        <View style={styles.trackMeta}>
                                            <Text style={styles.trackTitle} numberOfLines={1}>{track?.title || 'Unknown title'}</Text>
                                            <Text style={styles.trackArtist} numberOfLines={1}>{resolveArtistName(track)}</Text>
                                        </View>

                                    </TouchableOpacity>
                                );
                            })
                        )}

                        <View style={{ height: scale(120) }} />
                    </ScrollView>
                )}
            </View>

            <Modal
                visible={addModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setAddModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setAddModalVisible(false)}>
                    <Pressable style={styles.modalCard}>
                        <Text style={styles.modalTitle}>Add tracks</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {availableTracks.length === 0 ? (
                                <Text style={styles.modalEmptyText}>No available tracks</Text>
                            ) : (
                                availableTracks.map((track) => {
                                    const id = getTrackId(track);
                                    const busy = addingTrackId === id;
                                    return (
                                        <View key={id} style={styles.modalTrackRow}>
                                            <View style={styles.modalTrackTextWrap}>
                                                <Text style={styles.modalTrackTitle} numberOfLines={1}>{track?.title || 'Unknown title'}</Text>
                                                <Text style={styles.modalTrackArtist} numberOfLines={1}>{resolveArtistName(track)}</Text>
                                            </View>

                                            <TouchableOpacity
                                                style={styles.modalAddBtn}
                                                activeOpacity={0.8}
                                                onPress={() => onAddTrack(track)}
                                                disabled={busy}
                                            >
                                                {busy ? (
                                                    <ActivityIndicator size="small" color="#300C0A" />
                                                ) : (
                                                    <Text style={styles.modalAddBtnText}>Add</Text>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
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
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(16),
    },
    headerIconBtn: {
        width: scale(32),
        height: scale(32),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(20),
        textAlign: 'center',
        paddingHorizontal: scale(8),
    },
    deleteBtn: {
        minWidth: scale(54),
        height: scale(32),
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    deleteBtnText: {
        color: '#FF4D4F',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
    loaderWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: scale(16),
        paddingTop: scale(18),
        paddingBottom: scale(10),
    },
    coverWrap: {
        alignItems: 'center',
        marginBottom: scale(14),
    },
    mainCover: {
        width: scale(170),
        height: scale(170),
        borderRadius: scale(20),
        backgroundColor: '#3a1a18',
    },
    mainCoverFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 10, 8, 0.9)',
    },
    mainCoverFallbackText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(52),
    },
    playlistName: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(20),
        textAlign: 'center',
    },
    playlistDescription: {
        color: 'rgba(245,216,203,0.9)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
        textAlign: 'center',
        marginTop: scale(6),
    },
    playlistMeta: {
        color: 'rgba(245,216,203,0.8)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12),
        textAlign: 'center',
        marginTop: scale(6),
    },
    actionsRow: {
        flexDirection: 'row',
        marginTop: scale(16),
        marginBottom: scale(18),
        columnGap: scale(10),
    },
    actionBtn: {
        flex: 1,
        height: scale(38),
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.35)',
    },
    actionBtnText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(18),
        marginBottom: scale(10),
    },
    emptyText: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        textAlign: 'center',
        marginTop: scale(16),
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(12),
        borderTopLeftRadius: scale(40),
        borderBottomLeftRadius: scale(40),
        paddingRight: scale(10),
    },
    trackCover: {
        width: scale(72),
        height: scale(72),
        borderRadius: scale(14),
        backgroundColor: '#2b1312',
    },
    trackCoverFallback: {
        backgroundColor: 'rgba(30, 10, 8, 0.9)',
    },
    trackMeta: {
        flex: 1,
        paddingLeft: scale(12),
        paddingRight: scale(8),
    },
    trackTitle: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    trackArtist: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Light',
        fontSize: scale(10.5),
        marginTop: scale(2),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
        paddingHorizontal: scale(12),
        paddingBottom: scale(24),
    },
    modalCard: {
        maxHeight: '65%',
        borderRadius: scale(24),
        backgroundColor: 'rgba(42, 14, 12, 0.98)',
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.3)',
        paddingHorizontal: scale(14),
        paddingTop: scale(14),
        paddingBottom: scale(10),
    },
    modalTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(16),
        marginBottom: scale(10),
    },
    modalEmptyText: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        textAlign: 'center',
        paddingVertical: scale(20),
    },
    modalTrackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245,216,203,0.15)',
    },
    modalTrackTextWrap: {
        flex: 1,
        paddingRight: scale(10),
    },
    modalTrackTitle: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    modalTrackArtist: {
        color: 'rgba(245,216,203,0.8)',
        fontFamily: 'Poppins-Light',
        fontSize: scale(11),
    },
    modalAddBtn: {
        minWidth: scale(62),
        height: scale(32),
        borderRadius: scale(16),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(12),
    },
    modalAddBtnText: {
        color: '#300C0A',
        fontFamily: 'Poppins-SemiBold',
        fontSize: scale(12),
    },
});
