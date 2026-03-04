import React, { useEffect, useRef, useState } from 'react';
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
    Platform,
    Modal,
    TouchableWithoutFeedback,
    Animated,
    Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import MiniPlayer from '../components/MiniPlayer';
import { usePlayerStore } from '../store/usePlayerStore';

// Імпорт API
import {
    getAlbumDetails,
    getAlbumTracks,
    getAlbums,
    getTracks,
    likeTrack,
    unlikeTrack,
    getLikedTracks,
    getAlbumCoverUrl,
    uploadAlbumCover,
    getIcons,
    scale,
    resolveArtistName
} from '../api/api';

const { height } = Dimensions.get('window');
const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const svgCache = {};
// 👇 Цей компонент завантажує SVG, чистить, фарбує і КЕШУЄ результат
const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        // 1. Якщо у нас вже є правильна картинка в кеші — беремо її і виходимо
        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }

        // 2. Якщо в кеші немає — вантажимо
        if (uri) {
            fetch(uri)
                .then(response => response.text())
                .then(svgContent => {
                    if (isMounted) {
                        let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');

                        if (color) {
                            cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
                            cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
                        }

                        cleanXml = cleanXml.replace(/###NONE###/g, 'fill="none"');

                        // Зберігаємо в кеш
                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }

        return () => { isMounted = false; };
    }, [cacheKey]); // 🔥 Головне: реагуємо на зміну ключа, а не ігноруємо її

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

export default function AlbumDetailScreen({ route, navigation }) {
    const {
        id: routeId,
        albumId: routeAlbumId,
        Id: routeUpperId,
        AlbumId: routeUpperAlbumId,
        album: routeAlbum
    } = route.params || {};
    const rawAlbumIds = [
        routeId,
        routeAlbumId,
        routeUpperId,
        routeUpperAlbumId,
        routeAlbum?.id,
        routeAlbum?.Id,
        routeAlbum?._id,
        routeAlbum?.albumId,
        routeAlbum?.AlbumId,
    ].filter(Boolean);
    const albumId = rawAlbumIds.find((v) => GUID_REGEX.test(String(v))) || null;

    const [album, setAlbum] = useState(null);
    const [albumTracks, setAlbumTracks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);
    const [iconsMap, setIconsMap] = useState({});
    const [likedTrackIds, setLikedTrackIds] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);

    const slideAnim = useRef(new Animated.Value(height)).current;
    const {
        currentTrack,
        isPlaying,
        setQueue,
        togglePlay,
    } = usePlayerStore();
    const playingTrackId = currentTrack?.id || currentTrack?._id;


    const isAlbumPlaying = albumTracks.some(t => (t.id || t._id) === playingTrackId);

    useEffect(() => {
        loadData();
    }, [albumId]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (!albumId) {
                setAlbum(null);
                setLoading(false);
                return;
            }

            const icons = await getIcons();
            setIconsMap(icons || {});

            const likedIds = await getLikedTracks();
            setLikedTrackIds(Array.isArray(likedIds) ? likedIds : []);

            let effectiveAlbum = await getAlbumDetails(albumId);
            if (!effectiveAlbum) {
                if (routeAlbum && rawAlbumIds.length > 0) {
                    effectiveAlbum = routeAlbum;
                } else {
                    // Fallback для випадку, коли API деталей не знаходить, але альбом є у списку
                    const allAlbums = await getAlbums();
                    effectiveAlbum = Array.isArray(allAlbums)
                        ? allAlbums.find((a) => {
                            const candidateIds = [a.id, a.Id, a._id, a.albumId, a.AlbumId].filter(Boolean);
                            const candidateGuid = candidateIds.find((v) => GUID_REGEX.test(String(v)));
                            return candidateGuid && albumId && candidateGuid.toString() === albumId.toString();
                        })
                        : null;
                }
            }

            if (!effectiveAlbum) {
                setAlbum(null);
                setLoading(false);
                return;
            }

            setAlbum(effectiveAlbum);

            const storedName = await AsyncStorage.getItem('username');
            const artistName = effectiveAlbum.artist?.name || effectiveAlbum.artist;
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

            // Якщо натиснули на поточний трек цього альбому — просто play/pause
            if (playingTrackId === trackId && isAlbumPlaying) {
                await togglePlay();
                return;
            }

            const normalizedQueue = albumTracks.map((t) => {
                const artistLabel = resolveArtistName(
                    t,
                    resolveArtistName(
                        {
                            artist: album?.artist || routeAlbum?.artist,
                            artistName: album?.artistName || routeAlbum?.artistName,
                        },
                        'Unknown Artist'
                    )
                );
                return {
                    ...t,
                    artistName: artistLabel,
                    artist: typeof t.artist === 'object' && t.artist !== null
                        ? { ...t.artist, name: t.artist.name || artistLabel }
                        : { name: artistLabel },
                };
            });

            const trackIndex = normalizedQueue.findIndex((t) => (t.id || t._id) === trackId);
            if (trackIndex === -1) return;

            if (normalizedQueue.length > 0) {
                // Ставимо весь альбом у глобальну чергу, щоб працював MiniPlayer/PlayerScreen
                await setQueue(normalizedQueue, trackIndex);
            }
        } catch (e) {
            console.error("Play error:", e);
        }
    };


    const handleAlbumPlay = async () => {
        if (albumTracks.length === 0) return;

        if (isAlbumPlaying) {
            await togglePlay();
        } else {
            await playTrack(albumTracks[0]);
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

    const handleTrackLikeToggle = async (track) => {
        const trackId = track.id || track._id;
        if (!trackId) return;

        const isLikedNow = likedTrackIds.includes(trackId);
        const prevIds = likedTrackIds;
        const nextIds = isLikedNow
            ? likedTrackIds.filter((id) => id !== trackId)
            : [...likedTrackIds, trackId];

        setLikedTrackIds(nextIds);

        try {
            if (isLikedNow) {
                await unlikeTrack(trackId);
            } else {
                await likeTrack(trackId);
            }
        } catch (e) {
            console.log('Track like toggle error:', e);
            setLikedTrackIds(prevIds);
        }
    };

    const openModal = () => {
        setModalVisible(true);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    };

    const closeModal = () => {
        Animated.timing(slideAnim, {
            toValue: height,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => {
            setModalVisible(false);
        });
    };

    const handleViewArtist = () => {
        closeModal();
        const artistData = album?.artist || {};
        const artistId = artistData.id || artistData._id || album?.ownerId;
        if (!artistId) return;

        navigation.navigate('ArtistProfile', {
            artist: {
                ...artistData,
                id: artistId,
                name: resolveArtistName(
                    { artist: artistData, artistName: album?.artistName || routeAlbum?.artistName },
                    'Unknown Artist'
                ),
            },
        });
    };

    const findIconUrl = (iconName) => {
        if (!iconName) return null;

        const lowerMap = {};
        Object.keys(iconsMap || {}).forEach((k) => {
            lowerMap[k.toLowerCase()] = iconsMap[k];
        });

        const normalized = iconName.toLowerCase();
        const candidates = [
            iconName,
            normalized,
            normalized.endsWith('.png') ? normalized.replace(/\.png$/i, '.svg') : normalized,
            normalized.endsWith('.svg') ? normalized : `${normalized}.svg`,
            normalized.endsWith('.svg') ? normalized.replace(/\.svg$/i, '.png') : normalized,
            normalized.endsWith('.png') ? normalized : `${normalized}.png`,
        ];

        for (const candidate of candidates) {
            if (iconsMap[candidate]) return iconsMap[candidate];
            if (lowerMap[candidate]) return lowerMap[candidate];
        }

        return null;
    };

    // Підтримує старі виклики з fallbackText і нові без нього
    const renderIcon = (iconName, arg2, arg3, arg4) => {
        let style = arg2;
        let tintColor = arg3 ?? '#000000';

        if (typeof arg2 === 'string') {
            style = arg3;
            tintColor = arg4 ?? '#000000';
        }

        const iconUrl = findIconUrl(iconName);
        const flatStyle = StyleSheet.flatten(style) || {};

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;

                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={width}
                        height={height}
                        color={tintColor}
                    />
                );
            }

            // PNG
            const imageStyle = [style];
            if (tintColor) {
                imageStyle.push({ tintColor: tintColor });
            }

            return (
                <Image
                    source={{ uri: iconUrl }}
                    style={imageStyle}
                    resizeMode="contain"
                />
            );
        }

        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    // --- COMPONENTS ---

    const NavBar = () => (
        <View style={styles.navBar}>
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.navBtn}
                hitSlop={{ top: scale(20), bottom: scale(20), left: scale(20), right: scale(20) }}
            >
                {renderIcon('arrow-left.svg', '<', { width: scale(24), height: scale(24) }, '#F5D8CB')}
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity
                style={styles.navBtn}
                hitSlop={{ top: scale(20), bottom: scale(20), left: scale(20), right: scale(20) }}
                onPress={openModal}
            >
                {renderIcon('more.svg', '•••', { width: scale(24), height: scale(24) }, '#F5D8CB')}
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
    const artistName = resolveArtistName(
        {
            artist: album?.artist || routeAlbum?.artist,
            artistName: album?.artistName || routeAlbum?.artistName,
        },
        'Unknown Artist'
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                        bounces={false}
                        overScrollMode="never">

                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.gradient, { paddingBottom: scale(50) }]}
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
                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}>
                                {renderIcon('download.svg', 'Dwn', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}>
                                {renderIcon('add.svg', 'Like', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            {/* PLAY BUTTON */}
                            <TouchableOpacity
                                style={[styles.circleBtn, styles.playBtn]}
                                onPress={handleAlbumPlay}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                            >
                                {renderIcon(
                                    (isAlbumPlaying && isPlaying) ? 'pause.svg' : 'play.svg',
                                    'Play',
                                    { width: scale(21.37), height: scale(21.37) },
                                    '#300C0A'
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}>
                                {renderIcon('share.svg', 'Shr', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.circleBtn} hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}>
                                {renderIcon('shuffle.svg', 'Mix', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* --- TRACKS LIST --- */}
                    <View style={styles.tracksContainer}>
                        {albumTracks.map((item, index) => {
                            const trackId = item.id || item._id;
                            const isTrackActive = playingTrackId === trackId;
                            const isLiked = likedTrackIds.includes(trackId);
                            const trackArtist = resolveArtistName(item, artistName);

                            return (
                                <TouchableOpacity
                                    key={trackId || index}
                                    style={styles.trackRow}
                                    onPress={() => playTrack(item)}
                                >
                                    <View style={styles.trackInfo}>
                                        <Text style={[styles.trackTitle, isTrackActive && styles.activeText]}>
                                            {item.title}
                                        </Text>
                                        <Text style={styles.trackArtist}>{trackArtist}</Text>
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => handleTrackLikeToggle(item)}
                                        hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                    >
                                        {isLiked
                                            ? renderIcon('added.svg', '♥', { width: scale(24), height: scale(24) }, '#F5D8CB')
                                            : renderIcon('add.svg', '♡', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                </LinearGradient>
            </ScrollView>

            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <TouchableWithoutFeedback onPress={closeModal}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    styles.modalSheetWrapper,
                                    { transform: [{ translateY: slideAnim }] }
                                ]}
                            >
                                <LinearGradient
                                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                                    locations={[0, 0.2, 1]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={styles.modalBorderGradient}
                                >
                                    <BlurView intensity={40} tint="dark" style={styles.modalGlassContainer}>
                                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30, 10, 8, 0.85)' }]} />

                                        <View style={styles.modalInnerContent}>
                                            <View style={styles.modalIndicator} />
                                            <Text style={styles.modalTitle}>More</Text>

                                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                                <TouchableOpacity
                                                    style={styles.menuItemCapsule}
                                                    onPress={() => {
                                                        closeModal();
                                                        Alert.alert('Playlist', 'Function coming soon');
                                                    }}
                                                >
                                                    <View style={styles.menuItemIconCircle}>
                                                        {renderIcon('add to another playlist.svg', '', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                                                    </View>
                                                    <Text style={styles.menuItemText}>Add to another playlist</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.menuItemCapsule}
                                                    onPress={() => {
                                                        closeModal();
                                                        Alert.alert('Queue', 'Function coming soon');
                                                    }}
                                                >
                                                    <View style={styles.menuItemIconCircle}>
                                                        {renderIcon('add to queue.svg', '', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                                                    </View>
                                                    <Text style={styles.menuItemText}>Add to queue</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity style={styles.menuItemCapsule} onPress={handleViewArtist}>
                                                    <View style={styles.menuItemIconCircle}>
                                                        {renderIcon('artist.svg', '', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                                                    </View>
                                                    <Text style={styles.menuItemText}>View the artist</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.menuItemCapsule}
                                                    onPress={() => {
                                                        closeModal();
                                                        Alert.alert('Radio', 'Function coming soon');
                                                    }}
                                                >
                                                    <View style={styles.menuItemIconCircle}>
                                                        {renderIcon('radio.svg', '', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                                                    </View>
                                                    <Text style={styles.menuItemText}>Go to radio based on album</Text>
                                                </TouchableOpacity>
                                            </ScrollView>
                                        </View>
                                    </BlurView>
                                </LinearGradient>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            <MiniPlayer bottomOffset={scale(24)} />
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
        marginTop: Platform.OS === 'ios' ? scale(50) : (StatusBar.currentHeight || 0) + scale(10),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        height: scale(50),
        zIndex: 10,
    },
    navBtn: {
        padding: scale(5),
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
        letterSpacing: scale(1),
        marginBottom: scale(20),
        marginTop: scale(10),
    },
    coverImage: {
        width: scale(198),
        height: scale(198),
        borderRadius: scale(24),
        marginBottom: scale(20),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: scale(10) },
        shadowOpacity: 0.5,
        shadowRadius: scale(10),
    },
    placeholderCover: {
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: scale(1),
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
        borderWidth: scale(1),
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
        borderWidth: scale(0),
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
        borderBottomWidth: scale(1),
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-end',
    },
    modalSheetWrapper: {
        width: '100%',
        height: scale(375),
        shadowColor: "#000",
        shadowOffset: { width: 0, height: scale(-10) },
        shadowOpacity: 0.3,
        shadowRadius: scale(20),
        elevation: 15,
    },
    modalBorderGradient: {
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        paddingTop: scale(1.5),
        paddingHorizontal: scale(1.5),
        flex: 1,
    },
    modalGlassContainer: {
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        overflow: 'hidden',
        width: '100%',
        flex: 1,
    },
    modalScroll: {
        width: '100%',
    },
    modalInnerContent: {
        paddingHorizontal: scale(20),
        paddingTop: scale(16),
        alignItems: 'center',
        paddingBottom: scale(40),
    },
    modalIndicator: {
        width: scale(40),
        height: scale(4),
        backgroundColor: 'rgba(245, 216, 203, 0.2)',
        borderRadius: scale(2),
        marginBottom: scale(18),
    },
    modalTitle: {
        color: '#F5D8CB',
        fontSize: scale(22),
        fontFamily: 'Unbounded-SemiBold',
        marginBottom: scale(20),
    },
    menuItemCapsule: {
        flexDirection: 'row',
        alignItems: 'center',
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: scale(1),
        borderColor: '#F5D8CB',
        marginBottom: scale(12),
        paddingRight: scale(16),
    },
    menuItemIconCircle: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: scale(1),
        borderColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: scale(-1),
        marginRight: scale(12),
    },
    menuItemText: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Poppins-Regular',
        fontWeight: '400',
    },
});
