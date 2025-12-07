import React, { useState } from "react";
import { Text, TextInput, Button, StyleSheet, ScrollView, Alert, TouchableOpacity } from "react-native";
import { registerUser } from "../api/api";

export default function HomeScreen({ onSwitch }) {
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [password, setPassword] = useState("");

    const handleSend = async () => {
        const userData = {
            Username: username,
            Email: email,
            PhoneNumber: phoneNumber,
            Password: password
        };

        const result = await registerUser(userData);

        if (result.error) {
            Alert.alert("Помилка", result.error);
        } else {
            Alert.alert("Успіх", "Реєстрація успішна! Увійдіть.");
            onSwitch();
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Реєстрація</Text>

            <TextInput placeholder="Логін" value={username} onChangeText={setUsername} style={styles.input} autoCapitalize="none"/>
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none"/>
            <TextInput placeholder="Телефон" value={phoneNumber} onChangeText={setPhoneNumber} style={styles.input} keyboardType="phone-pad"/>
            <TextInput placeholder="Пароль" value={password} onChangeText={setPassword} style={styles.input} secureTextEntry/>

            <Button title="Зареєструватися" color="#2196F3" onPress={handleSend} />

            <TouchableOpacity onPress={onSwitch} style={styles.linkButton}>
                <Text style={styles.linkText}>Вже є акаунт? Вхід</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    header: { fontSize: 24, fontWeight: "bold", marginBottom: 30, textAlign: "center" },
    input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, marginBottom: 15 },
    linkButton: { alignItems: 'center', marginTop: 20 },
    linkText: { color: '#2196F3', fontSize: 16 }
});