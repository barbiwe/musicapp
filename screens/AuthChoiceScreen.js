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

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

// 👇 Імпортуємо scale та getIcons
import { googleLogin, scale, getIcons } from "../api/api";

WebBrowser.maybeCompleteAuthSession();

export default function AuthChoiceScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [icons, setIcons] = useState({}); // 👇 Стейт для іконок

    /* =========================
       GOOGLE AUTH CONFIG
    ========================= */
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        iosClientId: '651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6.apps.googleusercontent.com',
        clientId: '651816373430-hjii65stgn3ei6q1lrfs4e0dm298j9gn.apps.googleusercontent.com',
        redirectUri: 'com.googleusercontent.apps.651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6:/oauth2redirect/google'
    });

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
            navigation.replace("Tracks");
        }
    };

    // 3. Хелпер для рендеру іконок
    const renderIcon = (iconName, fallbackText, style, tintColor) => {
        if (icons[iconName]) {
            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor: tintColor });
            return <Image source={{ uri: icons[iconName] }} style={imageStyle} resizeMode="contain" />;
        }
        // Фолбек, якщо іконки немає
        return <Text style={{ color: tintColor || '#F5D8CB', fontWeight: 'bold' }}>{fallbackText}</Text>;
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

            <ScrollView
                contentContainerStyle={styles.container}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never">
            >
                {/* BACK BUTTON */}
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    {renderIcon('arrow-left.png', '<', { width: scale(24), height: scale(24) }, '#F5D8CB')}
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
                        {/* GOOGLE BUTTON */}
                        <TouchableOpacity
                            style={styles.socialButton}
                            disabled={!request || loading}
                            onPress={() => {
                                if (request) promptAsync();
                            }}
                        >
                            {loading ? (
                                <ActivityIndicator color="#F5D8CB" size="small" />
                            ) : (
                                // Припускаємо, що іконка називається 'google.png'
                                renderIcon('google.png', 'G', { width: scale(24), height: scale(24) }, '#F5D8CB')
                            )}
                        </TouchableOpacity>

                        {/* DISCORD BUTTON (Placeholder logic) */}
                        <TouchableOpacity
                            style={styles.socialButton}
                            onPress={() => Alert.alert("Discord", "Coming soon!")}
                        >
                            {/* Припускаємо, що іконка називається 'discord.png' */}
                            {renderIcon('discord.png', 'D', { width: scale(24), height: scale(24) }, '#F5D8CB')}
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
        gap: scale(20)
    },

    socialButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent'
    },
});