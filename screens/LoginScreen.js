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
    Alert
} from 'react-native';

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 👇 Імпортуємо готові функції з твого api.js
import { loginUser, googleLogin } from '../api/api';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    /* =========================
           GOOGLE AUTH CONFIG
    ========================= */
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        // Твій iOS Client ID
        iosClientId: '651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6.apps.googleusercontent.com',

        // Web Client ID (для бекенду)
        clientId: '651816373430-hjii65stgn3ei6q1lrfs4e0dm298j9gn.apps.googleusercontent.com',

        // 👇 ДОДАНО: Цей рядок обов'язковий, щоб прибрати помилку redirect_uri_mismatch
        // Він складається з твоєї схеми + спеціального закінчення
        redirectUri: 'com.googleusercontent.apps.651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6:/oauth2redirect/google'
    });

    useEffect(() => {
        if (response?.type === 'success') {
            // Отримуємо id_token з параметрів
            const { id_token } = response.params;
            handleBackendGoogleLogin(id_token);
        } else if (response?.type === 'error') {
            setError('Google sign-in failed');
        }
    }, [response]);

    /* =========================
       LOGIC: SEND TOKEN TO BACKEND
    ========================= */
    const handleBackendGoogleLogin = async (token) => {
        setLoading(true);
        const result = await googleLogin(token);
        setLoading(false);

        if (result?.error) {
            setError(typeof result.error === 'string' ? result.error : 'Google login failed');
        } else {
            // 👇 ДОДАЙ ЦЕ 👇
            try {
                // Переконайся, що result містить userId або id.
                // Зазвичай це result.userId або result.id або result.user.id
                const uid = result.userId || result.id;
                if (uid) {
                    await AsyncStorage.setItem('userId', uid.toString());
                }
            } catch(e) { console.log(e); }
            // 👆 ДОСЮДИ 👆

            navigation.replace('Tracks');
        }
    };

    /* =========================
       EMAIL/PASSWORD LOGIN
    ========================= */
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
            setError('Invalid email or password');
            return;
        }

        try {
            const uid = result.userId || result.id;
            if (uid) {
                await AsyncStorage.setItem('userId', uid.toString());
            }
        } catch(e) { console.log(e); }

        navigation.replace('Tracks');
    };

    const isDisabled = !email || !password || loading;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Hey,{'\n'}Welcome Back</Text>

            {/* EMAIL */}
            <View style={[styles.inputWrapper, error && styles.inputError]}>
                <View style={styles.iconContainer} />
                <TextInput
                    placeholder="Email"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
            </View>

            {/* PASSWORD */}
            <View style={[styles.inputWrapper, error && styles.inputError]}>
                <View style={styles.iconContainer} />
                <TextInput
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    style={styles.input}
                    secureTextEntry
                />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity>
                <Text style={styles.forgot}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.button, isDisabled && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isDisabled}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Sign in</Text>
                )}
            </TouchableOpacity>

            <Text style={styles.or}>or continue with</Text>

            {/* SOCIAL LOGIN */}
            <View style={styles.socialRow}>
                {/* GOOGLE BUTTON */}
                <TouchableOpacity
                    style={styles.socialStub}
                    onPress={() => {
                        if (request) {
                            promptAsync();
                        } else {
                            Alert.alert("Зачекайте", "Google ще завантажується...");
                        }
                    }}
                    disabled={!request}
                >
                    {/* Тимчасова буква G, щоб бачити кнопку */}
                    <Text style={{ fontWeight: 'bold', fontSize: 18 }}>G</Text>
                </TouchableOpacity>

                {/* Заглушка (наприклад, для Apple) */}
                <View style={styles.socialStub} />
            </View>

            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.footer}>
                    Don’t have an account? <Text style={styles.link}>Sign Up</Text>
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const INPUT_HEIGHT = Platform.OS === 'ios' ? 56 : 52;

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 24,
        backgroundColor: '#fff'
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginTop: 130,
        marginBottom: 40
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: INPUT_HEIGHT,
        borderWidth: 1,
        borderColor: '#434343',
        borderRadius: INPUT_HEIGHT / 2,
        marginBottom: 20,
        paddingRight: 16
    },
    iconContainer: {
        width: INPUT_HEIGHT,
        height: INPUT_HEIGHT,
        borderRadius: INPUT_HEIGHT / 2,
        borderWidth: 1,
        borderColor: '#434343',
        marginLeft: -1,
        marginRight: 12
    },
    input: { flex: 1, fontSize: 16 },
    inputError: { borderColor: 'red' },
    errorText: {
        color: 'red',
        fontSize: 12,
        marginBottom: 10,
        marginLeft: 10
    },
    forgot: {
        textAlign: 'right',
        textDecorationLine: 'underline',
        marginBottom: 61
    },
    button: {
        backgroundColor: '#000',
        borderRadius: 30,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 30
    },
    buttonDisabled: { backgroundColor: '#9F9F9F' },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    or: { textAlign: 'center', marginBottom: 16, color: '#666' },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginBottom: 40
    },
    socialStub: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#000',
        alignItems: 'center',
        justifyContent: 'center'
    },
    footer: { textAlign: 'center', color: '#666' },
    link: {
        color: '#868686',
        fontWeight: '600',
        textDecorationLine: 'underline'
    }
});