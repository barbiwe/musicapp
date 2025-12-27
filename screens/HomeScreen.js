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
    ActivityIndicator // Додав імпорт індикатора
} from "react-native";

import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";

// 👇 Використовуємо твої функції з API
import { registerUser, googleLogin } from "../api/api";

WebBrowser.maybeCompleteAuthSession();

const INPUT_HEIGHT = Platform.OS === "ios" ? 56 : 52;

export default function RegisterScreen({ navigation }) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [secure, setSecure] = useState(true);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    /* =========================
       GOOGLE AUTH CONFIG (FIXED)
    ========================= */
    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        // 👇 iOS Client ID (Native)
        iosClientId: '651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6.apps.googleusercontent.com',

        // 👇 Web Client ID (для бекенду)
        clientId: '651816373430-hjii65stgn3ei6q1lrfs4e0dm298j9gn.apps.googleusercontent.com',

        // 👇 ВАЖЛИВО: Виправляємо помилку redirect_uri_mismatch
        redirectUri: 'com.googleusercontent.apps.651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6:/oauth2redirect/google'
    });

    useEffect(() => {
        if (response?.type === "success") {
            const { id_token } = response.params;
            handleBackendGoogleRegister(id_token);
        } else if (response?.type === "error") {
            // Логуємо помилку, якщо щось піде не так
            console.log("Google Register Error:", response.error);
        }
    }, [response]);

    const handleBackendGoogleRegister = async (token) => {
        setLoading(true);
        // Реєстрація через Google і логін — це один і той самий ендпоінт на бекенді
        const result = await googleLogin(token);
        setLoading(false);

        if (result?.error) {
            Alert.alert("Error", typeof result.error === 'string' ? result.error : 'Google registration failed');
        } else {
            // Успіх
            navigation.replace("Tracks");
        }
    };

    /* =========================
       FORM VALIDATION
    ========================= */
    const isPasswordValid = password.length >= 8;
    const isFormValid = username && email && isPasswordValid;

    /* =========================
       EMAIL REGISTER
    ========================= */
    const handleRegister = async () => {
        if (!isFormValid) return;

        setLoading(true);
        // Передаємо пустий телефон "", бо в формі його немає, а API вимагає
        const res = await registerUser(username, email, "", password);
        setLoading(false);

        if (res?.error) {
            // Якщо помилка (наприклад, Email зайнятий)
            Alert.alert("Error", typeof res.error === 'string' ? res.error : "Registration failed");
        } else {
            Alert.alert("Success", "Account created");
            navigation.replace("Tracks");
        }
    };

    /* =========================
       DISCORD (LATER)
    ========================= */
    const handleDiscordAuth = () => {
        Alert.alert("Discord Auth", "Coming soon");
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                {/* HEADER */}
                <Text style={styles.title}>
                    Hey,{"\n"}Nice to meet you
                </Text>

                {/* INPUTS */}
                <View style={styles.inputsWrap}>
                    {/* USERNAME */}
                    <View style={styles.inputWrapper}>
                        <View style={styles.iconContainer} />
                        <TextInput
                            placeholder="Name"
                            value={username}
                            onChangeText={setUsername}
                            style={styles.input}
                            placeholderTextColor="#999"
                        />
                    </View>

                    {/* EMAIL */}
                    <View style={styles.inputWrapper}>
                        <View style={styles.iconContainer} />
                        <TextInput
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            style={styles.input}
                            placeholderTextColor="#999"
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    {/* PASSWORD */}
                    <View
                        style={[
                            styles.inputWrapper,
                            error && styles.inputError
                        ]}
                    >
                        <View style={styles.iconContainer} />

                        <TextInput
                            placeholder="Password"
                            value={password}
                            onChangeText={(v) => {
                                setPassword(v);
                                setError(v.length >= 8 ? "" : "Invalid password");
                            }}
                            secureTextEntry={secure}
                            style={styles.input}
                            placeholderTextColor="#999"
                        />

                        <TouchableOpacity onPress={() => setSecure(!secure)}>
                            <Text style={styles.toggle}>
                                {secure ? "Show" : "Hide"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.helper}>
                        Password must contain at least 8 characters
                    </Text>

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                </View>

                {/* REGISTER BUTTON */}
                <TouchableOpacity
                    disabled={!isFormValid || loading}
                    onPress={handleRegister}
                    style={[
                        styles.button,
                        (!isFormValid || loading) && styles.buttonDisabled
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text
                            style={[
                                styles.buttonText,
                                !isFormValid && styles.buttonTextDisabled
                            ]}
                        >
                            Sign up
                        </Text>
                    )}
                </TouchableOpacity>

                {/* SOCIAL */}
                <Text style={styles.or}>or continue with</Text>

                <View style={styles.socialRow}>
                    {/* GOOGLE BUTTON */}
                    <TouchableOpacity
                        style={styles.socialStub}
                        onPress={() => {
                            if (request) {
                                promptAsync();
                            } else {
                                Alert.alert("Wait", "Google loading...");
                            }
                        }}
                        disabled={!request}
                    >
                        <Text style={{ fontWeight: 'bold', fontSize: 18, textAlign: 'center', lineHeight: 46 }}>G</Text>
                    </TouchableOpacity>

                    {/* DISCORD BUTTON */}
                    <TouchableOpacity
                        style={styles.socialStub}
                        onPress={handleDiscordAuth}
                    />
                </View>

                {/* FOOTER */}
                <Text style={styles.footer}>
                    Already have an account?{" "}
                    <Text
                        style={styles.link}
                        onPress={() => navigation.goBack()}
                    >
                        Sign in
                    </Text>
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        paddingHorizontal: 16,
        backgroundColor: "#fff"
    },
    title: {
        marginTop: 130,
        fontSize: 34,
        fontWeight: "700",
        lineHeight: 40
    },
    inputsWrap: {
        marginTop: 40
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        height: INPUT_HEIGHT,
        borderWidth: 1,
        borderColor: "#434343",
        borderRadius: INPUT_HEIGHT / 2,
        marginTop: 20,
        paddingRight: 16
    },
    iconContainer: {
        width: INPUT_HEIGHT,
        height: INPUT_HEIGHT,
        borderRadius: INPUT_HEIGHT / 2,
        borderWidth: 1,
        borderColor: "#434343",
        marginLeft: -1,
        marginRight: 12
    },
    input: { flex: 1, fontSize: 16 },
    toggle: { fontSize: 12, color: "#000" },
    helper: {
        marginTop: 8,
        fontSize: 12,
        color: "#999",
        textAlign: "center"
    },
    error: {
        marginTop: 8,
        color: "red",
        fontSize: 12,
        textAlign: "center"
    },
    inputError: { borderColor: "red" },
    button: {
        marginTop: 61,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center"
    },
    buttonDisabled: { backgroundColor: "#9F9F9F" },
    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600"
    },
    buttonTextDisabled: { color: "#BFBFBF" },
    or: {
        marginTop: 38,
        textAlign: "center",
        color: "#000"
    },
    socialRow: {
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "center",
        gap: 20
    },
    socialStub: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: "#000"
    },
    footer: {
        marginTop: 24,
        textAlign: "center",
        color: "#999"
    },
    link: {
        color: "#868686",
        fontWeight: "600",
        textDecorationLine: 'underline'
    }
});