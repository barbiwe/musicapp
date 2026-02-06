import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    Alert,
    ActivityIndicator,
    Image,
    StatusBar
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

// 👇 Імпорти API та утиліт
import { registerUser, googleLogin, scale, getIcons } from "../api/api";

WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen({ navigation }) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [secure, setSecure] = useState(true);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // 👇 Стейт для іконок
    const [icons, setIcons] = useState({});

    /* =========================
       GOOGLE AUTH CONFIG
    ========================= */
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        iosClientId: '651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6.apps.googleusercontent.com',
        clientId: '651816373430-hjii65stgn3ei6q1lrfs4e0dm298j9gn.apps.googleusercontent.com',
        redirectUri: 'com.googleusercontent.apps.651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6:/oauth2redirect/google'
    });

    // 1. Завантаження іконок
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

    // 2. Обробка Google Auth
    useEffect(() => {
        if (response?.type === "success") {
            const { id_token } = response.params;
            handleBackendGoogleRegister(id_token);
        } else if (response?.type === "error") {
            console.log("Google Register Error:", response.error);
        }
    }, [response]);

    const handleBackendGoogleRegister = async (token) => {
        setLoading(true);
        const result = await googleLogin(token);
        setLoading(false);

        if (result?.error) {
            Alert.alert("Error", typeof result.error === 'string' ? result.error : 'Google registration failed');
        } else {
            navigation.replace("Tracks");
        }
    };

    /* =========================
       HELPERS
    ========================= */
    const isFormValid = username && email && password.length >= 8;

    const handleRegister = async () => {
        if (!isFormValid) return;
        setLoading(true);
        const res = await registerUser(username, email, "", password);
        setLoading(false);

        if (res?.error) {
            Alert.alert("Error", typeof res.error === 'string' ? res.error : "Registration failed");
        } else {
            navigation.replace("Tracks");
        }
    };

    // Рендер іконки
    const renderIcon = (iconName, fallbackText, style, tintColor) => {
        if (icons[iconName]) {
            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor: tintColor });
            return <Image source={{ uri: icons[iconName] }} style={imageStyle} resizeMode="contain" />;
        }
        return <Text style={{ color: tintColor || '#F5D8CB', fontSize: scale(12) }}>{fallbackText}</Text>;
    };

    return (
        <LinearGradient
            colors={['#AC654F', '#883426', '#190707',]}
            locations={[0, 0.2, 0.5,]}
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
                    overScrollMode="never"
                >
                    {/* BACK BUTTON */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        {renderIcon('arrow-left.png', '<', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                    </TouchableOpacity>

                    {/* HEADER */}
                    <Text style={styles.title}>
                        Hey,{"\n"}Nice to meet you
                    </Text>

                    {/* INPUTS */}
                    <View style={styles.inputsWrap}>

                        {/* USERNAME */}
                        <View style={styles.inputWrapper}>
                            <View style={styles.iconCircle}>
                                {renderIcon('user.png', 'U', { width: scale(20), height: scale(20) }, '#F5D8CB')}
                            </View>
                            <TextInput
                                placeholder="Name"
                                value={username}
                                onChangeText={setUsername}
                                style={styles.input}
                                placeholderTextColor="#F5D8CB" // #F5D8CB напівпрозорий
                            />
                        </View>

                        {/* EMAIL */}
                        <View style={styles.inputWrapper}>
                            <View style={styles.iconCircle}>
                                {renderIcon('email.png', '@', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </View>
                            <TextInput
                                placeholder="Email"
                                value={email}
                                onChangeText={setEmail}
                                style={styles.input}
                                placeholderTextColor="#F5D8CB"
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        {/* PASSWORD */}
                        <View style={[
                            styles.inputWrapper,
                            (password.length > 0 && password.length < 8) ? { borderColor: '#F5D8CB' } : {}
                        ]}>
                            <View style={styles.iconCircle}>
                                {renderIcon('password.png', '*', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </View>

                            <TextInput
                                placeholder="Password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={secure}
                                style={styles.input}
                                placeholderTextColor="#F5D8CB"
                            />
                        </View>

                        {/* Текст помилки знизу */}
                        {password.length > 0 && password.length < 8 && (
                            <Text style={{
                                color: '#F5D8CB',
                                opacity: 0.8,
                                marginTop: scale(4),
                                textAlign: 'center',
                                width: '100%',
                                fontSize: scale(12),
                                fontFamily: 'Poppins-Regular'
                            }}>
                                Password must contain 8 numbers
                            </Text>
                        )}
                    </View>

                    {/* REGISTER BUTTON */}
                    <TouchableOpacity
                        disabled={!isFormValid || loading}
                        onPress={handleRegister}
                        style={[
                            styles.button,
                            (!isFormValid || loading) && styles.buttonDisabled
                        ]}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator color="#300C0A" />
                        ) : (
                            <Text style={styles.buttonText}>Sign up</Text>
                        )}
                    </TouchableOpacity>

                    {/* SOCIAL */}
                    <Text style={styles.or}>or continue with</Text>

                    <View style={styles.socialRow}>
                        {/* GOOGLE BUTTON */}
                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={() => {
                                if (request) promptAsync();
                            }}
                            disabled={!request}
                        >
                            {renderIcon('google.png', 'G', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        {/* DISCORD BUTTON */}
                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={() => Alert.alert("Discord", "Coming soon")}
                        >
                            {renderIcon('discord.png', 'D', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>
                    </View>

                    {/* FOOTER */}
                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity onPress={() => navigation.replace('Login')}>
                            <Text style={styles.linkText}>Sign in</Text>
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
        marginBottom: scale(74),
    },

    /* TITLES */
    title: {
        fontSize: scale(32),
        fontFamily: 'Unbounded-SemiBold',
        color: '#F5D8CB',
        lineHeight: scale(40),
        marginBottom: scale(10)
    },

    inputsWrap: {
        marginTop: scale(30)
    },

    /* INPUT STYLE */
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        height: scale(48),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(24),
        marginTop: scale(16),
        paddingRight: scale(16),
        position: 'relative'
    },

    // Кружечок зліва
    iconCircle: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderRightWidth: 1,
        borderColor: '#bbb',
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
        marginLeft: scale(56) + scale(12) // Відступ для тексту, щоб не наліз на іконку
    },

    /* BUTTON */
    button: {
        marginTop: scale(46),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#F5D8CB',
        alignItems: "center",
        justifyContent: "center"
    },
    buttonDisabled: {
        opacity: 0.6
    },
    buttonText: {
        color: '#300C0A',
        fontSize: scale(14),
        fontFamily: 'Unbounded-Regular',
    },

    /* SOCIAL */
    or: {
        marginTop: scale(40),
        textAlign: "center",
        color: "#F5D8CB",
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14)
    },
    socialRow: {
        marginTop: scale(20),
        flexDirection: "row",
        justifyContent: "center",
        gap: scale(20)
    },
    socialButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center'
    },

    /* FOOTER */
    footerContainer: {
        marginTop: scale(40),
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