/* ═══════════════════════════════════════════════════════════════════
   FinBoard — intscript.js   (v3 — fully fixed)
   Fixes in this version:
   1. Scroll works — layout is CSS-driven, JS untouched
   2. Future transaction dates blocked (max = today)
   3. Notification bell opens a panel with all notification history
   4. Search bar filters transactions, bills, cards live
   5. Credit sign bug fixed (+/- shown correctly)
   6. All previous validation fixes retained
═══════════════════════════════════════════════════════════════════ */

/* ── STATE ───────────────────────────────────────────────────────── */
let transactions  = [];
let goals         = [];
let notifications = [];   // history for bell panel
let expChart      = null;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ════════════════════════════════════════════════════════════════════
   DATE HELPERS — FIX 2: block future dates on transaction input
════════════════════════════════════════════════════════════════════ */
function todayStr() {
    // returns "YYYY-MM-DD" in local time (not UTC)
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

function setDateConstraints() {
    const today = todayStr();
    // Transaction date: max = today (cannot log a future transaction)
    const txDate = document.getElementById('paymentDate');
    if (txDate) txDate.max = today;
    // Bill due date: min = today (bills should be upcoming)
    const billDate = document.getElementById('dueDate');
    if (billDate) billDate.min = today;
}

/* ════════════════════════════════════════════════════════════════════
   VALIDATION HELPERS
════════════════════════════════════════════════════════════════════ */
function fieldError(inputId, msg) {
    clearFieldError(inputId);
    const el  = document.getElementById(inputId);
    if (!el) return;
    const err = document.createElement('span');
    err.className   = 'field-error';
    err.textContent = msg;
    el.parentNode.appendChild(err);
    el.classList.add('input-error');
}
function clearFieldError(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.classList.remove('input-error');
    const old = el.parentNode.querySelector('.field-error');
    if (old) old.remove();
}
function clearAllErrors(formId) {
    document.querySelectorAll('#' + formId + ' .field-error').forEach(e => e.remove());
    document.querySelectorAll('#' + formId + ' .input-error').forEach(e => e.classList.remove('input-error'));
}

function isNumericOnly(str)   { return /^\d+$/.test(str); }
function isValidExpiry(val) {
    if (!/^\d{2}\/\d{2}$/.test(val)) return false;
    const [mm, yy] = val.split('/').map(Number);
    if (mm < 1 || mm > 12) return false;
    const now     = new Date();
    const expiry  = new Date(2000 + yy, mm - 1, 1);
    const current = new Date(now.getFullYear(), now.getMonth(), 1);
    return expiry >= current;
}

/* ════════════════════════════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════════════════════════════ */
function navigate(sectionId, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (el) el.classList.add('active');

    const titles = {
        dashboardContent:    'Dashboard',
        balancesContent:     'Balances',
        transactionsContent: 'Transactions',
        billsContent:        'Upcoming Bills',
        expensesContent:     'Monthly Expenses',
        goalsContent:        'Financial Goals'
    };
    document.getElementById('pageTitle').textContent = titles[sectionId] || '';

    // clear search when switching sections
    const si = document.getElementById('searchInput');
    if (si) { si.value = ''; }
    document.getElementById('searchNoResult').style.display = 'none';

    if (sectionId === 'dashboardContent') refreshDashboard();
    if (sectionId === 'expensesContent')  refreshExpensesPage();
    if (sectionId === 'goalsContent')     updateGoalsDisplay();

    // scroll back to top on section change
    document.getElementById('pageContent').scrollTop = 0;

    return false;
}

/* ════════════════════════════════════════════════════════════════════
   DIALOG HELPERS
════════════════════════════════════════════════════════════════════ */
function openDialog(id) {
    document.getElementById(id).classList.add('active');
    closeNotifPanel();
    if (id === 'transactionDialogBox') populateAccountDropdown();
}

function populateAccountDropdown() {
    const select = document.getElementById('accountName');
    const rows   = Array.from(document.querySelectorAll('#balancesTableBody tr'))
        .filter(r => r.cells.length > 1);
    select.innerHTML = '<option value="" disabled selected>Select Account</option>';
    if (!rows.length) {
        const opt = document.createElement('option');
        opt.disabled     = true;
        opt.textContent  = '— Add a card first under Balances —';
        select.appendChild(opt);
        return;
    }
    rows.forEach(r => {
        const opt       = document.createElement('option');
        opt.value       = r.cells[1].textContent; // card name
        opt.textContent = r.cells[1].textContent;
        select.appendChild(opt);
    });
}
function closeDialog(id) {
    document.getElementById(id).classList.remove('active');
}
document.querySelectorAll('.dialog-box').forEach(box => {
    box.addEventListener('click', function(e) {
        if (e.target === box) box.classList.remove('active');
    });
});

/* ════════════════════════════════════════════════════════════════════
   NOTIFICATION BELL PANEL — FIX 3
════════════════════════════════════════════════════════════════════ */
function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    panel.classList.toggle('open');
}
function closeNotifPanel() {
    document.getElementById('notifPanel').classList.remove('open');
}
// Close panel when clicking outside
document.addEventListener('click', function(e) {
    const wrap = document.querySelector('.bell-wrap');
    if (wrap && !wrap.contains(e.target)) closeNotifPanel();
});

