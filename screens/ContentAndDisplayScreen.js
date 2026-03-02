import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ScrollView,
    StatusBar,
    SafeAreaView,
    Platform,
    Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

// --- КАСТОМНИЙ ПЕРЕМИКАЧ (Точно як на макеті) ---
const CustomSwitch = ({ value, onValueChange }) => {
    const translateX = useRef(new Animated.Value(value ? scale(20) : 0)).current;

    useEffect(() => {
        Animated.timing(translateX, {
            toValue: value ? scale(20) : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [value]);

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onValueChange(!value)}
            style={[
                styles.switchTrack,
                value ? styles.switchTrackActive : styles.switchTrackInactive
            ]}
        >
            <Animated.View
                style={[
                    styles.switchThumb,
                    value ? styles.switchThumbActive : styles.switchThumbInactive,
                    { transform: [{ translateX }] }
                ]}
            />
        </TouchableOpacity>
    );
};


export default function ContentAndDisplayScreen({ navigation }) {
    const [icons, setIcons] = useState({});

    // Стейт для перемикачів
    const [ageRestricted, setAgeRestricted] = useState(true);
    const [unavailableSongs, setUnavailableSongs] = useState(false);
    const [externalDevices, setExternalDevices] = useState(false);
    const [createButton, setCreateButton] = useState(false);

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

    // Компонент для рендеру окремого пункту налаштувань
    const SettingItem = ({ title, description, value, onToggle }) => (
        <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>{title}</Text>
                {description && <Text style={styles.settingDescription}>{description}</Text>}
            </View>
            <CustomSwitch value={value} onValueChange={onToggle} />
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

            <LinearGradient
                colors={['#AC654F', '#883426', '#190707',]}
                locations={[0, 0.2, 0.59,]}
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
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        {/* СПИСОК НАЛАШТУВАНЬ */}
                        <SettingItem
                            title="Allow age-restricted content"
                            description="Enables playback of age-restricted content. If this setting is disabled, age-restricted music and podcasts are skipped, and related audiobooks (if available) are hidden."
                            value={ageRestricted}
                            onToggle={setAgeRestricted}
                        />

                        <SettingItem
                            title="Unavailable songs"
                            description="Songs that are unavailable due to artist removal, user location, etc., are still displayed."
                            value={unavailableSongs}
                            onToggle={setUnavailableSongs}
                        />

                        <SettingItem
                            title="Allow playback to external devices"
                            description="For example, Bluetooth in a car, wired headset"
                            value={externalDevices}
                            onToggle={setExternalDevices}
                        />

                        {/* ПІДЗАГОЛОВОК */}
                        <Text style={styles.sectionHeader}>Display settings</Text>

                        <SettingItem
                            title="Create button"
                            description="The Create button will appear on the main navigation bar."
                            value={createButton}
                            onToggle={setCreateButton}
                        />

                    </ScrollView>
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
        paddingHorizontal: scale(24),
        marginTop: scale(10),
        marginBottom: scale(60),
    },
    backButton: {
        alignSelf: 'flex-start',
        padding: scale(5),
        marginLeft: scale(-5),
    },
    scrollContent: {
        paddingHorizontal: scale(24),
        paddingBottom: scale(40),
    },

    // Елемент налаштувань
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Вирівнюємо по верху, бо тексти можуть бути довгими
        marginBottom: scale(20),
    },
    settingTextContainer: {
        flex: 1,
        paddingRight: scale(20), // Відступ між текстом і перемикачем
    },
    settingTitle: {
        fontSize: scale(14),
        fontFamily: 'Poppins-Bold',
        color: '#F5D8CB',
        marginBottom: scale(6),
        lineHeight: scale(22),
    },
    settingDescription: {
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB', // Напівпрозорий основний колір
        lineHeight: scale(20),
    },

    // Підзаголовок (Display settings)
    sectionHeader: {
        fontSize: scale(16),
        fontFamily: 'Poppins-Bold',
        color: '#F5D8CB',
        marginTop: scale(10),
    },

    // Кастомний Switch
    switchTrack: {
        width: scale(44),
        height: scale(24),
        borderRadius: scale(12),
        justifyContent: 'center',
        padding: scale(2),
    },
    switchTrackActive: {
        backgroundColor: '#F5D8CB', // Залитий, коли УВІМКНЕНО
    },
    switchTrackInactive: {
        backgroundColor: 'transparent', // Прозорий, коли ВИМКНЕНО
        borderWidth: scale(1.5),
        borderColor: '#F5D8CB',
    },
    switchThumb: {
        width: scale(18),
        height: scale(18),
        borderRadius: scale(9),
    },
    switchThumbActive: {
        backgroundColor: '#300C0A', // Темна крапка на світлому фоні
    },
    switchThumbInactive: {
        backgroundColor: '#F5D8CB', // Світла крапка на темному/прозорому фоні
    }
});