// DOM Elements
const packagesContainer = document.getElementById('packagesContainer');
const dashboardBtn = document.getElementById('dashboardBtn');
const adminPanelBtn = document.getElementById('adminPanelBtn');

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    displayPackages();
    setupEventListeners();
    startDailyBonusAutomation();
});

// Setup Event Listeners
function setupEventListeners() {
    dashboardBtn.addEventListener('click', showDashboard);
    adminPanelBtn.addEventListener('click', showAdminPanel);
}

// Display Packages
function displayPackages() {
    packagesContainer.innerHTML = PACKAGES.map(pkg => `
        <div class="col-md-4 mb-4">
            <div class="package-card">
                <h3>${pkg.name}</h3>
                <div class="price">$${pkg.price}</div>
                <ul class="list-unstyled">
                    <li><i class="fas fa-check text-success"></i> ${pkg.dailyBonus}% Daily Bonus</li>
                    <li><i class="fas fa-check text-success"></i> ${pkg.duration} Days Duration</li>
                    <li><i class="fas fa-check text-success"></i> Level Bonus Up to 12%</li>
                </ul>
                <button class="btn btn-primary w-100" onclick="purchasePackage(${pkg.id})">
                    Purchase Package
                </button>
            </div>
        </div>
    `).join('');
}

// Purchase Package
async function purchasePackage(packageId) {
    if (!auth.currentUser) {
        showAlert('warning', 'Please login to purchase a package');
        return;
    }

    const pkg = PACKAGES.find(p => p.id === packageId);
    if (!pkg) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        // Check if user already has an active package
        const activePackage = userData.packages.find(p => p.status === 'active');
        if (activePackage) {
            showAlert('warning', 'You already have an active package');
            return;
        }

        // Create new package purchase
        const newPackage = {
            id: pkg.id,
            name: pkg.name,
            price: pkg.price,
            dailyBonus: pkg.dailyBonus,
            duration: pkg.duration,
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            dailyBonusCount: 0,
            totalEarnings: 0
        };

        // Update user document
        await userDoc.ref.update({
            packages: firebase.firestore.FieldValue.arrayUnion(newPackage)
        });

        // Calculate and distribute all bonuses
        await calculateLevelBonus(auth.currentUser.uid, pkg.id, pkg.price);
        await calculateMBBonus(auth.currentUser.uid, pkg.id, pkg.price);
        await calculateDRBBonus(auth.currentUser.uid, pkg.id, pkg.price);
        await calculateSalaryBonus(auth.currentUser.uid, pkg.id, pkg.price);

        // Record transaction
        await db.collection('transactions').add({
            userId: auth.currentUser.uid,
            type: 'Package Purchase',
            amount: pkg.price,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: pkg.id
        });

        showAlert('success', 'Package purchased successfully!');
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Show Dashboard
async function showDashboard() {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        // Get active package and calculate expiration date
        const activePackage = userData.packages.find(p => p.status === 'active');
        let expirationDate = null;
        let daysRemaining = 0;
        
        if (activePackage) {
            const purchaseDate = activePackage.purchaseDate.toDate();
            expirationDate = new Date(purchaseDate);
            expirationDate.setDate(expirationDate.getDate() + activePackage.duration);
            
            // Calculate days remaining
            const today = new Date();
            daysRemaining = Math.ceil((expirationDate - today) / (1000 * 60 * 60 * 24));
        }

        // Create dashboard content
        const dashboardContent = `
            <div class="row">
                <div class="col-md-4">
                    <div class="dashboard-card">
                        <h4>Account Status</h4>
                        <div class="status-info">
                            <p><strong>Account Status:</strong> 
                                <span class="badge bg-${userData.isActive ? 'success' : 'danger'}">
                                    ${userData.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </p>
                            <p><strong>Income Status:</strong> 
                                <span class="badge bg-${userData.canEarn ? 'success' : 'danger'}">
                                    ${userData.canEarn ? 'Can Earn' : 'Cannot Earn'}
                                </span>
                            </p>
                            <p><strong>Member Since:</strong> ${userData.createdAt.toDate().toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="dashboard-card">
                        <h4>Account Balance</h4>
                        <h2>$${userData.balance.toFixed(2)}</h2>
                        <button class="btn btn-primary" onclick="requestWithdrawal()">
                            Request Withdrawal
                        </button>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="dashboard-card">
                        <h4>Active Package</h4>
                        ${activePackage ? `
                            <div class="package-info">
                                <p><strong>Package:</strong> ${activePackage.name}</p>
                                <p><strong>Price:</strong> $${activePackage.price}</p>
                                <p><strong>Daily Bonus:</strong> ${activePackage.dailyBonus}%</p>
                                <p><strong>Purchase Date:</strong> ${activePackage.purchaseDate.toDate().toLocaleDateString()}</p>
                                <p><strong>Expiration Date:</strong> ${expirationDate.toLocaleDateString()}</p>
                                <p><strong>Days Remaining:</strong> ${daysRemaining} days</p>
                                <p><strong>Total Earnings:</strong> $${activePackage.totalEarnings.toFixed(2)}</p>
                            </div>
                        ` : '<p>No active package</p>'}
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-6">
                    <div class="dashboard-card">
                        <h4>Referral Stats</h4>
                        <div class="referral-info">
                            <p><strong>Direct Referrals:</strong> ${userData.directReferrals}</p>
                            <p><strong>Total Referrals:</strong> ${userData.totalReferrals}</p>
                            <p><strong>Your Referral Code:</strong> ${userData.referralCode}</p>
                            <button class="btn btn-sm btn-info" onclick="copyReferralCode('${userData.referralCode}')">
                                Copy Referral Code
                            </button>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="dashboard-card">
                        <h4>Earnings Summary</h4>
                        <div class="earnings-info">
                            <p><strong>Total Earnings:</strong> $${userData.totalEarnings?.toFixed(2) || '0.00'}</p>
                            <p><strong>Package Earnings:</strong> $${userData.packageEarnings?.toFixed(2) || '0.00'}</p>
                            <p><strong>Level Bonus:</strong> $${userData.earnings?.levelBonus?.toFixed(2) || '0.00'}</p>
                            <p><strong>Daily Bonus:</strong> $${userData.earnings?.dailyBonus?.toFixed(2) || '0.00'}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-12">
                    <div class="dashboard-card">
                        <h4>History</h4>
                        <ul class="nav nav-tabs" id="historyTabs" role="tablist">
                            <li class="nav-item">
                                <a class="nav-link active" id="withdrawal-tab" data-bs-toggle="tab" href="#withdrawal" role="tab">
                                    Withdrawal History
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" id="daily-tab" data-bs-toggle="tab" href="#daily" role="tab">
                                    Daily Earnings History
                                </a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" id="referral-tab" data-bs-toggle="tab" href="#referral" role="tab">
                                    Referral Income History
                                </a>
                            </li>
                        </ul>
                        <div class="tab-content mt-3" id="historyTabContent">
                            <div class="tab-pane fade show active" id="withdrawal" role="tabpanel">
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Method</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody id="withdrawalHistory">
                                            <!-- Withdrawal history will be loaded here -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="tab-pane fade" id="daily" role="tabpanel">
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Package</th>
                                            </tr>
                                        </thead>
                                        <tbody id="dailyEarningsHistory">
                                            <!-- Daily earnings history will be loaded here -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="tab-pane fade" id="referral" role="tabpanel">
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Type</th>
                                                <th>From User</th>
                                            </tr>
                                        </thead>
                                        <tbody id="referralIncomeHistory">
                                            <!-- Referral income history will be loaded here -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Update main content
        document.querySelector('.container').innerHTML = dashboardContent;
        loadWithdrawalHistory();
        loadDailyEarningsHistory();
        loadReferralIncomeHistory();
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Load Withdrawal History
async function loadWithdrawalHistory() {
    if (!auth.currentUser) return;

    try {
        const withdrawals = await db.collection('withdrawals')
            .where('userId', '==', auth.currentUser.uid)
            .orderBy('date', 'desc')
            .limit(50)
            .get();

        const tbody = document.getElementById('withdrawalHistory');
        tbody.innerHTML = withdrawals.docs.map(doc => {
            const data = doc.data();
            return `
                <tr>
                    <td>${data.date.toDate().toLocaleDateString()}</td>
                    <td>$${data.amount.toFixed(2)}</td>
                    <td>${data.withdrawalMethod}</td>
                    <td><span class="badge bg-${getStatusColor(data.status)}">${data.status}</span></td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading withdrawal history:', error);
    }
}