/** Add to bell history AND show inline banner */
function pushNotification(message, type) {
    // type: 'success' | 'warn' | 'error'
    const icons = { success: '✅', warn: '⚠️', error: '❌' };
    const now   = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    notifications.unshift({ message, type, time: timeStr });

    // update bell panel
    renderNotifPanel();

    // show red dot on bell
    document.getElementById('notifDot').style.display = 'block';

    // show inline banner
    const area = document.getElementById('notificationArea');
    document.getElementById('notifIcon').textContent = icons[type] || '⚠️';
    document.getElementById('notificationMessage').textContent = message;
    area.className = 'show';
    if (type === 'error')   area.classList.add('notif-error');
    if (type === 'success') area.classList.add('notif-success');

    // auto-hide banner after 4s
    clearTimeout(area._timer);
    area._timer = setTimeout(() => { area.className = ''; }, 4000);
}

function renderNotifPanel() {
    const list = document.getElementById('notifList');
    if (!notifications.length) {
        list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
        return;
    }
    const icons = { success: '✅', warn: '⚠️', error: '❌' };
    list.innerHTML = notifications.map(n =>
        `<div class="notif-item">
            <span class="notif-icon">${icons[n.type] || '🔔'}</span>
            <div>
                <div class="notif-text">${escHtml(n.message)}</div>
                <div class="notif-time">${n.time}</div>
            </div>
        </div>`
    ).join('');
}

function clearAllNotifications() {
    notifications = [];
    renderNotifPanel();
    document.getElementById('notifDot').style.display = 'none';
    closeNotifPanel();
}

function closeNotification() {
    document.getElementById('notificationArea').className = '';
}

/* ════════════════════════════════════════════════════════════════════
   SEARCH — FIX 4
   Searches across: transactions table, bills table, balances table
════════════════════════════════════════════════════════════════════ */
function handleSearch(query) {
    const q = query.trim().toLowerCase();
    const noResult = document.getElementById('searchNoResult');

    if (!q) {
        // restore all hidden rows
        document.querySelectorAll('tbody tr.search-hidden').forEach(r => {
            r.classList.remove('search-hidden');
            r.style.display = '';
        });
        document.querySelectorAll('.mini-list-item.search-hidden').forEach(r => {
            r.classList.remove('search-hidden');
            r.style.display = '';
        });
        noResult.style.display = 'none';
        return;
    }

    let totalVisible = 0;

    // search all table rows across all sections
    document.querySelectorAll('tbody tr').forEach(row => {
        if (row.cells.length <= 1) return; // skip empty-state rows
        const text = row.textContent.toLowerCase();
        if (text.includes(q)) {
            row.style.display = '';
            row.classList.remove('search-hidden');
            totalVisible++;
        } else {
            row.style.display = 'none';
            row.classList.add('search-hidden');
        }
    });

    // search dashboard mini-lists
    document.querySelectorAll('.mini-list-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        if (text.includes(q)) {
            item.style.display = '';
            item.classList.remove('search-hidden');
            totalVisible++;
        } else {
            item.style.display = 'none';
            item.classList.add('search-hidden');
        }
    });

    noResult.style.display = totalVisible === 0 ? 'block' : 'none';
}

