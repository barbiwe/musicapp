import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Dimensions,
    Image,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';
import ShareSheetModal from '../../components/ShareSheetModal';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
    getIcons,
    getCachedIcons,
    getColoredSvgXml,
    peekColoredSvgXml,
    isPodcastLiked,
    likePodcast,
    unlikePodcast,
    scale,
} from '../../api/api';

const { height } = Dimensions.get('window');

const ColoredSvg = ({ uri, width, height, color }) => {
    const [xml, setXml] = useState(peekColoredSvgXml(uri, color));

    useEffect(() => {
        let isMounted = true;

        if (uri) {
            getColoredSvgXml(uri, color)
                .then((cachedXml) => {
                    if (isMounted) setXml(cachedXml);
                })
                .catch(() => {});
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

export default function PodcastEpisodeDescriptionScreen({ route, navigation }) {
    const {
        currentTrack,
        isPlaying,
        togglePlay,
    } = usePlayerStore();

    const title = String(route?.params?.title || 'Episode').trim();
    const podcastTitle = String(route?.params?.podcastTitle || title || 'Podcast').trim();
    const authorName = String(route?.params?.authorName || 'Unknown').trim();
    const description = String(route?.params?.description || 'No episode description yet.').trim();
    const coverUrl = String(route?.params?.coverUrl || '').trim();
    const podcastId = String(route?.params?.podcastId || '').trim();
    const shareUrl = String(route?.params?.shareUrl || '').trim();

    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const [shareVisible, setShareVisible] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const iconsMap = await getIcons();
                if (mounted) setIcons(iconsMap || {});
            } catch (_) {}
        })();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        if (!podcastId) return undefined;

        (async () => {
            try {
                const liked = await isPodcastLiked(podcastId);
                if (mounted) setIsLiked(Boolean(liked));
            } catch (_) {}
        })();

        return () => {
            mounted = false;
        };
    }, [podcastId]);

    const findIconUrl = (iconName) => {
        if (!iconName) return null;

        const lowerMap = {};
        Object.keys(icons || {}).forEach((k) => {
            lowerMap[k.toLowerCase()] = icons[k];
        });

        const normalized = String(iconName).toLowerCase();
        const candidates = [
            iconName,
            normalized,
            normalized.endsWith('.png') ? normalized.replace(/\.png$/i, '.svg') : normalized,
            normalized.endsWith('.svg') ? normalized : `${normalized}.svg`,
            normalized.endsWith('.svg') ? normalized.replace(/\.svg$/i, '.png') : normalized,
            normalized.endsWith('.png') ? normalized : `${normalized}.png`,
        ];

        for (const candidate of candidates) {
            if (icons[candidate]) return icons[candidate];
            if (lowerMap[candidate]) return lowerMap[candidate];
        }

        return null;
    };

    const renderIcon = (iconName, style, tintColor = '#F5D8CB') => {
        const iconUrl = findIconUrl(iconName);
        const flat = StyleSheet.flatten(style) || {};
        const w = flat?.width || 24;
        const h = flat?.height || 24;

        if (!iconUrl) return <View style={{ width: w, height: h }} />;

        const isSvg = String(iconName).toLowerCase().endsWith('.svg') || String(iconUrl).toLowerCase().endsWith('.svg');
        if (isSvg) {
            return <ColoredSvg uri={iconUrl} width={w} height={h} color={tintColor} />;
        }

        return (
            <Image
                source={{ uri: iconUrl }}
                style={[style, tintColor ? { tintColor } : null]}
                resizeMode="contain"
            />
        );
    };

    const isCurrentPodcastTrack =
        Boolean(currentTrack?.isPodcast) &&
        String(currentTrack?.podcastId || '') === String(podcastId || '');

    const handlePlayPause = async () => {
        if (!currentTrack?.isPodcast) return;
        await togglePlay();
    };

    const handleLikeToggle = async () => {
        if (!podcastId) return;

        const prev = isLiked;
        const next = !prev;
        setIsLiked(next);

        const result = prev ? await unlikePodcast(podcastId) : await likePodcast(podcastId);
        if (result?.error) {
            setIsLiked(prev);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
                bounces={false}
                overScrollMode="never"
            >
                <LinearGradient
                    colors={['#9A4B39', '#80291E', '#190707']}
                    locations={[0, 0.2, 0.59]}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.gradient, { paddingBottom: scale(130) }]}
                >
                    <View style={styles.navBar}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            style={styles.navBtn}
                            hitSlop={{ top: scale(20), bottom: scale(20), left: scale(20), right: scale(20) }}
                        >
                            {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        <View style={{ flex: 1 }} />

                        <TouchableOpacity
                            style={styles.navBtn}
                            hitSlop={{ top: scale(20), bottom: scale(20), left: scale(20), right: scale(20) }}
                            onPress={() => {}}
                        >
                            {renderIcon('more.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerContent}>
                        <Text style={styles.topAuthorName}>{authorName}</Text>

                        {coverUrl ? (
                            <Image source={{ uri: coverUrl }} style={styles.coverImage} resizeMode="cover" />
                        ) : (
                            <View style={[styles.coverImage, styles.placeholderCover]} />
                        )}

                        <Text style={styles.podcastTitle}>{podcastTitle}</Text>

                        <View style={styles.controlsRow}>
                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={() => {}}
                            >
                                {renderIcon('download.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={handleLikeToggle}
                            >
                                {isLiked
                                    ? renderIcon('added.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')
                                    : renderIcon('add.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.circleBtn, styles.playBtn]}
                                onPress={handlePlayPause}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                            >
                                {renderIcon(
                                    isCurrentPodcastTrack && isPlaying ? 'pause.svg' : 'play.svg',
                                    { width: scale(21), height: scale(21) },
                                    '#300C0A'
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={() => setShareVisible(true)}
                            >
                                {renderIcon('share.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.circleBtn}
                                hitSlop={{ top: scale(10), bottom: scale(10), left: scale(10), right: scale(10) }}
                                onPress={() => {}}
                            >
                                {renderIcon('night.svg', { width: scale(20), height: scale(20) }, '#F5D8CB')}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.descriptionWrap}>
                        <Text style={styles.sectionTitle}>Episode description</Text>
                        <Text style={styles.descriptionText}>
                            {description || 'No episode description yet.'}
                        </Text>
                    </View>
                </LinearGradient>
            </ScrollView>

            <ShareSheetModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                renderIcon={(iconName, style, tintColor) => renderIcon(iconName, style, tintColor)}
                shareTitle={`${podcastTitle} — ${authorName}`}
                shareUrl={shareUrl || null}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#300C0A',
    },
    gradient: {
        minHeight: height,
    },
    navBar: {
        marginTop: Platform.OS === 'ios' ? scale(50) : (StatusBar.currentHeight || 0) + scale(10),
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        height: scale(50),
        zIndex: 10,
    },
    navBtn: {
        padding: scale(5),
    },
    headerContent: {
        alignItems: 'center',
        paddingHorizontal: scale(16),
        marginBottom: scale(22),
    },
    topAuthorName: {
        color: '#F5D8CB',
        fontSize: scale(18),
        fontFamily: 'Unbounded-Regular',
        marginTop: scale(8),
        marginBottom: scale(18),
        textAlign: 'center',
    },
    coverImage: {
        width: scale(198),
        height: scale(198),
        borderRadius: scale(24),
        marginBottom: scale(20),
    },
    placeholderCover: {
        backgroundColor: '#2A1414',
    },
    podcastTitle: {
        color: '#F5D8CB',
        fontSize: scale(20),
        fontFamily: 'Unbounded-SemiBold',
        textAlign: 'center',
        marginBottom: scale(18),
    },
    controlsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(14),
    },
    circleBtn: {
        width: scale(56),
        height: scale(56),
        borderRadius: scale(28),
        borderWidth: 1.4,
        borderColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
    },
    playBtn: {
        width: scale(66),
        height: scale(66),
        borderRadius: scale(33),
        borderWidth: 0,
        backgroundColor: '#F5D8CB',
    },
    descriptionWrap: {
        paddingHorizontal: scale(16),
        marginTop: scale(6),
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontSize: scale(42 / 2),
        fontFamily: 'Unbounded-Regular',
        marginBottom: scale(22),
    },
    descriptionText: {
        color: '#F5D8CB',
        opacity: 0.95,
        fontSize: scale(34 / 2),
        lineHeight: scale(56 / 2),
        fontFamily: 'Poppins-Regular',
    },
});