// Load Daily Earnings History
async function loadDailyEarningsHistory() {
    if (!auth.currentUser) return;

    try {
        const transactions = await db.collection('transactions')
            .where('userId', '==', auth.currentUser.uid)
            .where('type', '==', 'Daily Bonus')
            .orderBy('date', 'desc')
            .limit(50)
            .get();

        const tbody = document.getElementById('dailyEarningsHistory');
        tbody.innerHTML = transactions.docs.map(doc => {
            const data = doc.data();
            return `
                <tr>
                    <td>${data.date.toDate().toLocaleDateString()}</td>
                    <td>$${data.amount.toFixed(2)}</td>
                    <td>${data.packageName || 'N/A'}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading daily earnings history:', error);
    }
}

// Load Referral Income History
async function loadReferralIncomeHistory() {
    if (!auth.currentUser) return;

    try {
        const transactions = await db.collection('transactions')
            .where('userId', '==', auth.currentUser.uid)
            .where('type', 'in', ['Level Bonus', 'MB Bonus', 'DRB Bonus'])
            .orderBy('date', 'desc')
            .limit(50)
            .get();

        const tbody = document.getElementById('referralIncomeHistory');
        tbody.innerHTML = transactions.docs.map(doc => {
            const data = doc.data();
            return `
                <tr>
                    <td>${data.date.toDate().toLocaleDateString()}</td>
                    <td>$${data.amount.toFixed(2)}</td>
                    <td>${data.type}</td>
                    <td>${data.fromUserName || 'N/A'}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading referral income history:', error);
    }
}

// Helper function to copy referral code
function copyReferralCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showAlert('success', 'Referral code copied to clipboard!');
    }).catch(err => {
        showAlert('danger', 'Failed to copy referral code');
    });
}

