import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Platform
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlayerStore } from '../store/usePlayerStore';

import {
    getTracks,
    getAlbums,
    getTrackCoverUrl,
    getUserAvatarUrl,
    getRecentlyPlayed,
    getRecommendations,
    getIcons,
    scale
} from '../api/api';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const svgCache = {};

// Допоміжна функція для генерації випадкових прослуховувань (30M, 120K тощо)
const getRandomListeners = () => {
    const suffixes = ['M', 'K'];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const randomValue = randomSuffix === 'M'
        ? (Math.random() * 50 + 1).toFixed(1) // Від 1.0M до 51.0M
        : Math.floor(Math.random() * 900 + 100); // Від 100K до 999K
    return `${randomValue}${randomSuffix}`;
};

const ArtistAvatar = ({ uri, name }) => {
    const [imgError, setImgError] = useState(false);

    if (imgError || !uri) {
        return (
            <View style={[styles.artistAvatar, styles.center, { backgroundColor: '#555' }]}>
                <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>
                    {name ? name.charAt(0).toUpperCase() : '?'}
                </Text>
            </View>
        );
    }

    return (
        <Image
            source={{ uri }}
            style={styles.artistAvatar}
            onError={() => setImgError(true)}
        />
    );
};


const ArtistCard = ({ artist, onPress, getAvatar, bgColor }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={styles.artistCardWrapper}
        >
            {/* Підключаємо динамічний колір фону */}
            <View style={[styles.artistCard, { backgroundColor: bgColor || '#290A09' }]}>
                <View style={styles.artistCardInfo}>
                    <Text style={styles.artistCardName} numberOfLines={2}>
                        {artist.name}
                    </Text>

                    <Text style={styles.artistCardListeners}>
                        {(Math.random() * (7 - 0.2) + 0.2).toFixed(1)}M listeners
                    </Text>
                </View>

                <Image
                    source={{ uri: getAvatar(artist.id) }}
                    style={styles.artistCardImage}
                    resizeMode="cover"
                />
            </View>
        </TouchableOpacity>
    );
};

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

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

