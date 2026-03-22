import React, { useEffect, useMemo, useState } from 'react';
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

import {
    getAllPodcasts,
    getIcons,
    getPodcastCoverUrl,
    getPodcastGenres,
    isPodcastLiked,
    likePodcast,
    scale,
    unlikePodcast,
} from '../../api/api';

const { width, height } = Dimensions.get('window');

const ITEM_WIDTH = (width - scale(40) - scale(20)) / 3;
let choosePodcastSessionCache = null;

const svgCache = {};

const ColoredSvg = ({ uri, width: iconWidth, height: iconHeight, color }) => {
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
                .then((response) => response.text())
                .then((svgContent) => {
                    if (!isMounted) return;

                    let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');
                    if (color) {
                        cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
                        cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
                    }
                    cleanXml = cleanXml.replace(/###NONE###/g, 'fill="none"');
                    svgCache[cacheKey] = cleanXml;
                    setXml(cleanXml);
                })
                .catch(() => {});
        }

        return () => {
            isMounted = false;
        };
    }, [cacheKey, color, uri]);

    if (!xml) return <View style={{ width: iconWidth, height: iconHeight }} />;
    return <SvgXml xml={xml} width={iconWidth} height={iconHeight} />;
};

const normalizeGenre = (genre) => {
    const id = String(genre?.id ?? genre?.genreId ?? genre?.value ?? genre ?? '').trim();
    const name = String(genre?.name ?? genre?.title ?? genre?.genreName ?? genre ?? '').trim();

    if (!name) return null;

    return {
        id: id || name.toLowerCase(),
        name,
        key: name.toLowerCase(),
    };
};

const normalizePodcast = (item) => {
    const id = String(item?.id ?? item?._id ?? item?.podcastId ?? '').trim();
    if (!id) return null;

    const title = String(item?.title ?? item?.name ?? 'Untitled podcast').trim() || 'Untitled podcast';
    const author = String(item?.author ?? item?.artistName ?? item?.ownerName ?? 'Unknown').trim() || 'Unknown';
    const genres = Array.isArray(item?.genres)
        ? item.genres
            .map((g) => String(g?.name ?? g?.title ?? g ?? '').trim())
            .filter(Boolean)
        : [];

    return {
        id,
        title,
        author,
        coverUrl: getPodcastCoverUrl(item),
        status: String(item?.status ?? '').toLowerCase(),
        genreNames: genres,
        genreKeys: new Set(genres.map((g) => g.toLowerCase())),
    };
};

const chunkByTwo = (arr) => {
    const rows = [];
    for (let i = 0; i < arr.length; i += 2) {
        rows.push(arr.slice(i, i + 2));
    }
    return rows;
};

const buildRowsByGenre = (podcasts, genres) => {
    const filtered = podcasts;

    const usedIds = new Set();
    const rows = [];

    genres.forEach((genre) => {
        const allForGenre = filtered.filter((podcast) => podcast.genreKeys.has(genre.key));
        const available = allForGenre.filter((podcast) => !usedIds.has(podcast.id));

        if (!available.length) return;

        const visible = available.slice(0, 2);
        visible.forEach((podcast) => usedIds.add(podcast.id));

        rows.push({
            id: `genre-${genre.id}`,
            genreName: genre.name,
            podcasts: visible,
            moreCount: Math.max(0, allForGenre.length - visible.length),
        });
    });

    const leftovers = filtered.filter((podcast) => !usedIds.has(podcast.id));
    chunkByTwo(leftovers).forEach((pair, index) => {
        rows.push({
            id: `leftover-${index}`,
            genreName: 'More',
            podcasts: pair,
            moreCount: Math.max(0, leftovers.length - pair.length),
        });
    });

    return rows;
};

