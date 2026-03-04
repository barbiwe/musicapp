import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Platform,
    ImageBackground,
    Animated,
    StatusBar
} from 'react-native';
import { SvgUri, SvgXml } from 'react-native-svg';
import { scale } from '../../api/api';

const { width, height } = Dimensions.get('window');

// --- ЛОГІКА РОЗМІРІВ (FIXED & SCALED) ---
// Встановлюємо фіксовані розміри через scale (базовий дизайн, наприклад, під iPhone 11)
const CARD_WIDTH = scale(254);
const CARD_HEIGHT = scale(291); // Робимо квадрат
const SPACING = scale(10);      // Відступ між картками

// Повний розмір одного кроку скролу (картка + відступи з обох боків)
const ITEM_SIZE = CARD_WIDTH + (SPACING * 2);

// Пустишка, щоб перша картка стала рівно по центру екрану
const SPACER_ITEM_SIZE = (width - ITEM_SIZE) / 2;

const DATA = [
    { key: 'left-spacer' },
    { key: '1', color: '#300C0A' },
    { key: '2', color: '#300C0A' },
    { key: '3', color: '#300C0A' },
    { key: 'right-spacer' },
];
const svgCache = {};
// 👇 Цей компонент завантажує SVG, чистить, фарбує і КЕШУЄ результат
const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        // 1. Якщо у нас вже є правильна картинка в кеші — беремо її і виходимо
        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }

        // 2. Якщо в кеші немає — вантажимо
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

                        // Зберігаємо в кеш
                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }

        return () => { isMounted = false; };
    }, [cacheKey]); // 🔥 Головне: реагуємо на зміну ключа, а не ігноруємо її

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

export default function OnboardingScreen({ navigation }) {
    const scrollX = useRef(new Animated.Value(0)).current;

    const renderItem = ({ item, index }) => {
        // Рендеримо пустишки по боках
        if (!item.color) {
            return <View style={{ width: SPACER_ITEM_SIZE }} />;
        }

        const inputRange = [
            (index - 2) * ITEM_SIZE,
            (index - 1) * ITEM_SIZE,
            index * ITEM_SIZE,
        ];

        const scaleValue = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9], // Центр = 1, збоку = 0.9
            extrapolate: 'clamp',
        });

        const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.6, 1, 0.6],
            extrapolate: 'clamp',
        });

        return (
            // Контейнер, який займає повний крок (картка + відступи)
            <View style={{ width: ITEM_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View
                    style={[
                        styles.cardContainer,
                        {
                            backgroundColor: item.color,
                            transform: [{ scale: scaleValue }],
                        }
                    ]}
                />
            </View>
        );
    };

    return (
        <View style={styles.mainContainer}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ImageBackground
                source={require('../../assets/background.png')}
                style={styles.backgroundImage}
                resizeMode="cover"
            >
                <View style={styles.contentContainer}>

                    {/* КАРУСЕЛЬ */}
                    <View style={styles.carouselWrapper}>
                        <Animated.FlatList
                            data={DATA}
                            keyExtractor={(item) => item.key}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ alignItems: 'center' }}
                            snapToInterval={ITEM_SIZE}
                            decelerationRate="fast"
                            bounces={false}
                            renderToHardwareTextureAndroid
                            onScroll={Animated.event(
                                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                                { useNativeDriver: true }
                            )}
                            scrollEventThrottle={16}
                            renderItem={renderItem}
                        />
                    </View>

                    {/* ТЕКСТ І КНОПКА */}
                    <View style={styles.bottomSection}>
                        <Text style={styles.title}>
                            Listen to{'\n'}music you love
                        </Text>

                        <Text style={styles.subtitle}>
                            Discover new artists and{'\n'}
                            playlists made for you
                        </Text>

                        <TouchableOpacity
                            style={styles.button}
                            onPress={() => navigation.navigate('AuthChoice')}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.buttonText}>Get started</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    mainContainer: {
        flex: 1,
        backgroundColor: '#300C0A',
    },
    backgroundImage: {
        flex: 1,
        width: width,
        height: height,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'space-between',
        paddingBottom: scale(50),
    },
    carouselWrapper: {
        marginTop: height * 0.15,
        height: CARD_HEIGHT + scale(40),
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: scale(30),
        backgroundColor: '#300C0A',
    },
    bottomSection: {
        alignItems: 'center',
        paddingHorizontal: scale(16),
    },
    title: {
        fontSize: scale(36),
        textAlign: 'center',
        color: '#F5D8CB',
        marginBottom: scale(16),
        fontFamily: 'Unbounded-Bold',
    },
    subtitle: {
        fontSize: scale(16),
        color: '#F5D8CB',
        textAlign: 'center',
        lineHeight: scale(24),
        marginBottom: scale(40),
        fontFamily: 'Poppins-Regular',
    },
    button: {
        width: scale(343),
        height: scale(48),
        backgroundColor: '#F5D8CB',
        borderRadius: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(20),
    },
    buttonText: {
        color: '#300C0A',
        fontSize: scale(16),
        fontWeight: '600',
        fontFamily: 'Unbounded-Regular',
    }
});
