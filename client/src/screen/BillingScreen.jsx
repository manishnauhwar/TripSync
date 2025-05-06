import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, Platform, Linking } from 'react-native';
import { Appbar, FAB, Card, Title, Button, Modal, Portal, TextInput, Checkbox, RadioButton, Divider, Avatar, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
import api from '../apis/api';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import { PERMISSIONS, RESULTS, request, requestMultiple, check } from 'react-native-permissions';

const escapeHtml = unsafe =>
    typeof unsafe === 'string'
      ? unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
      : '';
  
const requestStoragePermission = async () => {
  if (Platform.OS !== 'android') return true;

  try {
    // Get Android version
    const apiLevel = Platform.Version;
    console.log('Android API level:', apiLevel);
    
    // Different permissions based on Android version
    let permissions = [];
    
    if (apiLevel >= 33) { // Android 13+
      permissions = [
        PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
        PERMISSIONS.ANDROID.READ_MEDIA_VIDEO
      ];
      console.log('Using Android 13+ permissions');
    } else if (apiLevel >= 29) { // Android 10+
      permissions = [
        PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
        PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE
      ];
      console.log('Using Android 10+ permissions');
    } else { // Older Android
      permissions = [
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      ];
      console.log('Using legacy permissions');
    }
    
    console.log('Requesting permissions:', permissions);

    // For Android 13+, use react-native-permissions
    if (apiLevel >= 33) {
      const results = await requestMultiple(permissions);
      console.log('Permission results:', results);
      
      const allGranted = Object.values(results).every(
        (result) => result === RESULTS.GRANTED
      );
      
      if (allGranted) {
        console.log('All permissions granted');
        return true;
      }
      
      // Handle different results
      const anyDenied = Object.values(results).some(
        (result) => result === RESULTS.DENIED
      );
      
      const anyBlocked = Object.values(results).some(
        (result) => result === RESULTS.BLOCKED
      );
      
      if (anyBlocked) {
        Alert.alert(
          'Permission Denied',
          'Storage permissions were denied permanently. To enable them, go to Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
      } else if (anyDenied) {
        Alert.alert(
          'Permission Denied',
          'Storage permissions are required to export PDFs. Please try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: requestStoragePermission }
          ]
        );
      }
      
      return false;
    } 
    // For older Android versions, use the existing PermissionsAndroid API
    else {
      // Check if permissions are already granted
      const readGranted = await PermissionsAndroid.check(permissions[0]);
      const writeGranted = await PermissionsAndroid.check(permissions[1]);
      if (readGranted && writeGranted) {
        console.log('Permissions already granted');
        return true;
      }

      // Show custom Alert with three options
      const userChoice = await new Promise((resolve) => {
        Alert.alert(
          'Storage Permission',
          'The app needs storage permissions to export PDFs.',
          [
            { text: 'Cancel', onPress: () => resolve('cancel'), style: 'cancel' },
            { text: 'Ask me later', onPress: () => resolve('later') },
            { text: 'Allow', onPress: () => resolve('allow') },
          ],
          { cancelable: false }
        );
      });

      // If user doesn't choose "Allow," return false
      if (userChoice !== 'allow') {
        console.log('User chose not to allow:', userChoice);
        return false;
      }

      // Request permissions if "Allow" was selected
      const result = await PermissionsAndroid.requestMultiple(permissions);
      console.log('Permission request result:', result);

      const allGranted = Object.values(result).every(
        (status) => status === PermissionsAndroid.RESULTS.GRANTED
      );

      if (allGranted) {
        console.log('All permissions granted');
        return true;
      }

      const anyNeverAskAgain = Object.values(result).some(
        (status) => status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      );

      if (anyNeverAskAgain) {
        Alert.alert(
          'Permission Denied',
          'Storage permissions were denied permanently. To enable them, go to Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      } else {
        Alert.alert(
          'Permission Denied',
          'Storage permissions are required to export PDFs. Please try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Retry', onPress: requestStoragePermission },
          ]
        );
      }

      return false;
    }
  } catch (error) {
    console.error('Error requesting permissions:', error);
    Alert.alert('Error', 'Failed to request permissions. Please try again.');
    return false;
  }
};

