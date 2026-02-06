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
    Image,
    ImageBackground,
    StatusBar
} from 'react-native';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
    getStreamUrl,
    likeTrack,
    unlikeTrack,
    getLikedTracks,
    getIcons,
    getTrackCoverUrl,
    markTrackAsPlayed,
    getRadioQueue
} from '../api/api';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

let globalSound = null;
let globalTrackId = null;

export default function PlayerScreen({ navigation, route }) {
    // Get track and playlist
    const { track: initialTrack, playlist = [] } = route.params || {};

    // --- STATE ---
    const [currentTrack, setCurrentTrack] = useState(initialTrack || {});
    const [isLiked, setIsLiked] = useState(false);

    const [queue, setQueue] = useState(initialTrack ? [initialTrack] : []);

    // --- ICON STATE ---
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
    const trackRecorded = useRef(false);
    const [progressBarWidth, setProgressBarWidth] = useState(0);

    // --- MARQUEE STATE ---
    const [textWidth, setTextWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const animatedValue = useRef(new Animated.Value(0)).current;

    const trackTitle = currentTrack?.title || 'No Title';
    const trackArtist = currentTrack?.artist?.name || 'Unknown Artist';

    const coverUrl = getTrackCoverUrl(currentTrack);

    // 0. ЗАВАНТАЖЕННЯ ІКОНОК
    useEffect(() => {
        loadIconsData();
    }, []);

    const loadIconsData = async () => {
        try {
            const iconsMap = await getIcons();
            setIcons(iconsMap);
        } catch (e) {
            console.log("Error loading icons:", e);
        }
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
    // Виносимо логіку оновлення статусу в окрему функцію, щоб використовувати її двічі
    const onPlaybackStatusUpdate = (status) => {
        if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            if (!isSeeking.current) {
                setPosition(status.positionMillis || 0);
            }
            setIsPlaying(status.isPlaying);

            // 👇 ЛОГІКА ІСТОРІЇ: Якщо грає > 10 секунд і ще не записано
            if (status.isPlaying && status.positionMillis > 10000 && !trackRecorded.current) {
                const trackId = currentTrack.id || currentTrack._id;
                if (trackId) {
                    markTrackAsPlayed(trackId, status.positionMillis / 1000);
                    trackRecorded.current = true; // Ставимо галочку, що відправили
                }
            }

            if (status.didJustFinish) {
                handleNext();
            }
        }
    };

    useEffect(() => {
        trackRecorded.current = false;
        loadAudio();
        // 👇 ВАЖЛИВО: Ми прибрали unloadAsync() з cleanup.
        // Тепер музика не зупиняється при виході з екрану, але
        // логіка loadAudio гарантує, що не буде накладання звуків.
        return () => {
            // Очищаємо слухача подій при розмонтуванні екрану,
            // щоб не оновлювати стейт неіснуючого компонента
            if (globalSound) {
                globalSound.setOnPlaybackStatusUpdate(null);
            }
        };
    }, [currentTrack]);

    const loadAudio = async () => {
        if (!currentTrack) return;
        const trackId = currentTrack.id || currentTrack._id;
        if (!trackId) return;

        try {
            // СЦЕНАРІЙ А: Ми відкрили той самий трек, що вже грає глобально
            if (globalSound && globalTrackId === trackId) {
                // Прив'язуємо локальний стейт до глобального звуку
                setSound(globalSound);
                const status = await globalSound.getStatusAsync();
                setIsPlaying(status.isPlaying);
                // Підписуємося на оновлення прогрес-бару для цього екрану
                globalSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
                return;
            }

            // СЦЕНАРІЙ Б: Ми відкрили новий трек. Треба зупинити старий.
            if (globalSound) {
                await globalSound.unloadAsync();
                globalSound = null;
                globalTrackId = null;
            }

            // Завантажуємо новий трек
            const uri = getStreamUrl(trackId);
            const { sound: newSound } = await Audio.Sound.createAsync(
                { uri: uri },
                { shouldPlay: true },
                onPlaybackStatusUpdate // Одразу передаємо колбек
            );

            // Оновлюємо глобальні змінні
            globalSound = newSound;
            globalTrackId = trackId;

            // Оновлюємо локальний стейт
            setSound(newSound);
            setIsPlaying(true);

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
        if (!queue.length) return; // 👈 playlist -> queue
        const currentIndex = queue.findIndex(t => (t.id || t._id) === (currentTrack.id || currentTrack._id)); // 👈 playlist -> queue
        if (currentIndex < queue.length - 1) { // 👈 playlist -> queue
            setCurrentTrack(queue[currentIndex + 1]); // 👈 playlist -> queue
        } else {
            setIsPlaying(false);
        }
    };

    const handlePrev = () => {
        if (!queue.length) return; // 👈 playlist -> queue
        const currentIndex = queue.findIndex(t => (t.id || t._id) === (currentTrack.id || currentTrack._id)); // 👈 playlist -> queue
        if (currentIndex > 0) {
            setCurrentTrack(queue[currentIndex - 1]); // 👈 playlist -> queue
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

    const handleStartRadio = async () => {
        const trackId = currentTrack.id || currentTrack._id;
        console.log("📻 Starting radio for track:", trackId);

        if (!trackId) return;

        // Закриваємо меню, щоб бачити результат
        setModalVisible(false);

        try {
            const radioTracks = await getRadioQueue(trackId);

            // 👇 ДИВИМОСЬ У КОНСОЛЬ
            console.log("📻 Radio response length:", radioTracks.length);

            if (radioTracks.length === 0) {
                Alert.alert("Radio", "Server returned 0 similar tracks.");
                return;
            }

            const formattedQueue = radioTracks.map(t => ({
                id: t.trackId || t.id,
                title: t.title,
                artist: { name: t.artistName || t.artist?.name },
                coverFileId: 'force-load',
                // Зберігаємо структуру, щоб нічого не згубити
                ...t
            }));

            // Створюємо нову чергу: Поточний трек + Радіо
            const newQueue = [currentTrack, ...formattedQueue];

            console.log("📻 Updating queue. New size:", newQueue.length);
            setQueue(newQueue);

            // 👇 ВІДКРИЙ ЧЕРГУ АВТОМАТИЧНО, ЩОБ ПОБАЧИТИ ЗМІНИ
            setTimeout(() => {
                setQueueVisible(true);
            }, 500);

            Alert.alert("Radio Started", `Added ${radioTracks.length} tracks!`);

        } catch (e) {
            console.log("❌ Radio start error:", e);
            Alert.alert("Error", "Radio failed");
        }
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

    const handleViewInfo = () => {
        setModalVisible(false);
        navigation.navigate('SongInfo', { track: currentTrack });
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

// 👇 ОНОВЛЕНА ФУНКЦІЯ
    const renderIcon = (iconName, fallbackText, style, tintColor = '#000000') => {
        // Перевіряємо, чи є посилання на іконку
        if (icons[iconName]) {
            // Якщо tintColor передано (не null і не undefined), додаємо його до стилів.
            // Якщо tintColor === null, ми його НЕ додаємо, і картинка лишається кольоровою.
            const imageStyle = [style];
            if (tintColor) {
                imageStyle.push({ tintColor: tintColor });
            }

            return (
                <Image
                    source={{ uri: icons[iconName] }}
                    style={imageStyle}
                    resizeMode="contain"
                />
            );
        }
        // Фолбек, якщо іконки немає
        return <Text style={[styles.headerText, { fontSize: 14, color: tintColor || '#F5D8CB' }]}>{fallbackText}</Text>;
    };
    // --- HELPER COMPONENTS ---
    const TopAction = ({ label, iconName }) => (
        <TouchableOpacity style={styles.topActionContainer}>
            <View style={styles.topActionCircle}>
                {renderIcon(iconName, '', { width: 24, height: 24 }, '#F5D8CB')}
            </View>
            <Text style={styles.topActionText}>{label}</Text>
        </TouchableOpacity>
    );

    const MenuItem = ({ label, iconName, onPress }) => (
        <TouchableOpacity
            style={styles.menuItemCapsule}
            onPress={onPress}
        >
            <View style={styles.menuItemIconCircle}>
                {renderIcon(iconName, '', { width: 24, height: 24 }, '#F5D8CB')}
            </View>
            <Text style={styles.menuItemText}>{label}</Text>
        </TouchableOpacity>
    );

// --- QUEUE ITEM ---
        const QueueItem = ({ item }) => {
            const isCurrent = (item.id || item._id) === (currentTrack.id || currentTrack._id);
            const itemCoverUrl = getTrackCoverUrl(item);

            return (
                <TouchableOpacity
                    style={styles.queueItemContainer}
                    onPress={() => playFromQueue(item)}
                >
                    {/* ВІНІЛОВИЙ БЛОК */}
                    <View style={styles.vinylContainer}>

                        {/* 1. ЛОГІКА ОБКЛАДИНКИ: */}
                        {/* Якщо є URL — показуємо картинку. Якщо ні — твою іконку через renderIcon */}
                        {itemCoverUrl ? (
                            <Image
                                source={{ uri: itemCoverUrl }}
                                style={styles.innerCover}
                                resizeMode="cover"
                            />
                        ) : (
                            // ФОЛБЕК (ЗАГЛУШКА)
                            <View style={[styles.innerCover, { backgroundColor: '#2A1414', justifyContent: 'center', alignItems: 'center' }]}>
                                {renderIcon('VOX.png', '♪', { width: 14, height: 14 }, '#FFFFFF')}
                            </View>
                        )}

                        {/* 2. Платівка (Верхній шар) */}
                        <View style={styles.vinylOverlayWrapper}>
                            {renderIcon('plastinka.png', '', { width: 50, height: 50 }, null)}
                        </View>
                    </View>

                    {/* ТЕКСТОВА ЧАСТИНА */}
                    <View style={styles.queueInfo}>
                        <Text
                            style={[
                                styles.queueTitle,
                                isCurrent && styles.queueTitleActive
                            ]}
                            numberOfLines={1}
                        >
                            {item.title || 'No Title'}
                        </Text>
                        <Text style={styles.queueArtist} numberOfLines={1}>
                            {item.artist?.name || 'Unknown'}
                        </Text>
                    </View>

                    {/* ПРАВА ЧАСТИНА (Кнопки) */}
                    <View style={styles.queueActions}>
                        {isCurrent && (
                            <TouchableOpacity
                                style={styles.miniPlayButton}
                                onPress={handlePlayPause}
                                hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
                            >
                                {renderIcon(
                                    isPlaying ? 'pause.png' : 'play.png',
                                    '',
                                    { width: 12, height: 12 },
                                    '#300C0A'
                                )}
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.heartButton}>
                            {renderIcon('hurt.png', '♡', { width: 35, height: 35 }, '#F5D8CB')}
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            );
        };


    return (
        <View style={styles.container}>
            {/* Статус бар має бути прозорим, щоб фон зайшов під нього */}
            <StatusBar
                barStyle="light-content"
                translucent={true}
                backgroundColor="transparent"
            />

            {/* 1. ФОН (Абсолютне позиціювання) */}
            {/* Це зображення ігнорує всі відступи і займає весь фізичний екран */}
            {icons['background.png'] ? (
                <Image
                    source={{ uri: icons['playerbg.png'] }}
                    style={styles.fixedBackground}
                    resizeMode="cover"
                />
            ) : null}

            {/* Затемнення поверх картинки */}
            <View style={styles.darkOverlay} />


            {/* 2. КОНТЕНТ (Header, Cover, Controls) */}
            <View style={styles.contentContainer}>

                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        {renderIcon('arrow-left.png', 'Back', { width: 24, height: 24 }, '#F5D8CB')}
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={{ marginRight: 20 }}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        onPress={handleLikeToggle}
                    >
                        {isLiked
                            ? renderIcon('added.png', 'Lik', { width: 24, height: 24 }, '#F5D8CB')
                            : renderIcon('add to another playlist.png', 'Lik', { width: 24, height: 24 }, '#F5D8CB')
                        }
                    </TouchableOpacity>
                    <TouchableOpacity
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        onPress={() => setModalVisible(true)}
                    >
                        {renderIcon('more.png', '•••', { width: 24, height: 24 }, '#F5D8CB')}
                    </TouchableOpacity>
                </View>

                {/* ALBUM COVER (CENTER) */}
                <View style={styles.albumCoverPlaceholder}>
                    {renderIcon('plastinka.png', 'No Vinyl', styles.vinylBackground, null)}
                    {coverUrl ? (
                        <Image
                            source={{ uri: coverUrl }}
                            style={styles.albumCoverImage}
                        />
                    ) : null}
                </View>

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
                        {renderIcon('shuffle.png', 'Mix', { width: 24, height: 24 }, '#F5D8CB')}
                    </TouchableOpacity>

                    {/* CAPSULE CONTROLS with LIQUID GLASS */}
                    <View style={styles.mainControlsWrapper}>
                        <LinearGradient
                            colors={[
                                'rgba(255, 255, 255, 0.0)',  // BL: Прозорий
                                'rgba(255, 255, 255, 0.0)',  // Center: Білий блік
                                'rgba(255, 255, 255, 0.0)',
                                'rgba(255, 255, 255, 0.0)'   // TR: Прозорий
                            ]}
                            locations={[0, 0.3, 0.7, 1]}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                width: '100%',
                                height: 60,
                                borderRadius: 30,
                                padding: 1.2, // Товщина рамки
                            }}
                        >
                            <BlurView
                                intensity={20}
                                tint="dark"
                                style={styles.controlsCapsule}
                            >
                                {/* Кольоровий шар (Sandwich method) */}
                                <View style={[
                                    StyleSheet.absoluteFill,
                                    { backgroundColor: 'rgba(48, 12, 10, 0.1)' }
                                ]} />

                                {/* Вміст пігулки (Кнопки) */}
                                <View style={styles.controlsContent}>
                                    <TouchableOpacity onPress={handlePrev} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                        {renderIcon('previous.png', 'Prev', { width: 28, height: 28 }, '#F5D8CB')}
                                    </TouchableOpacity>

                                    {/* Пусте місце по центру для кнопки Play */}
                                    <View style={{ width: 60 }} />

                                    <TouchableOpacity onPress={handleNext} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                        {renderIcon('next.png', 'Next', { width: 28, height: 28 }, '#F5D8CB')}
                                    </TouchableOpacity>
                                </View>
                            </BlurView>
                        </LinearGradient>

                        {/* PLAY BUTTON  */}
                        <TouchableOpacity
                            style={styles.playCircle}
                            activeOpacity={0.8}
                            onPress={handlePlayPause}
                        >
                            {isPlaying
                                ? renderIcon('pause.png', '||', { width: 32, height: 32 }, '#300C0A')
                                : renderIcon('play.png', '>', { width: 32, height: 32 }, '#300C0A')
                            }
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {renderIcon('previous-1.png', 'Rep', { width: 24, height: 24 }, '#F5D8CB')}
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
            </View>

            {/* --- MENU MODAL (Liquid Glass) --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            {/* 1. Градієнтна рамка (акцент на верхню частину) */}
                            <LinearGradient
                                colors={['rgba(48, 12, 10, 0.7)', 'rgba(48, 12, 10, 0.7)', 'rgba(48, 12, 10, 0.7)']}
                                locations={[0, 0.2, 1]}
                                start={{ x: 0.5, y: 0 }} // Верх
                                end={{ x: 0.5, y: 1 }}   // Низ
                                style={styles.modalWrapperGradient}
                            >
                                {/* 2. BlurView + Колір */}
                                <BlurView intensity={30} tint="dark" style={styles.modalGlassContainer}>
                                    {/* Кольоровий шар */}
                                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(48, 12, 10, 0.7)' }]} />

                                    {/* 3. Контент (колишній modalContent) */}
                                    <View style={styles.modalInnerContent}>
                                        <View style={styles.modalIndicator} />
                                        <View style={styles.modalTopActions}>
                                            <TopAction label="Download" iconName="download.png" />
                                            <TopAction label="Share" iconName="share.png" />
                                            <TopAction label="Play next" iconName="play next.png" />
                                        </View>
                                        <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                            <MenuItem label="Add to another playlist" iconName="add to another playlist.png" />
                                            <MenuItem label="Add to queue" iconName="add to queue.png" />
                                            <MenuItem label="Cancel queue" iconName="cancel queue.png" />
                                            <MenuItem label="View album" iconName="album.png" />
                                            <MenuItem
                                                label="View song information"
                                                iconName="song information.png"
                                                onPress={handleViewInfo}
                                            />
                                            <MenuItem label="View the artist" iconName="artist.png" />
                                            <MenuItem
                                                label="Go to radio based on song"
                                                iconName="radio.png"
                                                onPress={handleStartRadio}
                                            />
                                        </ScrollView>
                                    </View>
                                </BlurView>
                            </LinearGradient>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* --- QUEUE MODAL (Liquid Glass) --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={queueVisible}
                onRequestClose={() => setQueueVisible(false)}
            >
                <TouchableWithoutFeedback onPress={() => setQueueVisible(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            {/* 1. Градієнтна рамка */}
                            <LinearGradient
                                colors={['rgba(48, 12, 10, 0.7)', 'rgba(48, 12, 10, 0.7)', 'rgba(48, 12, 10, 0.7)']}
                                locations={[0, 0.2, 1]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={styles.modalWrapperGradient}
                            >
                                {/* 2. BlurView + Колір */}
                                <BlurView intensity={30} tint="dark" style={styles.modalGlassContainer}>
                                    {/* Кольоровий шар */}
                                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(48, 12, 10, 0.7)' }]} />

                                    {/* 3. Контент (колишній queueModalContent) */}
                                    <View style={styles.queueInnerContent}>
                                        <View style={styles.queueHeader}>
                                            <Text style={styles.queueHeaderTitle}>Queue</Text>
                                        </View>
                                        <ScrollView
                                            style={styles.modalScroll}
                                            contentContainerStyle={{ paddingBottom: 40 }}
                                            showsVerticalScrollIndicator={false}
                                        >
                                            {queue.length > 0 ? (
                                                queue.map((item, index) => (  // ✅ Використовуємо queue
                                                    <View key={item.id || item._id || index}>
                                                        <QueueItem item={item} />
                                                        {index < queue.length - 1 && ( // ✅ Використовуємо queue
                                                            <View style={styles.queueSeparator} />
                                                        )}
                                                    </View>
                                                ))
                                            ) : (
                                                <Text style={styles.emptyQueueText}>No tracks in queue</Text>
                                            )}
                                        </ScrollView>
                                    </View>
                                </BlurView>
                            </LinearGradient>
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
        backgroundColor: '#300C0A',
    },

    fixedBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_WIDTH,   // Жорстко прив'язуємо до розміру екрану
        height: SCREEN_HEIGHT, // Жорстко прив'язуємо до розміру екрану
        resizeMode: 'cover',   // Розтягуємо зі збереженням пропорцій
        zIndex: 0,
        // transform: [{ scale: 1.27 }]
    },

    contentContainer: {
        flex: 1,
        zIndex: 1, // Контент зверху
        paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight || 40,
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
        color: '#F5D8CB',
    },
    albumCoverPlaceholder: {
        width: SCREEN_WIDTH * 0.8,
        height: SCREEN_WIDTH * 0.8,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },

    vinylBackground: {
        width: '100%',
        height: '100%',
        position: 'absolute',
        zIndex: 1,
    },

    albumCoverImage: {
        width: '55%',
        height: '55%',
        borderRadius: 1000,
        zIndex: 2,
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
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
    },
    artist: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
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
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
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
        backgroundColor: '#F5D8CB',
        borderRadius: 2,
        width: '100%',
        overflow: 'hidden',
    },
    progressLineFill: {
        height: '100%',
        backgroundColor: '#300C0A',
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
        backgroundColor: '#F5D8CB',
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
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        textTransform: 'uppercase',
    },
    mainControlsWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 220,
        height: 80,
        position: 'relative', // Важливо для абсолютного позиціювання кнопки Play
    },
    controlsCapsule: {
        flex: 1,
        borderRadius: 30,
        overflow: 'hidden',
        // ❌ backgroundColor видалено, бо він тепер окремим шаром
    },
    controlsContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Розносить кнопки по краях
        paddingHorizontal: 25,
    },
    capsuleText: {
        fontSize: 16,
        fontFamily: 'Unbounded-SemiBold',
        color: '#fff',
    },
    playCircle: {
        position: 'absolute', // Кнопка Play лежить поверх пігулки
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        // Центруємо кнопку:
        top: 0,
        left: (220 - 80) / 2, // (WidthWrapper - WidthButton) / 2
    },
    playText: {
        color: '#FFFFFF',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: 16,
    },
    footer: {
        paddingBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
    },
    footerTab: {
        fontSize: 16,
        fontFamily: 'Unbounded-Regular',
        color: '#F5D8CB',
    },

    /* --- MODAL COMMON --- */
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalWrapperGradient: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingTop: 1.2,         // Рамка зверху
        paddingHorizontal: 1.2,  // Рамка збоку
        // Знизу рамка не потрібна, бо воно виходить за екран
    },
    modalGlassContainer: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        overflow: 'hidden',
        height: SCREEN_HEIGHT * 0.75, // Висота переїхала сюди
    },
    modalScroll: {
        width: '100%',
    },

    /* --- MENU MODAL --- */
    modalInnerContent: {
        flex: 1,
        paddingTop: 20,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    modalIndicator: {
        width: 40,
        height: 5,
        backgroundColor: 'rgba(48, 12, 10, 0.7)',
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
        borderColor: '#F5D8CB',
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    topActionText: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
    },
    menuItemCapsule: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F5D8CB',
        marginBottom: 12,
        paddingRight: 16,
    },
    menuItemIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#F5D8CB',
        marginLeft: -1,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuItemText: {
        fontSize: 16,
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
        fontWeight: '400',
    },

    /* --- QUEUE MODAL --- */
    queueInnerContent: {
        flex: 1,
        paddingTop: 25,
        paddingHorizontal: 20,
    },
    queueHeader: {
        alignItems: 'center',
        marginBottom: 20,
        paddingVertical: 10,
    },
    queueHeaderTitle: {
        fontSize: 22,
        fontFamily: 'Unbounded-Bold',
        color: '#F5D8CB',
    },
    emptyQueueText: {
        textAlign: 'center',
        marginTop: 40,
        fontSize: 16,
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
    },

    /* --- QUEUE ITEM STYLES (ОНОВЛЕНО) --- */
    queueItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    queueSeparator: {
        height: 1,
        backgroundColor: '#DFDFDF', // Твій колір #F5D8CB з прозорістю
        width: '100%',
    },

    /* Вінілова іконка */
    vinylContainer: {
        width: 58,
        height: 58,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    innerCover: {
        width: 25.18,       // Трохи менше за платівку, щоб влазило в центр
        height: 25.18,
        borderRadius: 14,
        position: 'absolute',
        zIndex: 1,       // Шар 1
    },
    vinylOverlay: {
        width: '100%',
        height: '100%',
        zIndex: 2,       // Шар 2 (зверху)
    },

    /* Текст */
    queueInfo: {
        flex: 1,
        marginLeft: 15,
        justifyContent: 'center',
    },
    queueTitle: {
        fontSize: 16,
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        marginBottom: 2,
    },
    queueArtist: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
    },

    /* Кнопки праворуч */
    queueActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    miniPlayButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    heartButton: {
        padding: 5,
        justifyContent: 'center',
        alignItems: 'center',
    },
});