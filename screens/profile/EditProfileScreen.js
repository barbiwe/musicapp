import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

import {
    addFavoriteGenre,
    removeFavoriteGenre,
    changeUsername,
    changeAvatar,
    getFavoriteGenres,
    getGenres,
    getIcons,
    getPodcastGenres,
    getUserAvatarUrl,
    scale,
} from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

const STORAGE_KEYS = {
    username: 'username',
    userId: 'userId',
    musicGenres: 'profile_music_genres_v1',
    podcastGenres: 'profile_podcast_genres_v1',
    favoriteGenreNames: 'favoriteGenreNames',
};

const normalizeGenre = (item, index = 0) => {
    if (typeof item === 'string') {
        const name = item.trim();
        if (!name) return null;
        return { id: name.toLowerCase(), name };
    }

    if (!item || typeof item !== 'object') return null;

    const rawId =
        item.id ??
        item.Id ??
        item.genreId ??
        item.GenreId ??
        item.slug ??
        item.Slug ??
        `${index}`;
    const rawName =
        item.name ??
        item.Name ??
        item.title ??
        item.Title ??
        item.label ??
        item.Label ??
        '';

    const name = String(rawName || '').trim();
    if (!name) return null;
    const id = String(rawId || name).trim().toLowerCase();
    return { id, name };
};

const parseStoredArrayWithMeta = async (key) => {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (raw === null || raw === undefined) return { exists: false, data: [] };
        const parsed = JSON.parse(raw);
        return {
            exists: true,
            data: Array.isArray(parsed) ? parsed.map((v) => String(v || '').trim()).filter(Boolean) : [],
        };
    } catch (_) {
        return { exists: false, data: [] };
    }
};

