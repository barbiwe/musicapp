import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    StatusBar,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import { usePlayerStore } from '../store/usePlayerStore';
import {
    getIcons,
    getCachedIcons,
    getColoredSvgXml,
    peekColoredSvgXml,
    searchTracksByGenre,
    getAlbums,
    getTrackCoverUrl,
    getAlbumCoverUrl,
    getUserAvatarUrl,
    resolveArtistName,
    scale,
} from '../api/api';

const ColoredSvg = ({ uri, width, height, color }) => {
    const [xml, setXml] = useState(peekColoredSvgXml(uri, color));

    useEffect(() => {
        let isMounted = true;
        if (uri) {
            getColoredSvgXml(uri, color)
                .then((cachedXml) => {
                    if (isMounted) setXml(cachedXml);
                })
                .catch(() => {});
        } else {
            setXml(null);
        }
        return () => {
            isMounted = false;
        };
    }, [uri, color]);

    if (!xml) return <View style={{ width, height }} />;
    return <SvgXml xml={xml} width={width} height={height} />;
};

export default function GenreDetailScreen({ navigation, route }) {
    const { setTrack } = usePlayerStore();
    const genre = route?.params?.genre || { id: '', name: 'Genre' };

    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const [loading, setLoading] = useState(true);
    const [genreTracks, setGenreTracks] = useState([]);
    const [albums, setAlbums] = useState([]);
    const [artists, setArtists] = useState([]);

    useEffect(() => {
        loadData();
    }, [genre?.name]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [iconsRes, tracksRes, albumsRes] = await Promise.all([
                Object.keys(icons).length === 0 ? getIcons() : Promise.resolve(icons),
                searchTracksByGenre(genre?.name || ''),
                getAlbums(),
            ]);

            setIcons(iconsRes || {});
            const tracks = Array.isArray(tracksRes) ? tracksRes : [];
            const sortedTracks = [...tracks].sort((a, b) => {
                const ad = new Date(a.releaseDate || a.createdAt || a.uploadedAt || 0).getTime();
                const bd = new Date(b.releaseDate || b.createdAt || b.uploadedAt || 0).getTime();
                return bd - ad;
            });
            setGenreTracks(sortedTracks);

            const albumIdSet = new Set(
                tracks
                    .map((t) => t.albumId || t.AlbumId || t.album?.id || t.album?._id)
                    .filter(Boolean)
                    .map((id) => String(id))
            );

            const backendAlbums = Array.isArray(albumsRes) ? albumsRes : [];
            const filteredAlbums = backendAlbums.filter((a) => {
                const aId = a.id || a._id || a.albumId || a.AlbumId;
                return aId && albumIdSet.has(String(aId));
            });
            setAlbums(filteredAlbums);

            const fromTracks = new Map();
            tracks.forEach((t) => {
                const artistId = t.artistId || t.ArtistId || t.artist?.id || t.artist?._id;
                const artistName = resolveArtistName(t, '');
                if (artistId && artistName && !fromTracks.has(String(artistId))) {
                    fromTracks.set(String(artistId), {
                        id: String(artistId),
                        artistId: String(artistId),
                        ownerId: t.ownerId || t.OwnerId || null,
                        name: artistName,
                    });
                }
            });
            setArtists([...fromTracks.values()].slice(0, 16));
        } finally {
            setLoading(false);
        }
    };

    const renderIcon = (iconName, sizeOrStyle, tintColor = '#F5D8CB') => {
        const iconUrl = icons[iconName];
        const dims =
            typeof sizeOrStyle === 'number'
                ? { width: sizeOrStyle, height: sizeOrStyle }
                : (sizeOrStyle || { width: 24, height: 24 });

        if (!iconUrl) return <View style={{ width: dims.width, height: dims.height }} />;
        const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

        if (isSvg) {
            return <ColoredSvg uri={iconUrl} width={dims.width} height={dims.height} color={tintColor} />;
        }

        const imageStyle = { width: dims.width, height: dims.height };
        if (tintColor !== null && tintColor !== undefined) {
            imageStyle.tintColor = tintColor;
        }

        return (
            <Image
                source={{ uri: iconUrl }}
                style={imageStyle}
                resizeMode="contain"
            />
        );
    };

    const renderRoundTrackItem = (item, index) => {
        const cover = getTrackCoverUrl(item);
        const trackId = item.id || item._id || `t-${index}`;
        return (
            <TouchableOpacity
                key={`${trackId}-${index}`}
                style={styles.circleItem}
                onPress={() => setTrack(item)}
                activeOpacity={0.85}
            >
                <View style={styles.vinylWrap}>
                    {renderIcon('vinyl.svg', scale(95), null)}
                    {cover ? <Image source={{ uri: cover }} style={styles.vinylCenterCover} /> : null}
                </View>
                <Text style={styles.itemLabel} numberOfLines={1}>{item.title || 'Unknown'}</Text>
            </TouchableOpacity>
        );
    };

    const renderAlbumItem = (item, index) => {
        const id = item.id || item._id || item.albumId || item.AlbumId;
        const cover = id ? getAlbumCoverUrl(id) : null;
        return (
            <TouchableOpacity
                key={`${id || `a-${index}`}-${index}`}
                style={styles.squareItem}
                onPress={() => id && navigation.navigate('AlbumDetail', { id })}
                activeOpacity={0.85}
            >
                {cover ? (
                    <Image source={{ uri: cover }} style={styles.squareCover} />
                ) : (
                    <View style={[styles.squareCover, styles.squareFallback]} />
                )}
                <Text style={styles.itemLabel} numberOfLines={1}>{item.title || 'Album'}</Text>
            </TouchableOpacity>
        );
    };

    const renderArtistItem = (item, index) => {
        const id = item.id || item._id || `ar-${index}`;
        const avatar = getUserAvatarUrl(id);
        const name = item.name || item.artistName || 'Artist';
        return (
            <TouchableOpacity
                key={`${id}-${index}`}
                style={styles.circleArtistItem}
                onPress={() =>
                    navigation.navigate('ArtistProfile', {
                        artist: {
                            ...item,
                            id,
                            artistId: item.artistId || id,
                            ownerId: item.ownerId || null,
                            name,
                        },
                    })
                }
                activeOpacity={0.85}
            >
                {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.artistAvatar} />
                ) : (
                    <View style={[styles.artistAvatar, styles.squareFallback]} />
                )}
                <Text style={styles.itemLabel} numberOfLines={1}>{name}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    scrollEnabled={false}
                    bounces={false}
                    overScrollMode="never"
                >
                    <View style={styles.heroWrap}>
                        <View style={styles.heroBg}>
                            {renderIcon('genrenamebg.svg', { width: '100%', height: '100%' }, null)}
                        </View>

                        <View style={styles.heroTop}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                {renderIcon('arrow-left.svg', scale(24), '#F5D8CB')}
                            </TouchableOpacity>
                            <Text style={styles.heroTitle}>{genre?.name || 'Genre'}</Text>
                            <View style={styles.backButton} />
                        </View>
                    </View>

                    {loading ? (
                        <View style={styles.loaderWrap}>
                            <ActivityIndicator size="small" color="#F5D8CB" />
                        </View>
                    ) : null}

                    <Text style={styles.sectionTitle}>New releases</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
                        {genreTracks.slice(0, 12).map(renderRoundTrackItem)}
                    </ScrollView>

                    <Text style={styles.sectionTitle}>Albums</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
                        {albums.length > 0 ? albums.slice(0, 12).map(renderAlbumItem) : <Text style={styles.emptyText}>No albums in this genre</Text>}
                    </ScrollView>

                    <Text style={styles.sectionTitle}>Artists</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
                        {artists.length > 0 ? artists.map(renderArtistItem) : <Text style={styles.emptyText}>No artists in this genre</Text>}
                    </ScrollView>
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    gradient: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: scale(130),
    },
    heroWrap: {
        width: '100%',
        aspectRatio: 375 / 154,
        position: 'relative',
    },
    heroBg: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTop: {
        marginTop: Platform.OS === 'ios' ? scale(60) : (StatusBar.currentHeight || 0) + scale(12),
        paddingHorizontal: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backButton: {
        width: scale(28),
        height: scale(28),
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroTitle: {
        color: '#F5D8CB',
        fontSize: scale(32),
        fontFamily: 'Unbounded-Regular',
    },
    loaderWrap: {
        marginTop: scale(10),
        alignItems: 'center',
    },
    sectionTitle: {
        marginTop: scale(16),
        marginHorizontal: scale(16),
        color: '#F5D8CB',
        fontSize: scale(24),
        fontFamily: 'Unbounded-SemiBold',
    },
    sectionRow: {
        paddingHorizontal: scale(16),
        paddingTop: scale(8),
    },
    circleItem: {
        width: scale(108),
        marginRight: scale(12),
        alignItems: 'center',
    },
    vinylWrap: {
        width: scale(95),
        height: scale(95),
        justifyContent: 'center',
        alignItems: 'center',
    },
    vinylCenterCover: {
        position: 'absolute',
        width: scale(38),
        height: scale(38),
        borderRadius: scale(19),
    },
    squareItem: {
        width: scale(115),
        marginRight: scale(12),
    },
    squareCover: {
        width: scale(115),
        height: scale(95),
        borderRadius: scale(12),
        backgroundColor: '#2A1111',
    },
    squareFallback: {
        backgroundColor: '#53201B',
    },
    circleArtistItem: {
        width: scale(108),
        marginRight: scale(12),
        alignItems: 'center',
    },
    artistAvatar: {
        width: scale(95),
        height: scale(95),
        borderRadius: scale(47.5),
        backgroundColor: '#2A1111',
    },
    itemLabel: {
        marginTop: scale(8),
        color: '#F5D8CB',
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },
    emptyText: {
        color: 'rgba(245,216,203,0.72)',
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
    },
});
