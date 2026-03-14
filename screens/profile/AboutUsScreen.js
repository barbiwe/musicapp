import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

export default function AboutUsScreen({ navigation }) {
    const [icons, setIcons] = useState({});

    useEffect(() => {
        let mounted = true;

        getIcons()
            .then((map) => {
                if (mounted) setIcons(map || {});
            })
            .catch(() => {});

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <LinearGradient
            colors={['#AC654F', '#883426', '#190707']}
            locations={[0, 0.2, 0.59]}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.container}
        >
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <View style={styles.content}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.8}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <RemoteTintIcon
                        icons={icons}
                        iconName="arrow-left.svg"
                        width={scale(24)}
                        height={scale(24)}
                        color="#F5D8CB"
                        fallback="‹"
                    />
                </TouchableOpacity>

                <View style={styles.card}>
                    <View style={styles.logoWrap}>
                        <RemoteTintIcon
                            icons={icons}
                            iconName="VOX2.svg"
                            width={scale(172)}
                            height={scale(130)}
                            color={null}
                            fallback="VOX"
                        />
                    </View>

                    <Text style={styles.title}>YOUR SPACE FOR{`\n`}THE PERFECT{`\n`}SOUND</Text>

                    <Text style={styles.description}>
                        We created VOX so you can enjoy your favorite music without too much visual noise. Only
                        you and your tracks.
                    </Text>

                    <View style={styles.divider} />

                    <View style={styles.socialRow}>
                        <TouchableOpacity
                            style={styles.socialBtn}
                            activeOpacity={0.8}
                            onPress={() => {}}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <RemoteTintIcon
                                icons={icons}
                                iconName="instagram.svg"
                                width={scale(24)}
                                height={scale(24)}
                                color="#FF4D4F"
                                fallback="IG"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.socialBtn, styles.socialBtnMiddle]}
                            activeOpacity={0.8}
                            onPress={() => {}}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <RemoteTintIcon
                                icons={icons}
                                iconName="telegram.svg"
                                width={scale(24)}
                                height={scale(24)}
                                color="#FF4D4F"
                                fallback="TG"
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.socialBtn}
                            activeOpacity={0.8}
                            onPress={() => {}}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <RemoteTintIcon
                                icons={icons}
                                iconName="discord.svg"
                                width={scale(24)}
                                height={scale(24)}
                                color="#FF4D4F"
                                fallback="D"
                            />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(50) : scale(64),
        paddingHorizontal: scale(20),
        paddingBottom: scale(24),
    },
    backButton: {
        width: scale(40),
        height: scale(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginBottom: scale(18),
    },
    card: {
        alignSelf: 'stretch',
        backgroundColor: 'rgba(52, 10, 10, 0.72)',
        borderWidth: 1,
        borderColor: 'rgba(245, 216, 203, 0.12)',
        borderRadius: scale(24),
        paddingHorizontal: scale(26),
        paddingTop: scale(28),
        paddingBottom: scale(24),
    },
    logoWrap: {
        alignItems: 'center',
        marginBottom: scale(24),
    },
    title: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(23),
        lineHeight: scale(32),
        marginBottom: scale(30),
        letterSpacing: 0.2,
    },
    description: {
        color: 'rgba(245, 216, 203, 0.9)',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(17),
        lineHeight: scale(36),
        marginBottom: scale(32),
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(245, 216, 203, 0.7)',
        marginTop: 'auto',
        marginBottom: scale(26),
        marginHorizontal: scale(10),
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    socialBtn: {
        width: scale(37),
        height: scale(37),
        borderRadius: scale(18.5),
        borderWidth: 1,
        borderColor: '#FF4D4F',
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialBtnMiddle: {
        marginHorizontal: scale(28),
    },
});
