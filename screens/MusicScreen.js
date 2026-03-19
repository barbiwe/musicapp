import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    View,
    Text,
    TextInput,
    StyleSheet,
    Alert,
    ActivityIndicator,
    TouchableOpacity,
    Modal,
    FlatList,
    PanResponder,
    SafeAreaView,
    ScrollView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createPodcast,
    getAlbums,
    getGenres,
    getPodcastGenres,
    submitPodcast,
    uploadTrack,
} from '../api/api';

const getEntityId = (item) => String(item?.id || item?._id || item?.podcastId || '').trim();
const isPendingStatus = (status) => {
    if (status === null || status === undefined) return false;
    const raw = String(status).trim().toLowerCase();
    return raw === 'pending' || raw === '1';
};

export default function MusicScreen({ navigation }) {
    const [mode, setMode] = useState('track');
    const [artistId, setArtistId] = useState(null);

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
    const [trackLoading, setTrackLoading] = useState(false);

    // Podcast upload state (single create flow with N episodes)
    const [podcastTitle, setPodcastTitle] = useState('');
    const [podcastDescription, setPodcastDescription] = useState('');
    const [podcastGenres, setPodcastGenres] = useState([]);
    const [selectedPodcastGenreIds, setSelectedPodcastGenreIds] = useState([]);
    const [isPodcastGenreModalVisible, setPodcastGenreModalVisible] = useState(false);
    const [podcastCover, setPodcastCover] = useState(null);
    const [podcastAudio, setPodcastAudio] = useState(null); // main audio = episode 1
    const [episodeDraftTitle, setEpisodeDraftTitle] = useState('');
    const [episodeDraftDescription, setEpisodeDraftDescription] = useState('');
    const [podcastEpisodes, setPodcastEpisodes] = useState([]); // additional episodes (episode 2+)
    const [podcastLoading, setPodcastLoading] = useState(false);
    const modalDragY = useRef(new Animated.Value(0)).current;

    const closeAnyModal = () => {
        modalDragY.setValue(0);
        setAlbumModalVisible(false);
        setTrackGenreModalVisible(false);
        setPodcastGenreModalVisible(false);
    };

    const resetModalDrag = () => {
        Animated.spring(modalDragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 12,
        }).start();
    };

    const modalPanResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_evt, gesture) =>
                gesture.dy > 14 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
            onPanResponderMove: (_evt, gesture) => {
                modalDragY.setValue(Math.max(0, gesture.dy));
            },
            onPanResponderRelease: (_evt, gesture) => {
                if (gesture.dy > 120 || gesture.vy > 1.1) {
                    closeAnyModal();
                } else {
                    resetModalDrag();
                }
            },
            onPanResponderTerminate: () => {
                resetModalDrag();
            },
        })
    ).current;

    useEffect(() => {
        void fetchData();
        void fetchUserId();
    }, []);

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
        const [albumsData, genresData, podcastGenresData] = await Promise.all([
            getAlbums(),
            getGenres(),
            getPodcastGenres(),
        ]);

        setAlbums(Array.isArray(albumsData) ? albumsData : []);
        setTrackGenres(Array.isArray(genresData) ? genresData : []);
        setPodcastGenres(Array.isArray(podcastGenresData) ? podcastGenresData : []);
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

    const pickPodcastAudio = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets?.length) {
                setPodcastAudio(result.assets[0]);
            }
        } catch (_) {
            Alert.alert('Error', 'Failed to pick podcast audio.');
        }
    };

    const addEpisodeFromPicker = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'audio/*',
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets?.length) return;

            const audio = result.assets[0];
            const nextEpisodeNumber = podcastEpisodes.length + 2; // Episode 1 = main audio
            const title = String(episodeDraftTitle || '').trim() || `Episode ${nextEpisodeNumber}`;
            const description = String(episodeDraftDescription || '').trim();
            const itemId = `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            setPodcastEpisodes((prev) => [...prev, { id: itemId, audio, title, description }]);
            setEpisodeDraftTitle('');
            setEpisodeDraftDescription('');
        } catch (_) {
            Alert.alert('Error', 'Failed to add episode audio.');
        }
    };

    const removeEpisode = (id) => {
        setPodcastEpisodes((prev) => prev.filter((item) => item.id !== id));
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

        if (result?.error) {
            Alert.alert('Upload failed', typeof result.error === 'string' ? result.error : 'Failed to upload track');
            return;
        }

        Alert.alert('Success', 'Track uploaded successfully');
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
        if (!podcastAudio?.uri) {
            Alert.alert('Error', 'Select podcast audio.');
            return;
        }
        if (!selectedPodcastGenreIds.length) {
            Alert.alert('Error', 'Select at least one podcast genre.');
            return;
        }

        setPodcastLoading(true);

        const result = await createPodcast({
            title: podcastTitle.trim(),
            cover: podcastCover,
            audio: podcastAudio,
            genreIds: selectedPodcastGenreIds,
            episodes: podcastEpisodes,
            submit: true,
        });

        setPodcastLoading(false);

        if (result?.error) {
            Alert.alert('Create failed', typeof result.error === 'string' ? result.error : 'Failed to create podcast');
            return;
        }

        const createdPodcast = result?.data || {};
        const createdId = getEntityId(createdPodcast);
        const createdStatus = createdPodcast?.status;

        if (createdId && !isPendingStatus(createdStatus)) {
            const submitResult = await submitPodcast(createdId);
            if (submitResult?.error) {
                const msg = String(submitResult.error || '');
                const likelyAlreadyPending =
                    msg.toLowerCase().includes('pending') ||
                    msg.toLowerCase().includes('already') ||
                    msg.toLowerCase().includes('not draft');

                if (!likelyAlreadyPending) {
                    Alert.alert('Submit failed', typeof submitResult.error === 'string'
                        ? submitResult.error
                        : 'Podcast created, but submit failed');
                    return;
                }
            }
        }

        Alert.alert(
            'Success',
            `Podcast created and submitted (${podcastEpisodes.length + 1} episode${podcastEpisodes.length ? 's' : ''})`
        );

        setPodcastTitle('');
        setPodcastDescription('');
        setPodcastCover(null);
        setPodcastAudio(null);
        setSelectedPodcastGenreIds([]);
        setEpisodeDraftTitle('');
        setEpisodeDraftDescription('');
        setPodcastEpisodes([]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.header}>Upload content</Text>

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
                </View>

                {mode === 'track' ? (
                    <>
                        <Text style={styles.sectionTitle}>Upload track</Text>
                        <TextInput
                            placeholder="Track title"
                            value={trackTitle}
                            onChangeText={setTrackTitle}
                            style={styles.input}
                            placeholderTextColor="#999"
                        />

                        <TextInput
                            placeholder="Lyrics (optional)"
                            value={trackLyrics}
                            onChangeText={setTrackLyrics}
                            style={[styles.input, styles.textArea]}
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={4}
                        />

                        <TextInput
                            placeholder="Producers (optional, comma separated)"
                            value={trackProducers}
                            onChangeText={setTrackProducers}
                            style={styles.input}
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                        />

                        <TextInput
                            placeholder="Lyricists (optional, comma separated)"
                            value={trackLyricists}
                            onChangeText={setTrackLyricists}
                            style={styles.input}
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                        />

                        <TouchableOpacity style={styles.selector} onPress={() => setAlbumModalVisible(true)} activeOpacity={0.85}>
                            <Text style={styles.selectorText}>
                                {selectedAlbum ? `Album: ${selectedAlbum.title || 'Selected'}` : 'Select album (optional)'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setTrackGenreModalVisible(true)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.selectorText}>
                                {selectedTrackGenreIds.length > 0
                                    ? `Genres selected: ${selectedTrackGenreIds.length}`
                                    : 'Select genres (required)'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.row}>
                            <TouchableOpacity style={styles.secondaryButton} onPress={pickTrackAudio} activeOpacity={0.85}>
                                <Text style={styles.secondaryButtonText}>
                                    {trackFile ? `Audio: ${trackFile.name || 'Selected'}` : 'Select audio'}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.secondaryButton} onPress={pickTrackCover} activeOpacity={0.85}>
                                <Text style={styles.secondaryButtonText}>
                                    {trackCover ? 'Cover selected' : 'Select cover'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, trackLoading && styles.primaryButtonDisabled]}
                            disabled={trackLoading}
                            onPress={handleUploadTrack}
                            activeOpacity={0.85}
                        >
                            {trackLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>Upload track</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.sectionTitle}>Publish podcast</Text>
                        <TextInput
                            placeholder="Podcast title"
                            value={podcastTitle}
                            onChangeText={setPodcastTitle}
                            style={styles.input}
                            placeholderTextColor="#999"
                        />

                        <TextInput
                            placeholder="Podcast description"
                            value={podcastDescription}
                            onChangeText={setPodcastDescription}
                            style={[styles.input, styles.textArea]}
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={4}
                        />

                        <TouchableOpacity
                            style={styles.selector}
                            onPress={() => setPodcastGenreModalVisible(true)}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.selectorText}>
                                {selectedPodcastGenreIds.length > 0
                                    ? `Genres selected: ${selectedPodcastGenreIds.length}`
                                    : 'Select podcast genres'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.row}>
                            <TouchableOpacity style={styles.secondaryButton} onPress={pickPodcastCover} activeOpacity={0.85}>
                                <Text style={styles.secondaryButtonText}>
                                    {podcastCover ? 'Cover selected' : 'Select cover'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.secondaryButton} onPress={pickPodcastAudio} activeOpacity={0.85}>
                                <Text style={styles.secondaryButtonText}>
                                    {podcastAudio ? `Audio: ${podcastAudio.name || 'Selected'}` : 'Select main audio'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.episodesHint}>Main audio will be saved as Episode 1.</Text>

                        <View style={styles.divider} />

                        <Text style={styles.sectionSubTitle}>Additional episodes</Text>
                        <TextInput
                            placeholder={`Episode title (default: Episode ${podcastEpisodes.length + 2})`}
                            value={episodeDraftTitle}
                            onChangeText={setEpisodeDraftTitle}
                            style={styles.input}
                            placeholderTextColor="#999"
                        />
                        <TextInput
                            placeholder="Episode description (optional)"
                            value={episodeDraftDescription}
                            onChangeText={setEpisodeDraftDescription}
                            style={[styles.input, styles.textAreaSmall]}
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={3}
                        />

                        <TouchableOpacity
                            style={[styles.primaryButtonWide, podcastLoading && styles.primaryButtonDisabled]}
                            onPress={addEpisodeFromPicker}
                            disabled={podcastLoading}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.primaryButtonText}>Add episode audio</Text>
                        </TouchableOpacity>

                        {!!podcastEpisodes.length && (
                            <View style={styles.episodesList}>
                                {podcastEpisodes.map((episode, index) => (
                                    <View key={episode.id} style={styles.episodeCard}>
                                        <View style={styles.episodeMeta}>
                                            <Text style={styles.episodeTitle}>
                                                {episode.title || `Episode ${index + 2}`}
                                            </Text>
                                            <Text style={styles.episodeFile} numberOfLines={1}>
                                                {episode.audio?.name || episode.audio?.fileName || 'Audio selected'}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.removeEpisodeBtn}
                                            onPress={() => removeEpisode(episode.id)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.removeEpisodeText}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.primaryButton, podcastLoading && styles.primaryButtonDisabled]}
                            disabled={podcastLoading}
                            onPress={handleCreatePodcast}
                            activeOpacity={0.85}
                        >
                            {podcastLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.primaryButtonText}>
                                    Create and submit podcast ({podcastEpisodes.length + 1} ep)
                                </Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('CreateAlbum')} activeOpacity={0.85}>
                        <Text style={styles.footerButtonText}>Create album</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('MainTabs')} activeOpacity={0.85}>
                        <Text style={styles.footerButtonText}>Back to main</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <Modal visible={isAlbumModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <Animated.View
                        {...modalPanResponder.panHandlers}
                        style={[styles.modalContent, { transform: [{ translateY: modalDragY }] }]}
                    >
                        <Text style={styles.modalTitle}>Select Album</Text>
                        <FlatList
                            data={albums}
                            keyExtractor={(item, index) => getEntityId(item) || String(index)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.listItem}
                                    onPress={() => {
                                        setSelectedAlbum(item);
                                        modalDragY.setValue(0);
                                        setAlbumModalVisible(false);
                                    }}
                                >
                                    <Text>{item?.title || 'Album'}</Text>
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => {
                                modalDragY.setValue(0);
                                setAlbumModalVisible(false);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.modalCloseText}>Close</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            <Modal visible={isTrackGenreModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <Animated.View
                        {...modalPanResponder.panHandlers}
                        style={[styles.modalContent, { transform: [{ translateY: modalDragY }] }]}
                    >
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
                                        <Text style={selected ? styles.listItemTextActive : undefined}>{item?.name || 'Genre'}</Text>
                                        {selected ? <Text style={styles.listItemTextActive}>✓</Text> : null}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => {
                                modalDragY.setValue(0);
                                setTrackGenreModalVisible(false);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.modalCloseText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>

            <Modal visible={isPodcastGenreModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <Animated.View
                        {...modalPanResponder.panHandlers}
                        style={[styles.modalContent, { transform: [{ translateY: modalDragY }] }]}
                    >
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
                                        <Text style={selected ? styles.listItemTextActive : undefined}>{item?.name || 'Genre'}</Text>
                                        {selected ? <Text style={styles.listItemTextActive}>✓</Text> : null}
                                    </TouchableOpacity>
                                );
                            }}
                        />
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => {
                                modalDragY.setValue(0);
                                setPodcastGenreModalVisible(false);
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.modalCloseText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 50,
    },
    header: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 14,
        textAlign: 'center',
        color: '#111',
    },
    segmentWrap: {
        flexDirection: 'row',
        backgroundColor: '#f3f3f3',
        borderRadius: 12,
        padding: 4,
        marginBottom: 16,
    },
    segmentBtn: {
        flex: 1,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentBtnActive: {
        backgroundColor: '#111',
    },
    segmentText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '600',
    },
    segmentTextActive: {
        color: '#fff',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
        color: '#111',
    },
    sectionSubTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
        color: '#111',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 12,
        marginBottom: 12,
        borderRadius: 8,
        fontSize: 16,
        backgroundColor: '#fafafa',
        color: '#111',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    textAreaSmall: {
        minHeight: 78,
        textAlignVertical: 'top',
    },
    selector: {
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 12,
        borderRadius: 8,
        backgroundColor: '#f5f5f5',
    },
    selectorText: {
        fontSize: 15,
        color: '#333',
    },
    episodesHint: {
        marginTop: -4,
        marginBottom: 10,
        color: '#555',
        fontSize: 12,
        fontWeight: '600',
    },
    episodesList: {
        marginTop: 10,
        marginBottom: 10,
    },
    episodeCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#dfdfdf',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        backgroundColor: '#f9f9f9',
        marginBottom: 8,
    },
    episodeMeta: {
        flex: 1,
        paddingRight: 10,
    },
    episodeTitle: {
        color: '#222',
        fontSize: 14,
        fontWeight: '700',
    },
    episodeFile: {
        color: '#666',
        fontSize: 12,
        marginTop: 2,
    },
    removeEpisodeBtn: {
        minHeight: 30,
        minWidth: 66,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#d6d6d6',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
    },
    removeEpisodeText: {
        color: '#333',
        fontSize: 12,
        fontWeight: '600',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    secondaryButton: {
        width: '48.5%',
        minHeight: 44,
        borderRadius: 8,
        backgroundColor: '#efefef',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: '#dedede',
    },
    secondaryButtonText: {
        color: '#222',
        fontWeight: '600',
        textAlign: 'center',
        fontSize: 13,
    },
    primaryButton: {
        minHeight: 46,
        borderRadius: 10,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    primaryButtonWide: {
        width: '100%',
        minHeight: 44,
        borderRadius: 10,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    primaryButtonDisabled: {
        opacity: 0.6,
    },
    divider: {
        height: 1,
        backgroundColor: '#e7e7e7',
        marginVertical: 14,
    },
    footer: {
        marginTop: 24,
    },
    footerButton: {
        minHeight: 44,
        borderRadius: 10,
        backgroundColor: '#f2f2f2',
        borderWidth: 1,
        borderColor: '#e0e0e0',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    footerButtonText: {
        color: '#111',
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '86%',
        maxHeight: '70%',
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        elevation: 6,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    listItem: {
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listItemActive: {
        backgroundColor: '#111',
        borderRadius: 8,
        borderBottomWidth: 0,
        marginBottom: 4,
    },
    listItemTextActive: {
        color: '#fff',
        fontWeight: '700',
    },
    modalCloseBtn: {
        marginTop: 12,
        minHeight: 42,
        borderRadius: 8,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseText: {
        color: '#fff',
        fontWeight: '700',
    },
});
