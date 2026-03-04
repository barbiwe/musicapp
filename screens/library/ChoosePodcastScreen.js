import React, { useEffect, useState } from 'react';
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
    TextInput
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { getIcons, scale } from '../../api/api';

const { width, height } = Dimensions.get('window');

// Розраховуємо ширину так, щоб 3 колонки поміщалися ідеально
const ITEM_WIDTH = (width - scale(40) - scale(20)) / 3;

// 1. КЕШ ТА РЕНДЕР SVG
const svgCache = {};

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
    return <SvgXml xml={xml} width={width} height={height} />;
};

export default function ChoosePodcastScreen({ navigation }) {
    const [icons, setIcons] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    // Стейт для зберігання ID вибраних подкастів
    const [selectedPodcasts, setSelectedPodcasts] = useState([]);

    // Згруповані дані: кожен елемент масиву - це ОДИН РЯДОК (масив з 3 карток)
    const PODCASTS_ROWS = [
        [
            { id: '1', title: 'Kult: Podcast', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '2', title: 'Комік-історик', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '3', title: 'Historical motives', isMore: true }
        ],
        [
            { id: '4', title: 'Кроки до успіху...', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '5', title: 'Шева, Леся і Франко', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '6', title: 'Books', isMore: true }
        ],
        [
            { id: '7', title: 'Гуртом та Вщент', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '8', title: 'Bromance', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop'},
            { id: '9', title: 'Culture', isMore: true }
        ],
        [
            { id: '10', title: 'Gap Podcast', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '11', title: 'Науковий BOOM', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '12', title: 'Education', isMore: true }
        ],
        [
            { id: '13', title: 'Голосове на го...', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '14', title: 'Простими словами', isMore: false, image: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?q=80&w=300&auto=format&fit=crop' },
            { id: '15', title: 'Relationships', isMore: true }
        ]
    ];

    useEffect(() => {
        loadIcons();
    }, []);

    const loadIcons = async () => {
        try {
            const loadedIcons = await getIcons();
            setIcons(loadedIcons || {});
        } catch (e) {
            console.log("Error loading icons:", e);
        }
    };

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
            if (tintColor) imageStyle.push({ tintColor: tintColor });

            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }
        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    const togglePodcastSelection = (id) => {
        if (selectedPodcasts.includes(id)) {
            setSelectedPodcasts(selectedPodcasts.filter(item => item !== id));
        } else {
            setSelectedPodcasts([...selectedPodcasts, id]);
        }
    };

    const renderCard = (item) => {
        const isSelected = selectedPodcasts.includes(item.id);

        if (item.isMore) {
            return (
                <TouchableOpacity key={item.id} style={styles.cardContainer} activeOpacity={0.8}>
                    <View style={[styles.imageSquare, styles.moreCard]}>
                        <Text style={styles.moreText}>{item.title}:{"\n"}more</Text>
                    </View>
                    <Text style={styles.hiddenTitle}> </Text>
                </TouchableOpacity>
            );
        }

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() => togglePodcastSelection(item.id)}
            >
                <View style={[styles.imageWrapper, isSelected && { zIndex: 10 }]}>
                    <Image source={{ uri: item.image }} style={styles.imageSquare} />

                    {/* 👇 Градієнт знизу обкладинки, якщо вибрано */}
                    {isSelected && (
                        <LinearGradient
                            colors={['transparent', 'rgba(48, 12, 10, 0.8)']} // Темно-червонуватий/коричневий перелив
                            style={styles.selectedOverlay}
                        />
                    )}

                    {/* Галочка */}
                    {isSelected && (
                        <View style={styles.checkBadge}>
                            {renderIcon('check.svg', { width: scale(16), height: scale(16) }, '#000')}
                        </View>
                    )}
                </View>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            </TouchableOpacity>
        );
    };

    // Перевіряємо, чи є вибрані елементи
    const isConfirmDisabled = selectedPodcasts.length === 0;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>

                    {/* HEADER */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>Choose podcast{"\n"}or show</Text>
                    </View>

                    {/* SEARCH BAR */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBox}>
                            {renderIcon('search.svg', { width: scale(20), height: scale(20) }, 'rgba(245, 216, 203, 0.5)')}
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search"
                                placeholderTextColor="rgba(245, 216, 203, 0.5)"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                selectionColor="#F5D8CB"
                            />
                        </View>
                    </View>

                    {/* GRID З ПОДКАСТАМИ */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        // 👇 Додаємо безпечні відступи для скролу, щоб галочки не обрізалися і кнопки не перекривали
                        contentContainerStyle={{ paddingTop: scale(15), paddingBottom: scale(120) }}
                    >
                        <View style={styles.gridContainer}>
                            {PODCASTS_ROWS.map((row, rowIndex) => (
                                <View key={rowIndex} style={styles.rowContainer}>
                                    {row.map((item) => renderCard(item))}
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* CONFIRM BUTTON */}
                    <View style={styles.bottomButtonContainer}>
                        <TouchableOpacity
                            // 👇 Кнопка стає напівпрозорою, якщо нічого не вибрано
                            style={[styles.confirmButton, isConfirmDisabled && { opacity: 0.8 }]}
                            activeOpacity={1}
                            disabled={isConfirmDisabled} // 👈 Відключаємо клік
                            onPress={() => console.log('Confirmed:', selectedPodcasts)}
                        >
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>

                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    gradient: {
        flex: 1,
        minHeight: height,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(30) : 0,
    },

    // --- HEADER ---
    header: {
        paddingHorizontal: scale(20),
        marginTop: scale(10),
        marginBottom: scale(20),
    },
    backButton: {
        width: scale(30),
        marginBottom: scale(15),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontSize: scale(32),
        fontFamily: 'Unbounded-SemiBold',
        lineHeight: scale(38),
    },

    // --- SEARCH ---
    searchContainer: {
        paddingHorizontal: scale(20),
        marginBottom: scale(10), // Зменшили відступ, бо тепер ScrollView має свій paddingTop
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: scale(30),
        height: scale(40),
        paddingHorizontal: scale(16),
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchInput: {
        flex: 1,
        marginLeft: scale(10),
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Poppins-Regular',
        height: '100%',
    },

    // --- GRID ---
    gridContainer: {
        paddingHorizontal: scale(20),
    },
    rowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: scale(20),
    },

    // --- CARD ---
    cardContainer: {
        width: ITEM_WIDTH,
    },
    imageWrapper: {
        position: 'relative',
        marginBottom: scale(8),
        overflow: 'visible',
    },
    imageSquare: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH,
        borderRadius: scale(24),
        backgroundColor: '#333',
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(11),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },
    hiddenTitle: {
        fontSize: scale(11),
        marginTop: scale(8),
    },

    // --- OVELAY ДЛЯ ВИБРАНИХ ---
    selectedOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
        borderBottomLeftRadius: scale(24),
        borderBottomRightRadius: scale(24),
    },

    // --- MORE CARD ---
    moreCard: {
        backgroundColor: 'rgba(48, 12, 10, 0.4)',
        borderWidth: 1,
        borderColor: 'rgba(245, 216, 203, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(10),
    },
    moreText: {
        color: '#F5D8CB',
        fontSize: scale(11),
        fontFamily: 'Poppins-SemiBold',
        textAlign: 'center',
    },

    // --- CHECK BADGE ---
    checkBadge: {
        position: 'absolute',
        top: scale(-3),      // Трохи змістили вище
        right: scale(-3),    // Трохи змістили правіше
        width: scale(31),
        height: scale(31),
        borderRadius: scale(14),
        backgroundColor: '#F5D8CB',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 120,
        elevation: 5,
    },

    // --- BOTTOM BUTTON ---
    bottomButtonContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? scale(30) : scale(20),
        left: scale(20),
        right: scale(20),
    },
    confirmButton: {
        backgroundColor: '#F5D8CB',
        height: scale(48),
        borderRadius: scale(28),
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#300C0A',
        fontSize: scale(18),
        fontFamily: 'Unbounded-Medium',
    }
});