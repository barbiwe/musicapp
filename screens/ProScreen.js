import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Image,
    Dimensions,
    Platform
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { getIcons, scale } from '../api/api';

const { width, height } = Dimensions.get('window');

// 1. КЕШ ТА РЕНДЕР SVG
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

export default function ProScreen({ navigation }) {
    const [icons, setIcons] = useState({});

    useEffect(() => {
        loadIcons();
    }, []);

    const loadIcons = async () => {
        try {
            const loadedIcons = await getIcons();
            setIcons(loadedIcons || {});
        } catch (e) {
            console.log("Error loading icons:", e);
        }
    };

    const renderIcon = (iconName, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={flatStyle?.width || 24}
                        height={flatStyle?.height || 24}
                        color={tintColor}
                    />
                );
            }

            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor: tintColor });

            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }
        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    // Допоміжний компонент для пунктів списку (зменшені відступи)
    const BulletItem = ({ text }) => (
        <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{text}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>

                    {/* HEADER */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>Premium</Text>

                        <View style={{ width: scale(24) }} />
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

                        {/* MAIN CARD */}
                        <View style={styles.card}>

                            {/* Watermark */}
                            <View style={styles.watermarkContainer}>
                                {/* Зменшили висоту водяного знаку */}
                                {renderIcon('VOX.svg', { width: scale(220), height: scale(80) }, '#FFFFFF')}
                            </View>

                            <Text style={styles.cardTitle}>Subscription</Text>

                            <View style={styles.priceContainer}>
                                <Text style={styles.price}>$4.99</Text>
                                <Text style={styles.pricePeriod}> / month</Text>
                            </View>

                            <Text style={styles.description}>
                                VOX Pro – the best way to enjoy music your way. By subscribing, you get:
                            </Text>

                            {/* Section 1 */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Library & Playlists</Text>
                                <BulletItem text="Unlimited access to all songs and playlists" />
                                <BulletItem text="Create and upload your own playlists without limits" />
                            </View>

                            {/* Section 2 */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Listening Experience</Text>
                                <BulletItem text="Ad-free listening" />
                                <BulletItem text="Offline downloads for any track" />
                                <BulletItem text="High-quality sound" />
                            </View>

                            {/* Section 3 */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Personalization & Tools</Text>
                                <BulletItem text="Personalized recommendations and curated mixes" />
                                <BulletItem text="Unlimited skips" />
                            </View>

                            {/* BUTTON */}
                            <TouchableOpacity
                                style={styles.button}
                                activeOpacity={0.8}
                                onPress={() => console.log('Try Now Pressed')}
                            >
                                <Text style={styles.buttonText}>Try now</Text>
                            </TouchableOpacity>

                        </View>

                        <View style={{ height: scale(30) }} />
                    </ScrollView>

                </SafeAreaView>
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
        flex: 1,
        minHeight: height,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(30) : 0, // Зменшив відступ зверху
    },

    // --- HEADER ---
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        marginTop: scale(5),     // Зменшив
        marginBottom: scale(65), // Зменшив
    },
    backButton: {
        width: scale(24),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontSize: scale(28),     // Трохи зменшив
        fontFamily: 'Unbounded-Medium',
    },

    // --- CARD ---
    card: {
        backgroundColor: '#270A07',
        marginHorizontal: scale(16),
        borderRadius: scale(24),
        paddingVertical: scale(30),
        paddingHorizontal: scale(20),
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    watermarkContainer: {
        position: 'absolute',
        top: scale(-5),
        left: scale(-15),
        zIndex: 2,
    },

    // --- CARD CONTENT ---
    cardTitle: {
        color: '#F5D8CB',
        fontSize: scale(20),      // Зменшив
        fontFamily: 'Unbounded-Bold',
        marginBottom: scale(37),
        zIndex: 1,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: scale(12),  // Зменшив
        zIndex: 1,
    },
    price: {
        color: '#F5D8CB',
        fontSize: scale(20),      // Зменшив
        fontFamily: 'Unbounded-Bold',
    },
    pricePeriod: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив
        fontFamily: 'Unbounded-Regular',
        marginLeft: scale(4),
        opacity: 0.9,
    },
    description: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив
        fontFamily: 'Poppins-Regular',
        lineHeight: scale(18),    // Зменшив міжрядковий інтервал
        marginBottom: scale(16),  // Зменшив
        opacity: 0.9,
        zIndex: 1,
    },

    // --- SECTIONS ---
    section: {
        marginBottom: scale(14),  // Зменшив відступ між секціями
        zIndex: 1,
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив
        fontFamily: 'Poppins-Bold',
        marginBottom: scale(8),   // Зменшив
    },

    // --- BULLETS ---
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: scale(4),   // Зменшив відступ між пунктами
        paddingRight: scale(10),
    },
    bulletDot: {
        color: '#F5D8CB',
        fontSize: scale(14),
        marginRight: scale(6),
        lineHeight: scale(18),
    },
    bulletText: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив шрифт
        fontFamily: 'Poppins-Regular',
        lineHeight: scale(18),    // Зменшив міжрядковий інтервал
        opacity: 0.9,
        flex: 1,
    },

    // --- BUTTON ---
    button: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#FF4D4F',
        borderRadius: scale(30),
        paddingVertical: scale(14), // Зменшив висоту кнопки
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(5),
        zIndex: 1,
    },
    buttonText: {
        color: '#FF4D4F',
        fontSize: scale(15),      // Зменшив
        fontFamily: 'Unbounded-Medium',
    }
});
