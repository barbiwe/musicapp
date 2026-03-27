import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    ActivityIndicator,
    Dimensions,
    Platform,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { usePlayerStore } from '../store/usePlayerStore';
import {
    getTracks,
    getGenres,
    getRecentlyPlayed,
    searchTracksCombined,
    getAlbums,
    getAllArtists,
    getCachedTracks,
    getCachedGenres,
    getCachedRecentlyPlayed,
    getTrackCoverUrl,
    getAlbumCoverUrl,
    getUserAvatarUrl,
    getIcons,
    getCachedIcons,
    getColoredSvgXml,
    peekColoredSvgXml,
    scale,
    resolveArtistName,
} from '../api/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

const normalizeHistory = (history) => {
    if (!Array.isArray(history)) return [];

    return history
        .map((item) => {
            const track = item?.track || item;
            if (!track) return null;

            const id = track.id || track._id || track.trackId;
            if (!id) return null;

            return {
                ...track,
                id,
                artistName: resolveArtistName(track, 'Unknown Artist'),
                artist:
                    typeof track.artist === 'object' && track.artist !== null
                        ? { ...track.artist, name: resolveArtistName(track, 'Unknown Artist') }
                        : { name: resolveArtistName(track, 'Unknown Artist') },
            };
        })
        .filter(Boolean);
};

const normalizeGenres = (genres) => {
    if (!Array.isArray(genres)) return [];
    const normalized = genres
        .map((genre, index) => ({
            id: genre?.id || genre?._id || genre?.genreId || `genre-${index}`,
            name: String(genre?.name || genre?.title || '').trim(),
        }))
        .filter((g) => g.name.length > 0);

    const used = new Set();
    return normalized.filter((g) => {
        const key = g.name.toLowerCase();
        if (used.has(key)) return false;
        used.add(key);
        return true;
    });
};

const getTrackGenreSignals = (track) => {
    if (!track) return { ids: [], names: [] };

    const ids = [];
    const names = [];

    if (Array.isArray(track.genreIds)) {
        track.genreIds.forEach((v) => ids.push(String(v)));
    }

    if (track.genreId) ids.push(String(track.genreId));

    if (Array.isArray(track.genres)) {
        track.genres.forEach((g) => {
            if (typeof g === 'string') {
                names.push(g.toLowerCase().trim());
            } else if (g && typeof g === 'object') {
                if (g.id || g._id || g.genreId) ids.push(String(g.id || g._id || g.genreId));
                if (g.name || g.title) names.push(String(g.name || g.title).toLowerCase().trim());
            }
        });
    }

    if (typeof track.genre === 'string') names.push(track.genre.toLowerCase().trim());
    if (track.genre?.name) names.push(String(track.genre.name).toLowerCase().trim());

    return {
        ids: Array.from(new Set(ids)),
        names: Array.from(new Set(names)),
    };
};

const getArtistName = (artist) => (
    artist?.name ||
    artist?.username ||
    artist?.userName ||
    artist?.artistName ||
    artist?.displayName ||
    ''
);

