import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator,
    Dimensions,
    Image // 👈 Додано Image для рендеру іконок
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { useFonts } from 'expo-font';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SvgXml } from 'react-native-svg';

import { getIcons, getCachedIcons, scale, warmSearchData } from './api/api';

/* SCREENS */
import OnboardingScreen from './screens/auth/OnboardingScreen';
import AuthChoiceScreen from './screens/auth/AuthChoiceScreen';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/HomeScreen';
import FavoriteGenresScreen from './screens/auth/FavoriteGenresScreen';
import ConfirmEmailScreen from './screens/auth/ConfirmEmailScreen';
import ForgotPasswordScreen from './screens/auth/ForgotPasswordScreen';
import ResetCodeScreen from './screens/auth/ResetCodeScreen';
import CreateNewPasswordScreen from './screens/auth/CreateNewPasswordScreen';
import SearchScreen from './screens/SearchScreen';
import GenreDetailScreen from './screens/GenreDetailScreen';
import MusicScreen from './screens/MusicScreen';
import AlbumListScreen from './screens/AlbumListScreen';
import AlbumDetailScreen from './screens/AlbumDetailScreen';
import CreateAlbumScreen from './screens/CreateAlbumScreen';
import ProfileScreen from './screens/profile/ProfileScreen';
import PlayerScreen from './screens/PlayerScreen';
import DiscoverScreen from './screens/DiscoverScreen.js';
import ArtistProfileScreen from './screens/ArtistProfileScreen';
import SongInfoScreen from './screens/SongInfoScreen';
import LibraryScreen from './screens/library/LibraryScreen';
import LikedSongsScreen from './screens/library/LikedSongsScreen';
import CreatePlaylistScreen from './screens/library/CreatePlaylistScreen';
import PlaylistDetailScreen from './screens/library/PlaylistDetailScreen';
import ContentAndDisplayScreen from './screens/profile/ContentAndDisplayScreen';
import PrivacyAndCommunityScreen from './screens/profile/PrivacyAndCommunityScreen';
import QualityOfMediaFilesScreen from './screens/profile/QualityOfMediaFilesScreen';
import StatisticsScreen from './screens/profile/StatisticsScreen';
import AboutUsScreen from './screens/profile/AboutUsScreen';
import DownloadsScreen from './screens/profile/DownloadsScreen';
import ListeningHistoryScreen from './screens/profile/ListeningHistoryScreen';
import ProScreen from './screens/ProScreen';
import ChoosePodcastScreen from './screens/library/ChoosePodcastScreen';
import ChooseArtistScreen from './screens/library/ChooseArtistScreen';
import PodcastDetailScreen from './screens/library/PodcastDetailScreen';
import RequestScreen from './screens/request/RequestScreen';
import RequestTermsScreen from './screens/request/RequestTermsScreen';
import RequestDetailsScreen from './screens/request/RequestDetailsScreen';

// MINI PLAYER

import MiniPlayer from './components/MiniPlayer';

const Stack = createNativeStackNavigator();
const SearchStack = createNativeStackNavigator();
const LibraryStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator(); // 👇 Створюємо Таби
const tabSvgCache = {};

