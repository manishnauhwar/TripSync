import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  Linking, 
  ActivityIndicator,
  useColorScheme,
  StatusBar,
  ImageBackground,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Button, Card, FAB, IconButton, Menu, Portal, Dialog, TextInput } from 'react-native-paper';
import { launchImageLibrary } from 'react-native-image-picker';
import * as DocumentPicker from '@react-native-documents/picker';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import axios from 'axios';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import api from '../apis/api';

const { width, height } = Dimensions.get('window');

const DocumentScreen = ({ route, navigation }) => {
  const { tripId, tripName } = route.params;
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [description, setDescription] = useState('');
  const [menuVisible, setMenuVisible] = useState({});
  
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
    inputBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : '#FFFFFF',
  };

  const isSmallScreen = width < 375;
  const contentPadding = isSmallScreen ? 12 : 16;
  const cardSpacing = isSmallScreen ? 8 : 12;

  useEffect(() => {
    fetchDocuments();
  }, [tripId]);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await api.getTripDocuments(tripId);
      if (response.success) {
        setDocuments(response.data);
        setError(null);
      } else {
        setError(response.error || 'Failed to load documents');
      }
    } catch (err) {
      setError('Error loading documents: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const requestStoragePermission = async () => {
    const permissionsToRequest = Platform.select({
      android: Platform.Version >= 33 
        ? [PERMISSIONS.ANDROID.READ_MEDIA_IMAGES] 
        : [PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE],
      ios: [PERMISSIONS.IOS.PHOTO_LIBRARY],
    });

    try {
      if (Platform.OS === 'android' && Platform.Version >= 33) return true;
      let hasAllPermissions = true;
      for (const permission of Array.isArray(permissionsToRequest) ? permissionsToRequest : [permissionsToRequest]) {
        const result = await check(permission);
        if (result !== RESULTS.GRANTED) {
          hasAllPermissions = false;
          const requestResult = await request(permission);
          if (requestResult !== RESULTS.GRANTED) return false;
        }
      }
      return hasAllPermissions;
    } catch (err) {
      return false;
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.plainText],
        allowMultiSelection: false,
      });
      if (result && result.length > 0) {
        setShowUploadDialog(true);
        const selectedFile = result[0];
        return {
          uri: selectedFile.uri,
          name: selectedFile.name || 'document',
          type: selectedFile.type || 'application/octet-stream',
          size: selectedFile.size || 0,
        };
      }
      return null;
    } catch (err) {
      if (DocumentPicker.isCancel(err)) return null;
      Alert.alert('Error', 'Failed to pick document: ' + (err.message || 'Unknown error'));
      return null;
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Storage access is required to select images.');
      return null;
    }
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
      });
      if (result.didCancel || result.errorCode) return null;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        setShowUploadDialog(true);
        return {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
          name: asset.fileName || 'image.jpg',
          type: asset.type || 'image/jpeg',
          size: asset.fileSize,
        };
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to select image: ' + err.message);
    }
    return null;
  };

  const uploadToCloudinary = async (fileData) => {
    try {
      const apiUrl = api.API_URL || 'http://10.0.2.2:3000';
      let signatureData;
      try {
        const response = await axios.get(`${apiUrl}/api/cloudinary/signature`);
        signatureData = response.data;
      } catch {
        const response = await axios.get(`${apiUrl}/get-signature`);
        signatureData = response.data;
      }
      if (!signatureData || !signatureData.signature) throw new Error('Failed to get valid signature from server');
      const { signature, timestamp } = signatureData;
      const formData = new FormData();
      const file = {
        uri: Platform.OS === 'android' ? fileData.uri : fileData.uri.replace('file://', ''),
        type: fileData.type || 'application/octet-stream',
        name: fileData.name || 'file'
      };
      const isPdf = (fileData.type && (fileData.type.includes('pdf') || fileData.type === 'application/pdf')) ||
                    (fileData.name && fileData.name.toLowerCase().endsWith('.pdf'));
      if (isPdf) file.type = 'application/pdf';
      formData.append('file', file);
      formData.append('api_key', '275526128117363');
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      let response;
      let retries = 0;
      const maxRetries = 2;
      while (retries <= maxRetries) {
        try {
          response = await fetch('https://api.cloudinary.com/v1_1/dgkvgk1ij/auto/upload', {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
          });
          break;
        } catch {
          if (retries === maxRetries) throw new Error('Network error during upload. Please check your internet connection.');
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
      }
      if (!response.ok) throw new Error(`Upload failed: ${await response.text()}`);
      const responseData = await response.json();
      if (responseData.secure_url) {
        return {
          success: true,
          url: responseData.secure_url,
          publicId: responseData.public_id,
          fileType: isPdf ? 'application/pdf' : (responseData.format || fileData.type),
        };
      }
      throw new Error('No secure_url in response');
    } catch (err) {
      throw err;
    }
  };

  const checkServerAvailability = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const apiUrl = api.API_URL || 'http://10.0.2.2:3000';
      let pingResponse = await fetch(`${apiUrl}/api/cloudinary/signature`, { signal: controller.signal });
      if (!pingResponse.ok) {
        pingResponse = await fetch(`${apiUrl}/get-signature`, { signal: controller.signal });
        if (!pingResponse.ok) throw new Error(`Server responded with status ${pingResponse.status}`);
      }
      clearTimeout(timeoutId);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') throw new Error('Server request timed out. Please check your network connection.');
      throw new Error('Cannot connect to server. Please check your network connection.');
    }
  };

  const uploadDocument = async (fileToUpload) => {
    if (!fileToUpload) {
      Alert.alert('Error', 'No file selected');
      return;
    }
    const isPdf = (fileToUpload.type && (fileToUpload.type.includes('pdf') || fileToUpload.type === 'application/pdf')) ||
                  (fileToUpload.name && fileToUpload.name.toLowerCase().endsWith('.pdf'));
    if (isPdf) fileToUpload.type = 'application/pdf';
    try {
      setUploading(true);
      await checkServerAvailability();
      const cloudinaryResponse = await uploadToCloudinary(fileToUpload);
      if (!cloudinaryResponse || !cloudinaryResponse.url) throw new Error('Upload to Cloudinary failed - no URL returned');
      const docData = {
        name: fileToUpload.name,
        url: cloudinaryResponse.url,
        fileType: fileToUpload.type,
        size: fileToUpload.size,
        description: description
      };
      const response = await api.uploadTripDocument(tripId, docData);
      if (response.success) {
        Alert.alert('Success', 'Document uploaded successfully');
        setDescription('');
        setShowUploadDialog(false);
        fetchDocuments();
      } else {
        Alert.alert('Error', response.error || 'Failed to save document');
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Failed to upload document. Please check your network connection.');
    } finally {
      setUploading(false);
    }
  };

  const getMimeType = (fileExtension) => {
    const mimeMap = {
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png'
    };
    const ext = fileExtension.toLowerCase();
    return mimeMap[ext] || `application/${ext}`;
  };

  const fixUrl = (url) => url ? url.trim() : '';

  const fixCloudinaryUrl = (url, forDownload = true) => {
    if (!url || !url.includes('cloudinary.com')) return url;
    if (url.includes('/image/upload/') && !url.endsWith('.pdf') && forDownload) {
      return url.includes('?') ? `${url}&fl_attachment=true` : `${url}?fl_attachment=true`;
    }
    return url;
  };

  const handlePdfDocument = async (document) => {
    try {
      const viewUrl = document.url;
      Alert.alert('Opening PDF', 'The PDF will open in your browser');
      setTimeout(() => Linking.openURL(viewUrl), 1000);
    } catch (error) {}
  };

  const downloadDocument = async (document) => {
    const isPdf = document.fileType && (document.fileType.includes('pdf') || document.fileType === 'application/pdf' ||
                  (document.name && document.name.toLowerCase().endsWith('.pdf')));
    if (isPdf) {
      handlePdfDocument(document);
      return;
    }
    try {
      const isAndroid13Plus = Platform.OS === 'android' && Platform.Version >= 33;
      const needsPermission = Platform.OS === 'android' && !isAndroid13Plus;
      if (needsPermission) {
        const hasPermission = await requestStoragePermission();
        if (!hasPermission) {
          Alert.alert('Permission Denied', 'Storage access is required to download files. Please grant permission in your device settings.');
          return;
        }
      }
      let fileExtension = document.fileType && document.fileType.includes('/') ? document.fileType.split('/')[1] :
                         document.url && document.url.includes('.') ? document.url.substring(document.url.lastIndexOf('.') + 1) : 'file';
      if (fileExtension.includes('?')) fileExtension = fileExtension.split('?')[0];
      if (isPdf && fileExtension !== 'pdf') fileExtension = 'pdf';
      const baseName = document.name || 'document';
      const fileName = baseName.toLowerCase().endsWith(`.${fileExtension}`) ? baseName : `${baseName}.${fileExtension}`;
      const downloadPath = Platform.OS === 'android' && isAndroid13Plus ? `${RNFS.DocumentDirectoryPath}/${fileName}` :
                           Platform.OS === 'android' ? `${RNFS.DownloadDirectoryPath}/${fileName}` : `${RNFS.DocumentDirectoryPath}/${fileName}`;
      Alert.alert('Downloading', 'Downloading file to your device...');
      let downloadUrl = document.url;
      if (downloadUrl.includes('cloudinary.com')) {
        downloadUrl = downloadUrl.includes('?') ? `${downloadUrl}&fl_attachment=true` : `${downloadUrl}?fl_attachment=true`;
      }
      const downloadResult = await RNFS.downloadFile({ fromUrl: downloadUrl, toFile: downloadPath }).promise;
      if (downloadResult.statusCode === 200) {
        Alert.alert('Download Complete', isPdf ? `PDF saved to Downloads folder as "${fileName}". You may need a PDF viewer app to open it.` :
                                              `File saved to Downloads folder as "${fileName}"`);
        if (isPdf) {
          setTimeout(() => {
            Alert.alert('Open PDF', 'Would you like to open the downloaded PDF now?', [
              { text: 'No', style: 'cancel' },
              { text: 'Open', onPress: async () => {
                try {
                  await FileViewer.open(downloadPath, { showOpenWithDialog: true, displayName: document.name || 'document' });
                } catch {
                  Alert.alert('Cannot Open PDF', 'No PDF viewer app found. You may need to install a PDF reader app.');
                }
              }}
            ]);
          }, 1000);
        }
      } else {
        Alert.alert('Download Failed', 'Could not download the file');
      }
    } catch {
      Alert.alert('Error', 'Failed to download the file');
    }
  };

  const handleDocumentAction = async (document) => {
    if (document.fileType && document.fileType.startsWith('image/')) {
      navigation.navigate('ImageViewer', { uri: document.url });
      return;
    }
    if (document.fileType && (document.fileType.includes('pdf') || document.fileType === 'application/pdf' ||
        (document.name && document.name.toLowerCase().endsWith('.pdf')))) {
      handlePdfDocument(document);
      return;
    }
    try {
      let fileExtension = document.fileType && document.fileType.includes('/') ? document.fileType.split('/')[1] :
                         document.url && document.url.includes('.') ? document.url.substring(document.url.lastIndexOf('.') + 1) : 'txt';
      if (fileExtension.includes('?')) fileExtension = fileExtension.split('?')[0];
      const fileName = `${document.name || 'document'}.${fileExtension}`;
      const localPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      Alert.alert('Downloading', 'Downloading document...');
      const downloadResult = await RNFS.downloadFile({ fromUrl: document.url, toFile: localPath }).promise;
      if (downloadResult.statusCode === 200) {
        try {
          const mimeType = document.fileType || getMimeType(fileExtension);
          await FileViewer.open(localPath, { showOpenWithDialog: true, displayName: document.name || 'document' });
        } catch {
          Alert.alert('Cannot Open File', 'No app found to open this file type. Opening in browser instead.');
          Linking.openURL(document.url);
        }
      } else {
        Alert.alert('Download failed', 'Opening file in browser instead');
        Linking.openURL(document.url);
      }
    } catch {
      Alert.alert('Error', 'Could not process file. Opening in browser instead.');
      Linking.openURL(document.url);
    }
  };

  const deleteDocument = async (documentId) => {
    try {
      const response = await api.deleteTripDocument(tripId, documentId);
      if (response.success) {
        Alert.alert('Success', 'Document deleted successfully');
        fetchDocuments();
      } else {
        Alert.alert('Error', response.error || 'Failed to delete document');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to delete document: ' + err.message);
    }
  };

  const confirmDelete = (document) => {
    Alert.alert('Delete Document', `Are you sure you want to delete "${document.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDocument(document._id) }
    ]);
  };

  const toggleMenu = (id) => {
    setMenuVisible({ ...menuVisible, [id]: !menuVisible[id] });
  };

  const renderDocumentItem = ({ item }) => {
    let icon = 'file-outline';
    if (item.fileType.includes('image')) icon = 'image-outline';
    else if (item.fileType.includes('pdf')) icon = 'file-pdf-box-outline';
    else if (item.fileType.includes('text')) icon = 'file-document-outline';
    const isPdf = item.fileType && (item.fileType.includes('pdf') || item.fileType === 'application/pdf' ||
                  (item.name && item.name.toLowerCase().endsWith('.pdf')));
    const isImage = item.fileType && item.fileType.startsWith('image/');
    const uploadDate = new Date(item.createdAt).toLocaleDateString();
    return (
      <Card style={[styles.documentCard, { backgroundColor: theme.cardBackground, marginBottom: cardSpacing }]}>
        <TouchableOpacity onPress={() => {
          if (isImage) {
            navigation.navigate('ImageViewer', { uri: item.url });
          } else if (isPdf) {
            handlePdfDocument(item);
          } else {
            handleDocumentAction(item);
          }
        }}>
          <Card.Title
            title={item.name}
            titleStyle={[styles.cardTitle, { color: theme.text }]}
            subtitle={item.description || 'No description'}
            subtitleStyle={[styles.cardSubtitle, { color: theme.subtext }]}
            left={(props) => <IconButton {...props} icon={icon} size={24} color={theme.primary} />}
            right={(props) => (
              <Menu
                visible={menuVisible[item._id]}
                onDismiss={() => toggleMenu(item._id)}
                contentStyle={{ backgroundColor: theme.cardBackground }}
                anchor={<IconButton {...props} icon="dots-vertical" onPress={() => toggleMenu(item._id)} color={theme.text} />}
              >
                <Menu.Item 
                  title="View" 
                  icon="eye"
                  titleStyle={{ color: theme.text }}
                  onPress={() => {
                    toggleMenu(item._id);
                    if (isImage) {
                      navigation.navigate('ImageViewer', { uri: item.url });
                    } else if (isPdf) {
                      handlePdfDocument(item);
                    } else {
                      handleDocumentAction(item);
                    }
                  }} 
                />
                <Menu.Item 
                  title="Download" 
                  icon="download"
                  titleStyle={{ color: theme.text }}
                  onPress={() => {
                    toggleMenu(item._id);
                    downloadDocument(item);
                  }} 
                />
                <Menu.Item 
                  title="Delete" 
                  icon="delete"
                  titleStyle={{ color: theme.error }}
                  onPress={() => {
                    toggleMenu(item._id);
                    confirmDelete(item);
                  }} 
                />
              </Menu>
            )}
          />
          <Card.Content>
            <Text style={[styles.uploadInfo, { color: theme.subtext }]}>Uploaded by: {item.uploadedBy?.username || item.uploadedBy?.email || 'Unknown'}</Text>
            <Text style={[styles.uploadInfo, { color: theme.subtext }]}>Date: {uploadDate}</Text>
            {item.size && <Text style={[styles.uploadInfo, { color: theme.subtext }]}>Size: {Math.round(item.size / 1024)} KB</Text>}
          </Card.Content>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <ImageBackground
      source={require('../assets/images/1.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <Appbar.Header style={[styles.appBar, { backgroundColor: theme.primary }]}>
            <Appbar.BackAction color="#fff" onPress={() => navigation.goBack()} />
            <Appbar.Content 
              title={`${tripName} Documents`} 
              titleStyle={styles.headerTitle}
              style={styles.headerContent}
            />
          </Appbar.Header>
        </View>
        
        <View style={[styles.contentContainer, { 
          backgroundColor: theme.background,
          padding: contentPadding,
        }]}>
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              <Button 
                mode="contained" 
                onPress={fetchDocuments}
                style={[styles.button, { backgroundColor: theme.primary }]}
              >
                Retry
              </Button>
            </View>
          ) : documents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.subtext }]}>No documents available for this trip</Text>
              <Button 
                mode="contained" 
                icon="upload" 
                onPress={() => setShowUploadDialog(true)}
                style={[styles.addButton, { backgroundColor: theme.primary }]}
              >
                Upload Document
              </Button>
            </View>
          ) : (
            <FlatList
              data={documents}
              renderItem={renderDocumentItem}
              keyExtractor={item => item._id}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchDocuments();
              }}
              contentContainerStyle={[styles.listContainer, { paddingHorizontal: contentPadding }]}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
        
        <Portal>
          <Dialog 
            visible={showUploadDialog} 
            onDismiss={() => setShowUploadDialog(false)}
            style={{ backgroundColor: theme.cardBackground }}
          >
            <Dialog.Title style={{ color: theme.text }}>Upload Document</Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Description (Optional)"
                value={description}
                onChangeText={setDescription}
                style={styles.input}
                theme={{ 
                  colors: { 
                    text: theme.text,
                    placeholder: theme.subtext,
                    background: theme.inputBackground
                  } 
                }}
              />
              {uploading && (
                <View style={styles.uploadingContainer}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.uploadingText, { color: theme.primary }]}>Uploading...</Text>
                </View>
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button 
                onPress={() => setShowUploadDialog(false)}
                textColor={theme.text}
              >
                Cancel
              </Button>
              <Button 
                onPress={async () => {
                  const file = await pickDocument();
                  if (file) uploadDocument(file);
                }} 
                disabled={uploading}
                textColor={theme.primary}
              >
                Select File
              </Button>
              <Button 
                onPress={async () => {
                  const image = await pickImage();
                  if (image) uploadDocument(image);
                }} 
                disabled={uploading}
                textColor={theme.primary}
              >
                Select Image
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        
        <FAB
          style={[styles.fab, { backgroundColor: theme.primary }]}
          icon="upload"
          onPress={() => setShowUploadDialog(true)}
          visible={!loading && !showUploadDialog}
          color="#fff"
        />
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
    paddingTop: StatusBar.currentHeight || 0,
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  appBar: {
    elevation: 0,
    borderRadius: 24,
    // margin: 16,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    // padding: 0,
  },
  headerContent: {
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    overflow: 'hidden',
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  errorText: { 
    fontSize: 16, 
    marginBottom: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  emptyText: { 
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  listContainer: { 
    paddingBottom: 80,
  },
  documentCard: { 
    elevation: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 14,
  },
  uploadInfo: { 
    fontSize: 12,
    marginBottom: 2 
  },
  fab: { 
    position: 'absolute', 
    margin: 16, 
    right: 16, 
    bottom: 50,
    borderRadius: 30,
    elevation: 6,
  },
  input: { 
    marginBottom: 16 
  },
  uploadingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 16 
  },
  uploadingText: { 
    marginLeft: 10
  },
  addButton: { 
    marginTop: 16,
    borderRadius: 30,
    paddingHorizontal: 16,
  },
  button: {
    borderRadius: 30,
    paddingHorizontal: 16,
  }
});

export default DocumentScreen;