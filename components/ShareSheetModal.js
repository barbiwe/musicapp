import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Share,
    Linking,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { scale } from '../api/api';

const buildMessage = (title, url) => {
    const safeTitle = String(title || '').trim();
    const safeUrl = String(url || '').trim();
    if (safeTitle && safeUrl) return `${safeTitle}\n${safeUrl}`;
    return safeTitle || safeUrl || 'VOX';
};

const openUrlIfSupported = async (url) => {
    if (!url) return false;
    try {
        const supported = await Linking.canOpenURL(url);
        if (!supported) return false;
        await Linking.openURL(url);
        return true;
    } catch (_) {
        return false;
    }
};

export default function ShareSheetModal({
    visible,
    onClose,
    renderIcon,
    title = 'Share',
    shareTitle,
    shareUrl,
    onNotify,
}) {
    const message = buildMessage(shareTitle, shareUrl);
    const encodedUrl = encodeURIComponent(String(shareUrl || '').trim());
    const encodedMessage = encodeURIComponent(message);

    const notify = (text) => {
        if (typeof onNotify === 'function') {
            onNotify(text);
            return;
        }
        Alert.alert('Share', text);
    };

    const handleCopyLink = async () => {
        if (!shareUrl) {
            notify('No link available');
            return;
        }
        Alert.alert('Copy link', shareUrl);
    };

    const handleMoreOptions = async () => {
        try {
            await Share.share({ message });
        } catch (_) {
            // ignore
        }
    };

    const handleTelegram = async () => {
        const appUrl = `tg://msg_url?text=${encodedMessage}&url=${encodedUrl}`;
        const webUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedMessage}`;
        const opened = await openUrlIfSupported(appUrl);
        if (!opened) await openUrlIfSupported(webUrl);
    };

    const handleInstagram = async () => {
        await handleMoreOptions();
    };

    const handleFacebook = async () => {
        const webUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        const opened = await openUrlIfSupported(webUrl);
        if (!opened) await handleMoreOptions();
    };

    const handleBluetooth = async () => {
        await handleMoreOptions();
    };

    const SocialButton = ({ iconName, label, onPress }) => (
        <TouchableOpacity style={styles.socialItem} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.socialCircle}>
                {renderIcon(iconName, { width: scale(24), height: scale(24) }, '#F5D8CB')}
            </View>
            <Text style={styles.socialLabel}>{label}</Text>
        </TouchableOpacity>
    );

    const RowButton = ({ iconName, label, onPress }) => (
        <TouchableOpacity style={styles.rowButton} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.rowButtonIconCircle}>
                {renderIcon(iconName, { width: scale(24), height: scale(24) }, '#F5D8CB')}
            </View>
            <Text style={styles.rowButtonText}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={() => {}}>
                        <View style={styles.modalSheetWrapper}>
                            <LinearGradient
                                colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                                locations={[0, 0.2, 1]}
                                start={{ x: 0.5, y: 0 }}
                                end={{ x: 0.5, y: 1 }}
                                style={styles.modalBorderGradient}
                            >
                                <BlurView intensity={40} tint="dark" style={styles.modalGlassContainer}>
                                    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(30, 10, 8, 0.85)' }]} />

                                    <View style={styles.content}>
                                        <View style={styles.modalIndicator} />
                                        <Text style={styles.title}>{title}</Text>

                                        <View style={styles.socialRow}>
                                            <SocialButton iconName="telegram.svg" label="Telegram" onPress={handleTelegram} />
                                            <SocialButton iconName="instagram.svg" label="Instagram" onPress={handleInstagram} />
                                            <SocialButton iconName="facebook.svg" label="Facebook" onPress={handleFacebook} />
                                            <SocialButton iconName="bluetooth.svg" label="Bluetooth" onPress={handleBluetooth} />
                                        </View>

                                        <RowButton iconName="copy link.svg" label="Copy link" onPress={handleCopyLink} />
                                        <RowButton iconName="share.svg" label="More options" onPress={handleMoreOptions} />
                                    </View>
                                </BlurView>
                            </LinearGradient>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.42)',
        justifyContent: 'flex-end',
    },
    modalSheetWrapper: {
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 15,
    },
    modalBorderGradient: {
        width: '100%',
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        paddingTop: 1.5,
        paddingHorizontal: 1.5,
        paddingBottom: 0,
    },
    modalGlassContainer: {
        borderTopLeftRadius: scale(40),
        borderTopRightRadius: scale(40),
        overflow: 'hidden',
    },
    content: {
        paddingHorizontal: scale(20),
        paddingTop: scale(16),
        paddingBottom: scale(24),
    },
    modalIndicator: {
        width: scale(40),
        height: scale(4),
        borderRadius: scale(2),
        backgroundColor: 'rgba(245, 216, 203, 0.2)',
        alignSelf: 'center',
        marginBottom: scale(16),
    },
    title: {
        textAlign: 'center',
        fontFamily: 'Unbounded-SemiBold',
        fontSize: scale(24),
        color: '#F5D8CB',
        marginBottom: scale(18),
    },
    socialRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: scale(18),
    },
    socialItem: {
        width: scale(70),
        alignItems: 'center',
    },
    socialCircle: {
        width: scale(50),
        height: scale(50),
        borderRadius: scale(25),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: scale(8),
    },
    socialLabel: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(10),
        textAlign: 'center',
    },
    rowButton: {
        height: scale(48),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        borderRadius: scale(24),
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: scale(16),
        marginBottom: scale(14),
    },
    rowButtonIconCircle: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        borderWidth: 1,
        borderColor: '#F5D8CB',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: scale(14),
    },
    rowButtonText: {
        color: '#F5D8CB',
        fontFamily: 'Poppins-Regular',
        fontSize: scale(17),
    },
});
