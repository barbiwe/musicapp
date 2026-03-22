import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, Animated, PanResponder, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '../store/usePlayerStore';
import { SvgXml } from 'react-native-svg';
import { scale, getTrackCoverUrl, getIcons, getCachedIcons, getColoredSvgXml, peekColoredSvgXml, warmPlayerAssets, resolveArtistName } from '../api/api';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ColoredSvg = ({ uri, width, height, color }) => {
    const [xml, setXml] = useState(peekColoredSvgXml(uri, color));

    useEffect(() => {
        let isMounted = true;

        if (uri) {
            getColoredSvgXml(uri, color)
                .then((cachedXml) => {
                    if (isMounted) setXml(cachedXml);
                })
                .catch((err) => console.log('SVG Error:', err));
        } else {
            setXml(null);
        }

        return () => {
            isMounted = false;
        };
    }, [uri, color]);

    if (!xml) return <View style={{ width, height }} />;
    return <SvgXml xml={xml} width={width} height={height} />;
};

const buildPodcastDisplayTitle = (track) => {
    const podcastTitle = String(track?.podcastTitle || '').trim();
    const episodeTitle = String(track?.episodeTitle || track?.title || '').trim();

    if (podcastTitle && episodeTitle) {
        if (podcastTitle.toLowerCase() === episodeTitle.toLowerCase()) return podcastTitle;
        return `${podcastTitle}, ${episodeTitle}`;
    }
    return podcastTitle || episodeTitle || 'Podcast';
};

