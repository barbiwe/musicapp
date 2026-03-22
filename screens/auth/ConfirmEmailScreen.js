import React, { useEffect, useMemo, useRef, useState } from 'react';
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

import { confirmEmailCode, getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

const CODE_LENGTH = 6;

export default function ConfirmEmailScreen({ navigation, route }) {
    const email = route?.params?.email || '';

    const [icons, setIcons] = useState({});
    const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''));
    const [loading, setLoading] = useState(false);

    const inputsRef = useRef([]);

    useEffect(() => {
        let mounted = true;
        getIcons().then((map) => {
            if (mounted) setIcons(map || {});
        }).catch(() => {});

        return () => { mounted = false; };
    }, []);

    const code = useMemo(() => digits.join(''), [digits]);
    const isCodeComplete = code.length === CODE_LENGTH && !digits.includes('');

    const onChangeDigit = (value, index) => {
        const safe = value.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[index] = safe;
        setDigits(next);

        if (safe && index < CODE_LENGTH - 1) {
            inputsRef.current[index + 1]?.focus();
        }
    };

    const onKeyPress = (event, index) => {
        if (event.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
            inputsRef.current[index - 1]?.focus();
        }
    };

    const onConfirm = async () => {
        if (!isCodeComplete || loading) return;
        if (!email) {
            Alert.alert('Error', 'Email is missing');
            return;
        }

        setLoading(true);
        const res = await confirmEmailCode(email, code);
        setLoading(false);

        if (res?.error) {
            Alert.alert('Error', typeof res.error === 'string' ? res.error : 'Invalid or expired code');
            return;
        }

        navigation.replace('FavoriteGenres');
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

                    <Text style={styles.title}>Code has{"\n"}been sent</Text>
                    <Text style={styles.subtitle}>The confirmation code has been sent to {email || 'your email'}</Text>

                    <View style={styles.codeRow}>
                        {digits.map((digit, index) => (
                            <TextInput
                            keyboardAppearance="dark"
                                key={`${index}`}
                                ref={(el) => { inputsRef.current[index] = el; }}
                                style={styles.codeInput}
                                value={digit}
                                onChangeText={(text) => onChangeDigit(text, index)}
                                onKeyPress={(e) => onKeyPress(e, index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                autoFocus={index === 0}
                                textAlign="center"
                                selectionColor="#F5D8CB"
                            />
                        ))}
                    </View>

                    <Text style={styles.resendText}>Resend will be added from backend later</Text>

                    <TouchableOpacity
                        style={[styles.primaryButton, (!isCodeComplete || loading) && styles.buttonDisabled]}
                        onPress={onConfirm}
                        disabled={!isCodeComplete || loading}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryButtonText}>{loading ? 'Confirming...' : 'Confirm'}</Text>
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
        marginBottom: scale(48),
        maxWidth: '92%',
    },
    codeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: scale(32),
        paddingHorizontal: scale(8),
    },
    codeInput: {
        width: scale(44),
        height: scale(56),
        borderRadius: scale(10),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(22),
    },
    resendText: {
        textAlign: 'center',
        color: 'rgba(245,216,203,0.72)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(14),
        marginBottom: scale(24),
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
