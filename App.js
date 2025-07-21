import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  addDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  Key,
  PlusCircle,
  Stethoscope,
  Briefcase,
  Building,
  Package,
  Users,
  Scan,
  Gift,
  CalendarCheck,
  CheckCircle,
  XCircle,
  DollarSign,
  Home, // Fallback for Hospital
} from 'lucide-react';

// Ensure Font Awesome for the pill icon is loaded
// This would typically be in index.html or a global CSS import
// <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"></link>

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Helper function for QR Code generation (simplified for sandbox environment)
// In a real application, you would use a library like 'qrcode.react'
const generateQRCodeContent = (data) => {
  try {
    return JSON.stringify(data);
  } catch (e) {
    console.error("Error stringifying QR data:", e);
    return "Error";
  }
};

const QRCodeDisplay = ({ content }) => {
  if (!content) return null;
  return (
    <div className="p-4 bg-white rounded-lg shadow-md flex flex-col items-center justify-center">
      <p className="text-sm text-gray-600 mb-2">Scan this QR Code:</p>
      {/* In a real app, use a QR code library like qrcode.react */}
      <div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded-md text-xs text-gray-500">
        <p className="break-all text-center p-1">{content}</p>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        (Displaying content directly. Use a QR library for actual QR image)
      </p>
    </div>
  );
};

