# MLM Website with Firebase Backend

A comprehensive MLM (Multi-Level Marketing) website built with HTML, CSS, JavaScript, and Firebase. This platform includes user registration, package management, referral system, and an admin panel.

## Features

- ✅ User Registration & Authentication (Firebase)
- ✅ Referral System (12% Level Bonus)
- ✅ Daily Bonus & MB Bonus
- ✅ Admin Panel for Customization
- ✅ Withdrawal System with Conditions
- ✅ Package Purchase System

## Package Structure

### Investment Packages
- $10 - Starter
- $20 - Basic
- $50 - Standard
- $100 - Premium
- $250 - Gold
- $500 - Platinum
- $1,000 - Diamond
- $2,000 - Elite
- $5,000 - Master
- $10,000 - Grand Master

### Bonus Structure
1. Daily Bonus: 1% Daily on each trade
2. MB Bonus: 3X Daily 1% for 7 DAYS
3. DRB Bonus: 1% daily for 100 days
4. Level Bonus:
   - Level 1: 5%
   - Level 2: 3%
   - Level 3: 2%
   - Level 4: 1%
   - Level 5: 1%

### Salary Bonus (MB)
| Amount | Salary | Duration |
|--------|---------|-----------|
| $10,000 | $100 | 12 months |
| $30,000 | $200 | 12 months |
| $50,000 | $400 | 12 months |
| $100,000 | $700 | 12 months |
| $500,000 | $1,500 | 12 months |

## Withdrawal & Registration Details

- Registration is Free
- Withdrawal - 10% Service Fee
- Minimum Withdrawal - $11
- Maximum Withdrawal - Unlimited
- Weekly Withdrawal - Every Monday

## Setup Instructions

1. Clone the repository:
```bash
git clone <repository-url>
cd mlm-website
```

2. Install dependencies:
```bash
npm install
```

3. Create a Firebase project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Get your Firebase configuration

4. Update Firebase configuration:
   - Open `js/config.js`
   - Replace the placeholder values with your Firebase configuration

5. Start the development server:
```bash
npm start
```

## Firebase Setup

1. Authentication:
   - Enable Email/Password authentication
   - Set up security rules

2. Firestore Database:
   - Create the following collections:
     - users
     - transactions
     - withdrawals
   - Set up appropriate security rules

3. Admin Setup:
   - Create an admin user in Firebase Authentication
   - Update the user's role to 'admin' in Firestore

## Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Transactions
    match /transactions/{transactionId} {
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Withdrawals
    match /withdrawals/{withdrawalId} {
      allow read: if request.auth != null && (resource.data.userId == request.auth.uid || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      allow create: if request.auth != null;
      allow update: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 