/* ════════════════════════════════════════════════════════════════════
   ADD ACCOUNT
════════════════════════════════════════════════════════════════════ */
document.getElementById('addAccountForm').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors('addAccountForm');

    const cardNumber = document.getElementById('cardNumber').value.trim();
    const cardName   = document.getElementById('cardName').value.trim();
    const expiryDate = document.getElementById('expiryDate').value.trim();
    const cvv        = document.getElementById('cvv').value.trim();
    const amountRaw  = document.getElementById('amount').value.trim();

    let hasError = false;

    const cardDigits = cardNumber.replace(/\s/g, '');
    if (!cardNumber) {
        fieldError('cardNumber', 'Card number is required.'); hasError = true;
    } else if (!isNumericOnly(cardDigits)) {
        fieldError('cardNumber', 'Card number must contain digits only.'); hasError = true;
    } else if (cardDigits.length !== 16) {
        fieldError('cardNumber', 'Card number must be exactly 16 digits.'); hasError = true;
    } else {
        const existing = Array.from(document.querySelectorAll('#balancesTableBody tr'))
            .filter(r => r.cells.length > 1)
            .map(r => r.cells[0].textContent.replace(/\s/g, ''));
        if (existing.includes(cardDigits)) {
            fieldError('cardNumber', 'This card number already exists.'); hasError = true;
        }
    }

    if (!cardName || cardName.length < 2) {
        fieldError('cardName', cardName ? 'Name is too short.' : 'Card name is required.'); hasError = true;
    }

    if (!expiryDate) {
        fieldError('expiryDate', 'Expiry date is required.'); hasError = true;
    } else if (!isValidExpiry(expiryDate)) {
        fieldError('expiryDate', 'Use MM/YY format. Card must not be expired.'); hasError = true;
    }

    if (!cvv) {
        fieldError('cvv', 'CVV is required.'); hasError = true;
    } else if (!isNumericOnly(cvv) || cvv.length !== 3) {
        fieldError('cvv', 'CVV must be exactly 3 digits.'); hasError = true;
    }

    const amount = parseFloat(amountRaw);
    if (amountRaw === '' || isNaN(amount)) {
        fieldError('amount', 'Balance amount is required.'); hasError = true;
    } else if (amount < 0) {
        fieldError('amount', 'Balance cannot be negative.'); hasError = true;
    }

    if (hasError) return;

    const tbody = document.getElementById('balancesTableBody');
    if (tbody.rows[0] && tbody.rows[0].cells.length === 1) tbody.deleteRow(0);

    const row = tbody.insertRow(0);
    row.insertCell(0).textContent = cardNumber;
    row.insertCell(1).textContent = cardName;
    row.insertCell(2).textContent = expiryDate;
    row.insertCell(3).textContent = '***';
    const amtCell = row.insertCell(4);
    amtCell.textContent = amount.toFixed(2);
    amtCell.className   = 'amount-blue';

    updateTotalBalance();
    updateGoalsDisplay();
    closeDialog('dialogBox');
    this.reset();
    ['cardNumberDisplay','cardNameDisplay','expiryDateDisplay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    pushNotification(`Card ending in ${cardNumber.slice(-4)} added successfully.`, 'success');
});