const toUnique = (arr) => {
    const seen = new Set();
    return arr.filter((item) => {
        const key = String(item || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

const normalizeNameKey = (value) => String(value || '').trim().toLowerCase();

const normalizeToKnownMusicGenres = (names, allMusicGenres) => {
    const byName = new Map(
        (Array.isArray(allMusicGenres) ? allMusicGenres : [])
            .map((genre) => [normalizeNameKey(genre?.name), String(genre?.name || '').trim()])
            .filter(([key, name]) => !!key && !!name)
    );

    const normalized = (Array.isArray(names) ? names : [])
        .map((name) => byName.get(normalizeNameKey(name)))
        .filter(Boolean);

    return toUnique(normalized);
};

const extractFavoriteMusicGenreNames = (rawFavorites, allMusicGenres) => {
    if (!Array.isArray(rawFavorites) || rawFavorites.length === 0) return [];

    const nameById = new Map(
        (Array.isArray(allMusicGenres) ? allMusicGenres : [])
            .map((genre) => [String(genre?.id || '').trim().toLowerCase(), String(genre?.name || '').trim()])
            .filter(([id, name]) => !!id && !!name)
    );
    const nameByName = new Map(
        (Array.isArray(allMusicGenres) ? allMusicGenres : [])
            .map((genre) => [normalizeNameKey(genre?.name), String(genre?.name || '').trim()])
            .filter(([key, name]) => !!key && !!name)
    );

    const resolveKnownName = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const byId = nameById.get(raw.toLowerCase());
        if (byId) return byId;
        const byName = nameByName.get(normalizeNameKey(raw));
        if (byName) return byName;
        return '';
    };

    const names = rawFavorites
        .map((item) => {
            if (typeof item === 'string' || typeof item === 'number') {
                return resolveKnownName(item);
            }

            if (!item || typeof item !== 'object') return '';

            const directName = resolveKnownName(String(
                item?.name ??
                item?.Name ??
                item?.title ??
                item?.Title ??
                item?.label ??
                item?.Label ??
                ''
            ).trim());
            if (directName) return directName;

            const id = String(
                item?.id ??
                item?.Id ??
                item?.genreId ??
                item?.GenreId ??
                item?.value ??
                ''
            ).trim().toLowerCase();
            if (!id) return '';
            return resolveKnownName(id);
        })
        .filter(Boolean);

    return toUnique(names);
};

export default function EditProfileScreen({ navigation, route }) {
    const [loading, setLoading] = useState(true);
    const [savingAvatar, setSavingAvatar] = useState(false);
    const [savingUsername, setSavingUsername] = useState(false);
    const [icons, setIcons] = useState({});
    const [username, setUsername] = useState('');
    const [savedUsername, setSavedUsername] = useState('');
    const [avatarUri, setAvatarUri] = useState(null);
    const [musicGenres, setMusicGenres] = useState([]);
    const [podcastGenres, setPodcastGenres] = useState([]);
    const [allMusicGenres, setAllMusicGenres] = useState([]);
    const [allPodcastGenres, setAllPodcastGenres] = useState([]);
    const handledPickerTokenRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [iconsMap, tracksGenresRaw, podcastsGenresRaw, backendFavoriteGenresRaw, storedName, storedUserId] = await Promise.all([
                    getIcons(),
                    getGenres(),
                    getPodcastGenres(),
                    getFavoriteGenres(),
                    AsyncStorage.getItem(STORAGE_KEYS.username),
                    AsyncStorage.getItem(STORAGE_KEYS.userId),
                ]);

                const normalizedTrackGenres = (Array.isArray(tracksGenresRaw) ? tracksGenresRaw : [])
                    .map((item, index) => normalizeGenre(item, index))
                    .filter(Boolean);
                const normalizedPodcastGenres = (Array.isArray(podcastsGenresRaw) ? podcastsGenresRaw : [])
                    .map((item, index) => normalizeGenre(item, index))
                    .filter(Boolean);

                const savedMusic = await parseStoredArrayWithMeta(STORAGE_KEYS.musicGenres);
                const savedPodcast = await parseStoredArrayWithMeta(STORAGE_KEYS.podcastGenres);
                const backendFavoriteMusic = extractFavoriteMusicGenreNames(
                    backendFavoriteGenresRaw,
                    normalizedTrackGenres
                );

                let initialMusic = [];
                if (Array.isArray(backendFavoriteGenresRaw)) {
                    // Backend is the source of truth when endpoint exists.
                    initialMusic = normalizeToKnownMusicGenres(backendFavoriteMusic, normalizedTrackGenres);
                } else if (savedMusic.exists) {
                    // Respect explicit empty local selection too.
                    initialMusic = normalizeToKnownMusicGenres(savedMusic.data, normalizedTrackGenres);
                }

                const initialPodcast = toUnique(savedPodcast.data);

                setIcons(iconsMap || {});
                setAllMusicGenres(normalizedTrackGenres);
                setAllPodcastGenres(normalizedPodcastGenres);
                setMusicGenres(initialMusic);
                setPodcastGenres(initialPodcast);
                const initialUsername = String(storedName || '');
                setUsername(initialUsername);
                setSavedUsername(initialUsername);
                if (storedUserId) {
                    setAvatarUri(`${getUserAvatarUrl(storedUserId)}?t=${Date.now()}`);
                } else {
                    setAvatarUri(null);
                }
            } catch (_) {
                // keep screen usable with local defaults
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    useEffect(() => {
        AsyncStorage.setItem(STORAGE_KEYS.musicGenres, JSON.stringify(musicGenres)).catch(() => {});
    }, [musicGenres]);

    useEffect(() => {
        AsyncStorage.setItem(STORAGE_KEYS.podcastGenres, JSON.stringify(podcastGenres)).catch(() => {});
    }, [podcastGenres]);

    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };

    const renderIcon = (iconName, width, height, color = '#F5D8CB', fallback = '') => (
        <RemoteTintIcon
            icons={icons}
            iconName={resolveIconName(iconName)}
            width={width}
            height={height}
            color={color}
            fallback={fallback}
        />
    );

    const musicGenreIdByName = useMemo(() => {
        const map = new Map();
        (Array.isArray(allMusicGenres) ? allMusicGenres : []).forEach((genre) => {
            const key = String(genre?.name || '').trim().toLowerCase();
            const id = String(genre?.id || '').trim();
            if (!key || !id) return;
            map.set(key, id);
        });
        return map;
    }, [allMusicGenres]);
    const musicGenreNameByLower = useMemo(() => {
        const map = new Map();
        (Array.isArray(allMusicGenres) ? allMusicGenres : []).forEach((genre) => {
            const key = normalizeNameKey(genre?.name);
            const name = String(genre?.name || '').trim();
            if (!key || !name) return;
            map.set(key, name);
        });
        return map;
    }, [allMusicGenres]);

    useEffect(() => {
        const token = route?.params?.genrePickerResultToken;
        const payload = route?.params?.genrePickerResult;
        if (!token || !payload || handledPickerTokenRef.current === token) return;
        handledPickerTokenRef.current = token;

        const type = payload?.type === 'podcast' ? 'podcast' : 'music';
        const selectedNames = toUnique(
            (Array.isArray(payload?.selectedGenres) ? payload.selectedGenres : [])
                .map((name) => String(name || '').trim())
                .filter(Boolean)
        );

        if (type === 'music') {
            const canonicalSelected = toUnique(
                selectedNames
                    .map((name) => musicGenreNameByLower.get(normalizeNameKey(name)))
                    .filter(Boolean)
            );
            const prevMusic = Array.isArray(musicGenres) ? musicGenres : [];
            const prevSet = new Set(prevMusic.map((name) => String(name).toLowerCase()));
            const nextSet = new Set(canonicalSelected.map((name) => String(name).toLowerCase()));

            canonicalSelected.forEach((name) => {
                const lowered = String(name).toLowerCase();
                if (prevSet.has(lowered)) return;
                const genreId = musicGenreIdByName.get(lowered);
                if (genreId) void addFavoriteGenre(genreId);
            });

            prevMusic.forEach((name) => {
                const lowered = String(name).toLowerCase();
                if (nextSet.has(lowered)) return;
                const genreId = musicGenreIdByName.get(lowered);
                if (genreId) void removeFavoriteGenre(genreId);
            });

            setMusicGenres(canonicalSelected);
            return;
        }

        setPodcastGenres(selectedNames);
    }, [route?.params?.genrePickerResultToken, route?.params?.genrePickerResult, musicGenres, musicGenreIdByName, musicGenreNameByLower]);

    const saveUsername = async (value) => {
        if (savingUsername) return;

        const safe = String(value || '').trim();
        if (!safe) {
            Alert.alert('Error', 'Username is required');
            return;
        }

        if (safe === String(savedUsername || '').trim()) {
            setUsername(safe);
            Keyboard.dismiss();
            return;
        }

        setSavingUsername(true);
        try {
            const result = await changeUsername(safe);
            if (result?.error) {
                const raw = result.error;
                let message = 'Failed to update username';
                if (typeof raw === 'string') {
                    message = raw;
                } else if (raw && typeof raw === 'object') {
                    if (typeof raw?.message === 'string' && raw.message.trim()) {
                        message = raw.message.trim();
                    } else if (typeof raw?.title === 'string' && raw.title.trim()) {
                        message = raw.title.trim();
                    } else if (raw?.errors && typeof raw.errors === 'object') {
                        const first = Object.values(raw.errors)
                            .flat()
                            .map((v) => String(v || '').trim())
                            .find(Boolean);
                        if (first) message = first;
                    }
                }
                Alert.alert('Error', message);
                return;
            }

            const finalName = String(
                result?.data?.username ||
                result?.data?.Username ||
                safe
            ).trim();
            setUsername(finalName);
            setSavedUsername(finalName);
            await AsyncStorage.setItem(STORAGE_KEYS.username, finalName);
            Keyboard.dismiss();
        } finally {
            setSavingUsername(false);
        }
    };

    const normalizedUsername = String(username || '').trim();
    const normalizedSavedUsername = String(savedUsername || '').trim();
    const hasUsernameChanges = normalizedUsername !== normalizedSavedUsername;

    const pickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Need access to gallery');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (result.canceled || !result.assets?.[0]?.uri) return;
        const uri = result.assets[0].uri;
        setAvatarUri(uri);
        setSavingAvatar(true);
        try {
            const res = await changeAvatar(uri);
            if (res?.error) {
                Alert.alert('Error', 'Avatar upload failed');
                return;
            }
            const userId = await AsyncStorage.getItem(STORAGE_KEYS.userId);
            if (userId) setAvatarUri(`${getUserAvatarUrl(userId)}?t=${Date.now()}`);
        } catch (_) {
            Alert.alert('Error', 'Avatar upload failed');
        } finally {
            setSavingAvatar(false);
        }
    };

    const openGenrePicker = (type) => {
        const safeType = type === 'podcast' ? 'podcast' : 'music';
        const selectedGenres = safeType === 'music'
            ? normalizeToKnownMusicGenres(musicGenres, allMusicGenres)
            : podcastGenres;
        const allGenres = safeType === 'music'
            ? toUnique(
                (allMusicGenres || [])
                    .map((genre) => String(genre?.name || '').trim())
                    .filter(Boolean)
            )
            : toUnique([
                ...(allPodcastGenres || [])
                    .map((genre) => String(genre?.name || '').trim())
                    .filter(Boolean),
                ...selectedGenres,
            ]);

        navigation.navigate('ProfileGenrePicker', {
            type: safeType,
            sourceKey: route?.key,
            allGenres,
            selectedGenres,
        });
    };

    const onRemoveGenre = (type, name) => {
        if (!name) return;
        if (type === 'music') {
            setMusicGenres((prev) => prev.filter((g) => g.toLowerCase() !== name.toLowerCase()));
            const genreId = musicGenreIdByName.get(String(name).toLowerCase());
            if (genreId) {
                void removeFavoriteGenre(genreId);
            }
        } else {
            setPodcastGenres((prev) => prev.filter((g) => g.toLowerCase() !== name.toLowerCase()));
        }
    };

    if (loading) {
        return (
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <View style={styles.loadingWrap}>
                    <ActivityIndicator color="#F5D8CB" />
                </View>
            </LinearGradient>
        );
    }

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
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        {renderIcon('arrow-left.svg', scale(24), scale(24), '#F5D8CB', '<')}
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Edit Profile</Text>
                    <View style={styles.headerRight} />
                </View>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.avatarWrap}>
                        <View style={styles.avatarMainWrap}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={styles.avatarPlaceholderText}>
                                        {(username || 'U').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity style={styles.avatarEditBtn} activeOpacity={0.85} onPress={pickAvatar}>
                                {savingAvatar ? (
                                    <ActivityIndicator size="small" color="#F5D8CB" />
                                ) : (
                                    renderIcon('edit.svg', scale(18), scale(18), '#F5D8CB', '✎')
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.inputCapsule}>
                        <View style={styles.inputIconCircle}>
                            {renderIcon('user.svg', scale(24), scale(24), '#F5D8CB', '👤')}
                        </View>
                        <TextInput
                            value={username}
                            onChangeText={setUsername}
                            editable={!savingUsername}
                            keyboardAppearance="dark"
                            returnKeyType="done"
                            blurOnSubmit
                            onSubmitEditing={() => saveUsername(username)}
                            placeholder="Your nick"
                            placeholderTextColor="rgba(245,216,203,0.55)"
                            style={styles.input}
                            selectionColor="#F5D8CB"
                            autoCapitalize="none"
                        />
                        {hasUsernameChanges && (
                            <TouchableOpacity
                                style={styles.doneInlineBtn}
                                onPress={() => saveUsername(username)}
                                disabled={savingUsername}
                                activeOpacity={0.85}
                            >
                                {savingUsername ? (
                                    <ActivityIndicator size="small" color="#2B0E0D" />
                                ) : (
                                    <Text style={styles.doneInlineBtnText}>Done</Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Music genres</Text>
                        <TouchableOpacity onPress={() => openGenrePicker('music')} activeOpacity={0.8}>
                            {renderIcon('libplus.svg', scale(26), scale(26), '#F5D8CB', '+')}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.chipsRow}>
                        {musicGenres.map((genre) => (
                            <View key={`music-${genre}`} style={styles.chip}>
                                <Text style={styles.chipText} numberOfLines={1}>{genre}</Text>
                                <TouchableOpacity onPress={() => onRemoveGenre('music', genre)} style={styles.chipCloseBtn}>
                                    <View style={styles.chipCloseIcon}>
                                        <View style={[styles.chipCloseLine, styles.chipCloseLineA]} />
                                        <View style={[styles.chipCloseLine, styles.chipCloseLineB]} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Podcast genres</Text>
                        <TouchableOpacity onPress={() => openGenrePicker('podcast')} activeOpacity={0.8}>
                            {renderIcon('libplus.svg', scale(26), scale(26), '#F5D8CB', '+')}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.chipsRow}>
                        {podcastGenres.map((genre) => (
                            <View key={`podcast-${genre}`} style={styles.chip}>
                                <Text style={styles.chipText} numberOfLines={1}>{genre}</Text>
                                <TouchableOpacity onPress={() => onRemoveGenre('podcast', genre)} style={styles.chipCloseBtn}>
                                    <View style={styles.chipCloseIcon}>
                                        <View style={[styles.chipCloseLine, styles.chipCloseLineA]} />
                                        <View style={[styles.chipCloseLine, styles.chipCloseLineB]} />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={() => Alert.alert('Delete Account', 'Account delete endpoint is not connected yet.')}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.deleteText}>Delete Account</Text>
                    </TouchableOpacity>

                    <View style={{ height: scale(40) }} />
                </ScrollView>
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
        paddingTop: scale(56),
    },
    loadingWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        marginTop: scale(6),
        marginBottom: scale(10),
    },
    backButton: {
        width: scale(24),
        height: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(16),
    },
    headerRight: {
        width: scale(24),
        height: scale(24),
    },
    scrollContent: {
        paddingHorizontal: scale(16),
        paddingBottom: scale(16),
    },
    avatarWrap: {
        alignItems: 'center',
        marginTop: scale(10),
        marginBottom: scale(18),
    },
    avatarMainWrap: {
        position: 'relative',
    },
    avatar: {
        width: scale(144),
        height: scale(144),
        borderRadius: scale(72),
        backgroundColor: 'rgba(30, 10, 8, 0.9)',
    },
    avatarPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarPlaceholderText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(36),
    },
    avatarEditBtn: {
        position: 'absolute',
        right: scale(-2),
        bottom: scale(-2),
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: 'rgba(48, 12, 10, 1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    inputCapsule: {
        height: scale(60),
        borderRadius: scale(30),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: scale(10),
        marginBottom: scale(22),
    },
    inputIconCircle: {
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(10),
        marginLeft: scale(-1),
    },
    input: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        paddingVertical: 0,
        paddingRight: scale(8),
    },
    doneInlineBtn: {
        height: scale(28),
        borderRadius: scale(14),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.65)',
        backgroundColor: 'rgba(245,216,203,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: scale(12),
        marginLeft: scale(8),
    },
    doneInlineBtnText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Medium',
        fontSize: scale(12),
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(12),
        marginTop: scale(4),
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(15),
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: scale(14),
    },
    chip: {
        width: '48%',
        minHeight: scale(40),
        borderRadius: scale(20),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.55)',
        backgroundColor: 'rgba(48, 12, 10, 0.35)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(12),
        marginBottom: scale(10),
    },
    chipText: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12.5),
        marginRight: scale(8),
    },
    chipCloseBtn: {
        width: scale(18),
        height: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipCloseIcon: {
        width: scale(12),
        height: scale(12),
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipCloseLine: {
        position: 'absolute',
        width: scale(10),
        height: 1.5,
        borderRadius: 1,
        backgroundColor: '#F5D8CB',
    },
    chipCloseLineA: {
        transform: [{ rotate: '45deg' }],
    },
    chipCloseLineB: {
        transform: [{ rotate: '-45deg' }],
    },
    deleteBtn: {
        alignSelf: 'center',
        marginTop: scale(52),
    },
    deleteText: {
        color: 'rgba(245,216,203,0.45)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
});
