import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    SafeAreaView,
    Platform,
    Dimensions
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SvgXml } from 'react-native-svg';

import {
    getUserAvatarUrl,
    changeAvatar,
    logoutUser,
    getIcons,
    scale // Обов'язково імпортуємо scale
} from '../../api/api';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 0. ГЛОБАЛЬНИЙ КЕШ SVG
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

export default function ProfileScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [username, setUsername] = useState('User');
    const [avatarUri, setAvatarUri] = useState(null);
    const [icons, setIcons] = useState({});

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [])
    );

    const loadProfileData = async () => {
        setLoading(true);
        try {
            // Завантажуємо іконки з бекенду
            const iconsData = await getIcons();
            setIcons(iconsData || {});

            const storedName = await AsyncStorage.getItem('username');
            if (storedName) setUsername(storedName);

            const storedId = await AsyncStorage.getItem('userId');
            if (storedId) {
                setAvatarUri(`${getUserAvatarUrl(storedId)}?t=${new Date().getTime()}`);
            }
        } catch (e) {
            console.error("Profile Load Error:", e);
        } finally {
            setLoading(false);
        }
    };

    const pickAvatar = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission denied', 'Need access to gallery');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            setAvatarUri(asset.uri); // Оптимістичне оновлення UI

            const res = await changeAvatar(asset.uri);
            if (res.error) {
                Alert.alert('Error', 'Avatar upload failed.');
            } else {
                loadProfileData();
            }
        }
    };

    const handleLogout = async () => {
        await logoutUser();
        navigation.reset({
            index: 0,
            routes: [{ name: 'AuthChoice' }],
        });
    };

    // Універсальна функція рендеру іконок (як у плеєрі)
    const renderIcon = useCallback((iconName, fallbackText, style, tintColor = '#000000') => {
        const iconUrl = icons[iconName];
        if (iconUrl) {
            const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');
            if (isSvg) {
                const flatStyle = StyleSheet.flatten(style);
                const width = flatStyle?.width || 24;
                const height = flatStyle?.height || 24;
                return <ColoredSvg key={iconName} uri={iconUrl} width={width} height={height} color={tintColor} />;
            }
            const imageStyle = [style];
            if (tintColor) imageStyle.push({ tintColor: tintColor });
            return <Image source={{ uri: iconUrl }} style={imageStyle} resizeMode="contain" />;
        }

        // Фолбек, якщо іконки ще немає на бекенді
        return (
            <View style={[style, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: tintColor || '#F5D8CB', fontSize: style.height ? style.height * 0.6 : 14 }}>
                    {fallbackText}
                </Text>
            </View>
        );
    }, [icons]);

    // Дані для меню з назвами іконок, які мають бути на бекенді
    const menuItems = [
        { id: 1, title: 'Content and display', icon: 'src.svg' },
        { id: 2, title: 'Privacy and community', icon: 'guard.svg' },
        { id: 3, title: 'Quality of media files', icon: 'list.svg' },
        { id: 4, title: 'Statistics', icon: 'chart.svg' },
        { id: 5, title: 'Downloads', icon: 'download.svg' },
        { id: 6, title: 'Listening history', icon: 'chart.svg' },
        { id: 7, title: 'About us', icon: 'info.svg' },
    ];

    if (loading && !username) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#F5D8CB" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

            <LinearGradient
                colors={['#AC654F', '#883426', '#190707',]}
                locations={[0, 0.2, 0.59,]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        <View style={styles.topSection}>
                            {/* ХЕДЕР (Кнопка назад) */}
                            <View style={styles.header}>
                                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                    {renderIcon('arrow-left.svg', '<', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                                </TouchableOpacity>
                            </View>

                            {/* БЛОК ПРОФІЛЮ */}
                            <View style={styles.profileRow}>
                                {/* Аватарка */}
                                <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarContainer}>
                                    {avatarUri ? (
                                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                                    ) : (
                                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                            <Text style={styles.avatarPlaceholderText}>
                                                {username ? username.charAt(0).toUpperCase() : 'U'}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Інформація: Ім'я та бейдж */}
                                <View style={styles.profileInfo}>
                                    <Text style={styles.username} numberOfLines={1}>{username}</Text>
                                    <TouchableOpacity
                                        style={styles.singerBadge}
                                        activeOpacity={0.7}
                                        onPress={() => navigation.navigate('Request')}
                                    >
                                        <Text style={styles.singerBadgeText}>Become a singer</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Кнопка редагування */}
                                <TouchableOpacity onPress={pickAvatar} style={styles.editButton} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                    {renderIcon('edit.svg', '✎', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                                </TouchableOpacity>
                            </View>

                            {/* Розділювач */}
                            <View style={styles.separator} />

                            {/* МЕНЮ */}
                            <View style={styles.menuContainer}>
                                {menuItems.map((item) => (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={styles.menuItem}
                                        activeOpacity={0.7}
                                        // 👇 ОНОВЛЕНА ЛОГІКА ПЕРЕХОДІВ
                                        onPress={() => {
                                            switch (item.title) {
                                                case 'Content and display':
                                                    navigation.navigate('ContentAndDisplay');
                                                    break;
                                                case 'Privacy and community':
                                                    navigation.navigate('PrivacyAndCommunity');
                                                    break;
                                                case 'Quality of media files':
                                                    navigation.navigate('QualityOfMediaFiles');
                                                    break;
                                                case 'Statistics':
                                                    navigation.navigate('Statistics');
                                                    break;
                                                case 'About us':
                                                    navigation.navigate('AboutUs');
                                                    break;
                                                case 'Downloads':
                                                    navigation.navigate('Downloads');
                                                    break;
                                                case 'Listening history':
                                                    navigation.navigate('ListeningHistory');
                                                    break;
                                                default:
                                                    console.log('No route for', item.title);
                                            }
                                        }}
                                    >
                                        <View style={styles.menuItemLeft}>
                                            <View style={styles.menuIconPlaceholder}>
                                                {/* Іконка з бекенду */}
                                                {renderIcon(item.icon, '☐', { width: scale(17), height: scale(17) }, '#F5D8CB')}
                                            </View>
                                            <Text style={styles.menuItemText}>{item.title}</Text>
                                        </View>
                                        {/* Стрілочка вправо з бекенду */}
                                        {renderIcon('arrow-right.svg', '>', { width: scale(20), height: scale(20) }, '#F5D8CB')}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* КНОПКА ВИХОДУ */}
                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
                            {renderIcon('log out.svg', '⍈', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                            <Text style={styles.logoutText}>Log out</Text>
                        </TouchableOpacity>

                    </ScrollView>
                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#160607',
    },
    gradient: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(40) : 0,
    },
    scrollContent: {
        flexGrow: 1, // Розтягує контент, притискаючи Logout до низу
        paddingHorizontal: scale(24),
        paddingBottom: scale(40),
        justifyContent: 'space-between',
    },
    topSection: {
        width: '100%',
    },

    // Header
    header: {
        marginTop: scale(10),
        marginBottom: scale(20),
    },
    backButton: {
        alignSelf: 'flex-start',
        padding: scale(5),
        marginLeft: scale(-5),
    },

    // Profile Row
    profileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Розподіляє аватар, текст і кнопку по ширині
        marginBottom: scale(30),
    },
    avatarContainer: {
        marginRight: scale(16),
    },
    avatar: {
        width: scale(92),
        height: scale(92),
        borderRadius: scale(48),
        backgroundColor: '#F5D8CB',
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarPlaceholderText: {
        fontSize: scale(36),
        fontFamily: 'Unbounded-SemiBold',
        color: '#300C0A',
    },
    profileInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    username: {
        fontSize: scale(24),
        fontFamily: 'Unbounded-Medium',
        color: '#F5D8CB',
        marginBottom: scale(8),
    },
    singerBadge: {
        borderWidth: scale(1),
        borderColor: '#F5D8CB',
        borderRadius: scale(20),
        paddingVertical: scale(6),
        paddingHorizontal: scale(14),
        alignSelf: 'flex-start',
    },
    singerBadgeText: {
        color: '#F5D8CB',
        fontSize: scale(14),
        fontFamily: 'Poppins-Regular',
    },
    editButton: {
        padding: scale(10),
        marginLeft: scale(10),
    },

    // Divider
    separator: {
        height: 1,
        backgroundColor: 'rgba(245, 216, 203, 0.4)',
        marginBottom: scale(20),
        width: '100%',
    },

    // Menu Item
    menuContainer: {
        width: '100%',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: scale(10),
    },
    menuItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    menuIconPlaceholder: {
        width: scale(24),
        height: scale(24),
        marginRight: scale(16),
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuItemText: {
        fontSize: scale(16),
        fontFamily: 'Poppins-Medium',
        color: '#F5D8CB',
    },

    // Logout Button
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: scale(40),
        alignSelf: 'flex-start',
        paddingVertical: scale(10),
    },
    logoutText: {
        fontSize: scale(16),
        fontFamily: 'Unbounded-Regular',
        color: '#F5D8CB',
        marginLeft: scale(12),
    },
});
