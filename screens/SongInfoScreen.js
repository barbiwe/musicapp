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
import {
    getIcons,
    getTrackCoverUrl,
    scale,
    getAlbumDetails,
    getTrackDetails,
} from '../api/api';
import { SvgUri, SvgXml } from 'react-native-svg';
const { height } = Dimensions.get('window');

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
export default function TrackInfoScreen({ navigation, route }) {
    // Отримуємо трек з параметрів навігації
    const { track } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [icons, setIcons] = useState({});

    const [albumName, setAlbumName] = useState('Single');
    const [trackDetails, setTrackDetails] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const iconsRes = await getIcons();
            setIcons(iconsRes || {});

            const trackId = track?.id || track?._id;
            if (trackId) {
                const details = await getTrackDetails(trackId);
                if (details) {
                    setTrackDetails(details);
                }
            }

            // 👇 ЛОГІКА ОТРИМАННЯ НАЗВИ АЛЬБОМУ
            if (track?.album?.title) {
                // Якщо назва вже прийшла разом з треком
                setAlbumName(track.album.title);
            } else if (track?.albumId) {
                // Якщо є тільки ID, робимо запит
                const albumData = await getAlbumDetails(track.albumId);
                if (albumData && albumData.title) {
                    setAlbumName(albumData.title);
                }
            }

        } catch (e) {
            console.log('TrackInfo load error', e);
        } finally {
            setLoading(false);
        }
    };

    // Хелпер для іконок
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

    // Хелпер для форматування дати (з createdAt або поточної дати)
    const formatDate = (dateString) => {
        if (!dateString) return 'Unknown Date';
        const date = new Date(dateString);
        // Формат: "Sep 2022"
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#F5D8CB" />
            </View>
        );
    }

    const coverUrl = getTrackCoverUrl(track);
    const releaseDate = formatDate(track?.uploadedAt);
    const sourceTrack = trackDetails || track || {};
    const artistName = sourceTrack?.artist?.name || sourceTrack?.artistName || sourceTrack?.artist || 'Unknown Artist';
    const genreText = Array.isArray(sourceTrack?.genres) && sourceTrack.genres.length > 0
        ? sourceTrack.genres.join(', ')
        : 'Pop, Synth-pop';
    const isGenreMock = !Array.isArray(sourceTrack?.genres) || sourceTrack.genres.length === 0;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

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
                    style={[styles.gradient, { paddingBottom: 100 }]}
                >
                    {/* --- HEADER (BACK BUTTON) --- */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            {renderIcon('arrow-left.svg', { width: 24, height: 24 }, '#F5D8CB')}
                        </TouchableOpacity>
                    </View>

                    {/* --- BIG VINYL RECORD --- */}
                    <View style={styles.vinylSection}>
                        <View style={styles.bigVinylContainer}>
                            {/* 1. Обкладинка (всередині) */}
                            {coverUrl ? (
                                <Image
                                    source={{ uri: coverUrl }}
                                    style={styles.bigInnerCover}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={[styles.bigInnerCover, { backgroundColor: '#333' }]} />
                            )}

                            {/* 2. Пластинка (зверху) */}
                            <View style={styles.bigVinylOverlay}>
                                {renderIcon('vinyl.svg', { width: scale(105), height: scale(105) }, null)}
                            </View>
                        </View>
                    </View>

                    {/* --- TITLE & ARTIST --- */}
                    <View style={styles.titleSection}>
                        <Text style={styles.trackTitleText}>{track?.title || 'Unknown Title'}</Text>
                        <Text style={styles.artistNameText}>{artistName}</Text>
                    </View>

                    {/* --- INFO ROW (Album | Date) --- */}
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Album: </Text>
                        <Text style={styles.infoValue}>{albumName}</Text>
                        <Text style={styles.divider}> | </Text>
                        <Text style={styles.infoLabel}>Date: </Text>
                        <Text style={styles.infoValue}>{releaseDate}</Text>
                    </View>

                    {/* --- STATIC DETAILS (PLACEHOLDERS) --- */}
                    <View style={styles.detailsContainer}>

                        {/* Genre */}
                        <View style={styles.detailBlock}>
                            <View style={styles.detailTitleRow}>
                                <Text style={styles.detailTitle}>Genre:</Text>
                            </View>
                            <Text style={[styles.detailText, isGenreMock && styles.detailTextMock]}>{genreText}</Text>
                            <View style={styles.separator} />
                        </View>

                        {/* Songwriters */}
                        <View style={styles.detailBlock}>
                            <View style={styles.detailTitleRow}>
                                <Text style={styles.detailTitle}>Songwriters:</Text>
                            </View>
                            <View style={styles.bulletList}>
                                <Text style={[styles.detailText, styles.detailTextMock]}>• {artistName}</Text>
                                <Text style={[styles.detailText, styles.detailTextMock]}>• Unknown Writer</Text>
                            </View>
                            <View style={styles.separator} />
                        </View>

                        {/* Producers */}
                        <View style={styles.detailBlock}>
                            <View style={styles.detailTitleRow}>
                                <Text style={styles.detailTitle}>Producers:</Text>
                            </View>
                            <View style={styles.bulletList}>
                                <Text style={[styles.detailText, styles.detailTextMock]}>• Unknown Producer</Text>
                            </View>
                            <View style={styles.separator} />
                        </View>

                        {/* Label */}
                        <View style={styles.detailBlock}>
                            <View style={styles.detailTitleRow}>
                                <Text style={styles.detailTitle}>Label:</Text>
                            </View>
                            <View style={styles.bulletList}>
                                <Text style={[styles.detailText, styles.detailTextMock]}>• Independent</Text>
                            </View>
                            <View style={styles.separator} />
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
        paddingHorizontal: scale(20),
    },

    // Header
    header: {
        marginTop: scale(60), // Відступ для статус бару
        marginBottom: scale(20),
        alignItems: 'flex-start',
    },

    // Vinyl Styles (Big)
    vinylSection: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(52),
    },
    bigVinylContainer: {
        width: scale(105),
        height: scale(105),
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    bigInnerCover: {
        width: scale(45.58),
        height: scale(45.58),
        borderRadius: scale(22.79),
        position: 'absolute',
        zIndex: 2,
    },
    bigVinylOverlay: {
        width: '100%',
        height: '100%',
        zIndex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Title Section
    titleSection: {
        alignItems: 'center',
        marginBottom: scale(20),
    },
    trackTitleText: {
        color: '#F5D8CB',
        fontSize: scale(24),
        fontFamily: 'Unbounded-SemiBold',
        textAlign: 'center',
        marginBottom: scale(12),
        textTransform: 'uppercase',
    },
    artistNameText: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },

    // Info Row (Album | Date)
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(40),
    },
    infoLabel: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Unbounded-Regular',
    },
    infoValue: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    divider: {
        color: '#F5D8CB',
        fontSize: scale(14),
        marginHorizontal: scale(10),
    },

    // Details Container
    detailsContainer: {
        width: '100%',
        paddingBottom: scale(50),
    },
    detailBlock: {
        marginBottom: scale(20),
    },
    detailTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Regular',
        marginBottom: scale(10),
    },
    detailTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(10),
        columnGap: scale(8),
    },
    mockTag: {
        color: '#FF4D4F',
        fontSize: scale(12),
        fontFamily: 'Poppins-SemiBold',
        textTransform: 'uppercase',
    },
    detailText: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        marginBottom: scale(4),
    },
    detailTextMock: {
        color: '#FF4D4F',
    },
    separator: {
        height: 1,
        backgroundColor: '#F5D8CB',
        marginTop: scale(15),
    },
});
