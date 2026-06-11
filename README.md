# FinBoard — Personal Finance Tracker

A full-stack personal finance web application built with Flask and MySQL. Manage cards, track transactions, monitor bills, set financial goals, and visualize monthly expenses — all behind secure login authentication.

## 🚀 Features

- Secure signup/login with SHA-256 password hashing
- Add and manage multiple credit/debit cards
- Record transactions with credit/debit tracking
- Add upcoming bills with due-date reminders
- Set financial goals with progress bars
- Monthly expense chart (credits vs debits by month)
- Category-wise expense breakdown
- Live search across transactions, bills, and cards
- Notification bell with full history
- Responsive sidebar dashboard layout

## 🛠 Tech Stack

- Python (Flask)
- MySQL (via mysql-connector-python)
- HTML, CSS, JavaScript
- Chart.js

## ⚙️ How It Works

1. User signs up — credentials stored securely with hashed password in MySQL
2. After login, user is taken to the dashboard with stats, recent transactions, and upcoming bills
3. Cards are added under Balances — balance updates automatically on each transaction
4. Bills trigger a warning notification if due within 7 days
5. Expenses page renders a Chart.js bar chart from transaction history

## 🗄 Database Setup

1. Open phpMyAdmin → `http://localhost/phpmyadmin`
2. Create a database named `my_database`
3. Click on `my_database` → SQL tab → paste and run:

```sql
CREATE TABLE IF NOT EXISTS users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS account (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    card_number VARCHAR(20)  NOT NULL,
    card_name   VARCHAR(100) NOT NULL,
    expiry_date VARCHAR(10)  NOT NULL,
    cvv         VARCHAR(5)   NOT NULL,
    amount      DECIMAL(12,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS transaction (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    account_name VARCHAR(100) NOT NULL,
    goal         VARCHAR(50)  NOT NULL,
    payment_type VARCHAR(50)  NOT NULL,
    payment_date DATE         NOT NULL,
    amount       DECIMAL(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS bill (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    bill_name        VARCHAR(100)  NOT NULL,
    due_date         DATE          NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    item_description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS goal (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    goal_name   VARCHAR(100)  NOT NULL,
    goal_target DECIMAL(12,2) NOT NULL
);
```

## 🔧 Installation & Running

```bash
# Install dependencies
pip install flask mysql-connector-python

# Run the app
python app.py
```

Then open: `http://127.0.0.1:5000`

> **Note:** If your MySQL runs on a non-default port, update the `port` value in `DB_CONFIG` inside `app.py`.

## 📌 Project Structure

```
springboard/
├── app.py                  # Flask backend with auth + all routes
├── schema.sql              # Database setup script
├── templates/
│   ├── index.html          # Landing page
│   ├── login.html          # Login page
│   ├── signup.html         # Signup page
│   └── interface.html      # Main dashboard
└── static/
    ├── style.css           # Auth pages styling
    ├── intstyle.css        # Dashboard styling
    ├── script.js           # Auth helpers
    └── intscript.js        # Full dashboard logic
```

## 📸 Demo

### Landing Page
![Landing](static/images/dashboard.jpg)

### Dashboard
![Dashboard](static/images/balances.jpg)

### Expenses Chart
![Expenses](static/images/expenses.jpg)

## 📌 Use Case

Built as a Infosys Springboard internship project to demonstrate full-stack development with real database integration, session-based authentication, and dynamic frontend data visualization.

## About

Full-stack personal finance tracker built with Flask and MySQL featuring secure authentication, card management, transaction tracking, bill reminders, and Chart.js expense visualization.

