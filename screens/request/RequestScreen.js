import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Platform,
    ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getIcons, scale } from '../../api/api';
import RemoteTintIcon from '../../components/RemoteTintIcon';

export default function RequestScreen({ navigation }) {
    const [icons, setIcons] = useState({});

    useEffect(() => {
        let mounted = true;

        getIcons()
            .then((map) => {
                if (mounted) {
                    setIcons(map || {});
                }
            })
            .catch(() => {});

        return () => {
            mounted = false;
        };
    }, []);

    const requestBackgroundUrl =
        icons['artist-img.png'] ||
        icons['artist-img.jpg'] ||
        icons['artist-img.jpeg'] ||
        icons['artistimg.png'] ||
        icons['artistimg.jpg'] ||
        icons['artistimg.jpeg'] ||
        null;

    const Content = (
        <View style={styles.content}>
            <View>
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

                <Text style={styles.title}>Start your{"\n"}music journey</Text>
            </View>

            <TouchableOpacity
                style={styles.createButton}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('RequestTerms')}
            >
                <Text style={styles.createButtonText}>Create artist profile</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            {requestBackgroundUrl ? (
                <ImageBackground
                    source={{ uri: requestBackgroundUrl }}
                    style={styles.background}
                    resizeMode="cover"
                >
                    {Content}
                </ImageBackground>
            ) : (
                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.background}
                >
                    {Content}
                </LinearGradient>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#190707',
    },
    background: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: scale(20),
        paddingTop: Platform.OS === 'ios' ? scale(60) : scale(40),
        paddingBottom: Platform.OS === 'ios' ? scale(44) : scale(30),
        justifyContent: 'space-between',
    },
    backButton: {
        width: scale(40),
        height: scale(40),
        alignItems: 'flex-start',
        justifyContent: 'center',
        marginBottom: scale(58),
    },
    title: {
        color: '#F5D8CB',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(32),
        lineHeight: scale(72 / 2),
        maxWidth: scale(270),
    },
    createButton: {
        width: '100%',
        height: scale(48),
        borderRadius: scale(32),
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(52 ),
    },
    createButtonText: {
        color: '#300C0A',
        fontFamily: 'Unbounded-Regular',
        fontSize: scale(14),
    },
});
