// Daily Bonus Calculation
async function calculateDailyBonus(userId) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Find active package
        const activePackage = userData.packages.find(p => p.status === 'active');
        if (!activePackage) return;

        // Check if daily bonus is still active
        if (activePackage.dailyBonusCount >= activePackage.duration) {
            // Update package status to completed
            await updatePackageStatus(userId, activePackage.id, 'completed');
            return;
        }

        // Calculate daily bonus
        const dailyBonusAmount = (activePackage.price * activePackage.dailyBonus) / 100;

        // Update user balance and package stats
        await db.collection('users').doc(userId).update({
            balance: firebase.firestore.FieldValue.increment(dailyBonusAmount),
            'packages': userData.packages.map(pkg => {
                if (pkg.id === activePackage.id) {
                    return {
                        ...pkg,
                        dailyBonusCount: pkg.dailyBonusCount + 1,
                        totalEarnings: pkg.totalEarnings + dailyBonusAmount
                    };
                }
                return pkg;
            })
        });

        // Record transaction
        await db.collection('transactions').add({
            userId,
            type: 'Daily Bonus',
            amount: dailyBonusAmount,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId: activePackage.id
        });

    } catch (error) {
        console.error('Error calculating daily bonus:', error);
    }
}

// Level Bonus Calculation
async function calculateLevelBonus(userId, packageId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Get upline users
        const uplineUsers = await getUplineUsers(userId);
        
        // Calculate and distribute level bonuses
        for (let i = 0; i < Math.min(uplineUsers.length, LEVEL_BONUS.length); i++) {
            const uplineUser = uplineUsers[i];
            const bonusPercentage = LEVEL_BONUS[i].percentage;
            const bonusAmount = (amount * bonusPercentage) / 100;

            // Update upline user's balance
            await db.collection('users').doc(uplineUser.id).update({
                balance: firebase.firestore.FieldValue.increment(bonusAmount)
            });

            // Record transaction
            await db.collection('transactions').add({
                userId: uplineUser.id,
                type: `Level ${i + 1} Bonus`,
                amount: bonusAmount,
                date: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'completed',
                packageId,
                fromUserId: userId
            });
        }
    } catch (error) {
        console.error('Error calculating level bonus:', error);
    }
}

// Get Upline Users
async function getUplineUsers(userId) {
    try {
        const uplineUsers = [];
        let currentUserId = userId;

        while (currentUserId) {
            const userDoc = await db.collection('users').doc(currentUserId).get();
            const userData = userDoc.data();

            if (!userData.referredBy) break;

            const referrerDoc = await db.collection('users')
                .where('referralCode', '==', userData.referredBy)
                .get();

            if (referrerDoc.empty) break;

            const referrerData = referrerDoc.docs[0].data();
            uplineUsers.push({
                id: referrerDoc.docs[0].id,
                ...referrerData
            });

            currentUserId = referrerDoc.docs[0].id;
        }

        return uplineUsers;
    } catch (error) {
        console.error('Error getting upline users:', error);
        return [];
    }
}

// Update Package Status
async function updatePackageStatus(userId, packageId, status) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        await db.collection('users').doc(userId).update({
            'packages': userData.packages.map(pkg => {
                if (pkg.id === packageId) {
                    return { ...pkg, status };
                }
                return pkg;
            })
        });
    } catch (error) {
        console.error('Error updating package status:', error);
    }
}

// Calculate MB Bonus
async function calculateMBBonus(userId, packageId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Find active package
        const activePackage = userData.packages.find(p => p.id === packageId);
        if (!activePackage) return;

        // Calculate MB bonus (3X daily bonus for 7 days)
        const mbBonusAmount = (amount * 3) / 100;
        const mbBonusDuration = 7;

        // Update user balance
        await db.collection('users').doc(userId).update({
            balance: firebase.firestore.FieldValue.increment(mbBonusAmount)
        });

        // Record transaction
        await db.collection('transactions').add({
            userId,
            type: 'MB Bonus',
            amount: mbBonusAmount,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId
        });

        // Schedule MB bonus for next 6 days
        for (let i = 1; i < mbBonusDuration; i++) {
            setTimeout(async () => {
                await db.collection('users').doc(userId).update({
                    balance: firebase.firestore.FieldValue.increment(mbBonusAmount)
                });

                await db.collection('transactions').add({
                    userId,
                    type: 'MB Bonus',
                    amount: mbBonusAmount,
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'completed',
                    packageId
                });
            }, i * 24 * 60 * 60 * 1000); // Schedule for each day
        }
    } catch (error) {
        console.error('Error calculating MB bonus:', error);
    }
}

// Calculate DRB Bonus
async function calculateDRBBonus(userId, packageId, amount) {
    try {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.data();

        // Find active package
        const activePackage = userData.packages.find(p => p.id === packageId);
        if (!activePackage) return;

        // Calculate DRB bonus (1% daily for 100 days)
        const drbBonusAmount = amount / 100;
        const drbBonusDuration = 100;

        // Update user balance
        await db.collection('users').doc(userId).update({
            balance: firebase.firestore.FieldValue.increment(drbBonusAmount)
        });

        // Record transaction
        await db.collection('transactions').add({
            userId,
            type: 'DRB Bonus',
            amount: drbBonusAmount,
            date: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'completed',
            packageId
        });

        // Schedule DRB bonus for next 99 days
        for (let i = 1; i < drbBonusDuration; i++) {
            setTimeout(async () => {
                await db.collection('users').doc(userId).update({
                    balance: firebase.firestore.FieldValue.increment(drbBonusAmount)
                });

                await db.collection('transactions').add({
                    userId,
                    type: 'DRB Bonus',
                    amount: drbBonusAmount,
                    date: firebase.firestore.FieldValue.serverTimestamp(),
                    status: 'completed',
                    packageId
                });
            }, i * 24 * 60 * 60 * 1000); // Schedule for each day
        }
    } catch (error) {
        console.error('Error calculating DRB bonus:', error);
    }
}

// Export functions
window.calculateDailyBonus = calculateDailyBonus;
window.calculateLevelBonus = calculateLevelBonus;
window.calculateMBBonus = calculateMBBonus;
window.calculateDRBBonus = calculateDRBBonus; 