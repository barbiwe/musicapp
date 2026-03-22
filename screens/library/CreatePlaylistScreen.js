import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Platform,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { createPlaylist, getCachedIcons, getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

export default function CreatePlaylistScreen({ navigation }) {
    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        if (Object.keys(icons || {}).length > 0) return;
        const load = async () => {
            const data = await getIcons();
            setIcons(data || {});
        };
        load();
    }, []);

    const resolveIconName = (nameValue) => {
        if (!nameValue) return '';
        if (icons?.[nameValue]) return nameValue;
        const lower = String(nameValue).toLowerCase();
        const found = Object.keys(icons || {}).find((key) => String(key).toLowerCase() === lower);
        return found || nameValue;
    };

    const onCreate = async () => {
        const safeName = name.trim();
        if (!safeName || creating) return;

        setCreating(true);
        const res = await createPlaylist({ name: safeName, description: '' });
        setCreating(false);

        if (res?.error) {
            Alert.alert('Create playlist', typeof res.error === 'string' ? res.error : 'Failed to create playlist');
            return;
        }

        navigation.goBack();
    };

    const canCreate = name.trim().length > 0 && !creating;

    return (
        <LinearGradient
            colors={['#9A4B39', '#80291E', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        activeOpacity={0.8}
                        onPress={() => navigation.goBack()}
                    >
                        <RemoteTintIcon
                            icons={icons}
                            iconName={resolveIconName('arrow-left.svg')}
                            width={scale(24)}
                            height={scale(24)}
                            color="#F5D8CB"
                            fallback=""
                        />
                    </TouchableOpacity>
                </View>

                <Text style={styles.title}>Name the playlist</Text>

                <View style={styles.formWrap}>
                    <TextInput
                            keyboardAppearance="dark"
                        value={name}
                        onChangeText={setName}
                        placeholder=""
                        placeholderTextColor="rgba(245,216,203,0.65)"
                        style={styles.input}
                        autoCapitalize="sentences"
                        autoCorrect={false}
                        maxLength={70}
                        selectionColor="#F5D8CB"
                    />

                    <TouchableOpacity
                        style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
                        activeOpacity={0.85}
                        disabled={!canCreate}
                        onPress={onCreate}
                    >
                        {creating ? (
                            <ActivityIndicator size="small" color="#300C0A" />
                        ) : (
                            <Text style={styles.createText}>Create</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? scale(56) : scale(42),
    },
    headerRow: {
        paddingHorizontal: scale(16),
    },
    backBtn: {
        width: scale(24),
        height: scale(24),
        justifyContent: 'center',
    },
    title: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(26),
        marginTop: scale(38),
        paddingHorizontal: scale(30),
    },
    formWrap: {
        marginTop: scale(110),
        alignItems: 'center',
    },
    input: {
        width: scale(265),
        alignSelf: 'center',
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(245, 216, 203, 0.85)',
        textAlign: 'center',
        paddingBottom: scale(10),
    },
    createBtn: {
        marginTop: scale(44),
        width: scale(321),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
    },
    createBtnDisabled: {
        opacity: 0.6,
    },
    createText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});
