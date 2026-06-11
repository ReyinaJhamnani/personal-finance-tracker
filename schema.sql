-- Run this once to set up your database
-- mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS my_db;
USE my_db;

CREATE TABLE IF NOT EXISTS Users (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Account (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    card_number VARCHAR(20)  NOT NULL,
    card_name   VARCHAR(100) NOT NULL,
    expiry_date VARCHAR(10)  NOT NULL,
    cvv         VARCHAR(5)   NOT NULL,
    amount      DECIMAL(12,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS Transaction (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    account_name VARCHAR(100) NOT NULL,
    goal         VARCHAR(50)  NOT NULL,
    payment_type VARCHAR(50)  NOT NULL,
    payment_date DATE         NOT NULL,
    amount       DECIMAL(12,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS Bill (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    bill_name        VARCHAR(100)  NOT NULL,
    due_date         DATE          NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    item_description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS Goal (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    goal_name   VARCHAR(100)  NOT NULL,
    goal_target DECIMAL(12,2) NOT NULL
);
