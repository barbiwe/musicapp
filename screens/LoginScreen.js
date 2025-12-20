import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Platform
} from 'react-native';

import { loginUser } from '../api/api';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async () => {
        if (!username || !password) {
            setError('Fill all fields');
            return;
        }

        setLoading(true);
        setError('');

        const result = await loginUser(username, password);
        setLoading(false);

        if (result?.error) {
            setError('Invalid username or password');
            return;
        }

        navigation.replace('Tracks');
    };

    const isDisabled = !username || !password || loading;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Hey,{'\n'}Welcome Back</Text>

            {/* USERNAME */}
            <View style={[styles.inputWrapper, error && styles.inputError]}>
                <View style={styles.iconContainer}>
                    {/* тут пізніше буде іконка з бекенду */}
                </View>

                <TextInput
                    placeholder="Username"
                    value={username}
                    onChangeText={setUsername}
                    style={styles.input}
                    autoCapitalize="none"
                />
            </View>

            {/* PASSWORD */}
            <View style={[styles.inputWrapper, error && styles.inputError]}>
                <View style={styles.iconContainer}>
                    {/* тут пізніше буде іконка з бекенду */}
                </View>

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

            <View style={styles.socialRow}>
                <View style={styles.socialStub} />
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
        marginBottom: 40,
        color: '#000'
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
        // тут потім буде icon
    },

    input: {
        flex: 1,
        fontSize: 16
    },

    inputError: {
        borderColor: 'red'
    },

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

    buttonDisabled: {
        backgroundColor: '#9F9F9F'
    },

    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    },

    or: {
        textAlign: 'center',
        marginBottom: 16,
        color: '#666'
    },

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
        borderColor: '#000'
    },

    footer: {
        textAlign: 'center',
        color: '#666'
    },

    link: {
        color: '#868686',
        fontWeight: '600',
        textDecorationLine: 'underline'
    }
});
