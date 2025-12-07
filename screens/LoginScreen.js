import React, { useState } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from "react-native";
import { loginUser } from "../api/api";

export default function LoginScreen({ onLoginSuccess, onSwitch }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!username || !password) {
            Alert.alert("Помилка", "Введіть логін та пароль");
            return;
        }
        setLoading(true);
        const result = await loginUser({ Username: username, Password: password });
        setLoading(false);

        if (result.error) {
            Alert.alert("Помилка", result.error);
        } else {
            onLoginSuccess();
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Вхід</Text>

            <TextInput
                placeholder="Логін"
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />
            <TextInput
                placeholder="Пароль"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            {loading ? (
                <ActivityIndicator size="large" color="#2196F3" />
            ) : (
                <Button title="Увійти" color="#2196F3" onPress={handleLogin} />
            )}

            <TouchableOpacity onPress={onSwitch} style={styles.linkButton}>
                <Text style={styles.linkText}>Немає акаунту? Реєстрація</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: "center", padding: 20 },
    header: { fontSize: 24, fontWeight: "bold", marginBottom: 30, textAlign: "center" },
    input: { borderWidth: 1, borderColor: "#ccc", padding: 10, borderRadius: 5, marginBottom: 15 },
    linkButton: { alignItems: 'center', marginTop: 20 },
    linkText: { color: '#2196F3', fontSize: 16 }
});