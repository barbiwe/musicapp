import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native'; // 👈 ДОДАНО Platform
import { useNavigation } from '@react-navigation/native';
import { usePlayerStore } from '../store/usePlayerStore';
import { SvgXml } from 'react-native-svg';

// Імпортуємо getIcons та scale
import { scale, getTrackCoverUrl, getIcons } from '../api/api';

// 1. КЕШ ТА РЕНДЕР SVG (щоб іконки тягнулися з бекенду)
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

export default function MiniPlayer() {
    const navigation = useNavigation();

    // Витягуємо дані зі сховища Zustand
    const { currentTrack, isPlaying, togglePlay } = usePlayerStore();

    // Стейт для іконок
    const [icons, setIcons] = useState({});

    useEffect(() => {
        getIcons().then(res => setIcons(res || {}));
    }, []);

    // Універсальна функція для рендеру іконок
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

    // Якщо трек не вибрано - не показуємо міні-плеєр взагалі
    if (!currentTrack) return null;

    const openFullPlayer = () => {
        navigation.navigate('Player');
    };

    // Правильно дістаємо ім'я артиста
    const artistName = currentTrack.artistName || currentTrack.artist?.name || 'Unknown Artist';
    const coverUrl = getTrackCoverUrl(currentTrack);

    return (
        <TouchableOpacity
            style={styles.container}
            activeOpacity={0.95}
            onPress={openFullPlayer}
        >
            <View style={styles.content}>

                {/* ВІНІЛОВА ПЛАТІВКА З ОБКЛАДИНКОЮ */}
                <View style={styles.vinylContainer}>
                    <View style={styles.vinylBackground}>
                        {/* Зверни увагу: переконайся, що в тебе є іконка вінілу на бекенді, наприклад 'vinyl.svg' */}
                        {renderIcon('vinyl.svg', { width: scale(46), height: scale(46) }, null)}
                    </View>
                    <Image
                        source={{ uri: coverUrl || 'https://via.placeholder.com/150' }}
                        style={styles.artwork}
                    />
                </View>

                {/* ІНФОРМАЦІЯ ПРО ТРЕК */}
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>
                        {currentTrack.title || 'Unknown Song'}
                    </Text>
                    <Text style={styles.artist} numberOfLines={1}>
                        {artistName}
                    </Text>
                </View>

                {/* КНОПКА PLAY/PAUSE */}
                <TouchableOpacity
                    style={styles.playButton}
                    onPress={togglePlay}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                    {isPlaying
                        ? renderIcon('pause.svg', { width: scale(12), height: scale(12) }, '#F5D8CB')
                        : renderIcon('play.svg', { width: scale(12), height: scale(12) }, '#F5D8CB')
                    }
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: scale(100), // Відступ над нижнім меню
        left: scale(20),
        right: scale(20),
        backgroundColor: '#F5D8CB', // Світло-пісочний колір з макету
        borderRadius: scale(40),
        marginBottom: scale(5),
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(8),
        paddingHorizontal: scale(12), // Зменшені відступи по краях, як на скріні
    },

    // --- ВІНІЛ ---
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
        width: scale(20), // Розмір дірки у вінілі
        height: scale(20),
        borderRadius: scale(10),
        backgroundColor: '#59221A',
    },

    // --- ТЕКСТ ---
    info: {
        flex: 1,
        marginLeft: scale(12),
        justifyContent: 'center',
    },
    title: {
        color: '#59221A', // Темно-бордовий/коричневий
        fontSize: scale(15),
        fontFamily: 'Unbounded-Bold', // Дуже жирний шрифт, як на макеті
        textTransform: 'uppercase', // Зробили всі літери великими
        marginBottom: Platform.OS === 'ios' ? 0 : scale(-2), // Коригування для шрифту
    },
    artist: {
        color: '#59221A',
        fontSize: scale(13),
        fontFamily: 'Poppins-Regular',
        marginTop: scale(2),
    },

    // --- КНОПКА PLAY ---
    playButton: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(23), // Ідеальне коло
        backgroundColor: '#59221A', // Темний фон кнопки
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: scale(10),
        marginRight: scale(2),
    },
});