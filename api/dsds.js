// React Navigation
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

// react-native-svg
import { SvgXml, SvgUri } from 'react-native-svg';

// expo-av
import { Audio } from 'expo-av';

// expo-file-system
import * as FileSystem from 'expo-file-system/legacy';

// expo-font
import { useFonts } from 'expo-font';

// expo-auth-session / expo-web-browser
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// react-native-safe-area-context
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

// react-native-reanimated / gesture-handler
import Animated from 'react-native-reanimated';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Make all imports "used" so IDE won't gray them out in this showcase file.
export const importsShowcase = {
    NavigationContainer,
    createNativeStackNavigator,
    createBottomTabNavigator,
    AsyncStorage,
    SvgXml,
    SvgUri,
    Audio,
    FileSystem,
    useFonts,
    Google,
    WebBrowser,
    SafeAreaProvider,
    SafeAreaView,
    Animated,
    GestureHandlerRootView,
};