/* 🔹 LIQUID GLASS NAVIGATION (Оновлене меню) 🔹 */
function GlassTabBar({ state, descriptors, navigation }) {
    const [icons, setIcons] = useState(() => getCachedIcons() || {});
    const [svgMap, setSvgMap] = useState({});

    useEffect(() => {
        if (Object.keys(icons).length === 0) {
            loadIcons();
        }
    }, []);

    const loadIcons = async () => {
        try {
            const iconsMap = await getIcons();
            setIcons(iconsMap || {});
        } catch (e) {
            console.log("Error loading nav icons:", e);
        }
    };

    const renderTabIcon = (iconName, color) => {
        const iconUrl = icons[iconName];
        if (!iconUrl) return <View style={{ width: 24, height: 24 }} />;

        const isSvg = iconName.toLowerCase().endsWith('.svg') || iconUrl.toLowerCase().endsWith('.svg');
        if (!isSvg) {
            return (
                <Image
                    source={{ uri: iconUrl }}
                    style={{ width: 24, height: 24, tintColor: color }}
                    resizeMode="contain"
                />
            );
        }

        const cacheKey = `${iconUrl}_${color}`;
        const xml = svgMap[cacheKey];

        if (!xml) {
            if (!tabSvgCache[cacheKey]) {
                tabSvgCache[cacheKey] = fetch(iconUrl)
                    .then((res) => res.text())
                    .then((svgContent) => {
                        let cleanXml = svgContent.replace(/fill=['"]none['"]/gi, '###NONE###');
                        cleanXml = cleanXml.replace(/fill=['"][^'"]*['"]/g, `fill="${color}"`);
                        cleanXml = cleanXml.replace(/stroke=['"][^'"]*['"]/g, `stroke="${color}"`);
                        cleanXml = cleanXml.replace(/###NONE###/g, 'fill="none"');
                        tabSvgCache[cacheKey] = cleanXml;
                        setSvgMap((prev) => ({ ...prev, [cacheKey]: cleanXml }));
                    })
                    .catch((err) => console.log('Tab SVG Error:', err));
            } else if (typeof tabSvgCache[cacheKey] === 'string') {
                setSvgMap((prev) => ({ ...prev, [cacheKey]: tabSvgCache[cacheKey] }));
            }
            return <View style={{ width: 24, height: 24 }} />;
        }

        return <SvgXml xml={xml} width={24} height={24} />;
    };

    return (
        <View style={styles.glassWrapper}>
            <View style={styles.glassContainer}>
                <BlurView intensity={40} tint="dark" style={styles.blurContainer}>
                    {state.routes.map((route, index) => {
                        const { options } = descriptors[route.key];
                        const isFocused = state.index === index;

                        const onPress = () => {
                            const event = navigation.emit({
                                type: 'tabPress',
                                target: route.key,
                                canPreventDefault: true,
                            });

                            if (!isFocused && !event.defaultPrevented) {
                                navigation.navigate(route.name);
                            }
                        };

                        // Визначаємо іконку та назву
                        let iconName = 'cuida_home-outline.svg';
                        let label = 'Home';

                        if (route.name === 'SearchTab') {
                            iconName = 'search.svg';
                            label = 'Search';
                        } else if (route.name === 'LibraryTab') {
                            iconName = 'cuida_bookmark-outline.svg';
                            label = 'Library';
                        } else if (route.name === 'AlbumsTab') {
                            iconName = 'libplus.svg';
                            label = 'Create';
                        }

                        const color = isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)';

                        const iconElement = renderTabIcon(iconName, color);

                        return (
                            <TouchableOpacity
                                key={index}
                                onPress={onPress}
                                style={styles.tabButton}
                                activeOpacity={0.7}
                            >
                                {iconElement}
                                <Text style={[styles.tabLabel, { color }]}>{label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </BlurView>
            </View>
        </View>
    );
}

function SearchStackScreen() {
    return (
        <SearchStack.Navigator screenOptions={{ headerShown: false }}>
            <SearchStack.Screen name="SearchMain" component={SearchScreen} />
            <SearchStack.Screen name="GenreDetail" component={GenreDetailScreen} />
        </SearchStack.Navigator>
    );
}

function LibraryStackScreen() {
    return (
        <LibraryStack.Navigator screenOptions={{ headerShown: false }}>
            <LibraryStack.Screen name="LibraryMain" component={LibraryScreen} />
            <LibraryStack.Screen name="LikedSongs" component={LikedSongsScreen} />
            <LibraryStack.Screen name="PlaylistDetail" component={PlaylistDetailScreen} />
        </LibraryStack.Navigator>
    );
}

/* 🔹 MAIN TABS (Група екранів з нерухомим меню) 🔹 */
function MainTabs() {
    return (
        // 👇 1. Обгортаємо все у View з flex: 1 👇
        <View style={{ flex: 1 }}>
            <Tab.Navigator
                tabBar={props => <GlassTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: { position: 'absolute' }, // Прозорість
                }}
            >
                <Tab.Screen name="HomeTab" component={DiscoverScreen} />
                <Tab.Screen name="SearchTab" component={SearchStackScreen} />
                <Tab.Screen name="LibraryTab" component={LibraryStackScreen} />
                <Tab.Screen name="AlbumsTab" component={MusicScreen} />
            </Tab.Navigator>

            {/* 👇 2. ВСТАВЛЯЄМО МІНІ-ПЛЕЄР СЮДИ 👇 */}
            <MiniPlayer />
        </View>
    );
}
export default function App() {
    const [isTokenLoading, setIsTokenLoading] = useState(true);
    const [isFontsGateDone, setIsFontsGateDone] = useState(false);
    const [initialRoute, setInitialRoute] = useState('Onboarding');

    const [fontsLoaded] = useFonts({
        // Poppins
        'Poppins-Thin': require('./assets/fonts/Poppins-Thin.ttf'),
        'Poppins-Light': require('./assets/fonts/Poppins-Light.ttf'),
        'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
        'Poppins-Medium': require('./assets/fonts/Poppins-Medium.ttf'),
        'Poppins-SemiBold': require('./assets/fonts/Poppins-SemiBold.ttf'),
        'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
        'Poppins-ExtraBold': require('./assets/fonts/Poppins-ExtraBold.ttf'),
        'Poppins-Black': require('./assets/fonts/Poppins-Black.ttf'),
        // Unbounded
        'Unbounded-Regular': require('./assets/fonts/Unbounded-Regular.ttf'),
        'Unbounded-Medium': require('./assets/fonts/Unbounded-Medium.ttf'),
        'Unbounded-Bold': require('./assets/fonts/Unbounded-Bold.ttf'),
        'Unbounded-Black': require('./assets/fonts/Unbounded-Black.ttf'),
        'Unbounded-Light': require('./assets/fonts/Unbounded-Light.ttf'),
        'Unbounded-ExtraLight': require('./assets/fonts/Unbounded-ExtraLight.ttf'),
        'Unbounded-SemiBold': require('./assets/fonts/Unbounded-SemiBold.ttf'),
    });

    useEffect(() => {
        let isMounted = true;
        const tokenCheckFallbackId = setTimeout(() => {
            if (isMounted) {
                setIsTokenLoading(false);
            }
        }, 2500);
        const fontsGateTimeoutId = setTimeout(() => {
            if (isMounted) {
                setIsFontsGateDone(true);
            }
        }, 3000);

        const checkToken = async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                if (token && isMounted) {
                    setInitialRoute('MainTabs');
                    warmSearchData().catch(() => {});
                }
            } catch (e) {
                console.log(e);
            } finally {
                if (isMounted) {
                    setIsTokenLoading(false);
                }
                clearTimeout(tokenCheckFallbackId);
            }
        };

        checkToken();

        return () => {
            clearTimeout(tokenCheckFallbackId);
            clearTimeout(fontsGateTimeoutId);
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (fontsLoaded) {
            setIsFontsGateDone(true);
        }
    }, [fontsLoaded]);

    if (isTokenLoading || !isFontsGateDone) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
        <NavigationContainer>
            <StatusBar barStyle="light-content" />

            <Stack.Navigator
                initialRouteName={initialRoute}
                screenOptions={{ headerShown: false }}
            >
                {/* ONBOARDING & AUTH */}
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="FavoriteGenres" component={FavoriteGenresScreen} />
                <Stack.Screen name="ConfirmEmail" component={ConfirmEmailScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
                <Stack.Screen name="ResetCode" component={ResetCodeScreen} />
                <Stack.Screen name="CreateNewPassword" component={CreateNewPasswordScreen} />

                {/* 👇 ГОЛОВНИЙ ЕКРАН З МЕНЮ (Тут живуть Home, Search, Library) */}
                <Stack.Screen name="MainTabs" component={MainTabs} />

                {/* ЕКРАНИ БЕЗ МЕНЮ (Поверх всього) */}
                <Stack.Screen name="Upload" component={MusicScreen} />
                <Stack.Screen name="CreateAlbum" component={CreateAlbumScreen} />
                <Stack.Screen name="AlbumList" component={AlbumListScreen} />
                <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen
                    name="Player"
                    component={PlayerScreen}
                    options={{
                        animation: 'slide_from_bottom',
                        animationDuration: 180,
                        gestureEnabled: true,
                    }}
                />
                <Stack.Screen name="SongInfo" component={SongInfoScreen} />
                <Stack.Screen name="ArtistProfile" component={ArtistProfileScreen} />
                <Stack.Screen name="ContentAndDisplay" component={ContentAndDisplayScreen} />
                <Stack.Screen name="PrivacyAndCommunity" component={PrivacyAndCommunityScreen} />
                <Stack.Screen name="QualityOfMediaFiles" component={QualityOfMediaFilesScreen} />
                <Stack.Screen name="Statistics" component={StatisticsScreen} />
                <Stack.Screen name="AboutUs" component={AboutUsScreen} />
                <Stack.Screen name="Downloads" component={DownloadsScreen} />
                <Stack.Screen name="ListeningHistory" component={ListeningHistoryScreen} />
                <Stack.Screen name="ProScreen" component={ProScreen} />
                <Stack.Screen name="ChoosePodcast" component={ChoosePodcastScreen} />
                <Stack.Screen name="PodcastDetail" component={PodcastDetailScreen} />
                <Stack.Screen name="ChooseArtist" component={ChooseArtistScreen} />
                <Stack.Screen name="CreatePlaylist" component={CreatePlaylistScreen} />
                <Stack.Screen name="Request" component={RequestScreen} />
                <Stack.Screen name="RequestTerms" component={RequestTermsScreen} />
                <Stack.Screen name="RequestDetails" component={RequestDetailsScreen} />

            </Stack.Navigator>
        </NavigationContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000' // Додав чорний фон для лоадера
    },

    // --- АДАПТИВНИЙ LIQUID GLASS ---

    glassWrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'box-none' // Це важливо, щоб клікати крізь пусте місце
    },
    glassContainer: {
        marginBottom: scale(30),
        height: scale(70),
        width: scale(260),
        borderRadius: scale(35),
        overflow: 'hidden',

        // Тіні
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    blurContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: 'rgba(40, 20, 20, 0.4)'
    },
    tabButton: {
        alignItems: 'center',
        justifyContent: 'center',
        top: scale(2)
    },
    tabLabel: {
        fontSize: scale(10),
        fontWeight: '500',
        marginTop: scale(4)
    }
});
