import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import {
    getAllPodcasts,
    getPodcastCoverUrl,
    isPodcastLiked,
    scale,
} from '../../api/api';

const { width, height } = Dimensions.get('window');
let libraryPodcastSessionCache = null;

const normalizePodcast = (item) => {
    const id = String(item?.id ?? item?._id ?? item?.podcastId ?? '').trim();
    if (!id) return null;

    const title = String(item?.title ?? item?.name ?? 'Untitled podcast').trim() || 'Untitled podcast';
    const author = String(item?.author ?? item?.artistName ?? item?.ownerName ?? 'Unknown').trim() || 'Unknown';
    const status = String(item?.status ?? '').toLowerCase();

    return {
        id,
        title,
        subtitle: `Podcast / ${author}`,
        image: getPodcastCoverUrl(item),
        status,
        raw: item,
    };
};

export default function LibraryPodcast({ navigation }) {
    const isFocused = useIsFocused();
    const hasLoadedOnceRef = useRef(Boolean(libraryPodcastSessionCache));
    const [loading, setLoading] = useState(!libraryPodcastSessionCache);
    const [podcasts, setPodcasts] = useState(() => libraryPodcastSessionCache?.podcasts || []);

    useEffect(() => {
        if (!isFocused) return;
        if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            loadPodcasts({ force: false });
            return;
        }
        loadPodcasts({ force: true, silent: true });
    }, [isFocused]);

    const loadPodcasts = async ({ force = false, silent = false } = {}) => {
        if (!force && libraryPodcastSessionCache) {
            setPodcasts(libraryPodcastSessionCache.podcasts || []);
            setLoading(false);
            hasLoadedOnceRef.current = true;
            return;
        }

        if (!silent) setLoading(true);

        try {
            const allRaw = await getAllPodcasts({ force });
            const all = (Array.isArray(allRaw) ? allRaw : [])
                .map(normalizePodcast)
                .filter(Boolean)
                .filter((podcast) => !podcast.status || podcast.status === 'approved');

            if (!all.length) {
                setPodcasts([]);
                if (!silent) setLoading(false);
                return;
            }

            const checks = await Promise.all(
                all.map(async (podcast) => ({
                    id: podcast.id,
                    liked: await isPodcastLiked(podcast.id),
                }))
            );

            const likedIds = new Set(checks.filter((item) => item.liked).map((item) => item.id));
            const likedPodcasts = all.filter((podcast) => likedIds.has(podcast.id));

            setPodcasts(likedPodcasts);
            libraryPodcastSessionCache = { podcasts: likedPodcasts };
        } catch (_) {
            if (!silent) {
                hasLoadedOnceRef.current = false;
                setPodcasts([]);
                libraryPodcastSessionCache = { podcasts: [] };
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const renderCard = (item) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.75}
                onPress={() => {
                    navigation?.navigate('PodcastDetail', {
                        podcastId: item.id,
                        podcast: item.raw || item,
                    });
                }}
            >
                <View style={styles.imageWrapper}>
                    {item.image ? (
                        <Image
                            source={{ uri: item.image }}
                            style={styles.image}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={styles.image} />
                    )}
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <View style={{ height: 208 }} />

                {loading ? (
                    <View style={styles.loaderWrap}>
                        <ActivityIndicator size="large" color="#F5D8CB" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {podcasts.map((item) => renderCard(item))}

                        {!podcasts.length && (
                            <Text style={styles.emptyText}>No added podcasts yet</Text>
                        )}

                        <View style={{ height: scale(100) }} />
                    </ScrollView>
                )}
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        width,
        height,
    },
    loaderWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        paddingHorizontal: scale(16),
        paddingTop: scale(8),
        paddingBottom: scale(100),
    },

    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',

        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    imageWrapper: {
        marginRight: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
    },

    image: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(15),
        backgroundColor: '#2A1311',
    },

    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: scale(10),
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Medium',
        marginBottom: scale(4),
    },
    subtitle: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    emptyText: {
        color: 'rgba(245, 216, 203, 0.8)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        textAlign: 'center',
        marginTop: scale(20),
    },
});
