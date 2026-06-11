from flask import Flask, render_template, request, redirect, url_for, jsonify, session
import mysql.connector
from mysql.connector import Error
import hashlib
from functools import wraps

app = Flask(__name__)
app.secret_key = 'finboard_secret_key_change_in_production'

# ── DB CONFIG — change these to match your MySQL setup ───────────────────────
DB_CONFIG = {
    'host':     '127.0.0.1',
    'port':     3305,
    'user':     'root',
    'passwd':   '',        # ← put your MySQL password here if you have one
    'database': 'my_database'
}

# ── DB CONNECTION — fresh connection per request, no silent failures ──────────
def get_db():
    """Returns a fresh (connection, cursor) pair. Raises on failure."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cur  = conn.cursor()
        return conn, cur
    except Error as e:
        raise RuntimeError(f"Cannot connect to MySQL: {e}\n"
                           f"Make sure MySQL is running and 'my_db' database exists.\n"
                           f"Run: Get-Content schema.sql | mysql -u root -p")

# ── PASSWORD HASHING ──────────────────────────────────────────────────────────
def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

# ── AUTH HELPERS ──────────────────────────────────────────────────────────────
def create_user(name, email, password):
    """Returns True if created, False if email already exists."""
    conn, cur = get_db()
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return False
        cur.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s)",
            (name.strip(), email.strip().lower(), hash_password(password))
        )
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()

def verify_user(email, password):
    """Returns user dict if credentials valid, else None."""
    conn, cur = get_db()
    try:
        cur.execute(
            "SELECT id, name, email FROM users WHERE email = %s AND password_hash = %s",
            (email.strip().lower(), hash_password(password))
        )
        row = cur.fetchone()
        if row:
            return {'id': row[0], 'name': row[1], 'email': row[2]}
        return None
    finally:
        cur.close()
        conn.close()

# ── AUTH DECORATOR ────────────────────────────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

# ── DATA HELPERS ──────────────────────────────────────────────────────────────
def insert_account(card_number, card_name, expiry_date, cvv, amount):
    conn, cur = get_db()
    try:
        cur.execute(
            "INSERT INTO account (card_number, card_name, expiry_date, cvv, amount) VALUES (%s, %s, %s, %s, %s)",
            (card_number, card_name, expiry_date, cvv, float(amount))
        )
        conn.commit()
    finally:
        cur.close(); conn.close()

def insert_transaction(account_name, goal, payment_type, payment_date, amount):
    conn, cur = get_db()
    try:
        cur.execute(
            "INSERT INTO transaction (account_name, goal, payment_type, payment_date, amount) VALUES (%s, %s, %s, %s, %s)",
            (account_name.strip(), goal.strip(), payment_type.strip(), payment_date.strip(), float(amount))
        )
        conn.commit()
    finally:
        cur.close(); conn.close()

def insert_bill(bill_name, due_date, amount, item_description):
    conn, cur = get_db()
    try:
        cur.execute(
            "INSERT INTO bill (bill_name, due_date, amount, item_description) VALUES (%s, %s, %s, %s)",
            (bill_name.strip(), due_date.strip(), float(amount), item_description.strip())
        )
        conn.commit()
    finally:
        cur.close(); conn.close()

def insert_goal(goal_name, goal_target):
    conn, cur = get_db()
    try:
        cur.execute(
            "INSERT INTO goal (goal_name, goal_target) VALUES (%s, %s)",
            (goal_name.strip(), float(goal_target))
        )
        conn.commit()
    finally:
        cur.close(); conn.close()

def get_card_balance(card_number):
    conn, cur = get_db()
    try:
        cur.execute("SELECT amount FROM account WHERE card_number = %s", (card_number,))
        row = cur.fetchone()
        return float(row[0]) if row else 0.0
    finally:
        cur.close(); conn.close()

def update_balance(card_number, amount_change):
    new_balance = get_card_balance(card_number) + amount_change
    conn, cur = get_db()
    try:
        cur.execute("UPDATE account SET amount = %s WHERE card_number = %s", (new_balance, card_number))
        conn.commit()
    finally:
        cur.close(); conn.close()
    return new_balance

# ── ROUTES ────────────────────────────────────────────────────────────────────
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    error = None
    if request.method == 'POST':
        name     = request.form.get('signupname', '').strip()
        email    = request.form.get('signupEmail', '').strip()
        password = request.form.get('signupPassword', '')

        if not name or not email or not password:
            error = 'Please fill in all fields.'
        elif len(password) < 6:
            error = 'Password must be at least 6 characters.'
        else:
            if create_user(name, email, password):
                return redirect(url_for('login') + '?registered=1')
            else:
                error = 'An account with this email already exists.'

    return render_template('signup.html', error=error)

@app.route('/login', methods=['GET', 'POST'])
def login():
    error      = None
    registered = request.args.get('registered')

    if request.method == 'POST':
        email    = request.form.get('loginEmail', '').strip()
        password = request.form.get('loginPassword', '')

        if not email or not password:
            error = 'Please fill in both fields.'
        else:
            user = verify_user(email, password)
            if not user:
                error = 'Incorrect email or password.'
            else:
                session['user_id']    = user['id']
                session['user_name']  = user['name']
                session['user_email'] = user['email']
                return redirect(url_for('interface'))

    return render_template('login.html', error=error, registered=registered)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/interface')
@login_required
def interface():
    return render_template('interface.html', user_name=session.get('user_name', 'User'))

# ── DATA ROUTES ───────────────────────────────────────────────────────────────
@app.route('/add_account', methods=['POST'])
@login_required
def add_account():
    insert_account(
        request.form['cardNumber'], request.form['cardName'],
        request.form['expiryDate'], request.form['cvv'].strip(),
        request.form['amount']
    )
    return redirect(url_for('interface'))

@app.route('/add_transaction', methods=['POST'])
@login_required
def add_transaction():
    goal    = request.form['goal']
    amount  = float(request.form['transactionAmount'])
    account = request.form['accountName']
    if goal == 'Withdraw':
        update_balance(account.strip(), -amount)
    elif goal == 'Deposit':
        update_balance(account.strip(), amount)
    insert_transaction(account, goal, request.form['paymentType'], request.form['paymentDate'], amount)
    return redirect(url_for('interface'))

@app.route('/add_bill', methods=['POST'])
@login_required
def add_bill():
    insert_bill(
        request.form['billName'], request.form['dueDate'],
        request.form['billamount'], request.form['itemDescription']
    )
    return redirect(url_for('interface'))

@app.route('/add_goal', methods=['POST'])
@login_required
def add_goal():
    insert_goal(request.form['goalName'], request.form['goalTarget'])
    return redirect(url_for('interface'))

# ── JSON API ──────────────────────────────────────────────────────────────────
@app.route('/get_total_balance')
@login_required
def get_total_balance():
    conn, cur = get_db()
    try:
        cur.execute("SELECT COALESCE(SUM(amount), 0) FROM account")
        return jsonify({'balance': float(cur.fetchone()[0])})
    finally:
        cur.close(); conn.close()

@app.route('/get_upcoming_bills')
@login_required
def get_upcoming_bills():
    conn, cur = get_db()
    try:
        cur.execute("SELECT bill_name, due_date, amount FROM bill WHERE due_date >= CURDATE() ORDER BY due_date ASC")
        bills = cur.fetchall()
        return jsonify([{'bill_name': b[0], 'due_date': str(b[1]), 'amount': float(b[2])} for b in bills])
    finally:
        cur.close(); conn.close()

@app.route('/get_recent_transactions')
@login_required
def get_recent_transactions():
    conn, cur = get_db()
    try:
        cur.execute("SELECT payment_date, payment_type, amount FROM transaction ORDER BY payment_date DESC LIMIT 5")
        rows = cur.fetchall()
        return jsonify([{'date': str(r[0]), 'type': r[1], 'amount': float(r[2])} for r in rows])
    finally:
        cur.close(); conn.close()

@app.route('/get_transactions')
@login_required
def get_transactions():
    conn, cur = get_db()
    try:
        cur.execute("SELECT payment_date, payment_type, amount, goal FROM transaction ORDER BY payment_date DESC")
        rows = cur.fetchall()
        return jsonify([{'date': str(r[0]), 'type': r[1], 'amount': float(r[2]), 'category': r[3]} for r in rows])
    finally:
        cur.close(); conn.close()

if __name__ == '__main__':
    app.run(debug=True)
