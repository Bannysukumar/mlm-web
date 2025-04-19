// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const userMenu = document.getElementById('userMenu');
const adminMenu = document.getElementById('adminMenu');

// Event Listeners
loginBtn.addEventListener('click', () => loginModal.show());
registerBtn.addEventListener('click', () => registerModal.show());

// Login Form Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Get user data from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();

        // Update UI based on user role
        updateUIForUser(userData);
        
        // Close modal
        loginModal.hide();
        
        // Show success message
        showAlert('success', 'Login successful!');
    } catch (error) {
        showAlert('danger', error.message);
    }
});

// Register Form Handler
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const referralCode = document.getElementById('referralCode').value;

    try {
        // Create user account
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Generate referral code
        const newReferralCode = generateReferralCode();

        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            name,
            email,
            referralCode: newReferralCode,
            referredBy: referralCode || null,
            role: 'user',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            balance: 0,
            totalEarnings: 0,
            packages: [],
            level: 1,
            directReferrals: 0,
            totalReferrals: 0
        });

        // If referral code was used, update referrer's stats
        if (referralCode) {
            await updateReferrerStats(referralCode);
        }

        // Update UI
        updateUIForUser({ role: 'user' });
        
        // Close modal
        registerModal.hide();
        
        // Show success message
        showAlert('success', 'Registration successful!');
    } catch (error) {
        showAlert('danger', error.message);
    }
});

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        const userDoc = await db.collection('users').doc(user.uid).get();
        const userData = userDoc.data();
        updateUIForUser(userData);
    } else {
        // User is signed out
        updateUIForGuest();
    }
});

// Helper Functions
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function updateReferrerStats(referralCode) {
    const referrerQuery = await db.collection('users')
        .where('referralCode', '==', referralCode)
        .get();

    if (!referrerQuery.empty) {
        const referrerDoc = referrerQuery.docs[0];
        await referrerDoc.ref.update({
            directReferrals: firebase.firestore.FieldValue.increment(1),
            totalReferrals: firebase.firestore.FieldValue.increment(1)
        });
    }
}

function updateUIForUser(userData) {
    loginBtn.classList.add('d-none');
    registerBtn.classList.add('d-none');
    userMenu.classList.remove('d-none');
    
    if (userData.role === 'admin') {
        adminMenu.classList.remove('d-none');
    }
}

function updateUIForGuest() {
    loginBtn.classList.remove('d-none');
    registerBtn.classList.remove('d-none');
    userMenu.classList.add('d-none');
    adminMenu.classList.add('d-none');
}

function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.querySelector('.container').insertBefore(alertDiv, document.querySelector('.row'));
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
} 