import React, { useEffect, useMemo, useState } from 'react';

import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { useIsFocused } from '@react-navigation/native';
import {
    getAllArtists,
    getIcons,
    getLikedTracks,
    getSubscriptions,
    getUserAvatarUrl,
    scale
} from '../../api/api';

const { width, height } = Dimensions.get('window');
const svgCache = {};

const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return () => { isMounted = false; };
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

        return () => { isMounted = false; };
    }, [cacheKey, color, uri]);

    if (!xml) return <View style={{ width, height }} />;
    return <SvgXml xml={xml} width={width} height={height} />;
};

// Винесемо висоту хедера в змінну, щоб зручно керувати
// Якщо хедер займає десь 100-120 пікселів, ставимо це значення тут
const HEADER_HEIGHT = scale(120);

export default function LibraryAll({ navigation }) {
    const isFocused = useIsFocused();
    const [icons, setIcons] = useState({});
    const [likedCount, setLikedCount] = useState(0);
    const [artistCards, setArtistCards] = useState([]);

    // Мокові дані
    const DATA = useMemo(() => {
        const base = [
            {
                id: 'liked',
                type: 'liked',
                title: 'Liked songs',
                subtitle: `${likedCount} songs`,
                image: null
            },
            {
                id: '1',
                type: 'podcast',
                title: 'Стендап для своїх',
                subtitle: 'Podcast / Andrew Ozarkiv',
                image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84ca966977380ba83ad20f968e'
            },
            {
                id: '2',
                type: 'playlist',
                title: 'Mix of the day',
                subtitle: 'Playlist / For this user',
                image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84ca966977380ba83ad20f968e'
            },
            {
                id: '3',
                type: 'playlist',
                title: 'Chill Vibes',
                subtitle: 'Playlist / For this user',
                image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84ca966977380ba83ad20f968e'
            },
        ];

        return [...base, ...artistCards];
    }, [likedCount, artistCards]);

    useEffect(() => {
        if (isFocused) {
            loadData();
        }
    }, [isFocused]);

    const loadData = async () => {
        const [loadedIcons, likedRaw, subscriptionsRaw, allArtistsRaw] = await Promise.all([
            getIcons(),
            getLikedTracks(),
            getSubscriptions(),
            getAllArtists(),
        ]);

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

            return {
                id: `artist-${id}`,
                type: 'artist',
                title: name,
                subtitle: 'Artist',
                image:
                    item?.avatarUrl ||
                    item?.artistAvatarUrl ||
                    getUserAvatarUrl(id),
                initial: name.charAt(0).toUpperCase(),
                artistId: id,
                order: index,
            };
        };

        const subscriptions = Array.isArray(subscriptionsRaw) ? subscriptionsRaw : [];
        const allArtists = Array.isArray(allArtistsRaw) ? allArtistsRaw : [];
        const source = subscriptions.length > 0 ? subscriptions : allArtists;

        const normalizedArtists = source
            .map((item, index) => normalizeArtist(item, index))
            .filter(Boolean);

        const uniq = [];
        const used = new Set();
        normalizedArtists.forEach((artist) => {
            if (used.has(artist.id)) return;
            used.add(artist.id);
            uniq.push(artist);
        });

        setIcons(loadedIcons || {});
        setLikedCount(Array.isArray(likedRaw) ? likedRaw.length : 0);
        setArtistCards(uniq.slice(0, 2));
    };

    const renderIcon = (iconName, style, tintColor = null) => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;

                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={width}
                        height={height}
                        color={tintColor}
                    />
                );
            }

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

        // Якщо іконки ще немає (або вантажиться), повертаємо пустий прозорий блок потрібного розміру
        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    const renderCard = (item) => {
        const isArtist = item.type === 'artist';
        const isLiked = item.type === 'liked';

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.7}
                onPress={() => {
                    if (isArtist) {
                        navigation?.navigate('ArtistProfile', {
                            artist: {
                                id: item.artistId || String(item.id || '').replace('artist-', ''),
                                name: item.title,
                            },
                        });
                    } else if (isLiked) {
                        navigation?.navigate('LikedSongs');
                    }
                }}
            >
                <View style={styles.imageWrapper}>
                    {isLiked ? (
                        <View style={styles.vinylContainer}>
                            {renderIcon('vinyl.svg', styles.vinylImage)}
                            <View style={styles.vinylCenter}>
                                {renderIcon('added.svg', { width: scale(65), height: scale(65) }, '#F5D8CB')}
                            </View>
                        </View>
                    ) : (
                        item.image ? (
                            <Image
                                source={{ uri: item.image }}
                                style={[
                                    styles.image,
                                    isArtist && styles.roundImage
                                ]}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={[styles.image, styles.roundImage, styles.artistFallback]}>
                                <Text style={styles.artistFallbackText}>{item.initial || '?'}</Text>
                            </View>
                        )
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
                {/* ЗМІНА 1:
                   Додаємо "прозорий блок" зверху, рівний висоті хедера.
                   Хедер (який накладається абсолютом) буде візуально тут.
                   А ScrollView почнеться нижче цього блоку.
                */}
                <View style={{ height: 208 }} />

                <ScrollView
                    // ЗМІНА 2: ScrollView тепер має flex: 1, щоб зайняти ТІЛЬКИ простір, що залишився
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {DATA.map((item) => renderCard(item))}

                    <View style={{ height: scale(100) }} />
                </ScrollView>
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
        width: width,
        height: height,
    },
    scrollContent: {
        paddingHorizontal: scale(16),
        paddingTop: scale(8),
        paddingBottom: scale(100),
    },

    // --- CARD STYLES ---
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',
        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),

        shadowColor: "#000",
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
    roundImage: {
        borderRadius: scale(45),
    },
    artistFallback: {
        backgroundColor: 'rgba(30, 10, 8, 0.85)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    artistFallbackText: {
        color: '#F5D8CB',
        fontSize: scale(26),
        fontFamily: 'Unbounded-SemiBold',
    },

    // --- VINYL STYLE (Liked Songs) ---
    vinylContainer: {
        width: scale(80),
        height: scale(80),
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    vinylImage: {
        width: '100%',
        height: '100%',
        borderRadius: scale(45),
    },
    vinylCenter: {
        paddingTop: scale(7),
        position: 'absolute',
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: '#2A1414',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // --- TEXT STYLES ---
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
        color: 'rgba(245, 216, 203, 0.7)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
});
