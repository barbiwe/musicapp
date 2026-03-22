import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { getCachedTrackCoverUri, getIcons, getOfflineDownloads, getTrackCoverUrl, resolveArtistName, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';
import MiniPlayer from '../../components/MiniPlayer';

const imagePrefetchCache = new Set();
let downloadsSessionCache = null;

export default function DownloadsScreen({ navigation }) {
    const { setTrack } = usePlayerStore();
    const hasLoadedOnceRef = useRef(Boolean(downloadsSessionCache));
    const [icons, setIcons] = useState(() => downloadsSessionCache?.icons || {});
    const [items, setItems] = useState(() => downloadsSessionCache?.items || []);
    const [coverMap, setCoverMap] = useState(() => downloadsSessionCache?.coverMap || {});

    useEffect(() => {
        if (Object.keys(icons || {}).length > 0) return undefined;
        let mounted = true;
        getIcons().then((map) => {
            if (mounted) setIcons(map || {});
        }).catch(() => {});
        return () => { mounted = false; };
    }, [icons]);

    const loadDownloads = useCallback(async ({ force = false } = {}) => {
        if (!force && downloadsSessionCache) {
            setItems(downloadsSessionCache.items || []);
            setCoverMap(downloadsSessionCache.coverMap || {});
            if (downloadsSessionCache.icons) setIcons(downloadsSessionCache.icons);
            hasLoadedOnceRef.current = true;
            return;
        }

        if (!force && hasLoadedOnceRef.current) return;

        const saved = await getOfflineDownloads();
        const normalized = Array.isArray(saved) ? saved : [];
        setItems(normalized);
        downloadsSessionCache = {
            items: normalized,
            coverMap: downloadsSessionCache?.coverMap || {},
            icons: icons || downloadsSessionCache?.icons || {},
        };
        hasLoadedOnceRef.current = true;
    }, [icons]);

    useFocusEffect(
        useCallback(() => {
            if (!hasLoadedOnceRef.current) {
                loadDownloads({ force: false });
            }
        }, [loadDownloads])
    );

    useEffect(() => {
        items.slice(0, 30).forEach((item) => {
            const id = item.id || item._id;
            if (!id) return;
            getCachedTrackCoverUri(id).then((localUri) => {
                if (localUri) {
                    setCoverMap((prev) => (prev[id] === localUri ? prev : { ...prev, [id]: localUri }));
                    return;
                }

                const cover = getTrackCoverUrl(item);
                if (cover && !imagePrefetchCache.has(cover)) {
                    imagePrefetchCache.add(cover);
                    Image.prefetch(cover).catch(() => {
                        imagePrefetchCache.delete(cover);
                    });
                }
            });
        });
    }, [items]);

    useEffect(() => {
        downloadsSessionCache = {
            items,
            coverMap,
            icons,
        };
    }, [items, coverMap, icons]);

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
                    <Text style={styles.title}>Downloads</Text>
                    <View style={styles.headerSpacer} />
                </View>

                <ScrollView
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {items.length === 0 ? (
                        <Text style={styles.emptyText}>No downloaded tracks yet</Text>
                    ) : null}

                    {items.map((item, index) => {
                        const id = item.id || item._id || `download_${index}`;
                        const cover = item.localCoverUri || coverMap[String(item.id || item._id || '')] || getTrackCoverUrl(item);

                        return (
                            <TouchableOpacity
                                key={String(id)}
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
        paddingHorizontal: scale(20),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(24),
        minHeight: scale(24),
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
        textAlign: 'center',
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
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(14),
    },
    vinylWrap: {
        width: scale(58),
        height: scale(58),
        marginRight: scale(14),
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
