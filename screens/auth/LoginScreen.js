import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform,
    Alert,
    KeyboardAvoidingView,
    Image,
    StatusBar
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgUri, SvgXml } from 'react-native-svg';
// 👇 Імпортуємо готові функції та утиліти
import { loginUser, googleLogin, scale, getIcons } from '../../api/api';
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

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [secure, setSecure] = useState(true);

    // Стейт для іконок
    const [icons, setIcons] = useState({});

    /* =========================
           GOOGLE AUTH CONFIG
    ========================= */
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
        getGoogleAuthRequestConfig()
    );

    // 1. Завантаження іконок при старті
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
        if (response?.type === 'success') {
            const { id_token } = response.params;
            handleBackendGoogleLogin(id_token);
        } else if (response?.type === 'error') {
            setError('Google sign-in failed');
        }
    }, [response]);

    /* =========================
       LOGIC
    ========================= */
    const handleBackendGoogleLogin = async (token) => {
        setLoading(true);
        const result = await googleLogin(token);
        setLoading(false);

        if (result?.error) {
            setError(typeof result.error === 'string' ? result.error : 'Google login failed');
        } else {
            try {
                const uid = result.userId || result.id;
                if (uid) await AsyncStorage.setItem('userId', uid.toString());
            } catch(e) { console.log(e); }

            navigation.replace('MainTabs');
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Fill all fields');
            return;
        }

        setLoading(true);
        setError('');

        const result = await loginUser(email, password);
        setLoading(false);

        if (result?.error) {
            const errText = String(result.error || '').toLowerCase();
            if (errText.includes('confirm your email first')) {
                navigation.navigate('ConfirmEmail', { email: email.trim() });
                return;
            }
            setError('Invalid email or password');
            return;
        }

        try {
            const uid = result.userId || result.id;
            if (uid) await AsyncStorage.setItem('userId', uid.toString());
        } catch(e) { console.log(e); }

        navigation.replace('MainTabs');
    };

    // 👇 Змінив аргументи: прибрав fallbackText, тепер їх 3
    const renderIcon = (iconName, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                // Тепер style — це справді стиль, а не текст
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;

                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={width}
                        height={height}
                        color={tintColor}
                    />
                );
            }

            // PNG
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

        // Якщо іконки немає — просто нічого не показуємо, або показуємо назву дрібно
        // (Щоб не було помилки об'єкта)
        return null;
        // Або якщо хочеш бачити текст:
        // return <Text style={{ fontSize: 10, color: 'red' }}>{iconName}</Text>;
    };


    const isDisabled = !email || !password || loading;

    return (
        <LinearGradient
            colors={['#9A4B39', '#80291E', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" />

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                >
                    {/* BACK BUTTON (Опціонально, якщо треба повертатись назад) */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.canGoBack() ? navigation.goBack() : null}
                    >
                    </TouchableOpacity>

                    <Text style={styles.title}>Hey,{'\n'}Welcome Back</Text>

                    <View style={styles.inputsWrap}>
                        {/* EMAIL INPUT */}
                        <View style={[styles.inputWrapper, error ? { borderColor: 'red' } : {}]}>
                            <View style={styles.iconCircle}>
                                {renderIcon('email.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </View>
                            <TextInput
                            keyboardAppearance="dark"
                                placeholder="Email"
                                value={email}
                                onChangeText={setEmail}
                                style={styles.input}
                                placeholderTextColor="#F5D8CB"
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        {/* PASSWORD INPUT */}
                        <View style={[styles.inputWrapper, error ? { borderColor: 'red' } : {}]}>
                            <View style={styles.iconCircle}>
                                {renderIcon('password.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </View>
                            <TextInput
                            keyboardAppearance="dark"
                                placeholder="Password"
                                value={password}
                                onChangeText={setPassword}
                                style={styles.input}
                                placeholderTextColor="#F5D8CB"
                                secureTextEntry={secure}
                            />
                            {/* Око для показу пароля (опціонально) */}
                            <TouchableOpacity
                                onPress={() => setSecure(!secure)}
                                style={{ position: 'absolute', right: scale(16) }}
                            >
                                {/* Тут можна додати іконку ока, якщо вона є в базі */}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                        <Text style={styles.forgot}>Forgot password?</Text>
                    </TouchableOpacity>

                    {/* SIGN IN BUTTON */}
                    <TouchableOpacity
                        style={[styles.button, isDisabled && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={isDisabled}
                    >
                        {loading ? (
                            <ActivityIndicator color="#300C0A" />
                        ) : (
                            <Text style={styles.buttonText}>Sign in</Text>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.or}>or continue with</Text>

                    {/* SOCIAL ROW */}
                    <View style={styles.socialRow}>
                        <TouchableOpacity
                            style={styles.googleWideButton}
                            onPress={() => {
                                if (request) {
                                    promptAsync(
                                        Platform.OS === 'android'
                                            ? { useProxy: false }
                                            : undefined
                                    );
                                } else {
                                    Alert.alert("Wait", "Google loading...");
                                }
                            }}
                            disabled={!request}
                            activeOpacity={0.85}
                        >
                            {renderIcon('google.svg', { width: scale(22), height: scale(22) }, '#F5D8CB')}
                            <Text style={styles.googleWideText}>Google</Text>
                        </TouchableOpacity>
                    </View>

                    {/* FOOTER */}
                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>Don’t have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.linkText}>Sign Up</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
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
        marginBottom: scale(40), // Менше відступу, ніж в Register, бо там стрілка вище
        height: scale(24) // Резерв місця
    },
    title: {
        fontSize: scale(32),
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        lineHeight: scale(40),
        marginBottom: scale(10),
        marginTop: scale(20)
    },
    inputsWrap: {
        marginTop: scale(30),
        marginBottom: scale(16),

    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        height: scale(48),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(24),
        marginBottom: scale(16),
        paddingRight: scale(16),
        position: 'relative'
    },
    iconCircle: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderRightWidth: 1,
        borderColor: '#bbb', // Або колір бордера
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(12),
        borderWidth: 1,
        position: 'absolute',
        left: -1,
        top: -1
    },
    input: {
        flex: 1,
        fontSize: scale(14),
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        marginLeft: scale(56) + scale(12)
    },
    errorText: {
        color: '#FF6B6B',
        fontSize: scale(12),
        marginBottom: scale(10),
        marginLeft: scale(10),
        marginTop: scale(-20),
        fontFamily: 'Unbounded-Regular'
    },
    forgot: {
        textAlign: 'right',
        textDecorationLine: 'underline',
        marginBottom: scale(61),
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14)
    },
    button: {
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#F5D8CB',
        alignItems: "center",
        justifyContent: "center",
        marginBottom: scale(30)
    },
    buttonDisabled: {
        opacity: 0.6
    },
    buttonText: {
        color: '#300C0A',
        fontSize: scale(14),
        fontFamily: 'Unbounded-Regular',
    },
    or: {
        textAlign: "center",
        color: "#F5D8CB",
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
        marginBottom: scale(20)
    },
    socialRow: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: scale(40)
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
        marginBottom: scale(36),
    },
    googleWideText: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
    footerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center'
    },
    footerText: {
        color: "#F5D8CB",
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14)
    },
    linkText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        textDecorationLine: 'underline'
    }
});
