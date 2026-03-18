import React, { useEffect, useMemo, useState } from 'react';
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
    getLikedTracks,
    getTrackCoverUrl,
    getTracks,
    resolveArtistName,
    scale,
} from '../../api/api';

const { width, height } = Dimensions.get('window');

const getTrackId = (track) =>
    String(track?.id || track?._id || track?.trackId || track?.track?.id || '').trim();

const extractLikedIds = (raw) => {
    if (!Array.isArray(raw)) return [];

    const set = new Set();
    raw.forEach((item) => {
        if (typeof item === 'string') {
            const id = item.trim();
            if (id) set.add(id);
            return;
        }

        const id = getTrackId(item);
        if (id) set.add(id);
    });

    return Array.from(set);
};

const extractLikedTrackObjects = (raw) => {
    if (!Array.isArray(raw)) return [];

    return raw
        .map((item) => {
            if (!item || typeof item === 'string') return null;
            const src = item?.track || item;
            const id = getTrackId(src) || getTrackId(item);
            if (!id) return null;
            return { ...src, id, _id: id };
        })
        .filter(Boolean);
};

export default function LibrarySongs({ navigation, setTrack }) {
    const isFocused = useIsFocused();

    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [brokenCovers, setBrokenCovers] = useState({});

    const loadData = async () => {
        setLoading(true);

        try {
            const [likedRaw, allTracksRaw] = await Promise.all([
                getLikedTracks(),
                getTracks(),
            ]);

            const likedIdList = extractLikedIds(likedRaw);
            const likedSet = new Set(likedIdList);
            const allTracks = Array.isArray(allTracksRaw) ? allTracksRaw : [];
            const likedFromAll = allTracks.filter((track) => likedSet.has(getTrackId(track)));
            const likedObjects = extractLikedTrackObjects(likedRaw);

            const mergedMap = new Map();
            likedFromAll.forEach((track) => {
                const id = getTrackId(track);
                if (id) mergedMap.set(id, { ...track, id, _id: id });
            });

            likedObjects.forEach((track) => {
                const id = getTrackId(track);
                if (!id) return;
                const prev = mergedMap.get(id) || {};
                mergedMap.set(id, { ...prev, ...track, id, _id: id });
            });

            const merged = Array.from(mergedMap.values()).sort((a, b) => {
                const aTime = Date.parse(a?.uploadedAt || a?.createdAt || a?.created || '') || 0;
                const bTime = Date.parse(b?.uploadedAt || b?.createdAt || b?.created || '') || 0;
                return bTime - aTime;
            });

            setTracks(merged);
            setBrokenCovers({});
        } catch (_) {
            setTracks([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isFocused) {
            loadData();
        }
    }, [isFocused]);

    const sortedTracks = useMemo(() => {
        return [...tracks];
    }, [tracks]);

    const onOpenTrack = async (track) => {
        if (!track) return;

        if (typeof setTrack === 'function') {
            await setTrack(track);
            navigation?.navigate('Player');
            return;
        }

        navigation?.navigate('Player', { track });
    };

    const renderCard = (track) => {
        const id = getTrackId(track);
        const coverUri = getTrackCoverUrl(track);
        const broken = brokenCovers[id];
        const hasCover = Boolean(coverUri && !broken);

        return (
            <TouchableOpacity
                key={id}
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() => onOpenTrack(track)}
            >
                <View style={styles.imageWrapper}>
                    {hasCover ? (
                        <Image
                            source={{ uri: coverUri }}
                            style={styles.image}
                            resizeMode="cover"
                            onError={() => setBrokenCovers((prev) => ({ ...prev, [id]: true }))}
                        />
                    ) : (
                        <View style={[styles.image, styles.imageFallback]} />
                    )}
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        {track?.title || 'Unknown title'}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {`Song / ${resolveArtistName(track, 'Unknown')}`}
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
                    <View style={styles.loader}>
                        <ActivityIndicator size="small" color="#F5D8CB" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {sortedTracks.length > 0 ? (
                            sortedTracks.map(renderCard)
                        ) : (
                            <Text style={styles.emptyText}>No liked songs yet</Text>
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
    loader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
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
        backgroundColor: '#333',
    },
    imageFallback: {
        backgroundColor: 'rgba(20, 8, 8, 0.8)',
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
        color: 'rgba(245, 216, 203, 0.85)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    emptyText: {
        color: 'rgba(245, 216, 203, 0.9)',
        textAlign: 'center',
        marginTop: scale(24),
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
});