// Show Admin Panel
async function showAdminPanel() {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        if (userData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        // Get admin dashboard statistics
        const stats = await getAdminDashboardStats();
        const systemAnalytics = await getSystemAnalytics();
        const recentActivities = await getRecentActivities();

        // Create enhanced admin panel content
        const adminContent = `
            <div class="row">
                <div class="col-12">
                    <div class="admin-panel">
                        <h4>Admin Panel</h4>
                        <div class="row mb-4">
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <h5>Total Users</h5>
                                    <h3>${stats.totalUsers}</h3>
                                    <p>Active: ${stats.activeUsers}</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <h5>Total Packages</h5>
                                    <h3>${stats.totalPackages}</h3>
                                    <p>Active: ${stats.activePackages}</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <h5>Withdrawals</h5>
                                    <h3>${stats.totalWithdrawals}</h3>
                                    <p>Pending: ${stats.pendingWithdrawals}</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <h5>Earnings</h5>
                                    <h3>$${stats.totalEarnings.toFixed(2)}</h3>
                                    <p>Today: $${stats.dailyEarnings.toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                        <div class="row mb-4">
                            <div class="col-12">
                                <div class="admin-tools">
                                    <button class="btn btn-primary" onclick="showSystemAnalytics()">
                                        System Analytics
                                    </button>
                                    <button class="btn btn-success" onclick="showUserActivity()">
                                        User Activity
                                    </button>
                                    <button class="btn btn-info" onclick="showPackageManagement()">
                                        Package Management
                                    </button>
                                    <button class="btn btn-warning" onclick="showBonusManagement()">
                                        Bonus Management
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <h5>Recent Activities</h5>
                                <div class="table-responsive">
                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>User</th>
                                                <th>Action</th>
                                                <th>Details</th>
                                            </tr>
                                        </thead>
                                        <tbody id="recentActivities">
                                            ${recentActivities.map(activity => `
                                                <tr>
                                                    <td>${activity.timestamp.toDate().toLocaleString()}</td>
                                                    <td>${activity.userName}</td>
                                                    <td>${activity.action}</td>
                                                    <td>${activity.details}</td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <h5>System Health</h5>
                                <div class="system-health">
                                    <div class="health-item">
                                        <span>Server Status:</span>
                                        <span class="badge bg-success">Online</span>
                                    </div>
                                    <div class="health-item">
                                        <span>Database Status:</span>
                                        <span class="badge bg-success">Connected</span>
                                    </div>
                                    <div class="health-item">
                                        <span>Last Backup:</span>
                                        <span>${systemAnalytics.lastBackup}</span>
                                    </div>
                                    <div class="health-item">
                                        <span>System Load:</span>
                                        <span>${systemAnalytics.systemLoad}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Update main content
        document.querySelector('.container').innerHTML = adminContent;
        loadUsers();
        loadWithdrawals();
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Load Users (Admin Only)
async function loadUsers() {
    if (!auth.currentUser) return;

    try {
        const users = await db.collection('users').get();
        const tbody = document.getElementById('userList');
        tbody.innerHTML = users.docs.map(doc => {
            const data = doc.data();
            return `
                <tr>
                    <td>${data.name}</td>
                    <td>${data.email}</td>
                    <td>${data.role}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn btn-sm ${data.isActive ? 'btn-success' : 'btn-danger'}" 
                                    onclick="toggleUserActivation('${doc.id}')">
                                ${data.isActive ? 'Active' : 'Inactive'}
                            </button>
                            <button class="btn btn-sm ${data.canEarn ? 'btn-success' : 'btn-danger'}" 
                                    onclick="toggleUserIncome('${doc.id}')">
                                ${data.canEarn ? 'Can Earn' : 'Cannot Earn'}
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="editUser('${doc.id}')">
                                Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteUser('${doc.id}')">
                                Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Load Withdrawals (Admin Only)
async function loadWithdrawals() {
    if (!auth.currentUser) return;

    try {
        const withdrawals = await db.collection('withdrawals')
            .orderBy('date', 'desc')
            .get();

        const tbody = document.getElementById('withdrawalList');
        tbody.innerHTML = withdrawals.docs.map(doc => {
            const data = doc.data();
            return `
                <tr>
                    <td>${data.userName}</td>
                    <td>$${data.amount.toFixed(2)}</td>
                    <td>${data.withdrawalMethod}</td>
                    <td>${data.usdtAddress}</td>
                    <td>${data.date.toDate().toLocaleDateString()}</td>
                    <td><span class="badge bg-${getStatusColor(data.status)}">${data.status}</span></td>
                    <td>
                        ${data.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="approveWithdrawal('${doc.id}')">
                                Approve
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="rejectWithdrawal('${doc.id}')">
                                Reject
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading withdrawals:', error);
    }
}

// Request Withdrawal
async function requestWithdrawal() {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        // Validate withdrawal request
        await validateWithdrawalRequest(auth.currentUser.uid, userData.balance);

        // Show withdrawal modal with USDT address options
        const modalContent = `
            <div class="modal fade" id="withdrawalModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Request Withdrawal</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="withdrawalForm">
                                <div class="mb-3">
                                    <label class="form-label">Withdrawal Amount</label>
                                    <input type="number" class="form-control" id="withdrawalAmount" 
                                           value="${userData.balance}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Service Fee (5%)</label>
                                    <input type="number" class="form-control" id="serviceFee" 
                                           value="${(userData.balance * 0.05).toFixed(2)}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Final Amount</label>
                                    <input type="number" class="form-control" id="finalAmount" 
                                           value="${(userData.balance * 0.95).toFixed(2)}" readonly>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Withdrawal Method</label>
                                    <select class="form-control" id="withdrawalMethod" required>
                                        <option value="usdt_bep20">USDT (BEP20)</option>
                                        <option value="usdt_trc20">USDT (TRC20)</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">USDT Address</label>
                                    <input type="text" class="form-control" id="usdtAddress" 
                                           placeholder="Enter your USDT address" required>
                                    <small class="text-muted">
                                        Make sure to enter the correct address for the selected network (BEP20 or TRC20)
                                    </small>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Confirm USDT Address</label>
                                    <input type="text" class="form-control" id="confirmUsdtAddress" 
                                           placeholder="Confirm your USDT address" required>
                                </div>
                                <button type="submit" class="btn btn-primary">Submit Withdrawal</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalContent);
        const modal = new bootstrap.Modal(document.getElementById('withdrawalModal'));
        modal.show();

        // Handle form submission
        document.getElementById('withdrawalForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const withdrawalMethod = document.getElementById('withdrawalMethod').value;
            const usdtAddress = document.getElementById('usdtAddress').value;
            const confirmUsdtAddress = document.getElementById('confirmUsdtAddress').value;

            // Validate USDT address
            if (usdtAddress !== confirmUsdtAddress) {
                showAlert('danger', 'USDT addresses do not match');
                return;
            }

            // Validate address format based on network
            if (withdrawalMethod === 'usdt_bep20' && !isValidBep20Address(usdtAddress)) {
                showAlert('danger', 'Invalid BEP20 USDT address');
                return;
            }

            if (withdrawalMethod === 'usdt_trc20' && !isValidTrc20Address(usdtAddress)) {
                showAlert('danger', 'Invalid TRC20 USDT address');
                return;
            }

            try {
                const withdrawalAmount = userData.balance;
                const serviceFee = withdrawalAmount * 0.05;
                const finalAmount = withdrawalAmount - serviceFee;

                // Create withdrawal request
                await db.collection('withdrawals').add({
                    userId: auth.currentUser.uid,
                    userName: userData.name,
                    amount: withdrawalAmount,
                    serviceFee,
                    finalAmount,
                    withdrawalMethod,
                    usdtAddress,
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'pending'
                });

                // Update user balance
                await userDoc.ref.update({
                    balance: 0
                });

                modal.hide();
                document.getElementById('withdrawalModal').remove();
                showAlert('success', 'Withdrawal request submitted successfully!');
                loadUserDashboard(); // Refresh dashboard
            } catch (error) {
                showAlert('danger', error.message);
            }
        });
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Helper function to validate BEP20 address
function isValidBep20Address(address) {
    // Basic BEP20 address validation (0x followed by 40 hex characters)
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Helper function to validate TRC20 address
function isValidTrc20Address(address) {
    // Basic TRC20 address validation (T followed by 33 characters)
    return /^T[a-zA-Z0-9]{33}$/.test(address);
}

// Admin Actions
async function approveWithdrawal(withdrawalId) {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        if (userData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        const withdrawalDoc = await db.collection('withdrawals').doc(withdrawalId).get();
        const withdrawalData = withdrawalDoc.data();

        // Update withdrawal status
        await withdrawalDoc.ref.update({
            status: 'approved',
            approvedBy: auth.currentUser.uid,
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('success', 'Withdrawal approved successfully!');
        loadWithdrawals(); // Refresh the withdrawals list
    } catch (error) {
        showAlert('danger', error.message);
    }
}

async function rejectWithdrawal(withdrawalId) {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        if (userData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        const withdrawalDoc = await db.collection('withdrawals').doc(withdrawalId).get();
        const withdrawalData = withdrawalDoc.data();

        // Refund the user's balance
        await db.collection('users').doc(withdrawalData.userId).update({
            balance: firebase.firestore.FieldValue.increment(withdrawalData.amount)
        });

        // Update withdrawal status
        await withdrawalDoc.ref.update({
            status: 'rejected',
            rejectedBy: auth.currentUser.uid,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('success', 'Withdrawal rejected and amount refunded!');
        loadWithdrawals(); // Refresh the withdrawals list
    } catch (error) {
        showAlert('danger', error.message);
    }
}

async function editUser(userId) {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        if (userData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        const targetUserDoc = await db.collection('users').doc(userId).get();
        const targetUserData = targetUserDoc.data();

        // Create edit user modal
        const modalContent = `
            <div class="modal fade" id="editUserModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit User</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editUserForm">
                                <div class="mb-3">
                                    <label class="form-label">Name</label>
                                    <input type="text" class="form-control" id="editUserName" value="${targetUserData.name}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="editUserEmail" value="${targetUserData.email}" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Role</label>
                                    <select class="form-control" id="editUserRole">
                                        <option value="user" ${targetUserData.role === 'user' ? 'selected' : ''}>User</option>
                                        <option value="admin" ${targetUserData.role === 'admin' ? 'selected' : ''}>Admin</option>
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Balance</label>
                                    <input type="number" class="form-control" id="editUserBalance" value="${targetUserData.balance}" required>
                                </div>
                                <button type="submit" class="btn btn-primary">Save Changes</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalContent);
        const modal = new bootstrap.Modal(document.getElementById('editUserModal'));
        modal.show();

        // Handle form submission
        document.getElementById('editUserForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const updatedData = {
                name: document.getElementById('editUserName').value,
                email: document.getElementById('editUserEmail').value,
                role: document.getElementById('editUserRole').value,
                balance: parseFloat(document.getElementById('editUserBalance').value)
            };

            await db.collection('users').doc(userId).update(updatedData);
            modal.hide();
            document.getElementById('editUserModal').remove();
            loadUsers(); // Refresh the users list
            showAlert('success', 'User updated successfully!');
        });
    } catch (error) {
        showAlert('danger', error.message);
    }
}

async function deleteUser(userId) {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();

        if (userData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            await db.collection('users').doc(userId).delete();
            loadUsers(); // Refresh the users list
            showAlert('success', 'User deleted successfully!');
        }
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Daily Bonus Automation
function startDailyBonusAutomation() {
    // Calculate daily bonus every 24 hours
    setInterval(async () => {
        try {
            // Get all users with active packages
            const usersSnapshot = await db.collection('users').get();
            
            for (const userDoc of usersSnapshot.docs) {
                const userData = userDoc.data();
                const activePackage = userData.packages.find(p => p.status === 'active');
                
                if (activePackage) {
                    await calculateDailyBonus(userDoc.id);
                }
            }
        } catch (error) {
            console.error('Error in daily bonus automation:', error);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
}

// Helper Functions
function getStatusColor(status) {
    switch (status.toLowerCase()) {
        case 'pending':
            return 'warning';
        case 'approved':
            return 'success';
        case 'rejected':
            return 'danger';
        default:
            return 'secondary';
    }
}

// Referral System
async function handleReferral(userId, referralCode) {
    try {
        // Find referrer by referral code
        const referrerSnapshot = await db.collection('users')
            .where('referralCode', '==', referralCode)
            .get();

        if (referrerSnapshot.empty) {
            throw new Error('Invalid referral code');
        }

        const referrerDoc = referrerSnapshot.docs[0];
        const referrerData = referrerDoc.data();

        // Update referrer's stats
        await referrerDoc.ref.update({
            directReferrals: firebase.firestore.FieldValue.increment(1),
            totalReferrals: firebase.firestore.FieldValue.increment(1)
        });

        // Update user's upline
        await db.collection('users').doc(userId).update({
            upline: referrerDoc.id,
            uplineCode: referralCode
        });

        // Update upline chain
        let currentUpline = referrerDoc.id;
        let level = 1;
        while (currentUpline && level <= 5) {
            const uplineDoc = await db.collection('users').doc(currentUpline).get();
            const uplineData = uplineDoc.data();
            
            if (uplineData.upline) {
                await uplineDoc.ref.update({
                    totalReferrals: firebase.firestore.FieldValue.increment(1)
                });
                currentUpline = uplineData.upline;
                level++;
            } else {
                break;
            }
        }
    } catch (error) {
        console.error('Error handling referral:', error);
        throw error;
    }
}

// Package Management
async function checkPackageExpiration() {
    try {
        const usersSnapshot = await db.collection('users').get();
        
        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const activePackage = userData.packages.find(p => p.status === 'active');
            
            if (activePackage) {
                const purchaseDate = activePackage.purchaseDate.toDate();
                const expirationDate = new Date(purchaseDate);
                expirationDate.setDate(expirationDate.getDate() + activePackage.duration);
                
                if (new Date() >= expirationDate) {
                    // Update package status to expired
                    const updatedPackages = userData.packages.map(pkg => {
                        if (pkg.id === activePackage.id) {
                            return { ...pkg, status: 'expired' };
                        }
                        return pkg;
                    });
                    
                    await userDoc.ref.update({
                        packages: updatedPackages
                    });
                    
                    // Record package expiration
                    await db.collection('transactions').add({
                        userId: userDoc.id,
                        type: 'Package Expiration',
                        amount: 0,
                        date: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'completed',
                        packageId: activePackage.id
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error checking package expiration:', error);
    }
}

// User Statistics
async function updateUserStatistics(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Calculate total earnings
        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .where('type', 'in', ['Daily Bonus', 'Level Bonus', 'MB Bonus', 'DRB Bonus'])
            .get();
            
        let totalEarnings = 0;
        transactionsSnapshot.forEach(doc => {
            totalEarnings += doc.data().amount;
        });
        
        // Calculate active package earnings
        const activePackage = userData.packages.find(p => p.status === 'active');
        let packageEarnings = 0;
        if (activePackage) {
            packageEarnings = activePackage.totalEarnings;
        }
        
        // Update user statistics
        await userDoc.ref.update({
            totalEarnings,
            packageEarnings,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return {
            totalEarnings,
            packageEarnings,
            directReferrals: userData.directReferrals,
            totalReferrals: userData.totalReferrals
        };
    } catch (error) {
        console.error('Error updating user statistics:', error);
        throw error;
    }
}

// Start package expiration check every hour
setInterval(checkPackageExpiration, 60 * 60 * 1000);

// Update user statistics every 6 hours
setInterval(async () => {
    try {
        const usersSnapshot = await db.collection('users').get();
        for (const userDoc of usersSnapshot.docs) {
            await updateUserStatistics(userDoc.id);
        }
    } catch (error) {
        console.error('Error in statistics update automation:', error);
    }
}, 6 * 60 * 60 * 1000);

// Bonus Calculations
async function calculateMBBonus(userId, packageId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Get user's upline
        if (!userData.upline) return;
        
        const uplineDoc = await db.collection('users').doc(userData.upline).get();
        const uplineData = uplineDoc.data();
        
        // Find upline's active package
        const uplinePackage = uplineData.packages.find(p => p.status === 'active');
        if (!uplinePackage) return;
        
        // Calculate MB bonus (5% of package price)
        const mbBonus = amount * 0.05;
        
        // Update upline's balance
        await uplineDoc.ref.update({
            balance: firebase.firestore.FieldValue.increment(mbBonus)
        });
        
        // Record MB bonus transaction
        await db.collection('transactions').add({
            userId: uplineData.uid,
            type: 'MB Bonus',
            amount: mbBonus,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: uplinePackage.id,
            fromUserId: userId
        });
    } catch (error) {
        console.error('Error calculating MB bonus:', error);
        throw error;
    }
}

async function calculateDRBBonus(userId, packageId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Get user's upline
        if (!userData.upline) return;
        
        const uplineDoc = await db.collection('users').doc(userData.upline).get();
        const uplineData = uplineDoc.data();
        
        // Find upline's active package
        const uplinePackage = uplineData.packages.find(p => p.status === 'active');
        if (!uplinePackage) return;
        
        // Calculate DRB bonus (3% of package price)
        const drbBonus = amount * 0.03;
        
        // Update upline's balance
        await uplineDoc.ref.update({
            balance: firebase.firestore.FieldValue.increment(drbBonus)
        });
        
        // Record DRB bonus transaction
        await db.collection('transactions').add({
            userId: uplineData.uid,
            type: 'DRB Bonus',
            amount: drbBonus,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: uplinePackage.id,
            fromUserId: userId
        });
    } catch (error) {
        console.error('Error calculating DRB bonus:', error);
        throw error;
    }
}

async function calculateSalaryBonus(userId, packageId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Find user's active package
        const activePackage = userData.packages.find(p => p.status === 'active');
        if (!activePackage) return;
        
        // Calculate salary bonus based on package price
        let salaryBonus = 0;
        if (amount >= 10000) {
            salaryBonus = amount * 0.10; // 10% for $10,000 package
        } else if (amount >= 5000) {
            salaryBonus = amount * 0.08; // 8% for $5,000 package
        } else if (amount >= 1000) {
            salaryBonus = amount * 0.05; // 5% for $1,000 package
        } else if (amount >= 500) {
            salaryBonus = amount * 0.03; // 3% for $500 package
        } else if (amount >= 100) {
            salaryBonus = amount * 0.02; // 2% for $100 package
        } else {
            salaryBonus = amount * 0.01; // 1% for $10 package
        }
        
        // Update user's balance
        await userDoc.ref.update({
            balance: firebase.firestore.FieldValue.increment(salaryBonus)
        });
        
        // Record salary bonus transaction
        await db.collection('transactions').add({
            userId: userId,
            type: 'Salary Bonus',
            amount: salaryBonus,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: packageId
        });
    } catch (error) {
        console.error('Error calculating salary bonus:', error);
        throw error;
    }
}

async function calculateLevelBonus(userId, packageId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Check if user is active and can earn
        if (!userData.isActive || !userData.canEarn) {
            return;
        }
        
        // Get upline chain
        let currentUpline = userData.upline;
        let level = 1;
        
        while (currentUpline && level <= 5) {
            const uplineDoc = await db.collection('users').doc(currentUpline).get();
            const uplineData = uplineDoc.data();
            
            if (!uplineData) break;
            
            // Calculate level bonus based on level
            let levelBonus = 0;
            switch (level) {
                case 1:
                    levelBonus = amount * 0.12; // 12% for level 1
                    break;
                case 2:
                    levelBonus = amount * 0.08; // 8% for level 2
                    break;
                case 3:
                    levelBonus = amount * 0.05; // 5% for level 3
                    break;
                case 4:
                    levelBonus = amount * 0.03; // 3% for level 4
                    break;
                case 5:
                    levelBonus = amount * 0.02; // 2% for level 5
                    break;
            }
            
            // Update upline's balance
            await uplineDoc.ref.update({
                balance: firebase.firestore.FieldValue.increment(levelBonus)
            });
            
            // Record level bonus transaction
            await db.collection('transactions').add({
                userId: uplineData.uid,
                type: 'Level Bonus',
                amount: levelBonus,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'completed',
                packageId: uplineData.packages.find(p => p.status === 'active')?.id,
                fromUserId: userId,
                level: level
            });
            
            // Move to next level
            currentUpline = uplineData.upline;
            level++;
        }
    } catch (error) {
        console.error('Error calculating level bonus:', error);
        throw error;
    }
}

// Daily Bonus Calculation
async function calculateDailyBonus(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Check if user is active and can earn
        if (!userData.isActive || !userData.canEarn) {
            return;
        }
        
        // Find active package
        const activePackage = userData.packages.find(p => p.status === 'active');
        if (!activePackage) return;
        
        // Check if daily bonus limit reached
        if (activePackage.dailyBonusCount >= activePackage.duration) {
            // Update package status to completed
            const updatedPackages = userData.packages.map(pkg => {
                if (pkg.id === activePackage.id) {
                    return { ...pkg, status: 'completed' };
                }
                return pkg;
            });
            
            await userDoc.ref.update({
                packages: updatedPackages
            });
            
            return;
        }
        
        // Calculate daily bonus (1% of package price)
        const dailyBonus = activePackage.price * 0.01;
        
        // Update user's balance
        await userDoc.ref.update({
            balance: firebase.firestore.FieldValue.increment(dailyBonus)
        });
        
        // Update package daily bonus count
        const updatedPackages = userData.packages.map(pkg => {
            if (pkg.id === activePackage.id) {
                return {
                    ...pkg,
                    dailyBonusCount: pkg.dailyBonusCount + 1,
                    totalEarnings: pkg.totalEarnings + dailyBonus
                };
            }
            return pkg;
        });
        
        await userDoc.ref.update({
            packages: updatedPackages
        });
        
        // Record daily bonus transaction
        await db.collection('transactions').add({
            userId: userId,
            type: 'Daily Bonus',
            amount: dailyBonus,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: activePackage.id
        });
    } catch (error) {
        console.error('Error calculating daily bonus:', error);
        throw error;
    }
}

// Package Status Updates
async function updatePackageStatus(userId, packageId, status) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Find package
        const packageIndex = userData.packages.findIndex(p => p.id === packageId);
        if (packageIndex === -1) {
            throw new Error('Package not found');
        }
        
        // Update package status
        const updatedPackages = [...userData.packages];
        updatedPackages[packageIndex] = {
            ...updatedPackages[packageIndex],
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Update user document
        await userDoc.ref.update({
            packages: updatedPackages
        });
        
        // Record status change transaction
        await db.collection('transactions').add({
            userId: userId,
            type: 'Package Status Update',
            amount: 0,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: packageId,
            newStatus: status
        });
    } catch (error) {
        console.error('Error updating package status:', error);
        throw error;
    }
}

// Earnings Tracking
async function trackUserEarnings(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Get all transactions for the user
        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .get();
        
        // Calculate earnings by type
        const earnings = {
            dailyBonus: 0,
            levelBonus: 0,
            mbBonus: 0,
            drbBonus: 0,
            salaryBonus: 0,
            total: 0
        };
        
        transactionsSnapshot.forEach(doc => {
            const transaction = doc.data();
            switch (transaction.type) {
                case 'Daily Bonus':
                    earnings.dailyBonus += transaction.amount;
                    break;
                case 'Level Bonus':
                    earnings.levelBonus += transaction.amount;
                    break;
                case 'MB Bonus':
                    earnings.mbBonus += transaction.amount;
                    break;
                case 'DRB Bonus':
                    earnings.drbBonus += transaction.amount;
                    break;
                case 'Salary Bonus':
                    earnings.salaryBonus += transaction.amount;
                    break;
            }
            earnings.total += transaction.amount;
        });
        
        // Update user's earnings statistics
        await userDoc.ref.update({
            earnings: earnings,
            lastEarningsUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return earnings;
    } catch (error) {
        console.error('Error tracking user earnings:', error);
        throw error;
    }
}

// Update earnings tracking every hour
setInterval(async () => {
    try {
        const usersSnapshot = await db.collection('users').get();
        for (const userDoc of usersSnapshot.docs) {
            await trackUserEarnings(userDoc.id);
        }
    } catch (error) {
        console.error('Error in earnings tracking automation:', error);
    }
}, 60 * 60 * 1000);

// Withdrawal System
async function validateWithdrawalRequest(userId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Check minimum withdrawal amount
        if (amount < WITHDRAWAL_CONFIG.minAmount) {
            throw new Error(`Minimum withdrawal amount is $${WITHDRAWAL_CONFIG.minAmount}`);
        }
        
        // Check if user has sufficient balance
        if (userData.balance < amount) {
            throw new Error('Insufficient balance');
        }
        
        // Check withdrawal day
        const today = new Date();
        if (today.getDay() !== WITHDRAWAL_CONFIG.withdrawalDay) {
            throw new Error('Withdrawals are only available on Mondays');
        }
        
        // Check if user has active package
        const activePackage = userData.packages.find(p => p.status === 'active');
        if (!activePackage) {
            throw new Error('You must have an active package to withdraw');
        }
        
        // Check if user has minimum referrals
        if (userData.directReferrals < WITHDRAWAL_CONFIG.minReferrals) {
            throw new Error(`You need at least ${WITHDRAWAL_CONFIG.minReferrals} direct referrals to withdraw`);
        }
        
        return true;
    } catch (error) {
        console.error('Error validating withdrawal request:', error);
        throw error;
    }
}

// User Profile Updates
async function updateUserProfile(userId, updateData) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Validate update data
        const allowedFields = ['name', 'phone', 'address', 'bankDetails'];
        const filteredData = Object.keys(updateData)
            .filter(key => allowedFields.includes(key))
            .reduce((obj, key) => {
                obj[key] = updateData[key];
                return obj;
            }, {});
        
        // Add update timestamp
        filteredData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        
        // Update user document
        await userDoc.ref.update(filteredData);
        
        // Record profile update
        await db.collection('transactions').add({
            userId: userId,
            type: 'Profile Update',
            amount: 0,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            updateFields: Object.keys(filteredData)
        });
        
        return filteredData;
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw error;
    }
}

// Package Upgrades
async function upgradePackage(userId, newPackageId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();
        
        // Find current active package
        const currentPackage = userData.packages.find(p => p.status === 'active');
        if (!currentPackage) {
            throw new Error('No active package found');
        }
        
        // Find new package
        const newPackage = PACKAGES.find(p => p.id === newPackageId);
        if (!newPackage) {
            throw new Error('Invalid package selected');
        }
        
        // Validate upgrade
        if (newPackage.price <= currentPackage.price) {
            throw new Error('New package must be of higher value');
        }
        
        // Calculate upgrade cost
        const upgradeCost = newPackage.price - currentPackage.price;
        
        // Check user balance
        if (userData.balance < upgradeCost) {
            throw new Error('Insufficient balance for upgrade');
        }
        
        // Update current package status
        const updatedPackages = userData.packages.map(pkg => {
            if (pkg.id === currentPackage.id) {
                return { ...pkg, status: 'upgraded' };
            }
            return pkg;
        });
        
        // Add new package
        const newPackageData = {
            id: newPackage.id,
            name: newPackage.name,
            price: newPackage.price,
            dailyBonus: newPackage.dailyBonus,
            duration: newPackage.duration,
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            dailyBonusCount: 0,
            totalEarnings: 0,
            upgradedFrom: currentPackage.id
        };
        
        updatedPackages.push(newPackageData);
        
        // Update user document
        await userDoc.ref.update({
            packages: updatedPackages,
            balance: firebase.firestore.FieldValue.increment(-upgradeCost)
        });
        
        // Calculate and distribute upgrade bonuses
        await calculateLevelBonus(userId, newPackage.id, upgradeCost);
        await calculateMBBonus(userId, newPackage.id, upgradeCost);
        await calculateDRBBonus(userId, newPackage.id, upgradeCost);
        await calculateSalaryBonus(userId, newPackage.id, upgradeCost);
        
        // Record upgrade transaction
        await db.collection('transactions').add({
            userId: userId,
            type: 'Package Upgrade',
            amount: upgradeCost,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: newPackage.id,
            previousPackageId: currentPackage.id
        });
        
        return newPackageData;
    } catch (error) {
        console.error('Error upgrading package:', error);
        throw error;
    }
}

// Admin Dashboard Statistics
async function getAdminDashboardStats() {
    try {
        const stats = {
            totalUsers: 0,
            activeUsers: 0,
            totalPackages: 0,
            activePackages: 0,
            totalWithdrawals: 0,
            pendingWithdrawals: 0,
            totalEarnings: 0,
            dailyEarnings: 0,
            monthlyEarnings: 0
        };

        // Get users statistics
        const usersSnapshot = await db.collection('users').get();
        stats.totalUsers = usersSnapshot.size;
        
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.packages.some(p => p.status === 'active')) {
                stats.activeUsers++;
            }
            stats.totalPackages += userData.packages.length;
            if (userData.packages.some(p => p.status === 'active')) {
                stats.activePackages++;
            }
        });

        // Get withdrawals statistics
        const withdrawalsSnapshot = await db.collection('withdrawals').get();
        stats.totalWithdrawals = withdrawalsSnapshot.size;
        
        withdrawalsSnapshot.forEach(doc => {
            const withdrawalData = doc.data();
            if (withdrawalData.status === 'pending') {
                stats.pendingWithdrawals++;
            }
        });

        // Get earnings statistics
        const transactionsSnapshot = await db.collection('transactions').get();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        transactionsSnapshot.forEach(doc => {
            const transaction = doc.data();
            const transactionDate = transaction.date.toDate();
            stats.totalEarnings += transaction.amount;
            
            if (transactionDate >= today) {
                stats.dailyEarnings += transaction.amount;
            }
            if (transactionDate >= monthStart) {
                stats.monthlyEarnings += transaction.amount;
            }
        });

        return stats;
    } catch (error) {
        console.error('Error getting admin dashboard stats:', error);
        throw error;
    }
}