export default function DiscoverScreen({ navigation }) {
    const { setTrack } = usePlayerStore();
    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [recentTracks, setRecentTracks] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [artists, setArtists] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [icons, setIcons] = useState({});
    const [myId, setMyId] = useState(null);


    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const currentUserId = await AsyncStorage.getItem('userId');
            if (currentUserId) setMyId(currentUserId);

            const [tracksRes, albumsRes, iconsRes, recentRes, recsRes] = await Promise.all([
                getTracks(),
                getAlbums(),
                getIcons(),
                getRecentlyPlayed(),
                getRecommendations()
            ]);

            setTracks(tracksRes || []);
            setAlbums(albumsRes || []);
            setIcons(iconsRes || {});

            const formattedHistory = (recentRes || []).map(item => {
                if (item.track) {
                    return {
                        ...item.track,
                        artist: { name: item.track.artistName || 'Unknown' }
                    };
                }
                return item;
            });
            setRecentTracks(formattedHistory);

            const map = new Map();
            (tracksRes || []).forEach(t => {
                const artistName = t.artistName || t.artist?.name || 'Unknown Artist';
                if (t.ownerId && !map.has(t.ownerId)) {
                    map.set(t.ownerId, {
                        id: t.ownerId,
                        name: artistName
                    });
                }
            });
            setArtists([...map.values()]);

            const formattedRecs = (recsRes || []).map(r => ({
                id: r.trackId,
                title: r.title,
                artist: { name: r.artistName || 'Unknown' },
                reasons: r.reasons,
                coverFileId: r.coverFileId,
                fileId: r.fileId
            }));
            setRecommendations(formattedRecs);

        } catch (e) {
            console.log('Discover load error', e);
        } finally {
            setLoading(false);
        }
    };


    const getAvatar = (userId) =>
        `${getUserAvatarUrl(userId)}?t=${new Date().getTime()}`;

    const renderIcon = (iconName, style, tintColor = '#000000') => {
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

        return null;
    };

    const chunkArray = (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    };

    const artistPairs = chunkArray(artists, 2);

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#fff"/>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar
                barStyle="light-content"
                translucent={true}
                backgroundColor="transparent"
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={{ flexGrow: 1 }}
            >
                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.gradient}
                >
                    <SafeAreaView style={styles.safeArea}>

                        {/* HEADER */}
                        <View style={styles.headerContainer}>
                            <View style={styles.watermarkLogo}>
                                {renderIcon('VOX.svg', { width: scale(209), height: scale(84) }, '#fff')}
                            </View>

                            <View style={styles.headerContentRow}>
                                <Text style={styles.headerTitle}>
                                    Discover
                                </Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity
                                        style={{ marginRight: scale(16) }}
                                        onPress={() => navigation.navigate('ProScreen')}
                                        activeOpacity={0.7}
                                    >
                                        {renderIcon('pro1.svg', { width: 24, height: 24 }, '#fff')}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('Profile')}
                                        activeOpacity={0.7}

                                    >
                                        {renderIcon('Profile.svg', { width: 24, height: 24 }, '#fff')}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        {/* RECOMMENDED FOR YOU */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Recommended for you
                            </Text>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 20 }}
                                snapToInterval={CARD_WIDTH + 12}
                                decelerationRate="fast"
                            >
                                {artistPairs.map((pair, columnIndex) => (
                                    <View key={columnIndex} style={{ marginRight: 12 }}>
                                        {pair.map((artist, i) => (
                                            <ArtistCard
                                                key={artist.id || i}
                                                artist={artist}
                                                icons={icons}
                                                getAvatar={getAvatar}
                                                onPress={() => navigation.navigate('ArtistProfile', { artist: artist })}
                                                // 👇 Додаємо різні кольори для 1-ї та 2-ї картки в колонці
                                                bgColor={i === 0 ? '#1B0707' : '#290A09'}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </ScrollView>
                        </View>


                        {/* RECENTLY PLAYED */}
                        <View style={styles.section}>
                            {/* Заголовок з кубиком */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                marginLeft: scale(16),
                                marginRight: scale(16),
                                marginBottom: scale(16)
                            }}>
                                <Text style={[styles.sectionTitle, { marginLeft: 0, marginBottom: 0 }]}>
                                    Recently played
                                </Text>
                                {renderIcon('cube.svg', { width: scale(36), height: scale(36) }, '#F5D8CB')}
                            </View>

                            {recentTracks.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.row}>
                                        {recentTracks.map((t, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.square}
                                                onPress={() => { setTrack(t); }}
                                            >
                                                <Image
                                                    source={{ uri: getTrackCoverUrl(t) }}
                                                    style={styles.squareImage}
                                                />
                                                <Text style={styles.trackTitle} numberOfLines={1}>
                                                    {t.title}
                                                </Text>
                                                <Text style={styles.trackArtist} numberOfLines={1}>
                                                    {t.artistName || t.artist?.name || 'Unknown Artist'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            ) : (
                                <Text style={{ textAlign: 'center', color: '#B9B9B9', fontFamily: 'Poppins-Regular', fontSize: scale(14), marginVertical: scale(20) }}>
                                    No recently played
                                </Text>
                            )}
                        </View>


                        {/* POPULAR SONGS */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Popular songs
                            </Text>

                            {tracks.length > 0 && (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.row}>
                                        {tracks.slice(0, 10).map((t, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.square}
                                                onPress={() => { setTrack(t); }}
                                            >
                                                <View style={{ position: 'relative' }}>
                                                    <Image
                                                        source={{ uri: getTrackCoverUrl(t) }}
                                                        style={styles.squareImage}
                                                    />

                                                    {/* Кружечок з текстом */}
                                                    <View style={{
                                                        position: 'absolute',
                                                        bottom: scale(14),
                                                        left: '50%',
                                                        transform: [{ translateX: -scale(16) }], // Центруємо відносно ширини 32
                                                        width: scale(32), // Трохи ширше для тексту
                                                        height: scale(20), // Менша висота для овальної форми, або 24 для кола
                                                        borderRadius: scale(10), // Половина висоти для округлих країв
                                                        overflow: 'hidden'
                                                    }}>
                                                        <BlurView intensity={60} tint="dark" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                                            <Text style={{
                                                                color: '#fff',
                                                                fontSize: scale(9),
                                                                fontFamily: 'Poppins-Medium',
                                                                textAlign: 'center'
                                                            }}>
                                                                {getRandomListeners()}
                                                            </Text>
                                                        </BlurView>
                                                    </View>
                                                </View>

                                                <Text style={styles.trackTitle} numberOfLines={1}>
                                                    {t.title}
                                                </Text>
                                                <Text style={styles.trackArtist} numberOfLines={1}>
                                                    {t.artistName || t.artist?.name || 'Unknown Artist'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            )}
                        </View>


                        {/* ARTISTS */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Artist
                            </Text>

                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.row}>
                                    {artists.map((a, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            style={styles.artist}
                                            onPress={() => navigation.navigate('ArtistProfile', { artist: a })}
                                        >
                                            <ArtistAvatar
                                                uri={getAvatar(a.id)}
                                                name={a.name}
                                            />
                                            <Text style={styles.artistName} numberOfLines={1}>
                                                {a.name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </ScrollView>
                        </View>


                        {/* YOUR HERITAGE */}
                        <View style={[styles.section, { marginBottom: scale(150) }]}>
                            <Text style={styles.sectionTitle}>
                                Your heritage
                            </Text>

                            {recommendations.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.row}>
                                        {recommendations.map((t, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.square}
                                                onPress={() => { setTrack(t); }}
                                            >
                                                <Image
                                                    source={{ uri: getTrackCoverUrl(t) }}
                                                    style={styles.squareImage}
                                                />
                                                <Text style={styles.trackTitle} numberOfLines={1}>
                                                    {t.title}
                                                </Text>
                                                <Text style={styles.trackArtist} numberOfLines={1}>
                                                    {t.artist?.name || 'Unknown'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            ) : (
                                <Text style={{
                                    color: 'rgba(255,255,255,0.5)',
                                    marginLeft: 20,
                                    fontFamily: 'Poppins-Regular',
                                    fontSize: 12
                                }}>
                                    Listen to more music to get recommendations...
                                </Text>
                            )}
                        </View>

                    </SafeAreaView>
                </LinearGradient>
            </ScrollView>
        </View>
    );
}

// СТИЛІ БЕЗ ЗМІН
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707'
    },
    gradient: {
        minHeight: height,
        paddingBottom: scale(100),

    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 60 : 0,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerContainer: {
        position: 'relative',
        marginHorizontal: scale(20),
        marginTop: scale(-30),
        marginBottom: scale(60),
        height: scale(80),
        justifyContent: 'flex-end',
    },
    watermarkLogo: {
        position: 'absolute',
        top: scale(10),
        left: scale(-10),
        zIndex: 0,
        opacity: 0.8,
    },
    headerContentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1,
    },
    headerTitle: {
        fontSize: scale(32),
        fontFamily: 'Unbounded-Regular',
        color: '#fff',
        letterSpacing: 0.5,
    },
    section: {
        marginBottom: scale(32)
    },
    sectionTitle: {
        marginLeft: scale(20),
        marginBottom: scale(16),
        fontSize: scale(15),
        fontFamily: 'Unbounded-Medium',
        color: '#fff',
    },
    artistCardWrapper: {
        marginBottom: scale(8),
        borderRadius: scale(24),

    },
    artistCard: {
        width: scale(335),
        height: scale(132),
        borderRadius: scale(24),
        flexDirection: 'row',
        padding: scale(6),
        overflow: 'hidden',
        backgroundColor: '#290A09',
        backgroundOpacity: 0.9 ,
    },
    artistCardInfo: {
        flex: 1,
        justifyContent: 'center',
        paddingVertical: scale(8),
        paddingHorizontal: scale(8),
    },
    artistCardName: {
        fontSize: scale(24),
        fontFamily: 'Unbounded-Regular',
        color: '#fff',
        lineHeight: scale(26),
    },
    artistCardListeners: {
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        color: 'rgba(255,255,255,0.65)',
        fontWeight: '500',
    },
    artistCardImage: {
        width: scale(120),
        height: '100%',
        borderRadius: scale(20),
        backgroundColor: '#333',
    },
    row: {
        paddingHorizontal: scale(20),
        flexDirection: 'row'
    },
    artist: {
        width: scale(75),
        marginRight: scale(16),
        alignItems: 'center'
    },
    artistAvatar: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(56),
        backgroundColor: '#777'
    },
    artistName: {
        marginTop: scale(8),
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        color: '#B9B9B9',
        textAlign: 'center'
    },
    square: {
        width: scale(120),
        marginRight: scale(16)
    },
    squareImage: {
        width: scale(120),
        height: scale(120),
        borderRadius: scale(18),
        backgroundColor: '#333',
        marginBottom: scale(8)
    },
    trackTitle: {
        fontSize: scale(14),
        fontFamily: 'Unbounded-Medium',
        color: '#fff',
        fontWeight: '600'
    },
    trackArtist: {
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
        color: '#B9B9B9'
    },
    emptyStateContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        opacity: 0.7
    },
    emptyVinyl: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(25),
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(15)
    },
    emptyStateTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Medium',
        fontSize: scale(14),
        marginBottom: 2
    },
    emptyStateSubtitle: {
        color: '#B9B9B9',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12)
    }
});