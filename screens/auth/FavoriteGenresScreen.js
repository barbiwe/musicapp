import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    Platform,
    Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

import { getFavoriteGenres, getGenres, saveFavoriteGenres, scale } from '../../api/api';

const toLowerSafe = (value) => String(value || '').trim().toLowerCase();

const normalizeGenres = (rawGenres) => {
    if (!Array.isArray(rawGenres)) return [];

    return rawGenres
        .map((g) => {
            if (!g || typeof g !== 'object') return null;
            const id = g?.id || g?.Id || g?._id || g?.genreId || g?.GenreId || g?.value;
            const label = String(g?.name || g?.Name || g?.title || g?.Title || g?.label || g?.Label || '').trim();
            if (!id || !label) return null;

            return {
                id: String(id),
                label: String(label),
            };
        })
        .filter(Boolean);
};

const buildFavoriteMatchers = (favorites) => {
    const byId = new Set();
    const byName = new Set();

    if (!Array.isArray(favorites)) {
        return { byId, byName };
    }

    favorites.forEach((item) => {
        if (typeof item === 'string' || typeof item === 'number') {
            const normalized = toLowerSafe(item);
            if (normalized) {
                byId.add(normalized);
                byName.add(normalized);
            }
            return;
        }

        if (!item || typeof item !== 'object') return;
        const id = toLowerSafe(item?.id || item?.Id || item?._id || item?.genreId || item?.GenreId || item?.value);
        const name = toLowerSafe(item?.name || item?.Name || item?.title || item?.Title || item?.label || item?.Label);
        if (id) byId.add(id);
        if (name) byName.add(name);
    });

    return { byId, byName };
};

const extractErrorText = (errorValue) => {
    if (!errorValue) return '';
    if (typeof errorValue === 'string') return errorValue;
    if (Array.isArray(errorValue)) return errorValue.join(' ');
    if (typeof errorValue === 'object') {
        if (typeof errorValue.message === 'string') return errorValue.message;
        if (typeof errorValue.title === 'string') return errorValue.title;
        if (typeof errorValue.error === 'string') return errorValue.error;
    }
    return String(errorValue);
};

