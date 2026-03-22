import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import MiniPlayer from '../../components/MiniPlayer';
import ShareSheetModal from '../../components/ShareSheetModal';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
    getPodcastById,
    getPodcastEpisodes,
    getPodcastCoverUrl,
    getPodcastAudioUrl,
    getPodcastEpisodeStreamUrl,
    likePodcast,
    unlikePodcast,
    isPodcastLiked,
    getIcons,
    getCachedIcons,
    getColoredSvgXml,
    peekColoredSvgXml,
    scale,
} from '../../api/api';
import { readPodcastProgressForPodcast } from '../../store/podcastProgressStorage';

const { height } = Dimensions.get('window');
const podcastDetailSessionCache = new Map();

const getEntityId = (item) =>
    String(item?.id || item?._id || item?.podcastId || item?.episodeId || '').trim();

const parseDurationToSeconds = (value) => {
    if (value === null || value === undefined) return 0;

    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
    }

    const str = String(value).trim();
    if (!str) return 0;

    if (/^\d+$/.test(str)) {
        return Math.max(0, parseInt(str, 10));
    }

    const parts = str.split(':').map((part) => parseInt(part, 10));
    if (parts.some((part) => Number.isNaN(part))) return 0;

    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }

    return 0;
};

const formatDuration = (value) => {
    const seconds = parseDurationToSeconds(value);
    if (seconds <= 0) return null;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${Math.max(1, minutes)} min`;
};

const formatDurationEnFromMs = (millis) => {
    const safeMs = Math.max(0, Number(millis) || 0);
    const totalSeconds = Math.floor(safeMs / 1000);
    if (totalSeconds <= 0) return null;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${Math.max(1, minutes)} min`;
};