/* ════════════════════════════════════════════════════════════════════
   ADD TRANSACTION
════════════════════════════════════════════════════════════════════ */
document.getElementById('addTransactionForm').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors('addTransactionForm');

    const accountName       = document.getElementById('accountName').value;
    const goal              = document.getElementById('goal').value;
    const paymentType       = document.getElementById('paymentType').value;
    const paymentDate       = document.getElementById('paymentDate').value;
    const amountRaw         = document.getElementById('transactionAmount').value.trim();

    let hasError = false;

    if (!accountName) { fieldError('accountName', 'Please select an account.'); hasError = true; }
    if (!goal)         { fieldError('goal',        'Please select a goal.');     hasError = true; }
    if (!paymentType)  { fieldError('paymentType', 'Please select payment type.'); hasError = true; }

    // FIX 2: date must exist and must not be in future
    if (!paymentDate) {
        fieldError('paymentDate', 'Please select a date.'); hasError = true;
    } else if (paymentDate > todayStr()) {
        fieldError('paymentDate', 'Transaction date cannot be in the future.'); hasError = true;
    }

    const transactionAmount = parseFloat(amountRaw);
    if (amountRaw === '' || isNaN(transactionAmount)) {
        fieldError('transactionAmount', 'Amount is required.'); hasError = true;
    } else if (transactionAmount <= 0) {
        fieldError('transactionAmount', 'Amount must be greater than zero.'); hasError = true;
    }

    if (hasError) return;

    // account must exist in balances
    const balanceRows = Array.from(document.querySelectorAll('#balancesTableBody tr'))
        .filter(r => r.cells.length > 1);
    const matchRow = balanceRows.find(r => r.cells[1].textContent === accountName);
    if (!matchRow) {
        fieldError('accountName', `"${accountName}" not found. Add this card first under Balances.`);
        return;
    }

    // FIX 5: Credit/Debit sign — Deposit = money coming IN (Credit), everything else = Debit
    const txnType = goal === 'Deposit' ? 'Credit' : 'Debit';

    transactions.push({
        date: paymentDate, type: txnType,
        amount: transactionAmount, category: goal,
        account: accountName, paymentType: paymentType
    });

    // table row
    const tbody = document.getElementById('transactionsTableBody');
    if (tbody.rows[0] && tbody.rows[0].cells.length === 1) tbody.deleteRow(0);
    const row = tbody.insertRow(0);
    row.insertCell(0).textContent = accountName;
    row.insertCell(1).textContent = goal;
    row.insertCell(2).textContent = paymentType;
    row.insertCell(3).textContent = paymentDate;
    const amtCell = row.insertCell(4);
    // FIX 5: show correct sign in table
    amtCell.textContent = (txnType === 'Credit' ? '+' : '-') + '₹' + transactionAmount.toFixed(2);
    amtCell.className   = txnType === 'Credit' ? 'amount-credit' : 'amount-debit';

    // update card balance
    let currentBal = parseFloat(matchRow.cells[4].textContent);
    if (goal === 'Deposit')  currentBal += transactionAmount;
    if (goal === 'Withdraw') currentBal -= transactionAmount;
    matchRow.cells[4].textContent = currentBal.toFixed(2);

    updateTotalBalance();
    updateMonthlyStats();
    updateGoalsDisplay();
    closeDialog('transactionDialogBox');
    this.reset();
    setDateConstraints();
    pushNotification(`${goal} of ₹${transactionAmount.toFixed(2)} added for ${accountName}.`, 'success');
});

/* ════════════════════════════════════════════════════════════════════
   ADD BILL
════════════════════════════════════════════════════════════════════ */
document.getElementById('addBillForm').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors('addBillForm');

    const billName        = document.getElementById('billName').value.trim();
    const itemDescription = document.getElementById('itemDescription').value.trim();
    const dueDateValue    = document.getElementById('dueDate').value;
    const amountRaw       = document.getElementById('billamount').value.trim();

    let hasError = false;
    if (!billName)        { fieldError('billName',        'Bill name is required.'); hasError = true; }
    if (!itemDescription) { fieldError('itemDescription', 'Description is required.'); hasError = true; }
    if (!dueDateValue)    { fieldError('dueDate',         'Due date is required.'); hasError = true; }

    const billAmount = parseFloat(amountRaw);
    if (amountRaw === '' || isNaN(billAmount)) {
        fieldError('billamount', 'Amount is required.'); hasError = true;
    } else if (billAmount <= 0) {
        fieldError('billamount', 'Amount must be greater than zero.'); hasError = true;
    }

    if (hasError) return;

    // parse date correctly (avoid UTC off-by-one)
    const dueDate = new Date(dueDateValue + 'T00:00:00');

    // duplicate check
    const billRows = Array.from(document.querySelectorAll('#billsTableBody tr')).filter(r => r.cells.length > 1);
    const isDup = billRows.some(r =>
        r.cells[0].textContent === billName &&
        r.cells[2].textContent === dueDate.toLocaleDateString()
    );
    if (isDup) { fieldError('billName', `"${billName}" with this due date already exists.`); return; }

    const tbody = document.getElementById('billsTableBody');
    if (tbody.rows[0] && tbody.rows[0].cells.length === 1) tbody.deleteRow(0);
    const row = tbody.insertRow();
    row.insertCell(0).textContent = billName;
    row.insertCell(1).textContent = itemDescription;
    row.insertCell(2).textContent = dueDate.toLocaleDateString();
    const amtCell = row.insertCell(3);
    amtCell.textContent = '₹' + billAmount.toFixed(2);
    amtCell.className   = 'amount-blue';

    // due-soon warning (≤7 days)
    const today = new Date(); today.setHours(0,0,0,0);
    const diff  = (dueDate - today) / 86400000;
    if (diff >= 0 && diff <= 7) {
        pushNotification(`⚠️ "${billName}" is due on ${dueDate.toLocaleDateString()} — within 7 days!`, 'warn');
    } else {
        pushNotification(`Bill "${billName}" (₹${billAmount.toFixed(2)}) added.`, 'success');
    }

    updateUpcomingBills();
    closeDialog('billDialogBox');
    this.reset();
    setDateConstraints();
});

