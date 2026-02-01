-- Initialization schema for smart_garden_db

CREATE DATABASE IF NOT EXISTS mydatabase;
USE mydatabase;

-- users
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  username VARCHAR(60) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- tokens (user tokens)
CREATE TABLE IF NOT EXISTS tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- nodes
CREATE TABLE IF NOT EXISTS nodes (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  name VARCHAR(100) NOT NULL,
  note VARCHAR(1024) DEFAULT '',
  status ENUM('active','inactive','unknown') DEFAULT 'unknown',
  data_archiving VARCHAR(64) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- node tokens (device tokens)
CREATE TABLE IF NOT EXISTS node_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  node_id CHAR(36) NOT NULL,
  token VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- pots
CREATE TABLE IF NOT EXISTS pots (
  id CHAR(36) NOT NULL PRIMARY KEY,
  node_id CHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  note VARCHAR(1024) DEFAULT '',
  status ENUM('active','inactive','unknown') DEFAULT 'unknown',
  reporting_time VARCHAR(64) DEFAULT NULL,
  thresholds JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- measurements (stored per pot)
CREATE TABLE IF NOT EXISTS measurements (
  id CHAR(36) NOT NULL PRIMARY KEY,
  pot_id CHAR(36) NOT NULL,
  timestamp DATETIME NOT NULL,
  value DOUBLE NOT NULL,
  type VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pot_id) REFERENCES pots(id) ON DELETE CASCADE,
  INDEX (pot_id, timestamp)
) ENGINE=InnoDB;

-- pot warnings (threshold violations)
CREATE TABLE IF NOT EXISTS pot_warnings (
  id CHAR(36) NOT NULL PRIMARY KEY,
  pot_id CHAR(36) NOT NULL,
  measurement_type VARCHAR(64) NOT NULL,
  threshold_type ENUM('min', 'max') NOT NULL,
  threshold_value DOUBLE NOT NULL,
  measured_value DOUBLE NOT NULL,
  measurement_id CHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  dismissed_at TIMESTAMP NULL,
  FOREIGN KEY (pot_id) REFERENCES pots(id) ON DELETE CASCADE,
  FOREIGN KEY (measurement_id) REFERENCES measurements(id) ON DELETE CASCADE,
  INDEX (pot_id, dismissed_at)
) ENGINE=InnoDB;

-- node errors
CREATE TABLE IF NOT EXISTS node_errors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  node_id CHAR(36) NOT NULL,
  code VARCHAR(128) NOT NULL,
  message VARCHAR(1024) NOT NULL,
  severity ENUM('low','medium','high') DEFAULT 'medium',
  timestamp DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE,
  INDEX (node_id, timestamp)
) ENGINE=InnoDB;
