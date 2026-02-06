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

SplashScreen.preventAutoHideAsync();

import { getIcons, scale } from './api/api';

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

const Stack = createNativeStackNavigator();
const { width } = Dimensions.get('window');

/* 🔹 LIQUID GLASS NAVIGATION 🔹 */
function GlassTabBar({ navigation }) {
    // Стейт для іконок
    const [icons, setIcons] = useState({});

    // Отримуємо поточний роут
    const routes = useNavigationState(state => state?.routes);
    const currentRoute = routes ? routes[routes.length - 1].name : 'Home';

    // Завантажуємо іконки при старті меню
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

    // Функція рендеру іконки (як в Плеєрі)
    const renderIcon = (iconName, tintColor) => {
        if (icons[iconName]) {
            return (
                <Image
                    source={{ uri: icons[iconName] }}
                    style={{ width: 24, height: 24, tintColor: tintColor }}
                    resizeMode="contain"
                />
            );
        }
        // Заглушка, якщо іконка ще не завантажилась
        return <View style={{ width: 24, height: 24 }} />;
    };

    const TabButton = ({ routeName, label, iconName }) => {
        const isActive = currentRoute === routeName;
        // Активна - біла, неактивна - напівпрозора біла
        const color = isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)';

        return (
            <TouchableOpacity
                style={styles.tabButton}
                onPress={() => navigation.navigate(routeName)}
                activeOpacity={0.7}
            >
                {/* Використовуємо нашу функцію renderIcon */}
                {renderIcon(iconName, color)}

                <Text style={[styles.tabLabel, { color }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.glassContainer}>
            <BlurView intensity={40} tint="dark" style={styles.blurContainer}>

                {/* Вказуємо назви файлів, як вони записані в базі */}
                <TabButton routeName="Home" label="Home" iconName="home.png" />
                <TabButton routeName="Tracks" label="Search" iconName="search.png" />
                <TabButton routeName="Albums" label="Library" iconName="library.png" />

            </BlurView>
        </View>
    );
}

/* 🔹 WRAPPER */
function WithDemoNav(Component) {
    return function Wrapped(props) {
        return (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <Component {...props} />
                <GlassTabBar navigation={props.navigation} />
            </View>
        );
    };
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
                    setInitialRoute('Home');
                }
            } catch (e) {
                console.log(e);
            } finally {
                setIsTokenLoading(false);
            }
        };
        checkToken();
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
                {/* ONBOARDING */}
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />

                {/* AUTH */}
                <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />

                {/* MAIN */}
                <Stack.Screen
                    name="Tracks"
                    component={WithDemoNav(TrackListScreen)}
                />
                <Stack.Screen
                    name="Albums"
                    component={WithDemoNav(AlbumListScreen)}
                />
                <Stack.Screen
                    name="Upload"
                    component={WithDemoNav(MusicScreen)}
                />
                <Stack.Screen
                    name="CreateAlbum"
                    component={WithDemoNav(CreateAlbumScreen)}
                />
                <Stack.Screen
                    name="AlbumDetail"
                    component={AlbumDetailScreen}
                />
                <Stack.Screen
                    name="Profile"
                    component={WithDemoNav(ProfileScreen)}
                />
                <Stack.Screen
                    name="Home"
                    component={WithDemoNav(DiscoverScreen)}
                />
                <Stack.Screen
                    name="Player"
                    component={PlayerScreen}
                />
                <Stack.Screen
                    name="SongInfo"
                    component={SongInfoScreen}
                />
                <Stack.Screen
                    name="ArtistProfile"
                    component={ArtistProfileScreen}
                />
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
    glassContainer: {
        position: 'absolute',
        bottom: scale(30),
        height: scale(70),
        width: scale(200),
        alignSelf: 'center',
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