/* ════════════════════════════════════════════════════════════════════
   ADD GOAL
════════════════════════════════════════════════════════════════════ */
document.getElementById('addGoalForm').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAllErrors('addGoalForm');

    const goalName  = document.getElementById('goalName').value.trim();
    const amountRaw = document.getElementById('goalTarget').value.trim();

    let hasError = false;
    if (!goalName) { fieldError('goalName', 'Goal name is required.'); hasError = true; }

    const goalTarget = parseFloat(amountRaw);
    if (amountRaw === '' || isNaN(goalTarget)) {
        fieldError('goalTarget', 'Target amount is required.'); hasError = true;
    } else if (goalTarget <= 0) {
        fieldError('goalTarget', 'Target must be greater than zero.'); hasError = true;
    }

    if (hasError) return;

    goals.push({ name: goalName, target: goalTarget });
    document.getElementById('statGoals').textContent = goals.length;
    updateGoalsDisplay();
    checkGoalAchievement();
    closeDialog('goalDialogBox');
    this.reset();
    pushNotification(`Goal "${goalName}" (₹${goalTarget.toFixed(2)}) set!`, 'success');
});

/* ════════════════════════════════════════════════════════════════════
   BALANCE HELPERS
════════════════════════════════════════════════════════════════════ */
function getTotalBalance() {
    return Array.from(document.querySelectorAll('#balancesTableBody tr'))
        .filter(r => r.cells.length > 1)
        .reduce((s, r) => s + (parseFloat(r.cells[4].textContent) || 0), 0);
}
function updateTotalBalance() {
    document.getElementById('totalBalance').textContent = '₹' + getTotalBalance().toFixed(2);
}
function updateMonthlyStats() {
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    let credits = 0, debits = 0;
    transactions.forEach(t => {
        const d = new Date(t.date);
        if (d.getMonth() === m && d.getFullYear() === y) {
            if (t.type === 'Credit') credits += t.amount;
            else                      debits  += t.amount;
        }
    });
    document.getElementById('statCredits').textContent = '₹' + credits.toFixed(2);
    document.getElementById('statDebits').textContent  = '₹' + debits.toFixed(2);
}

/* ════════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════════ */
function refreshDashboard() {
    updateTotalBalance();
    updateMonthlyStats();
    updateUpcomingBills();
    updateRecentTransactions();
    updateExpenseBreakdown('dashboard');
}

function updateUpcomingBills() {
    const rows = Array.from(document.querySelectorAll('#billsTableBody tr')).filter(r => r.cells.length > 1);
    const el   = document.getElementById('dashBillsList');
    if (!rows.length) { el.innerHTML = '<div class="empty-state">No bills added yet</div>'; return; }
    el.innerHTML = rows.slice(0, 4).map(r =>
        `<div class="mini-list-item">
            <div>
                <div class="mini-label">${escHtml(r.cells[0].textContent)}</div>
                <div class="mini-sub">${escHtml(r.cells[2].textContent)}</div>
            </div>
            <span class="mini-amount">${escHtml(r.cells[3].textContent)}</span>
        </div>`
    ).join('');
}

function updateRecentTransactions() {
    const el = document.getElementById('dashTxnsList');
    if (!transactions.length) { el.innerHTML = '<div class="empty-state">No transactions yet</div>'; return; }
    // FIX 5: correct sign display
    el.innerHTML = [...transactions].reverse().slice(0, 5).map(t =>
        `<div class="mini-list-item">
            <div>
                <div class="mini-label">${escHtml(t.account)}</div>
                <div class="mini-sub">${escHtml(t.date)} · ${escHtml(t.paymentType)}</div>
            </div>
            <span class="mini-amount ${t.type === 'Credit' ? 'amount-credit' : 'amount-debit'}">
                ${t.type === 'Credit' ? '+' : '-'}₹${t.amount.toFixed(2)}
            </span>
        </div>`
    ).join('');
}

function updateExpenseBreakdown(section) {
    const data = processTransactions();
    const elId = section === 'dashboard' ? 'expenseBreakdown' : 'expensesBreakdown';
    const el   = document.getElementById(elId);
    if (!data.totalDebits) { el.innerHTML = '<div class="empty-state">No debit transactions yet</div>'; return; }
    el.innerHTML = Object.entries(data.categories).map(([cat, amt]) =>
        `<div class="breakdown-item">
            <span class="breakdown-label">${escHtml(cat)}</span>
            <div class="breakdown-bar-wrap">
                <div class="breakdown-bar" style="width:${(amt / data.totalDebits * 100).toFixed(0)}%"></div>
            </div>
            <span class="breakdown-pct">${(amt / data.totalDebits * 100).toFixed(1)}% · ₹${amt.toFixed(0)}</span>
        </div>`
    ).join('');
}