export default function ChoosePodcastScreen({ navigation }) {
    const [icons, setIcons] = useState(() => choosePodcastSessionCache?.icons || {});

    const [allPodcasts, setAllPodcasts] = useState(() => choosePodcastSessionCache?.allPodcasts || []);
    const [allGenres, setAllGenres] = useState(() => choosePodcastSessionCache?.allGenres || []);

    const [selectedPodcasts, setSelectedPodcasts] = useState(() => choosePodcastSessionCache?.selectedPodcasts || []);
    const [initialLikedPodcasts, setInitialLikedPodcasts] = useState(() => choosePodcastSessionCache?.initialLikedPodcasts || []);

    const [loading, setLoading] = useState(!choosePodcastSessionCache);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData({ force: false });
    }, []);

    const rows = useMemo(
        () => buildRowsByGenre(allPodcasts, allGenres),
        [allPodcasts, allGenres]
    );

    const loadData = async ({ force = false } = {}) => {
        if (!force && choosePodcastSessionCache) {
            setIcons(choosePodcastSessionCache.icons || {});
            setAllPodcasts(choosePodcastSessionCache.allPodcasts || []);
            setAllGenres(choosePodcastSessionCache.allGenres || []);
            setSelectedPodcasts(choosePodcastSessionCache.selectedPodcasts || []);
            setInitialLikedPodcasts(choosePodcastSessionCache.initialLikedPodcasts || []);
            setLoading(false);
            return;
        }

        setLoading(true);

        try {
            const [loadedIcons, podcastsRaw, genresRaw] = await Promise.all([
                getIcons(),
                getAllPodcasts(),
                getPodcastGenres(),
            ]);

            const normalizedGenres = (Array.isArray(genresRaw) ? genresRaw : [])
                .map(normalizeGenre)
                .filter(Boolean);

            const normalizedPodcasts = (Array.isArray(podcastsRaw) ? podcastsRaw : [])
                .map(normalizePodcast)
                .filter(Boolean)
                .filter((podcast) => !podcast.status || podcast.status === 'approved');

            const genreSortedPodcasts = [...normalizedPodcasts].sort((a, b) =>
                a.title.localeCompare(b.title)
            );

            setIcons(loadedIcons || {});
            setAllGenres(normalizedGenres);
            setAllPodcasts(genreSortedPodcasts);

            if (genreSortedPodcasts.length) {
                const likedChecks = await Promise.all(
                    genreSortedPodcasts.map(async (podcast) => ({
                        id: podcast.id,
                        liked: await isPodcastLiked(podcast.id),
                    }))
                );

                const likedIds = likedChecks
                    .filter((item) => item.liked)
                    .map((item) => item.id);

                setSelectedPodcasts(likedIds);
                setInitialLikedPodcasts(likedIds);
                choosePodcastSessionCache = {
                    icons: loadedIcons || {},
                    allGenres: normalizedGenres,
                    allPodcasts: genreSortedPodcasts,
                    selectedPodcasts: likedIds,
                    initialLikedPodcasts: likedIds,
                };
            } else {
                setSelectedPodcasts([]);
                setInitialLikedPodcasts([]);
                choosePodcastSessionCache = {
                    icons: loadedIcons || {},
                    allGenres: normalizedGenres,
                    allPodcasts: genreSortedPodcasts,
                    selectedPodcasts: [],
                    initialLikedPodcasts: [],
                };
            }
        } catch (_) {
            setAllGenres([]);
            setAllPodcasts([]);
            choosePodcastSessionCache = {
                icons: {},
                allGenres: [],
                allPodcasts: [],
                selectedPodcasts: [],
                initialLikedPodcasts: [],
            };
        } finally {
            setLoading(false);
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
            if (tintColor) imageStyle.push({ tintColor });

            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }

        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    const togglePodcastSelection = (id) => {
        setSelectedPodcasts((prev) => {
            if (prev.includes(id)) {
                return prev.filter((item) => item !== id);
            }
            return [...prev, id];
        });
    };

    const handleConfirm = async () => {
        if (saving) return;

        const initialSet = new Set(initialLikedPodcasts);
        const selectedSet = new Set(selectedPodcasts);

        const toLike = selectedPodcasts.filter((id) => !initialSet.has(id));
        const toUnlike = initialLikedPodcasts.filter((id) => !selectedSet.has(id));

        if (!toLike.length && !toUnlike.length) {
            navigation.goBack();
            return;
        }

        setSaving(true);

        const results = await Promise.all([
            ...toLike.map((id) => likePodcast(id)),
            ...toUnlike.map((id) => unlikePodcast(id)),
        ]);

        setSaving(false);

        const hasError = results.some((res) => Boolean(res?.error));

        if (hasError) {
            Alert.alert('Error', 'Failed to update some podcasts. Please try again.');
            return;
        }

        setInitialLikedPodcasts(selectedPodcasts);
        choosePodcastSessionCache = {
            ...(choosePodcastSessionCache || {}),
            icons,
            allGenres,
            allPodcasts,
            selectedPodcasts: [...selectedPodcasts],
            initialLikedPodcasts: [...selectedPodcasts],
        };
        navigation.goBack();
    };

    const renderPodcastCard = (podcast) => {
        const isSelected = selectedPodcasts.includes(podcast.id);

        return (
            <TouchableOpacity
                key={podcast.id}
                style={styles.cardContainer}
                activeOpacity={0.85}
                onPress={() => togglePodcastSelection(podcast.id)}
            >
                <View style={[styles.imageWrapper, isSelected && { zIndex: 10 }]}>
                    {podcast.coverUrl ? (
                        <Image source={{ uri: podcast.coverUrl }} style={styles.imageSquare} />
                    ) : (
                        <View style={styles.imageSquare} />
                    )}

                    {isSelected && (
                        <LinearGradient
                            colors={['transparent', 'rgba(48, 12, 10, 0.82)']}
                            style={styles.selectedOverlay}
                        />
                    )}

                    {isSelected && (
                        <View style={styles.checkBadge}>
                            {renderIcon('check.svg', { width: scale(16), height: scale(16) }, '#000')}
                        </View>
                    )}
                </View>
                <Text style={styles.title} numberOfLines={1}>{podcast.title}</Text>
            </TouchableOpacity>
        );
    };

    const renderGenreCard = (row) => {
        const moreLabel = row.moreCount > 0 ? `:${'\n'}more` : '';

        return (
            <TouchableOpacity key={`${row.id}-genre`} style={styles.cardContainer} activeOpacity={0.85} onPress={() => {}}>
                <View style={[styles.imageSquare, styles.moreCard]}>
                    <Text style={styles.moreText}>{`${row.genreName}${moreLabel}`}</Text>
                </View>
                <Text style={styles.hiddenTitle}> </Text>
            </TouchableOpacity>
        );
    };

    const isConfirmDisabled = saving || (!selectedPodcasts.length && !initialLikedPodcasts.length);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>Choose podcast{'\n'}or show</Text>
                    </View>

                    {loading ? (
                        <View style={styles.loaderWrap}>
                            <ActivityIndicator size="large" color="#F5D8CB" />
                        </View>
                    ) : (
                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                            contentContainerStyle={{ paddingTop: scale(15), paddingBottom: scale(120) }}
                        >
                            <View style={styles.gridContainer}>
                                {rows.map((row) => {
                                    const cards = row.podcasts.slice(0, 2);

                                    return (
                                        <View key={row.id} style={styles.rowContainer}>
                                            {cards.map((podcast) => (
                                                renderPodcastCard(podcast)
                                            ))}
                                            {renderGenreCard(row)}
                                        </View>
                                    );
                                })}

                                {!rows.length && (
                                    <Text style={styles.emptyText}>No podcasts found</Text>
                                )}
                            </View>
                        </ScrollView>
                    )}

                    <View style={styles.bottomButtonContainer}>
                        <TouchableOpacity
                            style={[styles.confirmButton, isConfirmDisabled && { opacity: 0.7 }]}
                            activeOpacity={0.9}
                            disabled={isConfirmDisabled}
                            onPress={handleConfirm}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#300C0A" />
                            ) : (
                                <Text style={styles.confirmButtonText}>Confirm</Text>
                            )}
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

    header: {
        paddingHorizontal: scale(20),
        marginTop: scale(10),
        marginBottom: scale(20),
    },
    backButton: {
        width: scale(30),
        marginBottom: scale(15),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontSize: scale(32),
        fontFamily: 'Unbounded-SemiBold',
        lineHeight: scale(38),
    },

    loaderWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    gridContainer: {
        paddingHorizontal: scale(20),
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: scale(10),
        marginBottom: scale(20),
    },

    cardContainer: {
        width: ITEM_WIDTH,
    },
    imageWrapper: {
        position: 'relative',
        marginBottom: scale(8),
        overflow: 'visible',
    },
    imageSquare: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH,
        borderRadius: scale(24),
        backgroundColor: '#2A1311',
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

    selectedOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
        borderBottomLeftRadius: scale(24),
        borderBottomRightRadius: scale(24),
    },

    moreCard: {
        backgroundColor: 'rgba(48, 12, 10, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(245, 216, 203, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(10),
    },
    moreText: {
        color: '#F5D8CB',
        fontSize: scale(11),
        fontFamily: 'Poppins-SemiBold',
        textAlign: 'center',
    },

    checkBadge: {
        position: 'absolute',
        top: scale(-3),
        right: scale(-3),
        width: scale(31),
        height: scale(31),
        borderRadius: scale(14),
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 120,
        elevation: 5,
    },

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
    },
    emptyText: {
        color: 'rgba(245, 216, 203, 0.8)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        textAlign: 'center',
        marginTop: scale(20),
    },
});
