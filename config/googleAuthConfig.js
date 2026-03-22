import { Platform } from 'react-native';

export const GOOGLE_IOS_CLIENT_ID =
    '651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6.apps.googleusercontent.com';
export const GOOGLE_WEB_CLIENT_ID =
    '651816373430-hjii65stgn3ei6q1lrfs4e0dm298j9gn.apps.googleusercontent.com';
export const GOOGLE_IOS_REDIRECT_URI =
    'com.googleusercontent.apps.651816373430-s2bjgg2rh5pjga66kuevbt3u8e6e56e6:/oauth2redirect/google';

// Android client IDs:
// - EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID          -> release / APK
// - EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEBUG    -> debug / dev client
const GOOGLE_ANDROID_CLIENT_ID_RELEASE =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '';
const GOOGLE_ANDROID_CLIENT_ID_DEBUG =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEBUG || '';

export const GOOGLE_ANDROID_CLIENT_ID = __DEV__
    ? (GOOGLE_ANDROID_CLIENT_ID_DEBUG || GOOGLE_ANDROID_CLIENT_ID_RELEASE)
    : (GOOGLE_ANDROID_CLIENT_ID_RELEASE || GOOGLE_ANDROID_CLIENT_ID_DEBUG);

const toGoogleSchemeFromClientId = (clientId = '') => {
    if (!clientId) return '';
    return clientId.replace('.apps.googleusercontent.com', '');
};

export const GOOGLE_ANDROID_REDIRECT_URI = GOOGLE_ANDROID_CLIENT_ID
    ? `com.googleusercontent.apps.${toGoogleSchemeFromClientId(GOOGLE_ANDROID_CLIENT_ID)}:/oauth2redirect/google`
    : '';

export const getGoogleAuthRequestConfig = () => {
    const base = {
        iosClientId: GOOGLE_IOS_CLIENT_ID,
        webClientId: GOOGLE_WEB_CLIENT_ID,
    };

    if (Platform.OS === 'ios') {
        return {
            ...base,
            redirectUri: GOOGLE_IOS_REDIRECT_URI,
        };
    }

    if (Platform.OS === 'android') {
        // Для Android фіксуємо redirectUri під reverse client id.
        // Це потрібно для кейсів "Custom URI scheme is not enabled..." у Google OAuth.
        return {
            ...base,
            ...(GOOGLE_ANDROID_CLIENT_ID ? { androidClientId: GOOGLE_ANDROID_CLIENT_ID } : {}),
            ...(GOOGLE_ANDROID_REDIRECT_URI ? { redirectUri: GOOGLE_ANDROID_REDIRECT_URI } : {}),
        };
    }

    return base;
};