// User Notifications
async function createNotification(userId, type, message, data = {}) {
    try {
        const notification = {
            userId,
            type,
            message,
            data,
            read: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('notifications').add(notification);
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
}

async function markNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
    }
}

async function getUserNotifications(userId) {
    try {
        const notificationsSnapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        return notificationsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('Error getting user notifications:', error);
        throw error;
    }
}

// System Settings
async function updateSystemSettings(settings) {
    try {
        const settingsDoc = await db.collection('settings').doc('system').get();
        
        if (settingsDoc.exists) {
            await settingsDoc.ref.update({
                ...settings,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: auth.currentUser.uid
            });
        } else {
            await db.collection('settings').doc('system').set({
                ...settings,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: auth.currentUser.uid,
                updatedBy: auth.currentUser.uid
            });
        }

        return settings;
    } catch (error) {
        console.error('Error updating system settings:', error);
        throw error;
    }
}

async function getSystemSettings() {
    try {
        const settingsDoc = await db.collection('settings').doc('system').get();
        
        if (settingsDoc.exists) {
            return settingsDoc.data();
        }
        
        // Return default settings if none exist
        return {
            maintenanceMode: false,
            registrationEnabled: true,
            withdrawalEnabled: true,
            minWithdrawalAmount: 100,
            maxWithdrawalAmount: 10000,
            serviceFee: 0.05,
            withdrawalDay: 1, // Monday
            minReferrals: 2,
            maxDailyWithdrawals: 100,
            maxMonthlyWithdrawals: 1000,
            bonusRates: {
                daily: 0.01,
                level: [0.12, 0.08, 0.05, 0.03, 0.02],
                mb: 0.05,
                drb: 0.03,
                salary: {
                    '10000': 0.10,
                    '5000': 0.08,
                    '1000': 0.05,
                    '500': 0.03,
                    '100': 0.02,
                    '10': 0.01
                }
            }
        };
    } catch (error) {
        console.error('Error getting system settings:', error);
        throw error;
    }
}

