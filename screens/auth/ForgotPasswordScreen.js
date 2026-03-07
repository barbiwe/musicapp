import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getIcons, scale, requestPasswordReset } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

export default function ForgotPasswordScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [icons, setIcons] = useState({});

    useEffect(() => {
        let mounted = true;
        getIcons()
            .then((map) => {
                if (mounted) setIcons(map || {});
            })
            .catch(() => {});
        return () => { mounted = false; };
    }, []);

    const onSendCode = async () => {
        const normalizedEmail = email.trim();
        if (!normalizedEmail) {
            Alert.alert('Error', 'Enter email');
            return;
        }

        setLoading(true);
        const res = await requestPasswordReset(normalizedEmail);
        setLoading(false);

        if (res?.error) {
            Alert.alert('Error', typeof res.error === 'string' ? res.error : 'Failed to send reset code');
            return;
        }

        navigation.navigate('ResetCode', { email: normalizedEmail });
    };

    return (
        <LinearGradient
            colors={['#9A4B39', '#80291E', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" />
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.container}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <RemoteTintIcon
                            icons={icons}
                            iconName="arrow-left.svg"
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback="‹"
                        />
                    </TouchableOpacity>

                    <Text style={styles.title}>Forgot{"\n"}password</Text>
                    <Text style={styles.subtitle}>A password reset code will be sent to this email.</Text>

                    <View style={styles.inputWrapper}>
                        <View style={styles.leftIconCircle}>
                            <RemoteTintIcon
                                icons={icons}
                                iconName="email.svg"
                                width={scale(20)}
                                height={scale(20)}
                                color="#F5D8CB"
                                fallback="@"
                            />
                        </View>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Email"
                            placeholderTextColor="rgba(245,216,203,0.65)"
                            style={styles.input}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.primaryButton, (!email.trim() || loading) && styles.buttonDisabled]}
                        onPress={onSendCode}
                        disabled={!email.trim() || loading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryButtonText}>{loading ? 'Sending...' : 'Sign up'}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    gradient: { flex: 1 },
    container: {
        flex: 1,
        paddingHorizontal: scale(16),
        paddingTop: Platform.OS === 'ios' ? scale(60) : scale(40),
        paddingBottom: scale(32),
    },
    backButton: {
        alignSelf: 'flex-start',
        marginBottom: scale(72),
        width: scale(24),
        height: scale(24),
        justifyContent: 'center',
    },
    title: {
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(50 / 2),
        lineHeight: scale(70 / 2),
        color: '#F5D8CB',
        marginBottom: scale(20),
    },
    subtitle: {
        color: 'rgba(245,216,203,0.82)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16 / 1.2),
        lineHeight: scale(24 / 1.2),
        marginBottom: scale(44),
        maxWidth: '90%',
    },
    inputWrapper: {
        height: scale(48),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(24),
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(56),
        position: 'relative',
        paddingRight: scale(12),
    },
    leftIconCircle: {
        position: 'absolute',
        left: -1,
        top: -1,
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        marginLeft: scale(66),
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
    primaryButton: {
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonDisabled: {
        opacity: 0.55,
    },
    primaryButtonText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});
