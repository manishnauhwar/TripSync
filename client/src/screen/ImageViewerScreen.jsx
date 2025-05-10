import React from 'react';
import { 
  View, 
  Image, 
  StyleSheet, 
  Dimensions, 
  TouchableOpacity, 
  StatusBar,
  ImageBackground
} from 'react-native';
import { Appbar, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'react-native-linear-gradient';
import { useColorScheme } from 'react-native';

const { width, height } = Dimensions.get('window');

const ImageViewerScreen = ({ route, navigation }) => {
  const { uri } = route.params;
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const theme = {
    background: isDarkMode ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    cardBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    subtext: isDarkMode ? '#AAAAAA' : '#666666',
    primary: '#6200ea',
    accent: '#03DAC6',
    error: '#CF6679',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  };

  return (
    <ImageBackground
      source={require('../assets/images/1.jpg')}
      style={styles.backgroundImage}
      blurRadius={5}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['rgba(98, 0, 234, 0.8)', 'rgba(3, 218, 198, 0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={[styles.header, { backgroundColor: theme.background }]}>
            <IconButton
              icon="arrow-left"
              size={24}
              color={theme.text}
              onPress={() => navigation.goBack()}
            />
            <Appbar.Content 
              title="Image Viewer" 
              titleStyle={{ color: theme.text, fontWeight: 'bold' }}
            />
            <IconButton
              icon="share-variant"
              size={24}
              color={theme.text}
              onPress={() => {}}
            />
          </View>
        </LinearGradient>
        
        <View style={styles.imageContainer}>
          <TouchableOpacity 
            style={styles.fullSize}
            activeOpacity={1}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={['rgba(98, 0, 234, 0.2)', 'rgba(3, 218, 198, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.imageGradient}
            >
              <View style={[styles.imageWrapper, { backgroundColor: theme.cardBackground }]}>
                <Image
                  source={{ uri }}
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* <LinearGradient
          colors={['rgba(98, 0, 234, 0.8)', 'rgba(3, 218, 198, 0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.footerGradient}
        >
          <View style={[styles.footer, { backgroundColor: theme.background }]}>
            <IconButton
              icon="download"
              size={24}
              color={theme.text}
              onPress={() => {}}
            />
            <IconButton
              icon="star-outline"
              size={24}
              color={theme.text}
              onPress={() => {}}
            />
            <IconButton
              icon="rotate-right"
              size={24}
              color={theme.text}
              onPress={() => {}}
            />
          </View>
        </LinearGradient> */}
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerGradient: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 30,
    padding: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 28,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fullSize: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footerGradient: {
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 30,
    padding: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 28,
  },
});

export default ImageViewerScreen;