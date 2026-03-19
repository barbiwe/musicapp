import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Pressable,
    TextInput,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import {
    becomeAuthor,
    clearIconsCache,
    getArtistSpecializations,
    getCountries,
    getIcons,
    scale,
} from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

const MAX_DESCRIPTION = 200;
const toNumericId = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const normalizeSpecializations = (rawGenres) => {
    if (!Array.isArray(rawGenres)) return [];

    const used = new Set();
    return rawGenres
        .map((item, index) => {
            if (typeof item === 'string') {
                const label = item.trim();
                if (!label) return null;
                return {
                    id: index,
                    label,
                };
            }

            const label = String(
                item?.name ||
                item?.Name ||
                item?.title ||
                item?.Title ||
                item?.label ||
                item?.Label ||
                ''
            ).trim();
            if (!label) return null;
            const id =
                toNumericId(
                    item?.id ??
                    item?.Id ??
                    item?._id ??
                    item?.genreId ??
                    item?.GenreId ??
                    item?.value ??
                    item?.Value
                ) ??
                index;
            return {
                id,
                label,
            };
        })
        .filter(Boolean)
        .filter((genre) => {
            const key = genre.label.toLowerCase();
            if (used.has(key)) return false;
            used.add(key);
            return true;
        });
};

const normalizeCountries = (rawCountries) => {
    if (!Array.isArray(rawCountries)) return [];

    const used = new Set();
    return rawCountries
        .map((item, index) => {
            if (typeof item === 'string') {
                const label = item.trim();
                if (!label) return null;
                return {
                    id: index,
                    label,
                };
            }

            const label = String(
                item?.name ||
                item?.Name ||
                item?.title ||
                item?.Title ||
                item?.label ||
                item?.Label ||
                item?.value ||
                item?.Value ||
                ''
            ).trim();
            if (!label) return null;
            const id =
                toNumericId(
                    item?.id ??
                    item?.Id ??
                    item?._id ??
                    item?.code ??
                    item?.Code ??
                    item?.value ??
                    item?.Value
                ) ??
                index;
            return {
                id,
                label,
            };
        })
        .filter(Boolean)
        .filter((countryItem) => {
            const key = countryItem.label.toLowerCase();
            if (used.has(key)) return false;
            used.add(key);
            return true;
        });
};

