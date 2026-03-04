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

import { getIcons, scale } from '../../api/api';

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

export default function QualityOfMediaFilesScreen({ navigation }) {
    const [icons, setIcons] = useState({});

    // Стейт для перемикачів (на скріншоті вони увімкнені)
    const [autoplay, setAutoplay] = useState(true);
    const [deviceAccess, setDeviceAccess] = useState(true);

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
                        {/* ПІДЗАГОЛОВОК */}
                        <Text style={styles.sectionHeader}>Playback Controls</Text>

                        {/* СПИСОК НАЛАШТУВАНЬ */}
                        <SettingItem
                            title="Autoplay"
                            description="Play similar content after finishing listening to tracks."
                            value={autoplay}
                            onToggle={setAutoplay}
                        />

                        <SettingItem
                            title="Access to music playing on the device"
                            description="Other apps will have access to display music playing on the device."
                            value={deviceAccess}
                            onToggle={setDeviceAccess}
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
        marginBottom: scale(60), // Трохи менший відступ, бо підзаголовок йде одразу
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

    // Підзаголовок (Playback Controls)
    sectionHeader: {
        fontSize: scale(18),
        fontFamily: 'Poppins-Bold', // або Unbounded-Bold
        color: '#F5D8CB',
        marginBottom: scale(20),
    },

    // Елемент налаштувань
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: scale(30),
    },
    settingTextContainer: {
        flex: 1,
        paddingRight: scale(20),
    },
    settingTitle: {
        fontSize: scale(14),
        fontFamily: 'Poppins-SemiBold',
        color: '#F5D8CB',
        marginBottom: scale(6),
        lineHeight: scale(20),
    },
    settingDescription: {
        fontSize: scale(12),
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
        lineHeight: scale(18),
    },

    // Кастомний Switch
    switchTrack: {
        width: scale(44),
        height: scale(24),
        borderRadius: scale(12),
        justifyContent: 'center',
        padding: scale(2),
        marginTop: scale(2),
    },
    switchTrackActive: {
        backgroundColor: '#F5D8CB',
    },
    switchTrackInactive: {
        backgroundColor: 'transparent',
        borderWidth: scale(1.5),
        borderColor: '#F5D8CB',
    },
    switchThumb: {
        width: scale(18),
        height: scale(18),
        borderRadius: scale(9),
    },
    switchThumbActive: {
        backgroundColor: '#300C0A',
    },
    switchThumbInactive: {
        backgroundColor: '#F5D8CB',
    }
});