const BillingScreen = ({ route, navigation }) => {
  const { tripId, tripName, participants } = route.params;
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [splitType, setSplitType] = useState('equal');
  const [splitWith, setSplitWith] = useState([]);
  const [date, setDate] = useState(new Date());
  const [balances, setBalances] = useState({});
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetchExpenses();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('userDetails');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        setPaidBy(user.email);
      }
    } catch (error) {
      console.error('Error getting user:', error);
    }
  };

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await api.getTripExpenses(tripId);
      if (response.success) {
        setExpenses(response.data || []);
        calculateBalances(response.data || []);
      } else {
        setError(response.error || 'Failed to fetch expenses');
      }
    } catch (err) {
      setError('Failed to fetch expenses');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const calculateBalances = expenseList => {
    const balanceData = {};
    participants.forEach(p => (balanceData[p.email] = { owes: {}, owed: {}, total: 0 }));
    if (Array.isArray(expenseList)) {
      expenseList.forEach(expense => {
        const { paidBy, splitWith } = expense;
        if (Array.isArray(splitWith)) {
          splitWith.forEach(split => {
            const { email, amount } = split;
            if (email !== paidBy) {
              balanceData[email].owes[paidBy] = (balanceData[email].owes[paidBy] || 0) + amount;
              balanceData[paidBy].owed[email] = (balanceData[paidBy].owed[email] || 0) + amount;
            }
          });
        }
      });
      participants.forEach(p => {
        const email = p.email;
        const totalOwed = Object.values(balanceData[email].owed).reduce((sum, amt) => sum + amt, 0);
        const totalOwes = Object.values(balanceData[email].owes).reduce((sum, amt) => sum + amt, 0);
        balanceData[email].total = totalOwed - totalOwes;
      });
    }
    setBalances(balanceData);
  };

  const handleAddExpense = async () => {
    if (!description.trim() || !amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 || !paidBy || splitWith.length === 0) {
      Alert.alert('Error', 'Please fill all fields correctly');
      return;
    }
    try {
      setLoading(true);
      const totalAmount = parseFloat(amount);
      const splitWithData = splitType === 'equal'
        ? splitWith.map(email => ({ email, amount: parseFloat((totalAmount / splitWith.length).toFixed(2)) }))
        : splitWith.map(email => ({ email, amount: totalAmount }));
      const response = await api.addTripExpense(tripId, {
        description,
        amount: totalAmount,
        date: date.toISOString(),
        paidBy,
        splitType,
        splitWith: splitWithData,
      });
      if (response.success) {
        setModalVisible(false);
        resetForm();
        fetchExpenses();
        Alert.alert('Success', 'Expense added');
      } else {
        Alert.alert('Error', response.error || 'Failed to add expense');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add expense');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setSplitType('equal');
    setSplitWith([]);
    setDate(new Date());
    if (currentUser) setPaidBy(currentUser.email);
  };

  const toggleParticipantSelection = email => setSplitWith(splitWith.includes(email) ? splitWith.filter(e => e !== email) : [...splitWith, email]);
  const selectAllParticipants = () => setSplitWith(participants.map(p => p.email));
  const getInitials = email => email?.split('@')[0]?.charAt(0)?.toUpperCase() || '?';
  const formatDate = dateString => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };
  const formatCurrency = amount => `$${parseFloat(amount).toFixed(2)}`;

  const generatePdfLocally = async () => {
    try {
      console.log('Starting local PDF generation');
      let html = `
        <html>
          <head>
            <style>
              body { font-family: Arial; padding: 20px; }
              h1 { color: #6200ea; text-align: center; }
              h2 { color: #333; margin-top: 20px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { padding: 8px; border: 1px solid #ddd; }
              th { background: #f0f0f0; }
              .positive { color: green; }
              .negative { color: red; }
              .neutral { color: gray; }
            </style>
          </head>
          <body>
            <h1>${tripName} - Expenses</h1>
            <h2>Balances</h2>
            <table>
              <tr><th>Person</th><th>Balance</th><th>Status</th></tr>
              ${participants.map(p => {
                const balance = balances[p.email]?.total || 0;
                const status = balance > 0 ? `Gets $${Math.abs(balance).toFixed(2)}` : balance < 0 ? `Owes $${Math.abs(balance).toFixed(2)}` : 'Settled';
                return `<tr><td>${escapeHtml(p.email)}</td><td class="${balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'neutral'}">$${balance.toFixed(2)}</td><td>${status}</td></tr>`;
              }).join('')}
            </table>
            <h2>Expenses</h2>
            <table>
              <tr><th>Date</th><th>Description</th><th>Amount</th><th>Paid By</th><th>Split</th></tr>
              ${expenses.map(e => `<tr><td>${escapeHtml(formatDate(e.date))}</td><td>${escapeHtml(e.description)}</td><td>$${e.amount.toFixed(2)}</td><td>${escapeHtml(e.paidBy)}</td><td>${e.splitType === 'equal' ? 'Equal' : 'Full'}</td></tr>`).join('')}
            </table>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #666;">
              Generated on ${format(new Date(), 'MMM dd, yyyy')}
            </div>
          </body>
        </html>`;
         
      let directory = 'Documents';
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        directory = 'Download';
      }
      
      const options = {
        html,
        fileName: `TripSync_${tripName.replace(/\s+/g, '_')}_${timestamp}`,
        directory: Platform.OS === 'ios' ? 'Documents' : directory,
        base64: false,
        height: 842,
        width: 595,
        padding: 30,
      };
      
      console.log('Generating PDF with options:', JSON.stringify(options));
      const pdf = await RNHTMLtoPDF.convert(options);
      console.log('PDF generated successfully at:', pdf.filePath);
      
      Alert.alert(
        'PDF Created Successfully',
        `PDF saved to: ${Platform.OS === 'android' ? 'Downloads folder' : 'Documents folder'}`,
        [
          { text: 'OK', style: 'default' }
        ]
      );
      
      return pdf.filePath;
    } catch (error) {
      console.error('PDF generation error:', error);
      throw error;
    }
  };

  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      console.log('Starting PDF export process');
      
      const permissionGranted = await requestStoragePermission();
      console.log('Permission result:', permissionGranted);
      
      if (!permissionGranted) {
        Alert.alert('Permission Required', 'Cannot export PDF without storage permissions.');
        return;
      }
      
      console.log('Generating PDF locally');
      await generatePdfLocally();
      
    } catch (error) {
      console.error('PDF export error:', error);
      Alert.alert('Error', `Failed to generate PDF: ${error.message || 'Unknown error'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const renderExpenseItem = ({ item }) => {
    const isUserInvolved = item.paidBy === currentUser?.email || item.splitWith.some(s => s.email === currentUser?.email);
    let userAmount = 0;
    if (currentUser) {
      if (item.paidBy === currentUser.email) {
        userAmount = item.splitWith.reduce((sum, s) => s.email !== currentUser.email ? sum + s.amount : sum, 0);
      } else {
        const userSplit = item.splitWith.find(s => s.email === currentUser.email);
        userAmount = userSplit ? -userSplit.amount : 0;
      }
    }
    return (
      <TouchableOpacity onPress={() => { setSelectedExpense(item); setExpenseModalVisible(true); }}>
        <Card style={styles.expenseCard}>
          <Card.Content style={styles.expenseCardContent}>
            <View style={styles.expenseDateCol}>
              <Text style={styles.expenseDate}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.expenseMainCol}>
              <Text style={styles.expenseDescription}>{item.description}</Text>
              <Text style={styles.expensePaidBy}>Paid by {item.paidBy === currentUser?.email ? 'you' : item.paidBy}</Text>
            </View>
            <View style={styles.expenseAmountCol}>
              <Text style={[styles.expenseAmount, userAmount > 0 ? styles.positive : styles.negative]}>
                {userAmount === 0 ? '-' : userAmount > 0 ? `+${formatCurrency(userAmount)}` : formatCurrency(userAmount)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderSummaryItem = ({ item }) => {
    const balance = balances[item.email] || { total: 0 };
    return (
      <Card style={styles.summaryCard}>
        <Card.Content style={styles.summaryCardContent}>
          <View style={styles.summaryUserInfo}>
            <Avatar.Text size={40} label={getInitials(item.email)} style={styles.summaryAvatar} />
            <Text style={styles.summaryUserEmail}>{item.email === currentUser?.email ? 'You' : item.email}</Text>
          </View>
          <Text style={[styles.summaryBalance, balance.total > 0 ? styles.positive : balance.total < 0 ? styles.negative : styles.neutral]}>
            {balance.total > 0 ? `Get back ${formatCurrency(balance.total)}` : balance.total < 0 ? `Owe ${formatCurrency(Math.abs(balance.total))}` : 'Settled'}
          </Text>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Trip Expenses" subtitle={tripName} />
        <Appbar.Action icon="file-export" onPress={exportToPDF} disabled={exportLoading} />
        {exportLoading && <ActivityIndicator color="#fff" size={20} />}
      </Appbar.Header>

      {loading && !expenses.length ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ea" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={fetchExpenses}>Retry</Button>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item._id}
          renderItem={renderExpenseItem}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No expenses yet</Text>
              <Text style={styles.emptySubText}>Tap + to add an expense</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <FAB style={styles.fab} icon="plus" onPress={() => setModalVisible(true)} />

      <Portal>
        <Modal visible={modalVisible} onDismiss={() => setModalVisible(false)} contentContainerStyle={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Title style={styles.modalTitle}>Add Expense</Title>
            <TextInput label="Description" value={description} onChangeText={setDescription} style={styles.input} mode="outlined" />
            <TextInput label="Amount" value={amount} onChangeText={setAmount} style={styles.input} mode="outlined" keyboardType="numeric" left={<TextInput.Affix text="$" />} />
            <Text style={styles.sectionTitle}>Paid by</Text>
            <RadioButton.Group onValueChange={setPaidBy} value={paidBy}>
              {participants.map(p => (
                <View key={p._id} style={styles.radioItem}>
                  <RadioButton value={p.email} />
                  <Text style={styles.radioLabel}>{p.email === currentUser?.email ? 'You' : p.email}</Text>
                </View>
              ))}
            </RadioButton.Group>
            <Divider style={styles.divider} />
            <Text style={styles.sectionTitle}>Split Options</Text>
            <RadioButton.Group onValueChange={setSplitType} value={splitType}>
              <View style={styles.radioItem}>
                <RadioButton value="equal" />
                <Text style={styles.radioLabel}>Split equally</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton value="full" />
                <Text style={styles.radioLabel}>Full amount each</Text>
              </View>
            </RadioButton.Group>
            <Divider style={styles.divider} />
            <View style={styles.splitWithHeader}>
              <Text style={styles.sectionTitle}>Split with</Text>
              <Button compact mode="text" onPress={selectAllParticipants}>Select All</Button>
            </View>
            {participants.map(p => (
              <View key={p._id} style={styles.checkboxItem}>
                <Checkbox status={splitWith.includes(p.email) ? 'checked' : 'unchecked'} onPress={() => toggleParticipantSelection(p.email)} />
                <Text style={styles.checkboxLabel}>{p.email === currentUser?.email ? 'You' : p.email}</Text>
              </View>
            ))}
            <View style={styles.modalButtonsContainer}>
              <Button mode="outlined" onPress={() => setModalVisible(false)} style={styles.modalButton}>Cancel</Button>
              <Button mode="contained" onPress={handleAddExpense} style={styles.modalButton} loading={loading}>Save</Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      <Portal>
        <Modal visible={expenseModalVisible} onDismiss={() => setExpenseModalVisible(false)} contentContainerStyle={styles.modalContainer}>
          {selectedExpense && (
            <ScrollView>
              <Title style={styles.modalTitle}>{selectedExpense.description}</Title>
              <View style={styles.expenseDetailItem}>
                <Text style={styles.expenseDetailLabel}>Amount:</Text>
                <Text style={styles.expenseDetailValue}>{formatCurrency(selectedExpense.amount)}</Text>
              </View>
              <View style={styles.expenseDetailItem}>
                <Text style={styles.expenseDetailLabel}>Date:</Text>
                <Text style={styles.expenseDetailValue}>{formatDate(selectedExpense.date)}</Text>
              </View>
              <View style={styles.expenseDetailItem}>
                <Text style={styles.expenseDetailLabel}>Paid by:</Text>
                <Text style={styles.expenseDetailValue}>{selectedExpense.paidBy === currentUser?.email ? 'You' : selectedExpense.paidBy}</Text>
              </View>
              <Divider style={styles.divider} />
              <Text style={styles.sectionTitle}>Split Details</Text>
              {selectedExpense.splitWith.map((split, index) => (
                <View key={index} style={styles.splitDetailItem}>
                  <Text style={styles.splitDetailEmail}>{split.email === currentUser?.email ? 'You' : split.email}</Text>
                  <Text style={styles.splitDetailAmount}>{formatCurrency(split.amount)}</Text>
                </View>
              ))}
              <Button mode="outlined" onPress={() => setExpenseModalVisible(false)} style={[styles.modalButton, { marginTop: 20 }]}>Close</Button>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      <Portal>
        <Modal visible={summaryVisible} onDismiss={() => setSummaryVisible(false)} contentContainerStyle={styles.modalContainer}>
          <ScrollView>
            <Title style={styles.modalTitle}>Balance Summary</Title>
            <FlatList
              data={participants}
              keyExtractor={item => item._id}
              renderItem={renderSummaryItem}
              scrollEnabled={false}
              ListHeaderComponent={<Text style={styles.summaryDescription}>Total owes and owed</Text>}
            />
            {currentUser && balances[currentUser.email] && (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.sectionTitle}>Your Balances</Text>
                {Object.keys(balances[currentUser.email].owes).length > 0 && (
                  <>
                    <Text style={styles.balanceSubtitle}>You owe:</Text>
                    {Object.entries(balances[currentUser.email].owes).map(([person, amount]) => (
                      <View key={`owe-${person}`} style={styles.balanceItem}>
                        <Text style={styles.balancePerson}>{person}</Text>
                        <Text style={[styles.balanceAmount, styles.negative]}>{formatCurrency(amount)}</Text>
                      </View>
                    ))}
                  </>
                )}
                {Object.keys(balances[currentUser.email].owed).length > 0 && (
                  <>
                    <Text style={styles.balanceSubtitle}>You are owed:</Text>
                    {Object.entries(balances[currentUser.email].owed).map(([person, amount]) => (
                      <View key={`owed-${person}`} style={styles.balanceItem}>
                        <Text style={styles.balancePerson}>{person}</Text>
                        <Text style={[styles.balanceAmount, styles.positive]}>{formatCurrency(amount)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
            <Button mode="outlined" onPress={() => setSummaryVisible(false)} style={[styles.modalButton, { marginTop: 20 }]}>Close</Button>
          </ScrollView>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: 'red', fontSize: 16, marginBottom: 16 },
  listContent: { padding: 16, paddingBottom: 80 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#6200ea' },
  modalContainer: { backgroundColor: 'white', padding: 20, margin: 20, borderRadius: 8, maxHeight: '80%' },
  modalTitle: { fontSize: 20, marginBottom: 16, textAlign: 'center' },
  input: { marginBottom: 16 },
  radioItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  radioLabel: { fontSize: 16 },
  checkboxItem: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  checkboxLabel: { fontSize: 16, marginLeft: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 8 },
  divider: { marginVertical: 16 },
  modalButtonsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  modalButton: { flex: 1, marginHorizontal: 4 },
  splitWithHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  expenseCard: { marginBottom: 8 },
  expenseCardContent: { flexDirection: 'row', alignItems: 'center' },
  expenseDateCol: { width: 60 },
  expenseMainCol: { flex: 1, paddingHorizontal: 8 },
  expenseAmountCol: { alignItems: 'flex-end' },
  expenseDate: { fontSize: 12, color: '#666' },
  expenseDescription: { fontSize: 16, fontWeight: 'bold' },
  expensePaidBy: { fontSize: 12, color: '#666', marginTop: 4 },
  expenseAmount: { fontSize: 16, fontWeight: 'bold' },
  positive: { color: '#4CAF50' },
  negative: { color: '#F44336' },
  neutral: { color: '#9E9E9E' },
  expenseDetailItem: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  expenseDetailLabel: { fontSize: 16, color: '#666' },
  expenseDetailValue: { fontSize: 16, fontWeight: 'bold' },
  splitDetailItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  splitDetailEmail: { fontSize: 14 },
  splitDetailAmount: { fontSize: 14, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#666' },
  emptySubText: { fontSize: 14, color: '#888', marginTop: 8 },
  summaryCard: { marginVertical: 4 },
  summaryCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryUserInfo: {flexDirection: 'row',alignItems: 'center',},
  summaryAvatar: {marginRight: 12,},
  summaryUserEmail: {fontSize: 16,},
  summaryBalance: {fontSize: 16,fontWeight: 'bold',},
  summaryDescription: { fontSize: 14,color: '#666',marginBottom: 12,fontStyle: 'italic',},
  balanceSubtitle: {fontSize: 16,fontWeight: 'bold',marginTop: 12,marginBottom: 8,},
  balanceItem: {flexDirection: 'row',justifyContent: 'space-between',paddingVertical: 6,borderBottomWidth: 1,borderBottomColor: '#f0f0f0',},
  balancePerson: {fontSize: 14,},
  balanceAmount: {fontSize: 14,fontWeight: 'bold',},
});

export default BillingScreen;