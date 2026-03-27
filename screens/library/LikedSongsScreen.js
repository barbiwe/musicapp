import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    StatusBar,
    Platform,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';

import {
    getGenres,
    getIcons,
    getLikedTracks,
    getTrackCoverUrl,
    getTracks,
    likeTrack,
    resolveArtistName,
    scale,
    unlikeTrack,
} from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';
import { usePlayerStore } from '../../store/usePlayerStore';

const getTrackId = (track) => String(track?.id || track?._id || track?.trackId || track?.track?.id || '').trim();

const normalizeGenreLabel = (item) => {
    if (typeof item === 'string') return item.trim();
    return String(item?.name || item?.title || item?.label || '').trim();
};

const normalizeGenres = (rawGenres) => {
    if (!Array.isArray(rawGenres)) return [];
    const used = new Set();
    const out = [];

    rawGenres.forEach((item) => {
        const label = normalizeGenreLabel(item);
        if (!label) return;
        const key = label.toLowerCase();
        if (used.has(key)) return;
        used.add(key);
        out.push(label);
    });

    return out;
};

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

let likedSongsSessionCache = null;

export default function LikedSongsScreen({ navigation }) {
    const isFocused = useIsFocused();
    const hasLoadedOnceRef = useRef(Boolean(likedSongsSessionCache));
    const setTrack = usePlayerStore((state) => state.setTrack);
    const setQueue = usePlayerStore((state) => state.setQueue);

    const [icons, setIcons] = useState(() => likedSongsSessionCache?.icons || {});
    const [loading, setLoading] = useState(!likedSongsSessionCache);
    const [tracks, setTracks] = useState(() => likedSongsSessionCache?.tracks || []);
    const [likedIds, setLikedIds] = useState(() => likedSongsSessionCache?.likedIds || []);
    const [genres, setGenres] = useState(() => likedSongsSessionCache?.genres || []);
    const [selectedGenre, setSelectedGenre] = useState(() => likedSongsSessionCache?.selectedGenre || 'All');
    const [brokenCovers, setBrokenCovers] = useState({});
    const [sortOpen, setSortOpen] = useState(false);
    const [selectedSort, setSelectedSort] = useState(() => likedSongsSessionCache?.selectedSort || 'recent');

    const sortOptions = [
        { key: 'recent', label: 'Recently added' },
        { key: 'artist', label: 'By artist' },
        { key: 'alphabetical', label: 'Alphabetical' },
    ];

    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };

    const loadData = async ({ force = false, silent = false } = {}) => {
        if (!force && likedSongsSessionCache) {
            setIcons(likedSongsSessionCache.icons || {});
            setTracks(likedSongsSessionCache.tracks || []);
            setLikedIds(likedSongsSessionCache.likedIds || []);
            setGenres(likedSongsSessionCache.genres || []);
            setSelectedGenre(likedSongsSessionCache.selectedGenre || 'All');
            setSelectedSort(likedSongsSessionCache.selectedSort || 'recent');
            setBrokenCovers({});
            if (!silent) setLoading(false);
            hasLoadedOnceRef.current = true;
            return;
        }

        if (!silent) setLoading(true);
        try {
            const [iconsMap, likedRaw, allTracksRaw, genresRaw] = await Promise.all([
                getIcons(),
                getLikedTracks({ force }),
                getTracks({ force }),
                getGenres(),
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
            const normalizedGenres = normalizeGenres(genresRaw);

            setIcons(iconsMap || {});
            setLikedIds(likedIdList);
            setTracks(merged);
            setGenres(normalizedGenres);
            setSelectedGenre('All');
            setBrokenCovers({});
            likedSongsSessionCache = {
                icons: iconsMap || {},
                tracks: merged,
                likedIds: likedIdList,
                genres: normalizedGenres,
                selectedGenre: 'All',
                selectedSort: selectedSort || 'recent',
            };
        } catch (_) {
            if (!silent) {
                hasLoadedOnceRef.current = false;
                setTracks([]);
                setLikedIds([]);
                setGenres([]);
                likedSongsSessionCache = {
                    icons: {},
                    tracks: [],
                    likedIds: [],
                    genres: [],
                    selectedGenre: 'All',
                    selectedSort: selectedSort || 'recent',
                };
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (!isFocused) return;
        if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            loadData({ force: false });
            return;
        }
        loadData({ force: true, silent: true });
    }, [isFocused]);

    useEffect(() => {
        if (!hasLoadedOnceRef.current) return;
        likedSongsSessionCache = {
            icons,
            tracks,
            likedIds,
            genres,
            selectedGenre,
            selectedSort,
        };
    }, [icons, tracks, likedIds, genres, selectedGenre, selectedSort]);

    const filteredTracks = useMemo(() => {
        const likedSet = new Set(likedIds);
        let list = tracks.filter((track) => likedSet.has(getTrackId(track)));

        if (selectedGenre !== 'All') {
            const selected = selectedGenre.toLowerCase();
            list = list.filter((track) => {
                const raw = Array.isArray(track?.genres) ? track.genres : [];
                return raw.some((g) => normalizeGenreLabel(g).toLowerCase() === selected);
            });
        }

        if (selectedSort === 'artist') {
            list = [...list].sort((a, b) => {
                const aName = String(resolveArtistName(a) || '').toLowerCase();
                const bName = String(resolveArtistName(b) || '').toLowerCase();
                return aName.localeCompare(bName);
            });
        } else if (selectedSort === 'alphabetical') {
            list = [...list].sort((a, b) => {
                const aTitle = String(a?.title || '').toLowerCase();
                const bTitle = String(b?.title || '').toLowerCase();
                return aTitle.localeCompare(bTitle);
            });
        } else {
            list = [...list].sort((a, b) => {
                const aTime = Date.parse(a?.uploadedAt || a?.createdAt || a?.created || '') || 0;
                const bTime = Date.parse(b?.uploadedAt || b?.createdAt || b?.created || '') || 0;
                return bTime - aTime;
            });
        }

        return list;
    }, [tracks, likedIds, selectedGenre, selectedSort]);

    const genreChips = useMemo(() => {
        const likedSet = new Set(likedIds);
        const likedTracks = tracks.filter((track) => likedSet.has(getTrackId(track)));

        const presentGenres = new Set();
        likedTracks.forEach((track) => {
            const raw = Array.isArray(track?.genres) ? track.genres : [];
            raw.forEach((g) => {
                const label = normalizeGenreLabel(g);
                if (label) presentGenres.add(label.toLowerCase());
            });
        });

        const backendGenres = Array.isArray(genres) ? genres : [];
        const visible = backendGenres.filter((g) => presentGenres.has(String(g).toLowerCase()));

        return ['All', ...visible];
    }, [tracks, likedIds, genres]);

    useEffect(() => {
        if (!genreChips.includes(selectedGenre)) {
            setSelectedGenre('All');
        }
    }, [genreChips, selectedGenre]);

    const onToggleLike = async (track) => {
        const id = getTrackId(track);
        if (!id) return;

        const isLiked = likedIds.includes(id);
        const prev = likedIds;
        const next = isLiked ? likedIds.filter((x) => x !== id) : [...likedIds, id];
        setLikedIds(next);

        const ok = isLiked ? await unlikeTrack(id) : await likeTrack(id);
        if (!ok) setLikedIds(prev);
    };

    const onOpenTrack = async (track) => {
        await setTrack(track);
        navigation.navigate('Player');
    };

    const onShuffleLiked = async () => {
        const likedSet = new Set(likedIds);
        const likedTracks = tracks.filter((track) => likedSet.has(getTrackId(track)));
        if (!likedTracks.length) return;

        const shuffled = [...likedTracks];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        await setQueue(shuffled, 0);
        setSortOpen(false);
    };

    return (
        <LinearGradient
            colors={['#9A4B39', '#80291E', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.headerSideButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                    >
                        <RemoteTintIcon
                            icons={icons}
                            iconName={resolveIconName('arrow-left.svg')}
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback=""
                        />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Liked songs</Text>

                    <TouchableOpacity style={styles.headerSideButton} activeOpacity={0.8}>
                        <RemoteTintIcon
                            icons={icons}
                            iconName={resolveIconName('search.svg')}
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback=""
                        />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsContent}
                    style={styles.chipsScroll}
                >
                    {genreChips.map((g) => {
                        const isActive = selectedGenre === g;
                        return (
                            <TouchableOpacity
                                key={g}
                                style={[styles.chip, isActive && styles.chipActive]}
                                activeOpacity={0.85}
                                onPress={() => setSelectedGenre(g)}
                            >
                                <Text style={styles.chipText}>{g}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {sortOpen ? (
                    <Pressable style={styles.sortDismissLayer} onPress={() => setSortOpen(false)} />
                ) : null}

                <View style={styles.sortRow}>
                    <View style={styles.sortWrap}>
                        {sortOpen ? (
                            <Pressable pointerEvents="none" style={styles.sortBackdrop} />
                        ) : null}

                        <TouchableOpacity
                            style={styles.sortSelector}
                            activeOpacity={0.85}
                            onPress={() => setSortOpen((prev) => !prev)}
                        >
                            <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                            <LinearGradient
                                colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <Text style={styles.sortSelectorText}>
                                {sortOptions.find((item) => item.key === selectedSort)?.label || 'Recently added'}
                            </Text>
                            <RemoteTintIcon
                                icons={icons}
                                iconName={resolveIconName(sortOpen ? 'arrow-up.svg' : 'arrow-down.svg')}
                                width={scale(20)}
                                height={scale(20)}
                                color="#F5D8CB"
                                fallback=""
                            />
                        </TouchableOpacity>

                        {sortOpen ? (
                            <View style={styles.dropdownShell}>
                                <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                                <LinearGradient
                                    colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />

                                {sortOptions.map((option) => {
                                    const active = selectedSort === option.key;
                                    return (
                                        <TouchableOpacity
                                            key={option.key}
                                            style={styles.dropdownItem}
                                            activeOpacity={0.85}
                                            onPress={() => {
                                                setSelectedSort(option.key);
                                                setSortOpen(false);
                                            }}
                                        >
                                            <Text style={[styles.dropdownItemText, active && styles.dropdownItemTextActive]}>
                                                {option.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        ) : null}
                    </View>

                    <TouchableOpacity
                        style={styles.shuffleButton}
                        activeOpacity={0.85}
                        onPress={onShuffleLiked}
                    >
                        <RemoteTintIcon
                            icons={icons}
                            iconName={resolveIconName('shuffle.svg')}
                            width={scale(18)}
                            height={scale(18)}
                            color="#F5D8CB"
                            fallback=""
                        />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator size="small" color="#F5D8CB" />
                    </View>
                ) : (
                    <ScrollView
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {filteredTracks.map((track) => {
                            const id = getTrackId(track);
                            const coverUri = id ? getTrackCoverUrl(track) : null;
                            const broken = brokenCovers[id];
                            const isLiked = likedIds.includes(id);

                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={styles.trackRow}
                                    activeOpacity={0.8}
                                    onPress={() => onOpenTrack(track)}
                                >
                                    {coverUri && !broken ? (
                                        <Image
                                            source={{ uri: coverUri }}
                                            style={styles.cover}
                                            resizeMode="cover"
                                            onError={() => setBrokenCovers((prev) => ({ ...prev, [id]: true }))}
                                        />
                                    ) : (
                                        <View style={[styles.cover, styles.coverFallback]} />
                                    )}

                                    <View style={styles.trackMeta}>
                                        <Text style={styles.trackTitle} numberOfLines={1}>
                                            {track?.title || 'Unknown title'}
                                        </Text>
                                        <Text style={styles.trackArtist} numberOfLines={1}>
                                            {resolveArtistName(track)}
                                        </Text>
                                    </View>

                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        activeOpacity={0.8}
                                        onPress={() => onToggleLike(track)}
                                    >
                                        <RemoteTintIcon
                                            icons={icons}
                                            iconName={resolveIconName(isLiked ? 'added.svg' : 'add.svg')}
                                            width={scale(20)}
                                            height={scale(20)}
                                            color="#F5D8CB"
                                            fallback=""
                                        />
                                    </TouchableOpacity>
                                </TouchableOpacity>
                            );
                        })}

                        <View style={{ height: scale(120) }} />
                    </ScrollView>
                )}
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? scale(58) : scale(42),
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(16),
    },
    headerSideButton: {
        width: scale(32),
        height: scale(32),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(30),
    },
    chipsScroll: {
        marginTop: scale(16),
        maxHeight: scale(50),
    },
    chipsContent: {
        paddingLeft: scale(20),
        paddingRight: scale(6),
    },
    chip: {
        height: scale(36),
        borderRadius: scale(18),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(24),
        marginRight: scale(10),
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
    },
    chipActive: {
        backgroundColor: '#AC654F',
        borderColor: '#AC654F',
    },
    chipText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
    sortRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: scale(10),
        marginBottom: scale(10),
        zIndex: 20,
    },
    sortWrap: {
        position: 'relative',
        zIndex: 20,
        marginLeft: scale(16),
        width: '68%',
    },
    sortSelector: {
        height: scale(37),
        borderRadius: scale(26),
        borderWidth: 0.3,
        borderColor: 'rgba(255, 236, 223, 1)',
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(18),
        zIndex: 22,
    },
    sortSelectorText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
    sortBackdrop: {
        position: 'absolute',
        top: 0,
        left: -scale(220),
        right: -scale(220),
        bottom: -scale(1300),
        zIndex: 22,
    },
    sortDismissLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 19,
    },
    dropdownShell: {
        position: 'absolute',
        top: scale(20),
        left: 0,
        right: 0,
        borderWidth: 0.3,
        borderTopWidth: 0,
        borderColor: 'rgba(255, 236, 223, 1)',
        borderBottomLeftRadius: scale(26),
        borderBottomRightRadius: scale(26),
        overflow: 'hidden',
        zIndex: 21,
        paddingTop: scale(12),
        paddingBottom: scale(14),
    },
    dropdownItem: {
        paddingVertical: scale(14),
        paddingHorizontal: scale(24),
    },
    dropdownItemText: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    dropdownItemTextActive: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-SemiBold',
    },
    shuffleButton: {
        width: scale(24),
        height: scale(24),
        marginLeft: 'auto',
        marginRight: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: scale(10),
        paddingHorizontal: scale(16),
    },
    trackRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',
        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),
        paddingRight: scale(10),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    cover: {
        width: scale(80),
        height: scale(80),
        borderTopLeftRadius: scale(18),
        borderBottomLeftRadius: scale(18),
        borderTopRightRadius: scale(10),
        borderBottomRightRadius: scale(10),
        backgroundColor: 'rgba(25, 7, 7, 0.8)',
    },
    coverFallback: {
        backgroundColor: 'rgba(20, 8, 8, 0.8)',
    },
    trackMeta: {
        flex: 1,
        paddingLeft: scale(12),
        paddingRight: scale(6),
    },
    trackTitle: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(15),
        marginBottom: scale(2),
    },
    trackArtist: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Light',
        fontSize: scale(10.5),
    },
    actionButton: {
        width: scale(30),
        height: scale(30),
        alignItems: 'center',
        justifyContent: 'center',
    },
});
