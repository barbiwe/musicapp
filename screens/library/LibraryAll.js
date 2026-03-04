import React, { useEffect, useState } from 'react';

import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgUri, SvgXml } from 'react-native-svg';
import { getIcons, scale } from '../../api/api';

const { width, height } = Dimensions.get('window');

// Винесемо висоту хедера в змінну, щоб зручно керувати
// Якщо хедер займає десь 100-120 пікселів, ставимо це значення тут
const HEADER_HEIGHT = scale(120);

export default function LibraryAll({ navigation }) {
    const [icons, setIcons] = useState({});

    // Мокові дані
    const DATA = [
        {
            id: 'liked',
            type: 'liked',
            title: 'Liked songs',
            subtitle: '130 songs',
            image: null
        },
        {
            id: '1',
            type: 'podcast',
            title: 'Стендап для своїх',
            subtitle: 'Podcast / Andrew Ozarkiv',
            image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84ca966977380ba83ad20f968e'
        },
        {
            id: '2',
            type: 'playlist',
            title: 'Mix of the day',
            subtitle: 'Playlist / For this user',
            image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84ca966977380ba83ad20f968e'
        },
        {
            id: '3',
            type: 'playlist',
            title: 'Chill Vibes',
            subtitle: 'Playlist / For this user',
            image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84ca966977380ba83ad20f968e'
        },
        {
            id: '4',
            type: 'artist',
            title: 'MONATIK',
            subtitle: 'Artist',
            image: 'https://img.ticketsbox.com/cache/375x500/data/artist/monatik1.jpg'
        },
        {
            id: '5',
            type: 'artist',
            title: 'Eminem',
            subtitle: 'Artist',
            image: 'https://www.chipublib.org/wp-content/uploads/sites/3/2022/09/36079964425_7b3042d5e1_k.jpg'
        }
    ];

    useEffect(() => {
        loadIcons();
    }, []);

    const loadIcons = async () => {
        const loadedIcons = await getIcons();
        setIcons(loadedIcons || {});
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

        // Якщо іконки ще немає (або вантажиться), повертаємо пустий прозорий блок потрібного розміру
        const flatStyle = StyleSheet.flatten(style);
        return <View style={{ width: flatStyle?.width || 24, height: flatStyle?.height || 24 }} />;
    };

    const renderCard = (item) => {
        const isArtist = item.type === 'artist';
        const isLiked = item.type === 'liked';

        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer}
                activeOpacity={0.7}
                onPress={() => {
                    if (isArtist) {
                    } else if (isLiked) {
                    }
                }}
            >
                <View style={styles.imageWrapper}>
                    {isLiked ? (
                        <View style={styles.vinylContainer}>
                            <Image
                                source={{ uri: icons['vinyl.svg'] }}
                                style={styles.vinylImage}
                                resizeMode="cover"
                            />
                            <View style={styles.vinylCenter}>
                                {renderIcon('hurt.svg', { width: scale(32), height: scale(32), tintColor: '#F5D8CB' })}
                            </View>
                        </View>
                    ) : (
                        <Image
                            source={{ uri: item.image }}
                            style={[
                                styles.image,
                                isArtist && styles.roundImage
                            ]}
                            resizeMode="cover"
                        />
                    )}
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.title} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {item.subtitle}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                {/* ЗМІНА 1:
                   Додаємо "прозорий блок" зверху, рівний висоті хедера.
                   Хедер (який накладається абсолютом) буде візуально тут.
                   А ScrollView почнеться нижче цього блоку.
                */}
                <View style={{ height: 220 }} />

                <ScrollView
                    // ЗМІНА 2: ScrollView тепер має flex: 1, щоб зайняти ТІЛЬКИ простір, що залишився
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {DATA.map((item) => renderCard(item))}

                    <View style={{ height: scale(100) }} />
                </ScrollView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        width: width,
        height: height,
    },
    scrollContent: {
        paddingHorizontal: scale(16),
        // ЗМІНА 3: Замість величезного scale(200), даємо маленький відступ,
        // щоб елементи не прилипали впритул до лінії відсікання
        paddingTop: scale(20),
        paddingBottom: scale(100),
    },

    // --- CARD STYLES ---
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)',
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',
        borderTopLeftRadius: scale(50),
        borderBottomLeftRadius: scale(50),

        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },

    imageWrapper: {
        marginRight: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
    },

    image: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(15),
        backgroundColor: '#333',
    },
    roundImage: {
        borderRadius: scale(45),
    },

    // --- VINYL STYLE (Liked Songs) ---
    vinylContainer: {
        width: scale(80),
        height: scale(80),
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    vinylImage: {
        width: '100%',
        height: '100%',
        borderRadius: scale(45),
    },
    vinylCenter: {
        position: 'absolute',
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: '#2A1414',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // --- TEXT STYLES ---
    textContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingRight: scale(10),
    },
    title: {
        color: '#F5D8CB',
        fontSize: scale(16),
        fontFamily: 'Unbounded-Medium',
        marginBottom: scale(4),
    },
    subtitle: {
        color: 'rgba(245, 216, 203, 0.7)',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
});