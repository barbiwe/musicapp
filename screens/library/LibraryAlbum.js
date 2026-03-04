import React, { useEffect, useState } from 'react';
import { SvgUri } from 'react-native-svg';
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
import { getIcons, scale } from '../../api/api';
import InsetShadow from 'react-native-inset-shadow';
const { width, height } = Dimensions.get('window');
const svgCache = {};

// 👇 Цей компонент завантажує SVG, чистить, фарбує і КЕШУЄ результат
const ColoredSvg = ({ uri, width, height, color }) => {
    const cacheKey = `${uri}_${color || 'original'}`;
    const [xml, setXml] = useState(svgCache[cacheKey] || null);

    useEffect(() => {
        let isMounted = true;

        // 1. Якщо у нас вже є правильна картинка в кеші — беремо її і виходимо
        if (svgCache[cacheKey]) {
            setXml(svgCache[cacheKey]);
            return;
        }

        // 2. Якщо в кеші немає — вантажимо
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

                        // Зберігаємо в кеш
                        svgCache[cacheKey] = cleanXml;
                        setXml(cleanXml);
                    }
                })
                .catch(err => console.log("SVG Error:", err));
        }

        return () => { isMounted = false; };
    }, [cacheKey]); // 🔥 Головне: реагуємо на зміну ключа, а не ігноруємо її

    if (!xml) return <View style={{ width, height }} />;

    return (
        <SvgXml
            xml={xml}
            width={width}
            height={height}
        />
    );
};

export default function LibraryAlbum({ navigation }) {
    // Дані згідно зі скріншотом "Album"
    const DATA = [
        {
            id: '1',
            title: 'Music',
            subtitle: 'Album / Playboi Carti',
            // Білий фон / стиль I AM MUSIC
            image: 'https://images.unsplash.com/photo-1594623930572-300a3011d9ae?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '2',
            title: 'Cowboy Carter',
            subtitle: 'Album / Beyoncé',
            // Темний фон, вершник
            image: 'https://images.unsplash.com/photo-1534067783741-512d692f63e7?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '3',
            title: 'Hurry Up Tomorrow',
            subtitle: 'Album / The Weeknd',
            // Портрет крупним планом
            image: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '4',
            title: 'Don’t Be Dumb',
            subtitle: 'Album / A$AP Rocky',
            // Чорно-білий стиль
            image: 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '5',
            title: 'LG7',
            subtitle: 'Album / Lady Gaga',
            // Щось темне/артове
            image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '6',
            title: 'Lasso',
            subtitle: 'Album / Lana Del Rey',
            // Теплі тони
            image: 'https://images.unsplash.com/photo-1502052531633-9118c7c93836?q=80&w=300&auto=format&fit=crop'
        },
        {
            id: '7',
            title: 'Short n’ Sweet',
            subtitle: 'Album / Sabrina Carpenter',
            // Блакитний фон
            image: 'https://images.unsplash.com/photo-1516575150278-77136aed6920?q=80&w=300&auto=format&fit=crop'
        },
    ];

    const renderCard = (item) => {
        return (
            <TouchableOpacity
                key={item.id}
                style={styles.cardContainer} // Стиль 1 в 1 як у Playlist/Songs
                activeOpacity={0.7}
                onPress={() => {}}
            >
                <View style={styles.imageWrapper}>
                    <Image
                        source={{ uri: item.image }}
                        style={styles.image}
                        resizeMode="cover"
                    />
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
                {/* Відступ під хедер (220, як домовлялися) */}
                <View style={{ height: 220 }} />

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {DATA.map((item) => renderCard(item))}

                    {/* Відступ знизу */}
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
        paddingTop: scale(20),
        paddingBottom: scale(100),
    },

    // --- CARD STYLES (Ідентичні до попередніх) ---
    cardContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(48, 12, 10, 0.2)', // Темний напівпрозорий фон
        borderRadius: scale(20),
        marginBottom: scale(16),
        width: '100%',

        // Зберігаємо специфічне скруглення зліва
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