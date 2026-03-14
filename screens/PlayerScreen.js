import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Platform,
    Animated,
    Easing,
    Dimensions,
    Alert,
    Modal,
    ScrollView,
    TouchableWithoutFeedback,
    Image,
    StatusBar,
    Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgUri, SvgXml } from 'react-native-svg';
import { usePlayerStore } from '../store/usePlayerStore';
import {
    getStreamUrl,
    likeTrack,
    unlikeTrack,
    getLikedTracks,
    getIcons,
    getCachedIcons,
    getTrackCoverUrl,
    markTrackAsPlayed,
    getRadioQueue,
    getRecommendations,
    getTracks,
    getUserAvatarUrl,
    getColoredSvgXml,
    peekColoredSvgXml,
    resolveArtistName,
    saveOfflineDownload,
} from '../api/api';


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');


// 0. ГЛОБАЛЬНИЙ КЕШ (Щоб не вантажити одне й те саме 100 разів)
const imagePrefetchCache = new Set();
let iconsMapCache = null;
const artistAvatarUrlCache = new Map();

const prefetchImageOnce = (uri) => {
    if (!uri || imagePrefetchCache.has(uri)) return;
    imagePrefetchCache.add(uri);
    Image.prefetch(uri).catch(() => {
        imagePrefetchCache.delete(uri);
    });
};

// 👇 Цей компонент завантажує SVG, чистить, фарбує і КЕШУЄ результат
const ColoredSvg = React.memo(({ uri, width, height, color }) => {
    const [xml, setXml] = useState(peekColoredSvgXml(uri, color));

    useEffect(() => {
        let isMounted = true;

        if (uri) {
            getColoredSvgXml(uri, color)
                .then((cachedXml) => {
                    if (isMounted) setXml(cachedXml);
                })
                .catch(err => console.log("SVG Error:", err));
        } else {
            setXml(null);
        }

        return () => { isMounted = false; };
    }, [uri, color]);

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
});


