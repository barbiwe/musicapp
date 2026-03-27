import React, { useEffect, useState } from 'react';
import {
    Dimensions,
    Image,
    Platform,
    Pressable,
    StatusBar,
    View,
    Text,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    Keyboard,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Modal,
    FlatList,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';
import {
    createAlbum,
    createPodcast,
    getAlbums,
    getGenres,
    getIcons,
    getPodcastGenres,
    refreshUserToken,
    scale,
    uploadTrack,
} from '../api/api';
import RemoteTintIcon from '../components/RemoteTintIcon';

const getEntityId = (item) =>
    String(
        item?.id ||
        item?.Id ||
        item?._id ||
        item?.podcastId ||
        item?.PodcastId ||
        item?.albumId ||
        item?.AlbumId ||
        item?.trackId ||
        item?.TrackId ||
        item?.genreId ||
        item?.GenreId ||
        ''
    ).trim();
const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CREATE_MODES = ['track', 'podcast', 'album'];
const resolveCreateMode = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return CREATE_MODES.includes(normalized) ? normalized : null;
};
const createAlbumTrackDraft = () => ({
    id: `album-track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    file: null,
});
const createPodcastEpisodeDraft = () => ({
    id: `podcast-episode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    description: '',
    audio: null,
});
const isArtistRoleValue = (value) => {
    if (value === null || value === undefined) return false;
    if (Array.isArray(value)) return value.some(isArtistRoleValue);

    const raw = String(value).trim().toLowerCase();
    if (!raw) return false;

    return raw === '2' || raw === 'artist' || raw.includes('artist');
};
const extractRoleFromToken = (token) => {
    if (!token) return null;
    try {
        const decoded = jwtDecode(token);
        const candidates = [
            decoded?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
            decoded?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
            decoded?.role,
            decoded?.Role,
        ];
        for (const candidate of candidates) {
            if (candidate !== null && candidate !== undefined) return candidate;
        }
        return null;
    } catch (_) {
        return null;
    }
};