// User Activation Management
async function toggleUserActivation(userId) {
    if (!auth.currentUser) return;

    try {
        const adminDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const adminData = adminDoc.data();

        if (adminData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Toggle user activation status
        const newStatus = !userData.isActive;
        
        // Update user document
        await userDoc.ref.update({
            isActive: newStatus,
            statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            statusUpdatedBy: auth.currentUser.uid
        });

        // Create notification for user
        await createNotification(
            userId,
            'Account Status',
            `Your account has been ${newStatus ? 'activated' : 'deactivated'} by an administrator.`,
            { status: newStatus }
        );

        // Record status change transaction
        await db.collection('transactions').add({
            userId: userId,
            type: 'Account Status Update',
            amount: 0,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            newStatus: newStatus,
            updatedBy: auth.currentUser.uid
        });

        showAlert('success', `User ${newStatus ? 'activated' : 'deactivated'} successfully!`);
        loadUsers(); // Refresh the users list
    } catch (error) {
        showAlert('danger', error.message);
    }
}

async function toggleUserIncome(userId) {
    if (!auth.currentUser) return;

    try {
        const adminDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const adminData = adminDoc.data();

        if (adminData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Toggle user income status
        const newStatus = !userData.canEarn;
        
        // Update user document
        await userDoc.ref.update({
            canEarn: newStatus,
            incomeStatusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            incomeStatusUpdatedBy: auth.currentUser.uid
        });

        // Create notification for user
        await createNotification(
            userId,
            'Income Status',
            `Your income earning ability has been ${newStatus ? 'enabled' : 'disabled'} by an administrator.`,
            { status: newStatus }
        );

        // Record status change transaction
        await db.collection('transactions').add({
            userId: userId,
            type: 'Income Status Update',
            amount: 0,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            newStatus: newStatus,
            updatedBy: auth.currentUser.uid
        });

        showAlert('success', `User income ${newStatus ? 'enabled' : 'disabled'} successfully!`);
        loadUsers(); // Refresh the users list
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Advanced Admin Features
async function showSystemAnalytics() {
    try {
        const systemAnalytics = await getSystemAnalytics();
        const modalContent = `
            <div class="modal fade" id="systemAnalyticsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">System Analytics</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Metric</th>
                                            <th>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>Total Users</td>
                                            <td>${systemAnalytics.totalUsers}</td>
                                        </tr>
                                        <tr>
                                            <td>Active Users</td>
                                            <td>${systemAnalytics.activeUsers}</td>
                                        </tr>
                                        <tr>
                                            <td>Total Packages</td>
                                            <td>${systemAnalytics.totalPackages}</td>
                                        </tr>
                                        <tr>
                                            <td>Active Packages</td>
                                            <td>${systemAnalytics.activePackages}</td>
                                        </tr>
                                        <tr>
                                            <td>Total Withdrawals</td>
                                            <td>${systemAnalytics.totalWithdrawals}</td>
                                        </tr>
                                        <tr>
                                            <td>Pending Withdrawals</td>
                                            <td>${systemAnalytics.pendingWithdrawals}</td>
                                        </tr>
                                        <tr>
                                            <td>Total Earnings</td>
                                            <td>$${systemAnalytics.totalEarnings.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>Daily Earnings</td>
                                            <td>$${systemAnalytics.dailyEarnings.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td>Total Transactions</td>
                                            <td>${systemAnalytics.totalTransactions}</td>
                                        </tr>
                                        <tr>
                                            <td>System Load</td>
                                            <td>${systemAnalytics.systemLoad}%</td>
                                        </tr>
                                        <tr>
                                            <td>Last Backup</td>
                                            <td>${systemAnalytics.lastBackup}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalContent);
        const modal = new bootstrap.Modal(document.getElementById('systemAnalyticsModal'));
        modal.show();
    } catch (error) {
        showAlert('danger', error.message);
    }
}

async function getSystemAnalytics() {
    try {
        const analytics = {
            lastBackup: new Date().toLocaleString(),
            systemLoad: Math.floor(Math.random() * 100),
            activeUsers: 0,
            totalTransactions: 0,
            totalEarnings: 0,
            totalWithdrawals: 0,
            packageDistribution: {},
            userGrowth: [],
            earningsTrend: []
        };

        // Get active users count
        const usersSnapshot = await db.collection('users')
            .where('isActive', '==', true)
            .get();
        analytics.activeUsers = usersSnapshot.size;

        // Get transaction statistics
        const transactionsSnapshot = await db.collection('transactions').get();
        analytics.totalTransactions = transactionsSnapshot.size;

        // Calculate total earnings
        transactionsSnapshot.forEach(doc => {
            const transaction = doc.data();
            analytics.totalEarnings += transaction.amount;
        });

        // Get withdrawal statistics
        const withdrawalsSnapshot = await db.collection('withdrawals').get();
        analytics.totalWithdrawals = withdrawalsSnapshot.size;

        // Get package distribution
        const packagesSnapshot = await db.collection('users').get();
        packagesSnapshot.forEach(doc => {
            const userData = doc.data();
            userData.packages.forEach(pkg => {
                analytics.packageDistribution[pkg.name] = (analytics.packageDistribution[pkg.name] || 0) + 1;
            });
        });

        return analytics;
    } catch (error) {
        console.error('Error getting system analytics:', error);
        throw error;
    }
}

async function getRecentActivities() {
    try {
        const activities = [];
        const transactionsSnapshot = await db.collection('transactions')
            .orderBy('date', 'desc')
            .limit(10)
            .get();

        for (const doc of transactionsSnapshot.docs) {
            const transaction = doc.data();
            const userDoc = await db.collection('users').doc(transaction.userId).get();
            const userData = userDoc.data();

            activities.push({
                timestamp: transaction.date,
                userName: userData.name,
                action: transaction.type,
                details: `Amount: $${transaction.amount.toFixed(2)}`
            });
        }

        return activities;
    } catch (error) {
        console.error('Error getting recent activities:', error);
        throw error;
    }
}

async function showUserActivity() {
    try {
        const userActivity = await getUserActivity();
        const modalContent = `
            <div class="modal fade" id="userActivityModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">User Activity</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>User</th>
                                            <th>Action</th>
                                            <th>Details</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>${userActivity.timestamp.toDate().toLocaleString()}</td>
                                            <td>${userActivity.userName}</td>
                                            <td>${userActivity.action}</td>
                                            <td>${userActivity.details}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalContent);
        const modal = new bootstrap.Modal(document.getElementById('userActivityModal'));
        modal.show();
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// User Deposit Management
async function showDepositModal() {
    if (!auth.currentUser) return;

    const modalContent = `
        <div class="modal fade" id="depositModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Deposit Funds</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="depositForm">
                            <div class="mb-3">
                                <label class="form-label">Amount ($)</label>
                                <input type="number" class="form-control" id="depositAmount" 
                                       min="10" step="0.01" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Payment Method</label>
                                <select class="form-control" id="paymentMethod" required>
                                    <option value="bank">Bank Transfer</option>
                                    <option value="crypto">Cryptocurrency</option>
                                    <option value="usdt">USDT</option>
                                </select>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Transaction ID/Reference</label>
                                <input type="text" class="form-control" id="transactionId" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Screenshot/Proof</label>
                                <input type="file" class="form-control" id="depositProof" accept="image/*" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Submit Deposit</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalContent);
    const modal = new bootstrap.Modal(document.getElementById('depositModal'));
    modal.show();

    // Handle form submission
    document.getElementById('depositForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('depositAmount').value);
        const paymentMethod = document.getElementById('paymentMethod').value;
        const transactionId = document.getElementById('transactionId').value;
        const proofFile = document.getElementById('depositProof').files[0];

        try {
            // Upload proof image
            const storageRef = firebase.storage().ref();
            const proofRef = storageRef.child(`deposits/${auth.currentUser.uid}/${Date.now()}_${proofFile.name}`);
            await proofRef.put(proofFile);
            const proofUrl = await proofRef.getDownloadURL();

            // Create deposit record
            const depositRef = await db.collection('deposits').add({
                userId: auth.currentUser.uid,
                amount: amount,
                paymentMethod: paymentMethod,
                transactionId: transactionId,
                proofUrl: proofUrl,
                status: 'pending',
                date: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Create notification for admin
            await createNotification(
                'admin', // Admin user ID
                'New Deposit',
                `New deposit request of $${amount.toFixed(2)} from ${auth.currentUser.email}`,
                {
                    depositId: depositRef.id,
                    amount: amount,
                    userId: auth.currentUser.uid
                }
            );

            modal.hide();
            document.getElementById('depositModal').remove();
            showAlert('success', 'Deposit request submitted successfully! Waiting for admin approval.');
        } catch (error) {
            showAlert('danger', error.message);
        }
    });
}

// Admin Deposit Approval
async function approveDeposit(depositId) {
    if (!auth.currentUser) return;

    try {
        const adminDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const adminData = adminDoc.data();

        if (adminData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        const depositDoc = await db.collection('deposits').doc(depositId).get();
        const depositData = depositDoc.data();

        // Update deposit status
        await depositDoc.ref.update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
            approvedBy: auth.currentUser.uid
        });

        // Update user balance
        await db.collection('users').doc(depositData.userId).update({
            balance: firebase.firestore.FieldValue.increment(depositData.amount)
        });

        // Create transaction record
        await db.collection('transactions').add({
            userId: depositData.userId,
            type: 'Deposit',
            amount: depositData.amount,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            depositId: depositId
        });

        // Create notification for user
        await createNotification(
            depositData.userId,
            'Deposit Approved',
            `Your deposit of $${depositData.amount.toFixed(2)} has been approved.`,
            { amount: depositData.amount }
        );

        showAlert('success', 'Deposit approved successfully!');
        loadDeposits(); // Refresh deposits list
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Package Activation with Balance
async function activatePackageWithBalance(packageId) {
    if (!auth.currentUser) return;

    try {
        const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const userData = userDoc.data();
        const package = PACKAGES.find(p => p.id === packageId);

        if (!package) {
            showAlert('danger', 'Package not found');
            return;
        }

        // Check if user has sufficient balance
        if (userData.balance < package.price) {
            showAlert('danger', 'Insufficient balance');
            return;
        }

        // Check if user already has an active package
        const hasActivePackage = userData.packages.some(p => p.status === 'active');
        if (hasActivePackage) {
            showAlert('danger', 'You already have an active package');
            return;
        }

        // Create new package
        const newPackage = {
            id: package.id,
            name: package.name,
            price: package.price,
            dailyBonus: package.dailyBonus,
            duration: package.duration,
            purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active',
            dailyBonusCount: 0,
            totalEarnings: 0
        };

        // Update user document
        await userDoc.ref.update({
            packages: firebase.firestore.FieldValue.arrayUnion(newPackage),
            balance: firebase.firestore.FieldValue.increment(-package.price)
        });

        // Calculate bonuses
        await calculateLevelBonus(auth.currentUser.uid, package.id, package.price);
        await calculateMBBonus(auth.currentUser.uid, package.id, package.price);
        await calculateDRBBonus(auth.currentUser.uid, package.id, package.price);

        // Record transaction
        await db.collection('transactions').add({
            userId: auth.currentUser.uid,
            type: 'Package Purchase',
            amount: -package.price,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: package.id
        });

        showAlert('success', 'Package activated successfully!');
        loadUserDashboard(); // Refresh dashboard
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Load Deposits for Admin
async function loadDeposits() {
    if (!auth.currentUser) return;

    try {
        const adminDoc = await db.collection('users').doc(auth.currentUser.uid).get();
        const adminData = adminDoc.data();

        if (adminData.role !== 'admin') {
            showAlert('danger', 'Access denied');
            return;
        }

        const depositsSnapshot = await db.collection('deposits')
            .orderBy('date', 'desc')
            .get();

        const tbody = document.getElementById('depositList');
        tbody.innerHTML = depositsSnapshot.docs.map(doc => {
            const deposit = doc.data();
            return `
                <tr>
                    <td>${deposit.userId}</td>
                    <td>$${deposit.amount.toFixed(2)}</td>
                    <td>${deposit.paymentMethod}</td>
                    <td>${deposit.transactionId}</td>
                    <td>${deposit.date.toDate().toLocaleString()}</td>
                    <td>
                        <span class="badge bg-${deposit.status === 'pending' ? 'warning' : 'success'}">
                            ${deposit.status}
                        </span>
                    </td>
                    <td>
                        ${deposit.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="approveDeposit('${doc.id}')">
                                Approve
                            </button>
                        ` : ''}
                        <a href="${deposit.proofUrl}" target="_blank" class="btn btn-sm btn-info">
                            View Proof
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        showAlert('danger', error.message);
    }
}

// Export functions
window.approveWithdrawal = approveWithdrawal;
window.rejectWithdrawal = rejectWithdrawal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.handleReferral = handleReferral;
window.updateUserStatistics = updateUserStatistics;
window.calculateMBBonus = calculateMBBonus;
window.calculateDRBBonus = calculateDRBBonus;
window.calculateSalaryBonus = calculateSalaryBonus;
window.calculateLevelBonus = calculateLevelBonus;
window.calculateDailyBonus = calculateDailyBonus;
window.updatePackageStatus = updatePackageStatus;
window.trackUserEarnings = trackUserEarnings;
window.validateWithdrawalRequest = validateWithdrawalRequest;
window.updateUserProfile = updateUserProfile;
window.upgradePackage = upgradePackage;
window.getAdminDashboardStats = getAdminDashboardStats;
window.createNotification = createNotification;
window.markNotificationAsRead = markNotificationAsRead;
window.getUserNotifications = getUserNotifications;
window.updateSystemSettings = updateSystemSettings;
window.getSystemSettings = getSystemSettings;
window.toggleUserActivation = toggleUserActivation;
window.toggleUserIncome = toggleUserIncome;
window.showDepositModal = showDepositModal;
window.activatePackageWithBalance = activatePackageWithBalance;
window.approveDeposit = approveDeposit;
window.loadDeposits = loadDeposits; 