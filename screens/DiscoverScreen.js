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
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    getTracks,
    getAlbums,
    getTrackCoverUrl,
    getAlbumCoverUrl,
    getUserAvatarUrl,
    getRecentlyPlayed,
    getRecommendations,
    getIcons,
    scale
} from '../api/api';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;

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

const ArtistCard = ({ artist, onPress, getAvatar, icons }) => {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={styles.artistCardWrapper}
        >
            {/* ТУТ БУВ LinearGradient, ТЕПЕР ПРОСТО VIEW */}
            <View style={styles.artistCard}>
                {/* LEFT INFO */}
                <View style={styles.artistCardInfo}>
                    <Text style={styles.artistCardName} numberOfLines={2}>
                        {artist.name}
                    </Text>

                    <Text style={styles.artistCardListeners}>
                        {(Math.random() * (7 - 0.2) + 0.2).toFixed(1)}M listeners
                    </Text>
                </View>

                {/* RIGHT IMAGE */}
                <Image
                    source={{ uri: getAvatar(artist.id) }}
                    style={styles.artistCardImage}
                    resizeMode="cover"
                />
            </View>
        </TouchableOpacity>
    );
};

export default function DiscoverScreen({ navigation }) {
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

            // 1. Запитуємо всі дані
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

            // 2. Обробка історії
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

            // 3. Обробка артистів
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

            // 👇 4. ОБРОБКУ РЕКОМЕНДАЦІЙ ПОВЕРНУЛИ ВСЕРЕДИНУ TRY (це важливо!)
            const formattedRecs = (recsRes || []).map(r => ({
                id: r.trackId,
                title: r.title,
                artist: { name: r.artistName || 'Unknown' },
                reasons: r.reasons,
                // Додаємо це, щоб працювала обкладинка getTrackCoverUrl
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

    const renderIcon = (iconName, style, tintColor) => {
        if (icons[iconName]) {
            const imageStyle = [style];
            if (tintColor) {
                imageStyle.push({tintColor: tintColor});
            }
            return (
                <Image
                    source={{uri: icons[iconName]}}
                    style={imageStyle}
                    resizeMode="contain"
                />
            );
        }
        return <View style={[style, {backgroundColor: 'transparent'}]}/>;
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
                    colors={['#AC654F', '#883426', '#190707',]}
                    locations={[0, 0.2, 0.5,]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.gradient}
                >
                    <SafeAreaView style={styles.safeArea}>

                        {/* HEADER */}
                        <View style={styles.headerContainer}>
                            <View style={styles.watermarkLogo}>
                                {renderIcon('VOX.png', { width: scale(209), height: scale(84) }, '#fff')}
                            </View>

                            <View style={styles.headerContentRow}>
                                <Text style={styles.headerTitle}>
                                    Discover
                                </Text>

                                <TouchableOpacity
                                    onPress={() => navigation.navigate('Profile')}
                                    activeOpacity={0.7}
                                >
                                    {renderIcon('Profile.png', { width: 24, height: 24 }, '#fff')}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* --- RECOMMENDED --- */}
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
                                {/* Проходимося по колонках (парах) */}
                                {artistPairs.map((pair, columnIndex) => (
                                    <View key={columnIndex} style={{ marginRight: 12 }}>
                                        {/* Проходимося по артистах у колонці */}
                                        {pair.map((artist, i) => (
                                            <ArtistCard
                                                key={artist.id || i}
                                                artist={artist}
                                                icons={icons}
                                                getAvatar={getAvatar}
                                                onPress={() => navigation.navigate('ArtistProfile', { artist: artist })}
                                            />
                                        ))}
                                    </View>
                                ))}
                            </ScrollView>
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
                                            // 👇 ДОДАЛИ НАВІГАЦІЮ ТУТ
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

                        {/* RECENTLY PLAYED */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Recently played
                            </Text>

                            {/* ПЕРЕВІРКА: Чи є історія? */}
                            {recentTracks.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View style={styles.row}>
                                        {recentTracks.map((t, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={styles.square}
                                                onPress={() =>
                                                    navigation.navigate('Player', {
                                                        track: t,
                                                    })
                                                }
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
                                /* ЗАГЛУШКА, ЯКЩО ПУСТО */
                                <View style={styles.emptyStateContainer}>
                                    <View style={styles.emptyVinyl}>
                                        <Text style={{fontSize: 24, color: '#300C0A'}}>?</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.emptyStateTitle}>It’s quiet here...</Text>
                                        <Text style={styles.emptyStateSubtitle}>Start listening to build your history</Text>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* FRIENDS MOOD */}
                        <View style={styles.section,{ marginBottom: scale(150) }}>
                            <Text style={styles.sectionTitle}>
                                Friend’s mood
                            </Text>
                        </View>

                        {/* HERITAGE (RECOMMENDATIONS) */}
                        <View style={styles.section}>
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
                                                onPress={() =>
                                                    navigation.navigate('Player', {
                                                        track: t,
                                                    })
                                                }
                                            >
                                                <Image
                                                    // Функція сама зрозуміє, що робити з ID
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

    // 👇 АДАПТИВНИЙ ХЕДЕР 👇
    headerContainer: {
        position: 'relative',
        marginHorizontal: scale(20),
        marginTop: scale(-30), // Піднімаємо header
        marginBottom: scale(60),
        height: scale(80),
        justifyContent: 'flex-end',
    },
    watermarkLogo: {
        position: 'absolute',
        top: scale(10),
        left: scale(-10),
        zIndex: 0,
        opacity: 0.8, // Додав прозорість, щоб виглядало як на макеті
    },
    headerContentRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1,
    },
    headerTitle: {
        fontSize: scale(32), // Шрифт тепер адаптивний
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

    // --- card ---
    artistCardWrapper: {
        marginBottom: scale(14),
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

    playButton: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(40),
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
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