// 👇 ОНОВЛЕНИЙ QueueItem (приймає isLiked та onLike)
const QueueItem = React.memo(({ item, currentTrack, isPlaying, playFromQueue, handlePlayPause, renderIcon, isLiked, onLike, hidePlayButton = false }) => {
    const isCurrent = (item.id || item._id) === (currentTrack.id || currentTrack._id);
    const itemCoverUrl = getTrackCoverUrl(item);

    return (
        <TouchableOpacity
            style={styles.queueItemContainer}
            onPress={() => playFromQueue(item)}
        >
            <View style={styles.vinylContainer}>
                {itemCoverUrl ? (
                    <Image source={{ uri: itemCoverUrl, cache: 'force-cache' }} style={styles.innerCover} resizeMode="cover" />
                ) : (
                    <View style={[styles.innerCover, { backgroundColor: '#2A1414', justifyContent: 'center', alignItems: 'center' }]}>
                        {renderIcon('VOX.svg', '♪', { width: 14, height: 14 }, '#FFFFFF')}
                    </View>
                )}
                <View style={styles.vinylOverlayWrapper}>
                    {renderIcon('vinyl.svg', '', { width: 50, height: 50 }, null)}
                </View>
            </View>

            <View style={styles.queueInfo}>
                <Text style={[styles.queueTitle, isCurrent && styles.queueTitleActive]} numberOfLines={1}>
                    {item.title || 'No Title'}
                </Text>
                <Text style={styles.queueArtist} numberOfLines={1}>
                    {resolveArtistName(item, 'Unknown')}
                </Text>
            </View>

            <View style={styles.queueActions}>
                {isCurrent && !hidePlayButton && (
                    <TouchableOpacity style={styles.miniPlayButton} onPress={handlePlayPause} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {renderIcon(isPlaying ? 'pause.svg' : 'play.svg', '', { width: 12, height: 12 }, '#300C0A')}
                    </TouchableOpacity>
                )}

                {/* 👇 КНОПКА ЛАЙКУ */}
                <TouchableOpacity
                    style={styles.heartButton}
                    onPress={() => onLike(item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {isLiked
                        ? renderIcon('added.svg', '♥', { width: 24, height: 24 }, '#F5D8CB') // Заповнене (або галочка, як у хедері)
                        : renderIcon('add.svg', '♡', { width: 24, height: 24 }, '#F5D8CB') // Пусте
                    }
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
});

export default function PlayerScreen({ navigation, route }) {
    // 1. НАЙПЕРШЕ — ТЯГНЕМО ГЛОБАЛЬНИЙ СТОР
    const {
        currentTrack, isPlaying, position, duration, queue, currentIndex,
        togglePlay, playNext, playPrev, seekTo, setQueue, addToQueue, clearQueue, setTrack,
        adModalVisible, adData, adPositionMs, adDurationMs, isAdPlaying, toggleAdPlayPause,
    } = usePlayerStore();

    // 2. ДІСТАЄМО ІНФУ САМЕ З ГЛОБАЛЬНОГО СТОРУ
    const trackTitle = currentTrack?.title || 'No Title';
    const trackArtist = resolveArtistName(currentTrack, 'Unknown Artist');
    const coverUrl = getTrackCoverUrl(currentTrack);

    // 3. ВСІ ІНШІ СТЕЙТИ
    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const playerBackgroundUrl =
        icons['playerbg.png'] ||
        icons['bg.png'] ||
        icons['playerBg.png'] ||
        icons['bg.PNG'] ||
        null;
    const [recommendations, setRecommendations] = useState([]);
    const [relatedArtists, setRelatedArtists] = useState([]);
    const [notification, setNotification] = useState(null);
    const notifAnim = useRef(new Animated.Value(200)).current;
    const notifHideTimeoutRef = useRef(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [queueVisible, setQueueVisible] = useState(false);
    const [relatedVisible, setRelatedVisible] = useState(false);
    const isSeeking = useRef(false);
    const [progressBarWidth, setProgressBarWidth] = useState(0);
    const [likedTrackIds, setLikedTrackIds] = useState([]);

    // 4. СИНХРОНІЗАЦІЯ (Якщо відкрили з іншого екрану)
    useEffect(() => {
        if (route.params?.track) {
            const paramTrack = route.params.track;
            if (!currentTrack || (currentTrack.id || currentTrack._id) !== (paramTrack.id || paramTrack._id)) {
                setTrack(paramTrack);
            }
        }
    }, [route.params?.track]);

    // 0. ЗАВАНТАЖЕННЯ ІКОНОК
    useEffect(() => {
        loadIconsData();
    }, []);

    useEffect(() => {
        prefetchImageOnce(coverUrl);
    }, [coverUrl]);

    useEffect(() => {
        prefetchImageOnce(playerBackgroundUrl);
    }, [playerBackgroundUrl]);

    useEffect(() => {
        // Прогріваємо найближчі обкладинки в черзі, щоб у модалці відкривались без затримки
        const upcomingTracks = queue.slice(currentIndex, currentIndex + 8);
        upcomingTracks.forEach((track) => prefetchImageOnce(getTrackCoverUrl(track)));
    }, [queue, currentIndex]);

    useEffect(() => {
        if (!adModalVisible || !adData) return;
        if (adData.imageUrl) {
            prefetchImageOnce(adData.imageUrl);
        }
        showNotification(adData.title || 'VOX Pro', 'View', () => {
            if (!adData.targetUrl) return;
            Linking.openURL(adData.targetUrl).catch(() => {});
        });
    }, [adModalVisible, adData]);

    const loadIconsData = async () => {
        if (Object.keys(icons).length > 0) {
            return;
        }

        if (iconsMapCache) {
            setIcons(iconsMapCache);
            return;
        }

        try {
            const iconsMap = await getIcons();
            iconsMapCache = iconsMap || {};
            setIcons(iconsMapCache);
        } catch (e) {
            console.log("Error loading icons:", e);
        }
    };



    //recomendations

    useEffect(() => {
        if (relatedVisible) {
            // Не перезавантажуємо щоразу при відкритті модалки, якщо дані вже є
            if (recommendations.length === 0 || relatedArtists.length === 0) {
                loadRelatedData();
            }
        }
    }, [relatedVisible, recommendations.length, relatedArtists.length]);


    const loadRelatedData = async () => {
        const trackId = currentTrack.id || currentTrack._id;
        if (!trackId) return;

        try {
            // Паралельно вантажимо рекомендації та треки для артистів
            const [recs, allTracks] = await Promise.all([
                getRecommendations(),
                getTracks(),
            ]);

            const formattedRecs = (recs || []).map(r => ({
                ...r, // 👈 СПОЧАТКУ розгортаємо об'єкт із сервера
                id: r.trackId, // 👈 ПОТІМ задаємо ID (щоб він точно був правильним)
                title: r.title,
                artist: { name: r.artistName || 'Unknown' },
                coverFileId: r.coverFileId,
                fileId: r.fileId,
            }));
            setRecommendations(formattedRecs.slice(0, 10));
            formattedRecs.slice(0, 10).forEach((track) => prefetchImageOnce(getTrackCoverUrl(track)));

            // Related artists: беремо перші 4 унікальних артистів
            const map = new Map();
            allTracks.forEach(t => {
                const aName = t.artistName || t.artist?.name;
                const aId = t.artistId || t.ArtistId || t.artist?.id || t.artist?._id;
                if (aId && !map.has(aId) && aName) {
                    map.set(aId, {
                        id: aId,
                        artistId: aId,
                        ownerId: t.ownerId || t.OwnerId || null,
                        name: aName,
                    });
                }
            });
            const nextRelatedArtists = [...map.values()].slice(0, 4);
            setRelatedArtists(nextRelatedArtists);

            // Прогріваємо аватари, щоб рендерились одразу при відкритті Related
            nextRelatedArtists.forEach((artist) => {
                const url = getAvatar(artist.id);
                prefetchImageOnce(url);
            });

        } catch (e) {
            console.log("Error loading related:", e);
        }
    };

    const handleRecommendationPlay = (track) => {
        const trackId = track.id || track._id;
        const history = queue.slice(0, currentIndex + 1);
        const cleaned = history.filter(t => (t.id || t._id) !== trackId);
        const newQueue = [...cleaned, track];

        setQueue(newQueue, newQueue.length - 1); // 👈 Встановлюємо глобально

        setRecommendations(prev => prev.filter(t => (t.id || t._id) !== trackId));
    };


    const getAvatar = (userId) => {
        if (!userId) return null;
        const key = String(userId);
        if (!artistAvatarUrlCache.has(key)) {
            artistAvatarUrlCache.set(key, getUserAvatarUrl(userId));
        }
        return artistAvatarUrlCache.get(key);
    };


    //LIKE STATUS
    useEffect(() => {
        loadLikedIds();
    }, []);

    const loadLikedIds = async () => {
        try {
            const ids = await getLikedTracks();
            if (Array.isArray(ids)) {
                setLikedTrackIds(ids);
            }
        } catch (e) {
            console.log("Error loading liked IDs:", e);
        }
    };

    // 2. Функція перемикання лайка для будь-якого треку в списку
    const handleItemLikeToggle = async (track) => {
        const trackId = track.id || track._id;
        if (!trackId) return;
        const isCurrentlyLiked = likedTrackIds.includes(trackId);
        const prevIds = likedTrackIds;

        // Оптимістичне оновлення (миттєво змінюємо UI)
        let newIds;
        if (isCurrentlyLiked) {
            newIds = likedTrackIds.filter(id => id !== trackId);
        } else {
            newIds = [...likedTrackIds, trackId];
        }
        setLikedTrackIds(newIds);

        // Відправляємо запит на сервер
        try {
            if (isCurrentlyLiked) {
                await unlikeTrack(trackId);
                showNotification('Removed from liked');
            } else {
                await likeTrack(trackId);
                showNotification('Added to liked');
            }
        } catch (error) {
            console.log("Like error:", error);
            // Відкатуємо оптимістичне оновлення при помилці
            setLikedTrackIds(prevIds);
            showNotification('Failed to update like');
        }
    };

     //NOTIFICATIONS
    // 👇 ОНОВЛЕНА ФУНКЦІЯ (Анімація знизу)
    const showNotification = (message, actionLabel = null, action = null) => {
        if (notifHideTimeoutRef.current) {
            clearTimeout(notifHideTimeoutRef.current);
            notifHideTimeoutRef.current = null;
        }
        notifAnim.stopAnimation();

        setNotification({ message, actionLabel, action });

        Animated.timing(notifAnim, {
            toValue: 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        notifHideTimeoutRef.current = setTimeout(() => {
            Animated.timing(notifAnim, {
                toValue: 200,
                duration: 300,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }).start(() => {
                setNotification(null);
            });
        }, 2400);
    };

    useEffect(() => {
        return () => {
            if (notifHideTimeoutRef.current) {
                clearTimeout(notifHideTimeoutRef.current);
            }
        };
    }, []);

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
        usePlayerStore.setState({ position: calculateSeekPosition(e) });
    };

    const handleMove = (e) => {
        usePlayerStore.setState({ position: calculateSeekPosition(e) });
    };

    const handleRelease = async (e) => {
        const seekPos = calculateSeekPosition(e);
        await seekTo(seekPos);
        isSeeking.current = false;
    };


    const handlePlayNext = () => {
        closeModal();
        const newQueue = [...queue];
        newQueue.splice(currentIndex + 1, 0, currentTrack);
        setQueue(newQueue, currentIndex); // 👈 Оновлюємо глобально
        showNotification('This song will play next');
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
                showNotification('Radio: no similar tracks');
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
            setQueue([currentTrack, ...formattedQueue], 0);

            // 👇 ВІДКРИЙ ЧЕРГУ АВТОМАТИЧНО, ЩОБ ПОБАЧИТИ ЗМІНИ
            setTimeout(() => {
                openModal('queue');
            }, 500);

            showNotification(`Radio started: ${radioTracks.length} tracks`);

        } catch (e) {
            console.log("❌ Radio start error:", e);
            showNotification('Radio failed');
        }
    };



    const handleViewInfo = () => {
        closeModal();
        setTimeout(() => {
            navigation.navigate('SongInfo', { track: currentTrack });
        }, 180);
    };


    // --- Modals animations---
    // Початкова позиція шторки — за межами екрану знизу
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

    const openModal = (type) => {
        if (type === 'menu') setModalVisible(true);
        if (type === 'queue') setQueueVisible(true);
        if (type === 'related') setRelatedVisible(true);

        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    };

    // 👇 ВИПРАВЛЕНО: Прибираємо рекурсію в start callback
    const closeModal = () => {
        Animated.timing(slideAnim, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => {
            setModalVisible(false);
            setQueueVisible(false);
            setRelatedVisible(false);
        });
    };

    const handleAdPress = async () => {
        if (!adData?.targetUrl) return;
        try {
            await Linking.openURL(adData.targetUrl);
        } catch (_) {
            // ignore bad ad URL in test mode
        }
    };

    // --- MENU ACTIONS ---

    const handleViewArtist = () => {
        closeModal();
        // Перевіряємо, чи є дані артиста
        const artistData = currentTrack.artist || {};
        // Іноді ID артиста лежить в ownerId, якщо це трек
        const artistId =
            artistData.artistId ||
            artistData.ArtistId ||
            artistData.id ||
            artistData._id ||
            currentTrack.artistId ||
            currentTrack.ArtistId;

        if (artistId) {
            navigation.navigate('ArtistProfile', {
                artist: {
                    ...artistData,
                    id: artistId,
                    artistId,
                    ownerId: currentTrack.ownerId || null,
                    name: artistData.name || currentTrack.artistName || 'Unknown'
                }
            });
        } else {
            Alert.alert("Info", "Artist information is missing");
        }
    };

    const handleViewAlbum = () => {
        closeModal()

        console.log("🔍 TRACK DATA:", currentTrack); // Дивимось в консоль, що прийшло

        // Перевіряємо всі можливі варіанти, як бекенд може назвати це поле
        const albumId =
            currentTrack.albumId ||       // Стандарт
            currentTrack.AlbumId ||       // C# PascalCase
            currentTrack.album?.id ||     // Вкладений об'єкт
            currentTrack.album?._id;      // MongoDB стиль

        console.log("💿 FOUND ALBUM ID:", albumId);

        // Перевірка на валідність ID (щоб не було null або нулів)
        if (albumId && albumId !== '00000000-0000-0000-0000-000000000000') {
            navigation.navigate('AlbumDetail', { id: albumId });
        } else {
            Alert.alert("Info", "This track appears to be a single (No Album info found)");
        }
    };
    const handleAddToQueue = () => {
        closeModal();
        addToQueue(currentTrack); // 👈 З Zustand
        showNotification('Added to queue', 'View', () => openModal('queue'));
    };

    const handleClearQueue = () => {
        closeModal();
        clearQueue(); // 👈 З Zustand
        showNotification('Queue cleared');
    };

    const handleDownload = async () => {
        const sourceTrack = currentTrack?.track || currentTrack;
        const trackId = sourceTrack?.id || sourceTrack?._id;
        if (!trackId) {
            closeModal();
            showNotification('Track ID is missing');
            return;
        }

        try {
            closeModal();
            showNotification('Downloading...');
            const token = await AsyncStorage.getItem('userToken');
            const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

            const downloadsDir = `${FileSystem.documentDirectory}downloads`;
            const dirInfo = await FileSystem.getInfoAsync(downloadsDir);
            if (!dirInfo.exists) {
                await FileSystem.makeDirectoryAsync(downloadsDir, { intermediates: true });
            }

            const fileUri = `${downloadsDir}/${trackId}.mp3`;
            const existing = await FileSystem.getInfoAsync(fileUri);
            if (!existing.exists) {
                await FileSystem.downloadAsync(getStreamUrl(trackId), fileUri, {
                    headers: authHeaders,
                });
            }

            let localCoverUri = null;
            const coverUrl = getTrackCoverUrl(sourceTrack);
            if (coverUrl) {
                const coverFile = `${downloadsDir}/${trackId}_cover.jpg`;
                const coverExists = await FileSystem.getInfoAsync(coverFile);
                if (!coverExists.exists) {
                    try {
                        await FileSystem.downloadAsync(coverUrl, coverFile, {
                            headers: authHeaders,
                        });
                    } catch (_) {
                        // keep null
                    }
                }
                const coverInfo = await FileSystem.getInfoAsync(coverFile);
                if (coverInfo.exists) {
                    localCoverUri = coverFile;
                }
            }

            const payload = {
                ...sourceTrack,
                id: sourceTrack.id || sourceTrack._id,
                title: sourceTrack.title || 'Unknown title',
                artistName: resolveArtistName(sourceTrack, 'Unknown Artist'),
                localUri: fileUri,
                localCoverUri,
                downloadedAt: new Date().toISOString(),
            };

            const saveResult = await saveOfflineDownload(payload);
            if (saveResult?.error) {
                showNotification('Save download failed');
                return;
            }
            showNotification('Downloaded', 'View', () => navigation.navigate('Downloads'));
        } catch (e) {
            const rawMessage = typeof e?.message === 'string' ? e.message : '';
            const shortMessage = rawMessage ? rawMessage.replace(/\s+/g, ' ').slice(0, 64) : '';
            showNotification(shortMessage ? `Download failed: ${shortMessage}` : 'Download failed');
        }
    };

    const handleAddToPlaylist = () => {
        closeModal();
        showNotification('Playlist function coming soon');
    };

    const formatTime = (millis) => {
        if (!millis) return '00:00';
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const progressPercent = duration > 0 ? (position / duration) * 100 : 0;
    const visibleQueue = queue.slice(currentIndex);

    const renderIcon = (iconName, fallbackText, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            // ... (тут твій код перевірки svg/png залишається без змін) ...
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;

                return (
                    <ColoredSvg
                        key={iconName} // Важливо для оновлення
                        uri={iconUrl}
                        width={width}
                        height={height}
                        color={tintColor}
                    />
                );
            }
            // ... (код для PNG залишається) ...
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

        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };
    // --- HELPER COMPONENTS ---
    const TopAction = ({ label, iconName, isStub = false }) => (
        <View style={styles.topActionContainer}>
            <View style={[styles.topActionCircle, isStub && styles.stubOutline]}>
                {renderIcon(iconName, '', { width: 24, height: 24 }, isStub ? '#FF4D4F' : '#F5D8CB')}
            </View>
            <Text style={[styles.topActionText, isStub && styles.stubText]}>{label}</Text>
        </View>
    );

    const MenuItem = ({ label, iconName, onPress, isStub = false }) => (
        <TouchableOpacity
            style={[styles.menuItemCapsule, isStub && styles.stubOutline]}
            onPress={onPress}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <View style={[styles.menuItemIconCircle, isStub && styles.stubOutline]}>
                {renderIcon(iconName, '', { width: 24, height: 24 }, isStub ? '#FF4D4F' : '#F5D8CB')}
            </View>
            <Text style={[styles.menuItemText, isStub && styles.stubText]}>{label}</Text>
        </TouchableOpacity>
    );

    if (!currentTrack) return null;


    return (
        <View style={styles.container}>
            {/* Статус бар має бути прозорим, щоб фон зайшов під нього */}
            <StatusBar
                barStyle="light-content"
                translucent={true}
                backgroundColor="transparent"
            />

            {/* 1. ФОН (Абсолютне позиціювання) */}
            {playerBackgroundUrl ? (
                <Image
                    source={{ uri: playerBackgroundUrl, cache: 'force-cache' }}
                    style={styles.fixedBackground}
                    resizeMode="cover"
                />
            ) : icons['background.svg'] ? (
                <View style={styles.fixedBackground}>
                    <ColoredSvg
                        uri={icons['background.svg']}
                        width={SCREEN_WIDTH}
                        height={SCREEN_HEIGHT}
                        color={null}
                    />
                </View>
            ) : null}

            {/* Затемнення поверх картинки */}
            <View style={styles.darkOverlay} />


            {/* 2. КОНТЕНТ (Header, Cover, Controls) */}
            <View style={styles.contentContainer}>
                {adModalVisible ? (
                    <View style={styles.adPlayerContent}>
                        <View style={styles.header}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            >
                                {renderIcon('arrow-left.svg', 'Back', { width: 24, height: 24 }, '#F5D8CB')}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.adHeroCard}>
                            {adData?.imageUrl ? (
                                <TouchableOpacity activeOpacity={0.92} onPress={handleAdPress} style={styles.adImageWrap}>
                                    <Image
                                        source={{ uri: adData.imageUrl, cache: 'force-cache' }}
                                        style={styles.adImage}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ) : (
                                <View style={styles.adLoadingWrap}>
                                    <Text style={styles.adNoContentText}>No active ad found</Text>
                                </View>
                            )}
                        </View>

                        <View style={styles.adTitleWrap}>
                            <Text style={styles.adNowPlayingTitle}>Advertisement</Text>
                            <Text style={styles.adNowPlayingArtist}>{adData?.title || 'VOX'}</Text>
                        </View>

                        <View style={[styles.progressBarWrapper, styles.adProgressBarWrapper]}>
                            <View style={styles.adProgressTrackWrap}>
                                <View style={styles.progressLineBg}>
                                    <View
                                        style={[styles.progressLineFill, { width: `${Math.min(adDurationMs > 0 ? (adPositionMs / adDurationMs) * 100 : 0, 100)}%` }]}
                                        pointerEvents="none"
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.adProgressKnobContainer,
                                        { left: `${Math.min(adDurationMs > 0 ? (adPositionMs / adDurationMs) * 100 : 0, 100)}%` }
                                    ]}
                                    pointerEvents="none"
                                >
                                    <View style={styles.adProgressKnobVisual} />
                                </View>
                            </View>
                            <View style={styles.adProgressTimeRow}>
                                <Text style={styles.adTimeText}>{formatTime(adPositionMs)}</Text>
                                <Text style={styles.adTimeText}>{formatTime(adDurationMs)}</Text>
                            </View>
                        </View>

                        <View style={[styles.controlsSection, styles.adControlsSection]}>
                            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {renderIcon('shuffle.svg', 'Mix', { width: 24, height: 24 }, '#F5D8CB')}
                            </TouchableOpacity>

                            <View style={styles.mainControlsWrapper}>
                                <LinearGradient
                                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                                    locations={[0, 0.2, 1]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={{
                                        width: '100%',
                                        height: 60,
                                        borderRadius: 30,
                                        padding: 1.5,
                                    }}
                                >
                                    <BlurView intensity={15} tint="light" style={styles.controlsCapsule}>
                                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(48, 12, 10, 0.1)' }]} />
                                        <View style={styles.controlsContent}>
                                            <TouchableOpacity hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                                {renderIcon('previous.svg', 'Prev', { width: 28, height: 28 }, '#F5D8CB')}
                                            </TouchableOpacity>
                                            <View style={{ width: 60 }} />
                                            <TouchableOpacity hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                                {renderIcon('next.svg', 'Next', { width: 28, height: 28 }, '#F5D8CB')}
                                            </TouchableOpacity>
                                        </View>
                                    </BlurView>
                                </LinearGradient>

                                <TouchableOpacity
                                    style={styles.playCircle}
                                    activeOpacity={0.8}
                                    onPress={toggleAdPlayPause}
                                >
                                    {!isAdPlaying
                                        ? renderIcon('play.svg', '>', { width: 32, height: 32 }, '#300C0A')
                                        : renderIcon('pause.svg', '||', { width: 32, height: 32 }, '#300C0A')
                                    }
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                {renderIcon('previous-1.svg', 'Rep', { width: 24, height: 24 }, '#F5D8CB')}
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footer}>
                            <TouchableOpacity onPress={() => openModal('queue')}>
                                <Text style={styles.footerTab}>Queue</Text>
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <Text style={[styles.footerTab, styles.stubText]}>Lyrics</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => openModal('related')}>
                                <Text style={styles.footerTab}>Related</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>

                {/* HEADER */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        {renderIcon('arrow-left.svg', 'Back', { width: 24, height: 24 }, '#F5D8CB')}
                    </TouchableOpacity>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.headerActionButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            onPress={() => handleItemLikeToggle(currentTrack)}
                        >
                            {likedTrackIds.includes(currentTrack.id || currentTrack._id)
                                ? renderIcon('added.svg', 'Lik', { width: 24, height: 24 }, '#F5D8CB')
                                : renderIcon('add.svg', 'Lik', { width: 24, height: 24 }, '#F5D8CB')
                            }
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.headerActionButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                            onPress={() => openModal('menu')}
                        >
                            {renderIcon('more.svg', '•••', { width: 24, height: 24 }, '#F5D8CB')}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ALBUM COVER (CENTER) */}
                <View style={styles.albumCoverPlaceholder}>
                    {/* 1. Шар Вінілу (Фон) */}
                    <View style={styles.mainVinylLayer}>
                        {renderIcon(
                            'vinyl.svg',
                            'No Vinyl',
                            { width: SCREEN_WIDTH * 0.8, height: SCREEN_WIDTH * 0.8 }, // Передаємо тільки розміри
                            null
                        )}
                    </View>

                    {/* 2. Шар Обкладинки (Центр) */}
                    {coverUrl ? (
                        <Image
                            source={{ uri: coverUrl, cache: 'force-cache' }}
                            style={styles.albumCoverImage}
                        />
                    ) : null}
                </View>

                {/* TITLE & ARTIST */}
                <View style={styles.textBlock}>
                    <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                        {trackTitle}
                    </Text>
                    <Text style={styles.artist}>{trackArtist}</Text>
                </View>

                {/* PROGRESS BAR */}
                <View style={[styles.progressBarWrapper, styles.playerProgressBarWrapper]}>
                    <View
                        style={styles.playerProgressTrackWrap}
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
                            style={[styles.adProgressKnobContainer, { left: `${progressPercent}%` }]}
                            pointerEvents="none"
                        >
                            <View style={styles.adProgressKnobVisual} />
                        </View>
                    </View>
                    <View style={styles.playerProgressTimeRow}>
                        <Text style={styles.playerTimeText}>{formatTime(position)}</Text>
                        <Text style={styles.playerTimeText}>{formatTime(duration)}</Text>
                    </View>
                </View>

                {/* CONTROLS */}
                <View style={styles.controlsSection}>
                    {/* Shuffle Button (Ліва кнопка) */}
                    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {renderIcon('shuffle.svg', 'Mix', { width: 24, height: 24 }, '#FF4D4F')}
                    </TouchableOpacity>

                    {/* CAPSULE CONTROLS with LIQUID GLASS (Центральна пігулка) */}
                    <View style={styles.mainControlsWrapper}>
                        {/* Зовнішній градієнт, що імітує світло (Light -45°) */}
                        <LinearGradient
                            colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                            locations={[0, 0.2, 1]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={{
                                width: '100%',
                                height: 60,
                                borderRadius: 30,
                                padding: 1.5,
                            }}
                        >
                            <BlurView
                                intensity={15}
                                tint="light"
                                style={styles.controlsCapsule}
                            >
                                {/* Кольоровий шар (Sandwich method) */}
                                <View style={[
                                    StyleSheet.absoluteFill,
                                    { backgroundColor: 'rgba(48, 12, 10, 0.1)' }
                                ]} />

                                {/* Вміст пігулки (Кнопки Prev/Next) */}
                                <View style={styles.controlsContent}>
                                    <TouchableOpacity onPress={playPrev} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                        {renderIcon('previous.svg', 'Prev', { width: 28, height: 28 }, '#F5D8CB')}
                                    </TouchableOpacity>

                                    {/* Пусте місце по центру для кнопки Play */}
                                    <View style={{ width: 60 }} />

                                    <TouchableOpacity onPress={playNext} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                        {renderIcon('next.svg', 'Next', { width: 28, height: 28 }, '#F5D8CB')}
                                    </TouchableOpacity>
                                </View>
                            </BlurView>
                        </LinearGradient>

                        {/* PLAY BUTTON (Лежить поверх пігулки) */}
                        <TouchableOpacity
                            style={styles.playCircle}
                            activeOpacity={0.8}
                            onPress={togglePlay}
                        >
                            {isPlaying
                                ? renderIcon('pause.svg', '||', { width: 32, height: 32 }, '#300C0A')
                                : renderIcon('play.svg', '>', { width: 32, height: 32 }, '#300C0A')
                            }
                        </TouchableOpacity>
                    </View>

                    {/* Repeat Button (Права кнопка) */}
                    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {renderIcon('previous-1.svg', 'Rep', { width: 24, height: 24 }, '#F5D8CB')}
                    </TouchableOpacity>
                </View>

                {/* FOOTER */}
                <View style={styles.footer}>
                    <TouchableOpacity onPress={() => openModal('queue')}>
                        <Text style={styles.footerTab}>Queue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                        <Text style={[styles.footerTab, styles.stubText]}>Lyrics</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => openModal('related')}>
                        <Text style={styles.footerTab}>Related</Text>
                    </TouchableOpacity>
                </View>
                    </>
                )}
            </View>

            {/* --- NOTIFICATION PILL --- */}
            <Animated.View style={[styles.notificationPill, { transform: [{ translateY: notifAnim }] }]}>
                <Text style={styles.notificationText}>
                    {notification?.message}
                </Text>

                {/* Якщо є кнопка дії (View) */}
                {notification?.actionLabel && (
                    <TouchableOpacity onPress={notification.action}>
                        <Text style={styles.notificationAction}>
                            {notification.actionLabel}
                        </Text>
                    </TouchableOpacity>
                )}
            </Animated.View>

            {/* --- MENU MODAL (Новий стиль) --- */}
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
                                    { height: SCREEN_HEIGHT * 0.7,
                                        transform: [{ translateY: slideAnim }] }
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

                                        {/* ВМІСТ МЕНЮ */}
                                        <View style={styles.modalInnerContent}>
                                            <View style={styles.modalIndicator} />

                                            <View style={styles.modalTopActions}>
                                                <TouchableOpacity onPress={handleDownload}>
                                                    <TopAction label="Download" iconName="download.svg" />
                                                </TouchableOpacity>

                                                <TouchableOpacity onPress={() => console.log('Share')}>
                                                    <TopAction label="Share" iconName="share.svg" isStub />
                                                </TouchableOpacity>

                                                <TouchableOpacity onPress={handlePlayNext}>
                                                    <TopAction label="Play next" iconName="play next.svg" />
                                                </TouchableOpacity>
                                            </View>

                                            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                                                <MenuItem
                                                    label="Add to another playlist"
                                                    iconName="add to another playlist.svg"
                                                    onPress={handleAddToPlaylist}
                                                    isStub
                                                />
                                                <MenuItem
                                                    label="Add to queue"
                                                    iconName="add to queue.svg"
                                                    onPress={handleAddToQueue}
                                                />
                                                <MenuItem
                                                    label="Cancel queue"
                                                    iconName="cancel queue.svg"
                                                    onPress={handleClearQueue}
                                                />
                                                <MenuItem
                                                    label="View album"
                                                    iconName="album.svg"
                                                    onPress={handleViewAlbum}
                                                />
                                                <MenuItem
                                                    label="View song information"
                                                    iconName="song information.svg"
                                                    onPress={handleViewInfo}
                                                />
                                                <MenuItem
                                                    label="View the artist"
                                                    iconName="artist.svg"
                                                    onPress={handleViewArtist}
                                                />
                                                <MenuItem
                                                    label="Go to radio based on song"
                                                    iconName="radio.svg"
                                                    onPress={handleStartRadio}
                                                />
                                            </ScrollView>
                                        </View>
                                    </BlurView>
                                </LinearGradient>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* --- QUEUE MODAL --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={queueVisible}
                onRequestClose={closeModal}
            >
                <TouchableWithoutFeedback onPress={closeModal}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    styles.modalSheetWrapper,
                                    {
                                        height: SCREEN_HEIGHT * 0.7,
                                        transform: [{ translateY: slideAnim }]
                                    }
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

                                        {/* ВМІСТ ЧЕРГИ (ВИПРАВЛЕНО) */}
                                        <View style={styles.queueInnerContent}>
                                            <View style={[styles.modalIndicator, { alignSelf: 'center', marginTop: 10 }]} />
                                            <View style={styles.queueHeader}>
                                                <Text style={styles.queueHeaderTitle}>Queue</Text>
                                            </View>

                                            {/* 👇 ОНОВЛЕНИЙ FLATLIST БЕЗ ПОМИЛОК */}
                                            <FlatList
                                                data={visibleQueue}
                                                keyExtractor={(item, idx) => `${item.id || item._id || 'track'}-${idx}`}

                                                renderItem={({ item, index }) => (
                                                    <View>
                                                        <QueueItem
                                                            item={item}
                                                            currentTrack={currentTrack}
                                                            isPlaying={isPlaying}
                                                            playFromQueue={(track) => {
                                                                const trackId = track.id || track._id;
                                                                const i = queue.findIndex((t) => (t.id || t._id) === trackId);
                                                                if (i !== -1) setQueue(queue, i);
                                                            }}
                                                            handlePlayPause={togglePlay}
                                                            renderIcon={renderIcon}

                                                            // 👇 НОВІ ПРОПСИ
                                                            isLiked={likedTrackIds.includes(item.id || item._id)}
                                                            onLike={handleItemLikeToggle}
                                                        />
                                                        <View style={styles.queueSeparator} />
                                                    </View>
                                                )}
                                                contentContainerStyle={{ paddingBottom: 40 }}
                                                showsVerticalScrollIndicator={false}
                                                initialNumToRender={10}
                                                maxToRenderPerBatch={10}
                                                windowSize={5}
                                                removeClippedSubviews={true}
                                                // 👇 Правильний спосіб показати текст, якщо пусто
                                                ListEmptyComponent={
                                                    <Text style={styles.emptyQueueText}>No tracks in queue</Text>
                                                }
                                            />
                                        </View>
                                    </BlurView>
                                </LinearGradient>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
            {/* --- RELATED MODAL (NEW) --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={relatedVisible}
                onRequestClose={closeModal}
            >
                <TouchableWithoutFeedback onPress={closeModal}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    styles.modalSheetWrapper,
                                    {
                                        height: SCREEN_HEIGHT * 0.7, // Висота як у Queue
                                        transform: [{ translateY: slideAnim }]
                                    }
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

                                        {/* ВМІСТ RELATED */}
                                        <View style={styles.queueInnerContent}>
                                            <View style={[styles.modalIndicator, { alignSelf: 'center', marginTop: 10 }]} />

                                            <View style={styles.queueHeader}>
                                                <Text style={styles.queueHeaderTitle}>Related</Text>
                                            </View>

                                            <ScrollView
                                                style={{ width: '100%' }}
                                                showsVerticalScrollIndicator={false}
                                                contentContainerStyle={{ paddingBottom: 40 }}
                                            >
                                                <Text style={styles.sectionTitle}>You may also like</Text>
                                                <View>
                                                    {recommendations.slice(0, 3).map((item, index) => (
                                                        <View key={`${item.id}-${index}`}>
                                                            <QueueItem
                                                                item={item}
                                                                currentTrack={currentTrack}
                                                                isPlaying={false}
                                                                playFromQueue={handleRecommendationPlay}
                                                                handlePlayPause={() => handleRecommendationPlay(item)}
                                                                renderIcon={renderIcon}
                                                                hidePlayButton={true}

                                                                // 👇 НОВІ ПРОПСИ
                                                                isLiked={likedTrackIds.includes(item.id)}
                                                                onLike={handleItemLikeToggle}
                                                            />
                                                            {index < 2 && <View style={styles.queueSeparator} />}
                                                        </View>
                                                    ))}
                                                </View>

                                                {/* SECTION 2: Related artists */}
                                                <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Related artists</Text>
                                                <View style={styles.artistsRow}>
                                                    {relatedArtists.map((artist, index) => (
                                                        <TouchableOpacity
                                                            key={artist.id || index}
                                                            style={styles.artistItem}
                                                            onPress={() => {
                                                                closeModal();
                                                                navigation.navigate('ArtistProfile', { artist });
                                                            }}
                                                        >
                                                            <Image
                                                                source={{ uri: getAvatar(artist.id) }}
                                                                style={styles.artistAvatar}
                                                            />
                                                            <Text style={styles.artistName} numberOfLines={1}>
                                                                {artist.name}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </ScrollView>
                                        </View>
                                    </BlurView>
                                </LinearGradient>
                            </Animated.View>
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
        backgroundColor: '#160607',
    },

    fixedBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: SCREEN_WIDTH,   // Жорстко прив'язуємо до розміру екрану
        height: SCREEN_HEIGHT, // Жорстко прив'язуємо до розміру екрану
        resizeMode: 'cover',   // Розтягуємо зі збереженням пропорцій
        zIndex: 0,
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        width: '100%',
        height: 50,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 'auto',
    },
    headerActionButton: {
        width: 24,
        height: 24,
        marginLeft: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F5D8CB',
    },
    /* --- ГОЛОВНИЙ ВІНІЛ (ВИПРАВЛЕНО) --- */

    // Головний контейнер (квадрат по центру екрану)
    albumCoverPlaceholder: {
        width: SCREEN_WIDTH * 0.8,
        height: SCREEN_WIDTH * 0.8,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Обгортка для SVG вінілу (змушуємо його бути фоном)
    mainVinylLayer: {
        position: 'absolute', // Абсолют
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 1, // Нижній шар
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Обкладинка (Яблуко по центру)
    albumCoverImage: {
        width: '55%',
        height: '55%',
        borderRadius: 1000, // Кругла
        zIndex: 2,          // Верхній шар (щоб лежала НА вінілі)
        // position: 'absolute' тут не потрібен, бо Flexbox батька вже тримає її в центрі
    },
    textBlock: {
        alignItems: 'center',
        paddingHorizontal: 30,
        width: '100%',
        height: 60,
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        width: '100%',
        textAlign: 'center',
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
    playerProgressBarWrapper: {
        width: '92%',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
    },
    playerProgressTrackWrap: {
        width: '100%',
        height: 18,
        justifyContent: 'center',
        position: 'relative',
    },
    playerProgressTimeRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    playerTimeText: {
        fontSize: 12,
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        lineHeight: 16,
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

    /* --- AD PLAYER MODE --- */
    adPlayerContent: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 0,
    },
    adHeroCard: {
        width: SCREEN_WIDTH - 32,
        height: SCREEN_WIDTH - 32,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: 'rgba(48, 12, 10, 0.45)',
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.35)',
        marginTop: 0,
    },
    adTitleWrap: {
        alignItems: 'center',
        marginTop: 0,
        marginBottom: 0,
    },
    adProgressBarWrapper: {
        width: '92%',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        marginBottom: 0,
    },
    adProgressTrackWrap: {
        width: '100%',
        height: 18,
        justifyContent: 'center',
        position: 'relative',
    },
    adProgressKnobContainer: {
        position: 'absolute',
        width: 18,
        height: 18,
        marginLeft: -9,
        justifyContent: 'center',
        alignItems: 'center',
        top: 0,
    },
    adProgressKnobVisual: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#300C0A',
    },
    adProgressTimeRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,
    },
    adTimeText: {
        fontSize: 12,
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        lineHeight: 16,
    },
    adControlsSection: {
        marginTop: 0,
    },
    adNowPlayingTitle: {
        fontSize: 24,
        lineHeight: 30,
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
    },
    adNowPlayingArtist: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
        opacity: 0.9,
        marginTop: 11,
    },
    adImageWrap: {
        width: '100%',
        height: '100%',
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: '#3A1A18',
        marginBottom: 0,
    },
    adImage: {
        width: '100%',
        height: '100%',
    },
    adLoadingWrap: {
        width: '100%',
        height: '100%',
        borderRadius: 0,
        backgroundColor: '#3A1A18',
        marginBottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    adNoContentText: {
        fontSize: 14,
        fontFamily: 'Poppins-Regular',
        color: 'rgba(245,216,203,0.8)',
    },

    /* --- MODAL COMMON --- */
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)', // Затемнення фону (Fade)
        justifyContent: 'flex-end',
    },
    modalSheetWrapper: {
        width: '100%',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    modalBorderGradient: {
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        paddingTop: 1.5,
        paddingHorizontal: 1.5,
        paddingBottom: 0,
        flex: 1, // Важливо, щоб градієнт розтягувався
    },
    modalGlassContainer: {
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        overflow: 'hidden',
        width: '100%',
        flex: 1, // Важливо для контенту
    },
    modalScroll: {
        width: '100%',
    },

    /* --- MENU MODAL --- */
    modalInnerContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        alignItems: 'center',
        paddingBottom: 40, // Відступ знизу
    },
    modalIndicator: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(245, 216, 203, 0.2)',
        borderRadius: 2,
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
        width: '100%',
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
    stubText: {
        color: '#FF4D4F',
    },
    stubOutline: {
        borderColor: '#FF4D4F',
    },

    /* --- QUEUE MODAL --- */
    queueInnerContent: {
        flex: 1,
        paddingHorizontal: 25,
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
        backgroundColor: '#DFDFDF',
        width: '100%',
    },

    /* --- RELATED MODAL STYLES --- */
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        marginBottom: 12,
        marginTop: 10,
    },
    artistsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    artistItem: {
        alignItems: 'center',
        width: '23%', // 4 елементи в ряд
    },
    artistAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40, // Круглі
        backgroundColor: '#2A1414',
        marginBottom: 8,
    },
    artistName: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
        textAlign: 'center',
    },

    /* Вінілова іконка */
    vinylContainer: {
        width: 58,
        height: 58,
        justifyContent: 'center', // Центрує вміст по вертикалі
        alignItems: 'center',     // Центрує вміст по горизонталі
        // position: 'relative',  // Можна залишити, але для flexbox це не обов'язково
    },
    innerCover: {
        width: 25.18,
        height: 25.18,
        borderRadius: 14,
        // ❌ position: 'absolute' <-- ПРИБИРАЄМО ЦЕ!
        // Нехай обкладинка стоїть у центрі "чесним" способом через Flexbox батька.
        zIndex: 2,
    },
    // 👇 ЦЬОГО СТИЛЮ НЕ ВИСТАЧАЛО
    vinylOverlayWrapper: {
        position: 'absolute', // Абсолютно поверх обкладинки
        top: 0,
        left: 0,
        width: '100%',  // 🔥 ПОВЕРТАЄМО РОЗМІРИ, щоб блок зайняв весь квадрат 58x58
        height: '100%', // 🔥 ПОВЕРТАЄМО РОЗМІРИ
        justifyContent: 'center', // Центруємо саму іконку вінілу (50px) всередині цього блоку (58px)
        alignItems: 'center',
        zIndex: 0,
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
    /* --- NOTIFICATION STYLES --- */
    /* --- NOTIFICATION STYLES (ОНОВЛЕНО) --- */
    notificationPill: {
        position: 'absolute',
        // 👇 ЗМІНЕНО: Замість top використовуємо bottom
        bottom: Platform.OS === 'ios' ? 50 : 30, // Відступ від низу
        alignSelf: 'center',
        width: '90%',
        backgroundColor: '#F5D8CB',
        borderRadius: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        zIndex: 9999,
        // Тінь
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 10,
    },
    notificationText: {
        fontSize: 12,
        fontFamily: 'Poppins-Regular',
        color: '#300C0A',
        flex: 1,
    },
    notificationAction: {
        fontSize: 12,
        fontFamily: 'Poppins-SemiBold',
        color: '#300C0A',
        marginLeft: 10,
    },
})
