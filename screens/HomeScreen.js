import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    KeyboardAvoidingView,
    Alert
} from "react-native";

import { registerUser } from "../api/api";

const INPUT_HEIGHT = Platform.OS === "ios" ? 56 : 52;

export default function RegisterScreen({ navigation }) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [secure, setSecure] = useState(true);
    const [error, setError] = useState("");

    const isPasswordValid = password.length >= 8;
    const isFormValid = username && email && isPasswordValid;

    const handleRegister = async () => {
        if (!isFormValid) return;

        const res = await registerUser(username, email, "", password);

        if (res?.error) {
            Alert.alert("Error", res.error);
        } else {
            Alert.alert("Success", "Account created");
            navigation.goBack();
        }
    };

    const handleGoogleAuth = () => {
        Alert.alert("Google Auth", "Backend not connected yet");
    };

    const handleDiscordAuth = () => {
        Alert.alert("Discord Auth", "Backend not connected yet");
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
                    {/* NAME */}
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

                    {/* HELPER */}
                    <Text style={styles.helper}>
                        Password must contain at least 8 characters
                    </Text>

                    {error ? <Text style={styles.error}>{error}</Text> : null}
                </View>

                {/* BUTTON */}
                <TouchableOpacity
                    disabled={!isFormValid}
                    onPress={handleRegister}
                    style={[
                        styles.button,
                        !isFormValid && styles.buttonDisabled
                    ]}
                >
                    <Text
                        style={[
                            styles.buttonText,
                            !isFormValid && styles.buttonTextDisabled
                        ]}
                    >
                        Sign up
                    </Text>
                </TouchableOpacity>

                {/* SOCIAL */}
                <Text style={styles.or}>or continue with</Text>

                <View style={styles.socialRow}>
                    <TouchableOpacity
                        style={styles.socialStub}
                        onPress={handleGoogleAuth}
                    />
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

    input: {
        flex: 1,
        fontSize: 16
    },

    toggle: {
        fontSize: 12,
        color: "#000"
    },

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

    inputError: {
        borderColor: "red"
    },

    button: {
        marginTop: 61,
        height: 56,
        borderRadius: 28,
        backgroundColor: "#000",
        alignItems: "center",
        justifyContent: "center"
    },

    buttonDisabled: {
        backgroundColor: "#9F9F9F"
    },

    buttonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600"
    },

    buttonTextDisabled: {
        color: "#BFBFBF"
    },

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
        textDecorationLine: "underline"
    }
});
