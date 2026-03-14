import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import { clearIconsCache, getCountries, getGenres, getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

const MAX_DESCRIPTION = 200;
const normalizeGenres = (rawGenres) => {
    if (!Array.isArray(rawGenres)) return [];

    const used = new Set();
    return rawGenres
        .map((item, index) => {
            if (typeof item === 'string') {
                const label = item.trim();
                if (!label) return null;
                return {
                    id: `genre_${label.toLowerCase()}_${index}`,
                    label,
                };
            }

            const label = String(item?.name || item?.title || item?.label || '').trim();
            if (!label) return null;

            const id = item?.id || item?._id || item?.genreId || item?.value || index;
            return {
                id: String(id),
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
                    id: `country_${label.toLowerCase()}_${index}`,
                    label,
                };
            }

            const label = String(item?.name || item?.title || item?.label || item?.value || '').trim();
            if (!label) return null;

            const id = item?.id || item?._id || item?.code || index;
            return {
                id: String(id),
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
    const [country, setCountry] = useState('');
    const [description, setDescription] = useState('');
    const [genres, setGenres] = useState([]);
    const [isGenreOpen, setIsGenreOpen] = useState(false);
    const [isGenresLoading, setIsGenresLoading] = useState(true);
    const [countries, setCountries] = useState([]);
    const [isCountryOpen, setIsCountryOpen] = useState(false);
    const [isCountriesLoading, setIsCountriesLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const loadData = async () => {
            clearIconsCache();
            try {
                const [iconsMap, genresData, countriesData] = await Promise.all([
                    getIcons(),
                    getGenres(),
                    getCountries(),
                ]);

                if (!mounted) return;
                setIcons(iconsMap || {});
                setGenres(normalizeGenres(genresData));
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

    const leftIconSize = useMemo(() => ({ width: scale(22), height: scale(22) }), []);
    const resolveIconName = (name) => {
        if (!name) return '';
        if (icons?.[name]) return name;
        const lower = String(name).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || name;
    };
    const genreIconName = resolveIconName('reqgenre.svg');
    const countryIconName = resolveIconName('flag.svg');

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

                    <View style={styles.section}>
                        <Text style={styles.label}>Nickname</Text>
                        <View style={styles.inputWrapper}>
                            <View style={styles.leftIconCircle}>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName('reqprofile.svg')}
                                    width={leftIconSize.width}
                                    height={leftIconSize.height}
                                    color="#F5D8CB"
                                    fallback=""
                                />
                            </View>
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
                        <View style={styles.genreFieldWrap}>
                            <TouchableOpacity
                                style={styles.inputWrapper}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setIsGenreOpen((prev) => !prev);
                                    setIsCountryOpen(false);
                                }}
                            >
                                <View style={styles.leftIconCircle}>
                                    <RemoteTintIcon
                                        icons={icons}
                                        iconName={genreIconName}
                                        width={leftIconSize.width}
                                        height={leftIconSize.height}
                                        color="#F5D8CB"
                                        fallback=""
                                    />
                                </View>
                                <Text style={[styles.input, !genre && styles.placeholderText]}>
                                    {genre || 'Your genre'}
                                </Text>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName('arrow-down.svg')}
                                    width={scale(24)}
                                    height={scale(24)}
                                    color="#F5D8CB"
                                    fallback=""
                                    style={styles.rightIcon}
                                />
                            </TouchableOpacity>

                        {isGenreOpen ? (
                            <View style={styles.genreDropdownOverlay}>
                                <BlurView intensity={42} tint="dark" style={styles.genreDropdownGlass}>
                                    {isGenresLoading ? (
                                        <Text style={styles.genreLoadingText}>Loading...</Text>
                                    ) : genres.length === 0 ? (
                                        <Text style={styles.genreLoadingText}>No genres</Text>
                                    ) : (
                                        <ScrollView
                                            style={styles.genreList}
                                            contentContainerStyle={styles.genreListContent}
                                            showsVerticalScrollIndicator
                                        >
                                            {genres.map((item) => (
                                                <TouchableOpacity
                                                    key={item.id}
                                                    style={styles.genreOption}
                                                    activeOpacity={0.8}
                                                    onPress={() => {
                                                        setGenre(item.label);
                                                        setIsGenreOpen(false);
                                                    }}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.genreOptionText,
                                                            genre === item.label && styles.genreOptionTextSelected,
                                                        ]}
                                                    >
                                                        {item.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    )}
                                </BlurView>
                            </View>
                        ) : null}
                    </View>
                    </View>

                    <View style={[styles.section, isCountryOpen && styles.sectionOpen]}>
                        <Text style={styles.label}>Country</Text>
                        <View style={styles.genreFieldWrap}>
                            <TouchableOpacity
                                style={styles.inputWrapper}
                                activeOpacity={0.85}
                                onPress={() => {
                                    setIsCountryOpen((prev) => !prev);
                                    setIsGenreOpen(false);
                                }}
                            >
                                <View style={styles.leftIconCircle}>
                                    <RemoteTintIcon
                                        icons={icons}
                                        iconName={countryIconName}
                                        width={leftIconSize.width}
                                        height={leftIconSize.height}
                                        color="#F5D8CB"
                                        fallback=""
                                    />
                                </View>
                                <Text style={[styles.input, !country && styles.placeholderText]}>
                                    {country || 'Your country'}
                                </Text>
                                <RemoteTintIcon
                                    icons={icons}
                                    iconName={resolveIconName('arrow-down.svg')}
                                    width={scale(24)}
                                    height={scale(24)}
                                    color="#F5D8CB"
                                    fallback=""
                                    style={styles.rightIcon}
                                />
                            </TouchableOpacity>

                            {isCountryOpen ? (
                                <View style={styles.genreDropdownOverlay}>
                                    <BlurView intensity={42} tint="dark" style={styles.genreDropdownGlass}>
                                        {isCountriesLoading ? (
                                            <Text style={styles.genreLoadingText}>Loading...</Text>
                                        ) : countries.length === 0 ? (
                                            <Text style={styles.genreLoadingText}>No countries</Text>
                                        ) : (
                                            <ScrollView
                                                style={styles.genreList}
                                                contentContainerStyle={styles.genreListContent}
                                                showsVerticalScrollIndicator
                                            >
                                                {countries.map((item) => (
                                                    <TouchableOpacity
                                                        key={item.id}
                                                        style={styles.genreOption}
                                                        activeOpacity={0.8}
                                                        onPress={() => {
                                                            setCountry(item.label);
                                                            setIsCountryOpen(false);
                                                        }}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.genreOptionText,
                                                                country === item.label && styles.genreOptionTextSelected,
                                                            ]}
                                                        >
                                                            {item.label}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        )}
                                    </BlurView>
                                </View>
                            ) : null}
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.label}>Profile description</Text>
                        <View style={styles.descriptionBox}>
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

                    <TouchableOpacity style={styles.confirmButton} activeOpacity={0.85}>
                        <Text style={styles.confirmText}>Confirm</Text>
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
        paddingBottom: scale(28),
    },
    backButton: {
        width: scale(40),
        height: scale(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginBottom: scale(58),
    },
    section: {
        marginBottom: scale(16),
    },
    sectionOpen: {
        zIndex: 40,
    },
    label: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(20),
        marginBottom: scale(16),
    },
    inputWrapper: {
        height: scale(60),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(30),
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: scale(14),
    },
    leftIconCircle: {
        position: 'absolute',
        left: -1,
        top: -1,
        width: scale(60),
        height: scale(60),
        borderRadius: scale(30),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        marginLeft: scale(70),
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    placeholderText: {
        color: 'rgba(245,216,203,0.65)',
    },
    rightIcon: {
        marginLeft: scale(10),
    },
    genreFieldWrap: {
        position: 'relative',
        overflow: 'visible',
    },
    genreDropdownOverlay: {
        position: 'absolute',
        top: scale(66),
        left: 0,
        right: 0,
        zIndex: 50,
        elevation: 20,
    },
    genreDropdownGlass: {
        borderColor: '#F5D8CB',
        borderTopWidth: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: scale(30),
        borderBottomRightRadius: scale(30),
        backgroundColor: 'transparent',
        height: scale(150),
        overflow: 'hidden',
    },
    genreList: {
        flex: 1,
    },
    genreListContent: {
        paddingTop: scale(14),
        paddingBottom: scale(16),
    },
    genreOption: {
        paddingLeft: scale(50),
        paddingRight: scale(18),
        paddingVertical: scale(9),
    },
    genreOptionText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
    },
    genreOptionTextSelected: {
        fontFamily: 'Poppins-SemiBold',
    },
    genreLoadingText: {
        color: '#F5D8CB',
        opacity: 0.85,
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
        paddingHorizontal: scale(18),
        paddingVertical: scale(16),
    },
    descriptionBox: {
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(16),
        minHeight: scale(125),
        paddingTop: scale(16),
        paddingHorizontal: scale(16),
        paddingBottom: scale(14),
    },
    descriptionInput: {
        flex: 1,
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(15),
    },
    counter: {
        color: 'rgba(245,216,203,0.72)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        alignSelf: 'flex-end',
    },
    confirmButton: {
        marginTop: 'auto',
        height: scale(48),
        borderRadius: scale(32),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(14),
    },
    confirmText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});
