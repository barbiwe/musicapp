import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Alert,
    ActivityIndicator
} from 'react-native';

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

// 👇 Імпортуємо функцію логіну з API
import { googleLogin } from "../api/api";

WebBrowser.maybeCompleteAuthSession();

const BUTTON_HEIGHT = Platform.OS === 'ios' ? 56 : 52;

export default function AuthChoiceScreen({ navigation }) {
    const [loading, setLoading] = useState(false);

    /* =========================
       GOOGLE AUTH CONFIG
    ========================= */
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        // 👇 Ті самі ID, що ми налаштували раніше
        iosClientId: '651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6.apps.googleusercontent.com',
        clientId: '651816373430-hjii65stgn3ei6q1lrfs4e0dm298j9gn.apps.googleusercontent.com',
        redirectUri: 'com.googleusercontent.apps.651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6:/oauth2redirect/google'
    });

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
        // Відправляємо токен на твій бекенд
        const result = await googleLogin(token);
        setLoading(false);

        if (result?.error) {
            Alert.alert("Login Failed", typeof result.error === 'string' ? result.error : "Google login failed");
        } else {
            // Успішний вхід -> йдемо до треків
            navigation.replace("Tracks");
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
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
                >
                    <Text style={styles.primaryText}>Sign Up</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.outlineButton}
                    onPress={() => navigation.navigate('Login')}
                    disabled={loading}
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
                            <ActivityIndicator color="#000" size="small" />
                        ) : (
                            <Text style={styles.socialText}>G</Text>
                        )}
                    </TouchableOpacity>

                    {/* APPLE / FACEBOOK PLACEHOLDER */}
                    <TouchableOpacity style={styles.socialButton}>
                        <Text style={styles.socialText}> </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    );
}


const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#fff',
        paddingHorizontal: 24
    },

    /* TEXT */
    textBlock: {
        marginTop: 220,
        alignItems: 'center'
    },

    title: {
        fontSize: 48,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 46,
        marginBottom: 12
    },

    subtitle: {
        fontSize: 16,
        color: '#9A9A9A',
        textAlign: 'center'
    },

    /* BUTTONS */
    buttonsBlock: {
        marginTop: 48
    },

    primaryButton: {
        height: BUTTON_HEIGHT,
        backgroundColor: '#000',
        borderRadius: BUTTON_HEIGHT / 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },

    primaryText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },

    outlineButton: {
        height: BUTTON_HEIGHT,
        borderRadius: BUTTON_HEIGHT / 2,
        borderWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center'
    },

    outlineText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000'
    },

    /* SOCIAL */
    socialBlock: {
        marginTop: 48,
        alignItems: 'center'
    },

    or: {
        color: '#000',
        marginBottom: 20
    },

    socialRow: {
        flexDirection: 'row',
        gap: 20
    },

    socialButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center'
    },

    socialText: {
        fontSize: 18,
        fontWeight: '700'
    }
});