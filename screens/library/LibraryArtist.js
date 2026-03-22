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
import { getSubscriptions, getUserAvatarUrl, scale } from '../../api/api';

const { width, height } = Dimensions.get('window');
const ITEM_WIDTH = (width - scale(60)) / 3;
let libraryArtistSessionCache = null;

const resolveArtistFromSubscription = (item, index) => {
    const id =
        item?.artistId ||
        item?.ArtistId ||
        item?.id ||
        item?._id ||
        item?.artist?.id ||
        item?.artist?._id ||
        item?.ownerId ||
        item?.userId ||
        null;

    const name =
        item?.artistName ||
        item?.name ||
        item?.username ||
        item?.displayName ||
        item?.artist?.name ||
        `Artist ${index + 1}`;

    const country =
        item?.country ||
        item?.artistCountry ||
        item?.artist?.country ||
        null;

    return {
        id: id ? String(id) : null,
        name,
        country,
        avatarUrl:
            item?.avatarUrl ||
            item?.artistAvatarUrl ||
            (id ? getUserAvatarUrl(id) : null),
    };
};

export default function LibraryArtist({ navigation }) {
    const isFocused = useIsFocused();
    const hasLoadedOnceRef = useRef(Boolean(libraryArtistSessionCache));
    const [loading, setLoading] = useState(!libraryArtistSessionCache);
    const [artists, setArtists] = useState(() => libraryArtistSessionCache?.artists || []);
    const [brokenImages, setBrokenImages] = useState({});

    useEffect(() => {
        if (!isFocused) return;
        if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            loadSubscriptions({ force: false });
            return;
        }
        loadSubscriptions({ force: true, silent: true });
    }, [isFocused]);

    const loadSubscriptions = async ({ force = false, silent = false } = {}) => {
        if (!force && libraryArtistSessionCache) {
            setArtists(libraryArtistSessionCache.artists || []);
            setBrokenImages({});
            setLoading(false);
            hasLoadedOnceRef.current = true;
            return;
        }

        if (!silent) setLoading(true);
        try {
            const raw = await getSubscriptions({ force });
            const normalized = (Array.isArray(raw) ? raw : [])
                .map((item, index) => resolveArtistFromSubscription(item, index))
                .filter((artist) => !!artist.id);

            const seen = new Set();
            const unique = normalized.filter((artist) => {
                const key = String(artist.id);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            setArtists(unique);
            libraryArtistSessionCache = { artists: unique };
        } catch (_) {
            if (!silent) {
                hasLoadedOnceRef.current = false;
                setArtists([]);
                libraryArtistSessionCache = { artists: [] };
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const renderAvatar = (artist) => {
        const avatarUri = artist.avatarUrl;
        const imageBroken = brokenImages[artist.id];

        if (!avatarUri || imageBroken) {
            return (
                <View style={[styles.image, styles.fallbackAvatar]}>
                    <Text style={styles.fallbackAvatarText}>
                        {(artist.name || '?').charAt(0).toUpperCase()}
                    </Text>
                </View>
            );
        }

        return (
            <Image
                source={{ uri: avatarUri }}
                style={styles.image}
                resizeMode="cover"
                onError={() =>
                    setBrokenImages((prev) => ({ ...prev, [artist.id]: true }))
                }
            />
        );
    };

    const renderCard = (artist) => (
        <TouchableOpacity
            key={artist.id}
            style={styles.cardContainer}
            activeOpacity={0.8}
            onPress={() =>
                navigation?.navigate('ArtistProfile', {
                    artist: {
                        id: artist.id,
                        name: artist.name,
                        country: artist.country,
                    },
                })
            }
        >
            <View style={styles.imageWrapper}>
                {renderAvatar(artist)}
            </View>
            <Text style={styles.title} numberOfLines={1}>
                {artist.name}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <View style={{ height: scale(220) }} />

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="small" color="#F5D8CB" />
                    </View>
                ) : (
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {artists.length > 0 ? (
                            <View style={styles.gridContainer}>
                                {artists.map(renderCard)}
                            </View>
                        ) : (
                            <Text style={styles.emptyText}>No subscribed artists yet</Text>
                        )}

                        <View style={{ height: scale(150) }} />
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
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollContent: {
        paddingHorizontal: scale(20),
        paddingTop: scale(10),
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    cardContainer: {
        width: ITEM_WIDTH,
        alignItems: 'center',
        marginBottom: scale(24),
    },
    imageWrapper: {
        marginBottom: scale(10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    image: {
        width: scale(96),
        height: scale(96),
        borderRadius: scale(48),
        backgroundColor: '#333',
    },
    fallbackAvatar: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackAvatarText: {
        color: '#F5D8CB',
        fontSize: scale(24),
        fontFamily: 'Unbounded-SemiBold',
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(13),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
        paddingHorizontal: scale(4),
    },
    emptyText: {
        color: '#F5D8CB',
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        marginTop: scale(30),
    },
});