export default function RequestDetailsScreen({ navigation }) {
    const [icons, setIcons] = useState({});
    const [nick, setNick] = useState('');
    const [genre, setGenre] = useState('');
    const [selectedGenreId, setSelectedGenreId] = useState(null);
    const [country, setCountry] = useState('');
    const [selectedCountryId, setSelectedCountryId] = useState(null);
    const [description, setDescription] = useState('');
    const [genres, setGenres] = useState([]);
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const [isGenresLoading, setIsGenresLoading] = useState(true);
    const [countries, setCountries] = useState([]);
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [isCountriesLoading, setIsCountriesLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            clearIconsCache();
            try {
                const [iconsMap, genresData, countriesData] = await Promise.all([
                    getIcons(),
                    getArtistSpecializations(),
                    getCountries(),
                ]);

                if (!mounted) return;
                setIcons(iconsMap || {});
                setGenres(normalizeSpecializations(genresData));
                setCountries(normalizeCountries(countriesData));
            } catch (_) {
                if (!mounted) return;
                setGenres([]);
                setCountries([]);
            } finally {
                if (mounted) {
                    setIsGenresLoading(false);
                    setIsCountriesLoading(false);
                }
            }
        };

        loadData();

        return () => {
            mounted = false;
        };
    }, []);

    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };

    const handleConfirm = async () => {
        const username = String(nick || '').trim();
        const aboutMe = String(description || '').trim();
        const countryId = toNumericId(selectedCountryId);
        const specialization = toNumericId(selectedGenreId);

        if (!username) {
            Alert.alert('Request', 'Enter nickname.');
            return;
        }

        if (countryId === null || countryId === undefined) {
            Alert.alert('Request', 'Select country.');
            return;
        }

        if (specialization === null || specialization === undefined) {
            Alert.alert('Request', 'Select specialization.');
            return;
        }

        if (!aboutMe) {
            Alert.alert('Request', 'Enter profile description.');
            return;
        }

        setIsSubmitting(true);
        const result = await becomeAuthor({
            username,
            country: countryId,
            aboutMe,
            specialization,
        });
        setIsSubmitting(false);

        if (result?.success) {
            navigation.reset({
                index: 1,
                routes: [
                    { name: 'MainTabs' },
                    { name: 'Profile' },
                ],
            });
            return;
        }

        const message =
            typeof result?.error === 'string'
                ? result.error
                : result?.error?.message || 'Failed to send author request.';
        Alert.alert('Request', message);
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

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.container}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        activeOpacity={0.8}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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

                    {isGenreOpen || isCountryOpen ? (
                        <Pressable
                            style={styles.dropdownDismissLayer}
                            onPress={() => {
                                setIsGenreOpen(false);
                                setIsCountryOpen(false);
                            }}
                        />
                    ) : null}

                    <View style={styles.section}>
                        <Text style={styles.label}>Nickname</Text>
                        <View style={styles.inputWrapper}>
                            <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                            <LinearGradient
                                colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <TextInput
                                value={nick}
                                onChangeText={setNick}
                                placeholder="Your nick"
                                placeholderTextColor="rgba(245,216,203,0.65)"
                                style={styles.input}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <View style={[styles.section, isGenreOpen && styles.sectionOpen]}>
                        <Text style={styles.label}>Genre</Text>
                        <View style={styles.dropdownWrap}>
                            {isGenreOpen ? (
                                <Pressable pointerEvents="none" style={styles.dropdownBackdrop} />
                            ) : null}
                            <TouchableOpacity
                                style={styles.dropdownSelector}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setIsGenreOpen((prev) => !prev);
                                    setIsCountryOpen(false);
                                }}
                            >
                                <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                                <LinearGradient
                                    colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <Text style={[styles.dropdownSelectorText, !genre && styles.placeholderText]}>
                                    {genre || 'Your genre'}
                                </Text>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName(isGenreOpen ? 'arrow-up.svg' : 'arrow-down.svg')}
                                    width={scale(24)}
                                    height={scale(24)}
                                    color="#F5D8CB"
                                    fallback=""
                                    style={styles.rightIcon}
                                />
                            </TouchableOpacity>

                            {isGenreOpen ? (
                                <View style={styles.dropdownShell}>
                                    <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                                    <LinearGradient
                                        colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={StyleSheet.absoluteFill}
                                    />
                                    {isGenresLoading ? (
                                        <Text style={styles.dropdownLoadingText}>Loading...</Text>
                                    ) : genres.length === 0 ? (
                                        <Text style={styles.dropdownLoadingText}>No genres</Text>
                                    ) : (
                                        <ScrollView
                                            style={styles.dropdownList}
                                            contentContainerStyle={styles.dropdownListContent}
                                            showsVerticalScrollIndicator
                                        >
                                            {genres.map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={styles.dropdownItem}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        setGenre(item.label);
                                                        setSelectedGenreId(item.id);
                                                        setIsGenreOpen(false);
                                                    }}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.dropdownItemText,
                                                            genre === item.label && styles.dropdownItemTextActive,
                                                        ]}
                                                    >
                                                        {item.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={[styles.section, isCountryOpen && styles.sectionOpen]}>
                        <Text style={styles.label}>Country</Text>
                        <View style={styles.dropdownWrap}>
                            {isCountryOpen ? (
                                <Pressable pointerEvents="none" style={styles.dropdownBackdrop} />
                            ) : null}
                            <TouchableOpacity
                                style={styles.dropdownSelector}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setIsCountryOpen((prev) => !prev);
                                    setIsGenreOpen(false);
                                }}
                            >
                                <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                                <LinearGradient
                                    colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={StyleSheet.absoluteFill}
                                />
                                <Text style={[styles.dropdownSelectorText, !country && styles.placeholderText]}>
                                    {country || 'Your country'}
                                </Text>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName(isCountryOpen ? 'arrow-up.svg' : 'arrow-down.svg')}
                                    width={scale(24)}
                                    height={scale(24)}
                                    color="#F5D8CB"
                                    fallback=""
                                    style={styles.rightIcon}
                                />
                            </TouchableOpacity>

                            {isCountryOpen ? (
                                <View style={styles.dropdownShell}>
                                        <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                                        <LinearGradient
                                            colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={StyleSheet.absoluteFill}
                                        />
                                        {isCountriesLoading ? (
                                            <Text style={styles.dropdownLoadingText}>Loading...</Text>
                                        ) : countries.length === 0 ? (
                                            <Text style={styles.dropdownLoadingText}>No countries</Text>
                                        ) : (
                                            <ScrollView
                                                style={styles.dropdownList}
                                                contentContainerStyle={styles.dropdownListContent}
                                                showsVerticalScrollIndicator
                                            >
                                                {countries.map((item) => (
                                                    <TouchableOpacity
                                                        key={item.id}
                                                        style={styles.dropdownItem}
                                                        activeOpacity={0.8}
                                                        onPress={() => {
                                                            setCountry(item.label);
                                                            setSelectedCountryId(item.id);
                                                            setIsCountryOpen(false);
                                                        }}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.dropdownItemText,
                                                                country === item.label && styles.dropdownItemTextActive,
                                                            ]}
                                                        >
                                                            {item.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        )}
                                    </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Profile description</Text>
                        <View style={styles.descriptionBox}>
                            <BlurView intensity={72} tint="dark" style={StyleSheet.absoluteFill} />
                            <LinearGradient
                                colors={['rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)', 'rgba(48,12,10,0.2)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            <TextInput
                                value={description}
                                onChangeText={(text) => setDescription(text.slice(0, MAX_DESCRIPTION))}
                                placeholder="Your description"
                                placeholderTextColor="rgba(245,216,203,0.65)"
                                style={styles.descriptionInput}
                                multiline
                                textAlignVertical="top"
                            />
                            <Text style={styles.counter}>{description.length}/{MAX_DESCRIPTION}</Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
                        activeOpacity={0.85}
                        disabled={isSubmitting}
                        onPress={handleConfirm}
                    >
                        <Text style={styles.confirmText}>{isSubmitting ? 'Sending...' : 'Confirm'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: scale(16),
        paddingTop: Platform.OS === 'ios' ? scale(60) : scale(40),
        paddingBottom: scale(20),
    },
    backButton: {
        width: scale(40),
        height: scale(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginBottom: scale(30),
    },
    section: {
        marginBottom: scale(20),
    },
    sectionOpen: {
        zIndex: 40,
    },
    label: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(20),
        marginBottom: scale(20),
    },
    inputWrapper: {
        height: scale(48),
        borderWidth: 0.2,
        borderColor: 'rgba(255, 236, 223, 1)',
        borderRadius: scale(26),
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: scale(12),
        overflow: 'hidden',
    },
    input: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    placeholderText: {
        color: 'rgba(245,216,203,0.65)',
    },
    rightIcon: {
        marginLeft: 0,
    },
    dropdownSelectorText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(13),
    },
    dropdownDismissLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 19,
    },
    dropdownWrap: {
        position: 'relative',
        zIndex: 20,
        width: '100%',
        overflow: 'visible',
    },
    dropdownBackdrop: {
        position: 'absolute',
        top: 0,
        left: -scale(220),
        right: -scale(220),
        bottom: -scale(1300),
        zIndex: 22,
    },
    dropdownSelector: {
        height: scale(48),
        borderRadius: scale(26),
        borderWidth: 0.2,
        borderColor: 'rgba(255, 236, 223, 1)',
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(18),
        zIndex: 22,
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
        paddingTop: scale(30),
        paddingBottom: scale(14),
        maxHeight: scale(220),
    },
    dropdownList: {
        flex: 1,
    },
    dropdownListContent: {
        paddingBottom: scale(0),
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
    dropdownLoadingText: {
        color: 'rgba(245,216,203,0.85)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        paddingHorizontal: scale(24),
        paddingVertical: scale(14),
    },
    descriptionBox: {
        borderWidth: 0.2,
        borderColor: 'rgba(255, 236, 223, 1)',
        borderRadius: scale(20),
        minHeight: scale(148),
        paddingTop: scale(10),
        paddingHorizontal: scale(12),
        paddingBottom: scale(8),
        overflow: 'hidden',
    },
    descriptionInput: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(15),
        zIndex: 1,
    },
    counter: {
        color: 'rgba(245,216,203,0.72)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12),
        alignSelf: 'flex-end',
        zIndex: 1,
    },
    confirmButton: {
        marginTop: 'auto',
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(10),
    },
    confirmButtonDisabled: {
        opacity: 0.65,
    },
    confirmText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});
