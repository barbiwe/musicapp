// App.js
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    ActivityIndicator
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import PlayerScreen from './screens/PlayerScreen'; // 👈 NEW

const Stack = createNativeStackNavigator();

/* 🔹 BOTTOM DEMO NAV */
function DemoNav({ navigation }) {
    return (
        <View style={styles.demoNav}>
            <TouchableOpacity onPress={() => navigation.navigate('Tracks')}>
                <Text style={styles.demoLink}>Tracks</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Albums')}>
                <Text style={styles.demoLink}>Albums</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Upload')}>
                <Text style={styles.demoLink}>Upload</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                <Text style={styles.demoLink}>Profile</Text>
            </TouchableOpacity>
        </View>
    );
}

/* 🔹 WRAPPER */
function WithDemoNav(Component) {
    return function Wrapped(props) {
        return (
            <View style={{ flex: 1 }}>
                <Component {...props} />
                <DemoNav navigation={props.navigation} />
            </View>
        );
    };
}

export default function App() {
    const [isLoading, setIsLoading] = useState(true);
    const [initialRoute, setInitialRoute] = useState('Onboarding');

    useEffect(() => {
        const checkToken = async () => {
            try {
                const token = await AsyncStorage.getItem('userToken');
                if (token) {
                    setInitialRoute('Tracks');
                }
            } catch (e) {
                console.log(e);
            } finally {
                setIsLoading(false);
            }
        };
        checkToken();
    }, []);

    if (isLoading) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color="#000" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <StatusBar barStyle="dark-content" />

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
                    component={WithDemoNav(AlbumDetailScreen)}
                />
                <Stack.Screen
                    name="Profile"
                    component={WithDemoNav(ProfileScreen)}
                />

                {/* 👇 PLAYER (БЕЗ bottom nav) */}
                <Stack.Screen
                    name="Player"
                    component={PlayerScreen}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    demoNav: {
        height: 56,
        borderTopWidth: 1,
        borderColor: '#E0E0E0',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    demoLink: {
        fontSize: 14,
        fontWeight: '600',
        color: '#000'
    },
    loader: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    }
});
