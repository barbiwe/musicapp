import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Image,
    Dimensions,
    Platform,
    Modal,
    TouchableWithoutFeedback,
    Animated,
    Easing
} from 'react-native';
import { usePlayerStore } from '../../store/usePlayerStore';
import { SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import LibraryAll from './LibraryAll';
import LibraryPodcast from './LibraryPodcast';
import LibraryPlaylist from './LibraryPlaylist';
import LibrarySongs from './LibrarySongs';
import LibraryAlbum from './LibraryAlbum';
import LibraryArtist from './LibraryArtist';

import { getCachedIcons, getIcons, scale } from '../../api/api';

const { width, height } = Dimensions.get('window');

const svgCache = {};

// 👇 Компонент для SVG
const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }

        if (uri) {
            fetch(uri)
                .then(response => response.text())
                .then(svgContent => {
                    if (isMounted) {
                        let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');

                        if (color) {
                            cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
                            cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
                        }

                        cleanXml = cleanXml.replace(/###NONE###/g, 'fill="none"');

                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }

        return () => { isMounted = false; };
    }, [cacheKey]);

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

export default function LibraryScreen({ navigation }) {
    const { setTrack } = usePlayerStore();
    const [activeTab, setActiveTab] = useState('All');
    const [icons, setIcons] = useState(() => getCachedIcons() || {});

    const [modalVisible, setModalVisible] = useState(false);

    // Анімація для виїзду шторки
    const slideAnim = useRef(new Animated.Value(height)).current;

    const tabs = ['All', 'Playlist','Songs','Album',  'Artist', 'Podcast'];

    useEffect(() => {
        if (Object.keys(icons || {}).length > 0) return;
        loadIcons();
    }, []);

    const loadIcons = async () => {
        const loadedIcons = await getIcons();
        setIcons(loadedIcons || {});
    };

    // Логіка відкриття
    const openModal = () => {
        setModalVisible(true);
        slideAnim.setValue(height);
        Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    };

    // Логіка закриття
    const closeModal = () => {
        slideAnim.stopAnimation();
        Animated.timing(slideAnim, {
            toValue: height,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => {
            setModalVisible(false);
            slideAnim.setValue(height);
        });
    };

    const renderIcon = (iconName, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];

        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');

            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;

                return (
                    <ColoredSvg
                        uri={iconUrl}
                        width={width}
                        height={height}
                        color={tintColor}
                    />
                );
            }

            const imageStyle = [style];
            if (tintColor) {
                imageStyle.push({ tintColor: tintColor });
            }

            return (
                <Image
                    source={{ uri: iconUrl }}
                    style={imageStyle}
                    resizeMode="contain"
                />
            );
        }

        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'Podcast': return <LibraryPodcast navigation={navigation} />;
            case 'All': return <LibraryAll navigation={navigation} setTrack={setTrack} />;
            case 'Playlist': return <LibraryPlaylist navigation={navigation} />;
            case 'Songs': return <LibrarySongs navigation={navigation} setTrack={setTrack} />;
            case 'Album': return <LibraryAlbum navigation={navigation} />;
            case 'Artist': return <LibraryArtist navigation={navigation} />;
            default: return <LibraryAll navigation={navigation} setTrack={setTrack} />;
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* ВЕРХНЯ ШАПКА */}
            <View style={styles.absoluteHeader}>
                <SafeAreaView>
                    <View style={styles.topBar}>
                        <Text style={styles.headerTitle}>Library</Text>

                        <View style={styles.iconsContainer}>
                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={() => navigation.navigate('LibrarySearch')}
                            >
                                {renderIcon('search.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.iconButton}
                                onPress={openModal}
                            >
                                {renderIcon('libplus.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.tabsContainer}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.scrollContent}
                        >
                            {tabs.map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    style={[
                                        styles.tabButton,
                                        activeTab === tab ? styles.activeTabButton : styles.inactiveTabButton
                                    ]}
                                    onPress={() => setActiveTab(tab)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[
                                        styles.tabText,
                                        activeTab === tab ? styles.activeTabText : styles.inactiveTabText
                                    ]}>
                                        {tab}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </View>

            {/* КОНТЕНТ */}
            <View style={styles.contentContainer}>
                {renderContent()}
            </View>

            {/* МОДАЛКА */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <TouchableWithoutFeedback onPress={closeModal}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <Animated.View
                                style={[
                                    styles.modalSheetWrapper,
                                    { transform: [{ translateY: slideAnim }] }
                                ]}
                            >
                                <LinearGradient
                                    colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                                    locations={[0, 0.2, 1]}
                                    start={{ x: 0.5, y: 0 }}
                                    end={{ x: 0.5, y: 1 }}
                                    style={styles.modalBorderGradient}
                                >
                                    <BlurView intensity={40} tint="dark" style={styles.modalGlassContainer}>
                                        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30, 10, 8, 0.85)' }]} />

                                        <View style={styles.modalInnerContent}>
                                            <View style={styles.modalIndicator} />
                                            <Text style={styles.modalTitle}>Add</Text>
                                            {/* Item 1: Add artist */}
                                            <TouchableOpacity
                                                style={styles.modalItem}
                                                onPress={() => {
                                                    closeModal();
                                                    setTimeout(() => {
                                                        navigation.navigate('ChooseArtist');
                                                    }, 300);
                                                }}
                                            >
                                                <View style={styles.circlePlus}>
                                                    <View style={styles.plusHorizontal} />
                                                    <View style={styles.plusVertical} />
                                                </View>
                                                <Text style={styles.modalItemText}>Add artist</Text>
                                            </TouchableOpacity>

                                            {/* Item 2: Add playlist */}
                                            <TouchableOpacity
                                                style={styles.modalItem}
                                                onPress={() => {
                                                    closeModal();
                                                    setTimeout(() => {
                                                        navigation.navigate('CreatePlaylist');
                                                    }, 300);
                                                }}
                                            >
                                                <View style={styles.circlePlus}>
                                                    <View style={styles.plusHorizontal} />
                                                    <View style={styles.plusVertical} />
                                                </View>
                                                <Text style={styles.modalItemText}>Add playlist</Text>
                                            </TouchableOpacity>

                                            {/* Item 3: Add podcast */}
                                            <TouchableOpacity
                                                style={styles.modalItem}
                                                onPress={() => {
                                                    closeModal(); // Спочатку закриваємо модалку
                                                    // Затримка, щоб модалка встигла закритися перед переходом
                                                    setTimeout(() => {
                                                        navigation.navigate('ChoosePodcast');
                                                    }, 300);
                                                }}
                                            >
                                                <View style={styles.circlePlus}>
                                                    <View style={styles.plusHorizontal} />
                                                    <View style={styles.plusVertical} />
                                                </View>
                                                <Text style={styles.modalItemText}>Add podcast or show</Text>
                                            </TouchableOpacity>

                                        </View>
                                    </BlurView>
                                </LinearGradient>
                            </Animated.View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    absoluteHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: Platform.OS === 'android' ? scale(40) : 0,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(16),
        marginTop: scale(17),
        marginBottom: scale(20),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontSize: scale(33),
        fontFamily: 'Unbounded-Regular',
    },
    iconsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconButton: {
        marginLeft: scale(20),
        padding: scale(4),
    },
    tabsContainer: {
        height: scale(40),
    },
    scrollContent: {
        paddingHorizontal: scale(20),
        alignItems: 'center',
    },
    tabButton: {
        paddingVertical: scale(8),
        paddingHorizontal: scale(24),
        borderRadius: scale(30),
        borderWidth: 1,
        marginRight: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeTabButton: {
        backgroundColor: '#AC654F',
        borderColor: '#AC654F',
    },
    inactiveTabButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    tabText: {
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    activeTabText: {
        color: '#fff',
        fontFamily: 'Poppins-Medium',
    },
    inactiveTabText: {
        color: '#E0E0E0',
    },
    contentContainer: {
        flex: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-end',
    },
    modalSheetWrapper: {
        width: '100%',
        height: scale(320), // 👈 Збільшили висоту з 247 до 320, щоб вліз 3-й пункт
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    modalBorderGradient: {
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        paddingTop: 1.5,
        paddingHorizontal: 1.5,
        paddingBottom: 0,
    },
    modalGlassContainer: {
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        overflow: 'hidden',
        width: '100%',
        paddingBottom: scale(50),
    },
    modalInnerContent: {
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        alignItems: 'center',
    },
    modalIndicator: {
        width: scale(40),
        height: scale(4),
        backgroundColor: 'rgba(245, 216, 203, 0.2)',
        borderRadius: scale(2),
        marginBottom: scale(24),
    },
    modalTitle: {
        color: '#F5D8CB',
        fontSize: scale(24),
        fontFamily: 'Unbounded-Bold',
        marginBottom: scale(16),
    },
    modalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(20),
        width: '100%',
        paddingHorizontal: scale(10),
    },
    circlePlus: {
        width: scale(40),
        height: scale(40),
        borderRadius: scale(22),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(20),
        backgroundColor: 'rgba(245, 216, 203, 0.44)',
        position: 'relative',
    },
    plusHorizontal: {
        position: 'absolute',
        width: scale(14),
        height: scale(1.5),
        backgroundColor: '#F5D8CB',
        borderRadius: 1,
    },
    plusVertical: {
        position: 'absolute',
        width: scale(1.5),
        height: scale(14),
        backgroundColor: '#F5D8CB',
        borderRadius: 1,
    },
    modalItemText: {
        color: '#F5D8CB',
        fontSize: scale(15),
        fontFamily: 'Poppins-Regular',
        letterSpacing: 0.3,
    }
});
