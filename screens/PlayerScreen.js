import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Animated,
    Easing,
    Dimensions,
    Alert,
    Modal,
    ScrollView,
    TouchableWithoutFeedback,
    Image // 👈 Для картинок
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getStreamUrl,
    likeTrack,
    unlikeTrack,
    getLikedTracks,
    getIcons
} from '../api/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlayerScreen({ navigation, route }) {
    // Get track and playlist
    const { track: initialTrack, playlist = [] } = route.params || {};

    // --- STATE ---
    const [currentTrack, setCurrentTrack] = useState(initialTrack || {});
    const [isLiked, setIsLiked] = useState(false);

    // 👇 Стейт для іконок
    const [icons, setIcons] = useState({});

    // --- MODAL STATES ---
    const [modalVisible, setModalVisible] = useState(false);
    const [queueVisible, setQueueVisible] = useState(false);

    // --- AUDIO STATE ---
    const [sound, setSound] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [position, setPosition] = useState(0);

    // --- SEEKING STATE ---
    const isSeeking = useRef(false);
    const [progressBarWidth, setProgressBarWidth] = useState(0);

    // --- MARQUEE STATE ---
    const [textWidth, setTextWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const animatedValue = useRef(new Animated.Value(0)).current;

    const trackTitle = currentTrack?.title || 'No Title';
    const trackArtist = currentTrack?.artist || 'Unknown Artist';

    // 0. ЗАВАНТАЖЕННЯ ІКОНОК
    useEffect(() => {
        loadIconsData();
    }, []);

    const loadIconsData = async () => {
        const iconsMap = await getIcons();
        setIcons(iconsMap);
    };

    // 0.1 CHECK LIKE STATUS
    useEffect(() => {
        checkLikeStatus();
    }, [currentTrack]);

    const checkLikeStatus = async () => {
        if (!currentTrack) return;
        const trackId = currentTrack.id || currentTrack._id;
        if (!trackId) return;

        try {
            const likedTrackIds = await getLikedTracks();
            if (Array.isArray(likedTrackIds)) {
                const isTrackLiked = likedTrackIds.includes(trackId);
                setIsLiked(isTrackLiked);
            } else {
                setIsLiked(false);
            }
        } catch (error) {
            console.log("Error checking like status:", error);
        }
    };

    // 1. LOAD AUDIO
    useEffect(() => {
        loadAudio();
        return () => {
            if (sound) sound.unloadAsync();
        };
    }, [currentTrack]);

    const loadAudio = async () => {
        if (!currentTrack) return;
        const trackId = currentTrack.id || currentTrack._id;
        if (!trackId) return;

        try {
            if (sound) await sound.unloadAsync();

            const uri = getStreamUrl(trackId);
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: uri },
                { shouldPlay: true }
            );

            setSound(newSound);
            setIsPlaying(true);

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded) {
                    setDuration(status.durationMillis || 0);
                    if (!isSeeking.current) {
                        setPosition(status.positionMillis || 0);
                    }
                    setIsPlaying(status.isPlaying);

                    if (status.didJustFinish) {
                        handleNext();
                    }
                }
            });
        } catch (e) {
            console.error("Audio Load Error:", e);
            Alert.alert("Error", "Could not play this track");
        }
    };

    // 2. PLAY / PAUSE
    const handlePlayPause = async () => {
        if (!sound) return;
        if (isPlaying) {
            await sound.pauseAsync();
        } else {
            await sound.playAsync();
        }
    };

    // 3. NEXT / PREV
    const handleNext = () => {
        if (!playlist.length) return;
        const currentIndex = playlist.findIndex(t => (t.id || t._id) === (currentTrack.id || currentTrack._id));
        if (currentIndex < playlist.length - 1) {
            setCurrentTrack(playlist[currentIndex + 1]);
        } else {
            setIsPlaying(false);
        }
    };

    const handlePrev = () => {
        if (!playlist.length) return;
        const currentIndex = playlist.findIndex(t => (t.id || t._id) === (currentTrack.id || currentTrack._id));
        if (currentIndex > 0) {
            setCurrentTrack(playlist[currentIndex - 1]);
        }
    };

    const playFromQueue = (track) => {
        setCurrentTrack(track);
    };

    // 4. SEEKING
    const calculateSeekPosition = (e) => {
        if (progressBarWidth === 0) return 0;
        const touchX = e.nativeEvent.locationX;
        let percent = touchX / progressBarWidth;
        percent = Math.max(0, Math.min(1, percent));
        return percent * duration;
    };

    const handleGrant = (e) => {
        isSeeking.current = true;
        const seekPos = calculateSeekPosition(e);
        setPosition(seekPos);
    };

    const handleMove = (e) => {
        const seekPos = calculateSeekPosition(e);
        setPosition(seekPos);
    };

    const handleRelease = async (e) => {
        if (!sound) return;
        const seekPos = calculateSeekPosition(e);
        setPosition(seekPos);
        await sound.setPositionAsync(seekPos);
        isSeeking.current = false;
    };

    // 5. LIKE / UNLIKE HANDLER
    const handleLikeToggle = async () => {
        const trackId = currentTrack.id || currentTrack._id;
        if (!trackId) return;

        try {
            if (isLiked) {
                await unlikeTrack(trackId);
                setIsLiked(false);
            } else {
                await likeTrack(trackId);
                setIsLiked(true);
            }
        } catch (error) {
            console.error("Like toggle error:", error);
        }
    };

    const formatTime = (millis) => {
        if (!millis) return '00:00';
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const progressPercent = duration > 0 ? (position / duration) * 100 : 0;

    // --- MARQUEE ---
    useEffect(() => {
        if (textWidth > containerWidth && containerWidth > 0) {
            const startAnimation = () => {
                animatedValue.setValue(containerWidth);
                Animated.timing(animatedValue, {
                    toValue: -textWidth,
                    duration: textWidth * 50,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }).start(({ finished }) => {
                    if (finished) startAnimation();
                });
            };
            startAnimation();
        } else {
            animatedValue.stopAnimation();
            animatedValue.setValue(0);
        }
    }, [textWidth, containerWidth, trackTitle]);

    const renderIcon = (iconName, fallbackText, style, tintColor = '#000000') => {
        if (icons[iconName]) {
            return (
                <Image
                    source={{ uri: icons[iconName] }}
                    style={[style, { tintColor: tintColor }]}
                    resizeMode="contain"
                />
            );
        }
        return <Text style={[styles.headerText, { fontSize: 14, color: tintColor }]}>{fallbackText}</Text>;
    };

    // --- HELPER COMPONENTS ---
    const TopAction = ({ label }) => (
        <TouchableOpacity style={styles.topActionContainer}>
            <View style={styles.topActionCircle} />
            <Text style={styles.topActionText}>{label}</Text>
        </TouchableOpacity>
    );

    const MenuItem = ({ label }) => (
        <TouchableOpacity style={styles.menuItemCapsule}>
            <View style={styles.menuItemIconCircle} />
            <Text style={styles.menuItemText}>{label}</Text>
        </TouchableOpacity>
    );

    // --- QUEUE ITEM ---
    const QueueItem = ({ item }) => {
        const isCurrent = (item.id || item._id) === (currentTrack.id || currentTrack._id);

        return (
            <TouchableOpacity
                style={styles.queueRow}
                onPress={() => playFromQueue(item)}
            >
                <View style={styles.queueLeft}>
                    <View style={styles.queueCoverCircle} />
                </View>
                <View style={styles.queueCenter}>
                    <Text
                        style={[
                            styles.queueTitle,
                            isCurrent && styles.queueTitleActive
                        ]}
                        numberOfLines={1}
                    >
                        {item.title}
                    </Text>
                    <Text style={styles.queueArtist} numberOfLines={1}>
                        {item.artist}
                    </Text>
                </View>
                <View style={styles.queueRight}>
                    {isCurrent && (
                        <TouchableOpacity style={styles.queueTextBtnContainer}>
                            <Text style={styles.queueTextBtn}>
                                {isPlaying ? 'Pause' : 'Play'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.queueTextBtnContainer}>
                        <Text style={styles.queueTextBtnLike}>Like</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>

            {/* HEADER */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    {/* Кнопка Back */}
                    {renderIcon('previous.png', 'Back', { width: 24, height: 24 }, '#000000')}
                </TouchableOpacity>

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    style={{ marginRight: 20 }}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={handleLikeToggle}
                >
                    {/* Кнопка Like: added.png (заповнене) або add to another playlist.png (пусте) */}
                    {isLiked
                        ? renderIcon('added.png', 'Lik', { width: 24, height: 24 }, '#000000')
                        : renderIcon('add to another playlist.png', 'Lik', { width: 24, height: 24 }, '#000000')
                    }
                </TouchableOpacity>
                <TouchableOpacity
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    onPress={() => setModalVisible(true)}
                >
                    {/* Меню */}
                    {renderIcon('more.png', '•••', { width: 24, height: 24 }, '#000000')}
                </TouchableOpacity>
            </View>

            {/* ALBUM COVER */}
            <View style={styles.albumCoverPlaceholder} />

            {/* TITLE & ARTIST */}
            <View style={styles.textBlock}>
                <View
                    style={styles.titleContainer}
                    onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
                >
                    <Animated.Text
                        style={[
                            styles.title,
                            {
                                transform: [{ translateX: animatedValue }],
                                textAlign: (textWidth > containerWidth) ? 'left' : 'center',
                                width: (textWidth > containerWidth) ? textWidth + 50 : '100%',
                                position: (textWidth > containerWidth) ? 'absolute' : 'relative',
                            }
                        ]}
                        numberOfLines={1}
                        onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                    >
                        {trackTitle}
                    </Animated.Text>
                </View>
                <Text style={styles.artist}>{trackArtist}</Text>
            </View>

            {/* PROGRESS BAR */}
            <View style={styles.progressBarWrapper}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <View
                    style={styles.progressTouchArea}
                    onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={handleGrant}
                    onResponderMove={handleMove}
                    onResponderRelease={handleRelease}
                >
                    <View style={styles.progressLineBg}>
                        <View
                            style={[styles.progressLineFill, { width: `${progressPercent}%` }]}
                            pointerEvents="none"
                        />
                    </View>
                    <View
                        style={[styles.progressKnobContainer, { left: `${progressPercent}%` }]}
                        pointerEvents="none"
                    >
                        <View style={styles.progressKnobVisual} />
                    </View>
                </View>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            {/* CONTROLS */}
            <View style={styles.controlsSection}>
                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    {/* Mix / Shuffle */}
                    {renderIcon('shuffle.png', 'Mix', { width: 24, height: 24 }, '#000000')}
                </TouchableOpacity>

                <View style={styles.mainControlsWrapper}>
                    <View style={styles.controlsCapsule}>
                        <TouchableOpacity onPress={handlePrev} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                            {/* Prev Track */}
                            {renderIcon('previous.png', 'Prev', { width: 28, height: 28 }, '#000000')}
                        </TouchableOpacity>
                        <View style={{ width: 60 }} />
                        <TouchableOpacity onPress={handleNext} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                            {/* Next Track */}
                            {renderIcon('next.png', 'Next', { width: 28, height: 28 }, '#000000')}
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                        style={styles.playCircle}
                        activeOpacity={0.8}
                        onPress={handlePlayPause}
                    >
                        {/* Play/Pause: Тут передаємо #FFFFFF (БІЛИЙ), бо фон чорний */}
                        {isPlaying
                            ? renderIcon('pause.png', '||', { width: 32, height: 32 }, '#FFFFFF')
                            : renderIcon('play next.png', '>', { width: 32, height: 32 }, '#FFFFFF')
                        }
                    </TouchableOpacity>
                </View>

                <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    {/* Repeat: Використовуємо 'previous-1.png' */}
                    {renderIcon('previous-1.png', 'Rep', { width: 24, height: 24 }, '#000000')}
                </TouchableOpacity>
            </View>

            {/* FOOTER */}
            <View style={styles.footer}>
                <TouchableOpacity onPress={() => setQueueVisible(true)}>
                    <Text style={styles.footerTab}>Queue</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                    <Text style={styles.footerTab}>Lyrics</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                    <Text style={styles.footerTab}>Related</Text>
                </TouchableOpacity>
            </View>

            {/* --- MODAL 1: MENU --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <View style={styles.modalIndicator} />
                                <View style={styles.modalTopActions}>
                                    <TopAction label="Download" />
                                    <TopAction label="Share" />
                                    <TopAction label="Play next" />
                                </View>
                                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                    <MenuItem label="Add to another playlist" />
                                    <MenuItem label="Add to queue" />
                                    <MenuItem label="Cancel queue" />
                                    <MenuItem label="View album" />
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* --- MODAL 2: QUEUE (Real Data) --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={queueVisible}
                onRequestClose={() => setQueueVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setQueueVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.queueModalContent}>
                                <View style={styles.queueHeader}>
                                    <Text style={styles.queueHeaderTitle}>Queue</Text>
                                </View>

                                <ScrollView
                                    style={styles.modalScroll}
                                    contentContainerStyle={{ paddingBottom: 40 }}
                                    showsVerticalScrollIndicator={false}
                                >
                                    {playlist.length > 0 ? (
                                        playlist.map((item, index) => (
                                            <QueueItem key={item.id || item._id || index} item={item} />
                                        ))
                                    ) : (
                                        <Text style={styles.emptyQueueText}>No tracks in queue</Text>
                                    )}
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: 30,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        width: '100%',
        height: 50,
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    albumCoverPlaceholder: {
        width: SCREEN_WIDTH * 0.8,
        height: SCREEN_WIDTH * 0.8,
        borderRadius: (SCREEN_WIDTH * 0.8) / 2,
        backgroundColor: '#000000',
    },
    textBlock: {
        alignItems: 'center',
        paddingHorizontal: 30,
        width: '100%',
        height: 60,
        justifyContent: 'center',
    },
    titleContainer: {
        width: '100%',
        alignItems: 'center',
        overflow: 'hidden',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#000000',
    },
    artist: {
        fontSize: 16,
        color: '#434343',
        marginTop: 6,
    },

    /* PROGRESS BAR */
    progressBarWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '85%',
        justifyContent: 'space-between',
    },
    timeText: {
        fontSize: 12,
        color: '#000000',
        fontWeight: '500',
        width: 40,
        textAlign: 'center',
    },
    progressTouchArea: {
        flex: 1,
        height: 34,
        justifyContent: 'center',
        marginHorizontal: 10,
        position: 'relative',
    },
    progressLineBg: {
        height: 2,
        backgroundColor: '#E0E0E0',
        borderRadius: 2,
        width: '100%',
        overflow: 'hidden',
    },
    progressLineFill: {
        height: '100%',
        backgroundColor: '#434343',
        borderRadius: 2,
    },
    progressKnobContainer: {
        position: 'absolute',
        width: 34,
        height: 34,
        marginLeft: -17,
        justifyContent: 'center',
        alignItems: 'center',
        top: 0,
    },
    progressKnobVisual: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#434343',
    },

    /* CONTROLS */
    controlsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '90%',
        paddingHorizontal: 10,
    },
    secondaryControlText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000',
        textTransform: 'uppercase',
    },
    mainControlsWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 220,
        height: 80,
    },
    controlsCapsule: {
        width: '100%',
        height: 60,
        borderRadius: 30,
        backgroundColor: '#D9D9D9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 25,
    },
    capsuleText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000000',
    },
    playCircle: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#000000',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    playText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    footerTab: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },

    /* --- MODAL COMMON --- */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'flex-end',
    },
    modalScroll: {
        width: '100%',
    },

    /* --- MENU MODAL --- */
    modalContent: {
        backgroundColor: '#E7E7E7',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 20,
        paddingHorizontal: 20,
        height: SCREEN_HEIGHT * 0.75,
        alignItems: 'center',
    },
    modalIndicator: {
        width: 40,
        height: 5,
        backgroundColor: '#CCC',
        borderRadius: 2.5,
        marginBottom: 20,
    },
    modalTopActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    topActionContainer: {
        alignItems: 'center',
    },
    topActionCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: 8,
    },
    topActionText: {
        fontSize: 12,
        color: '#333',
    },
    menuItemCapsule: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#000',
        marginBottom: 12,
        paddingRight: 16,
    },
    menuItemIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#000',
        marginLeft: -1,
        marginRight: 12,
    },
    menuItemText: {
        fontSize: 16,
        color: '#000',
        fontWeight: '400',
    },

    /* --- QUEUE MODAL --- */
    queueModalContent: {
        backgroundColor: '#F2F2F2',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 20,
        paddingHorizontal: 20,
        height: SCREEN_HEIGHT * 0.75,
    },
    queueHeader: {
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
    },
    queueHeaderTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#000',
    },
    emptyQueueText: {
        textAlign: 'center',
        marginTop: 20,
        fontSize: 16,
        color: '#888',
    },

    // --- GRID: QUEUE ITEM ---
    queueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        backgroundColor: 'transparent',
    },

    // Column 1
    queueLeft: {
        width: 60,
        justifyContent: 'center',
        alignItems: 'center',
    },
    queueCoverCircle: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#000',
    },

    // Column 2
    queueCenter: {
        flex: 1,
        justifyContent: 'center',
        paddingLeft: 8,
    },
    queueTitle: {
        fontSize: 16,
        fontWeight: '500',
        color: '#000',
        marginBottom: 3,
    },
    queueTitleActive: {
        fontWeight: '900',
    },
    queueArtist: {
        fontSize: 14,
        color: '#666',
    },

    // Column 3
    queueRight: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 80,
    },
    queueTextBtnContainer: {
        marginLeft: 16,
    },
    queueTextBtn: {
        fontSize: 14,
        fontWeight: '700',
        color: '#000',
    },
    queueTextBtnLike: {
        fontSize: 14,
        fontWeight: '400',
        color: '#000',
    },
});