export default function SearchScreen({ navigation }) {
    const { setTrack } = usePlayerStore();
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const [tracks, setTracks] = useState(() => getCachedTracks() || []);
    const [recentTracks, setRecentTracks] = useState(() => normalizeHistory(getCachedRecentlyPlayed() || []));
    const [genres, setGenres] = useState(() => normalizeGenres(getCachedGenres() || []));
    const [albums, setAlbums] = useState([]);
    const [artists, setArtists] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const searchReqIdRef = useRef(0);

    useEffect(() => {
        loadData();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (genres.length === 0 || (tracks.length === 0 && recentTracks.length === 0)) {
                loadData();
            }
        }, [genres.length, tracks.length, recentTracks.length])
    );

    const loadData = async () => {
        const hasWarmData = recentTracks.length > 0 || genres.length > 0;
        if (!hasWarmData) setLoading(true);
        // 1) Fast data for first paint (independent, no global fail)
        const [recentRes, genresRes, iconsRes] = await Promise.allSettled([
            getRecentlyPlayed(!hasWarmData),
            getGenres({ force: !hasWarmData }),
            Object.keys(icons).length === 0 ? getIcons() : Promise.resolve(icons),
        ]);

        if (recentRes.status === 'fulfilled') {
            setRecentTracks(normalizeHistory(recentRes.value));
        }
        if (genresRes.status === 'fulfilled') {
            setGenres(normalizeGenres(genresRes.value));
        }
        if (iconsRes.status === 'fulfilled') {
            setIcons(iconsRes.value || {});
        }
        setLoading(false);

        // 2) Heavy data in background
        Promise.allSettled([
            getTracks({ force: !hasWarmData }),
            getAlbums({ force: !hasWarmData }),
            getAllArtists({ force: !hasWarmData }),
        ]).then(([tracksRes, albumsRes, artistsRes]) => {
            if (tracksRes.status === 'fulfilled') {
                setTracks(Array.isArray(tracksRes.value) ? tracksRes.value : []);
            }
            if (albumsRes.status === 'fulfilled') {
                setAlbums(Array.isArray(albumsRes.value) ? albumsRes.value : []);
            }
            if (artistsRes.status === 'fulfilled') {
                setArtists(Array.isArray(artistsRes.value) ? artistsRes.value : []);
            }
        });
    };

    const renderIcon = (iconName, size, tintColor = '#F5D8CB') => {
        const iconUrl = icons[iconName];
        if (!iconUrl) return <View style={{ width: size, height: size }} />;

        const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');
        if (isSvg) {
            return <ColoredSvg uri={iconUrl} width={size} height={size} color={tintColor} />;
        }

        return (
            <Image
                source={{ uri: iconUrl }}
                style={{ width: size, height: size, tintColor }}
                resizeMode="contain"
            />
        );
    };

    const getGenreBackgroundUrl = () => (
        icons['genrebg.png'] ||
        icons['genreBg.png'] ||
        icons['genrebg.PNG'] ||
        icons['genrebg.svg'] ||
        null
    );

    const filteredRecent = useMemo(() => recentTracks.slice(0, 16), [recentTracks]);

    useEffect(() => {
        const q = query.trim();
        const reqId = ++searchReqIdRef.current;

        if (!q) {
            setSearchResults([]);
            return;
        }

        const timeoutId = setTimeout(async () => {
            const lq = q.toLowerCase();
            const backendTracks = await searchTracksCombined(q);
            const artistsById = new Map(
                (Array.isArray(artists) ? artists : [])
                    .map((artist) => {
                        const id = artist?.id || artist?._id;
                        const name = String(getArtistName(artist) || '').trim();
                        return id && name ? [String(id), name] : null;
                    })
                    .filter(Boolean)
            );
            const tracksById = new Map(
                (Array.isArray(tracks) ? tracks : [])
                    .map((t) => {
                        const id = t?.id || t?._id;
                        return id ? [String(id), t] : null;
                    })
                    .filter(Boolean)
            );

            const resolveSearchArtistName = (track) => {
                const direct = resolveArtistName(track, '').trim();
                if (direct && direct.toLowerCase() !== 'unknown artist') return direct;

                const id = String(track?.id || track?._id || '');
                const cachedTrack = id ? tracksById.get(id) : null;
                const fromCachedTrack = resolveArtistName(cachedTrack, '').trim();
                if (fromCachedTrack && fromCachedTrack.toLowerCase() !== 'unknown artist') return fromCachedTrack;

                const artistId = track?.artistId || track?.ArtistId || track?.artist?.id || track?.artist?._id;
                if (artistId) {
                    const fromArtistList = artistsById.get(String(artistId));
                    if (fromArtistList) return fromArtistList;
                }

                return 'Unknown Artist';
            };

            const trackItems = (Array.isArray(backendTracks) ? backendTracks : [])
                .map((track) => {
                    const artist = resolveSearchArtistName(track);

                    return {
                        type: 'track',
                        id: track.id || track._id,
                        title: track.title || 'Unknown',
                        subtitle: artist,
                        imageUrl: getTrackCoverUrl(track),
                        payload: {
                            ...track,
                            artistName: artist,
                            artist: (typeof track?.artist === 'object' && track?.artist !== null)
                                ? { ...track.artist, name: track.artist.name || artist }
                                : { name: artist },
                        },
                    };
                });

            const artistItemsFromTracksMap = new Map();
            (Array.isArray(backendTracks) ? backendTracks : []).forEach((track, idx) => {
                const artistName = resolveSearchArtistName(track).trim();
                const artistId = track.artistId || track.ArtistId || track.artist?.id || track.artist?._id || null;
                const ownerId = track.ownerId || track.OwnerId || null;
                if (!artistName) return;
                if (artistName.toLowerCase() === 'unknown artist') return;
                if (!artistName.toLowerCase().startsWith(lq)) return;

                const key = String(artistId || `${artistName}-${idx}`).toLowerCase();
                if (!artistItemsFromTracksMap.has(key)) {
                    artistItemsFromTracksMap.set(key, {
                        type: 'artist',
                        id: artistId || key,
                        title: artistName,
                        subtitle: '',
                        imageUrl: getUserAvatarUrl(ownerId || artistId),
                        payload: {
                            id: artistId || key,
                            artistId: artistId || null,
                            ownerId: ownerId || null,
                            name: artistName,
                        },
                    });
                }
            });
            const artistItemsFromTracks = [...artistItemsFromTracksMap.values()];

            const albumItems = (Array.isArray(albums) ? albums : [])
                .filter((album) => String(album?.title || '').toLowerCase().startsWith(lq))
                .map((album) => {
                    const albumId = album.id || album._id || album.albumId || album.AlbumId;
                    return {
                        type: 'album',
                        id: albumId,
                        title: album.title || 'Album',
                        subtitle: album.artist?.name || album.artistName || album.artist || '',
                        imageUrl: albumId ? getAlbumCoverUrl(albumId) : null,
                        payload: album,
                    };
                });

            const artistItems = (Array.isArray(artists) ? artists : [])
                .filter((artist) => String(getArtistName(artist)).toLowerCase().startsWith(lq))
                .map((artist) => {
                    const artistId = artist.artistId || artist.ArtistId || artist.id || artist._id;
                    const ownerId = artist.ownerId || artist.OwnerId || null;
                    const artistName = getArtistName(artist);
                    return {
                        type: 'artist',
                        id: artistId,
                        title: artistName || 'Artist',
                        subtitle: '',
                        imageUrl: getUserAvatarUrl(ownerId || artistId),
                        payload: artist,
                    };
                });

            // Артистів ставимо першими, щоб їх не витісняли треки
            let result = [...artistItemsFromTracks, ...artistItems, ...albumItems, ...trackItems];

            const used = new Set();
            result = result.filter((item) => {
                const key = `${item.type}-${String(item.id || item.title).toLowerCase()}`;
                if (used.has(key)) return false;
                used.add(key);
                return true;
            });

            if (searchReqIdRef.current === reqId) {
                setSearchResults(result.slice(0, 20));
            }
        }, 260);

        return () => clearTimeout(timeoutId);
    }, [query, tracks, albums, artists]);

    const categories = useMemo(() => {
        const normalizedTracks = (tracks || []).map((track) => {
            const signals = getTrackGenreSignals(track);
            return { track, ...signals };
        });

        const fromBackendGenres = genres.map((genre) => {
            const genreId = String(genre.id);
            const genreName = genre.name.toLowerCase().trim();
            const sample = normalizedTracks.find((t) => (
                t.ids.includes(genreId) || t.names.includes(genreName)
            ))?.track;

            return {
                id: genre.id,
                name: genre.name,
                sampleTrack: sample || tracks.find((t) => getTrackCoverUrl(t)) || null,
            };
        });

        return fromBackendGenres;
    }, [genres, tracks]);

    const cardWidth = (SCREEN_WIDTH - scale(16) * 2 - scale(12)) / 2;
    const isSearchActive = query.trim().length > 0;

    const onOpenTrack = async (track) => {
        if (!track) return;
        try {
            await setTrack(track);
        } catch (_) {
            return;
        }
    };

    const onOpenSearchResult = async (item) => {
        if (!item) return;
        if (item.type === 'track') {
            await onOpenTrack(item.payload);
            return;
        }
        if (item.type === 'album') {
            const albumId = item.payload?.id || item.payload?._id || item.payload?.albumId || item.payload?.AlbumId;
            if (albumId) navigation.navigate('AlbumDetail', { id: albumId });
            return;
        }
        if (item.type === 'artist') {
            const artistId =
                item.payload?.artistId ||
                item.payload?.ArtistId ||
                item.payload?.id ||
                item.payload?._id;
            const ownerId = item.payload?.ownerId || item.payload?.OwnerId || null;
            navigation.navigate('ArtistProfile', {
                artist: {
                    ...item.payload,
                    id: artistId,
                    artistId: artistId,
                    ownerId: ownerId,
                    name: item.payload?.name || item.title,
                },
            });
        }
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
                    bounces={false}
                    overScrollMode="never"
                >
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            {renderIcon('arrow-left.svg', scale(22), '#F5D8CB')}
                        </TouchableOpacity>
                        <Text style={styles.title}>Search</Text>
                        <View style={styles.backButton} />
                    </View>

                    <View style={styles.searchShell}>
                        <View style={[styles.searchBar, isSearchActive && styles.searchBarActive]}>
                            <BlurView
                                intensity={72}
                                tint="dark"
                                style={styles.searchBarBlur}
                                pointerEvents="none"
                            />
                            <View style={styles.searchIconWrap}>
                                {renderIcon('search.svg', scale(22), 'rgba(245, 216, 203, 0.95)')}
                            </View>
                            <TextInput
                            keyboardAppearance="dark"
                                value={query}
                                onChangeText={setQuery}
                                placeholder="Artists, songs, genres"
                                placeholderTextColor="rgba(245, 216, 203, 0.45)"
                                style={styles.searchInput}
                                autoCorrect={false}
                                autoCapitalize="none"
                                selectionColor="#F5D8CB"
                            />
                        </View>

                        {isSearchActive && (
                            <View style={styles.searchOverlay}>
                                <BlurView
                                    intensity={78}
                                    tint="dark"
                                    style={styles.searchOverlayBlur}
                                    pointerEvents="none"
                                />
                                <View style={styles.searchResultsWrap}>
                                    {searchResults.length === 0 ? (
                                        <Text style={styles.emptySearchText}>No matches</Text>
                                    ) : (
                                        <ScrollView
                                            style={styles.searchResultsList}
                                            contentContainerStyle={styles.searchResultsListContent}
                                            showsVerticalScrollIndicator={false}
                                            bounces={false}
                                            overScrollMode="never"
                                            nestedScrollEnabled
                                        >
                                            {searchResults.map((item, index) => {
                                                const rowId = item.id || item._id || `s-${index}`;
                                                const coverUrl = item.imageUrl;
                                                return (
                                                    <TouchableOpacity
                                                        key={`${rowId}-${index}`}
                                                        style={styles.searchResultRow}
                                                        onPress={() => onOpenSearchResult(item)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <View style={styles.searchResultArtworkWrap}>
                                                            {item.type === 'track' ? (
                                                                <>
                                                                    {renderIcon('vinyl.svg', scale(46), null)}
                                                                    {coverUrl ? (
                                                                        <Image source={{ uri: coverUrl }} style={styles.searchResultCenterCover} />
                                                                    ) : (
                                                                        <View style={[styles.searchResultCenterCover, styles.recentCoverFallback]} />
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {coverUrl ? (
                                                                        <Image
                                                                            source={{ uri: coverUrl }}
                                                                            style={[
                                                                                styles.searchEntityCover,
                                                                                item.type === 'artist' && styles.searchArtistCover,
                                                                            ]}
                                                                        />
                                                                    ) : (
                                                                        <View
                                                                            style={[
                                                                                styles.searchEntityCover,
                                                                                item.type === 'artist' && styles.searchArtistCover,
                                                                                styles.recentCoverFallback,
                                                                            ]}
                                                                        />
                                                                    )}
                                                                </>
                                                            )}
                                                        </View>
                                                        <View style={styles.searchResultTextWrap}>
                                                            <Text style={styles.searchResultTitle} numberOfLines={1}>
                                                                {item.title || 'Unknown'}
                                                            </Text>
                                                            {item.subtitle ? (
                                                                <Text style={styles.searchResultArtist} numberOfLines={1}>
                                                                    {item.subtitle}
                                                                </Text>
                                                            ) : null}
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>

                    {loading && (
                        <View style={styles.loaderWrap}>
                            <ActivityIndicator size="small" color="#F5D8CB" />
                        </View>
                    )}
                    <>
                            <Text style={styles.sectionTitle}>Recent</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.recentScroll}
                                contentContainerStyle={styles.recentRow}
                            >
                                {filteredRecent.length === 0 ? (
                                    <Text style={styles.emptyText}>No recent tracks yet</Text>
                                ) : (
                                    filteredRecent.map((track, index) => {
                                        const trackId = track.id || track._id || `recent-${index}`;
                                        const coverUrl = getTrackCoverUrl(track);
                                        return (
                                            <TouchableOpacity
                                                key={`${trackId}-${index}`}
                                                style={styles.recentItem}
                                                onPress={() => onOpenTrack(track)}
                                                activeOpacity={0.8}
                                            >
                                                <View style={styles.recentVinylWrap}>
                                                    {renderIcon('vinyl.svg', scale(78), null)}
                                                    {coverUrl ? (
                                                        <Image source={{ uri: coverUrl }} style={styles.recentCover} />
                                                    ) : (
                                                        <View style={[styles.recentCover, styles.recentCoverFallback]} />
                                                    )}
                                                </View>
                                                <Text style={styles.recentTitle} numberOfLines={1}>
                                                    {track.title || 'Unknown'}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </ScrollView>

                            <Text style={[styles.sectionTitle, styles.categoriesTitle]}>Categories</Text>
                            <View style={styles.categoriesGrid}>
                                {categories.length === 0 ? (
                                    <Text style={styles.emptyText}>No categories yet</Text>
                                ) : (
                                    categories.map((genre, index) => {
                                        const coverUrl = getTrackCoverUrl(genre.sampleTrack);
                                        const genreBgUrl = getGenreBackgroundUrl() || coverUrl;
                                        return (
                                            <TouchableOpacity
                                                key={`${genre.id}-${index}`}
                                                style={[styles.categoryCard, { width: cardWidth }]}
                                                activeOpacity={0.85}
                                                onPress={() => navigation.navigate('GenreDetail', { genre, genreBgUrl })}
                                            >
                                                <View style={styles.categoryVinylWrap}>
                                                    {renderIcon('vinyl.svg', scale(107), null)}
                                                    {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.categoryCenterCover} /> : null}
                                                </View>

                                                {genreBgUrl ? (
                                                    <View style={styles.categoryLabelPanel}>
                                                        <Image
                                                            source={{ uri: genreBgUrl }}
                                                            style={styles.categoryLabelBgImage}
                                                            resizeMode="stretch"
                                                        />
                                                        <View style={styles.categoryLabelOverlay} />
                                                        <Text style={styles.categoryLabel} numberOfLines={1}>
                                                            {genre.name}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <View style={styles.categoryLabelPanelFallback}>
                                                        <Text style={styles.categoryLabel} numberOfLines={1}>
                                                            {genre.name}
                                                        </Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </View>
                    </>
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
        minHeight: SCREEN_HEIGHT,
    },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? scale(52) : (StatusBar.currentHeight || 0) + scale(16),
        paddingHorizontal: scale(16),
        paddingBottom: scale(150),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(10),
    },
    backButton: {
        width: scale(28),
        height: scale(28),
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(32),
        fontFamily: 'Unbounded-Regular',
    },
    searchBar: {
        position: 'relative',
        height: scale(38),
        borderRadius: scale(21),
        borderWidth: scale(1),
        borderColor: 'rgba(245, 216, 203, 0.28)',
        backgroundColor: 'rgba(84, 22, 20, 0.52)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        overflow: 'hidden',
    },
    searchBarActive: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderBottomWidth: 0,
        borderColor: 'rgba(245, 216, 203, 0.35)',
        backgroundColor: 'rgba(84, 22, 20, 0.62)',
    },
    searchBarBlur: {
        ...StyleSheet.absoluteFillObject,
    },
    searchIconWrap: {
        marginRight: scale(6),
    },
    searchInput: {
        flex: 1,
        color: '#F5D8CB',
        fontSize: scale(13),
        fontFamily: 'Poppins-Regular',
        paddingVertical: 0,
    },
    searchShell: {
        position: 'relative',
        zIndex: 30,
        minHeight: scale(38),
    },
    searchOverlay: {
        position: 'absolute',
        overflow: 'hidden',
        top: scale(37),
        left: 0,
        right: 0,
        maxHeight: 400,
        borderWidth: scale(1),
        borderTopWidth: 0,
        borderColor: 'rgba(245, 216, 203, 0.35)',
        backgroundColor: 'rgba(84, 22, 20, 0.62)',
        borderBottomLeftRadius: scale(21),
        borderBottomRightRadius: scale(21),
        zIndex: 40,
    },
    searchOverlayBlur: {
        ...StyleSheet.absoluteFillObject,
    },
    searchResultsWrap: {
        paddingHorizontal: scale(12),
        paddingTop: scale(6),
        paddingBottom: scale(8),
    },
    searchResultsList: {
        maxHeight: 400,
    },
    searchResultsListContent: {
        paddingBottom: scale(2),
    },
    searchResultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(6),
    },
    searchResultArtworkWrap: {
        width: scale(46),
        height: scale(46),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(10),
    },
    searchResultCenterCover: {
        position: 'absolute',
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        backgroundColor: '#2F0E0D',
    },
    searchEntityCover: {
        width: scale(46),
        height: scale(46),
        borderRadius: scale(10),
        backgroundColor: '#2F0E0D',
    },
    searchArtistCover: {
        borderRadius: scale(23),
    },
    searchResultTextWrap: {
        flex: 1,
    },
    searchResultTitle: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-SemiBold',
    },
    searchResultArtist: {
        marginTop: scale(1),
        color: '#F5D8CB',
        fontSize: scale(13),
        fontFamily: 'Poppins-Regular',
    },
    emptySearchText: {
        color: 'rgba(245, 216, 203, 0.72)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        paddingVertical: scale(8),
    },
    sectionTitle: {
        marginTop: scale(20),
        color: '#F5D8CB',
        fontSize: scale(28),
        fontFamily: 'Unbounded-SemiBold',
    },
    recentRow: {
        paddingTop: scale(10),
        paddingBottom: scale(20),
        paddingLeft: scale(16),
        paddingRight: 0,
    },
    recentScroll: {
        marginHorizontal: scale(-16),
    },
    recentItem: {
        width: scale(88),
        alignItems: 'center',
        marginRight: scale(10),
    },
    recentVinylWrap: {
        width: scale(78),
        height: scale(78),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(6),
    },
    recentCover: {
        position: 'absolute',
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: '#2F0E0D',
    },
    recentCoverFallback: {
        backgroundColor: '#51211A',
    },
    recentTitle: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },
    categoriesTitle: {
        marginTop: scale(12),
        marginBottom: scale(10),
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: scale(12),
    },
    categoryCard: {
        height: scale(107),
        borderRadius: scale(2),
        overflow: 'visible',
        backgroundColor: 'transparent',
        justifyContent: 'center',
    },
    categoryVinylWrap: {
        position: 'absolute',
        left: scale(53.5),
        width: scale(107),
        height: scale(107),
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    categoryCenterCover: {
        position: 'absolute',
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
    },
    categoryLabelPanel: {
        width: scale(107),
        height: scale(107),
        zIndex: 2,
        justifyContent: 'center',
        paddingHorizontal: scale(12),
        backgroundColor: 'rgba(180, 112, 90, 0.9)',
        overflow: 'hidden',
    },
    categoryLabelBgImage: {
        ...StyleSheet.absoluteFillObject,
        width: undefined,
        height: undefined,
    },
    categoryLabelOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(88, 34, 24, 0.15)',
    },
    categoryLabelPanelFallback: {
        width: scale(107),
        height: scale(107),
        justifyContent: 'center',
        paddingHorizontal: scale(12),
        backgroundColor: 'rgba(180, 89, 67, 0.8)',
        overflow: 'hidden',
    },
    categoryLabel: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-SemiBold',
        textAlign: 'center',
    },
    loaderWrap: {
        marginTop: scale(40),
        alignItems: 'center',
    },
    emptyText: {
        color: 'rgba(245, 216, 203, 0.72)',
        fontSize: scale(13),
        fontFamily: 'Poppins-Regular',
        paddingVertical: scale(6),
    },
});
