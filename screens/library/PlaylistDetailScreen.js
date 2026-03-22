import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';

import {
    addTrackToPlaylist,
    getIcons,
    getMyPlaylists,
    getPlaylistCoverUrl,
    getPlaylistDetails,
    getStreamUrl,
    getTracks,
    getLikedTracks,
    likeTrack,
    resolveArtistName,
    saveOfflineDownload,
    scale,
    uploadPlaylistCover,
    unlikeTrack,
} from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';
import ShareSheetModal from '../../components/ShareSheetModal';
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

const getPlaylistOwnerName = (playlist) =>
    String(
        playlist?.ownerName ||
        playlist?.OwnerName ||
        playlist?.creatorName ||
        playlist?.CreatorName ||
        playlist?.author ||
        playlist?.Author ||
        playlist?.userName ||
        playlist?.UserName ||
        playlist?.artistName ||
        playlist?.ArtistName ||
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
                artist: track?.artist || base?.artist || null,
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

const extractLikedIds = (raw) => {
    if (!Array.isArray(raw)) return [];
    const set = new Set();

    raw.forEach((item) => {
        if (typeof item === 'string') {
            const id = String(item).trim();
            if (id) set.add(id);
            return;
        }
        const id = getTrackId(item?.track || item);
        if (id) set.add(id);
    });

    return Array.from(set);
};

const playlistDetailSessionCache = new Map();

export default function PlaylistDetailScreen({ navigation, route }) {
    const isFocused = useIsFocused();
    const {
        setQueue,
        togglePlay,
        addToQueue,
        isPlaying,
        currentTrack,
        queue,
    } = usePlayerStore();

    const hasLoadedOnceRef = useRef(false);

    const initialPlaylistId = String(route?.params?.playlistId || '').trim();
    const initialPlaylistName = String(route?.params?.playlistName || 'Playlist').trim();
    const cacheKey = initialPlaylistId;

    const [icons, setIcons] = useState({});
    const [loading, setLoading] = useState(true);
    const [playlist, setPlaylist] = useState({
        id: initialPlaylistId,
        name: initialPlaylistName,
        description: '',
    });
    const [tracks, setTracks] = useState([]);
    const [allTracks, setAllTracks] = useState([]);
    const [likedTrackIds, setLikedTrackIds] = useState([]);
    const [userToken, setUserToken] = useState(null);
    const [coverVersion, setCoverVersion] = useState(0);
    const [mainCoverBroken, setMainCoverBroken] = useState(false);
    const [shareVisible, setShareVisible] = useState(false);
    const [moreVisible, setMoreVisible] = useState(false);
    const [copyModalVisible, setCopyModalVisible] = useState(false);
    const [myPlaylists, setMyPlaylists] = useState([]);
    const [copyingToPlaylistId, setCopyingToPlaylistId] = useState('');
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [likingAll, setLikingAll] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);

    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };

    const renderIcon = (iconName, style, tintColor = '#F5D8CB') => (
        <RemoteTintIcon
            icons={icons}
            iconName={resolveIconName(iconName)}
            width={style?.width || scale(24)}
            height={style?.height || scale(24)}
            color={tintColor}
            fallback=""
        />
    );

    const hydrateFromCache = (cached) => {
        if (!cached) return false;
        setIcons(cached.icons || {});
        setPlaylist(cached.playlist || { id: initialPlaylistId, name: initialPlaylistName, description: '' });
        setTracks(Array.isArray(cached.tracks) ? cached.tracks : []);
        setAllTracks(Array.isArray(cached.allTracks) ? cached.allTracks : []);
        setLikedTrackIds(Array.isArray(cached.likedTrackIds) ? cached.likedTrackIds : []);
        setUserToken(cached.userToken || null);
        setMainCoverBroken(false);
        return true;
    };

    const persistToCache = (patch = {}) => {
        if (!cacheKey) return;
        const prev = playlistDetailSessionCache.get(cacheKey) || {};
        playlistDetailSessionCache.set(cacheKey, { ...prev, ...patch });
    };

    const loadData = async ({ force = false } = {}) => {
        if (!initialPlaylistId) {
            setLoading(false);
            return;
        }

        if (!force) {
            const cached = playlistDetailSessionCache.get(cacheKey);
            if (hydrateFromCache(cached)) {
                hasLoadedOnceRef.current = true;
                setLoading(false);
                return;
            }
        }

        setLoading(true);
        try {
            const [iconsMap, details, tracksRaw, likedRaw] = await Promise.all([
                getIcons(),
                getPlaylistDetails(initialPlaylistId),
                getTracks(),
                getLikedTracks(),
            ]);

            const normalizedTracks = extractPlaylistTracks(details);
            const normalizedAll = (Array.isArray(tracksRaw) ? tracksRaw : []).map(normalizeTrack).filter(Boolean);
            const mergedTracks = mergeTracksWithCatalog(normalizedTracks, normalizedAll);
            const token = await AsyncStorage.getItem('userToken');
            const nextPlaylist = {
                id: getPlaylistId(details, initialPlaylistId),
                name: getPlaylistName(details, initialPlaylistName),
                description: getPlaylistDescription(details),
                ownerName: getPlaylistOwnerName(details),
            };
            const nextLikedTrackIds = extractLikedIds(likedRaw);

            setIcons(iconsMap || {});
            setPlaylist(nextPlaylist);
            setTracks(mergedTracks);
            setAllTracks(normalizedAll);
            setLikedTrackIds(nextLikedTrackIds);
            setUserToken(token || null);
            setMainCoverBroken(false);
            persistToCache({
                icons: iconsMap || {},
                playlist: nextPlaylist,
                tracks: mergedTracks,
                allTracks: normalizedAll,
                likedTrackIds: nextLikedTrackIds,
                userToken: token || null,
            });
            hasLoadedOnceRef.current = true;
        } catch (_) {
            setPlaylist({ id: initialPlaylistId, name: initialPlaylistName, description: '' });
            setTracks([]);
            setAllTracks([]);
            setLikedTrackIds([]);
            playlistDetailSessionCache.delete(cacheKey);
            hasLoadedOnceRef.current = false;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        hasLoadedOnceRef.current = false;
    }, [initialPlaylistId]);

    useEffect(() => {
        if (!isFocused || !initialPlaylistId) return;
        if (!hasLoadedOnceRef.current) {
            loadData({ force: false });
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

    const currentTrackId = getTrackId(currentTrack);
    const isCurrentTrackFromPlaylist = tracks.some((item) => getTrackId(item) === currentTrackId);
    const isPlaylistPlaying = isCurrentTrackFromPlaylist && isPlaying;

    const trackIds = useMemo(() => tracks.map((item) => getTrackId(item)).filter(Boolean), [tracks]);
    const allTracksLiked = useMemo(() => trackIds.length > 0 && trackIds.every((id) => likedTrackIds.includes(id)), [trackIds, likedTrackIds]);

    const onPlayPausePlaylist = async () => {
        if (!tracks.length) return;
        if (isCurrentTrackFromPlaylist) {
            await togglePlay();
            return;
        }
        await setQueue(tracks, 0);
    };

    const onPlayTrack = async (track, index) => {
        if (!track) return;
        const safeIndex = Number.isFinite(index) ? index : tracks.findIndex((item) => getTrackId(item) === getTrackId(track));
        const targetIndex = safeIndex >= 0 ? safeIndex : 0;
        await setQueue(tracks, targetIndex);
    };

    const onToggleTrackLike = async (track) => {
        const id = getTrackId(track);
        if (!id) return;
        const isLiked = likedTrackIds.includes(id);
        const prev = likedTrackIds;
        const next = isLiked ? likedTrackIds.filter((x) => x !== id) : [...likedTrackIds, id];
        setLikedTrackIds(next);

        const ok = isLiked ? await unlikeTrack(id) : await likeTrack(id);
        if (!ok) setLikedTrackIds(prev);
        persistToCache({ likedTrackIds: ok ? next : prev });
    };

    const onToggleLikeAll = async () => {
        if (!trackIds.length || likingAll) return;
        setLikingAll(true);

        const prev = likedTrackIds;
        const next = allTracksLiked
            ? likedTrackIds.filter((id) => !trackIds.includes(id))
            : Array.from(new Set([...likedTrackIds, ...trackIds]));
        setLikedTrackIds(next);

        const action = allTracksLiked ? unlikeTrack : likeTrack;
        const results = await Promise.all(trackIds.map((id) => action(id)));
        const ok = results.every(Boolean);
        if (!ok) {
            setLikedTrackIds(prev);
            persistToCache({ likedTrackIds: prev });
        } else {
            persistToCache({ likedTrackIds: next });
        }

        setLikingAll(false);
    };

    const onShufflePlaylist = async () => {
        if (tracks.length <= 1) {
            if (tracks.length === 1) await setQueue(tracks, 0);
            return;
        }

        const shuffled = [...tracks];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        await setQueue(shuffled, 0);
    };

    const ensureDownloadDir = async () => {
        const downloadsDir = `${FileSystem.documentDirectory}downloads`;
        const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
        }
        return downloadsDir;
    };

    const downloadSingleTrack = async (track, downloadsDir, authHeaders) => {
        const sourceTrack = track?.track || track;
        const trackId = sourceTrack?.id || sourceTrack?._id;
        if (!trackId) return false;

        const fileUri = `${downloadsDir}/${trackId}.mp3`;
        const existing = await FileSystem.getInfoAsync(fileUri);
        if (!existing.exists) {
            await FileSystem.downloadAsync(getStreamUrl(trackId), fileUri, {
                headers: authHeaders,
            });
        }

        const payload = {
            ...sourceTrack,
            id: sourceTrack.id || sourceTrack._id,
            title: sourceTrack.title || 'Unknown title',
            artistName: resolveArtistName(sourceTrack, 'Unknown Artist'),
            localUri: fileUri,
            downloadedAt: new Date().toISOString(),
        };

        const saveResult = await saveOfflineDownload(payload);
        return !saveResult?.error;
    };

    const onDownloadPlaylist = async () => {
        if (!tracks.length || downloadingAll) return;
        setDownloadingAll(true);

        try {
            const token = userToken || (await AsyncStorage.getItem('userToken'));
            const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
            const downloadsDir = await ensureDownloadDir();

            let success = 0;
            let fail = 0;
            // Sequential to avoid overloading network/file system
            for (const track of tracks) {
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const ok = await downloadSingleTrack(track, downloadsDir, authHeaders);
                    if (ok) success += 1;
                    else fail += 1;
                } catch (_) {
                    fail += 1;
                }
            }

            if (fail > 0) {
                Alert.alert('Downloads', `Downloaded: ${success}\nFailed: ${fail}`);
            } else {
                Alert.alert('Downloads', `Downloaded ${success} ${success === 1 ? 'track' : 'tracks'}`);
            }
        } catch (e) {
            Alert.alert('Downloads', 'Failed to download playlist');
        } finally {
            setDownloadingAll(false);
        }
    };

    const onPickAndUploadCover = async () => {
        if (!playlist?.id || uploadingCover) return;

        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (permission?.status !== 'granted') {
                Alert.alert('Permission needed', 'Allow gallery access to change playlist cover.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
            });

            if (result?.canceled || !result?.assets?.length) return;

            setUploadingCover(true);
            const upload = await uploadPlaylistCover(playlist.id, result.assets[0]);

            if (upload?.error) {
                Alert.alert('Cover', typeof upload.error === 'string' ? upload.error : 'Failed to update cover');
                return;
            }

            setMainCoverBroken(false);
            setCoverVersion(Date.now());
        } catch (_) {
            Alert.alert('Cover', 'Failed to update cover');
        } finally {
            setUploadingCover(false);
        }
    };

    const onOpenMore = () => {
        setMoreVisible(true);
    };

    const onCloseMore = () => {
        setMoreVisible(false);
    };

    const onAddPlaylistToQueue = async () => {
        onCloseMore();
        if (!tracks.length) return;

        if (!currentTrackId) {
            await setQueue(tracks, 0);
            return;
        }

        const existingIds = new Set((Array.isArray(queue) ? queue : []).map((item) => getTrackId(item)).filter(Boolean));
        const unique = tracks.filter((item) => {
            const id = getTrackId(item);
            return id && !existingIds.has(id);
        });

        unique.forEach((item) => addToQueue(item));
        Alert.alert('Queue', `Added ${unique.length} ${unique.length === 1 ? 'track' : 'tracks'} to queue`);
    };

    const loadMyPlaylists = async () => {
        try {
            const raw = await getMyPlaylists();
            const list = Array.isArray(raw) ? raw : [];
            const normalized = list
                .map((item) => ({
                    id: getPlaylistId(item),
                    name: getPlaylistName(item, 'Playlist'),
                }))
                .filter((item) => item.id && item.id !== playlist.id);
            setMyPlaylists(normalized);
        } catch (_) {
            setMyPlaylists([]);
        }
    };

    const onOpenCopyModal = async () => {
        onCloseMore();
        await loadMyPlaylists();
        setCopyModalVisible(true);
    };

    const onCopyAllTracksToPlaylist = async (targetPlaylistId) => {
        if (!targetPlaylistId || !tracks.length || copyingToPlaylistId) return;
        setCopyingToPlaylistId(targetPlaylistId);

        let added = 0;
        let failed = 0;
        for (const track of tracks) {
            const trackId = getTrackId(track);
            if (!trackId) {
                failed += 1;
                continue;
            }
            try {
                // eslint-disable-next-line no-await-in-loop
                const res = await addTrackToPlaylist(targetPlaylistId, trackId);
                if (res?.error) failed += 1;
                else added += 1;
            } catch (_) {
                failed += 1;
            }
        }

        setCopyingToPlaylistId('');
        setCopyModalVisible(false);
        Alert.alert('Playlist', `Added: ${added}\nSkipped: ${failed}`);
    };

    const shareUrl = playlistCoverUri;
    const shareTitle = `${playlist?.name || 'Playlist'}${playlist?.description ? ` — ${playlist.description}` : ''}`;

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
                        {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) })}
                    </TouchableOpacity>
                    <View style={styles.headerSpacer} />
                    <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.8} onPress={onOpenMore}>
                        {renderIcon('more.svg', { width: scale(24), height: scale(24) })}
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loaderWrap}>
                        <ActivityIndicator size="small" color="#F5D8CB" />
                    </View>
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                        <View style={styles.coverWrap}>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={onPickAndUploadCover}
                                style={styles.mainCoverTouch}
                                disabled={uploadingCover}
                            >
                                {playlistCoverUri && !mainCoverBroken ? (
                                    <Image
                                        source={
                                            userToken
                                                ? {
                                                    uri: playlistCoverUri,
                                                    headers: { Authorization: `Bearer ${userToken}` },
                                                }
                                                : { uri: playlistCoverUri }
                                        }
                                        style={styles.mainCover}
                                        resizeMode="cover"
                                        onError={() => setMainCoverBroken(true)}
                                    />
                                ) : (
                                    <View style={[styles.mainCover, styles.mainCoverFallback]}>
                                        <Text style={styles.mainCoverFallbackText}>
                                            {(playlist?.name || 'P').charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}

                                {uploadingCover ? (
                                    <View style={styles.coverUploadingOverlay}>
                                        <ActivityIndicator size="small" color="#F5D8CB" />
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.coverHint}>Tap cover to change</Text>

                        <Text style={styles.playlistName} numberOfLines={2}>
                            {playlist?.name || 'Playlist'}
                        </Text>

                        <View style={styles.actionsRow}>
                            <TouchableOpacity style={styles.actionCircle} activeOpacity={0.85} onPress={onDownloadPlaylist} disabled={downloadingAll}>
                                {downloadingAll ? (
                                    <ActivityIndicator size="small" color="#F5D8CB" />
                                ) : (
                                    renderIcon('download.svg', { width: scale(24), height: scale(24) })
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionCircle} activeOpacity={0.85} onPress={onToggleLikeAll} disabled={likingAll}>
                                {likingAll ? (
                                    <ActivityIndicator size="small" color="#F5D8CB" />
                                ) : (
                                    renderIcon(allTracksLiked ? 'added.svg' : 'add.svg', { width: scale(24), height: scale(24) })
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.playCircle} activeOpacity={0.9} onPress={onPlayPausePlaylist}>
                                {renderIcon(isPlaylistPlaying ? 'pause.svg' : 'play.svg', { width: scale(24), height: scale(24) }, '#300C0A')}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionCircle} activeOpacity={0.85} onPress={() => setShareVisible(true)}>
                                {renderIcon('share.svg', { width: scale(24), height: scale(24) })}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionCircle} activeOpacity={0.85} onPress={onShufflePlaylist}>
                                {renderIcon('shuffle.svg', { width: scale(24), height: scale(24) })}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.listBlock}>
                            {tracks.map((track, index) => {
                                const id = getTrackId(track);
                                const isLiked = likedTrackIds.includes(id);

                                return (
                                    <TouchableOpacity
                                        key={`${id}-${index}`}
                                        style={styles.trackRow}
                                        activeOpacity={0.85}
                                        onPress={() => onPlayTrack(track, index)}
                                    >
                                        <View style={styles.trackTextWrap}>
                                            <Text style={styles.trackTitle} numberOfLines={1}>{track?.title || 'Unknown title'}</Text>
                                            <Text style={styles.trackArtist} numberOfLines={1}>{resolveArtistName(track, 'Unknown Artist')}</Text>
                                        </View>

                                        <TouchableOpacity
                                            style={styles.trackLikeBtn}
                                            activeOpacity={0.8}
                                            onPress={(e) => {
                                                e.stopPropagation();
                                                onToggleTrackLike(track);
                                            }}
                                        >
                                            {renderIcon(isLiked ? 'added.svg' : 'add.svg', { width: scale(24), height: scale(24) })}
                                        </TouchableOpacity>

                                        <View style={styles.trackDivider} />
                                    </TouchableOpacity>
                                );
                            })}

                            {!tracks.length ? (
                                <Text style={styles.emptyText}>No tracks in this playlist yet</Text>
                            ) : null}
                        </View>

                        <View style={{ height: scale(120) }} />
                    </ScrollView>
                )}
            </View>

            <Modal visible={moreVisible} transparent animationType="fade" onRequestClose={onCloseMore}>
                <Pressable style={styles.modalOverlay} onPress={onCloseMore}>
                    <Pressable style={styles.moreSheet} onPress={() => {}}>
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                            locations={[0, 0.2, 1]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={styles.moreBorderGradient}
                        >
                            <BlurView intensity={40} tint="dark" style={styles.moreGlassContainer}>
                                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30, 10, 8, 0.86)' }]} />

                                <View style={styles.moreInner}>
                                    <Text style={styles.moreTitle}>More</Text>

                                    <TouchableOpacity style={styles.moreItem} activeOpacity={0.85} onPress={onOpenCopyModal}>
                                        <View style={styles.moreItemIconCircle}>
                                            {renderIcon('added.svg', { width: scale(24), height: scale(24) })}
                                        </View>
                                        <Text style={styles.moreItemText}>Add to another playlist</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.moreItem} activeOpacity={0.85} onPress={onAddPlaylistToQueue}>
                                        <View style={styles.moreItemIconCircle}>
                                            {renderIcon('add to queue.svg', { width: scale(24), height: scale(24) })}
                                        </View>
                                        <Text style={styles.moreItemText}>Add to queue</Text>
                                    </TouchableOpacity>
                                </View>
                            </BlurView>
                        </LinearGradient>
                    </Pressable>
                </Pressable>
            </Modal>

            <Modal visible={copyModalVisible} transparent animationType="fade" onRequestClose={() => setCopyModalVisible(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setCopyModalVisible(false)}>
                    <Pressable style={styles.copyCard} onPress={() => {}}>
                        <Text style={styles.copyTitle}>Choose playlist</Text>
                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: scale(280) }}>
                            {myPlaylists.length === 0 ? (
                                <Text style={styles.copyEmpty}>No playlists available</Text>
                            ) : (
                                myPlaylists.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.copyRow}
                                        activeOpacity={0.85}
                                        disabled={Boolean(copyingToPlaylistId)}
                                        onPress={() => onCopyAllTracksToPlaylist(item.id)}
                                    >
                                        <Text style={styles.copyRowText} numberOfLines={1}>{item.name}</Text>
                                        {copyingToPlaylistId === item.id ? (
                                            <ActivityIndicator size="small" color="#300C0A" />
                                        ) : (
                                            <Text style={styles.copyAdd}>Add</Text>
                                        )}
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            <ShareSheetModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                renderIcon={(iconName, style, color) => renderIcon(iconName, style, color)}
                shareTitle={shareTitle}
                shareUrl={shareUrl}
            />
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
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        marginBottom: scale(14),
    },
    headerIconBtn: {
        width: scale(24),
        height: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSpacer: {
        width: scale(24),
        height: scale(24),
    },
    loaderWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingHorizontal: scale(16),
        paddingBottom: scale(12),
    },
    coverWrap: {
        alignItems: 'center',
        marginBottom: scale(6),
        marginTop: scale(10),
    },
    mainCoverTouch: {
        borderRadius: scale(24),
    },
    mainCover: {
        width: scale(198),
        height: scale(198),
        borderRadius: scale(24),
        backgroundColor: '#2d1312',
    },
    mainCoverFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 10, 8, 0.9)',
    },
    mainCoverFallbackText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(64),
    },
    coverUploadingOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        borderRadius: scale(24),
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    coverHint: {
        marginTop: 0,
        marginBottom: scale(10),
        color: 'rgba(245,216,203,0.75)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(11),
        textAlign: 'center',
    },
    playlistName: {
        color: '#fff',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(20),
        textAlign: 'center',
        marginBottom: scale(5),
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: scale(15),
        marginTop: scale(10),
        marginBottom: scale(20),
    },
    actionCircle: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    playCircle: {
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    listBlock: {
        marginTop: scale(4),
    },
    trackRow: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: scale(66),
    },
    trackTextWrap: {
        flex: 1,
        paddingRight: scale(10),
    },
    trackTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(16),
        marginBottom: scale(2),
    },
    trackArtist: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(15),
    },
    trackLikeBtn: {
        width: scale(34),
        height: scale(34),
        alignItems: 'center',
        justifyContent: 'center',
    },
    trackDivider: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 1,
        backgroundColor: 'rgba(245, 216, 203, 0.8)',
    },
    emptyText: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        textAlign: 'center',
        marginTop: scale(18),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.42)',
        justifyContent: 'flex-end',
    },
    moreSheet: {
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    moreBorderGradient: {
        width: '100%',
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        paddingTop: 1.5,
        paddingHorizontal: 1.5,
        paddingBottom: 0,
    },
    moreGlassContainer: {
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        overflow: 'hidden',
    },
    moreInner: {
        paddingHorizontal: scale(20),
        paddingTop: scale(18),
        paddingBottom: scale(26),
    },
    moreTitle: {
        textAlign: 'center',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(24),
        color: '#F5D8CB',
        marginBottom: scale(18),
    },
    moreItem: {
        height: scale(52),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(26),
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: scale(16),
        marginBottom: scale(14),
    },
    moreItemIconCircle: {
        width: scale(52),
        height: scale(52),
        borderRadius: scale(26),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(14),
    },
    moreItemText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(17),
    },
    copyCard: {
        marginHorizontal: scale(16),
        marginBottom: scale(26),
        borderRadius: scale(22),
        backgroundColor: 'rgba(42, 14, 12, 0.98)',
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.3)',
        paddingHorizontal: scale(14),
        paddingTop: scale(14),
        paddingBottom: scale(12),
    },
    copyTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(16),
        marginBottom: scale(10),
    },
    copyEmpty: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        textAlign: 'center',
        paddingVertical: scale(20),
    },
    copyRow: {
        minHeight: scale(42),
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245,216,203,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: scale(8),
    },
    copyRowText: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        marginRight: scale(10),
    },
    copyAdd: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-SemiBold',
        fontSize: scale(12),
    },
});
