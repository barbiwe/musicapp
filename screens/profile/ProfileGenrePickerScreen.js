import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

const toNormalizedName = (value) => String(value || '').trim().toLowerCase();

const toUniqueNames = (items) => {
    const seen = new Set();
    const out = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
        const name = String(item || '').trim();
        const key = toNormalizedName(name);
        if (!name || !key || seen.has(key)) return;
        seen.add(key);
        out.push(name);
    });
    return out;
};

const setsEqual = (a, b) => {
    if (a.size !== b.size) return false;
    for (const value of a) {
        if (!b.has(value)) return false;
    }
    return true;
};

export default function ProfileGenrePickerScreen({ route, navigation }) {
    const pickerType = route?.params?.type === 'podcast' ? 'podcast' : 'music';
    const sourceKey = route?.params?.sourceKey || null;
    const screenTitle = pickerType === 'music' ? 'Music genres' : 'Podcast genres';

    const allGenres = useMemo(
        () => toUniqueNames(route?.params?.allGenres),
        [route?.params?.allGenres]
    );
    const initialSelectedNames = useMemo(
        () => toUniqueNames(route?.params?.selectedGenres),
        [route?.params?.selectedGenres]
    );

    const initialSelectedRef = useRef(
        new Set(initialSelectedNames.map((name) => toNormalizedName(name)))
    );

    const [icons, setIcons] = useState({});
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(() => new Set(initialSelectedRef.current));

    useEffect(() => {
        let mounted = true;
        getIcons()
            .then((map) => {
                if (mounted) setIcons(map || {});
            })
            .catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);

    const hasChanges = useMemo(
        () => !setsEqual(selected, initialSelectedRef.current),
        [selected]
    );

    const filteredGenres = useMemo(() => {
        const q = toNormalizedName(query);
        if (!q) return allGenres;
        return allGenres.filter((name) => toNormalizedName(name).includes(q));
    }, [allGenres, query]);

    const renderIcon = (iconName, width, height, color = '#F5D8CB', fallback = '') => (
        <RemoteTintIcon
            icons={icons}
            iconName={iconName}
            width={width}
            height={height}
            color={color}
            fallback={fallback}
        />
    );

    const onToggleGenre = (name) => {
        const key = toNormalizedName(name);
        if (!key) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const onSave = () => {
        const selectedGenres = allGenres.filter((name) => selected.has(toNormalizedName(name)));
        const payload = {
            type: pickerType,
            selectedGenres,
        };

        if (sourceKey) {
            navigation.navigate({
                key: sourceKey,
                params: {
                    genrePickerResult: payload,
                    genrePickerResultToken: Date.now(),
                },
                merge: true,
            });
        } else {
            navigation.setParams({
                genrePickerResult: payload,
                genrePickerResultToken: Date.now(),
            });
        }

        navigation.goBack();
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
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backButton}
                        hitSlop={{ top: scale(16), bottom: scale(16), left: scale(16), right: scale(16) }}
                    >
                        {renderIcon('arrow-left.svg', scale(24), scale(24), '#F5D8CB', '<')}
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{screenTitle}</Text>
                    <View style={styles.headerSideSpacer} />
                </View>

                <View style={styles.searchWrap}>
                    <View style={styles.searchIconWrap}>
                        {renderIcon('search.svg', scale(28), scale(28), '#F5D8CB', '⌕')}
                    </View>
                    <TextInput
                        value={query}
                        onChangeText={setQuery}
                        keyboardAppearance="dark"
                        placeholder="Search genres..."
                        placeholderTextColor="rgba(245,216,203,0.45)"
                        style={styles.searchInput}
                        selectionColor="#F5D8CB"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>

                <Text style={styles.sectionTitle}>Set your taste</Text>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.chipsGrid}>
                        {filteredGenres.map((name) => {
                            const key = toNormalizedName(name);
                            const isSelected = selected.has(key);
                            return (
                                <TouchableOpacity
                                    key={`${pickerType}-${key}`}
                                    style={[styles.genreChip, isSelected && styles.genreChipSelected]}
                                    activeOpacity={0.82}
                                    onPress={() => onToggleGenre(name)}
                                >
                                    <Text
                                        style={[styles.genreChipText, isSelected && styles.genreChipTextSelected]}
                                        numberOfLines={1}
                                    >
                                        {name}
                                    </Text>
                                    {isSelected ? (
                                        <View style={styles.genreChipActionIcon}>
                                            {renderIcon('check.svg', scale(16), scale(16), '#F5D8CB', '✓')}
                                        </View>
                                    ) : (
                                        <View style={styles.genreChipActionIcon}>
                                            {renderIcon('libplus.svg', scale(14), scale(14), '#F5D8CB', '+')}
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {filteredGenres.length === 0 && (
                        <Text style={styles.emptyText}>No genres found</Text>
                    )}

                    <View style={styles.bottomArea}>
                        <TouchableOpacity
                            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
                            onPress={onSave}
                            disabled={!hasChanges}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>
                                Save changes
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.hintText}>You can update this anytime</Text>
                    </View>
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
        paddingHorizontal: scale(24),
    },
    header: {
        height: scale(44),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: scale(24),
    },
    backButton: {
        width: scale(24),
        height: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerSideSpacer: {
        width: scale(24),
        height: scale(24),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(18),
        textAlign: 'center',
    },
    searchWrap: {
        height: scale(38),
        borderRadius: scale(19),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.35)',
        backgroundColor: 'rgba(48, 12, 10, 0.35)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(12),
        marginBottom: scale(22),
    },
    searchIconWrap: {
        width: scale(26),
        height: scale(26),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(6),
    },
    searchInput: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        paddingVertical: 0,
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(16),
        marginBottom: scale(16),
    },
    listContent: {
        paddingBottom: scale(34),
    },
    chipsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    genreChip: {
        width: '46.8%',
        height: scale(37),
        borderRadius: scale(18.5),
        borderWidth: 1,
        borderColor: 'rgba(245,216,203,0.5)',
        backgroundColor: 'rgba(48, 12, 10, 0.35)',
        marginBottom: scale(14),
        paddingHorizontal: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    genreChipSelected: {
        backgroundColor: '#AC654F',
        borderColor: '#AC654F',
    },
    genreChipText: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
        marginRight: scale(8),
    },
    genreChipTextSelected: {
        color: '#F5D8CB',
    },
    genreChipActionIcon: {
        width: scale(18),
        height: scale(18),
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: 'rgba(245,216,203,0.72)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
        textAlign: 'center',
        marginTop: scale(20),
    },
    bottomArea: {
        marginTop: scale(34),
    },
    saveButton: {
        height: scale(66),
        borderRadius: scale(33),
        backgroundColor: '#AC654F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonDisabled: {
        opacity: 0.5,
    },
    saveButtonText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(17),
    },
    saveButtonTextDisabled: {
        color: 'rgba(245,216,203,0.7)',
    },
    hintText: {
        textAlign: 'center',
        marginTop: scale(16),
        color: 'rgba(245,216,203,0.3)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(11.5),
    },
});
