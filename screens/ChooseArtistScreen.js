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

import { getIcons, scale } from '../api/api';

const { width, height } = Dimensions.get('window');

// Розраховуємо ширину так, щоб 3 колонки поміщалися ідеально
const ITEM_WIDTH = (width - scale(40) - scale(20)) / 3;
const CIRCLE_RADIUS = ITEM_WIDTH / 2; // Для ідеально круглих карток

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

export default function ChooseArtistScreen({ navigation }) {
    const [icons, setIcons] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    // Стейт для зберігання ID вибраних артистів
    const [selectedArtists, setSelectedArtists] = useState([]);

    // Дані для артистів (Останній елемент — це спец. кнопка)
    const ARTISTS_DATA = [
        { id: '1', title: 'ASAP Rocky', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=300&auto=format&fit=crop' },
        { id: '2', title: 'Nikow', image: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=300&auto=format&fit=crop' },
        { id: '3', title: 'The Weeknd', image: 'https://images.unsplash.com/photo-1520333789090-1afc82db536a?q=80&w=300&auto=format&fit=crop' },
        { id: '4', title: 'Lady Gaga', image: 'https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?q=80&w=300&auto=format&fit=crop' },
        { id: '5', title: 'MONATIK', image: 'https://www.chipublib.org/wp-content/uploads/sites/3/2022/09/36079964425_7b3042d5e1_k.jpg' },
        { id: '6', title: 'Eminem', image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=300&auto=format&fit=crop' },
        { id: '7', title: 'Travis Scott', image: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=300&auto=format&fit=crop' },
        { id: '8', title: 'Drake', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop' },
        { id: '9', title: 'Rihanna', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop' },
        { id: '10', title: 'LOBODA', image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=300&auto=format&fit=crop' },
        { id: '11', title: 'INNA', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300&auto=format&fit=crop' },
        { id: 'rec', title: 'Recommended for you', isRecommended: true }
    ];

    // Функція для розбиття масиву на рядки по 3 елементи
    const chunkArray = (arr, size) => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    };

    const ARTISTS_ROWS = chunkArray(ARTISTS_DATA, 3);

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

    const toggleSelection = (id) => {
        if (selectedArtists.includes(id)) {
            setSelectedArtists(selectedArtists.filter(item => item !== id));
        } else {
            setSelectedArtists([...selectedArtists, id]);
        }
    };

    const renderCard = (item) => {
        const isSelected = selectedArtists.includes(item.id);

        if (item.isRecommended) {
            // Кругла картка "Recommended for you"
            return (
                <TouchableOpacity key={item.id} style={styles.cardContainer} activeOpacity={0.8}>
                    <View style={[styles.imageCircle, styles.moreCard]}>
                        <Text style={styles.moreText}>Recommended{"\n"}for you</Text>
                    </View>
                    <Text style={styles.hiddenTitle}> </Text>
                </TouchableOpacity>
            );
        }

        // Звичайна картка артиста
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.8}
                onPress={() => toggleSelection(item.id)}
            >
                <View style={[styles.imageWrapper, isSelected && { zIndex: 10 }]}>

                    {/* 👇 Огорнули картинку і градієнт в новий контейнер, щоб вони ідеально обрізались по колу */}
                    <View style={styles.circleContainer}>
                        <Image source={{ uri: item.image }} style={styles.imageCircle} />

                        {isSelected && (
                            <LinearGradient
                                colors={['transparent', 'rgba(48, 12, 10, 0.8)']}
                                style={styles.selectedOverlay}
                            />
                        )}
                    </View>

                    {/* Галочка залишається ЗОВНІ */}
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

    const isConfirmDisabled = selectedArtists.length === 0;

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

                        {/* Великий заголовок */}
                        <Text style={styles.headerTitle}>Choose more{"\n"}artists that you like</Text>
                    </View>

                    {/* SEARCH BAR */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchBox}>
                            {renderIcon('search.svg', { width: scale(24), height: scale(24) }, 'rgba(245, 216, 203, 0.5)')}
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

                    {/* GRID З АРТИСТАМИ */}
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                        contentContainerStyle={{ paddingTop: scale(15), paddingBottom: scale(120) }}
                    >
                        <View style={styles.gridContainer}>
                            {ARTISTS_ROWS.map((row, rowIndex) => (
                                <View key={rowIndex} style={styles.rowContainer}>
                                    {row.map((item) => renderCard(item))}

                                    {/* Додаємо пусті блоки, якщо в рядку менше 3 елементів (щоб сітка не поїхала) */}
                                    {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => (
                                        <View key={`empty-${i}`} style={styles.cardContainer} />
                                    ))}
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    {/* CONFIRM BUTTON */}
                    <View style={styles.bottomButtonContainer}>
                        <TouchableOpacity
                            style={[styles.confirmButton, isConfirmDisabled && { opacity: 0.5 }]}
                            activeOpacity={0.9}
                            disabled={isConfirmDisabled}
                            onPress={() => console.log('Confirmed:', selectedArtists)}
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
        marginBottom: scale(20),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontSize: scale(32), // Збільшили розмір
        fontFamily: 'Unbounded-SemiBold', // Зробили жирним
        lineHeight: scale(42),
    },

    // --- SEARCH ---
    searchContainer: {
        paddingHorizontal: scale(20),
        marginBottom: scale(10),
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
        alignItems: 'center',
    },
    imageWrapper: {
        position: 'relative',
        marginBottom: scale(8),
        width: ITEM_WIDTH,
        height: ITEM_WIDTH,
        overflow: 'visible',
    },
    circleContainer: {
        width: '100%',
        height: '100%',
        borderRadius: CIRCLE_RADIUS,
        overflow: 'hidden',
    },
    imageCircle: {
        width: ITEM_WIDTH,
        height: ITEM_WIDTH,
        borderRadius: CIRCLE_RADIUS,
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

    // --- OVERLAY ---
    selectedOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80%',
    },

    // --- RECOMMENDED CARD ---
    moreCard: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(245, 216, 203, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(10),
    },
    moreText: {
        color: '#F5D8CB',
        fontSize: scale(10),
        fontFamily: 'Poppins-Regular',
        textAlign: 'center',
    },

    // --- CHECK BADGE ---
    checkBadge: {
        position: 'absolute',
        top: scale(0),
        right: scale(0),
        width: scale(31),
        height: scale(31),
        borderRadius: scale(16),
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