export default function FavoriteGenresScreen({ navigation }) {
    const [genres, setGenres] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [saving, setSaving] = useState(false);
    const [isLoadingGenres, setIsLoadingGenres] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const loadGenres = async () => {
            try {
                const [backendGenres, backendFavorites] = await Promise.all([getGenres(), getFavoriteGenres()]);
                const normalized = normalizeGenres(backendGenres);
                const { byId, byName } = buildFavoriteMatchers(backendFavorites);

                if (isMounted) {
                    setGenres(normalized);
                    const preselected = new Set(
                        normalized
                            .filter((genre) => byId.has(toLowerSafe(genre.id)) || byName.has(toLowerSafe(genre.label)))
                            .map((genre) => genre.id)
                    );
                    setSelected(preselected);
                }
            } catch (_) {
                if (isMounted) {
                    setGenres([]);
                    setSelected(new Set());
                }
            } finally {
                if (isMounted) {
                    setIsLoadingGenres(false);
                }
            }
        };

        loadGenres();

        return () => {
            isMounted = false;
        };
    }, []);

    const selectedCount = selected.size;

    const toggleGenre = (genreId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(genreId)) {
                next.delete(genreId);
            } else {
                next.add(genreId);
            }
            return next;
        });
    };

    const selectedGenresData = useMemo(
        () => genres.filter((g) => selected.has(g.id)),
        [genres, selected]
    );

    const onConfirm = async () => {
        if (saving) return;

        setSaving(true);
        try {
            const genreIds = selectedGenresData
                .map((g) => String(g.id || ''))
                .map((id) => id.trim())
                .filter(Boolean);
            const genreNames = selectedGenresData.map((g) => g.label);

            if (!genreIds.length) {
                Alert.alert('Error', 'Please select at least one genre');
                return;
            }

            const saveResult = await saveFavoriteGenres(genreIds);
            if (saveResult?.error) {
                const errorText = extractErrorText(saveResult.error).toLowerCase();
                const isAlreadySelected = saveResult.status === 400 && errorText.includes('already selected');

                if (!isAlreadySelected) {
                    Alert.alert('Error', typeof saveResult.error === 'string' ? saveResult.error : 'Failed to save favorite genres');
                    return;
                }
            }

            const backendFavoritesAfterSave = await getFavoriteGenres();
            const { byId, byName } = buildFavoriteMatchers(backendFavoritesAfterSave);

            const syncedSelected = selectedGenresData.filter((genre) => {
                const genreId = toLowerSafe(genre.id);
                const genreName = toLowerSafe(genre.label);
                return byId.has(genreId) || byName.has(genreName);
            });

            const persistedIds = (syncedSelected.length > 0 ? syncedSelected : selectedGenresData)
                .map((g) => String(g.id || '').trim())
                .filter(Boolean);
            const persistedNames = (syncedSelected.length > 0 ? syncedSelected : selectedGenresData)
                .map((g) => String(g.label || '').trim())
                .filter(Boolean);

            await AsyncStorage.setItem('favoriteGenreIds', JSON.stringify(persistedIds));
            await AsyncStorage.setItem('favoriteGenreNames', JSON.stringify(persistedNames.length > 0 ? persistedNames : genreNames));
        } catch (_) {
            Alert.alert('Error', 'Failed to save favorite genres');
            return;
        } finally {
            setSaving(false);
        }

        navigation.replace('MainTabs');
    };

    return (
        <LinearGradient
            colors={['#9A4B39', '#80291E', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" />

            <View style={styles.container}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: scale(12), bottom: scale(12), left: scale(12), right: scale(12) }}
                >
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>

                <Text style={styles.title}>
                    Pick your{"\n"}favorite genre
                </Text>

                <ScrollView
                    style={styles.genresScroll}
                    contentContainerStyle={styles.genresContainer}
                    showsVerticalScrollIndicator={false}
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    alwaysBounceHorizontal={false}
                    directionalLockEnabled
                >
                    {!isLoadingGenres && genres.length === 0 ? (
                        <Text style={styles.emptyText}>No genres from backend</Text>
                    ) : null}

                    {genres.map((genre) => {
                        const isSelected = selected.has(genre.id);
                        return (
                            <TouchableOpacity
                                key={genre.id}
                                style={[
                                    styles.genreChipTouch,
                                    styles.genreChip,
                                    isSelected && styles.genreChipSelected,
                                    isSelected ? styles.genreChipFallbackSelected : styles.genreChipFallback,
                                ]}
                                onPress={() => toggleGenre(genre.id)}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.genreChipText}>
                                    {genre.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        selectedCount === 0 && styles.confirmButtonDisabled,
                    ]}
                    onPress={onConfirm}
                    disabled={saving || selectedCount === 0}
                    activeOpacity={0.85}
                >
                    <Text style={styles.confirmText}>Confirm</Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    emptyText: {
        color: '#F5D8CB',
        opacity: 0.8,
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        paddingHorizontal: scale(6),
    },
    container: {
        flex: 1,
        paddingHorizontal: scale(20),
        paddingTop: Platform.OS === 'ios' ? scale(64) : scale(42),
        paddingBottom: scale(34),
    },
    backButton: {
        width: scale(24),
        height: scale(24),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(72),
    },
    backArrow: {
        color: '#F5D8CB',
        fontSize: scale(28),
        lineHeight: scale(28),
        marginTop: scale(-2),
    },
    title: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(54 / 2),
        lineHeight: scale(74 / 2),
        marginBottom: scale(30),
    },
    genresScroll: {
        flex: 1,
    },
    genresContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingHorizontal: scale(1),
        paddingBottom: scale(12),
    },
    genreChipTouch: {
        marginHorizontal: scale(7),
        marginBottom: scale(14),
    },
    genreChip: {
        borderWidth: 1,
        borderColor: 'rgba(245, 216, 203, 0.55)',
        borderRadius: scale(18.5),
        paddingHorizontal: scale(14),
        minHeight: scale(37),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    genreChipSelected: {
        borderColor: 'rgba(245, 216, 203, 0.85)',
    },
    genreChipFallback: {
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
    },
    genreChipFallbackSelected: {
        backgroundColor: 'rgba(245, 216, 203, 0.22)',
    },
    genreChipText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(15),
        textAlign: 'center',
    },
    confirmButton: {
        marginTop: scale(18),
        height: scale(58),
        borderRadius: scale(32),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmButtonDisabled: {
        opacity: 0.5,
    },
    confirmText: {
        color: '#300C0A',
        fontFamily: 'Poppins-SemiBold',
        fontSize: scale(17),
    },
});