export default function MiniPlayer({ bottomOffset = scale(100) }) {
    const navigation = useNavigation();
    const {
        currentTrack,
        isPlaying,
        togglePlay,
        stopPlayback,
        adModalVisible,
        adData,
        isAdPlaying,
        toggleAdPlayPause,
    } = usePlayerStore();
    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const swipeX = useState(() => new Animated.Value(0))[0];

    useEffect(() => {
        if (Object.keys(icons).length === 0) {
            getIcons().then((res) => setIcons(res || {}));
        }
    }, []);

    useEffect(() => {
        // Фоновий прогрів основних ассетів плеєра без блокування UI.
        warmPlayerAssets().catch(() => {});
    }, []);

    useEffect(() => {
        swipeX.setValue(0);
    }, [currentTrack?.id, currentTrack?._id, adModalVisible, swipeX]);

    const renderIcon = (iconName, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={flatStyle?.width || 24}
                        height={flatStyle?.height || 24}
                        color={tintColor}
                    />
                );
            }

            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor });
            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }

        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    if (!currentTrack) return null;

    const openFullPlayer = () => {
        const coverUrl = adModalVisible ? adData?.imageUrl : getTrackCoverUrl(currentTrack);
        const playerBackgroundUrl =
            icons['playerbg.png'] ||
            icons['bg.png'] ||
            icons['playerBg.png'] ||
            icons['bg.PNG'] ||
            null;

        if (coverUrl) Image.prefetch(coverUrl).catch(() => {});
        if (playerBackgroundUrl) Image.prefetch(playerBackgroundUrl).catch(() => {});
        navigation.navigate('Player');
    };

    const artistName = resolveArtistName(currentTrack, 'Unknown Artist');
    const coverUrl = getTrackCoverUrl(currentTrack);
    const adCoverUrl = adData?.imageUrl || null;
    const isPodcastTrack = Boolean(currentTrack?.isPodcast) && !adModalVisible;
    const displayedTitle = adModalVisible
        ? 'Advertisement'
        : isPodcastTrack
            ? buildPodcastDisplayTitle(currentTrack)
            : (currentTrack.title || 'Unknown Song');
    const displayedSubtitle = adModalVisible
        ? (adData?.title || 'VOX')
        : isPodcastTrack
            ? resolveArtistName(currentTrack, 'Podcast')
            : artistName;

    const panResponder = PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gesture) =>
            !adModalVisible && gesture.dx < -10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderMove: (_evt, gesture) => {
            if (adModalVisible) return;
            swipeX.setValue(Math.min(0, gesture.dx));
        },
        onPanResponderRelease: async (_evt, gesture) => {
            if (adModalVisible) {
                Animated.spring(swipeX, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 90,
                    friction: 10,
                }).start();
                return;
            }
            const shouldDismiss = gesture.dx < -80 || gesture.vx < -0.65;
            if (shouldDismiss) {
                Animated.timing(swipeX, {
                    toValue: -SCREEN_WIDTH,
                    duration: 160,
                    useNativeDriver: true,
                }).start(async () => {
                    await stopPlayback();
                    swipeX.setValue(0);
                });
                return;
            }

            Animated.spring(swipeX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 90,
                friction: 10,
            }).start();
        },
        onPanResponderTerminate: () => {
            Animated.spring(swipeX, {
                toValue: 0,
                useNativeDriver: true,
                tension: 90,
                friction: 10,
            }).start();
        },
    });

    return (
        <Animated.View
            style={[
                styles.container,
                { bottom: bottomOffset, transform: [{ translateX: swipeX }] },
            ]}
            {...panResponder.panHandlers}
        >
            <TouchableOpacity activeOpacity={0.95} onPress={openFullPlayer}>
                <View style={styles.content}>
                    {adModalVisible ? (
                        <Image source={{ uri: adCoverUrl || 'https://via.placeholder.com/150' }} style={styles.adArtwork} />
                    ) : isPodcastTrack ? (
                        <Image source={{ uri: coverUrl || 'https://via.placeholder.com/150' }} style={styles.podcastArtwork} />
                    ) : (
                        <View style={styles.vinylContainer}>
                            <View style={styles.vinylBackground}>
                                {renderIcon('vinyl.svg', { width: scale(46), height: scale(46) }, null)}
                            </View>
                            <Image source={{ uri: coverUrl || 'https://via.placeholder.com/150' }} style={styles.artwork} />
                        </View>
                    )}

                    <View style={styles.info}>
                        <Text style={styles.title} numberOfLines={1}>
                            {displayedTitle}
                        </Text>
                        <Text style={styles.artist} numberOfLines={1}>
                            {displayedSubtitle}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.playButton}
                        onPress={adModalVisible ? toggleAdPlayPause : togglePlay}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        {(adModalVisible ? isAdPlaying : isPlaying)
                            ? renderIcon('pause.svg', { width: scale(12), height: scale(12) }, '#FFFFFF')
                            : renderIcon('play.svg', { width: scale(12), height: scale(12) }, '#FFFFFF')}
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: scale(20),
        right: scale(20),
        backgroundColor: '#F5D8CB',
        borderRadius: scale(40),
        marginBottom: scale(5),
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
        paddingHorizontal: scale(12),
    },
    vinylContainer: {
        width: scale(46),
        height: scale(46),
        justifyContent: 'center',
        alignItems: 'center',
    },
    vinylBackground: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    artwork: {
        width: scale(20),
        height: scale(20),
        borderRadius: scale(10),
        backgroundColor: '#59221A',
    },
    adArtwork: {
        width: scale(46),
        height: scale(46),
        borderRadius: scale(8),
        backgroundColor: '#59221A',
    },
    podcastArtwork: {
        width: scale(46),
        height: scale(46),
        borderRadius: scale(8),
        backgroundColor: '#59221A',
    },
    info: {
        flex: 1,
        marginLeft: scale(12),
        justifyContent: 'center',
    },
    title: {
        color: '#300C0A',
        fontSize: scale(15),
        fontFamily: 'Unbounded-Bold',
        marginBottom: Platform.OS === 'ios' ? 0 : scale(-2),
    },
    artist: {
        color: '#300C0A',
        fontSize: scale(13),
        fontFamily: 'Poppins-Regular',
        marginTop: scale(2),
    },
    playButton: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(23),
        backgroundColor: '#300C0A',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: scale(10),
        marginRight: scale(2),
    },
});
