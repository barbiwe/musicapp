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

import { confirmPasswordReset, getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

export default function CreateNewPasswordScreen({ navigation, route }) {
    const email = route?.params?.email || '';
    const code = route?.params?.code || '';

    const [icons, setIcons] = useState({});
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [securePassword, setSecurePassword] = useState(true);
    const [secureConfirm, setSecureConfirm] = useState(true);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        getIcons().then((map) => {
            if (mounted) setIcons(map || {});
        }).catch(() => {});
        return () => { mounted = false; };
    }, []);

    const isPasswordStrong = password.length >= 8;
    const isMatch = password.length > 0 && password === confirmPassword;
    const canSubmit = isPasswordStrong && isMatch && !loading;

    const onConfirm = async () => {
        if (!canSubmit) return;

        if (!email || !code) {
            Alert.alert('Error', 'Reset data is missing. Start from forgot password again.');
            return;
        }

        setLoading(true);
        const res = await confirmPasswordReset({
            email,
            code,
            newPassword: password,
        });
        setLoading(false);

        if (res?.error) {
            Alert.alert('Error', typeof res.error === 'string' ? res.error : 'Failed to reset password');
            return;
        }

        Alert.alert('Success', 'Password changed successfully', [
            { text: 'OK', onPress: () => navigation.replace('Login') },
        ]);
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

                    <Text style={styles.title}>Create a new{"\n"}password</Text>

                    <View style={styles.inputWrapper}>
                        <View style={styles.leftIconCircle}>
                            <RemoteTintIcon
                                icons={icons}
                                iconName="password.svg"
                                width={scale(20)}
                                height={scale(20)}
                                color="#F5D8CB"
                                fallback="*"
                            />
                        </View>
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="New password"
                            placeholderTextColor="rgba(245,216,203,0.65)"
                            style={styles.input}
                            secureTextEntry={securePassword}
                        />
                        <TouchableOpacity style={styles.rightIconButton} onPress={() => setSecurePassword((v) => !v)}>
                            <RemoteTintIcon
                                icons={icons}
                                iconName="eye.svg"
                                width={scale(18)}
                                height={scale(18)}
                                color="#F5D8CB"
                                fallback="o"
                            />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputWrapper}>
                        <View style={styles.leftIconCircle}>
                            <RemoteTintIcon
                                icons={icons}
                                iconName="password.svg"
                                width={scale(20)}
                                height={scale(20)}
                                color="#F5D8CB"
                                fallback="*"
                            />
                        </View>
                        <TextInput
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            placeholder="Confirm password"
                            placeholderTextColor="rgba(245,216,203,0.65)"
                            style={styles.input}
                            secureTextEntry={secureConfirm}
                        />
                        <TouchableOpacity style={styles.rightIconButton} onPress={() => setSecureConfirm((v) => !v)}>
                            <RemoteTintIcon
                                icons={icons}
                                iconName="eye.svg"
                                width={scale(18)}
                                height={scale(18)}
                                color="#F5D8CB"
                                fallback="o"
                            />
                        </TouchableOpacity>
                    </View>

                    {!isPasswordStrong && password.length > 0 ? (
                        <Text style={styles.hintText}>Password must be at least 8 characters</Text>
                    ) : null}
                    {confirmPassword.length > 0 && !isMatch ? (
                        <Text style={styles.hintText}>Passwords do not match</Text>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
                        onPress={onConfirm}
                        disabled={!canSubmit}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.primaryButtonText}>{loading ? 'Saving...' : 'Confirm'}</Text>
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
        marginBottom: scale(32),
    },
    inputWrapper: {
        height: scale(48),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(24),
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(18),
        position: 'relative',
        paddingRight: scale(6),
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
    rightIconButton: {
        width: scale(38),
        height: scale(38),
        alignItems: 'center',
        justifyContent: 'center',
    },
    hintText: {
        color: 'rgba(245,216,203,0.78)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(12),
        marginTop: scale(-8),
        marginBottom: scale(8),
    },
    primaryButton: {
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(44),
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
