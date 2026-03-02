import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    StatusBar,
    SafeAreaView,
    Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';

import { getIcons, scale } from '../api/api';

// --- КЕШ SVG ---
const svgCache = {};

const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;
        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }
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
                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }
        return () => { isMounted = false; };
    }, [cacheKey]);

    if (!xml) return <View style={{ width, height }} />;
    return <SvgXml xml={xml} width={width} height={height} />;
};

// --- ФЕЙКОВІ ДАНІ ---
const mockData = {
    'This week': {
        topArtistName: 'Jessie Murph',
        topSongName: 'Bad As The Rest',
        artistImage: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyXB8jW4oeqlSUmof4lCqdK_lHIn6Yc1VSxg&s',
        listenCount: 12,
        waveSongName: 'Come closer',
        waveArtistName: 'Sombr',
        waveImage: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQyXB8jW4oeqlSUmof4lCqdK_lHIn6Yc1VSxg&s'
    },
    'This month': null,
    'This year': null
};

// --- КОМПОНЕНТ СУЦІЛЬНОГО DROPDOWN ---
const GlassDropdown = ({ selectedPeriod, isDropdownOpen, setIsDropdownOpen, periods, handleSelectPeriod, renderIcon }) => {
    return (
        // Абсолютне позиціювання поверх усього екрану
        <View style={styles.absoluteDropdownWrapper}>
            <View style={[styles.dropdownContainer, isDropdownOpen && styles.dropdownContainerOpen]}>

                {/* Розмиття (BlurView) на весь блок (і на кнопку, і на список) */}
                <BlurView intensity={50} tint="dark" style={styles.glassInner}>
                    <View style={styles.glassTint} />

                    {/* Кнопка "Select period" */}
                    <TouchableOpacity
                        style={styles.dropdownTrigger}
                        onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.dropdownText}>
                            {selectedPeriod ? selectedPeriod : "Select period"}
                        </Text>
                        {renderIcon(isDropdownOpen ? 'arrow-up.svg' : 'arrow-down.svg', isDropdownOpen ? '^' : 'v', { width: scale(20), height: scale(20) }, '#F5D8CB')}
                    </TouchableOpacity>

                    {/* Лінія розділювач (тільки якщо відкрито) */}
                    {isDropdownOpen && <View style={styles.dropdownSeparator} />}

                    {/* Випадаючий список */}
                    {isDropdownOpen && (
                        <View style={styles.dropdownListContainer}>
                            {periods.map((item, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.dropdownItem}
                                    onPress={() => handleSelectPeriod(item)}
                                >
                                    <Text style={styles.dropdownItemText}>{item}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </BlurView>
            </View>
        </View>
    );
};

export default function StatisticsScreen({ navigation }) {
    const [icons, setIcons] = useState({});
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const [statsData, setStatsData] = useState(null);

    const periods = ['This week', 'This month', 'This year'];

    useEffect(() => {
        loadIcons();
    }, []);

    const loadIcons = async () => {
        try {
            const iconsData = await getIcons();
            setIcons(iconsData || {});
        } catch (e) {
            console.error("Icons Load Error:", e);
        }
    };

    const renderIcon = useCallback((iconName, fallbackText, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];
        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');
            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;
                return <ColoredSvg key={iconName} uri={iconUrl} width={width} height={height} color={tintColor} />;
            }
            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor: tintColor });
            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }
        return (
            <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: tintColor || '#F5D8CB', fontSize: style.height ? style.height * 0.6 : 14 }}>
                    {fallbackText}
                </Text>
            </View>
        );
    }, [icons]);

    const handleSelectPeriod = (period) => {
        setSelectedPeriod(period);
        setIsDropdownOpen(false);
        setStatsData(mockData[period]);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

            <LinearGradient
                colors={['#AC654F', '#883426', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>

                    {/* ХЕДЕР */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.backButton}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                            {renderIcon('arrow-left.svg', '<', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Statistics</Text>
                        <View style={{ width: scale(24) }} />
                    </View>

                    {/* РОБОЧА ЗОНА ЕКРАНУ */}
                    <View style={styles.contentArea}>

                        {/* АБСОЛЮТНИЙ DROPDOWN (Завжди поверх всього) */}
                        <GlassDropdown
                            selectedPeriod={selectedPeriod}
                            isDropdownOpen={isDropdownOpen}
                            setIsDropdownOpen={setIsDropdownOpen}
                            periods={periods}
                            handleSelectPeriod={handleSelectPeriod}
                            renderIcon={renderIcon}
                        />

                        {/* СКРОЛЛ З КОНТЕНТОМ (Їде ПІД дропдауном) */}
                        <ScrollView
                            contentContainerStyle={styles.scrollContent}
                            showsVerticalScrollIndicator={false}
                            bounces={false}
                        >
                            {/* Порожній блок, щоб контент не ховався за закритою кнопкою */}
                            <View style={{ height: scale(70) }} />

                            {selectedPeriod && statsData && (
                                <View style={styles.contentWrapper}>
                                    <Text style={styles.periodTitle}>{selectedPeriod}</Text>

                                    {/* КАРТКА 1 */}
                                    <View style={[styles.card, styles.topCard]}>
                                        <View style={styles.topCardRow}>
                                            <Image
                                                source={{ uri: statsData.artistImage }}
                                                style={styles.artistAvatar}
                                            />
                                            <View style={styles.topCardInfo}>
                                                <View style={styles.infoBlock}>
                                                    <Text style={styles.labelText}>Top-artist</Text>
                                                    <Text style={styles.valueText} numberOfLines={1}>{statsData.topArtistName}</Text>
                                                </View>
                                                <View style={styles.infoBlock}>
                                                    <Text style={styles.labelText}>Top-song</Text>
                                                    <Text style={styles.valueText} numberOfLines={1}>{statsData.topSongName}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* КАРТКА 2 */}
                                    <View style={[styles.card, styles.mainCard]}>
                                        <View style={styles.mainAvatarWrapper}>
                                            <Image
                                                source={{ uri: statsData.waveImage }}
                                                style={styles.mainAvatar}
                                            />
                                        </View>

                                        <Text style={styles.listenCountText}>You listened {statsData.listenCount} times</Text>
                                        <Text style={styles.waveSubtitleText}>Your musical wave</Text>

                                        <View style={styles.waveSongRow}>
                                            <Image
                                                source={{ uri: statsData.waveImage }}
                                                style={styles.smallWaveAvatar}
                                            />
                                            <View style={styles.waveSongInfo}>
                                                <Text style={styles.waveSongTitle} numberOfLines={1}>{statsData.waveSongName}</Text>
                                                <Text style={styles.waveSongArtist} numberOfLines={1}>{statsData.waveArtistName}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </ScrollView>
                    </View>

                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#160607',
    },
    gradient: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(40) : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        marginTop: scale(10),
        marginBottom: scale(10), // Зменшив, бо контент нижче
    },
    backButton: {
        padding: scale(5),
        marginLeft: scale(-5),
    },
    headerTitle: {
        fontSize: scale(30),
        fontFamily: 'Unbounded-Regular',
        color: '#F5D8CB',
    },

    // Нова обгортка, де живе і дропдаун, і скролл
    contentArea: {
        flex: 1,
        position: 'relative',
    },
    scrollContent: {
        paddingHorizontal: scale(20),
        paddingBottom: scale(40),
    },

    /* --- ABSOLUTE DROPDOWN STYLES --- */
    absoluteDropdownWrapper: {
        position: 'absolute',
        top: 0,
        left: scale(20),
        right: scale(20),
        zIndex: 999, // Поверх скролу
    },
    dropdownContainer: {
        borderRadius: scale(20),
        overflow: 'hidden', // ВАЖЛИВО: щоб розмиття не виходило за краї
        backgroundColor: 'transparent',
    },
    dropdownContainerOpen: {
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 10,
    },
    glassInner: {
        width: '100%',
    },
    glassTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(106, 43, 32, 0.7)', // Тонування
    },
    dropdownTrigger: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(16),
    },
    dropdownText: {
        fontSize: scale(15),
        fontFamily: 'Poppins-Regular',
        color: 'rgba(245, 216, 203, 0.9)',
    },
    dropdownSeparator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(245, 216, 203, 0.2)', // Тонка лінія
        marginHorizontal: scale(20),
    },
    dropdownListContainer: {
        paddingVertical: scale(10),
    },
    dropdownItem: {
        paddingHorizontal: scale(20),
        paddingVertical: scale(14),
    },
    dropdownItemText: {
        fontSize: scale(15),
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
    },

    /* --- CONTENT STYLES --- */
    contentWrapper: {
        zIndex: 1,
    },
    periodTitle: {
        fontSize: scale(22),
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        marginBottom: scale(15),
    },

    /* Спільний стиль карток */
    card: {
        borderRadius: scale(16),
        padding: scale(20),
        marginBottom: scale(16),
    },

    /* Картка 1: Top Artist */
    topCard: {
        backgroundColor: '#B16150', // Світліший червоний
    },
    topCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    artistAvatar: {
        width: scale(69),
        height: scale(69),
        borderRadius: scale(40),
        backgroundColor: '#300C0A',
        marginRight: scale(20),
    },
    topCardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    infoBlock: {
        marginBottom: scale(10),
    },
    labelText: {
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
        color: 'rgba(245, 216, 203, 0.8)',
        marginBottom: scale(2),
    },
    valueText: {
        fontSize: scale(12),
        fontFamily: 'Unbounded-Regular',
        color: '#F5D8CB',
    },

    /* Картка 2: Main Stats */
    mainCard: {
        backgroundColor: '#8C3B2D', // Темніший червоний
        alignItems: 'center',
        paddingVertical: scale(30),
    },
    mainAvatarWrapper: {
        width: scale(168),
        height: scale(168),
        borderRadius: scale(90),
        marginBottom: scale(20),
        overflow: 'hidden',
    },
    mainAvatar: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    listenCountText: {
        fontSize: scale(19),
        fontFamily: 'Unbounded-Regular',
        color: '#F5D8CB',
        textAlign: 'center',
        marginBottom: scale(5),
    },
    waveSubtitleText: {
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
        color: '#CD7C62',
        textAlign: 'center',
        marginBottom: scale(30),
    },

    // Блок пісні внизу другої картки
    waveSongRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        alignSelf: 'flex-start',
    },
    smallWaveAvatar: {
        width: scale(59),
        height: scale(59),
        borderRadius: scale(45),
        marginRight: scale(12),
        backgroundColor: '#300C0A',
    },
    waveSongInfo: {
        flex: 1,
    },
    waveSongTitle: {
        fontSize: scale(14),
        fontFamily: 'Unbounded-Regular',
        color: '#F5D8CB',
        marginBottom: scale(2),
    },
    waveSongArtist: {
        fontSize: scale(10),
        fontFamily: 'Poppins-Light',
        color: '#F5D8CB',
    },
});