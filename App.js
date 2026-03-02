import React, { useEffect, useState, useCallback } from 'react';
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
import { NavigationContainer, useNavigationState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';


SplashScreen.preventAutoHideAsync();

import { getIcons, scale, warmPlayerAssets } from './api/api';

/* SCREENS */
import OnboardingScreen from './screens/OnboardingScreen';
import AuthChoiceScreen from './screens/AuthChoiceScreen';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/HomeScreen';
import TrackListScreen from './screens/TrackListScreen';
import MusicScreen from './screens/MusicScreen';
import AlbumListScreen from './screens/AlbumListScreen';
import AlbumDetailScreen from './screens/AlbumDetailScreen';
import CreateAlbumScreen from './screens/CreateAlbumScreen';
import ProfileScreen from './screens/ProfileScreen';
import PlayerScreen from './screens/PlayerScreen';
import DiscoverScreen from './screens/DiscoverScreen.js';
import ArtistProfileScreen from './screens/ArtistProfileScreen';
import SongInfoScreen from './screens/SongInfoScreen';
import LibraryScreen from './screens/LibraryScreen';
import ContentAndDisplayScreen from './screens/ContentAndDisplayScreen';
import PrivacyAndCommunityScreen from './screens/PrivacyAndCommunityScreen';
import QualityOfMediaFilesScreen from './screens/QualityOfMediaFilesScreen';
import StatisticsScreen from './screens/StatisticsScreen';
import AboutUsScreen from './screens/AboutUsScreen';
import ProScreen from './screens/ProScreen';
import ChoosePodcastScreen from './screens/ChoosePodcastScreen';
import ChooseArtistScreen from './screens/ChooseArtistScreen';

// MINI PLAYER

import MiniPlayer from './components/MiniPlayer';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator(); // 👇 Створюємо Таби

/* 🔹 LIQUID GLASS NAVIGATION (Оновлене меню) 🔹 */
function GlassTabBar({ state, descriptors, navigation }) {
    const [icons, setIcons] = useState({});

    useEffect(() => {
        loadIcons();
    }, []);

    const loadIcons = async () => {
        try {
            const iconsMap = await getIcons();
            setIcons(iconsMap || {});
        } catch (e) {
            console.log("Error loading nav icons:", e);
        }
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
                        let iconName = 'cuida_home-outline.png';
                        let label = 'Home';

                        if (route.name === 'SearchTab') {
                            iconName = 'cuida_search-outline.png';
                            label = 'Search';
                        } else if (route.name === 'LibraryTab') {
                            iconName = 'cuida_bookmark-outline.png';
                            label = 'Library';
                        }

                        const color = isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)';

                        // Рендер іконки
                        const iconElement = icons[iconName] ? (
                            <Image
                                source={{ uri: icons[iconName] }}
                                style={{ width: 24, height: 24, tintColor: color }}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={{ width: 24, height: 24 }} />
                        );

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
                <Tab.Screen name="SearchTab" component={TrackListScreen} />
                <Tab.Screen name="LibraryTab" component={LibraryScreen} />
            </Tab.Navigator>

            {/* 👇 2. ВСТАВЛЯЄМО МІНІ-ПЛЕЄР СЮДИ 👇 */}
            <MiniPlayer />
        </View>
    );
}
export default function App() {
    const [isTokenLoading, setIsTokenLoading] = useState(true);
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
        const checkToken = async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                if (token) {
                    setInitialRoute('MainTabs');
                }
            } catch (e) {
                console.log(e);
            } finally {
                setIsTokenLoading(false);
            }
        };
        checkToken();

        // Прогріваємо іконки/фон плеєра заздалегідь, щоб вони не "довантажувались" при відкритті Player.
        warmPlayerAssets().catch((e) => {
            console.log('Warm player assets error:', e);
        });
    }, []);

    const onLayoutRootView = useCallback(async () => {
        if (fontsLoaded && !isTokenLoading) {
            await SplashScreen.hideAsync();
        }
    }, [fontsLoaded, isTokenLoading]);

    if (!fontsLoaded) return null;

    if (isTokenLoading) {
        return (
            <View style={styles.loader} onLayout={onLayoutRootView}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
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

                {/* 👇 ГОЛОВНИЙ ЕКРАН З МЕНЮ (Тут живуть Home, Search, Library) */}
                <Stack.Screen name="MainTabs" component={MainTabs} />

                {/* ЕКРАНИ БЕЗ МЕНЮ (Поверх всього) */}
                <Stack.Screen name="Upload" component={MusicScreen} />
                <Stack.Screen name="CreateAlbum" component={CreateAlbumScreen} />
                <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Player" component={PlayerScreen} />
                <Stack.Screen name="SongInfo" component={SongInfoScreen} />
                <Stack.Screen name="ArtistProfile" component={ArtistProfileScreen} />
                <Stack.Screen name="ContentAndDisplay" component={ContentAndDisplayScreen} />
                <Stack.Screen name="PrivacyAndCommunity" component={PrivacyAndCommunityScreen} />
                <Stack.Screen name="QualityOfMediaFiles" component={QualityOfMediaFilesScreen} />
                <Stack.Screen name="Statistics" component={StatisticsScreen} />
                <Stack.Screen name="AboutUs" component={AboutUsScreen} />
                <Stack.Screen name="ProScreen" component={ProScreen} />
                <Stack.Screen name="ChoosePodcast" component={ChoosePodcastScreen} />
                <Stack.Screen name="ChooseArtist" component={ChooseArtistScreen} />

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
        width: scale(200),
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
