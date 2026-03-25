import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Image,
    Dimensions,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    getAllArtists,
    getIcons,
    getSubscriptions,
    getUserAvatarUrl,
    scale,
    subscribeToArtist,
} from '../../api/api';

const { width, height } = Dimensions.get('window');

// Розраховуємо ширину так, щоб 3 колонки поміщалися ідеально
const ITEM_WIDTH = (width - scale(40) - scale(20)) / 3;
const CIRCLE_RADIUS = ITEM_WIDTH / 2; // Для ідеально круглих карток
let chooseArtistSessionCache = null;

// 1. КЕШ ТА РЕНДЕР SVG
const svgCache = {};

const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;
        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }
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
                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }
        return () => { isMounted = false; };
    }, [cacheKey]);

    if (!xml) return <View style={{ width, height }} />;
    return <SvgXml xml={xml} width={width} height={height} />;
};

export default function ChooseArtistScreen({ navigation }) {
    const isFocused = useIsFocused();
    const hasLoadedOnceRef = useRef(Boolean(chooseArtistSessionCache?.artistsData?.length));
    const [icons, setIcons] = useState(() => chooseArtistSessionCache?.icons || {});
    const [artistsData, setArtistsData] = useState(() => chooseArtistSessionCache?.artistsData || []);
    const [brokenImages, setBrokenImages] = useState({});
    const [loading, setLoading] = useState(!chooseArtistSessionCache?.artistsData?.length);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Стейт для зберігання ID вибраних артистів
    const [selectedArtists, setSelectedArtists] = useState([]);

    const ARTISTS_DATA = useMemo(
        () => [
            ...artistsData.slice(0, 11),
            { id: 'rec', title: 'Recommended for u', isRecommended: true },
        ],
        [artistsData]
    );

    // Функція для розбиття масиву на рядки по 3 елементи
    const chunkArray = (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    };

    const ARTISTS_ROWS = chunkArray(ARTISTS_DATA, 3);

    useEffect(() => {
        if (!isFocused) return;
        if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            loadArtistsData({ force: false, silent: false });
            return;
        }
        loadArtistsData({ force: true, silent: true });
    }, [isFocused]);

    const loadArtistsData = async ({ force = false, silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const userId = await AsyncStorage.getItem('userId');
            if (!force && chooseArtistSessionCache && chooseArtistSessionCache.userId === userId) {
                setIcons(chooseArtistSessionCache.icons || {});
                setArtistsData(chooseArtistSessionCache.artistsData || []);
                setBrokenImages({});
                if (!silent) setLoading(false);
                return;
            }

            const [loadedIcons, allArtistsRaw, subscriptionsRaw] = await Promise.all([
                getIcons(),
                getAllArtists({ force }),
                getSubscriptions({ force }),
            ]);
            setIcons(loadedIcons || {});

            const subscribedArtistIds = new Set(
                (Array.isArray(subscriptionsRaw) ? subscriptionsRaw : [])
                    .map((item) =>
                        String(
                            item?.artistId ||
                            item?.ArtistId ||
                            item?.id ||
                            item?._id ||
                            item?.artist?.id ||
                            ''
                        ).trim()
                    )
                    .filter(Boolean)
            );

            const normalizeArtist = (item, index) => {
                const id = String(
                    item?.artistId ||
                    item?.id ||
                    item?._id ||
                    item?.userId ||
                    item?.ownerId ||
                    ''
                ).trim();

                const name = String(
                    item?.artistName ||
                    item?.name ||
                    item?.username ||
                    item?.displayName ||
                    item?.artist?.name ||
                    ''
                ).trim();

                if (!id || !name) return null;

                const ownerId = String(
                    item?.ownerId ||
                    item?.userId ||
                    item?.artist?.ownerId ||
                    item?.artist?.userId ||
                    ''
                ).trim();

                const image =
                    item?.avatarUrl ||
                    item?.artistAvatarUrl ||
                    item?.imageUrl ||
                    item?.coverUrl ||
                    getUserAvatarUrl(ownerId || id);

                return {
                    id: `artist-${id}`,
                    artistId: id,
                    title: name,
                    image,
                    order: index,
                };
            };

            const allArtists = Array.isArray(allArtistsRaw) ? allArtistsRaw : [];
            const normalized = allArtists
                .map((item, index) => normalizeArtist(item, index))
                .filter(Boolean)
                .filter((artist) => !subscribedArtistIds.has(artist.artistId));

            const uniq = [];
            const used = new Set();
            normalized.forEach((artist) => {
                if (used.has(artist.id)) return;
                used.add(artist.id);
                uniq.push(artist);
            });

            const visible = uniq.slice(0, 11);

            setArtistsData(visible);
            setBrokenImages({});
            chooseArtistSessionCache = {
                userId,
                icons: loadedIcons || {},
                artistsData: visible,
            };
        } catch (e) {
            if (!silent) {
                hasLoadedOnceRef.current = false;
            }
            if (!chooseArtistSessionCache) {
                setArtistsData([]);
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const renderIcon = (iconName, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={flatStyle?.width || 24}
                        height={flatStyle?.height || 24}
                        color={tintColor}
                    />
                );
            }

            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor: tintColor });

            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }
        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    const toggleSelection = (id) => {
        if (isSubmitting) return;
        if (selectedArtists.includes(id)) {
            setSelectedArtists(selectedArtists.filter(item => item !== id));
        } else {
            setSelectedArtists([...selectedArtists, id]);
        }
    };

    const handleConfirm = async () => {
        if (isSubmitting || selectedArtists.length === 0) return;

        setIsSubmitting(true);
        try {
            const artistIds = Array.from(
                new Set(
                    selectedArtists
                        .map((value) => String(value || '').replace(/^artist-/, '').trim())
                        .filter(Boolean)
                )
            );

            if (artistIds.length === 0) {
                navigation.goBack();
                return;
            }

            const responses = await Promise.all(artistIds.map((id) => subscribeToArtist(id)));

            const successCount = responses.filter((item) => item?.success).length;
            const alreadyHandledCount = responses.filter((item) => {
                if (item?.success) return false;
                const text = String(item?.error || '').toLowerCase();
                return (
                    item?.status === 400 ||
                    item?.status === 409 ||
                    text.includes('already') ||
                    text.includes('exists') ||
                    text.includes('subscribed')
                );
            }).length;

            if (successCount + alreadyHandledCount > 0) {
                await getSubscriptions({ force: true });
                chooseArtistSessionCache = null;
                hasLoadedOnceRef.current = false;
                navigation.goBack();
                return;
            }

            Alert.alert('Error', 'Failed to subscribe to selected artists');
        } catch (_) {
            Alert.alert('Error', 'Failed to subscribe to selected artists');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderCard = (item) => {
        const isSelected = selectedArtists.includes(item.id);

        if (item.isRecommended) {
            // Кругла картка "Recommended for u"
            return (
                <TouchableOpacity
                    key={item.id}
                    style={styles.cardContainer}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('MainTabs', { screen: 'SearchTab' })}
                >
                    <View style={[styles.imageCircle, styles.moreCard]}>
                        <Text style={styles.moreText}>Recommended{"\n"}for u</Text>
                    </View>
                    <Text style={styles.hiddenTitle}> </Text>
                </TouchableOpacity>
            );
        }

        // Звичайна картка артиста
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() => toggleSelection(item.id)}
            >
                    <View style={[styles.imageWrapper, isSelected && { zIndex: 10 }]}>

                        {/* 👇 Огорнули картинку і градієнт в новий контейнер, щоб вони ідеально обрізались по колу */}
                        <View style={styles.circleContainer}>
                            {item.image && !brokenImages[item.id] ? (
                                <Image
                                    source={{ uri: item.image }}
                                    style={styles.imageCircle}
                                    onError={() => setBrokenImages((prev) => ({ ...prev, [item.id]: true }))}
                                />
                            ) : (
                                <View style={[styles.imageCircle, styles.imageFallback]}>
                                    <Text style={styles.imageFallbackText}>
                                        {(item.title || '?').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}

                        {isSelected && (
                            <LinearGradient
                                colors={['transparent', 'rgba(48, 12, 10, 0.8)']}
                                style={styles.selectedOverlay}
                            />
                        )}
                    </View>

                    {/* Галочка залишається ЗОВНІ */}
                    {isSelected && (
                        <View style={styles.checkBadge}>
                            {renderIcon('check.svg', { width: scale(16), height: scale(16) }, '#000')}
                        </View>
                    )}
                </View>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
        );

    };

    const isConfirmDisabled = selectedArtists.length === 0 || isSubmitting;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>

                    {/* HEADER */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        {/* Великий заголовок */}
                        <Text style={styles.headerTitle}>Choose more{"\n"}artists that you like</Text>
                    </View>

                    {/* GRID З АРТИСТАМИ */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        contentContainerStyle={{ paddingTop: scale(6), paddingBottom: scale(120) }}
                    >
                    <View style={styles.gridContainer}>
                            {loading ? (
                                <View style={styles.loaderWrap}>
                                    <ActivityIndicator size="small" color="#F5D8CB" />
                                </View>
                            ) : (
                                ARTISTS_ROWS.map((row, rowIndex) => (
                                    <View key={rowIndex} style={styles.rowContainer}>
                                        {row.map((item) => renderCard(item))}
                                    </View>
                                ))
                            )}
                    </View>
                </ScrollView>

                    {/* CONFIRM BUTTON */}
                    <View style={styles.bottomButtonContainer}>
                        <TouchableOpacity
                            style={[styles.confirmButton, isConfirmDisabled && { opacity: 0.5 }]}
                            activeOpacity={0.9}
                            disabled={isConfirmDisabled}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.confirmButtonText}>{isSubmitting ? 'Saving...' : 'Confirm'}</Text>
                        </TouchableOpacity>
                    </View>

                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    gradient: {
        flex: 1,
        minHeight: height,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(30) : 0,
    },

    // --- HEADER ---
    header: {
        paddingHorizontal: scale(20),
        marginTop: scale(10),
        marginBottom: scale(20),
    },
    backButton: {
        width: scale(30),
        marginBottom: scale(20),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontSize: scale(32), // Збільшили розмір
        fontFamily: 'Unbounded-SemiBold', // Зробили жирним
        lineHeight: scale(42),
    },

    // --- GRID ---
    gridContainer: {
        paddingHorizontal: scale(20),
    },
    loaderWrap: {
        width: '100%',
        minHeight: scale(140),
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: scale(10),
        marginBottom: scale(20),
    },

    // --- CARD ---
    cardContainer: {
        width: ITEM_WIDTH,
        alignItems: 'center',
    },
    imageWrapper: {
        position: 'relative',
        marginBottom: scale(8),
        width: ITEM_WIDTH,
        height: ITEM_WIDTH,
        overflow: 'visible',
    },
    circleContainer: {
        width: '100%',
        height: '100%',
        borderRadius: CIRCLE_RADIUS,
        overflow: 'hidden',
    },
    imageCircle: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH,
        borderRadius: CIRCLE_RADIUS,
        backgroundColor: '#333',
    },
    imageFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(30, 10, 8, 0.85)',
    },
    imageFallbackText: {
        color: '#F5D8CB',
        fontSize: scale(24),
        fontFamily: 'Unbounded-SemiBold',
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(11),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },
    hiddenTitle: {
        fontSize: scale(11),
        marginTop: scale(8),
    },

    // --- OVERLAY ---
    selectedOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80%',
    },

    // --- RECOMMENDED CARD ---
    moreCard: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(245, 216, 203, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(10),
    },
    moreText: {
        color: '#F5D8CB',
        fontSize: scale(10),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },

    // --- CHECK BADGE ---
    checkBadge: {
        position: 'absolute',
        top: scale(0),
        right: scale(0),
        width: scale(31),
        height: scale(31),
        borderRadius: scale(16),
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 120,
        elevation: 5,
    },

    // --- BOTTOM BUTTON ---
    bottomButtonContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? scale(30) : scale(20),
        left: scale(20),
        right: scale(20),
    },
    confirmButton: {
        backgroundColor: '#F5D8CB',
        height: scale(48),
        borderRadius: scale(28),
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#300C0A',
        fontSize: scale(18),
        fontFamily: 'Unbounded-Medium',
    }
});