/* ════════════════════════════════════════════════════════════════════
   EXPENSES PAGE
════════════════════════════════════════════════════════════════════ */
function refreshExpensesPage() {
    const data = processTransactions();
    const canvas = document.getElementById('expensesChart');
    if (expChart) { expChart.destroy(); expChart = null; }
    expChart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: MONTHS,
            datasets: [
                {
                    label: 'Credits',
                    data: data.credits,
                    backgroundColor: 'rgba(41,82,204,0.18)',
                    borderColor: 'rgba(41,82,204,0.8)',
                    borderWidth: 1.5, borderRadius: 4
                },
                {
                    label: 'Debits',
                    data: data.debits,
                    backgroundColor: 'rgba(192,57,43,0.15)',
                    borderColor: 'rgba(192,57,43,0.75)',
                    borderWidth: 1.5, borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true } }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { family: 'DM Sans', size: 11 } } },
                x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } }
            }
        }
    });
    updateExpenseBreakdown('expenses');
}

/* ════════════════════════════════════════════════════════════════════
   GOALS
════════════════════════════════════════════════════════════════════ */
function updateGoalsDisplay() {
    const el    = document.getElementById('goalsTableBody');
    const total = getTotalBalance();
    if (!goals.length) { el.innerHTML = '<div class="empty-state">No goals set yet</div>'; return; }
    el.innerHTML = goals.map(g => {
        const pct = Math.min(100, (total / g.target) * 100).toFixed(0);
        return `<div class="goal-item">
            <div class="goal-header">
                <span>${escHtml(g.name)}</span>
                <span style="color:var(--text3)">₹${total.toFixed(2)} / ₹${g.target.toFixed(2)}</span>
            </div>
            <div class="goal-bar-wrap"><div class="goal-bar" style="width:${pct}%"></div></div>
            <div class="goal-sub">${pct}% of target reached</div>
        </div>`;
    }).join('');
}

function checkGoalAchievement() {
    const total = getTotalBalance();
    goals.forEach(g => {
        if (g.target > 0 && total >= g.target) {
            pushNotification(`🎉 Goal achieved: "${g.name}" — ₹${g.target.toFixed(2)}!`, 'success');
        }
    });
}

/* ════════════════════════════════════════════════════════════════════
   TRANSACTION PROCESSOR
════════════════════════════════════════════════════════════════════ */
function processTransactions() {
    const data = { credits: new Array(12).fill(0), debits: new Array(12).fill(0), categories: {}, totalDebits: 0 };
    transactions.forEach(t => {
        const m = new Date(t.date).getMonth();
        if (t.type === 'Credit') {
            data.credits[m] += t.amount;
        } else {
            data.debits[m]   += t.amount;
            data.totalDebits += t.amount;
            data.categories[t.category] = (data.categories[t.category] || 0) + t.amount;
        }
    });
    return data;
}

/* ════════════════════════════════════════════════════════════════════
   CARD PREVIEW MIRROR (bidirectional — preview ↔ form fields)
════════════════════════════════════════════════════════════════════ */
function mirrorToPreview(srcId, destId) {
    const src  = document.getElementById(srcId);
    const dest = document.getElementById(destId);
    if (src && dest) dest.value = src.value;
}

/* ════════════════════════════════════════════════════════════════════
   UTILITY
════════════════════════════════════════════════════════════════════ */
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ════════════════════════════════════════════════════════════════════
   GREETING & DATE
════════════════════════════════════════════════════════════════════ */
function displayGreeting() {
    // Name is rendered by Flask from session directly in the HTML.
    // Here we just derive initials from whatever text is already in #greeting.
    const name     = document.getElementById('greeting').textContent.trim() || 'U';
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('avatarInitials').textContent = initials;
}
function displayDate() {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dateDisplay').textContent = new Date().toLocaleDateString('en-US', opts);
}

/* ════════════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════════ */
window.onload = function () {
    displayDate();
    displayGreeting();
    setDateConstraints();   // FIX 2: set max/min on date pickers
    refreshDashboard();
};
