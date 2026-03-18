import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';
import App from './App';

try {
    TrackPlayer.registerPlaybackService(() => require('./services/playbackService'));
} catch (e) {
    console.log('Playback service registration failed:', e);
}
registerRootComponent(App);
