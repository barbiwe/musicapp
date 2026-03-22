import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Image,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { usePlayerStore } from '../../store/usePlayerStore';

import {
    getIcons,
    getCachedIcons,
    getCachedTrackCoverUri,
    getRecentlyPlayed,
    getTrackCoverUrl,
    resolveArtistName,
    scale,
} from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';
import MiniPlayer from '../../components/MiniPlayer';

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' });
const imagePrefetchCache = new Set();
let listeningHistorySessionCache = null;

const normalizeItem = (entry, index) => {
    const track = entry?.track || entry;
    if (!track) return null;

    const id = track.id || track._id || entry?.trackId || entry?.id || null;
    return {
        ...track,
        id: id || `history_${index}`,
        playedAt: entry?.playedAt || track?.playedAt || null,
        __rawTrack: track,
    };
};

const getDateLabel = (dateValue) => {
    if (!dateValue) return 'Earlier';

    const target = new Date(dateValue);
    const now = new Date();

    const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffDays = Math.round((nowStart - targetStart) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';

    return DATE_FORMATTER.format(target);
};

const normalizeHistoryList = (raw) =>
    (Array.isArray(raw) ? raw : [])
        .map((entry, index) => normalizeItem(entry, index))
        .filter(Boolean)
        .sort((a, b) => new Date(b.playedAt || 0) - new Date(a.playedAt || 0));

export default function ListeningHistoryScreen({ navigation }) {
    const { setTrack } = usePlayerStore();
    const hasLoadedOnceRef = useRef(Boolean(listeningHistorySessionCache));
    const refreshInFlightRef = useRef(false);
    const [icons, setIcons] = useState(() => listeningHistorySessionCache?.icons || getCachedIcons() || {});
    const [history, setHistory] = useState(() =>
        Array.isArray(listeningHistorySessionCache?.history)
            ? listeningHistorySessionCache.history
            : []
    );
    const [coverMap, setCoverMap] = useState(() => listeningHistorySessionCache?.coverMap || {});

    useEffect(() => {
        if (Object.keys(icons || {}).length > 0) return undefined;
        let mounted = true;
        getIcons().then((map) => {
            if (mounted) setIcons(map || {});
        }).catch(() => {});

        return () => { mounted = false; };
    }, [icons]);

    const loadHistory = useCallback(async ({ force = false, silent = false } = {}) => {
        if (!force && listeningHistorySessionCache) {
            setHistory(Array.isArray(listeningHistorySessionCache.history) ? listeningHistorySessionCache.history : []);
            setCoverMap(listeningHistorySessionCache.coverMap || {});
            if (listeningHistorySessionCache.icons) setIcons(listeningHistorySessionCache.icons);
            hasLoadedOnceRef.current = true;
            return;
        }

        if (!force && hasLoadedOnceRef.current) {
            if (Array.isArray(listeningHistorySessionCache?.history)) {
                setHistory(listeningHistorySessionCache.history);
                setCoverMap(listeningHistorySessionCache.coverMap || {});
                if (listeningHistorySessionCache.icons) setIcons(listeningHistorySessionCache.icons);
            }
            return;
        }

        if (refreshInFlightRef.current) return;
        refreshInFlightRef.current = true;
        try {
            // 1) Спочатку показуємо кеш (щоб екран не ставав порожнім при тимчасовому фейлі API)
            const cachedRaw = await getRecentlyPlayed(false);
            const cached = normalizeHistoryList(cachedRaw);
            if (cached.length > 0) {
                setHistory(cached);
            }

            // 2) Далі пробуємо свіже з бекенду
            const freshRaw = await getRecentlyPlayed(true);
            const fresh = normalizeHistoryList(freshRaw);

            // Якщо свіже порожнє, а кеш уже є — не перетираємо UI порожнім станом
            if (fresh.length > 0 || cached.length === 0) {
                setHistory(fresh);
                listeningHistorySessionCache = {
                    history: fresh,
                    coverMap: listeningHistorySessionCache?.coverMap || {},
                    icons: icons || listeningHistorySessionCache?.icons || {},
                };
            } else if (cached.length > 0) {
                listeningHistorySessionCache = {
                    history: cached,
                    coverMap: listeningHistorySessionCache?.coverMap || {},
                    icons: icons || listeningHistorySessionCache?.icons || {},
                };
            }
            hasLoadedOnceRef.current = true;
        } catch (e) {
            if (!silent) hasLoadedOnceRef.current = false;
        } finally {
            refreshInFlightRef.current = false;
        }
    }, [icons]);

    useFocusEffect(
        useCallback(() => {
            if (!hasLoadedOnceRef.current) {
                loadHistory({ force: false, silent: false });
                return;
            }
            loadHistory({ force: true, silent: true });
        }, [loadHistory])
    );

    const sections = useMemo(() => {
        const map = new Map();

        history.forEach((track) => {
            const label = getDateLabel(track.playedAt);
            if (!map.has(label)) map.set(label, []);
            map.get(label).push(track);
        });

        return Array.from(map.entries()).map(([title, items]) => ({ title, items }));
    }, [history]);

    useEffect(() => {
        history.slice(0, 30).forEach((item) => {
            const id = item.id || item._id;
            if (!id) return;
            getCachedTrackCoverUri(id).then((localUri) => {
                if (localUri) {
                    setCoverMap((prev) => (prev[id] === localUri ? prev : { ...prev, [id]: localUri }));
                    return;
                }

                const remoteCover =
                    getTrackCoverUrl(item) ||
                    getTrackCoverUrl(item.__rawTrack) ||
                    getTrackCoverUrl({ id });

                if (remoteCover && !imagePrefetchCache.has(remoteCover)) {
                    imagePrefetchCache.add(remoteCover);
                    Image.prefetch(remoteCover).catch(() => {
                        imagePrefetchCache.delete(remoteCover);
                    });
                }
            });
        });
    }, [history]);

    useEffect(() => {
        listeningHistorySessionCache = {
            history,
            coverMap,
            icons,
        };
    }, [history, coverMap, icons]);

    return (
        <LinearGradient
            colors={['#AC654F', '#883426', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <RemoteTintIcon
                            icons={icons}
                            iconName="arrow-left.svg"
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback="‹"
                        />
                    </TouchableOpacity>
                    <Text style={styles.title}>Listening{`\n`}history</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {sections.length === 0 ? (
                        <Text style={styles.emptyText}>No listening history yet</Text>
                    ) : null}

                    {sections.map((section) => {
                        return (
                            <View key={section.title} style={styles.sectionBlock}>
                                <Text style={styles.sectionTitle}>{section.title}</Text>

                                {section.items.map((item, index) => {
                                    const id = item.id || item._id || `${section.title}_${index}`;
                                    const idKey = String(item.id || item._id || '');
                                    const cover =
                                        coverMap[idKey] ||
                                        getTrackCoverUrl(item) ||
                                        getTrackCoverUrl(item.__rawTrack) ||
                                        getTrackCoverUrl({ id: item.id || item._id });
                                    const rowKey = `${id}_${item.playedAt || 'no_date'}_${index}`;

                                    return (
                                        <TouchableOpacity
                                            key={rowKey}
                                            style={styles.row}
                                            activeOpacity={0.85}
                                            onPress={() => setTrack(item)}
                                        >
                                            <View style={styles.vinylWrap}>
                                                <RemoteTintIcon
                                                    icons={icons}
                                                    iconName="vinyl.svg"
                                                    width={scale(58)}
                                                    height={scale(58)}
                                                    color={null}
                                                    fallback=""
                                                    style={styles.vinylOverlay}
                                                />
                                                {cover ? (
                                                    <Image source={{ uri: cover, cache: 'force-cache' }} style={styles.innerCover} resizeMode="cover" />
                                                ) : (
                                                    <View style={[styles.innerCover, styles.innerCoverFallback]}>
                                                        <Text style={styles.innerFallbackText}>♪</Text>
                                                    </View>
                                                )}
                                            </View>

                                            <View style={styles.textWrap}>
                                                <Text style={styles.trackTitle} numberOfLines={1}>{item.title || 'Unknown title'}</Text>
                                                <Text style={styles.trackArtist} numberOfLines={1}>{resolveArtistName(item, item.artistName || 'Unknown Artist')}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        );
                    })}
                </ScrollView>
            </View>

            <MiniPlayer bottomOffset={scale(24)} />
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(44) : scale(58),
        paddingHorizontal: scale(16),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(16),
        minHeight: scale(72),
    },
    backButton: {
        width: scale(24),
        height: scale(24),
        justifyContent: 'center',
    },
    headerSpacer: {
        width: scale(24),
        height: scale(24),
    },
    title: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(30),
        lineHeight: scale(38),
        textAlign: 'center',
        textTransform: 'none',
    },
    listContent: {
        paddingBottom: scale(24),
    },
    emptyText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        marginTop: scale(8),
    },
    sectionBlock: {
        marginBottom: scale(8),
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Bold',
        fontSize: scale(20),
        marginBottom: scale(10),
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    vinylWrap: {
        width: scale(58),
        height: scale(58),
        marginRight: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    vinylOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
    },
    innerCover: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginLeft: scale(-12),
        marginTop: scale(-12),
        width: scale(24),
        height: scale(24),
        borderRadius: scale(12),
        zIndex: 2,
    },
    innerCoverFallback: {
        backgroundColor: 'rgba(245, 216, 203, 0.18)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerFallbackText: {
        color: '#F5D8CB',
        fontSize: scale(12),
    },
    textWrap: {
        flex: 1,
        minWidth: 0,
    },
    trackTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(16),
        marginBottom: scale(2),
    },
    trackArtist: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
});