export default function MusicScreen({ navigation, route }) {
    const initialMode = resolveCreateMode(route?.params?.initialMode) || 'track';
    const [mode, setMode] = useState(initialMode);
    const [artistId, setArtistId] = useState(null);
    const [icons, setIcons] = useState({});
    const [uploadPermissionReady, setUploadPermissionReady] = useState(false);
    const [hasUploadPermission, setHasUploadPermission] = useState(false);

    // Track upload state
    const [trackTitle, setTrackTitle] = useState('');
    const [trackLyrics, setTrackLyrics] = useState('');
    const [trackProducers, setTrackProducers] = useState('');
    const [trackLyricists, setTrackLyricists] = useState('');
    const [trackFile, setTrackFile] = useState(null);
    const [trackCover, setTrackCover] = useState(null);
    const [albums, setAlbums] = useState([]);
    const [selectedAlbum, setSelectedAlbum] = useState(null);
    const [trackGenres, setTrackGenres] = useState([]);
    const [selectedTrackGenreIds, setSelectedTrackGenreIds] = useState([]);
    const [isAlbumModalVisible, setAlbumModalVisible] = useState(false);
    const [isTrackGenreModalVisible, setTrackGenreModalVisible] = useState(false);
    const [isTrackGenreOpen, setIsTrackGenreOpen] = useState(false);
    const [trackLoading, setTrackLoading] = useState(false);

    // Album draft state (UI first; backend wiring can be connected next)
    const [albumTitle, setAlbumTitle] = useState('');
    const [albumCover, setAlbumCover] = useState(null);
    const [selectedAlbumGenreIds, setSelectedAlbumGenreIds] = useState([]);
    const [isAlbumGenreOpen, setIsAlbumGenreOpen] = useState(false);
    const [albumTracks, setAlbumTracks] = useState([createAlbumTrackDraft()]);
    const [albumLoading, setAlbumLoading] = useState(false);

    // Podcast upload state
    const [podcastTitle, setPodcastTitle] = useState('');
    const [podcastGenres, setPodcastGenres] = useState([]);
    const [selectedPodcastGenreIds, setSelectedPodcastGenreIds] = useState([]);
    const [isPodcastGenreModalVisible, setPodcastGenreModalVisible] = useState(false);
    const [isPodcastGenreOpen, setIsPodcastGenreOpen] = useState(false);
    const [podcastCover, setPodcastCover] = useState(null);
    const [podcastEpisodes, setPodcastEpisodes] = useState([createPodcastEpisodeDraft()]);
    const [podcastLoading, setPodcastLoading] = useState(false);
    const [publishNotice, setPublishNotice] = useState({
        visible: false,
        title: '',
        message: '',
    });

    const closeAnyModal = () => {
        setAlbumModalVisible(false);
        setTrackGenreModalVisible(false);
        setPodcastGenreModalVisible(false);
    };

    const showPublishNotice = (title, message) => {
        setPublishNotice({
            visible: true,
            title: String(title || '').trim() || 'Success',
            message: String(message || '').trim() || 'Your content has been sent to moderation.',
        });
    };

    const closePublishNotice = () => {
        setPublishNotice((prev) => ({ ...prev, visible: false }));
    };

    useEffect(() => {
        void fetchData();
        void fetchUserId();
        void loadUploadPermission();
    }, []);

    useEffect(() => {
        const unsubscribe = navigation?.addListener?.('focus', () => {
            void loadUploadPermission();
        });

        return unsubscribe;
    }, [navigation]);

    useEffect(() => {
        const requestedMode = resolveCreateMode(route?.params?.initialMode);
        if (requestedMode && requestedMode !== mode) {
            setMode(requestedMode);
        }
    }, [route?.params?.initialMode]);

    useEffect(() => {
        setIsTrackGenreOpen(false);
        setIsPodcastGenreOpen(false);
        setIsAlbumGenreOpen(false);
    }, [mode]);

    const fetchUserId = async () => {
        try {
            const id = await AsyncStorage.getItem('userId');

            if (id) {
                setArtistId(id);
            } else {
                Alert.alert('Warning', 'User ID not found. Re-login and try again.');
            }
        } catch (_) {
            Alert.alert('Error', 'Failed to read user profile.');
        }
    };

    const fetchData = async () => {
        try {
            const [iconsData, albumsData, genresData, podcastGenresData] = await Promise.all([
                getIcons(),
                getAlbums(),
                getGenres(),
                getPodcastGenres(),
            ]);

            setIcons(iconsData || {});
            setAlbums(Array.isArray(albumsData) ? albumsData : []);
            setTrackGenres(Array.isArray(genresData) ? genresData : []);
            setPodcastGenres(Array.isArray(podcastGenresData) ? podcastGenresData : []);
        } catch (_) {
            // keep screen alive even if some create endpoints are unavailable
        }
    };

    const loadUploadPermission = async () => {
        try {
            await refreshUserToken();
        } catch (_) {
            // ignore and continue with stored auth data
        }

        try {
            const storedRole = await AsyncStorage.getItem('userRole');
            const fromStoredRole = isArtistRoleValue(storedRole);

            let fromTokenRole = false;
            const token = await AsyncStorage.getItem('userToken');
            if (token) {
                const tokenRole = extractRoleFromToken(token);
                fromTokenRole = isArtistRoleValue(tokenRole);
            }

            setHasUploadPermission(fromStoredRole || fromTokenRole);
        } catch (_) {
            setHasUploadPermission(false);
        } finally {
            setUploadPermissionReady(true);
        }
    };

    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };

    const toggleTrackGenre = (id) => {
        const value = String(id || '').trim();
        if (!value) return;
        setSelectedTrackGenreIds((prev) =>
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        );
    };

    const togglePodcastGenre = (id) => {
        const value = String(id || '').trim();
        if (!value) return;
        setSelectedPodcastGenreIds((prev) =>
            prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
        );
    };

    const pickTrackAudio = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets?.length) {
                setTrackFile(result.assets[0]);
            }
        } catch (_) {
            Alert.alert('Error', 'Failed to pick audio file.');
        }
    };

    const pickTrackCover = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets?.length) {
                setTrackCover(result.assets[0]);
            }
        } catch (_) {
            Alert.alert('Error', 'Failed to pick track cover.');
        }
    };

    const pickAlbumCover = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets?.length) {
                setAlbumCover(result.assets[0]);
            }
        } catch (_) {
            Alert.alert('Error', 'Failed to pick album cover.');
        }
    };

    const addAlbumTrack = () => {
        setAlbumTracks((prev) => [...prev, createAlbumTrackDraft()]);
    };

    const updateAlbumTrackTitle = (id, title) => {
        setAlbumTracks((prev) =>
            prev.map((item) => (item.id === id ? { ...item, title } : item))
        );
    };

    const pickAlbumTrackAudio = async (id) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const file = result.assets[0];
            setAlbumTracks((prev) =>
                prev.map((item) => (item.id === id ? { ...item, file } : item))
            );
        } catch (_) {
            Alert.alert('Error', 'Failed to pick audio file.');
        }
    };

    const removeAlbumTrack = (id) => {
        setAlbumTracks((prev) => {
            const next = prev.filter((item) => item.id !== id);
            return next.length ? next : [createAlbumTrackDraft()];
        });
    };

    const pickPodcastCover = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets?.length) {
                setPodcastCover(result.assets[0]);
            }
        } catch (_) {
            Alert.alert('Error', 'Failed to pick podcast cover.');
        }
    };

    const pickPodcastEpisodeAudio = async (episodeId) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const file = result.assets[0];
            setPodcastEpisodes((prev) =>
                prev.map((item) => (item.id === episodeId ? { ...item, audio: file } : item))
            );
        } catch (_) {
            Alert.alert('Error', 'Failed to pick episode audio.');
        }
    };

    const updatePodcastEpisodeField = (episodeId, field, value) => {
        setPodcastEpisodes((prev) =>
            prev.map((item) => (item.id === episodeId ? { ...item, [field]: value } : item))
        );
    };

    const handleAddPodcastEpisode = () => {
        setPodcastEpisodes((prev) => [...prev, createPodcastEpisodeDraft()]);
    };

    const removePodcastEpisode = (episodeId) => {
        setPodcastEpisodes((prev) => {
            const next = prev.filter((item) => item.id !== episodeId);
            return next.length ? next : [createPodcastEpisodeDraft()];
        });
    };

    const handleUploadTrack = async () => {
        if (!artistId) {
            Alert.alert('Error', 'Artist profile is not available.');
            return;
        }

        if (!trackTitle.trim() || !trackFile?.uri) {
            Alert.alert('Error', 'Enter track title and select audio.');
            return;
        }

        if (!trackCover?.uri) {
            Alert.alert('Error', 'Select track cover.');
            return;
        }

        if (!selectedTrackGenreIds.length) {
            Alert.alert('Error', 'Select at least one genre.');
            return;
        }

        setTrackLoading(true);
        const albumId = selectedAlbum ? getEntityId(selectedAlbum) : null;

        const result = await uploadTrack(
            trackFile,
            trackTitle.trim(),
            artistId,
            albumId || null,
            trackCover,
            selectedTrackGenreIds,
            trackLyrics.trim(),
            trackProducers,
            trackLyricists
        );

        setTrackLoading(false);

        if (result?.error && !result?.success) {
            Alert.alert('Upload failed', typeof result.error === 'string' ? result.error : 'Failed to upload track');
            return;
        }

        showPublishNotice('Success', 'Your track has been sent to moderation.');
        setTrackTitle('');
        setTrackLyrics('');
        setTrackProducers('');
        setTrackLyricists('');
        setTrackFile(null);
        setTrackCover(null);
        setSelectedAlbum(null);
        setSelectedTrackGenreIds([]);
    };

    const handleCreatePodcast = async () => {
        if (!podcastTitle.trim()) {
            Alert.alert('Error', 'Enter podcast title.');
            return;
        }
        if (!podcastCover?.uri) {
            Alert.alert('Error', 'Select podcast cover.');
            return;
        }
        if (!selectedPodcastGenreIds.length) {
            Alert.alert('Error', 'Select at least one podcast genre.');
            return;
        }
        const episodesForSubmit = (Array.isArray(podcastEpisodes) ? podcastEpisodes : [])
            .map((episode, index) => ({
                title: String(episode?.title || '').trim() || `Episode ${index + 1}`,
                description: String(episode?.description || '').trim(),
                audio: episode?.audio || null,
            }));

        const missingAudio = episodesForSubmit.some((episode) => !episode?.audio?.uri);
        if (missingAudio) {
            Alert.alert('Error', 'Select audio file for every episode.');
            return;
        }

        if (!episodesForSubmit.length) {
            Alert.alert('Error', 'Add at least one episode.');
            return;
        }

        setPodcastLoading(true);

        const result = await createPodcast({
            title: podcastTitle.trim(),
            cover: podcastCover,
            genreIds: selectedPodcastGenreIds,
            episodes: episodesForSubmit,
            submit: true,
        });

        setPodcastLoading(false);

        if (result?.error) {
            Alert.alert('Create failed', typeof result.error === 'string' ? result.error : 'Failed to create podcast');
            return;
        }

        showPublishNotice('Success', 'Your podcast has been sent to moderation.');

        setPodcastTitle('');
        setPodcastCover(null);
        setSelectedPodcastGenreIds([]);
        setPodcastEpisodes([createPodcastEpisodeDraft()]);
    };

    const handleCreateAlbum = async () => {
        console.log('[ALBUM-PUBLISH][UI] submit tapped', {
            title: String(albumTitle || '').trim(),
            hasCover: !!albumCover?.uri,
            selectedGenresCount: Array.isArray(selectedAlbumGenreIds) ? selectedAlbumGenreIds.length : 0,
            tracksDraftCount: Array.isArray(albumTracks) ? albumTracks.length : 0,
        });

        if (!artistId) {
            Alert.alert('Error', 'Artist profile is not available.');
            return;
        }

        const safeTitle = String(albumTitle || '').trim();
        if (!safeTitle) {
            Alert.alert('Error', 'Enter album title.');
            return;
        }

        if (!albumCover?.uri) {
            Alert.alert('Error', 'Select album cover.');
            return;
        }

        if (!selectedAlbumGenreIds.length) {
            Alert.alert('Error', 'Select at least one genre.');
            return;
        }

        const preparedTracks = (Array.isArray(albumTracks) ? albumTracks : [])
            .map((item, index) => ({
                id: item?.id || `idx-${index}`,
                title: String(item?.title || '').trim(),
                file: item?.file || null,
            }));

        const tracksWithAudio = preparedTracks.filter((item) => !!item?.file?.uri);
        if (!tracksWithAudio.length) {
            console.log('[ALBUM-PUBLISH][UI] blocked: no tracks with audio');
            Alert.alert('Error', 'Add at least one track and select audio file.');
            return;
        }

        console.log('[ALBUM-PUBLISH][UI] payload prepared', {
            title: safeTitle,
            coverName: albumCover?.fileName || albumCover?.name || null,
            coverUri: albumCover?.uri || null,
            genreIds: selectedAlbumGenreIds,
            tracksDraftCount: preparedTracks.length,
            tracksWithAudioCount: tracksWithAudio.length,
            tracks: tracksWithAudio.map((item, index) => ({
                index,
                title: item?.title || '',
                audioName: item?.file?.name || item?.file?.fileName || null,
                audioUri: item?.file?.uri || null,
                audioSize: item?.file?.size || null,
                audioType: item?.file?.mimeType || item?.file?.type || null,
            })),
        });

        setAlbumLoading(true);

        try {
            const createResult = await createAlbum(
                safeTitle,
                albumCover,
                selectedAlbumGenreIds,
                tracksWithAudio
            );
            console.log('[ALBUM-PUBLISH][UI] createAlbum result', createResult);
            if (createResult?.error) {
                Alert.alert('Create failed', typeof createResult.error === 'string' ? createResult.error : 'Failed to create album');
                return;
            }

            const createdAlbumId = getEntityId(createResult?.data);
            console.log('[ALBUM-PUBLISH][UI] created album id', createdAlbumId || null);

            showPublishNotice('Success', 'Your album has been sent to moderation.');

            setAlbumTitle('');
            setAlbumCover(null);
            setSelectedAlbumGenreIds([]);
            setAlbumTracks([createAlbumTrackDraft()]);
            void fetchData();
            console.log('[ALBUM-PUBLISH][UI] done');
        } catch (e) {
            console.log('[ALBUM-PUBLISH][UI] fatal error', {
                message: e?.message || null,
                responseStatus: e?.response?.status || null,
                responseData: e?.response?.data || null,
            });
            Alert.alert('Create failed', 'Unexpected error during album publish.');
        } finally {
            setAlbumLoading(false);
        }
    };

    const selectedTrackGenreLabel = (() => {
        if (!selectedTrackGenreIds.length) return 'Select genre';
        const names = selectedTrackGenreIds
            .map((id) => trackGenres.find((genre) => getEntityId(genre) === String(id))?.name)
            .filter(Boolean);
        if (!names.length) return 'Select genre';
        if (names.length === 1) return names[0];
        return `${names[0]} +${names.length - 1}`;
    })();

    const selectedPodcastGenreLabel = (() => {
        if (!selectedPodcastGenreIds.length) return 'Select genre';
        const names = selectedPodcastGenreIds
            .map((id) => podcastGenres.find((genre) => getEntityId(genre) === String(id))?.name)
            .filter(Boolean);
        if (!names.length) return 'Select genre';
        if (names.length === 1) return names[0];
        return `${names[0]} +${names.length - 1}`;
    })();

    const selectedAlbumGenreLabel = (() => {
        if (!selectedAlbumGenreIds.length) return 'Select genre';
        const names = selectedAlbumGenreIds
            .map((id) => trackGenres.find((genre) => getEntityId(genre) === String(id))?.name)
            .filter(Boolean);
        if (!names.length) return 'Select genre';
        if (names.length === 1) return names[0];
        return `${names[0]} +${names.length - 1}`;
    })();

    const handlePostPress = async () => {
        Keyboard.dismiss();

        if (!hasUploadPermission) {
            Alert.alert('Permission required', 'You have no permission to upload tracks.');
            return;
        }

        if (mode === 'track') {
            await handleUploadTrack();
            return;
        }

        if (mode === 'podcast') {
            await handleCreatePodcast();
            return;
        }

        await handleCreateAlbum();
    };

    const showCoverLabel = trackCover?.name || trackCover?.fileName || '';
    const albumCoverLabel = albumCover?.name || albumCover?.fileName || '';

    const NoPermissionContent = (
        <View style={styles.noPermissionContainer}>
            <Text style={styles.noPermissionTitle}>Ready to share your music?</Text>
            <Text style={styles.noPermissionText}>
                To start publishing tracks, you need to become a verified Artist first. Submit your
                application in your profile settings.
            </Text>
        </View>
    );

    const Content = (
        <>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                        <RemoteTintIcon
                            icons={icons}
                            iconName={resolveIconName('arrow-left.svg')}
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback="‹"
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Create</Text>

                    <TouchableOpacity
                        style={[
                            styles.postButton,
                            (trackLoading || podcastLoading || albumLoading) && styles.postButtonDisabled,
                        ]}
                        activeOpacity={0.85}
                        onPress={handlePostPress}
                        disabled={trackLoading || podcastLoading || albumLoading}
                    >
                        {trackLoading || podcastLoading || albumLoading ? (
                            <ActivityIndicator color="#300C0A" size="small" />
                        ) : (
                            <Text style={styles.postButtonText}>Post</Text>
                        )}
                    </TouchableOpacity>
                </View>


                {isTrackGenreOpen || isPodcastGenreOpen || isAlbumGenreOpen ? (
                    <Pressable
                        style={styles.dropdownDismissLayer}
                        onPress={() => {
                            setIsTrackGenreOpen(false);
                            setIsPodcastGenreOpen(false);
                            setIsAlbumGenreOpen(false);
                        }}
                    />
                ) : null}

                <View style={styles.segmentWrap}>
                    <TouchableOpacity
                        style={[styles.segmentBtn, mode === 'track' && styles.segmentBtnActive]}
                        onPress={() => setMode('track')}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.segmentText, mode === 'track' && styles.segmentTextActive]}>Track</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.segmentBtn, mode === 'podcast' && styles.segmentBtnActive]}
                        onPress={() => setMode('podcast')}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.segmentText, mode === 'podcast' && styles.segmentTextActive]}>Podcast</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.segmentBtn, mode === 'album' && styles.segmentBtnActive]}
                        onPress={() => setMode('album')}
                        activeOpacity={0.85}
                    >
                        <Text style={[styles.segmentText, mode === 'album' && styles.segmentTextActive]}>Album</Text>
                    </TouchableOpacity>
                </View>

                {mode === 'track' ? (
                    <>
                        <TouchableOpacity
                            style={styles.uploadCoverBox}
                            activeOpacity={0.9}
                            onPress={pickTrackCover}
                        >
                            {trackCover?.uri ? (
                                <Image
                                    source={{ uri: trackCover.uri }}
                                    style={styles.uploadCoverImage}
                                />
                            ) : null}
                            {!trackCover?.uri ? (
                                <View style={styles.uploadCoverOverlay}>
                                    <View style={styles.uploadPlusCircle}>
                                        <View style={styles.plusGlyph}>
                                            <View style={styles.plusHorizontal} />
                                            <View style={styles.plusVertical} />
                                        </View>
                                    </View>
                                    <Text style={styles.uploadCoverLabel}>
                                        {showCoverLabel ? 'Cover selected' : 'Upload Cover'}
                                    </Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <Text style={styles.fieldLabel}>Title</Text>
                        <TextInput
                            keyboardAppearance="dark"
                            placeholder="Name your track..."
                            value={trackTitle}
                            onChangeText={setTrackTitle}
                            style={styles.inputField}
                            placeholderTextColor="rgba(245,216,203,0.55)"
                        />

                        <Text style={styles.fieldLabel}>Audio File</Text>
                        <TouchableOpacity
                            style={styles.selectorField}
                            onPress={pickTrackAudio}
                            activeOpacity={0.85}
                        >
                            <View style={styles.selectorLeft}>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName('download.svg')}
                                    width={scale(18)}
                                    height={scale(18)}
                                    color="#F5D8CB"
                                    fallback="↓"
                                />
                                <Text style={styles.selectorText}>
                                    {trackFile?.name || trackFile?.fileName || 'Select file'}
                                </Text>
                            </View>
                            <RemoteTintIcon
                                icons={icons}
                                iconName={resolveIconName('arrow-right.svg')}
                                width={scale(18)}
                                height={scale(18)}
                                color="rgba(245,216,203,0.6)"
                                fallback="›"
                            />
                        </TouchableOpacity>

                        <Text style={styles.fieldLabel}>Genre</Text>
                        <View style={[styles.dropdownSection, isTrackGenreOpen && styles.dropdownSectionOpen]}>
                            {isTrackGenreOpen ? (
                                <Pressable pointerEvents="none" style={styles.dropdownBackdrop} />
                            ) : null}
                            <TouchableOpacity
                                style={[styles.selectorField, isTrackGenreOpen && styles.selectorFieldOpen]}
                                onPress={() => {
                                    setIsTrackGenreOpen((prev) => !prev);
                                    setIsPodcastGenreOpen(false);
                                    setIsAlbumGenreOpen(false);
                                }}
                                activeOpacity={0.85}
                            >
                                <View style={styles.selectorInnerRow}>
                                    <Text style={styles.selectorText}>{selectedTrackGenreLabel}</Text>
                                    <RemoteTintIcon
                                        icons={icons}
                                        iconName={resolveIconName(isTrackGenreOpen ? 'arrow-up.svg' : 'arrow-down.svg')}
                                        width={scale(18)}
                                        height={scale(18)}
                                        color="rgba(245,216,203,0.8)"
                                        fallback={isTrackGenreOpen ? '⌃' : '⌄'}
                                    />
                                </View>
                            </TouchableOpacity>

                            {isTrackGenreOpen ? (
                                <View style={styles.dropdownShell}>
                                    <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                                    <ScrollView
                                        style={styles.dropdownList}
                                        contentContainerStyle={styles.dropdownListContent}
                                        showsVerticalScrollIndicator
                                        nestedScrollEnabled
                                    >
                                        {(trackGenres || []).map((item) => {
                                            const id = getEntityId(item);
                                            const selected = selectedTrackGenreIds.includes(id);
                                            return (
                                                <TouchableOpacity
                                                    key={id || item?.name}
                                                    style={styles.dropdownItem}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        if (!id) return;
                                                        setSelectedTrackGenreIds([id]);
                                                        setIsTrackGenreOpen(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextActive]}>
                                                        {item?.name || 'Genre'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            ) : null}
                        </View>

                        <Text style={styles.fieldLabel}>Producers</Text>
                        <TextInput
                            keyboardAppearance="dark"
                            placeholder="Add producers..."
                            value={trackProducers}
                            onChangeText={setTrackProducers}
                            style={styles.inputField}
                            placeholderTextColor="rgba(245,216,203,0.55)"
                            autoCapitalize="none"
                        />

                        <Text style={styles.fieldLabel}>Songwriters</Text>
                        <TextInput
                            keyboardAppearance="dark"
                            placeholder="Add songwriters..."
                            value={trackLyricists}
                            onChangeText={setTrackLyricists}
                            style={styles.inputField}
                            placeholderTextColor="rgba(245,216,203,0.55)"
                            autoCapitalize="none"
                        />

                        <Text style={styles.fieldLabel}>Lyrics</Text>
                        <TextInput
                            keyboardAppearance="dark"
                            placeholder="Type track lyrics here..."
                            value={trackLyrics}
                            onChangeText={setTrackLyrics}
                            style={[styles.inputField, styles.lyricsField]}
                            placeholderTextColor="rgba(245,216,203,0.55)"
                            multiline
                            textAlignVertical="top"
                        />

                        <View style={styles.warningCard}>
                            <Text style={styles.warningText}>
                                ⓘ By clicking Post, you confirm that you own all rights to this content.
                            </Text>
                        </View>
                    </>
                ) : mode === 'podcast' ? (
                    <>
                        <TouchableOpacity
                            style={styles.uploadCoverBox}
                            activeOpacity={0.9}
                            onPress={pickPodcastCover}
                        >
                            {podcastCover?.uri ? (
                                <Image
                                    source={{ uri: podcastCover.uri }}
                                    style={styles.uploadCoverImage}
                                />
                            ) : null}
                            {!podcastCover?.uri ? (
                                <View style={styles.uploadCoverOverlay}>
                                    <View style={styles.uploadPlusCircle}>
                                        <View style={styles.plusGlyph}>
                                            <View style={styles.plusHorizontal} />
                                            <View style={styles.plusVertical} />
                                        </View>
                                    </View>
                                    <Text style={styles.uploadCoverLabel}>
                                        {podcastCover?.name || podcastCover?.fileName ? 'Cover selected' : 'Upload Cover'}
                                    </Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <Text style={styles.fieldLabel}>Title</Text>
                        <TextInput
                            keyboardAppearance="dark"
                            placeholder="Name your podcast..."
                            value={podcastTitle}
                            onChangeText={setPodcastTitle}
                            style={styles.inputField}
                            placeholderTextColor="rgba(245,216,203,0.55)"
                        />

                        <Text style={styles.fieldLabel}>Genre</Text>
                        <View style={[styles.dropdownSection, isPodcastGenreOpen && styles.dropdownSectionOpen]}>
                            {isPodcastGenreOpen ? (
                                <Pressable pointerEvents="none" style={styles.dropdownBackdrop} />
                            ) : null}
                            <TouchableOpacity
                                style={[styles.selectorField, isPodcastGenreOpen && styles.selectorFieldOpen]}
                                onPress={() => {
                                    setIsPodcastGenreOpen((prev) => !prev);
                                    setIsTrackGenreOpen(false);
                                    setIsAlbumGenreOpen(false);
                                }}
                                activeOpacity={0.85}
                            >
                                <View style={styles.selectorInnerRow}>
                                    <Text style={styles.selectorText}>{selectedPodcastGenreLabel}</Text>
                                    <RemoteTintIcon
                                        icons={icons}
                                        iconName={resolveIconName(isPodcastGenreOpen ? 'arrow-up.svg' : 'arrow-down.svg')}
                                        width={scale(18)}
                                        height={scale(18)}
                                        color="rgba(245,216,203,0.8)"
                                        fallback={isPodcastGenreOpen ? '⌃' : '⌄'}
                                    />
                                </View>
                            </TouchableOpacity>

                            {isPodcastGenreOpen ? (
                                <View style={styles.dropdownShell}>
                                    <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                                    <ScrollView
                                        style={styles.dropdownList}
                                        contentContainerStyle={styles.dropdownListContent}
                                        showsVerticalScrollIndicator
                                        nestedScrollEnabled
                                    >
                                        {(podcastGenres || []).map((item) => {
                                            const id = getEntityId(item);
                                            const selected = selectedPodcastGenreIds.includes(id);
                                            return (
                                                <TouchableOpacity
                                                    key={id || item?.name}
                                                    style={styles.dropdownItem}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        if (!id) return;
                                                        setSelectedPodcastGenreIds([id]);
                                                        setIsPodcastGenreOpen(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextActive]}>
                                                        {item?.name || 'Genre'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.episodeDetailsHeader}>
                            <Text style={styles.episodeDetailsTitle}>Episode details</Text>
                            <Text style={styles.episodeDetailsCount}>
                                {podcastEpisodes.length} added
                            </Text>
                        </View>

                        <View style={styles.episodesList}>
                            {podcastEpisodes.map((episode, index) => (
                                <View key={episode.id} style={styles.episodeFormBlock}>
                                    <View style={styles.episodeFormHeader}>
                                        <Text style={styles.episodeFormTitle}>Episode {index + 1}</Text>
                                        {podcastEpisodes.length > 1 ? (
                                            <TouchableOpacity
                                                style={styles.removeEpisodeBtn}
                                                onPress={() => removePodcastEpisode(episode.id)}
                                                activeOpacity={0.85}
                                            >
                                                <Text style={styles.removeEpisodeText}>Remove</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>

                                    <Text style={styles.fieldLabel}>Title</Text>
                                    <TextInput
                                        keyboardAppearance="dark"
                                        placeholder="Name this episode..."
                                        value={episode.title}
                                        onChangeText={(text) => updatePodcastEpisodeField(episode.id, 'title', text)}
                                        style={styles.inputField}
                                        placeholderTextColor="rgba(245,216,203,0.55)"
                                    />

                                    <Text style={styles.fieldLabel}>Audio File</Text>
                                    <TouchableOpacity
                                        style={styles.selectorField}
                                        onPress={() => pickPodcastEpisodeAudio(episode.id)}
                                        disabled={podcastLoading}
                                        activeOpacity={0.85}
                                    >
                                        <View style={styles.selectorLeft}>
                                            <RemoteTintIcon
                                                icons={icons}
                                                iconName={resolveIconName('download.svg')}
                                                width={scale(18)}
                                                height={scale(18)}
                                                color="#F5D8CB"
                                                fallback="↓"
                                            />
                                            <Text style={styles.selectorText}>
                                                {episode.audio?.name || episode.audio?.fileName || 'Select file'}
                                            </Text>
                                        </View>
                                        <RemoteTintIcon
                                            icons={icons}
                                            iconName={resolveIconName('arrow-right.svg')}
                                            width={scale(18)}
                                            height={scale(18)}
                                            color="rgba(245,216,203,0.6)"
                                            fallback="›"
                                        />
                                    </TouchableOpacity>

                                    <Text style={styles.fieldLabel}>Description</Text>
                                    <TextInput
                                        keyboardAppearance="dark"
                                        placeholder="What is this episode about?"
                                        value={episode.description}
                                        onChangeText={(text) => updatePodcastEpisodeField(episode.id, 'description', text)}
                                        style={[styles.inputField, styles.textAreaSmall]}
                                        placeholderTextColor="rgba(245,216,203,0.55)"
                                        multiline
                                        numberOfLines={5}
                                        textAlignVertical="top"
                                    />
                                </View>
                            ))}
                        </View>

                        <View style={styles.addEpisodeWrap}>
                        <TouchableOpacity
                            style={styles.addEpisodeBtn}
                            activeOpacity={0.85}
                            onPress={handleAddPodcastEpisode}
                        >
                            <View style={styles.addEpisodeInner}>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName('libplus.svg')}
                                    width={scale(18)}
                                    height={scale(18)}
                                    color="rgba(245,216,203,0.75)"
                                    fallback="+"
                                />
                                <Text style={styles.addEpisodeLabel}>Add new episode</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                        <View style={styles.warningCard}>
                            <Text style={styles.warningText}>
                                ⓘ By clicking Post, you confirm that you own all rights to this content.
                            </Text>
                        </View>
                    </>
                ) : (
                    <>
                        <TouchableOpacity
                            style={styles.uploadCoverBox}
                            activeOpacity={0.9}
                            onPress={pickAlbumCover}
                        >
                            {albumCover?.uri ? (
                                <Image
                                    source={{ uri: albumCover.uri }}
                                    style={styles.uploadCoverImage}
                                />
                            ) : null}
                            {!albumCover?.uri ? (
                                <View style={styles.uploadCoverOverlay}>
                                    <View style={styles.uploadPlusCircle}>
                                        <View style={styles.plusGlyph}>
                                            <View style={styles.plusHorizontal} />
                                            <View style={styles.plusVertical} />
                                        </View>
                                    </View>
                                    <Text style={styles.uploadCoverLabel}>
                                        {albumCoverLabel ? 'Cover selected' : 'Upload Cover'}
                                    </Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <Text style={styles.fieldLabel}>Title</Text>
                        <TextInput
                            keyboardAppearance="dark"
                            placeholder="Name your album..."
                            value={albumTitle}
                            onChangeText={setAlbumTitle}
                            style={styles.inputField}
                            placeholderTextColor="rgba(245,216,203,0.55)"
                        />

                        <Text style={styles.fieldLabel}>Genre</Text>
                        <View style={[styles.dropdownSection, isAlbumGenreOpen && styles.dropdownSectionOpen]}>
                            {isAlbumGenreOpen ? (
                                <Pressable pointerEvents="none" style={styles.dropdownBackdrop} />
                            ) : null}
                            <TouchableOpacity
                                style={[styles.selectorField, isAlbumGenreOpen && styles.selectorFieldOpen]}
                                onPress={() => {
                                    setIsAlbumGenreOpen((prev) => !prev);
                                    setIsTrackGenreOpen(false);
                                    setIsPodcastGenreOpen(false);
                                }}
                                activeOpacity={0.85}
                            >
                                <View style={styles.selectorInnerRow}>
                                    <Text style={styles.selectorText}>{selectedAlbumGenreLabel}</Text>
                                    <RemoteTintIcon
                                        icons={icons}
                                        iconName={resolveIconName(isAlbumGenreOpen ? 'arrow-up.svg' : 'arrow-down.svg')}
                                        width={scale(18)}
                                        height={scale(18)}
                                        color="rgba(245,216,203,0.8)"
                                        fallback={isAlbumGenreOpen ? '⌃' : '⌄'}
                                    />
                                </View>
                            </TouchableOpacity>

                            {isAlbumGenreOpen ? (
                                <View style={styles.dropdownShell}>
                                    <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
                                    <ScrollView
                                        style={styles.dropdownList}
                                        contentContainerStyle={styles.dropdownListContent}
                                        showsVerticalScrollIndicator
                                        nestedScrollEnabled
                                    >
                                        {(trackGenres || []).map((item) => {
                                            const id = getEntityId(item);
                                            const selected = selectedAlbumGenreIds.includes(id);
                                            return (
                                                <TouchableOpacity
                                                    key={id || item?.name}
                                                    style={styles.dropdownItem}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        if (!id) return;
                                                        setSelectedAlbumGenreIds([id]);
                                                        setIsAlbumGenreOpen(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextActive]}>
                                                        {item?.name || 'Genre'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            ) : null}
                        </View>

                        <View style={styles.albumTracksHeader}>
                            <Text style={styles.albumTracksTitle}>Tracks list</Text>
                            <Text style={styles.albumTracksCount}>
                                {albumTracks.length} track{albumTracks.length === 1 ? '' : 's'} added
                            </Text>
                        </View>

                        <View style={styles.albumTracksList}>
                            {albumTracks.map((item) => (
                                <View key={item.id} style={styles.albumTrackCard}>
                                    <TouchableOpacity
                                        style={styles.albumTrackRemove}
                                        activeOpacity={0.85}
                                        onPress={() => removeAlbumTrack(item.id)}
                                    >
                                        <Text style={styles.albumTrackRemoveText}>×</Text>
                                    </TouchableOpacity>

                                    <Text style={styles.albumTrackFieldLabel}>Title</Text>
                                    <TextInput
                                        keyboardAppearance="dark"
                                        placeholder="Name your track..."
                                        value={item.title}
                                        onChangeText={(text) => updateAlbumTrackTitle(item.id, text)}
                                        style={styles.albumTrackNameInput}
                                        placeholderTextColor="rgba(245,216,203,0.55)"
                                    />
                                    <View style={styles.albumTrackTitleUnderline} />

                                    <Text style={[styles.albumTrackFieldLabel, styles.albumTrackAudioLabel]}>
                                        Audio file
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.albumTrackFileBtn}
                                        activeOpacity={0.85}
                                        onPress={() => pickAlbumTrackAudio(item.id)}
                                    >
                                        <View style={styles.albumTrackFileBtnLeft}>
                                            <RemoteTintIcon
                                                icons={icons}
                                                iconName={resolveIconName('download.svg')}
                                                width={scale(20)}
                                                height={scale(20)}
                                                color="#AC654F"
                                                fallback="↓"
                                            />
                                            <Text style={styles.albumTrackFileText} numberOfLines={1}>
                                                {item.file?.name || item.file?.fileName || 'Select file'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.addTrackBtn}
                            activeOpacity={0.85}
                            onPress={addAlbumTrack}
                        >
                            <View style={styles.addTrackInner}>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName('libplus.svg')}
                                    width={scale(18)}
                                    height={scale(18)}
                                    color="rgba(245,216,203,0.75)"
                                    fallback="+"
                                />
                                <Text style={styles.addTrackText}>Add new track</Text>
                            </View>
                        </TouchableOpacity>

                        <View style={styles.warningCard}>
                            <Text style={styles.warningText}>
                                ⓘ By clicking Post, you confirm that you own all rights to this content.
                            </Text>
                        </View>
                    </>
                )}
        </>
    );

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <ScrollView
                style={styles.mainScroll}
                contentContainerStyle={styles.scrollContainer}
                showsVerticalScrollIndicator={false}
                bounces={false}
                alwaysBounceVertical={false}
                contentInsetAdjustmentBehavior="never"
                automaticallyAdjustContentInsets={false}
                automaticallyAdjustsScrollIndicatorInsets={false}
            >
                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.scrollingGradient}
                >
                    <SafeAreaView style={styles.safeArea}>
                        <View style={styles.scrollContent}>
                            {!uploadPermissionReady ? (
                                <View style={styles.permissionLoader}>
                                    <ActivityIndicator size="large" color="#F5D8CB" />
                                </View>
                            ) : hasUploadPermission ? (
                                Content
                            ) : (
                                NoPermissionContent
                            )}
                        </View>
                    </SafeAreaView>
                </LinearGradient>
            </ScrollView>

            <Modal visible={isAlbumModalVisible} transparent animationType="slide" onRequestClose={closeAnyModal}>
                <TouchableWithoutFeedback onPress={closeAnyModal}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => {}}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select Album</Text>
                                <FlatList
                                    data={albums}
                                    keyExtractor={(item, index) => getEntityId(item) || String(index)}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.listItem}
                                            onPress={() => {
                                                setSelectedAlbum(item);
                                                closeAnyModal();
                                            }}
                                        >
                                            <Text style={styles.listItemText}>{item?.title || 'Album'}</Text>
                                        </TouchableOpacity>
                                    )}
                                />
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => {
                                        closeAnyModal();
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.modalCloseText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            <Modal visible={isTrackGenreModalVisible} transparent animationType="slide" onRequestClose={closeAnyModal}>
                <TouchableWithoutFeedback onPress={closeAnyModal}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => {}}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select track genres</Text>
                                <FlatList
                                    data={trackGenres}
                                    keyExtractor={(item, index) => getEntityId(item) || String(index)}
                                    renderItem={({ item }) => {
                                        const id = getEntityId(item);
                                        const selected = selectedTrackGenreIds.includes(id);
                                        return (
                                            <TouchableOpacity
                                                style={[styles.listItem, selected && styles.listItemActive]}
                                                onPress={() => toggleTrackGenre(id)}
                                            >
                                                <Text style={selected ? styles.listItemTextActive : styles.listItemText}>{item?.name || 'Genre'}</Text>
                                                {selected ? <Text style={styles.listItemTextActive}>✓</Text> : null}
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => {
                                        closeAnyModal();
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.modalCloseText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            <Modal visible={isPodcastGenreModalVisible} transparent animationType="slide" onRequestClose={closeAnyModal}>
                <TouchableWithoutFeedback onPress={closeAnyModal}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={() => {}}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select podcast genres</Text>
                                <FlatList
                                    data={podcastGenres}
                                    keyExtractor={(item, index) => getEntityId(item) || String(index)}
                                    renderItem={({ item }) => {
                                        const id = getEntityId(item);
                                        const selected = selectedPodcastGenreIds.includes(id);
                                        return (
                                            <TouchableOpacity
                                                style={[styles.listItem, selected && styles.listItemActive]}
                                                onPress={() => togglePodcastGenre(id)}
                                            >
                                                <Text style={selected ? styles.listItemTextActive : styles.listItemText}>{item?.name || 'Genre'}</Text>
                                                {selected ? <Text style={styles.listItemTextActive}>✓</Text> : null}
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => {
                                        closeAnyModal();
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.modalCloseText}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            <Modal visible={publishNotice.visible} transparent animationType="fade" onRequestClose={closePublishNotice}>
                <TouchableWithoutFeedback onPress={closePublishNotice}>
                    <View style={styles.publishNoticeOverlay}>
                        <TouchableWithoutFeedback onPress={() => {}}>
                            <View style={styles.publishNoticeCard}>
                                <Text style={styles.publishNoticeTitle}>{publishNotice.title}</Text>
                                <Text style={styles.publishNoticeText}>{publishNotice.message}</Text>

                                <TouchableOpacity
                                    style={styles.publishNoticeBtn}
                                    activeOpacity={0.85}
                                    onPress={closePublishNotice}
                                >
                                    <Text style={styles.publishNoticeBtnText}>OK</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#190707',
    },
    safeArea: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    mainScroll: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
    },
    scrollContent: {
        paddingBottom: scale(170),
    },
    permissionLoader: {
        flex: 1,
        minHeight: SCREEN_HEIGHT * 0.55,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noPermissionContainer: {
        flex: 1,
        minHeight: SCREEN_HEIGHT * 0.72,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(26),
    },
    noPermissionTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(18),
        lineHeight: scale(26),
        marginBottom: scale(22),
        textAlign: 'center',
    },
    noPermissionText: {
        color: 'rgba(245,216,203,0.92)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        lineHeight: scale(22),
        textAlign: 'center',
    },
    scrollingGradient: {
        paddingHorizontal: scale(20),
        paddingTop: Platform.OS === 'ios' ? scale(18) : scale(34),
        paddingBottom: scale(30),
        position: 'relative',
        minHeight: SCREEN_HEIGHT + scale(10),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        minHeight: scale(40),
        marginBottom: scale(18),
    },
    backButton: {
        width: scale(64),
        height: scale(40),
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 2,
    },
    headerTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(24),
        lineHeight: scale(30),
        position: 'absolute',
        left: 0,
        right: 0,
        textAlign: 'center',
    },
    postButton: {
        width: scale(64),
        height: scale(36),
        borderRadius: scale(28),
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    postButtonDisabled: {
        opacity: 0.6,
    },
    postButtonText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
        lineHeight: scale(18),
    },
    segmentWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(6),
        marginBottom: scale(18),
    },
    segmentBtn: {
        minWidth: scale(88),
        height: scale(36),
        borderRadius: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: scale(12),
    },
    segmentBtnActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        borderColor: 'rgba(255, 255, 255, 0.22)',
    },
    segmentText: {
        fontSize: scale(15),
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
    },
    segmentTextActive: {
        fontFamily: 'Poppins-SemiBold',
    },
    uploadCoverBox: {
        width: scale(310),
        height: scale(249),
        alignSelf: 'center',
        borderRadius: scale(28),
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        overflow: 'hidden',
        marginBottom: scale(22),
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    uploadCoverImage: {
        position: 'absolute',
        top: 1,
        left: 1,
        right: 1,
        bottom: 1,
        borderRadius: scale(27),
    },
    uploadCoverOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    uploadPlusCircle: {
        width: scale(70),
        height: scale(70),
        borderRadius: scale(35),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(14),
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    plusGlyph: {
        width: scale(28),
        height: scale(28),
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: scale(0.5) }],
    },
    plusHorizontal: {
        position: 'absolute',
        width: scale(24),
        height: scale(3),
        borderRadius: scale(2),
        backgroundColor: '#F5D8CB',
    },
    plusVertical: {
        position: 'absolute',
        width: scale(3),
        height: scale(24),
        borderRadius: scale(2),
        backgroundColor: '#F5D8CB',
    },
    uploadCoverLabel: {
        color: 'rgba(245,216,203,0.74)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(28 / 2),
        lineHeight: scale(34 / 2),
    },
    fieldLabel: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
        marginBottom: scale(8),
        marginTop: scale(8),
    },
    inputField: {
        minHeight: scale(60),
        borderRadius: scale(16),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: scale(18),
        fontFamily: 'Poppins-Regular',
        fontSize: scale(30 / 2),
        color: '#F5D8CB',
        marginBottom: scale(6),
    },
    selectorField: {
        minHeight: scale(60),
        borderRadius: scale(16),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(6),
        overflow: 'hidden',
    },
    selectorFieldOpen: {
        borderBottomLeftRadius: scale(8),
        borderBottomRightRadius: scale(8),
        zIndex: 6,
        elevation: 6,
    },
    dropdownDismissLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 30,
    },
    dropdownSection: {
        position: 'relative',
        zIndex: 10,
    },
    dropdownSectionOpen: {
        zIndex: 80,
    },
    dropdownBackdrop: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: scale(16),
    },
    dropdownShell: {
        position: 'absolute',
        top: scale(52),
        left: 0,
        right: 0,
        borderRadius: scale(16),
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        overflow: 'hidden',
        zIndex: 2,
        elevation: 2,
        maxHeight: scale(220),
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    dropdownList: {
        maxHeight: scale(220),
    },
    dropdownListContent: {
        paddingVertical: scale(8),
    },
    dropdownItem: {
        minHeight: scale(44),
        paddingHorizontal: scale(16),
        justifyContent: 'center',
    },
    dropdownItemText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(15),
    },
    dropdownItemTextActive: {
        fontFamily: 'Poppins-SemiBold',
    },
    selectorInnerRow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectorLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(10),
        flex: 1,
        paddingRight: scale(8),
    },
    selectorText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(30 / 2),
    },
    episodeDetailsHeader: {
        marginTop: scale(14),
        marginBottom: scale(12),
        paddingTop: scale(10),
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    episodeDetailsTitle: {
        color: '#AC654F',
        fontFamily: 'Poppins-SemiBold',
        fontSize: scale(32 / 2),
    },
    episodeDetailsCount: {
        color: 'rgba(245,216,203,0.6)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    albumTracksHeader: {
        marginTop: scale(14),
        marginBottom: scale(12),
        paddingTop: scale(10),
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.15)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    albumTracksTitle: {
        color: '#AC654F',
        fontFamily: 'Poppins-SemiBold',
        fontSize: scale(16),
    },
    albumTracksCount: {
        color: 'rgba(245,216,203,0.6)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    albumTracksList: {
        gap: scale(12),
    },
    albumTrackCard: {
        minHeight: scale(218),
        borderRadius: scale(22),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: scale(20),
        paddingTop: scale(26),
        paddingBottom: scale(22),
    },
    albumTrackFieldLabel: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        marginBottom: scale(6),
    },
    albumTrackNameInput: {
        minHeight: scale(28),
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    albumTrackTitleUnderline: {
        height: 1,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245,216,203,0.35)',
        marginTop: scale(8),
    },
    albumTrackAudioLabel: {
        marginTop: scale(20),
    },
    albumTrackFileBtn: {
        minHeight: scale(36),
        width: '100%',
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        paddingHorizontal: scale(16),
        justifyContent: 'center',
        marginTop: scale(6),
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    albumTrackFileBtnLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    albumTrackFileText: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
    albumTrackRemove: {
        position: 'absolute',
        top: scale(10),
        right: scale(10),
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    albumTrackRemoveText: {
        color: 'rgba(245,216,203,0.45)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(44 / 2),
        lineHeight: scale(44 / 2),
    },
    addTrackBtn: {
        marginTop: scale(12),
        minHeight: scale(58),
        borderRadius: scale(16),
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.28)',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(2),
    },
    addTrackInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(8),
    },
    addTrackText: {
        color: 'rgba(245,216,203,0.75)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
    },
    lyricsField: {
        height: scale(170),
        paddingTop: scale(16),
    },
    episodesList: {
        marginTop: scale(6),
        marginBottom: scale(12),
    },
    episodeFormBlock: {
        marginBottom: scale(8),
    },
    episodeFormHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(4),
    },
    episodeFormTitle: {
        color: 'rgba(245,216,203,0.7)',
        fontFamily: 'Poppins-Medium',
        fontSize: scale(13),
    },
    removeEpisodeBtn: {
        minHeight: scale(32),
        minWidth: scale(70),
        borderRadius: scale(10),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(48,12,10,0.5)',
        paddingHorizontal: scale(8),
    },
    removeEpisodeText: {
        color: '#F5D8CB',
        fontSize: scale(12),
        fontFamily: 'Poppins-Medium',
    },
    addEpisodeWrap: {
        marginTop: scale(6),
        marginBottom: scale(4),
    },
    addEpisodeBtn: {
        width: '100%',
        minHeight: scale(58),
        borderRadius: scale(16),
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: 'rgba(255,255,255,0.28)',
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addEpisodeInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: scale(8),
    },
    addEpisodeLabel: {
        color: 'rgba(245,216,203,0.75)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
    },
    warningCard: {
        marginTop: scale(18),
        marginBottom: scale(8),
        borderRadius: scale(14),
        backgroundColor: '#9F3B2F',
        paddingHorizontal: scale(14),
        paddingVertical: scale(12),
    },
    warningText: {
        color: '#F5D8CB',
        fontSize: scale(14),
        lineHeight: scale(20),
        fontFamily: 'Poppins-Regular',
    },
    textAreaSmall: {
        minHeight: scale(170),
        paddingTop: scale(12),
        textAlignVertical: 'top',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.56)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    modalContent: {
        width: '100%',
        maxHeight: '70%',
        backgroundColor: '#2A1111',
        borderTopLeftRadius: scale(22),
        borderTopRightRadius: scale(22),
        paddingHorizontal: scale(18),
        paddingTop: scale(16),
        paddingBottom: Platform.OS === 'ios' ? scale(28) : scale(18),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.22)',
    },
    modalTitle: {
        fontSize: scale(20),
        fontFamily: 'Unbounded-Regular',
        marginBottom: scale(8),
        textAlign: 'center',
        color: '#F5D8CB',
    },
    listItem: {
        paddingVertical: scale(12),
        paddingHorizontal: scale(10),
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245,216,203,0.12)',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listItemActive: {
        backgroundColor: 'rgba(180,112,90,0.32)',
        borderRadius: scale(10),
        borderBottomWidth: 0,
        marginBottom: scale(4),
    },
    listItemText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
    },
    listItemTextActive: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-SemiBold',
    },
    modalCloseBtn: {
        marginTop: scale(12),
        minHeight: scale(44),
        borderRadius: scale(26),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
    publishNoticeOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.56)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        paddingBottom: 0,
    },
    publishNoticeCard: {
        width: '100%',
        borderRadius: scale(22),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.25)',
        backgroundColor: 'rgba(48,12,10,0.95)',
        paddingHorizontal: scale(18),
        paddingTop: scale(16),
        paddingBottom: scale(14),
    },
    publishNoticeTitle: {
        color: '#F5D8CB',
        textAlign: 'center',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(18),
        marginBottom: scale(8),
    },
    publishNoticeText: {
        color: 'rgba(245,216,203,0.88)',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        lineHeight: scale(21),
    },
    publishNoticeBtn: {
        marginTop: scale(14),
        minHeight: scale(44),
        borderRadius: scale(22),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    publishNoticeBtnText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});