const formatDate = (value) => {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    try {
        return new Intl.DateTimeFormat('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        }).format(date);
    } catch (_) {
        return null;
    }
};

const ColoredSvg = ({ uri, width, height, color }) => {
    const [xml, setXml] = useState(peekColoredSvgXml(uri, color));

    useEffect(() => {
        let isMounted = true;

        if (uri) {
            getColoredSvgXml(uri, color)
                .then((cachedXml) => {
                    if (isMounted) setXml(cachedXml);
                })
                .catch(() => {});
        } else {
            setXml(null);
        }

        return () => {
            isMounted = false;
        };
    }, [uri, color]);

    if (!xml) return <View style={{ width, height }} />;

    return <SvgXml xml={xml} width={width} height={height} />;
};

export default function PodcastDetailScreen({ route, navigation }) {
    const routePodcast = route?.params?.podcast || {};
    const podcastId =
        getEntityId(route?.params) ||
        getEntityId(routePodcast) ||
        String(route?.params?.id || route?.params?.podcastId || '').trim();

    const {
        currentTrack,
        isPlaying,
        position,
        duration,
        setQueue,
        togglePlay,
    } = usePlayerStore();

    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const [podcast, setPodcast] = useState(null);
    const [episodes, setEpisodes] = useState([]);
    const [progressByEpisodeId, setProgressByEpisodeId] = useState({});
    const [isLiked, setIsLiked] = useState(false);
    const [loading, setLoading] = useState(true);
    const [shareVisible, setShareVisible] = useState(false);
    const hasLoadedOnceRef = useRef(false);
    const cacheKey = String(podcastId || '').trim();

    const updateCache = useCallback((patch) => {
        if (!cacheKey) return;
        const prev = podcastDetailSessionCache.get(cacheKey) || {};
        podcastDetailSessionCache.set(cacheKey, { ...prev, ...patch });
    }, [cacheKey]);

    const loadProgressOnly = useCallback(async () => {
        if (!podcastId) {
            setProgressByEpisodeId({});
            return;
        }
        const progress = await readPodcastProgressForPodcast(podcastId);
        const nextProgress = progress || {};
        setProgressByEpisodeId(nextProgress);
        updateCache({ progressByEpisodeId: nextProgress });
    }, [podcastId, updateCache]);

    useEffect(() => {
        hasLoadedOnceRef.current = false;
        loadData({ force: false });
    }, [podcastId]);

    useFocusEffect(
        useCallback(() => {
            loadProgressOnly();
        }, [loadProgressOnly])
    );

    const hydrateFromCache = useCallback((cached) => {
        if (!cached) return false;
        setIcons(cached.icons || {});
        setPodcast(cached.podcast || null);
        setEpisodes(Array.isArray(cached.episodes) ? cached.episodes : []);
        setProgressByEpisodeId(cached.progressByEpisodeId || {});
        setIsLiked(Boolean(cached.isLiked));
        return true;
    }, []);

    const loadData = async ({ force = false } = {}) => {
        if (!podcastId) {
            setLoading(false);
            return;
        }

        if (!force) {
            const cached = podcastDetailSessionCache.get(cacheKey);
            if (hydrateFromCache(cached)) {
                hasLoadedOnceRef.current = true;
                setLoading(false);
                return;
            }
        }

        setLoading(true);

        try {
            const [iconsMap, podcastData, episodesData, liked, progressMap] = await Promise.all([
                Object.keys(icons).length ? Promise.resolve(icons) : getIcons(),
                getPodcastById(podcastId),
                getPodcastEpisodes(podcastId),
                isPodcastLiked(podcastId),
                readPodcastProgressForPodcast(podcastId),
            ]);

            setIcons(iconsMap || {});
            setPodcast(podcastData || null);
            setEpisodes(Array.isArray(episodesData) ? episodesData : []);
            setProgressByEpisodeId(progressMap || {});
            setIsLiked(Boolean(liked));
            updateCache({
                icons: iconsMap || {},
                podcast: podcastData || null,
                episodes: Array.isArray(episodesData) ? episodesData : [],
                progressByEpisodeId: progressMap || {},
                isLiked: Boolean(liked),
            });
            hasLoadedOnceRef.current = true;
        } catch (_) {
            setPodcast(null);
            setEpisodes([]);
            setProgressByEpisodeId({});
            setIsLiked(false);
            podcastDetailSessionCache.delete(cacheKey);
            hasLoadedOnceRef.current = false;
        } finally {
            setLoading(false);
        }
    };

    const findIconUrl = (iconName) => {
        if (!iconName) return null;

        const lowerMap = {};
        Object.keys(icons || {}).forEach((k) => {
            lowerMap[k.toLowerCase()] = icons[k];
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
            if (icons[candidate]) return icons[candidate];
            if (lowerMap[candidate]) return lowerMap[candidate];
        }

        return null;
    };

    const renderIcon = (iconName, style, tintColor = '#F5D8CB') => {
        const iconUrl = findIconUrl(iconName);
        const flat = StyleSheet.flatten(style) || {};
        const w = flat?.width || 24;
        const h = flat?.height || 24;

        if (!iconUrl) return <View style={{ width: w, height: h }} />;

        const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

        if (isSvg) {
            return <ColoredSvg uri={iconUrl} width={w} height={h} color={tintColor} />;
        }

        return (
            <Image
                source={{ uri: iconUrl }}
                style={[style, tintColor ? { tintColor } : null]}
                resizeMode="contain"
            />
        );
    };

    const authorName = useMemo(() => {
        const fromPodcast = String(
            podcast?.author || podcast?.artistName || routePodcast?.author || routePodcast?.artistName || ''
        ).trim();

        if (fromPodcast) return fromPodcast;

        const fromEpisode = String(
            episodes?.[0]?.author || episodes?.[0]?.artistName || episodes?.[0]?.ownerName || ''
        ).trim();

        return fromEpisode || 'Unknown';
    }, [podcast, routePodcast, episodes]);

    const coverUrl = useMemo(() => getPodcastCoverUrl(podcast || routePodcast), [podcast, routePodcast]);

    const normalizedEpisodes = useMemo(() => {
        const baseCover = coverUrl;
        const mainAudio = getPodcastAudioUrl(podcast || routePodcast);
        const normalizedPodcastTitle = String(podcast?.title || routePodcast?.title || 'Podcast').trim();

        const mainEpisode = mainAudio
            ? {
                id: `${podcastId}-main`,
                _id: `${podcastId}-main`,
                episodeId: `${podcastId}-main`,
                podcastId,
                isPodcast: true,
                skipHistory: true,
                title: String(podcast?.title || routePodcast?.title || 'Episode 1').trim(),
                episodeTitle: String(podcast?.title || routePodcast?.title || 'Episode 1').trim(),
                podcastTitle: normalizedPodcastTitle,
                artistName: authorName,
                coverUrl: baseCover,
                localUri: mainAudio,
                dateLabel: formatDate(podcast?.createdAt),
                durationLabel: formatDuration(podcast?.duration),
                rawDurationMs: parseDurationToSeconds(podcast?.duration) * 1000,
            }
            : null;

        if (Array.isArray(episodes) && episodes.length > 0) {
            const mapped = episodes
                .map((episode, index) => {
                    const episodeId = getEntityId(episode);
                    if (!episodeId) return null;
                    const streamUrl = getPodcastEpisodeStreamUrl(episodeId);
                    if (!streamUrl) return null;

                    const rawDurationMs =
                        parseDurationToSeconds(
                            episode?.duration || episode?.length || episode?.durationSeconds
                        ) * 1000;

                    return {
                        id: episodeId,
                        _id: episodeId,
                        episodeId,
                        podcastId,
                        isPodcast: true,
                        skipHistory: true,
                        title: String(episode?.title || `Episode ${mainEpisode ? index + 2 : index + 1}`).trim(),
                        episodeTitle: String(episode?.title || `Episode ${mainEpisode ? index + 2 : index + 1}`).trim(),
                        podcastTitle: normalizedPodcastTitle,
                        artistName: authorName,
                        coverUrl: baseCover,
                        localUri: streamUrl,
                        dateLabel: formatDate(episode?.createdAt || episode?.uploadedAt || podcast?.createdAt),
                        durationLabel: formatDuration(episode?.duration || episode?.length || episode?.durationSeconds),
                        rawDurationMs,
                    };
                })
                .filter(Boolean);

            const withMain = mainEpisode ? [mainEpisode, ...mapped] : mapped;
            return withMain.map((episode) => {
                const progress = progressByEpisodeId[String(episode.episodeId || '')];
                const savedPositionMs = Math.max(0, Number(progress?.positionMs) || 0);
                const savedDurationMs = Math.max(0, Number(progress?.durationMs) || 0);
                const baseDurationMs = Math.max(0, Number(episode.rawDurationMs) || 0);
                const effectiveDurationMs = savedDurationMs || baseDurationMs;
                const remainingMs = effectiveDurationMs > 0 ? Math.max(0, effectiveDurationMs - savedPositionMs) : 0;
                const hasProgress = effectiveDurationMs > 0 && savedPositionMs > 0 && remainingMs > 0;
                const shouldResume = savedPositionMs > 5000 && remainingMs > 5000;
                const progressRatio = hasProgress
                    ? Math.min(1, Math.max(0, savedPositionMs / effectiveDurationMs))
                    : 0;
                const totalDurationLabel =
                    formatDurationEnFromMs(effectiveDurationMs || baseDurationMs) ||
                    episode.durationLabel ||
                    null;

                return {
                    ...episode,
                    startPositionMs: shouldResume ? savedPositionMs : 0,
                    remainingLabel: hasProgress ? `Left ${formatDurationEnFromMs(remainingMs)}` : null,
                    totalDurationLabel,
                    progressRatio,
                };
            });
        }

        if (!mainEpisode) return [];

        const progress = progressByEpisodeId[String(mainEpisode.episodeId || '')];
        const savedPositionMs = Math.max(0, Number(progress?.positionMs) || 0);
        const savedDurationMs = Math.max(0, Number(progress?.durationMs) || 0);
        const baseDurationMs = Math.max(0, Number(mainEpisode.rawDurationMs) || 0);
        const effectiveDurationMs = savedDurationMs || baseDurationMs;
        const remainingMs = effectiveDurationMs > 0 ? Math.max(0, effectiveDurationMs - savedPositionMs) : 0;
        const hasProgress = effectiveDurationMs > 0 && savedPositionMs > 0 && remainingMs > 0;
        const shouldResume = savedPositionMs > 5000 && remainingMs > 5000;
        const progressRatio = hasProgress
            ? Math.min(1, Math.max(0, savedPositionMs / effectiveDurationMs))
            : 0;
        const totalDurationLabel =
            formatDurationEnFromMs(effectiveDurationMs || baseDurationMs) ||
            mainEpisode.durationLabel ||
            null;

        return [
            {
                ...mainEpisode,
                startPositionMs: shouldResume ? savedPositionMs : 0,
                remainingLabel: hasProgress ? `Left ${formatDurationEnFromMs(remainingMs)}` : null,
                totalDurationLabel,
                progressRatio,
            },
        ];
    }, [episodes, podcastId, podcast, routePodcast, authorName, coverUrl, progressByEpisodeId]);

    const isCurrentPodcastTrack =
        Boolean(currentTrack?.isPodcast) &&
        String(currentTrack?.podcastId || '') === String(podcastId || '');

    const handlePlayMain = async () => {
        if (!normalizedEpisodes.length) return;

        if (isCurrentPodcastTrack && isPlaying) {
            await togglePlay();
            return;
        }

        if (isCurrentPodcastTrack && !isPlaying) {
            await togglePlay();
            return;
        }

        await setQueue(normalizedEpisodes, 0);
    };

    const handlePlayEpisode = async (episodeIndex) => {
        if (episodeIndex < 0 || episodeIndex >= normalizedEpisodes.length) return;
        await setQueue(normalizedEpisodes, episodeIndex);
    };

    const handleShuffle = async () => {
        if (!normalizedEpisodes.length) return;

        const shuffled = [...normalizedEpisodes];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        await setQueue(shuffled, 0);
    };

    const handleLikeToggle = async () => {
        const prev = isLiked;
        const next = !prev;
        setIsLiked(next);
        updateCache({ isLiked: next });

        const result = prev ? await unlikePodcast(podcastId) : await likePodcast(podcastId);
        if (result?.error) {
            setIsLiked(prev);
            updateCache({ isLiked: prev });
        }
    };

    const openMore = () => {
        setShareVisible(true);
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#F5D8CB" />
            </View>
        );
    }

    if (!podcastId || (!podcast && normalizedEpisodes.length === 0)) {
        return (
            <View style={[styles.container, styles.center]}>
                <Text style={styles.notFoundText}>Podcast not found</Text>
            </View>
        );
    }

    const currentTrackId = String(currentTrack?.id || currentTrack?._id || '').trim();
    const podcastTitle = String(podcast?.title || routePodcast?.title || 'Podcast').trim();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
                bounces={false}
                overScrollMode="never"
            >
                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.gradient, { paddingBottom: scale(130) }]}
                >
                    <View style={styles.navBar}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.navBtn}
                            hitSlop={{ top: scale(20), bottom: scale(20), left: scale(20), right: scale(20) }}
                        >
                            {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        <View style={{ flex: 1 }} />

                        <TouchableOpacity
                            style={styles.navBtn}
                            onPress={openMore}
                            hitSlop={{ top: scale(20), bottom: scale(20), left: scale(20), right: scale(20) }}
                        >
                            {renderIcon('more.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerContent}>
                        <Text style={styles.topAuthorName}>{authorName}</Text>

                        {coverUrl ? (
                            <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
                        ) : (
                            <View style={[styles.coverImage, styles.placeholderCover]} />
                        )}

                        <Text style={styles.podcastTitle}>{podcastTitle}</Text>

                        <View style={styles.controlsRow}>
                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={() => Alert.alert('Download', 'Coming soon')}
                            >
                                {renderIcon('download.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={handleLikeToggle}
                            >
                                {isLiked
                                    ? renderIcon('added.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')
                                    : renderIcon('add.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.circleBtn, styles.playBtn]}
                                onPress={handlePlayMain}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                            >
                                {renderIcon(
                                    isCurrentPodcastTrack && isPlaying ? 'pause.svg' : 'play.svg',
                                    { width: scale(21), height: scale(21) },
                                    '#300C0A'
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={() => setShareVisible(true)}
                            >
                                {renderIcon('share.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={handleShuffle}
                            >
                                {renderIcon('shuffle.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.episodesContainer}>
                        <Text style={styles.sectionTitle}>Episodes</Text>

                        {!normalizedEpisodes.length && (
                            <Text style={styles.emptyEpisodesText}>No episodes yet</Text>
                        )}

                        {normalizedEpisodes.map((episode, index) => {
                            const isActive = currentTrackId && currentTrackId === String(episode.id);
                            const activeDurationMs = Math.max(0, Number(duration) || 0);
                            const activePositionMs = Math.max(0, Number(position) || 0);
                            const activeRemainingMs =
                                activeDurationMs > 0 ? Math.max(0, activeDurationMs - activePositionMs) : 0;

                            const dynamicRemainingLabel =
                                isActive && activeDurationMs > 0 && activeRemainingMs > 0
                                    ? `Left ${formatDurationEnFromMs(activeRemainingMs)}`
                                    : null;

                            const dynamicProgressRatio =
                                isActive && activeDurationMs > 0
                                    ? Math.min(1, Math.max(0, activePositionMs / activeDurationMs))
                                    : Number(episode.progressRatio) || 0;

                            const metaIndicatorText = isActive
                                ? (dynamicRemainingLabel || episode.totalDurationLabel || episode.durationLabel || null)
                                : (episode.totalDurationLabel || episode.durationLabel || null);
                            const hasDate = Boolean(episode.dateLabel);
                            const showProgress =
                                isActive &&
                                activeDurationMs > 0 &&
                                dynamicProgressRatio < 1;
                            const showMetaRow = hasDate || Boolean(metaIndicatorText) || showProgress;

                            return (
                                <TouchableOpacity
                                    key={episode.id || `${index}`}
                                    style={styles.episodeRow}
                                    onPress={() => handlePlayEpisode(index)}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[styles.episodeTitle, isActive && styles.activeText]} numberOfLines={3}>
                                        {episode.title}
                                    </Text>

                                    <Text style={styles.episodeAuthor} numberOfLines={1}>
                                        {authorName}
                                    </Text>

                                    {showMetaRow && (
                                        <View style={styles.metaRow}>
                                            {hasDate && (
                                                <Text style={styles.episodeMetaDate} numberOfLines={1}>
                                                    {episode.dateLabel}
                                                </Text>
                                            )}
                                            {!!metaIndicatorText && (
                                                <Text style={styles.episodeMetaIndicator} numberOfLines={1}>
                                                    {hasDate ? ` • ${metaIndicatorText}` : metaIndicatorText}
                                                </Text>
                                            )}
                                            {showProgress && (
                                                <View style={styles.progressTrack}>
                                                    <View
                                                        style={[
                                                            styles.progressFill,
                                                            { width: `${Math.max(2, Math.round(dynamicProgressRatio * 100))}%` },
                                                        ]}
                                                    />
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    <View style={styles.separator} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </LinearGradient>
            </ScrollView>

            <ShareSheetModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                renderIcon={(iconName, style, tintColor) => renderIcon(iconName, style, tintColor)}
                shareTitle={`${podcastTitle} — ${authorName}`}
                shareUrl={getPodcastAudioUrl(podcast || routePodcast)}
            />

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
    notFoundText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
    },
    gradient: {
        minHeight: height,
    },

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

    headerContent: {
        alignItems: 'center',
        paddingHorizontal: scale(16),
        marginBottom: scale(20),
    },
    topAuthorName: {
        color: '#F5D8CB',
        fontSize: scale(18),
        fontFamily: 'Unbounded-Regular',
        marginTop: scale(8),
        marginBottom: scale(18),
        textAlign: 'center',
    },
    coverImage: {
        width: scale(198),
        height: scale(198),
        borderRadius: scale(24),
        marginBottom: scale(20),
    },
    placeholderCover: {
        backgroundColor: '#2A1414',
    },
    podcastTitle: {
        color: '#F5D8CB',
        fontSize: scale(20),
        fontFamily: 'Unbounded-SemiBold',
        textAlign: 'center',
        marginBottom: scale(8),
    },

    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(10),
        columnGap: scale(16),
    },
    circleBtn: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playBtn: {
        width: scale(64),
        height: scale(64),
        borderRadius: scale(32),
        backgroundColor: '#F5D8CB',
        borderWidth: 0,
    },

    episodesContainer: {
        paddingHorizontal: scale(16),
        marginTop: scale(8),
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontSize: scale(20),
        fontFamily: 'Unbounded-SemiBold',
        marginBottom: scale(40),
    },
    episodeRow: {
        paddingBottom: scale(24),
        marginBottom: scale(6),
    },
    episodeTitle: {
        color: '#F5D8CB',
        fontSize: scale(15),
        lineHeight: scale(25),
        fontFamily: 'Unbounded-SemiBold',
    },
    activeText: {
        color: '#FFFFFF',
    },
    episodeAuthor: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        marginTop: scale(6),
    },
    episodeMetaDate: {
        color: '#B9B9B9',
        fontSize: scale(10.5),
        fontFamily: 'Poppins-Regular',
        marginTop: scale(8),
        flexShrink: 0,
    },
    episodeMetaIndicator: {
        color: '#B9B9B9',
        fontSize: scale(10.5),
        fontFamily: 'Poppins-Regular',
        marginTop: scale(8),
        flexShrink: 1,
    },
    metaRow: {
        marginTop: scale(2),
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressTrack: {
        width: scale(126),
        height: scale(2),
        borderRadius: scale(2),
        backgroundColor: 'rgba(245, 216, 203, 0.88)',
        overflow: 'hidden',
        marginTop: scale(8),
        marginLeft: scale(6),
        flexShrink: 0,
    },
    progressFill: {
        height: '100%',
        borderRadius: scale(2),
        backgroundColor: '#80291E',
    },
    separator: {
        marginTop: scale(12),
        height: 1,
        backgroundColor: 'rgba(245, 216, 203, 0.65)',
    },
    emptyEpisodesText: {
        color: 'rgba(245, 216, 203, 0.85)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        marginBottom: scale(12),
    },
});
