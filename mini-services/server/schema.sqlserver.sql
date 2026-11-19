-- ============================================================================
-- Script de creación de tablas para SQL Server Express
-- Base de datos: Asistencia_DiconSolutions (o la que configures en .env)
-- Ejecutar en SQL Server Management Studio (SSMS) o sqlcmd
-- ============================================================================

-- Crear base de datos si no existe (descomenta si necesitas crearla)
-- CREATE DATABASE [Asistencia_DiconSolutions];
-- GO
-- USE [Asistencia_DiconSolutions];
-- GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'trabajador')
CREATE TABLE trabajador (
  id INT IDENTITY(1,1) PRIMARY KEY,
  codTarjeta NVARCHAR(20) UNIQUE NOT NULL,
  nombre NVARCHAR(150) NOT NULL,
  documento NVARCHAR(20),
  area NVARCHAR(100),
  creado DATETIME DEFAULT GETDATE()
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'equipo')
CREATE TABLE equipo (
  id INT IDENTITY(1,1) PRIMARY KEY,
  codEquipo INT UNIQUE,
  descripcion NVARCHAR(200),
  ip NVARCHAR(45),
  puerto INT DEFAULT 5000,
  ubicacion NVARCHAR(200),
  conectado BIT DEFAULT 0,
  ultimaConn DATETIME,
  ultMarcacion DATETIME,
  creado DATETIME DEFAULT GETDATE()
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'marcacion')
CREATE TABLE marcacion (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  tramaHex NVARCHAR(200) NOT NULL,
  tramaParseada NVARCHAR(100),
  codTarjeta NVARCHAR(20) NOT NULL,
  fechaHora DATETIME NOT NULL,
  lugar INT,
  lugarDesc NVARCHAR(50),
  incidencia NVARCHAR(5),
  tipoMarcacion NVARCHAR(50),
  esEntrada BIT,
  esSalida BIT,
  byteMarcacion INT,
  checksumValido BIT,
  recibidoEn DATETIME DEFAULT GETDATE(),
  trabajadorId INT FOREIGN KEY REFERENCES trabajador(id),
  equipoId INT FOREIGN KEY REFERENCES equipo(id),
  ipEquipo NVARCHAR(45)
);
GO

-- Índices para optimizar consultas frecuentes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_marc_cod')
CREATE INDEX idx_marc_cod ON marcacion(codTarjeta);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_marc_fecha')
CREATE INDEX idx_marc_fecha ON marcacion(fechaHora);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_marc_recibido')
CREATE INDEX idx_marc_recibido ON marcacion(recibidoEn);
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_marc_tipo')
CREATE INDEX idx_marc_tipo ON marcacion(tipoMarcacion);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'log_evento')
CREATE TABLE log_evento (
  id BIGINT IDENTITY(1,1) PRIMARY KEY,
  nivel NVARCHAR(20),
  categoria NVARCHAR(50),
  mensaje NVARCHAR(500),
  detalle NVARCHAR(1000),
  equipoId INT FOREIGN KEY REFERENCES equipo(id),
  fecha DATETIME DEFAULT GETDATE()
);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'usuario')
CREATE TABLE usuario (
  id INT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(50) UNIQUE NOT NULL,
  password NVARCHAR(200) NOT NULL,
  nombre NVARCHAR(150),
  role NVARCHAR(20) DEFAULT 'admin'
);
GO

-- Insertar usuario admin por defecto si no existe
IF NOT EXISTS (SELECT * FROM usuario WHERE username = 'admin')
INSERT INTO usuario (username, password, nombre, role)
VALUES ('admin', 'admin123', 'Administrador', 'admin');
GO

PRINT 'Tablas creadas correctamente en SQL Server.';
GO
