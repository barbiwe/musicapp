import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    Image,
    Dimensions,
    Platform,
    Alert,
    Linking,
    ActivityIndicator,
    AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgXml } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';

import {
    confirmPremiumCheckout,
    createPremiumCheckout,
    getIcons,
    isPremiumUser,
    refreshUserToken,
    scale,
} from '../api/api';

const { width, height } = Dimensions.get('window');
const PENDING_PREMIUM_SESSION_KEY = 'pending_premium_session_id_v1';
const PREMIUM_BANNER_INVALIDATE_KEY = 'premium_banner_invalidate_v1';

// 1. КЕШ ТА РЕНДЕР SVG
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

export default function ProScreen({ navigation }) {
    const isFocused = useIsFocused();
    const [icons, setIcons] = useState({});
    const [buying, setBuying] = useState(false);
    const [confirmingPayment, setConfirmingPayment] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [scrollEnabled, setScrollEnabled] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const hasLoadedOnceRef = useRef(false);
    const handledSessionIdsRef = useRef(new Set());
    const appStateRef = useRef(AppState.currentState);
    const premiumLog = (...args) => {
        console.log('[PREMIUM]', ...args);
    };

    const loadData = useCallback(async (options = {}) => {
        const forceRefresh = !!options?.forceRefresh;
        try {
            premiumLog('loadData:start', { forceRefresh });
            if (forceRefresh) {
                const refreshResult = await refreshUserToken();
                premiumLog('loadData:refreshUserToken', {
                    ok: !refreshResult?.error,
                    role: refreshResult?.data?.role ?? null,
                    error: refreshResult?.error || null,
                });
            }
            const [loadedIcons, premium] = await Promise.all([
                getIcons(),
                isPremiumUser(),
            ]);
            setIcons(loadedIcons || {});
            setIsPremium(!!premium);
            hasLoadedOnceRef.current = true;
            premiumLog('loadData:done', { premium: !!premium, icons: Object.keys(loadedIcons || {}).length });
        } catch (e) {
            console.log("Error loading icons:", e);
            hasLoadedOnceRef.current = false;
            premiumLog('loadData:error', String(e?.message || e));
        }
    }, []);

    const stringifyError = (error) => {
        if (!error) return 'Something went wrong';
        if (typeof error === 'string') return error;
        if (typeof error === 'object') {
            const first =
                error?.message ||
                error?.title ||
                error?.error ||
                error?.detail ||
                JSON.stringify(error);
            return first || 'Something went wrong';
        }
        return String(error);
    };

    const extractSessionIdFromCheckoutUrl = (checkoutUrl) => {
        const value = String(checkoutUrl || '').trim();
        if (!value) return null;
        const match = value.match(/\/(cs_(?:test|live)_[A-Za-z0-9]+)(?:[#/?]|$)/i);
        return match?.[1] || null;
    };

    const extractSessionIdFromUrl = (url) => {
        const value = String(url || '').trim();
        if (!value) return null;

        const queryPart = value.includes('?') ? value.split('?')[1] : '';
        if (!queryPart) return null;
        try {
            if (typeof URLSearchParams !== 'undefined') {
                const params = new URLSearchParams(queryPart);
                return params.get('session_id') || params.get('sessionId') || null;
            }
        } catch (_) {
            // ignore and try regex fallback
        }

        const match = queryPart.match(/(?:^|&)(session_id|sessionId)=([^&]+)/i);
        return match?.[2] ? decodeURIComponent(match[2]) : null;
    };

    const confirmSessionIfNeeded = useCallback(async (incomingUrl) => {
        premiumLog('confirmSessionIfNeeded:url', incomingUrl);
        const sessionId = extractSessionIdFromUrl(incomingUrl);
        premiumLog('confirmSessionIfNeeded:sessionId', sessionId || 'none');
        if (!sessionId) return;
        if (handledSessionIdsRef.current.has(sessionId)) return;
        handledSessionIdsRef.current.add(sessionId);

        setConfirmingPayment(true);
        try {
            premiumLog('confirmSessionIfNeeded:confirmPremiumCheckout:start', { sessionId });
            const confirmRes = await confirmPremiumCheckout(sessionId);
            if (confirmRes?.error) {
                premiumLog('confirmSessionIfNeeded:confirmPremiumCheckout:error', confirmRes.error);
                return;
            }
            premiumLog('confirmSessionIfNeeded:confirmPremiumCheckout:ok');

            premiumLog('confirmSessionIfNeeded:refreshUserToken:start');
            const refreshRes = await refreshUserToken();
            if (refreshRes?.error) {
                premiumLog('confirmSessionIfNeeded:refreshUserToken:error', refreshRes.error);
                return;
            }
            premiumLog('confirmSessionIfNeeded:refreshUserToken:ok', {
                role: refreshRes?.data?.role ?? null,
            });

            await loadData();
            await AsyncStorage.setItem(PREMIUM_BANNER_INVALIDATE_KEY, String(Date.now()));
            premiumLog('confirmSessionIfNeeded:loadData:done');
        } catch (err) {
            premiumLog('confirmSessionIfNeeded:exception', String(err?.message || err));
        } finally {
            setConfirmingPayment(false);
            premiumLog('confirmSessionIfNeeded:finish');
        }
    }, [loadData]);

    const confirmPendingSessionIfNeeded = useCallback(async () => {
        try {
            const pendingSessionId = await AsyncStorage.getItem(PENDING_PREMIUM_SESSION_KEY);
            if (!pendingSessionId) return;

            premiumLog('confirmPendingSessionIfNeeded:found', pendingSessionId);
            setConfirmingPayment(true);

            const confirmRes = await confirmPremiumCheckout(pendingSessionId);
            if (confirmRes?.error) {
                premiumLog('confirmPendingSessionIfNeeded:confirm:error', confirmRes.error);
                return;
            }

            premiumLog('confirmPendingSessionIfNeeded:confirm:ok');
            const refreshRes = await refreshUserToken();
            premiumLog('confirmPendingSessionIfNeeded:refresh', {
                ok: !refreshRes?.error,
                role: refreshRes?.data?.role ?? null,
                error: refreshRes?.error || null,
            });

            await loadData();
            await AsyncStorage.setItem(PREMIUM_BANNER_INVALIDATE_KEY, String(Date.now()));
            await AsyncStorage.removeItem(PENDING_PREMIUM_SESSION_KEY);
            premiumLog('confirmPendingSessionIfNeeded:done');
        } catch (err) {
            premiumLog('confirmPendingSessionIfNeeded:exception', String(err?.message || err));
        } finally {
            setConfirmingPayment(false);
        }
    }, [loadData]);

    useEffect(() => {
        if (!isFocused) return;

        if (!hasLoadedOnceRef.current) {
            loadData({ forceRefresh: true });
        }
        void confirmPendingSessionIfNeeded();
    }, [isFocused, loadData, confirmPendingSessionIfNeeded]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            const prevState = appStateRef.current;
            appStateRef.current = nextState;
            const cameToForeground =
                (prevState === 'background' || prevState === 'inactive') && nextState === 'active';

            if (cameToForeground) {
                premiumLog('appState:foreground -> confirmPendingSessionIfNeeded');
                void confirmPendingSessionIfNeeded();
            }
        });

        return () => {
            subscription?.remove?.();
        };
    }, [confirmPendingSessionIfNeeded]);

    useEffect(() => {
        let mounted = true;
        const subscription = Linking.addEventListener('url', ({ url }) => {
            if (!url) return;
            void confirmSessionIfNeeded(url);
        });

        Linking.getInitialURL()
            .then((url) => {
                if (!mounted || !url) return;
                void confirmSessionIfNeeded(url);
            })
            .catch(() => {});

        return () => {
            mounted = false;
            subscription?.remove?.();
        };
    }, [confirmSessionIfNeeded]);

    useEffect(() => {
        if (!viewportHeight || !contentHeight) return;
        setScrollEnabled(contentHeight > viewportHeight + 2);
    }, [viewportHeight, contentHeight]);

    const handleBuyPremium = async () => {
        if (buying || confirmingPayment) return;
        if (isPremium) {
            premiumLog('handleBuyPremium:alreadyPremium');
            Alert.alert('Premium', 'Your account already has Premium.');
            return;
        }

        setBuying(true);
        try {
            premiumLog('handleBuyPremium:createPremiumCheckout:start');
            const res = await createPremiumCheckout();
            if (res?.error || !res?.url) {
                premiumLog('handleBuyPremium:createPremiumCheckout:error', res?.error || 'No checkout URL');
                Alert.alert('Payment error', stringifyError(res?.error));
                return;
            }
            premiumLog('handleBuyPremium:createPremiumCheckout:ok', { url: res.url });
            const preParsedSessionId = extractSessionIdFromCheckoutUrl(res.url);
            if (preParsedSessionId) {
                await AsyncStorage.setItem(PENDING_PREMIUM_SESSION_KEY, preParsedSessionId);
                premiumLog('handleBuyPremium:savedPendingSession', preParsedSessionId);
            } else {
                premiumLog('handleBuyPremium:noSessionIdInCheckoutUrl');
            }

            const canOpen = await Linking.canOpenURL(res.url);
            premiumLog('handleBuyPremium:canOpenURL', { canOpen });
            if (!canOpen) {
                Alert.alert('Payment error', 'Cannot open checkout URL.');
                return;
            }

            await Linking.openURL(res.url);
            premiumLog('handleBuyPremium:openURL:done');
        } catch (err) {
            premiumLog('handleBuyPremium:exception', String(err?.message || err));
            Alert.alert('Payment error', 'Failed to start checkout.');
        } finally {
            setBuying(false);
            premiumLog('handleBuyPremium:finish');
        }
    };

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

    // Допоміжний компонент для пунктів списку (зменшені відступи)
    const BulletItem = ({ text }) => (
        <View style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{text}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" translucent={true} backgroundColor="transparent" />

            <LinearGradient
                colors={['#9A4B39', '#80291E', '#190707']}
                locations={[0, 0.2, 0.59]}
                start={{ x: 1, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradient}
            >
                <SafeAreaView style={styles.safeArea}>

                    {/* HEADER */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                        >
                            {renderIcon('arrow-left.svg', { width: scale(24), height: scale(24) }, '#F5D8CB')}
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>Premium</Text>

                        <View style={{ width: scale(24) }} />
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
                        onContentSizeChange={(_, h) => setContentHeight(h)}
                        scrollEnabled={scrollEnabled}
                        showsVerticalScrollIndicator={false}
                        bounces={scrollEnabled}
                        alwaysBounceVertical={false}
                        overScrollMode="never"
                        contentInsetAdjustmentBehavior="never"
                    >

                        {/* MAIN CARD */}
                        <View style={styles.card}>

                            {/* Watermark */}
                            <View style={styles.watermarkContainer}>
                                {/* Зменшили висоту водяного знаку */}
                                {renderIcon('VOX.svg', { width: scale(220), height: scale(80) }, '#FFFFFF')}
                            </View>

                            <Text style={styles.cardTitle}>Subscription</Text>

                            <View style={styles.priceContainer}>
                                <Text style={styles.price}>$4.99</Text>
                                <Text style={styles.pricePeriod}> / month</Text>
                            </View>

                            <Text style={styles.description}>
                                VOX Pro – the best way to enjoy music your way. By subscribing, you get:
                            </Text>

                            {/* Section 1 */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Library & Playlists</Text>
                                <BulletItem text="Unlimited access to all songs and playlists" />
                                <BulletItem text="Create and upload your own playlists without limits" />
                            </View>

                            {/* Section 2 */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Listening Experience</Text>
                                <BulletItem text="Ad-free listening" />
                                <BulletItem text="Offline downloads for any track" />
                                <BulletItem text="High-quality sound" />
                            </View>

                            {/* Section 3 */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Personalization & Tools</Text>
                                <BulletItem text="Personalized recommendations and curated mixes" />
                                <BulletItem text="Unlimited skips" />
                            </View>

                            {/* BUTTON */}
                            <TouchableOpacity
                                style={[styles.button, (buying || confirmingPayment) && styles.buttonDisabled]}
                                activeOpacity={0.8}
                                onPress={handleBuyPremium}
                                disabled={buying || confirmingPayment}
                            >
                                {(buying || confirmingPayment) ? (
                                    <ActivityIndicator color="#300C0A" size="small" />
                                ) : (
                                    <Text style={styles.buttonText}>
                                        {isPremium ? 'You have Premium' : 'Try now'}
                                    </Text>
                                )}
                            </TouchableOpacity>

                        </View>

                        <View style={styles.bottomSpacer} />
                    </ScrollView>

                </SafeAreaView>
            </LinearGradient>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#190707',
    },
    gradient: {
        flex: 1,
        minHeight: height,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? scale(30) : 0, // Зменшив відступ зверху
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },

    // --- HEADER ---
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        marginTop: scale(5),     // Зменшив
        marginBottom: scale(65), // Зменшив
    },
    backButton: {
        width: scale(24),
    },
    headerTitle: {
        color: '#F5D8CB',
        fontSize: scale(28),     // Трохи зменшив
        fontFamily: 'Unbounded-Medium',
    },

    // --- CARD ---
    card: {
        backgroundColor: '#270A07',
        marginHorizontal: scale(16),
        borderRadius: scale(24),
        paddingVertical: scale(30),
        paddingHorizontal: scale(20),
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    watermarkContainer: {
        position: 'absolute',
        top: scale(-5),
        left: scale(-15),
        zIndex: 2,
    },

    // --- CARD CONTENT ---
    cardTitle: {
        color: '#F5D8CB',
        fontSize: scale(20),      // Зменшив
        fontFamily: 'Unbounded-Bold',
        marginBottom: scale(37),
        zIndex: 1,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: scale(12),  // Зменшив
        zIndex: 1,
    },
    price: {
        color: '#F5D8CB',
        fontSize: scale(20),      // Зменшив
        fontFamily: 'Unbounded-Bold',
    },
    pricePeriod: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив
        fontFamily: 'Unbounded-Regular',
        marginLeft: scale(4),
        opacity: 0.9,
    },
    description: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив
        fontFamily: 'Poppins-Regular',
        lineHeight: scale(18),    // Зменшив міжрядковий інтервал
        marginBottom: scale(16),  // Зменшив
        opacity: 0.9,
        zIndex: 1,
    },

    // --- SECTIONS ---
    section: {
        marginBottom: scale(14),  // Зменшив відступ між секціями
        zIndex: 1,
    },
    sectionTitle: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив
        fontFamily: 'Poppins-Bold',
        marginBottom: scale(8),   // Зменшив
    },

    // --- BULLETS ---
    bulletRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: scale(4),   // Зменшив відступ між пунктами
        paddingRight: scale(10),
    },
    bulletDot: {
        color: '#F5D8CB',
        fontSize: scale(14),
        marginRight: scale(6),
        lineHeight: scale(18),
    },
    bulletText: {
        color: '#F5D8CB',
        fontSize: scale(14),      // Зменшив шрифт
        fontFamily: 'Poppins-Regular',
        lineHeight: scale(18),    // Зменшив міжрядковий інтервал
        opacity: 0.9,
        flex: 1,
    },

    // --- BUTTON ---
    button: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(30),
        paddingVertical: scale(14), // Зменшив висоту кнопки
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: scale(5),
        zIndex: 1,
    },
    buttonDisabled: {
        opacity: 0.75,
    },
    buttonText: {
        color: '#F5D8CB',
        fontSize: scale(15),      // Зменшив
        fontFamily: 'Unbounded-Medium',
    },
    bottomSpacer: {
        height: scale(30),
    },
});
