-- Creates schema for User, Token, Node, NodeToken, Pot and Measurement
CREATE DATABASE IF NOT EXISTS mydatabase CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
USE mydatabase;

-- Users table (matches "User" schema)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password CHAR(128) NOT NULL, -- SHA512 hex
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens table (user tokens) (matches "Token" schema)
CREATE TABLE IF NOT EXISTS tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token CHAR(128) NOT NULL UNIQUE,
  expiration DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Nodes table (matches "Node" schema)
CREATE TABLE IF NOT EXISTS nodes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  name VARCHAR(50) NOT NULL,
  note VARCHAR(200) DEFAULT '',
  status ENUM('active','inactive','unknown') DEFAULT 'unknown',
  data_archiving VARCHAR(50) DEFAULT 'P14D',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_nodes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Node tokens table (matches "NodeToken" schema)
CREATE TABLE IF NOT EXISTS node_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  node_id CHAR(36) NOT NULL,
  token CHAR(128) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_node_tokens_node FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pots table (matches "Pot" schema)
CREATE TABLE IF NOT EXISTS pots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  node_id CHAR(36) NOT NULL,
  name VARCHAR(50) NOT NULL,
  note VARCHAR(200) DEFAULT '',
  status ENUM('active','inactive','unknown') DEFAULT 'unknown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pots_node FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Measurements table (matches "Measurement" schema)
CREATE TABLE IF NOT EXISTS measurements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  pot_id CHAR(36) NOT NULL,
  timestamp DATETIME(6) NOT NULL,
  value DOUBLE NOT NULL,
  type VARCHAR(50) DEFAULT 'moisture',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_measurements_pot FOREIGN KEY (pot_id) REFERENCES pots(id) ON DELETE CASCADE,
  INDEX idx_measurements_pot (pot_id),
  INDEX idx_measurements_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
