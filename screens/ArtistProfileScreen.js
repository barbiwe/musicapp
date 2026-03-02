import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions,
    StatusBar,
    ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgUri, SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import {
    getTracks,
    getUserAvatarUrl,
    getIcons,
    getTrackCoverUrl,
    getAlbums,       // 👇 Додано
    getAlbumCoverUrl, // 👇 Додано
    scale
} from '../api/api';
const { width, height } = Dimensions.get('window');

const svgCache = {};
// 👇 Цей компонент завантажує SVG, чистить, фарбує і КЕШУЄ результат
const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        // 1. Якщо у нас вже є правильна картинка в кеші — беремо її і виходимо
        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }

        // 2. Якщо в кеші немає — вантажимо
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

                        // Зберігаємо в кеш
                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }

        return () => { isMounted = false; };
    }, [cacheKey]); // 🔥 Головне: реагуємо на зміну ключа, а не ігноруємо її

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

export default function ArtistProfileScreen({ navigation, route }) {
    const { artist } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [tracks, setTracks] = useState([]);
    const [albums, setAlbums] = useState([]); // 👇 Стейт для альбомів
    const [icons, setIcons] = useState({});

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // 👇 Завантажуємо треки, АЛЬБОМИ та іконки
            const [tracksRes, albumsRes, iconsRes] = await Promise.all([
                getTracks(),
                getAlbums(),
                getIcons()
            ]);

            setIcons(iconsRes || {});

            // 1. Фільтруємо ТРЕКИ артиста
            const artistTracks = tracksRes.filter(t =>
                (t.ownerId && t.ownerId === artist?.id) ||
                (t.artist?.name === artist?.name)
            );
            setTracks(artistTracks.length > 0 ? artistTracks : tracksRes);

            // 2. Фільтруємо АЛЬБОМИ артиста (за ownerId або artist name)
            const artistAlbums = Array.isArray(albumsRes) ? albumsRes.filter(a =>
                (a.ownerId && a.ownerId === artist?.id) ||
                (a.artist === artist?.name)
            ) : [];
            setAlbums(artistAlbums);

        } catch (e) {
            console.log('Profile load error', e);
        } finally {
            setLoading(false);
        }
    };

    // 👇 ВИПРАВЛЕНА ФУНКЦІЯ (3 аргументи замість 4)
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

            // PNG
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

        // Якщо іконки немає — повертаємо null, щоб не було помилки з об'єктом
        return null;
    };

    const avatarUrl = artist?.id ? getUserAvatarUrl(artist.id) : null;

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#fff" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ flexGrow: 1 }}
                        bounces={false}
                        overScrollMode="never">

                <LinearGradient
                    colors={['#AC654F', '#883426', '#190707',]}
                    locations={[0, 0.2, 0.3,]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.gradient, { paddingBottom: 100 }]}
                >
                    {/* --- HERO / AVATAR --- */}
                    <View style={styles.heroContainer}>
                        <Image
                            source={{ uri: avatarUrl }}
                            style={styles.heroImage}
                            resizeMode="cover"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.8)']}
                            style={styles.heroOverlay}
                        />

                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{top: 20, bottom: 20, left: 20, right: 20}}
                        >
                            {renderIcon('arrow-left.svg', { width: 24, height: 24 }, '#fff')}
                        </TouchableOpacity>

                        <View style={styles.heroTextContainer}>
                            <Text style={styles.genreText}>Rapper</Text>
                            <View style={styles.nameRow}>
                                <Text style={styles.artistNameText}>{artist?.name || 'Unknown Artist'}</Text>
                                {renderIcon('profile.svg', { width: 20, height: 20, marginLeft: 10 }, '#fff')}
                            </View>
                        </View>
                    </View>

                    {/* --- STATS: Виправлений колір (Sandwich method) --- */}
                    <LinearGradient
                        colors={[
                            'rgba(255, 255, 255, 0.0)',
                            'rgba(255, 255, 255, 0.0)',
                            'rgba(255, 255, 255, 0.0)',
                            'rgba(255, 255, 255, 0.0)'
                        ]}
                        locations={[0, 0.09, 0.7, 1]}
                        start={{ x: 1, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={{
                            marginHorizontal: scale(16),
                            marginTop: scale(-30),
                            borderRadius: scale(100),
                            padding: 1, //
                        }}
                    >
                        {/* Важливо: borderRadius тут, щоб обрізати внутрішній кольоровий фон */}
                        <BlurView
                            intensity={20}
                            tint="dark" // Використовуємо dark для темної теми
                            style={styles.statsGlassContainer}
                        >
                            {/* 👇 ЦЕЙ ШАР ВІДПОВІДАЄ ЗА КОЛІР.
                                Він лежить поверх розмиття і фарбує його в потрібний відтінок.
                                Я поставив 0.55 - регулюй прозорість тут (від 0.4 до 0.8) */}
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(48,12,10,0.6)' }]} />

                            {/* Контент */}
                            <View style={styles.statsContentRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>12.3 M</Text>
                                    <Text style={styles.statLabel}>followers</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>18.6 M</Text>
                                    <Text style={styles.statLabel}>listeners</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>12.6 B</Text>
                                    <Text style={styles.statLabel}>listeners</Text>
                                </View>
                            </View>
                        </BlurView>
                    </LinearGradient>
                    {/* --- BIO --- */}
                    <Text style={styles.bioText}>
                        An American artist who broke the rules of the modern pop and hip-hop scene.
                        He became a global sensation after his hit Old Town Road.
                    </Text>

                    {/* --- ALBUMS (REAL DATA) --- */}
                    {/* Секція показується тільки якщо є альбоми */}
                    {albums.length > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Albums</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: scale(16) }}>
                                {albums.map((album, index) => {
                                    // Отримуємо ID та обкладинку
                                    const albumId = album.id || album.Id || album._id;
                                    const coverUrl = (album.coverFileId || album.CoverFileId)
                                        ? getAlbumCoverUrl(albumId)
                                        : null;

                                    return (
                                        <TouchableOpacity
                                            key={index}
                                            style={styles.albumCard}
                                            onPress={() => navigation.navigate('AlbumDetail', { albumId: albumId })}
                                        >
                                            {coverUrl ? (
                                                <Image
                                                    source={{ uri: coverUrl }}
                                                    style={styles.albumImage} // Змінив стиль на Image
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={styles.albumImagePlaceholder} />
                                            )}

                                            <Text style={styles.albumTitle} numberOfLines={1}>
                                                {album.title}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* --- POPULAR SONGS --- */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Popular Songs</Text>
                        <View style={{ paddingHorizontal: scale(16) }}>
                            {tracks.map((t, i) => {
                                const cover = getTrackCoverUrl(t);
                                return (
                                    <View key={i}>
                                        <TouchableOpacity
                                            style={styles.songRow}
                                            onPress={() => navigation.navigate('Player', { track: t, })}
                                        >
                                            {/* ВІНІЛ */}
                                            <View style={styles.vinylContainer}>
                                                {cover ? (
                                                    <Image
                                                        source={{ uri: cover }}
                                                        style={styles.innerCover}
                                                        resizeMode="cover"
                                                    />
                                                ) : (
                                                    <View style={[styles.innerCover, { backgroundColor: '#555' }]} />
                                                )}

                                                <View style={styles.vinylOverlayWrapper}>
                                                    {renderIcon('vinyl.svg', { width: scale(50), height: scale(50) }, null)}
                                                </View>
                                            </View>

                                            {/* ІНФО */}
                                            <View style={styles.songInfo}>
                                                <Text style={styles.songTitle} numberOfLines={1}>{t.title}</Text>
                                                <Text style={styles.songArtist} numberOfLines={1}>{t.artist?.name || artist?.name}</Text>
                                            </View>

                                            {/* ЛАЙК */}
                                            <TouchableOpacity>
                                                {renderIcon('hurt.svg', { width: 24, height: 24 }, '#fff')}
                                            </TouchableOpacity>
                                        </TouchableOpacity>

                                        {/* Розділова лінія */}
                                        {i < tracks.length - 1 && <View style={styles.separator} />}
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                </LinearGradient>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    gradient: {
        minHeight: height,
    },
    heroContainer: {
        width: '100%',
        height: scale(450),
        position: 'relative',
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        height: '40%',
    },
    backButton: {
        position: 'absolute',
        top: scale(50),
        left: scale(20),
        zIndex: 10,
    },
    heroTextContainer: {
        position: 'absolute',
        bottom: scale(30),
        left: scale(16),
        right: scale(16),
    },
    genreText: {
        color: '#F5D8CB',
        fontSize: scale(20),
        fontFamily: 'Unbounded-SemiBold',
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    artistNameText: {
        color: '#F5D8CB',
        fontSize: scale(36),
        fontFamily: 'Unbounded-SemiBold',

    },
    statsGlassContainer: {
        borderRadius: scale(100),
        overflow: 'hidden',
    },
    statsContentRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: scale(14),
        width: '100%', // Важливо, щоб розтягнути контент
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        color: '#FFFFFF',
        fontSize: scale(20),
        fontFamily: 'Unbounded-Regular',
    },
    statLabel: {
        color: '#FFFFFF',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    bioText: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        lineHeight: scale(20),
        marginHorizontal: scale(16),
        marginTop: scale(20),
        marginBottom: scale(20),
    },
    section: {
        marginTop: scale(10),
        marginBottom: scale(20),
    },
    sectionTitle: {
        fontSize: scale(24),
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        marginLeft: scale(16),
        marginBottom: scale(15),
    },
    albumCard: {
        marginRight: scale(15),
        width: scale(140),
    },
    albumImage: {
        width: scale(120),
        height: scale(120),
        borderRadius: scale(20),
        marginBottom: scale(8),
    },
    albumImagePlaceholder: {
        width: scale(140),
        height: scale(140),
        backgroundColor: '#444',
        borderRadius: scale(20),
        marginBottom: scale(8),
    },
    albumTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Regular',
        textAlign: 'left',
        width: '100%',
        marginLeft: scale(4),
    },
    songRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
    },
    vinylContainer: {
        width: scale(50),
        height: scale(50),
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    innerCover: {
        width: scale(28),
        height: scale(28),
        borderRadius: scale(14),
        position: 'absolute',
        zIndex: 1,
    },
    vinylOverlayWrapper: {
        width: '100%',
        height: '100%',
        zIndex: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    songInfo: {
        flex: 1,
        marginLeft: scale(15),
    },
    songTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-SemiBold',
    },
    songArtist: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        marginTop: 2,
    },
    separator: {
        height: 1,
        backgroundColor: '#F5D8CB',
        marginVertical: scale(8)
    },
});