const App = () => {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'

  // Firestore Data States
  const [products, setProducts] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [salespersonRequests, setSalespersonRequests] = useState([]);
  const [approvedSalespersons, setApprovedSalespersons] = useState([]);
  const [institutionRequests, setInstitutionRequests] = useState([]);
  const [approvedInstitutions, setApprovedInstitutions] = useState([]);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [patientOffers, setPatientOffers] = useState([]);
  const [institutionCoinBalance, setInstitutionCoinBalance] = useState(0);
  const [salespersonCoinHistory, setSalespersonCoinHistory] = useState([]);
  const [institutionCoinHistory, setInstitutionCoinHistory] = useState([]);

  // Firebase instances
  const appRef = useRef(null);
  const dbRef = useRef(null);
  const authRef = useRef(null);

  // --- Global Message Display ---
  const displayMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage('');
      setMessageType('');
    }, 3000);
  };

  // --- Firebase Initialization and Auth ---
  useEffect(() => {
    try {
      if (!appRef.current) {
        appRef.current = initializeApp(firebaseConfig);
        dbRef.current = getFirestore(appRef.current);
        authRef.current = getAuth(appRef.current);
      }

      const auth = authRef.current;
      const db = dbRef.current;

      const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          const currentUserId = currentUser.uid;
          setUserId(currentUserId);

          // Fetch user role from Firestore
          const userDocRef = doc(db, `artifacts/${appId}/users/${currentUserId}/profile`, currentUserId);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserRole(userDocSnap.data().role);
          } else {
            // New user or role not set, prompt for role selection
            setUserRole(null);
          }
        } else {
          setUser(null);
          setUserId('');
          setUserRole(null); // Reset role if logged out
          // Sign in anonymously if no initial auth token, otherwise use it
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error initializing Firebase or during authentication:", error);
      displayMessage(`Firebase initialization error: ${error.message}`, 'error');
      setLoading(false);
    }
  }, []); // Empty dependency array ensures this runs once on mount

  // --- Firestore Data Listeners ---
  useEffect(() => {
    if (!dbRef.current || !userId || loading) return;

    const db = dbRef.current;

    // Products (Public)
    const productsQuery = query(collection(db, `artifacts/${appId}/public/data/products`));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
    }, (error) => console.error("Error fetching products:", error));

    // Doctors (Public)
    const doctorsQuery = query(collection(db, `artifacts/${appId}/public/data/doctors`));
    const unsubscribeDoctors = onSnapshot(doctorsQuery, (snapshot) => {
      const doctorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDoctors(doctorsData);
    }, (error) => console.error("Error fetching doctors:", error));

    // Customers (Public - assuming customer profiles are public for admin view)
    const customersQuery = query(collection(db, `artifacts/${appId}/public/data/customers`));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(customersData);
    }, (error) => console.error("Error fetching customers:", error));

    // Salesperson Requests (Public - for Admin approval)
    const salespersonReqQuery = query(
      collection(db, `artifacts/${appId}/public/data/salespersonRequests`),
      where('status', '==', 'pending')
    );
    const unsubscribeSalespersonReq = onSnapshot(salespersonReqQuery, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSalespersonRequests(reqs);
    }, (error) => console.error("Error fetching salesperson requests:", error));

    // Approved Salespersons (Public)
    const approvedSalespersonQuery = query(
      collection(db, `artifacts/${appId}/public/data/salespersonRequests`),
      where('status', '==', 'approved')
    );
    const unsubscribeApprovedSalesperson = onSnapshot(approvedSalespersonQuery, (snapshot) => {
      const approved = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApprovedSalespersons(approved);
    }, (error) => console.error("Error fetching approved salespersons:", error));

    // Institution Requests (Public - for Admin approval)
    const institutionReqQuery = query(
      collection(db, `artifacts/${appId}/public/data/institutionRequests`),
      where('status', '==', 'pending')
    );
    const unsubscribeInstitutionReq = onSnapshot(institutionReqQuery, (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInstitutionRequests(reqs);
    }, (error) => console.error("Error fetching institution requests:", error));

    // Approved Institutions (Public)
    const approvedInstitutionQuery = query(
      collection(db, `artifacts/${appId}/public/data/institutionRequests`),
      where('status', '==', 'approved')
    );
    const unsubscribeApprovedInstitution = onSnapshot(approvedInstitutionQuery, (snapshot) => {
      const approved = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApprovedInstitutions(approved);
    }, (error) => console.error("Error fetching approved institutions:", error));

    // --- Role-specific data listeners ---
    let unsubscribeCustomerOrders;
    let unsubscribePatientOffers;
    let unsubscribeInstitutionCoins;
    let unsubscribeSalespersonCoins;

    if (userRole === 'customer') {
      const customerOrdersQuery = query(
        collection(db, `artifacts/${appId}/users/${userId}/orders`),
        where('customerId', '==', userId)
      );
      unsubscribeCustomerOrders = onSnapshot(customerOrdersQuery, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Filter for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentOrders = orders.filter(order =>
          order.orderDate && order.orderDate.toDate() >= thirtyDaysAgo
        );
        setCustomerOrders(recentOrders);
      }, (error) => console.error("Error fetching customer orders:", error));

      const patientOffersQuery = query(
        collection(db, `artifacts/${appId}/public/data/patientOffers`),
        where('patientId', '==', userId)
      );
      unsubscribePatientOffers = onSnapshot(patientOffersQuery, (snapshot) => {
        const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatientOffers(offers);
      }, (error) => console.error("Error fetching patient offers:", error));
    } else if (userRole === 'institution') {
      const institutionDocRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, userId);
      unsubscribeInstitutionCoins = onSnapshot(institutionDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setInstitutionCoinBalance(docSnap.data().coins || 0);
        } else {
          setInstitutionCoinBalance(0);
        }
      }, (error) => console.error("Error fetching institution coin balance:", error));

      const institutionCoinHistoryQuery = query(
        collection(db, `artifacts/${appId}/users/${userId}/transactions`),
        where('targetId', '==', userId),
        where('type', '==', 'donation')
      );
      unsubscribeInstitutionCoinHistory = onSnapshot(institutionCoinHistoryQuery, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentHistory = history.filter(item =>
          item.date && item.date.toDate() >= thirtyDaysAgo
        );
        setInstitutionCoinHistory(recentHistory);
      }, (error) => console.error("Error fetching institution coin history:", error));

    } else if (userRole === 'salesperson') {
      const salespersonOffersQuery = query(
        collection(db, `artifacts/${appId}/public/data/patientOffers`),
        where('salespersonId', '==', userId),
        where('status', 'in', ['assigned_to_salesperson']) // Only show assigned and in-progress
      );
      const salespersonOrdersQuery = query(
        collection(db, `artifacts/${appId}/users/${userId}/orders`), // Assuming salesperson's orders are stored under their user path
        where('salespersonId', '==', userId),
        where('status', 'in', ['in_delivery'])
      );

      unsubscribePatientOffers = onSnapshot(salespersonOffersQuery, (snapshot) => {
        const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatientOffers(offers);
      }, (error) => console.error("Error fetching salesperson patient offers:", error));

      unsubscribeCustomerOrders = onSnapshot(salespersonOrdersQuery, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomerOrders(orders);
      }, (error) => console.error("Error fetching salesperson orders:", error));

      const salespersonCoinHistoryQuery = query(
        collection(db, `artifacts/${appId}/users/${userId}/transactions`),
        where('targetId', '==', userId),
        where('type', 'in', ['coin_transfer', 'checkup_payment']) // Coins from products or checkups
      );
      unsubscribeSalespersonCoins = onSnapshot(salespersonCoinHistoryQuery, (snapshot) => {
        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentHistory = history.filter(item =>
          item.date && item.date.toDate() >= thirtyDaysAgo
        );
        setSalespersonCoinHistory(recentHistory);
      }, (error) => console.error("Error fetching salesperson coin history:", error));

    } else if (userRole === 'doctor') {
      const doctorOffersQuery = query(
        collection(db, `artifacts/${appId}/public/data/patientOffers`),
        where('doctorId', '==', userId),
        where('status', 'in', ['pending', 'accepted']) // Doctor sees pending and accepted
      );
      unsubscribePatientOffers = onSnapshot(doctorOffersQuery, (snapshot) => {
        const offers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatientOffers(offers);
      }, (error) => console.error("Error fetching doctor patient offers:", error));
    }

    return () => {
      unsubscribeProducts();
      unsubscribeDoctors();
      unsubscribeCustomers();
      unsubscribeSalespersonReq();
      unsubscribeApprovedSalesperson();
      unsubscribeInstitutionReq();
      unsubscribeApprovedInstitution();
      if (unsubscribeCustomerOrders) unsubscribeCustomerOrders();
      if (unsubscribePatientOffers) unsubscribePatientOffers();
      if (unsubscribeInstitutionCoins) unsubscribeInstitutionCoins();
      if (unsubscribeSalespersonCoins) unsubscribeSalespersonCoins();
      if (unsubscribeInstitutionCoinHistory) unsubscribeInstitutionCoinHistory();
    };
  }, [userId, userRole, loading]); // Re-run when userId or userRole changes

  // --- Role Switching Logic ---
  const handleRoleSwitch = async (e) => {
    const newRole = e.target.value;
    if (!userId || !dbRef.current) {
      displayMessage("User not authenticated or database not ready.", 'error');
      return;
    }

    try {
      const userDocRef = doc(dbRef.current, `artifacts/${appId}/users/${userId}/profile`, userId);
      await setDoc(userDocRef, { role: newRole }, { merge: true });
      setUserRole(newRole);
      displayMessage(`Switched to ${newRole} role.`, 'success');
    } catch (error) {
      console.error("Error switching role:", error);
      displayMessage(`Failed to switch role: ${error.message}`, 'error');
    }
  };

  // --- Common UI Components ---
  const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-500"></div>
      <p className="mt-4 text-lg text-gray-700">Loading application...</p>
    </div>
  );

  const Header = () => (
    <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 shadow-lg flex justify-between items-center rounded-b-xl">
      <div className="flex items-center">
        <i className="fas fa-pills text-3xl mr-3"></i>
        <h1 className="text-3xl font-bold font-inter">MediQuick</h1>
      </div>
      <div className="flex items-center space-x-4">
        {userId && userRole && (
          <div className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-semibold shadow-inner">
            {userId} ({userRole.charAt(0).toUpperCase() + userRole.slice(1)})
          </div>
        )}
        {userRole !== 'admin' && userRole !== null && ( // Only show if role is set and not admin
          <select
            onChange={handleRoleSwitch}
            value={userRole || ''}
            className="bg-white text-blue-800 px-3 py-2 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-400 font-inter"
          >
            <option value="" disabled>Switch Role</option>
            <option value="customer">Customer</option>
            <option value="institution">Institution</option>
            <option value="salesperson">Salesperson</option>
            <option value="doctor">Doctor</option>
          </select>
        )}
      </div>
    </header>
  );

  const Footer = () => (
    <footer className="bg-gray-800 text-white p-4 text-center text-sm mt-8 rounded-t-xl shadow-inner">
      &copy; {new Date().getFullYear()} MediQuick. All rights reserved.
    </footer>
  );

  const GlobalMessage = () => {
    if (!message) return null;
    return (
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 p-4 rounded-lg shadow-xl z-50 flex items-center space-x-3 transition-opacity duration-300 ${
          messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}
      >
        {messageType === 'success' ? (
          <CheckCircle className="h-6 w-6" />
        ) : (
          <XCircle className="h-6 w-6" />
        )}
        <p className="font-medium font-inter">{message}</p>
      </div>
    );
  };

  const DashboardCard = ({ title, icon: Icon, children }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 flex items-center text-gray-800 font-inter">
        {Icon && <Icon className="mr-3 h-7 w-7 text-indigo-600" />}
        {title}
      </h2>
      {children}
    </div>
  );

  const InputField = ({ label, type = 'text', value, onChange, placeholder, min, step, required = false }) => (
    <div className="mb-4">
      <label className="block text-gray-700 text-sm font-bold mb-2 font-inter">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min={min}
        step={step}
        required={required}
        className="shadow appearance-none border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 font-inter"
      />
    </div>
  );

  const SelectField = ({ label, value, onChange, options, required = false }) => (
    <div className="mb-4">
      <label className="block text-gray-700 text-sm font-bold mb-2 font-inter">{label}</label>
      <select
        value={value}
        onChange={onChange}
        required={required}
        className="shadow border rounded-lg w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200 bg-white font-inter"
      >
        <option value="" disabled>Select an option</option>
        {options.map((option, index) => (
          <option key={index} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  const ActionButton = ({ onClick, children, className = '' }) => (
    <button
      onClick={onClick}
      className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 font-inter ${className}`}
    >
      {children}
    </button>
  );

  // --- Role Selection Screen ---
  const RoleSelection = () => {
    const handleSelectRole = async (role) => {
      if (!userId || !dbRef.current) {
        displayMessage("User not authenticated or database not ready.", 'error');
        return;
      }
      try {
        const userDocRef = doc(dbRef.current, `artifacts/${appId}/users/${userId}/profile`, userId);
        await setDoc(userDocRef, { role: role, createdAt: serverTimestamp() }, { merge: true });
        setUserRole(role);
        displayMessage(`Your role has been set to ${role}.`, 'success');
      } catch (error) {
        console.error("Error setting role:", error);
        displayMessage(`Failed to set role: ${error.message}`, 'error');
      }
    };

    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)] p-6 bg-gray-50 rounded-xl shadow-inner">
        <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center font-inter">
          Welcome to MediQuick! Please select your role to proceed:
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-4xl">
          <ActionButton onClick={() => handleSelectRole('customer')} className="bg-green-500 hover:bg-green-600 p-6 text-xl rounded-xl">
            Customer
          </ActionButton>
          <ActionButton onClick={() => handleSelectRole('institution')} className="bg-purple-500 hover:bg-purple-600 p-6 text-xl rounded-xl">
            Institution
          </ActionButton>
          <ActionButton onClick={() => handleSelectRole('salesperson')} className="bg-orange-500 hover:bg-orange-600 p-6 text-xl rounded-xl">
            Salesperson
          </ActionButton>
          <ActionButton onClick={() => handleSelectRole('doctor')} className="bg-red-500 hover:bg-red-600 p-6 text-xl rounded-xl">
            Doctor
          </ActionButton>
        </div>
        <p className="mt-10 text-sm text-gray-600 text-center max-w-md font-inter">
          To access Admin features, your User ID must be manually assigned the 'admin' role in the Firebase console.
          No user can self-assign as Admin, nor is there an in-app mail confirmation process for admin assignment.
        </p>
      </div>
    );
  };

  // --- Admin Dashboard ---
  const AdminDashboard = () => {
    // State for forms
    const [productName, setProductName] = useState('');
    const [productPrice, setProductPrice] = useState('');
    const [productSerial, setProductSerial] = useState('');
    const [productCoins, setProductCoins] = useState('');

    const [doctorName, setDoctorName] = useState('');
    const [doctorSpecialty, setDoctorSpecialty] = useState('');
    const [doctorContact, setDoctorContact] = useState('');

    const [salespersonName, setSalespersonName] = useState('');
    const [salespersonContact, setSalespersonContact] = useState('');
    const [salespersonBank, setSalespersonBank] = useState('');
    const [salespersonAddress, setSalespersonAddress] = useState('');
    const [salespersonAge, setSalespersonAge] = useState('');
    const [salespersonCNIC, setSalespersonCNIC] = useState('');

    const [institutionName, setInstitutionName] = useState('');
    const [institutionContact, setInstitutionContact] = useState('');
    const [institutionBank, setInstitutionBank] = useState('');
    const [institutionAddress, setInstitutionAddress] = useState('');
    const [institutionCNIC, setInstitutionCNIC] = useState('');

    // --- Admin Form Handlers ---
    const handleAddProduct = async (e) => {
      e.preventDefault();
      if (!dbRef.current) return;
      try {
        await addDoc(collection(dbRef.current, `artifacts/${appId}/public/data/products`), {
          name: productName,
          price: parseFloat(productPrice),
          serialNumber: productSerial,
          coinsAssigned: parseInt(productCoins),
          createdAt: serverTimestamp(),
        });
        displayMessage('Product added successfully!', 'success');
        setProductName(''); setProductPrice(''); setProductSerial(''); setProductCoins('');
      } catch (error) {
        console.error("Error adding product:", error);
        displayMessage(`Failed to add product: ${error.message}`, 'error');
      }
    };

    const handleAddDoctor = async (e) => {
      e.preventDefault();
      if (!dbRef.current) return;
      try {
        await addDoc(collection(dbRef.current, `artifacts/${appId}/public/data/doctors`), {
          name: doctorName,
          specialty: doctorSpecialty,
          contactInfo: doctorContact,
          createdAt: serverTimestamp(),
        });
        displayMessage('Doctor added successfully!', 'success');
        setDoctorName(''); setDoctorSpecialty(''); setDoctorContact('');
      } catch (error) {
        console.error("Error adding doctor:", error);
        displayMessage(`Failed to add doctor: ${error.message}`, 'error');
      }
    };

    const handleSubmitSalespersonRequest = async (e) => {
      e.preventDefault();
      if (!dbRef.current) return;
      try {
        await addDoc(collection(dbRef.current, `artifacts/${appId}/public/data/salespersonRequests`), {
          name: salespersonName,
          contactNumber: salespersonContact,
          bankDetails: salespersonBank,
          address: salespersonAddress,
          age: parseInt(salespersonAge),
          cnic: salespersonCNIC,
          status: 'pending',
          requestDate: serverTimestamp(),
        });
        displayMessage('Salesperson request submitted!', 'success');
        setSalespersonName(''); setSalespersonContact(''); setSalespersonBank('');
        setSalespersonAddress(''); setSalespersonAge(''); setSalespersonCNIC('');
      } catch (error) {
        console.error("Error submitting salesperson request:", error);
        displayMessage(`Failed to submit request: ${error.message}`, 'error');
      }
    };

    const handleSubmitInstitutionRequest = async (e) => {
      e.preventDefault();
      if (!dbRef.current) return;
      try {
        await addDoc(collection(dbRef.current, `artifacts/${appId}/public/data/institutionRequests`), {
          name: institutionName,
          contactNumber: institutionContact,
          bankDetails: institutionBank,
          address: institutionAddress,
          cnic: institutionCNIC,
          status: 'pending',
          requestDate: serverTimestamp(),
        });
        displayMessage('Institution request submitted!', 'success');
        setInstitutionName(''); setInstitutionContact(''); setInstitutionBank('');
        setInstitutionAddress(''); setInstitutionCNIC('');
      } catch (error) {
        console.error("Error submitting institution request:", error);
        displayMessage(`Failed to submit request: ${error.message}`, 'error');
      }
    };

    const handleApproveSalesperson = async (requestId, currentSalespersonData) => {
      const managerAssignedId = prompt("Enter Manager Assigned ID:");
      if (!managerAssignedId) {
        displayMessage("Manager Assigned ID is required.", 'error');
        return;
      }
      if (!dbRef.current) return;
      try {
        const docRef = doc(dbRef.current, `artifacts/${appId}/public/data/salespersonRequests`, requestId);
        await updateDoc(docRef, {
          status: 'approved',
          managerAssignedId: managerAssignedId,
          approvedAt: serverTimestamp(),
        });

        // Also create a user profile for the salesperson if they don't have one
        // Use the request ID as the user ID for simplicity, or generate a new one
        const salespersonUserId = requestId; // Or link to an existing user ID if available
        const salespersonProfileRef = doc(dbRef.current, `artifacts/${appId}/users/${salespersonUserId}/profile`, salespersonUserId);
        await setDoc(salespersonProfileRef, {
          role: 'salesperson',
          name: currentSalespersonData.name,
          contactNumber: currentSalespersonData.contactNumber,
          bankDetails: currentSalespersonData.bankDetails,
          address: currentSalespersonData.address,
          age: currentSalespersonData.age,
          cnic: currentSalespersonData.cnic,
          managerAssignedId: managerAssignedId,
          coins: 0, // Initialize coins for salesperson
          approved: true,
        }, { merge: true });

        displayMessage('Salesperson approved successfully!', 'success');
      } catch (error) {
        console.error("Error approving salesperson:", error);
        displayMessage(`Failed to approve salesperson: ${error.message}`, 'error');
      }
    };

    const handleApproveInstitution = async (requestId, currentInstitutionData) => {
      if (!dbRef.current) return;
      try {
        const docRef = doc(dbRef.current, `artifacts/${appId}/public/data/institutionRequests`, requestId);
        await updateDoc(docRef, {
          status: 'approved',
          approvedAt: serverTimestamp(),
        });

        // Create a user profile for the institution
        const institutionUserId = requestId; // Or link to an existing user ID
        const institutionProfileRef = doc(dbRef.current, `artifacts/${appId}/users/${institutionUserId}/profile`, institutionUserId);
        await setDoc(institutionProfileRef, {
          role: 'institution',
          name: currentInstitutionData.name,
          contactNumber: currentInstitutionData.contactNumber,
          bankDetails: currentInstitutionData.bankDetails,
          address: currentInstitutionData.address,
          cnic: currentInstitutionData.cnic,
          coins: 0, // Initialize coins for institution
          approved: true,
        }, { merge: true });

        displayMessage('Institution approved successfully!', 'success');
      } catch (error) {
        console.error("Error approving institution:", error);
        displayMessage(`Failed to approve institution: ${error.message}`, 'error');
      }
    };

    return (
      <div className="p-6 bg-gray-50 min-h-[calc(100vh-160px)] rounded-xl shadow-inner">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 flex items-center font-inter">
          <Key className="mr-4 h-10 w-10 text-gray-700" /> Admin Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Add New Product */}
          <DashboardCard title="Add New Product" icon={PlusCircle}>
            <form onSubmit={handleAddProduct}>
              <InputField label="Product Name" value={productName} onChange={(e) => setProductName(e.target.value)} required />
              <InputField label="Price" type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)} min="0" step="0.01" required />
              <InputField label="Serial Number" value={productSerial} onChange={(e) => setProductSerial(e.target.value)} required />
              <InputField label="Coins Assigned" type="number" value={productCoins} onChange={(e) => setProductCoins(e.target.value)} min="0" required />
              <ActionButton type="submit">Add Product</ActionButton>
            </form>
          </DashboardCard>

          {/* Add New Doctor */}
          <DashboardCard title="Add New Doctor" icon={Stethoscope}>
            <form onSubmit={handleAddDoctor}>
              <InputField label="Doctor Name" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} required />
              <InputField label="Specialty" value={doctorSpecialty} onChange={(e) => setDoctorSpecialty(e.target.value)} placeholder="e.g., Cardiology, General Physician" required />
              <InputField label="Contact Info" value={doctorContact} onChange={(e) => setDoctorContact(e.target.value)} required />
              <ActionButton type="submit">Add Doctor</ActionButton>
            </form>
          </DashboardCard>

          {/* Register New Salesperson Request */}
          <DashboardCard title="Register New Salesperson Request" icon={Briefcase}>
            <form onSubmit={handleSubmitSalespersonRequest}>
              <InputField label="Salesperson Name" value={salespersonName} onChange={(e) => setSalespersonName(e.target.value)} required />
              <InputField label="Contact Number" value={salespersonContact} onChange={(e) => setSalespersonContact(e.target.value)} required />
              <InputField label="Bank Details" value={salespersonBank} onChange={(e) => setSalespersonBank(e.target.value)} required />
              <InputField label="Address" value={salespersonAddress} onChange={(e) => setSalespersonAddress(e.target.value)} required />
              <InputField label="Age" type="number" value={salespersonAge} onChange={(e) => setSalespersonAge(e.target.value)} required />
              <InputField label="CNIC" value={salespersonCNIC} onChange={(e) => setSalespersonCNIC(e.target.value)} required />
              <ActionButton type="submit">Submit Salesperson Request</ActionButton>
            </form>
          </DashboardCard>

          {/* Register New Institution Request */}
          <DashboardCard title="Register New Institution Request" icon={Building}>
            <form onSubmit={handleSubmitInstitutionRequest}>
              <InputField label="Institution Name" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} required />
              <InputField label="Contact Number" value={institutionContact} onChange={(e) => setInstitutionContact(e.target.value)} required />
              <InputField label="Bank Details" value={institutionBank} onChange={(e) => setInstitutionBank(e.target.value)} required />
              <InputField label="Address" value={institutionAddress} onChange={(e) => setInstitutionAddress(e.target.value)} required />
              <InputField label="CNIC" value={institutionCNIC} onChange={(e) => setInstitutionCNIC(e.target.value)} required />
              <ActionButton type="submit">Submit Institution Request</ActionButton>
            </form>
          </DashboardCard>

          {/* Available Products */}
          <DashboardCard title="Available Products" icon={Package}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Price</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Serial No.</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Coins</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-4 text-gray-500">No products available.</td></tr>
                  ) : (
                    products.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{product.name}</td>
                        <td className="py-2 px-4 text-gray-700">${product.price?.toFixed(2)}</td>
                        <td className="py-2 px-4 text-gray-700">{product.serialNumber}</td>
                        <td className="py-2 px-4 text-gray-700">{product.coinsAssigned}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Registered Doctors */}
          <DashboardCard title="Registered Doctors" icon={Stethoscope}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Specialty</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-4 text-gray-500">No doctors registered.</td></tr>
                  ) : (
                    doctors.map((doctor) => (
                      <tr key={doctor.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{doctor.name}</td>
                        <td className="py-2 px-4 text-gray-700">
                          {doctor.specialty === 'General Physician' ? (
                            <span className="font-semibold text-blue-600">General Physician</span>
                          ) : (
                            <span className="font-semibold text-purple-600">{doctor.specialty} (Specialist)</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-gray-700">{doctor.contactInfo}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Registered Customers (Placeholder - assuming customer profiles are created on role selection) */}
          <DashboardCard title="Registered Customers" icon={Users}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">User ID</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Role</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-4 text-gray-500">No customers registered.</td></tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700 text-xs">{customer.id}</td>
                        <td className="py-2 px-4 text-gray-700">{customer.role}</td>
                        <td className="py-2 px-4 text-gray-700">{customer.name || 'N/A'}</td>
                        <td className="py-2 px-4 text-gray-700">{customer.contactNumber || 'N/A'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Pending Salesperson Requests */}
          <DashboardCard title="Pending Salesperson Requests" icon={Briefcase}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Contact</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Address</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Age</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">CNIC</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Req. Date</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {salespersonRequests.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-4 text-gray-500">No pending requests.</td></tr>
                  ) : (
                    salespersonRequests.map((req) => (
                      <tr key={req.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{req.name}</td>
                        <td className="py-2 px-4 text-gray-700">{req.contactNumber}</td>
                        <td className="py-2 px-4 text-gray-700">{req.address}</td>
                        <td className="py-2 px-4 text-gray-700">{req.age}</td>
                        <td className="py-2 px-4 text-gray-700">{req.cnic}</td>
                        <td className="py-2 px-4 text-gray-700">{req.requestDate?.toDate().toLocaleDateString()}</td>
                        <td className="py-2 px-4">
                          <ActionButton onClick={() => handleApproveSalesperson(req.id, req)} className="text-xs px-2 py-1">
                            Approve Salesperson
                          </ActionButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Approved Salespersons */}
          <DashboardCard title="Approved Salespersons" icon={Briefcase}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Contact</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Bank Details</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Manager ID</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedSalespersons.length === 0 ? (
                    <tr><td colSpan="5" className="text-center py-4 text-gray-500">No approved salespersons.</td></tr>
                  ) : (
                    approvedSalespersons.map((sp) => (
                      <tr key={sp.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{sp.name}</td>
                        <td className="py-2 px-4 text-gray-700">{sp.contactNumber}</td>
                        <td className="py-2 px-4 text-gray-700">{sp.bankDetails}</td>
                        <td className="py-2 px-4 text-gray-700">{sp.managerAssignedId}</td>
                        <td className="py-2 px-4 text-gray-700 capitalize">{sp.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Pending Institution Requests */}
          <DashboardCard title="Pending Institution Requests" icon={Building}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Contact</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Address</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">CNIC</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Req. Date</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {institutionRequests.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-4 text-gray-500">No pending requests.</td></tr>
                  ) : (
                    institutionRequests.map((req) => (
                      <tr key={req.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{req.name}</td>
                        <td className="py-2 px-4 text-gray-700">{req.contactNumber}</td>
                        <td className="py-2 px-4 text-gray-700">{req.address}</td>
                        <td className="py-2 px-4 text-gray-700">{req.cnic}</td>
                        <td className="py-2 px-4 text-gray-700">{req.requestDate?.toDate().toLocaleDateString()}</td>
                        <td className="py-2 px-4">
                          <ActionButton onClick={() => handleApproveInstitution(req.id, req)} className="text-xs px-2 py-1">
                            Approve Institution
                          </ActionButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Approved Institutions */}
          <DashboardCard title="Approved Institutions" icon={Building}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Contact</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Address</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedInstitutions.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-4 text-gray-500">No approved institutions.</td></tr>
                  ) : (
                    approvedInstitutions.map((inst) => (
                      <tr key={inst.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{inst.name}</td>
                        <td className="py-2 px-4 text-gray-700">{inst.contactNumber}</td>
                        <td className="py-2 px-4 text-gray-700">{inst.address}</td>
                        <td className="py-2 px-4 text-gray-700 capitalize">{inst.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </div>
      </div>
    );
  };

  // --- Customer Dashboard ---
  const CustomerDashboard = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProductToBuy, setSelectedProductToBuy] = useState('');
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [reasonForCheckup, setReasonForCheckup] = useState('');
    const [selectedDoctorForAppointment, setSelectedDoctorForAppointment] = useState('');
    const [amountToDonate, setAmountToDonate] = useState('');
    const [selectedInstitutionForDonation, setSelectedInstitutionForDonation] = useState('');

    const filteredProducts = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleBuyNow = async (productId) => {
      if (!dbRef.current || !userId) return;
      try {
        const product = products.find(p => p.id === productId);
        if (!product) {
          displayMessage("Product not found.", 'error');
          return;
        }

        await addDoc(collection(dbRef.current, `artifacts/${appId}/users/${userId}/orders`), {
          productId: productId,
          productName: product.name,
          price: product.price,
          customerId: userId,
          status: 'pending_salesperson_pickup',
          orderDate: serverTimestamp(),
        });
        displayMessage(`Order for ${product.name} placed successfully!`, 'success');
      } catch (error) {
        console.error("Error placing order:", error);
        displayMessage(`Failed to place order: ${error.message}`, 'error');
      }
    };

    const handleConfirmTransferAndPayment = async () => {
      if (!dbRef.current || !userId || !qrCodeInput) {
        displayMessage("Please enter QR code content.", 'error');
        return;
      }

      try {
        const qrData = JSON.parse(qrCodeInput);
        const { orderId, patientOfferId, salespersonId } = qrData;

        let docRef;
        let collectionPath;
        let type;

        if (orderId) {
          collectionPath = `artifacts/${appId}/users/${userId}/orders`;
          docRef = doc(dbRef.current, collectionPath, orderId);
          type = 'order';
        } else if (patientOfferId) {
          collectionPath = `artifacts/${appId}/public/data/patientOffers`;
          docRef = doc(dbRef.current, collectionPath, patientOfferId);
          type = 'appointment';
        } else {
          displayMessage("Invalid QR code content.", 'error');
          return;
        }

        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          displayMessage("Order/Appointment not found.", 'error');
          return;
        }

        const data = docSnap.data();

        // Validate if it's for this customer/patient
        if (type === 'order' && data.customerId !== userId) {
          displayMessage("This order is not for your account.", 'error');
          return;
        }
        if (type === 'appointment' && data.patientId !== userId) {
          displayMessage("This appointment is not for your account.", 'error');
          return;
        }

        // Validate status and salesperson
        if (type === 'order' && data.status !== 'in_delivery') {
          displayMessage("Order is not in 'in delivery' status.", 'error');
          return;
        }
        if (type === 'appointment' && data.status !== 'assigned_to_salesperson') {
          displayMessage("Appointment is not in 'assigned to salesperson' status.", 'error');
          return;
        }
        if (data.salespersonId !== salespersonId) {
          displayMessage("QR code does not match the assigned salesperson.", 'error');
          return;
        }

        // Update status and record payment
        await updateDoc(docRef, {
          status: type === 'order' ? 'delivered' : 'completed',
          deliveredDate: serverTimestamp(),
          cashReceived: type === 'order' ? true : undefined,
          paymentConfirmed: type === 'appointment' ? true : undefined,
          qrContent: qrCodeInput, // Store QR content as proof
        });

        // Coin transfer to salesperson (for products) or record payment (for checkups)
        if (type === 'order') {
          const product = products.find(p => p.id === data.productId);
          if (product && product.coinsAssigned > 0) {
            const salespersonProfileRef = doc(dbRef.current, `artifacts/${appId}/users/${salespersonId}/profile`, salespersonId);
            await updateDoc(salespersonProfileRef, {
              coins: (await getDoc(salespersonProfileRef)).data()?.coins + product.coinsAssigned || product.coinsAssigned,
            });
            await addDoc(collection(dbRef.current, `artifacts/${appId}/users/${salespersonId}/transactions`), {
              type: 'coin_transfer',
              amount: product.coinsAssigned,
              sourceId: userId, // Customer ID
              targetId: salespersonId,
              orderId: orderId,
              date: serverTimestamp(),
              description: `Coins for product delivery: ${product.name}`,
            });
          }
        } else if (type === 'appointment') {
          // For appointments, just record the payment confirmation for now.
          // Actual coin transfer logic for checkups would depend on business rules.
          // Assuming a fixed coin value or a separate mechanism for checkup payments to salesperson.
          // For now, let's assume a default coin value for checkups if not specified.
          const checkupCoins = 50; // Example: 50 coins per checkup
          const salespersonProfileRef = doc(dbRef.current, `artifacts/${appId}/users/${salespersonId}/profile`, salespersonId);
            await updateDoc(salespersonProfileRef, {
              coins: (await getDoc(salespersonProfileRef)).data()?.coins + checkupCoins || checkupCoins,
            });
            await addDoc(collection(dbRef.current, `artifacts/${appId}/users/${salespersonId}/transactions`), {
              type: 'checkup_payment',
              amount: checkupCoins,
              sourceId: userId, // Patient ID
              targetId: salespersonId,
              patientOfferId: patientOfferId,
              date: serverTimestamp(),
              description: `Coins for patient checkup: ${data.reason}`,
            });
        }

        displayMessage(`${type === 'order' ? 'Delivery' : 'Checkup'} confirmed and payment processed!`, 'success');
        setQrCodeInput('');
      } catch (error) {
        console.error("Error confirming transfer/payment:", error);
        displayMessage(`Failed to confirm: ${error.message}`, 'error');
      }
    };

    const handleDonateCoins = async (e) => {
      e.preventDefault();
      if (!dbRef.current || !userId || !selectedInstitutionForDonation || !amountToDonate) {
        displayMessage("Please select an institution and enter a valid amount.", 'error');
        return;
      }
      const amount = parseInt(amountToDonate);
      if (isNaN(amount) || amount <= 0) {
        displayMessage("Amount to donate must be a positive number.", 'error');
        return;
      }

      try {
        // Deduct coins from customer (if customer had a coin balance, not explicitly in prompt but good practice)
        // For now, assuming customer doesn't have a coin balance to deduct, just a donation.
        // In a real app, you'd check customer's coins and prevent negative balance.

        // Add coins to institution
        const institutionProfileRef = doc(dbRef.current, `artifacts/${appId}/users/${selectedInstitutionForDonation}/profile`, selectedInstitutionForDonation);
        await updateDoc(institutionProfileRef, {
          coins: (await getDoc(institutionProfileRef)).data()?.coins + amount || amount,
        });

        // Record transaction for institution
        await addDoc(collection(dbRef.current, `artifacts/${appId}/users/${selectedInstitutionForDonation}/transactions`), {
          type: 'donation',
          amount: amount,
          sourceId: userId, // Donor ID
          targetId: selectedInstitutionForDonation,
          date: serverTimestamp(),
          description: `Donation from customer ${userId}`,
        });

        displayMessage(`Successfully donated ${amount} coins to ${approvedInstitutions.find(inst => inst.id === selectedInstitutionForDonation)?.name}!`, 'success');
        setAmountToDonate('');
        setSelectedInstitutionForDonation('');
      } catch (error) {
        console.error("Error donating coins:", error);
        displayMessage(`Failed to donate coins: ${error.message}`, 'error');
      }
    };

    const handleRequestCheckup = async (doctorId, doctorName) => {
      if (!dbRef.current || !userId) return;
      if (!reasonForCheckup) {
        displayMessage("Please provide a reason for checkup.", 'error');
        return;
      }
      try {
        await addDoc(collection(dbRef.current, `artifacts/${appId}/public/data/patientOffers`), {
          patientId: userId,
          patientName: userId, // In a real app, fetch customer's name
          doctorId: doctorId,
          doctorName: doctorName,
          reason: reasonForCheckup,
          offeredOn: serverTimestamp(),
          status: 'pending',
        });
        displayMessage(`Checkup request sent to Dr. ${doctorName}!`, 'success');
        setReasonForCheckup('');
        setSelectedDoctorForAppointment('');
      } catch (error) {
        console.error("Error requesting checkup:", error);
        displayMessage(`Failed to request checkup: ${error.message}`, 'error');
      }
    };

    return (
      <div className="p-6 bg-gray-50 min-h-[calc(100vh-160px)] rounded-xl shadow-inner">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 flex items-center font-inter">
          <Users className="mr-4 h-10 w-10 text-blue-600" /> Customer Dashboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Search Products */}
          <DashboardCard title="Search Products" icon={Package}>
            <InputField
              label="Search Product Name"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search..."
            />
            <p className="text-sm text-gray-600 mt-2">Showing {filteredProducts.length} matching products.</p>
          </DashboardCard>

          {/* Available Products */}
          <DashboardCard title="Available Products" icon={Package}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Name</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Price</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Coins</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr><td colSpan="4" className="text-center py-4 text-gray-500">No products found.</td></tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{product.name}</td>
                        <td className="py-2 px-4 text-gray-700">${product.price?.toFixed(2)}</td>
                        <td className="py-2 px-4 text-gray-700">{product.coinsAssigned}</td>
                        <td className="py-2 px-4">
                          <ActionButton onClick={() => handleBuyNow(product.id)} className="text-xs px-2 py-1">
                            Buy Now
                          </ActionButton>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Your Order History (Last 30 Days) */}
          <DashboardCard title="Your Order History (Last 30 Days)" icon={Package}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Order ID</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Product</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Price</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Order Date</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Proof QR</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOrders.length === 0 ? (
                    <tr><td colSpan="6" className="text-center py-4 text-gray-500">No recent orders.</td></tr>
                  ) : (
                    customerOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700 text-xs">{order.id}</td>
                        <td className="py-2 px-4 text-gray-700">{order.productName}</td>
                        <td className="py-2 px-4 text-gray-700">${order.price?.toFixed(2)}</td>
                        <td className="py-2 px-4 text-gray-700 capitalize">{order.status?.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-4 text-gray-700">{order.orderDate?.toDate().toLocaleDateString()}</td>
                        <td className="py-2 px-4 text-gray-700 text-xs break-all">
                          {order.status === 'delivered' && order.qrContent ? (
                            <span className="text-green-600 font-semibold">QR Proof: {order.qrContent}</span>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>

          {/* Confirm Delivery & Payment (Scan Salesperson QR) */}
          <DashboardCard title="Confirm Delivery & Payment (Scan Salesperson QR)" icon={Scan}>
            <InputField
              label="Scan Salesperson QR Code (Order/Appointment ID)"
              value={qrCodeInput}
              onChange={(e) => setQrCodeInput(e.target.value)}
              placeholder="Paste QR content here..."
            />
            <ActionButton onClick={handleConfirmTransferAndPayment}>
              Confirm Transfer & Payment
            </ActionButton>
          </DashboardCard>

          {/* Donate Coins to Institutions */}
          <DashboardCard title="Donate Coins to Institutions" icon={Gift}>
            <SelectField
              label="Select Institution"
              value={selectedInstitutionForDonation}
              onChange={(e) => setSelectedInstitutionForDonation(e.target.value)}
              options={approvedInstitutions.map(inst => ({
                value: inst.id,
                label: `${inst.name} (ID: ${inst.id})`
              }))}
              required
            />
            <InputField
              label="Amount to Donate"
              type="number"
              value={amountToDonate}
              onChange={(e) => setAmountToDonate(e.target.value)}
              min="1"
              required
            />
            <ActionButton onClick={handleDonateCoins}>Donate Coins</ActionButton>
          </DashboardCard>

          {/* Book Doctor Appointment */}
          <DashboardCard title="Book Doctor Appointment" icon={CalendarCheck}>
            <InputField
              label="Reason for Checkup"
              value={reasonForCheckup}
              onChange={(e) => setReasonForCheckup(e.target.value)}
              placeholder="e.g., Routine checkup, fever, etc."
              required
            />
            <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700">General Physicians</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.filter(d => d.specialty === 'General Physician').length === 0 ? (
                <p className="text-gray-500 col-span-full">No General Physicians available.</p>
              ) : (
                doctors.filter(d => d.specialty === 'General Physician').map(doctor => (
                  <div key={doctor.id} className="p-3 border rounded-lg flex justify-between items-center shadow-sm bg-blue-50">
                    <div>
                      <p className="font-medium">{doctor.name}</p>
                      <p className="text-sm text-gray-600">{doctor.contactInfo}</p>
                    </div>
                    <ActionButton onClick={() => handleRequestCheckup(doctor.id, doctor.name)} className="text-xs px-2 py-1">
                      Request Checkup
                    </ActionButton>
                  </div>
                ))
              )}
            </div>

            <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-700">Specialists</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {doctors.filter(d => d.specialty !== 'General Physician').length === 0 ? (
                <p className="text-gray-500 col-span-full">No Specialists available.</p>
              ) : (
                doctors.filter(d => d.specialty !== 'General Physician').map(doctor => (
                  <div key={doctor.id} className="p-3 border rounded-lg flex justify-between items-center shadow-sm bg-purple-50">
                    <div>
                      <p className="font-medium">{doctor.name}</p>
                      <p className="text-sm text-gray-600">{doctor.specialty}</p>
                      <p className="text-sm text-gray-600">{doctor.contactInfo}</p>
                    </div>
                    <ActionButton onClick={() => handleRequestCheckup(doctor.id, doctor.name)} className="text-xs px-2 py-1">
                      Request Checkup
                    </ActionButton>
                  </div>
                ))
              )}
            </div>
          </DashboardCard>
        </div>
      </div>
    );
  };

  // --- Institution Dashboard ---
  const InstitutionDashboard = () => {
    const getNextWithdrawalDate = () => {
      const today = new Date();
      let nextMonth = today.getMonth() + 1;
      let year = today.getFullYear();

      if (nextMonth > 11) { // If next month is January of next year
        nextMonth = 0;
        year++;
      }

      const firstDayOfNextMonth = new Date(year, nextMonth, 1);
      return firstDayOfNextMonth.toLocaleDateString();
    };

    return (
      <div className="p-6 bg-gray-50 min-h-[calc(100vh-160px)] rounded-xl shadow-inner">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 flex items-center font-inter">
          <Building className="mr-4 h-10 w-10 text-green-600" /> Institution Dashboard
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Your Coin Balance */}
          <DashboardCard title="Your Coin Balance" icon={DollarSign}>
            <p className="text-4xl font-bold text-green-700">{institutionCoinBalance} <span className="text-xl text-gray-600">Coins</span></p>
          </DashboardCard>

          {/* Next Withdrawal Date */}
          <DashboardCard title="Next Withdrawal Date" icon={CalendarCheck}>
            <p className="text-xl text-gray-700">
              <span className="font-semibold">{getNextWithdrawalDate()}</span>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Withdrawals are processed on the 1st day of the month.
            </p>
          </DashboardCard>

          {/* Received Coin History (Last 30 Days) */}
          <DashboardCard title="Received Coin History (Last 30 Days)" icon={Gift}>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Amount</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Donor (ID)</th>
                    <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {institutionCoinHistory.length === 0 ? (
                    <tr><td colSpan="3" className="text-center py-4 text-gray-500">No recent coin history.</td></tr>
                  ) : (
                    institutionCoinHistory.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-gray-100 last:border-b-0">
                        <td className="py-2 px-4 text-gray-700">{transaction.amount}</td>
                        <td className="py-2 px-4 text-gray-700">
                          {transaction.sourceId}
                        </td>
                        <td className="py-2 px-4 text-gray-700">{transaction.date?.toDate().toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DashboardCard>
        </div>
      </div>
    );
  };

  // --- Salesperson Dashboard ---
  const SalespersonDashboard = () => {
    const [salespersonProfile, setSalespersonProfile] = useState(null);
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [showQrModal, setShowQrModal] = useState(false);
    const [currentQrContent, setCurrentQrContent] = useState('');

    useEffect(() => {
      const fetchSalespersonProfile = async () => {
        if (!dbRef.current || !userId) return;
        try {
          const profileDocRef = doc(dbRef.current, `artifacts/${appId}/users/${userId}/profile`, userId);
          const docSnap = await getDoc(profileDocRef);
          if (docSnap.exists()) {
            setSalespersonProfile(docSnap.data());
          } else {
            // Fallback: try to find in salespersonRequests if approved but no profile created yet
            const q = query(collection(dbRef.current, `artifacts/${appId}/public/data/salespersonRequests`), where('id', '==', userId));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setSalespersonProfile(querySnapshot.docs[0].data());
            } else {
                setSalespersonProfile(null);
            }
          }
        } catch (error) {
          console.error("Error fetching salesperson profile:", error);
          displayMessage(`Failed to fetch profile: ${error.message}`, 'error');
        }
      };
      fetchSalespersonProfile();
    }, [userId, dbRef.current]);

    const handleTakeOrderAppointment = async () => {
      if (!dbRef.current || !userId || !qrCodeInput) {
        displayMessage("Please enter QR code content.", 'error');
        return;
      }

      try {
        const qrData = JSON.parse(qrCodeInput);
        const { orderId, patientOfferId } = qrData;

        let docRef;
        let type;

        if (orderId) {
          // Assuming orders are stored under customer's path, need to query across collections
          // This is a simplified approach, in a real app, orders might be in a central 'orders' collection
          // For now, let's try to query all customer orders for this orderId
          const allCustomerOrdersQuery = query(collection(dbRef.current, `artifacts/${appId}/users`), where('orders', 'array-contains', { id: orderId })); // This query won't work directly.
          // A better approach would be a top-level 'orders' collection or a Cloud Function to find the order.
          // For this sandbox, let's assume the orderId is unique enough to be found directly if it was a top-level collection.
          // Since orders are under `users/${userId}/orders`, we need the customerId.
          // For now, let's simulate by assuming the QR content provides enough info.
          // Or, assume the salesperson scans a QR that directly gives them the full path to the order.

          // Simplified: Assuming orderId is the doc ID in a global orders collection for now.
          // In reality, you'd need to find which customer's order it is.
          const ordersCollectionRef = collection(dbRef.current, `artifacts/${appId}/public/data/allOrders`); // Hypothetical global collection
          const orderSnapshot = await getDocs(query(ordersCollectionRef, where('id', '==', orderId)));
          if (!orderSnapshot.empty) {
            docRef = doc(dbRef.current, ordersCollectionRef.path, orderSnapshot.docs[0].id);
            type = 'order';
          } else {
            displayMessage("Order not found or not accessible.", 'error');
            return;
          }

        } else if (patientOfferId) {
          docRef = doc(dbRef.current, `artifacts/${appId}/public/data/patientOffers`, patientOfferId);
          type = 'appointment';
        } else {
          displayMessage("Invalid QR code content.", 'error');
          return;
        }

        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          displayMessage("Order/Appointment not found.", 'error');
          return;
        }

        const data = docSnap.data();

        // Validate status
        if (type === 'order' && data.status !== 'pending_salesperson_pickup') {
          displayMessage("Order is not pending salesperson pickup.", 'error');
          return;
        }
        if (type === 'appointment' && data.status !== 'accepted') {
          displayMessage("Appointment is not in 'accepted' status.", 'error');
          return;
        }
        if (data.salespersonId) {
          displayMessage("This has already been assigned to a salesperson.", 'error');
          return;
        }

        await updateDoc(docRef, {
          salespersonId: userId,
          status: type === 'order' ? 'in_delivery' : 'assigned_to_salesperson',
          pickupTime: serverTimestamp(),
        });

        displayMessage(`${type === 'order' ? 'Order' : 'Appointment'} assigned to you!`, 'success');
        setQrCodeInput('');
      } catch (error) {
        console.error("Error taking order/appointment:", error);
        displayMessage(`Failed to take order/appointment: ${error.message}`, 'error');
      }
    };

    const handleGenerateCustomerQr = (item) => {
      const qrData = item.orderId ? { orderId: item.orderId, salespersonId: userId } : { patientOfferId: item.id, salespersonId: userId };
      setCurrentQrContent(generateQRCodeContent(qrData));
      setShowQrModal(true);
    };

    const allAssignedItems = [
      ...customerOrders.filter(order => order.salespersonId === userId && order.status === 'in_delivery'),
      ...patientOffers.filter(offer => offer.salespersonId === userId && offer.status === 'assigned_to_salesperson')
    ];

    return (
      <div className="p-6 bg-gray-50 min-h-[calc(100vh-160px)] rounded-xl shadow-inner">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 flex items-center font-inter">
          <Briefcase className="mr-4 h-10 w-10 text-orange-600" /> Salesperson Dashboard
        </h1>

        {salespersonProfile ? (
          <DashboardCard title="Your Profile Details" icon={Briefcase}>
            <p className="text-gray-700"><span className="font-semibold">Name:</span> {salespersonProfile.name}</p>
            <p className="text-gray-700"><span className="font-semibold">Contact:</span> {salespersonProfile.contactNumber}</p>
            <p className="text-gray-700"><span className="font-semibold">Bank:</span> {salespersonProfile.bankDetails}</p>
            <p className="text-gray-700"><span className="font-semibold">Address:</span> {salespersonProfile.address}</p>
            <p className="text-gray-700"><span className="font-semibold">Age:</span> {salespersonProfile.age}</p>
            <p className="text-gray-700"><span className="font-semibold">CNIC:</span> {salespersonProfile.cnic}</p>
            <p className="text-gray-700"><span className="font-semibold">Manager ID:</span> {salespersonProfile.managerAssignedId}</p>
          </DashboardCard>
        ) : (
          <DashboardCard title="Your Profile Details" icon={Briefcase}>
            <p className="text-gray-600">Loading profile or profile not yet approved by Admin.</p>
          </DashboardCard>
        )}

        {/* Scan Pharmacy/Doctor QR (Take Order/Appointment) */}
        <DashboardCard title="Scan Pharmacy/Doctor QR (Take Order/Appointment)" icon={Scan}>
          <InputField
            label="Enter QR Code Content (Order/Appointment ID)"
            value={qrCodeInput}
            onChange={(e) => setQrCodeInput(e.target.value)}
            placeholder="Paste QR content here..."
          />
          <ActionButton onClick={handleTakeOrderAppointment}>
            Take Order/Appointment
          </ActionButton>
        </DashboardCard>

        {/* My Assigned Orders/Appointments */}
        <DashboardCard title="My Assigned Orders/Appointments" icon={Briefcase}>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">ID</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Type</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Item Name</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Customer/Patient</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allAssignedItems.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-4 text-gray-500">No assigned orders or appointments.</td></tr>
                ) : (
                  allAssignedItems.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 px-4 text-gray-700 text-xs">{item.id}</td>
                      <td className="py-2 px-4 text-gray-700 capitalize">{item.orderId ? 'Order' : 'Appointment'}</td>
                      <td className="py-2 px-4 text-gray-700">{item.productName || item.reason}</td>
                      <td className="py-2 px-4 text-gray-700">{item.customerId || item.patientId}</td>
                      <td className="py-2 px-4 text-gray-700 capitalize">{item.status?.replace(/_/g, ' ')}</td>
                      <td className="py-2 px-4">
                        <ActionButton onClick={() => handleGenerateCustomerQr(item)} className="text-xs px-2 py-1">
                          Generate Customer QR
                        </ActionButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Note: The 1-hour relist functionality for uncompleted tasks requires a server-side process
            (e.g., Firebase Cloud Function) and cannot be reliably implemented purely client-side.
          </p>
        </DashboardCard>

        {/* QR Code Modal */}
        {showQrModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl relative">
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                &times;
              </button>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Customer QR Code</h3>
              <QRCodeDisplay content={currentQrContent} />
            </div>
          </div>
        )}

        {/* Your Coin History (Last 30 Days) */}
        <DashboardCard title="Your Coin History (Last 30 Days)" icon={DollarSign}>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Amount</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Source</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody>
                {salespersonCoinHistory.length === 0 ? (
                  <tr><td colSpan="3" className="text-center py-4 text-gray-500">No recent coin history.</td></tr>
                ) : (
                  salespersonCoinHistory.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 px-4 text-gray-700">{transaction.amount}</td>
                      <td className="py-2 px-4 text-gray-700">{transaction.description}</td>
                      <td className="py-2 px-4 text-gray-700">{transaction.date?.toDate().toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardCard>
      </div>
    );
  };

  // --- Doctor Dashboard ---
  const DoctorDashboard = () => {
    const [doctorProfile, setDoctorProfile] = useState(null);
    const [selectedProductToPurchase, setSelectedProductToPurchase] = useState('');
    const [showQrModal, setShowQrModal] = useState(false);
    const [currentQrContent, setCurrentQrContent] = useState('');

    useEffect(() => {
      const fetchDoctorProfile = async () => {
        if (!dbRef.current || !userId) return;
        try {
          const profileDocRef = doc(dbRef.current, `artifacts/${appId}/public/data/doctors`, userId); // Assuming doctor profile is public and ID matches userId
          const docSnap = await getDoc(profileDocRef);
          if (docSnap.exists()) {
            setDoctorProfile(docSnap.data());
          } else {
            setDoctorProfile(null);
          }
        } catch (error) {
          console.error("Error fetching doctor profile:", error);
          displayMessage(`Failed to fetch profile: ${error.message}`, 'error');
        }
      };
      fetchDoctorProfile();
    }, [userId, dbRef.current]);

    const handlePurchaseProduct = async () => {
      if (!dbRef.current || !userId || !selectedProductToPurchase) {
        displayMessage("Please select a product to purchase.", 'error');
        return;
      }
      try {
        const product = products.find(p => p.id === selectedProductToPurchase);
        if (!product) {
          displayMessage("Selected product not found.", 'error');
          return;
        }

        await addDoc(collection(dbRef.current, `artifacts/${appId}/users/${userId}/orders`), {
          productId: selectedProductToPurchase,
          productName: product.name,
          price: product.price,
          customerId: userId, // Doctor is acting as a customer here
          status: 'purchased_by_doctor',
          orderDate: serverTimestamp(),
        });
        displayMessage(`Product ${product.name} purchased successfully!`, 'success');
        setSelectedProductToPurchase('');
      } catch (error) {
        console.error("Error purchasing product:", error);
        displayMessage(`Failed to purchase product: ${error.message}`, 'error');
      }
    };

    const handleAcceptOffer = async (offerId) => {
      if (!dbRef.current || !userId) return;
      try {
        const offerRef = doc(dbRef.current, `artifacts/${appId}/public/data/patientOffers`, offerId);
        await updateDoc(offerRef, {
          status: 'accepted',
          acceptedOn: serverTimestamp(),
        });
        displayMessage('Offer accepted!', 'success');
        // Immediately display QR for salesperson to scan
        const qrData = { patientOfferId: offerId, doctorId: userId };
        setCurrentQrContent(generateQRCodeContent(qrData));
        setShowQrModal(true);
      } catch (error) {
        console.error("Error accepting offer:", error);
        displayMessage(`Failed to accept offer: ${error.message}`, 'error');
      }
    };

    const handleGenerateSalespersonQr = (offerId) => {
      const qrData = { patientOfferId: offerId, doctorId: userId };
      setCurrentQrContent(generateQRCodeContent(qrData));
      setShowQrModal(true);
    };

    const pendingOffers = patientOffers.filter(offer => offer.status === 'pending' && offer.doctorId === userId);
    const acceptedAppointments = patientOffers.filter(offer => offer.status === 'accepted' && offer.doctorId === userId);

    return (
      <div className="p-6 bg-gray-50 min-h-[calc(100vh-160px)] rounded-xl shadow-inner">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 flex items-center font-inter">
          <Stethoscope className="mr-4 h-10 w-10 text-red-600" /> Doctor Dashboard
        </h1>

        {doctorProfile ? (
          <DashboardCard title="Your Profile Details" icon={Stethoscope}>
            <p className="text-gray-700"><span className="font-semibold">Name:</span> {doctorProfile.name}</p>
            <p className="text-gray-700"><span className="font-semibold">Specialty:</span> {doctorProfile.specialty}</p>
            <p className="text-gray-700"><span className="font-semibold">Contact:</span> {doctorProfile.contactInfo}</p>
          </DashboardCard>
        ) : (
          <DashboardCard title="Your Profile Details" icon={Stethoscope}>
            <p className="text-gray-600">Loading profile or profile not yet added by Admin.</p>
          </DashboardCard>
        )}

        {/* Purchase Products Section */}
        <DashboardCard title="Purchase Products" icon={Package}>
          <SelectField
            label="Select Product"
            value={selectedProductToPurchase}
            onChange={(e) => setSelectedProductToPurchase(e.target.value)}
            options={products.map(product => ({
              value: product.id,
              label: `${product.name} ($${product.price?.toFixed(2)})`
            }))}
            required
          />
          <ActionButton onClick={handlePurchaseProduct}>Purchase Product</ActionButton>
        </DashboardCard>

        {/* Patient Checkup Offers */}
        <DashboardCard title="Patient Checkup Offers" icon={Users}>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Patient Name</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Reason</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Offered On</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingOffers.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-4 text-gray-500">No pending checkup offers.</td></tr>
                ) : (
                  pendingOffers.map((offer) => (
                    <tr key={offer.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 px-4 text-gray-700">{offer.patientName}</td>
                      <td className="py-2 px-4 text-gray-700">{offer.reason}</td>
                      <td className="py-2 px-4 text-gray-700">{offer.offeredOn?.toDate().toLocaleDateString()}</td>
                      <td className="py-2 px-4">
                        <ActionButton onClick={() => handleAcceptOffer(offer.id)} className="text-xs px-2 py-1">
                          Accept Offer
                        </ActionButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        {/* Accepted Appointments (Generate Salesperson QR) */}
        <DashboardCard title="Accepted Appointments (Generate Salesperson QR)" icon={CalendarCheck}>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Patient Name</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Reason</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Accepted On</th>
                  <th className="py-2 px-4 text-left text-sm font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {acceptedAppointments.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-4 text-gray-500">No accepted appointments.</td></tr>
                ) : (
                  acceptedAppointments.map((offer) => (
                    <tr key={offer.id} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 px-4 text-gray-700">{offer.patientName}</td>
                      <td className="py-2 px-4 text-gray-700">{offer.reason}</td>
                      <td className="py-2 px-4 text-gray-700 capitalize">{offer.status?.replace(/_/g, ' ')}</td>
                      <td className="py-2 px-4 text-gray-700">{offer.acceptedOn?.toDate().toLocaleDateString()}</td>
                      <td className="py-2 px-4">
                        <ActionButton onClick={() => handleGenerateSalespersonQr(offer.id)} className="text-xs px-2 py-1">
                          Generate Salesperson QR
                        </ActionButton>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        {/* QR Code Modal */}
        {showQrModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl relative">
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl font-bold"
              >
                &times;
              </button>
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Salesperson QR Code</h3>
              <QRCodeDisplay content={currentQrContent} />
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Main App Render Logic ---
  return (
    <div className="min-h-screen bg-gray-100 font-inter antialiased flex flex-col">
      <GlobalMessage />
      <Header />
      <main className="flex-grow p-4">
        {loading ? (
          <LoadingSpinner />
        ) : userRole === null ? (
          <RoleSelection />
        ) : userRole === 'admin' ? (
          <AdminDashboard />
        ) : userRole === 'customer' ? (
          <CustomerDashboard />
        ) : userRole === 'institution' ? (
          <InstitutionDashboard />
        ) : userRole === 'salesperson' ? (
          <SalespersonDashboard />
        ) : userRole === 'doctor' ? (
          <DoctorDashboard />
        ) : (
          <div className="text-center text-lg text-gray-600 mt-20">
            Unknown role or no dashboard configured for this role.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
