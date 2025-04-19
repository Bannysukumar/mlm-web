// Firebase Configuration
const firebaseConfig = {
    // Replace with your Firebase config
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Package Configuration
const PACKAGES = [
    { id: 1, name: 'Starter', price: 10, dailyBonus: 1, duration: 7 },
    { id: 2, name: 'Basic', price: 20, dailyBonus: 1, duration: 7 },
    { id: 3, name: 'Standard', price: 50, dailyBonus: 1, duration: 7 },
    { id: 4, name: 'Premium', price: 100, dailyBonus: 1, duration: 7 },
    { id: 5, name: 'Gold', price: 250, dailyBonus: 1, duration: 7 },
    { id: 6, name: 'Platinum', price: 500, dailyBonus: 1, duration: 7 },
    { id: 7, name: 'Diamond', price: 1000, dailyBonus: 1, duration: 7 },
    { id: 8, name: 'Elite', price: 2000, dailyBonus: 1, duration: 7 },
    { id: 9, name: 'Master', price: 5000, dailyBonus: 1, duration: 7 },
    { id: 10, name: 'Grand Master', price: 10000, dailyBonus: 1, duration: 7 }
];

// Level Bonus Configuration
const LEVEL_BONUS = [
    { level: 1, percentage: 5 },
    { level: 2, percentage: 3 },
    { level: 3, percentage: 2 },
    { level: 4, percentage: 1 },
    { level: 5, percentage: 1 }
];

// Salary Bonus Configuration
const SALARY_BONUS = [
    { amount: 10000, salary: 100, duration: 12 },
    { amount: 30000, salary: 200, duration: 12 },
    { amount: 50000, salary: 400, duration: 12 },
    { amount: 100000, salary: 700, duration: 12 },
    { amount: 500000, salary: 1500, duration: 12 }
];

// Withdrawal Configuration
const WITHDRAWAL_CONFIG = {
    minAmount: 11,
    serviceFee: 0.10, // 10%
    withdrawalDay: 1 // Monday (0 = Sunday, 1 = Monday, etc.)
};

// Export configurations
window.PACKAGES = PACKAGES;
window.LEVEL_BONUS = LEVEL_BONUS;
window.SALARY_BONUS = SALARY_BONUS;
window.WITHDRAWAL_CONFIG = WITHDRAWAL_CONFIG; 