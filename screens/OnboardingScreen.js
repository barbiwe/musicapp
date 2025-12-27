import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    Platform
} from 'react-native';

const { width, height } = Dimensions.get('window');
const BUTTON_HEIGHT = Platform.OS === 'ios' ? 56 : 52;

export default function OnboardingScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.container}>
            {/* PREVIEW BLOCKS */}
            {/*<View style={styles.previewWrapper}>*/}
            {/*    <View style={[styles.previewCard, styles.left]} />*/}
            {/*    <View style={styles.previewCardMain} />*/}
            {/*    <View style={[styles.previewCard, styles.right]} />*/}
            {/*</View>*/}

            {/* TEXT */}
            <View style={styles.textWrapper}>
                <Text style={styles.title}>
                    Listen to{'\n'}music you love
                </Text>

                <Text style={styles.subtitle}>
                    Discover new artists and{'\n'}
                    playlists made for you
                </Text>
            </View>

            {/* BUTTON */}
            <TouchableOpacity
                style={styles.button}
                onPress={() => navigation.navigate('AuthChoice')}
            >
                <Text style={styles.buttonText}>Get started</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingBottom: 32
    },

    // previewWrapper: {
    //     marginTop: height * 0.1,
    //     height: height * 0.38,
    //     alignItems: 'center',
    //     justifyContent: 'center'
    // },
    //
    // previewCardMain: {
    //     width: width * 0.66,
    //     height: width * 0.66,
    //     backgroundColor: '#E0E0E0',
    //     borderRadius: 28,
    //     position: 'absolute'
    // },
    //
    // previewCard: {
    //     width: width * 0.56,
    //     height: width * 0.56,
    //     backgroundColor: '#E0E0E0',
    //     borderRadius: 28,
    //     position: 'absolute',
    //     opacity: 0.9
    // },

    left: { left: -width * 0.18 },
    right: { right: -width * 0.18 },

    textWrapper: {
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: height * 0.03
    },

    title: {
        fontSize: width * 0.085,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: width * 0.1,
        marginTop: 460,
        marginBottom: 12
    },

    subtitle: {
        fontSize: width * 0.045,
        color: '#9E9E9E',
        textAlign: 'center',
        lineHeight: width * 0.06
    },

    button: {
        marginTop: 'auto',
        marginBottom: 60,
        marginHorizontal: 24,
        height: BUTTON_HEIGHT,
        backgroundColor: '#000',
        borderRadius: BUTTON_HEIGHT / 2,
        alignItems: 'center',
        justifyContent: 'center'
    },

    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    }
});
