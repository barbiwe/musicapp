import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
    Dimensions,
    StatusBar,
    Platform
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts } from 'expo-font';

// Імпорт API
import {
    getAlbumDetails,
    getAlbumTracks,
    getTracks,
    getAlbumCoverUrl,
    getStreamUrl,
    uploadAlbumCover,
    getIcons,
    scale
} from '../api/api';

const { height } = Dimensions.get('window');

export default function AlbumDetailScreen({ route, navigation }) {
    const { id: routeId, albumId: routeAlbumId } = route.params || {};
    const albumId = routeId || routeAlbumId;

    const [album, setAlbum] = useState(null);
    const [albumTracks, setAlbumTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);
    const [iconsMap, setIconsMap] = useState({});

    const [isPlaying, setIsPlaying] = useState(false);


    const [sound, setSound] = useState(null);
    const [playingTrackId, setPlayingTrackId] = useState(null);


    const isAlbumPlaying = albumTracks.some(t => (t.id || t._id) === playingTrackId);

    useEffect(() => {
        async function configureAudio() {
            try {
                await Audio.setAudioModeAsync({
                    allowsRecordingIOS: false,
                    staysActiveInBackground: false,
                    playsInSilentModeIOS: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                });
            } catch (e) {
                console.log('Error configuring audio:', e);
            }
        }
        configureAudio();
        loadData();

        return () => {
            if (sound) sound.unloadAsync();
        };
    }, [albumId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const icons = await getIcons();
            setIconsMap(icons || {});

            const albumData = await getAlbumDetails(albumId);
            if (!albumData) {
                setAlbum(null);
                setLoading(false);
                return;
            }
            setAlbum(albumData);

            const storedName = await AsyncStorage.getItem('username');
            const artistName = albumData.artist?.name || albumData.artist;
            if (storedName && artistName) {
                const isMyAlbum = storedName.toLowerCase().trim() === artistName.toLowerCase().trim();
                setIsOwner(isMyAlbum);
            }

            let foundTracks = await getAlbumTracks(albumId);
            if (!foundTracks || foundTracks.length === 0) {
                const allTracks = await getTracks();
                foundTracks = allTracks.filter(t => {
                    const tAlbId = t.albumId || t.AlbumId;
                    return tAlbId && tAlbId.toString() === albumId.toString();
                });
            }
            setAlbumTracks(Array.isArray(foundTracks) ? foundTracks : []);

        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const playTrack = async (track) => {
        try {
            const trackId = track.id || track._id;
            if (!trackId) return;

            // А. ЯКЩО НАТИСНУЛИ НА ТОЙ САМИЙ ТРЕК
            if (playingTrackId === trackId) {
                if (sound) {
                    if (isPlaying) {
                        await sound.pauseAsync();
                        setIsPlaying(false);
                    } else {
                        await sound.playAsync();
                        setIsPlaying(true);
                    }
                    return;
                }
            }

            // Б. ЯКЩО НОВИЙ ТРЕК -> ЗУПИНЯЄМО СТАРИЙ
            if (sound) {
                await sound.unloadAsync();
                setPlayingTrackId(null);
                setIsPlaying(false);
            }

            // В. ЗАВАНТАЖУЄМО НОВИЙ
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: getStreamUrl(trackId) },
                { shouldPlay: true }
            );

            setSound(newSound);
            setPlayingTrackId(trackId);
            setIsPlaying(true);

            // Г. ЛОГІКА АВТОПЕРЕМИКАННЯ
            newSound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.didJustFinish) {
                    const currentIndex = albumTracks.findIndex(t => (t.id || t._id) === trackId);
                    const nextTrack = albumTracks[currentIndex + 1];

                    if (nextTrack) {
                        // Рекурсивно запускаємо наступний
                        // Важливо: передаємо nextTrack у нову ітерацію playTrack
                        // Але оскільки playTrack асинхронний і використовує замикання,
                        // тут краще викликати його "з нуля".

                        // Щоб уникнути накладання, можна просто викликати:
                        playTrack(nextTrack);
                    } else {
                        setPlayingTrackId(null);
                        setIsPlaying(false);
                        await newSound.unloadAsync();
                    }
                }
            });

        } catch (e) {
            console.error("Play error:", e);
        }
    };


    const handleAlbumPlay = () => {
        if (albumTracks.length === 0) return;

        if (isAlbumPlaying) {
            // Якщо альбом активний — знаходимо поточний трек і тоглим його (Play/Pause)
            const currentTrack = albumTracks.find(t => (t.id || t._id) === playingTrackId);
            if (currentTrack) {
                playTrack(currentTrack);
            }
        } else {
            // Якщо нічого не грає — стартуємо перший
            playTrack(albumTracks[0]);
        }
    };

    const handleAddCover = async () => {
        if (!isOwner) return;
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setLoading(true);
                const success = await uploadAlbumCover(albumId, result.assets[0]);
                if (success) {
                    Alert.alert('Success', 'Cover updated!');
                    await loadData();
                } else {
                    Alert.alert('Error', 'Failed to upload cover');
                    setLoading(false);
                }
            }
        } catch (e) {
            console.log(e);
            setLoading(false);
        }
    };

    const renderIcon = (iconName, fallbackText, style, tintColor) => {
        if (iconsMap[iconName]) {
            return (
                <Image
                    source={{ uri: iconsMap[iconName] }}
                    style={[style, tintColor ? { tintColor } : {}]}
                    resizeMode="contain"
                />
            );
        }
        return <Text style={{ fontSize: 12, color: tintColor || '#fff' }}>{fallbackText}</Text>;
    };

    // --- COMPONENTS ---

    const NavBar = () => (
        <View style={styles.navBar}>
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.navBtn}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
                {renderIcon('arrow-left.png', '<', { width: 24, height: 24 }, '#F5D8CB')}
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
                style={styles.navBtn}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
                {renderIcon('more.png', '•••', { width: 24, height: 24 }, '#F5D8CB')}
            </TouchableOpacity>
        </View>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    if (!album) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={{ color: '#fff' }}>Album not found</Text>
            </View>
        );
    }

    const coverUri = album.coverFileId ? getAlbumCoverUrl(album.id || album._id) : null;
    const artistName = album.artist?.name || album.artist || 'Unknown Artist';

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                        bounces={false}
                        overScrollMode="never">

                <LinearGradient
                    colors={['#AC654F', '#883426', '#190707',]}
                    locations={[0, 0.2, 0.5,]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.gradient, { paddingBottom: 50 }]}
                >
                    {/* NavBar всередині скролу */}
                    <NavBar />

                    {/* --- HEADER CONTENT --- */}
                    <View style={styles.headerContent}>
                        <Text style={styles.topArtistName}>{artistName}</Text>

                        <TouchableOpacity onPress={handleAddCover} activeOpacity={isOwner ? 0.7 : 1}>
                            {coverUri ? (
                                <Image source={{ uri: coverUri }} style={styles.coverImage} />
                            ) : (
                                <View style={[styles.coverImage, styles.placeholderCover]}>
                                    <Text style={styles.placeholderText}>{isOwner ? '+ Add Cover' : 'No Cover'}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.albumTitle}>{album.title}</Text>

                        {/* CONTROLS */}
                        <View style={styles.controlsRow}>
                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {renderIcon('download.png', 'Dwn', { width: 24, height: 24 }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {renderIcon('hurt.png', 'Like', { width: 35, height: 35 }, '#F5D8CB')}
                            </TouchableOpacity>

                            {/* PLAY BUTTON */}
                            <TouchableOpacity
                                style={[styles.circleBtn, styles.playBtn]}
                                onPress={handleAlbumPlay}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                {renderIcon(
                                    (isAlbumPlaying && isPlaying) ? 'pause.png' : 'play.png',
                                    'Play',
                                    { width: 21.37, height: 21.37 },
                                    '#300C0A'
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {renderIcon('share.png', 'Shr', { width: 24, height: 24 }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {renderIcon('shuffle.png', 'Mix', { width: 24, height: 24 }, '#F5D8CB')}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* --- TRACKS LIST --- */}
                    <View style={styles.tracksContainer}>
                        {albumTracks.map((item, index) => {
                            const trackId = item.id || item._id;
                            const isPlaying = playingTrackId === trackId;
                            const trackArtist = item.artist?.name || item.artist || 'Unknown';

                            return (
                                <TouchableOpacity
                                    key={trackId || index}
                                    style={styles.trackRow}
                                    onPress={() => playTrack(item)}
                                >
                                    <View style={styles.trackInfo}>
                                        <Text style={[styles.trackTitle, isPlaying && styles.activeText]}>
                                            {item.title}
                                        </Text>
                                        <Text style={styles.trackArtist}>{trackArtist}</Text>
                                    </View>

                                    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        {renderIcon('hurt.png', '♡', { width: 30, height: 30 }, '#F5D8CB')}
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                </LinearGradient>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#300C0A',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradient: {
        minHeight: height,
    },

    // NAV BAR
    navBar: {
        marginTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight + 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        height: scale(50),
        zIndex: 10,
    },
    navBtn: {
        padding: 5,
    },

    // HEADER
    headerContent: {
        alignItems: 'center',
        paddingHorizontal: scale(16),
        marginBottom: scale(10),
    },
    topArtistName: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: scale(14),
        fontFamily: 'Unbounded-Regular',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: scale(20),
        marginTop: scale(10),
    },
    coverImage: {
        width: scale(198),
        height: scale(198),
        borderRadius: scale(24),
        marginBottom: scale(20),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    placeholderCover: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#555'
    },
    placeholderText: {
        color: '#aaa',
        fontSize: scale(16)
    },
    albumTitle: {
        color: '#fff',
        fontSize: scale(20),
        fontFamily: 'Unbounded-SemiBold',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: scale(5),
    },

    // CONTROLS
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        paddingHorizontal: scale(15),
        marginTop: scale(10),
    },
    circleBtn: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    playBtn: {
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
        backgroundColor: '#F5D8CB',
        borderColor: '#F5D8CB',
        borderWidth: 0,
    },

    // TRACKS
    tracksContainer: {
        marginTop: scale(20),
    },
    trackRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: scale(14),
        paddingHorizontal: scale(0),
        marginHorizontal: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: '#F5D8CB',
    },
    trackInfo: {
        flex: 1,
        paddingRight: scale(15),
    },
    trackTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-SemiBold',
        marginBottom: scale(2),
    },
    activeText: {
        color: '#F5D8CB',
    },
    trackArtist: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
});