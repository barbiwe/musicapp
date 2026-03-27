import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Alert,
    ActivityIndicator,
    Image,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient'; // 👇 Для градієнта
import { SvgUri, SvgXml } from 'react-native-svg';
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

// 👇 Імпортуємо scale та getIcons
import { googleLogin, resolvePostAuthDestination, scale, getIcons } from "../../api/api";
import { getGoogleAuthRequestConfig } from '../../config/googleAuthConfig';

WebBrowser.maybeCompleteAuthSession();

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

export default function AuthChoiceScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [icons, setIcons] = useState({}); // 👇 Стейт для іконок

    /* =========================
       GOOGLE AUTH CONFIG
    ========================= */
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
        getGoogleAuthRequestConfig()
    );

    // 1. Завантажуємо іконки при старті
    useEffect(() => {
        loadIconsData();
    }, []);

    const loadIconsData = async () => {
        try {
            const iconsMap = await getIcons();
            setIcons(iconsMap || {});
        } catch (e) {
            console.log("Error loading icons:", e);
        }
    };

    // 2. Обробка відповіді Google
    useEffect(() => {
        if (response?.type === "success") {
            const { id_token } = response.params;
            handleBackendGoogleLogin(id_token);
        } else if (response?.type === "error") {
            Alert.alert("Google Auth Error", "Something went wrong");
        }
    }, [response]);

    const handleBackendGoogleLogin = async (token) => {
        setLoading(true);
        const result = await googleLogin(token);
        setLoading(false);

        if (result?.error) {
            Alert.alert("Login Failed", typeof result.error === 'string' ? result.error : "Google login failed");
        } else {
            const nextRoute = await resolvePostAuthDestination();
            navigation.replace(nextRoute);
        }
    };

    // 3. Хелпер для рендеру іконок
    const renderIcon = (iconName, fallbackText, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;

                // ❌ МИ ПРИБРАЛИ ПЕРЕВІРКУ if (!tintColor)
                // Тепер ми ЗАВЖДИ використовуємо ColoredSvg, бо тільки він має КЕШ.

                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={width}
                        height={height}
                        color={tintColor} // Якщо null, ColoredSvg просто не буде фарбувати
                    />
                );
            }

            // PNG (стара логіка)
            const imageStyle = [style];
            if (tintColor) {
                imageStyle.push({ tintColor: tintColor });
            }

            return (
                <Image
                    source={{ uri: iconUrl }}
                    style={imageStyle}
                    resizeMode="contain"
                />
            );
        }

        return <Text style={[styles.headerText, { fontSize: 14, color: tintColor || '#F5D8CB' }]}>{fallbackText}</Text>;
    };

    const handleBackPress = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
            return;
        }
        navigation.navigate('Onboarding');
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

            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never">
                {/* BACK BUTTON */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBackPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {renderIcon('arrow-left.svg', '<', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                </TouchableOpacity>

                {/* TITLE */}
                <View style={styles.textBlock}>
                    <Text style={styles.title}>Ready to{'\n'}listen?</Text>
                    <Text style={styles.subtitle}>
                        Millions of tracks are waiting
                    </Text>
                </View>

                {/* BUTTONS */}
                <View style={styles.buttonsBlock}>
                    <TouchableOpacity
                        style={styles.primaryButton}
                        onPress={() => navigation.navigate('Register')}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.primaryText}>Sign Up</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.outlineButton}
                        onPress={() => navigation.navigate('Login')}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.outlineText}>Sign In</Text>
                    </TouchableOpacity>
                </View>

                {/* SOCIAL */}
                <View style={styles.socialBlock}>
                    <Text style={styles.or}>or continue with</Text>

                    <View style={styles.socialRow}>
                        <TouchableOpacity
                            style={styles.googleWideButton}
                            disabled={!request || loading}
                            onPress={() => {
                                if (request) {
                                    promptAsync(
                                        Platform.OS === 'android'
                                            ? { useProxy: false }
                                            : undefined
                                    );
                                }
                            }}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <>
                                    <ActivityIndicator color="#F5D8CB" size="small" />
                                    <Text style={styles.googleWideText}>Google</Text>
                                </>
                            ) : (
                                <>
                                    {renderIcon('google.svg', 'G', { width: scale(22), height: scale(22) }, '#F5D8CB')}
                                    <Text style={styles.googleWideText}>Google</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flexGrow: 1,
        paddingHorizontal: scale(16),
        paddingTop: Platform.OS === 'ios' ? scale(60) : scale(40),
        paddingBottom: scale(40),
    },

    backButton: {
        alignSelf: 'flex-start',
        marginBottom: scale(20),
    },

    /* TEXT */
    textBlock: {
        marginTop: scale(100), // Відступ зверху
        alignItems: 'center',
        marginBottom: scale(60),
    },

    title: {
        fontSize: scale(48),
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        textAlign: 'center',
        lineHeight: scale(44),
        marginBottom: scale(16)
    },

    subtitle: {
        fontSize: scale(16),
        fontFamily: 'Poppins-Regular',
        color: '#F5D8CB',
        textAlign: 'center'
    },

    /* BUTTONS */
    buttonsBlock: {
        width: '100%',
        alignItems: 'center',
    },

    primaryButton: {
        width: scale(343),
        height: scale(48),
        backgroundColor: '#F5D8CB',
        borderRadius: scale(24),
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(16)
    },

    primaryText: {
        color: '#300C0A', // Темний текст на світлій кнопці
        fontSize: scale(14),
        fontFamily: 'Unbounded-Regular'
    },

    outlineButton: {
        width: scale(343),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent'
    },

    outlineText: {
        fontSize: scale(14),
        fontFamily: 'Unbounded-Regular',
        color: '#F5D8CB'
    },

    /* SOCIAL */
    socialBlock: {
        marginTop: scale(48),
        alignItems: 'center'
    },

    or: {
        color: '#F5D8CB',
        marginBottom: scale(20),
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14)
    },

    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
    },

    googleWideButton: {
        width: scale(182),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        flexDirection: 'row',
        gap: scale(10),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent'
    },
    googleWideText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});
