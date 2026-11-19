-- =====================================================================
-- BD NUEVA DESDE CERO PARA BIOMÉTRICO DICON
-- Ejecutar en SQL Server Express (instancia SQLEXPRESS2022 o similar)
-- =====================================================================
-- Este script crea la base de datos completa con todas las tablas
-- necesarias para recibir marcaciones del equipo biométrico DiconSolutions
-- y visualizarlas en el dashboard.
-- =====================================================================

USE master;
GO

-- ===== 1. ELIMINAR BD SI EXISTE =====
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'Biometrico_Dicon_Nuevo')
BEGIN
    ALTER DATABASE Biometrico_Dicon_Nuevo SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE Biometrico_Dicon_Nuevo;
    PRINT 'BD anterior eliminada';
END
GO

-- ===== 2. CREAR BD NUEVA =====
CREATE DATABASE Biometrico_Dicon_Nuevo;
GO

ALTER DATABASE Biometrico_Dicon_Nuevo SET RECOVERY SIMPLE;
GO

USE Biometrico_Dicon_Nuevo;
GO

PRINT '======================================================';
PRINT 'Creando tablas en Biometrico_Dicon_Nuevo...';
PRINT '======================================================';

-- ===== 3. EMPRESAS =====
CREATE TABLE dbo.Empresas (
    CodEmpresa        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    RazonSocial       NVARCHAR(160) NOT NULL,
    RazonComercial    NVARCHAR(100) NULL,
    RUC               NVARCHAR(22) NULL,
    Domicilio         NVARCHAR(200) NULL,
    Telefono          NVARCHAR(50) NULL,
    EmailContacto     NVARCHAR(90) NULL,
    LogoImg           IMAGE NULL,
    EstadoDB          SMALLINT DEFAULT 1,
    FecCre            DATETIME DEFAULT GETDATE(),
    Identificador     NVARCHAR(16) NULL
);
PRINT 'Tabla Empresas creada';

-- ===== 4. SUCURSALES =====
CREATE TABLE dbo.Sucursales (
    CodSucursal       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodEmpresa        INT NOT NULL,
    Sucursal          NVARCHAR(50) NULL,
    Domicilio         NVARCHAR(200) NULL,
    Telefono          NVARCHAR(50) NULL,
    EstadoDB          SMALLINT DEFAULT 1,
    FecCre            DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Sucursales_Empresas FOREIGN KEY (CodEmpresa) REFERENCES dbo.Empresas(CodEmpresa)
);
PRINT 'Tabla Sucursales creada';

-- ===== 5. EQUIPOS =====
CREATE TABLE dbo.Equipos (
    CodEquipo         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodEmpresa        INT NULL,
    CodSucursal       INT NULL,
    Descripcion       NVARCHAR(200) NULL,
    IP                NVARCHAR(45) NULL,
    PuertoIP          INT DEFAULT 5000,
    NumeroEquipo      NVARCHAR(20) NULL,
    TipoComunicacion  NVARCHAR(50) DEFAULT 'TCP/IP',
    FirmWare          NVARCHAR(60) NULL,
    Addres            INT NULL,
    EstadoConexion    SMALLINT DEFAULT 0,    -- 0=desconocido, 1=conectado, 2=desconectado
    EstadoDB          SMALLINT DEFAULT 1,
    Conectado         BIT DEFAULT 0,
    UltimaConn        DATETIME NULL,
    UltMarcacion      DATETIME NULL,
    TotalMarcaciones  INT DEFAULT 0,
    FecCre            DATETIME DEFAULT GETDATE(),
    FecAct            DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Equipos_Empresas FOREIGN KEY (CodEmpresa) REFERENCES dbo.Empresas(CodEmpresa)
);
PRINT 'Tabla Equipos creada';

-- ===== 6. EQUIPOS_CONECTADOS (historial) =====
CREATE TABLE dbo.Equipos_Conectados (
    Id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodEquipo         INT NULL,
    NombrePC          NVARCHAR(100) NULL,
    DireccionIP       NVARCHAR(45) NULL,
    FechaConn         DATETIME DEFAULT GETDATE(),
    FechaDesconn      DATETIME NULL,
    EquipoID          NVARCHAR(200) NULL
);
PRINT 'Tabla Equipos_Conectados creada';

-- ===== 7. TRABAJADORES =====
CREATE TABLE dbo.Trabajadores (
    CodTrabajador     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodEmpresa        INT NULL,
    CodSucursal       INT NULL,
    CodigoPlanilla    NVARCHAR(40) NULL,
    CodTarjeta        NVARCHAR(20) NOT NULL,    -- el código que envía el equipo
    Nombre1           NVARCHAR(100) NULL,
    Nombre2           NVARCHAR(40) NULL,
    ApellidoPat       NVARCHAR(100) NULL,
    ApellidoMat       NVARCHAR(40) NULL,
    Documento         NVARCHAR(32) NULL,
    TpDocumento       SMALLINT NULL,            -- 1=DNI, 2=CE, etc.
    RUC               NVARCHAR(22) NULL,
    SegSocial         NVARCHAR(80) NULL,
    EmailPersonal     NVARCHAR(100) NULL,
    EmailTrabajo      NVARCHAR(100) NULL,
    Telefono          NVARCHAR(30) NULL,
    Direccion         NVARCHAR(200) NULL,
    FecNac            DATETIME NULL,
    FecIngreso        DATETIME NULL,
    FecSalida         DATETIME NULL,
    Sexo              CHAR(1) NULL,
    EstCivil          SMALLINT NULL,
    CantHijos         SMALLINT DEFAULT 0,
    PuestoLaboral     NVARCHAR(100) NULL,
    Area              NVARCHAR(100) NULL,
    Profesion         NVARCHAR(100) NULL,
    Sueldo            MONEY DEFAULT 0,
    FotoImg           IMAGE NULL,
    EstadoDB          SMALLINT DEFAULT 1,        -- 1=activo, 0=inactivo
    TxtDisplay        NVARCHAR(32) NULL,
    FecCre            DATETIME DEFAULT GETDATE(),
    FecAct            DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Trabajadores_Empresas FOREIGN KEY (CodEmpresa) REFERENCES dbo.Empresas(CodEmpresa),
    CONSTRAINT UQ_Trabajadores_CodTarjeta UNIQUE (CodTarjeta)
);
PRINT 'Tabla Trabajadores creada';

-- ===== 8. TRABAJADORES_POR_EQUIPO (N:M) =====
CREATE TABLE dbo.Trabajadores_Por_Equipo (
    Id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodTrabajador     INT NOT NULL,
    CodEquipo         INT NOT NULL,
    EstadoEQ          SMALLINT DEFAULT 1,
    FecAsig           DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_TxE_Trabajador FOREIGN KEY (CodTrabajador) REFERENCES dbo.Trabajadores(CodTrabajador),
    CONSTRAINT FK_TxE_Equipo FOREIGN KEY (CodEquipo) REFERENCES dbo.Equipos(CodEquipo)
);
PRINT 'Tabla Trabajadores_Por_Equipo creada';

-- ===== 9. MARCACIONES (tabla principal) =====
CREATE TABLE dbo.Marcaciones (
    Id                BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    -- Datos de la marcación (de la trama)
    CodTarjeta        NVARCHAR(20) NOT NULL,         -- el código que envía el equipo
    CodTrabajador     INT NULL,                      -- FK al trabajador (si está identificado)
    FechaHora         DATETIME NOT NULL,             -- fecha/hora REAL de la marcación
    RecibidoEn        DATETIME NOT NULL DEFAULT GETDATE(),  -- cuándo llegó al servidor
    -- Tipo de marcación
    Incidencia        NVARCHAR(4) NULL,              -- '00'=entrada, '01'=salida
    Estado            NVARCHAR(6) NULL,              -- IE, IS, ST, EL, SL (estilo C#)
    TipoMarcacion     NVARCHAR(50) NULL,             -- TRABAJO-ENTRADA, TRABAJO-SALIDA, etc.
    ModoMarcacion     NVARCHAR(50) NULL,             -- Huella, Tarjeta/Teclado o NO-DETERMINADO
    EsEntrada         BIT DEFAULT 0,
    EsSalida          BIT DEFAULT 0,
    ByteMarcacion     INT NULL,                      -- byte 20 de la trama original
    Lugar             INT DEFAULT 1,                 -- 0=default, 1=trabajo, 2=refrigerio
    LugarDesc         NVARCHAR(50) DEFAULT 'Trabajo',
    -- Datos del equipo
    CodEquipo         INT NULL,
    IPEquipo          NVARCHAR(45) NULL,
    -- Datos de la trama original (para auditoría)
    TramaHex          NVARCHAR(200) NULL,
    TramaParseada     NVARCHAR(100) NULL,
    ChecksumValido    BIT DEFAULT 1,
    -- Datos de procesamiento
    Tardanza          NVARCHAR(16) NULL,
    Temprano          NVARCHAR(16) NULL,
    Activo            BIT DEFAULT 1,
    Turno             NVARCHAR(4) NULL,
    Obs               NVARCHAR(200) NULL,
    Usuario           NVARCHAR(50) NULL,
    -- Procesamiento del C# (si aplica)
    Num_Marca         INT NULL,
    FechaJornadaMarcacion DATETIME NULL,
    FechaHoraN        DATETIME DEFAULT GETDATE(),    -- timestamp de inserción en BD
    FechaHoraE        DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Marcaciones_Trabajador FOREIGN KEY (CodTrabajador) REFERENCES dbo.Trabajadores(CodTrabajador),
    CONSTRAINT FK_Marcaciones_Equipo FOREIGN KEY (CodEquipo) REFERENCES dbo.Equipos(CodEquipo)
);
PRINT 'Tabla Marcaciones creada';

-- Índices para performance
CREATE INDEX IX_Marcaciones_FechaHora ON dbo.Marcaciones(FechaHora);
CREATE INDEX IX_Marcaciones_CodTrabajador ON dbo.Marcaciones(CodTrabajador);
CREATE INDEX IX_Marcaciones_CodTarjeta ON dbo.Marcaciones(CodTarjeta);
CREATE INDEX IX_Marcaciones_CodEquipo ON dbo.Marcaciones(CodEquipo);
CREATE INDEX IX_Marcaciones_FechaHoraN ON dbo.Marcaciones(FechaHoraN);
CREATE INDEX IX_Marcaciones_RecibidoEn ON dbo.Marcaciones(RecibidoEn);
PRINT 'Índices de Marcaciones creados';

-- ===== 10. MARCACIONES_HUELLA =====
CREATE TABLE dbo.Marcaciones_Huella (
    Id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FechaHoraMarcacion DATETIME NOT NULL,
    IDTrabajador      NVARCHAR(50) NOT NULL,
    Incidencia        TINYINT NULL,
    IDEquipo          TINYINT NULL,
    Huella            VARBINARY(MAX) NULL,
    FecCre            DATETIME DEFAULT GETDATE()
);
PRINT 'Tabla Marcaciones_Huella creada';

-- ===== 11. LOG_EVENTOS =====
CREATE TABLE dbo.Log_Eventos (
    Id                BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    FechaHora         DATETIME NOT NULL DEFAULT GETDATE(),
    Nivel             NVARCHAR(20) NULL,            -- INFO, WARN, ERROR, DEBUG
    Categoria         NVARCHAR(50) NULL,            -- TCP, HTTP, BD, SISTEMA
    Mensaje           NVARCHAR(500) NULL,
    Detalle           NVARCHAR(2000) NULL,
    CodEquipo         INT NULL,
    IPEquipo          NVARCHAR(45) NULL,
    CodTrabajador     INT NULL
);
CREATE INDEX IX_Log_Eventos_FechaHora ON dbo.Log_Eventos(FechaHora);
CREATE INDEX IX_Log_Eventos_Nivel ON dbo.Log_Eventos(Nivel);
PRINT 'Tabla Log_Eventos creada';

-- ===== 12. USUARIOS (login del dashboard) =====
CREATE TABLE dbo.Usuarios (
    CodUsuario        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Usuario           NVARCHAR(50) NOT NULL UNIQUE,
    PWD               NVARCHAR(200) NOT NULL,       -- hash bcrypt en la app
    PWDPlain          NVARCHAR(100) NULL,           -- solo para desarrollo
    Nombre            NVARCHAR(120) NULL,
    Apellidos         NVARCHAR(120) NULL,
    Email             NVARCHAR(200) NULL,
    CodPerfil         INT DEFAULT 1,                -- 1=admin, 2=operador, 3=consulta
    EstadoDB          SMALLINT DEFAULT 1,
    ContadorIntentos  INT DEFAULT 0,
    FecCre            DATETIME DEFAULT GETDATE(),
    FecAct            DATETIME DEFAULT GETDATE()
);
PRINT 'Tabla Usuarios creada';

-- ===== 13. PARAMETROS =====
CREATE TABLE dbo.Parametros (
    Codigo            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Campo             NVARCHAR(120) NOT NULL,
    Valor             NVARCHAR(MAX) NULL,
    Descripcion       NVARCHAR(400) NULL,
    Tipo_Parametro    SMALLINT NULL,
    FecAct            DATETIME DEFAULT GETDATE()
);
PRINT 'Tabla Parametros creada';

-- ===== 14. FERIADOS =====
CREATE TABLE dbo.Feriados (
    CodFeriado        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodEmpresa        INT NULL,
    Descripcion       NVARCHAR(100) NULL,
    TipoFeriado       SMALLINT NULL,                -- 1=nacional, 2=regional, 3=empresa
    Fecha             DATETIME NULL,
    HoraInicio        DATETIME NULL,
    HoraFin           DATETIME NULL,
    EstadoDB          SMALLINT DEFAULT 1
);
PRINT 'Tabla Feriados creada';

-- ===== 15. HORARIOS =====
CREATE TABLE dbo.Horarios (
    Cod_Horario       SMALLINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nombre            NVARCHAR(50) NOT NULL,
    Tipo_Horario      SMALLINT NULL,
    -- Campos por día (formato "08:00-12:00,13:00-17:00")
    LunesHE           NVARCHAR(100) NULL,
    MartesHE          NVARCHAR(100) NULL,
    MiercolesHE       NVARCHAR(100) NULL,
    JuevesHE          NVARCHAR(100) NULL,
    ViernesHE         NVARCHAR(100) NULL,
    SabadoHE          NVARCHAR(100) NULL,
    DomingoHE         NVARCHAR(100) NULL,
    ToleranciaComida  SMALLINT DEFAULT 60,
    ToleranciaFalta   SMALLINT DEFAULT 10,
    Descripcion       NVARCHAR(240) NULL,
    EstadoDB          SMALLINT DEFAULT 1,
    FecCre            DATETIME DEFAULT GETDATE()
);
PRINT 'Tabla Horarios creada';

-- ===== 16. HORARIOS_POR_TRABAJADOR =====
CREATE TABLE dbo.Horarios_Por_Trabajador (
    Id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodTrabajador     INT NOT NULL,
    Cod_Horario       SMALLINT NOT NULL,
    FechaInicio       DATETIME NOT NULL,
    FechaFin          DATETIME NULL,
    Estado            INT DEFAULT 1,
    FecAct            DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_HxT_Trabajador FOREIGN KEY (CodTrabajador) REFERENCES dbo.Trabajadores(CodTrabajador),
    CONSTRAINT FK_HxT_Horario FOREIGN KEY (Cod_Horario) REFERENCES dbo.Horarios(Cod_Horario)
);
PRINT 'Tabla Horarios_Por_Trabajador creada';

-- ===== 17. PERMISOS =====
CREATE TABLE dbo.Permisos (
    CodPermiso        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodTrabajador     INT NOT NULL,
    HoraE             DATETIME NULL,
    HoraS             DATETIME NULL,
    AlcanceInicio     DATETIME NOT NULL,
    AlcanceFin        DATETIME NOT NULL,
    Motivo            NVARCHAR(200) NULL,
    TipoPermiso       INT NULL,
    DescontarPermiso  BIT DEFAULT 0,
    Observacion       NVARCHAR(500) NULL,
    EstadoDB          SMALLINT DEFAULT 1,
    FecCre            DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Permisos_Trabajador FOREIGN KEY (CodTrabajador) REFERENCES dbo.Trabajadores(CodTrabajador)
);
PRINT 'Tabla Permisos creada';

-- ===== 18. VACACIONES =====
CREATE TABLE dbo.Vacaciones (
    CodVacacion       INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    CodTrabajador     INT NOT NULL,
    FechaInicio       DATETIME NULL,
    FechaFin          DATETIME NULL,
    EstadoDB          SMALLINT DEFAULT 1,
    Referencia        NVARCHAR(500) NULL,
    FecCre            DATETIME DEFAULT GETDATE(),
    CONSTRAINT FK_Vacaciones_Trabajador FOREIGN KEY (CodTrabajador) REFERENCES dbo.Trabajadores(CodTrabajador)
);
PRINT 'Tabla Vacaciones creada';

-- ===== 19. ALERTAS =====
CREATE TABLE dbo.Alertas (
    CodAlerta         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Descripcion       NVARCHAR(200) NULL,
    Severidad         SMALLINT DEFAULT 1,
    Tipo              SMALLINT NULL,
    Estado            BIT DEFAULT 1,
    FecCre            DATETIME DEFAULT GETDATE()
);
PRINT 'Tabla Alertas creada';

-- ===== 20. PROCESO_MARCACION =====
CREATE TABLE dbo.Proceso_Marcacion (
    IdProceso         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    PeriodoInicial    DATETIME NULL,
    PeriodoFinal      DATETIME NULL,
    FechaHoraProceso  DATETIME DEFAULT GETDATE(),
    RegistrosProcesados INT DEFAULT 0,
    Estado            INT DEFAULT 0
);
PRINT 'Tabla Proceso_Marcacion creada';

-- =====================================================================
-- DATOS INICIALES
-- =====================================================================
PRINT '';
PRINT '======================================================';
PRINT 'Insertando datos iniciales...';
PRINT '======================================================';

-- Empresa default
INSERT INTO dbo.Empresas (RazonSocial, RazonComercial, RUC, Domicilio, EstadoDB, Identificador)
VALUES (N'GRUAS DEL PACIFICO S.A.C.', N'GRUAS DEL PACIFICO', N'20601322456', N'Huachipa - Lima', 1, 'GDP001');
DECLARE @CodEmpresa INT = SCOPE_IDENTITY();
PRINT('Empresa insertada: CodEmpresa=' + CAST(@CodEmpresa AS VARCHAR));

-- Sucursal default
INSERT INTO dbo.Sucursales (CodEmpresa, Sucursal, Domicilio, EstadoDB)
VALUES (@CodEmpresa, N'Sede Principal Huachipa', N'Huachipa - Lima', 1);
DECLARE @CodSucursal INT = SCOPE_IDENTITY();
PRINT('Sucursal insertada: CodSucursal=' + CAST(@CodSucursal AS VARCHAR));

-- Equipo default (el equipo biométrico real)
INSERT INTO dbo.Equipos (CodEmpresa, CodSucursal, Descripcion, IP, PuertoIP, NumeroEquipo, TipoComunicacion, Addres, EstadoConexion, EstadoDB, Conectado, FecCre, FecAct)
VALUES (@CodEmpresa, @CodSucursal, N'Reloj Huachipa', N'169.254.134.140', 5000, N'BIO-001', N'TCP/IP', 20, 0, 1, 0, GETDATE(), GETDATE());
DECLARE @CodEquipo INT = SCOPE_IDENTITY();
PRINT('Equipo insertado: CodEquipo=' + CAST(@CodEquipo AS VARCHAR) + ' IP=169.254.134.140');

-- Usuario admin default
INSERT INTO dbo.Usuarios (Usuario, PWD, PWDPlain, Nombre, Apellidos, Email, CodPerfil, EstadoDB)
VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin123', 'Administrador', 'Sistema', 'admin@biometrico.local', 1, 1);
PRINT('Usuario admin insertado (login: admin / admin123)');

-- Parámetros iniciales
INSERT INTO dbo.Parametros (Campo, Valor, Descripcion, Tipo_Parametro) VALUES
    (N'PUERTO_TCP', N'5000', N'Puerto donde el servidor escucha al equipo biométrico', 1),
    (N'PUERTO_HTTP', N'3001', N'Puerto del servidor HTTP API', 1),
    (N'POLL_INTERVAL_MS', N'10000', N'Intervalo de polling en milisegundos', 1),
    (N'TIMEZONE', N'America/Lima', N'Zona horaria del sistema', 1),
    (N'HORA_NOCTURNA_INICIO', N'22:00', N'Inicio de hora nocturna para cálculos', 1),
    (N'HORA_NOCTURNA_FIN', N'06:00', N'Fin de hora nocturna para cálculos', 1),
    (N'TOLERANCIA_TARDANZA_MIN', N'10', N'Tolerancia en minutos para tardanza', 1),
    (N'VERSION_BD', N'1.0.0', N'Versión del esquema de BD', 1);
PRINT('Parámetros iniciales insertados (8 filas)');

-- Tipos de documento
INSERT INTO dbo.Parametros (Campo, Valor, Descripcion, Tipo_Parametro) VALUES
    (N'TIPO_DOC_DNI', N'1', N'DNI - Documento Nacional de Identidad', 2),
    (N'TIPO_DOC_CE', N'2', N'Carné de Extranjería', 2),
    (N'TIPO_DOC_PASAPORTE', N'3', N'Pasaporte', 2),
    (N'TIPO_DOC_RUC', N'4', N'Registro Único de Contribuyentes', 2);
PRINT('Tipos de documento insertados');

-- =====================================================================
-- VISTA ÚTIL: últimas marcaciones con datos del trabajador
-- =====================================================================
PRINT '';
PRINT '======================================================';
PRINT 'Creando vistas útiles...';
PRINT '======================================================';

GO
CREATE VIEW dbo.vw_UltimasMarcaciones AS
SELECT TOP 100 PERCENT
    m.Id,
    m.CodTarjeta,
    m.FechaHora,
    m.RecibidoEn,
    m.Incidencia,
    m.Estado,
    m.TipoMarcacion,
    m.EsEntrada,
    m.EsSalida,
    m.LugarDesc,
    m.IPEquipo,
    m.Activo,
    m.Tardanza,
    m.Temprano,
    m.Obs,
    t.Nombre1 + COALESCE(' ' + t.Nombre2, '') + ' ' + COALESCE(t.ApellidoPat, '') + COALESCE(' ' + t.ApellidoMat, '') AS TrabajadorNombre,
    t.Documento,
    t.PuestoLaboral,
    t.Area,
    e.Descripcion AS EquipoDescripcion,
    e.NumeroEquipo
FROM dbo.Marcaciones m
LEFT JOIN dbo.Trabajadores t ON m.CodTrabajador = t.CodTrabajador
LEFT JOIN dbo.Equipos e ON m.CodEquipo = e.CodEquipo
ORDER BY m.FechaHora DESC;
GO
PRINT 'Vista vw_UltimasMarcaciones creada';

GO
CREATE VIEW dbo.vw_StatsHoy AS
SELECT
    COUNT(*) AS TotalHoy,
    SUM(CASE WHEN m.EsEntrada = 1 THEN 1 ELSE 0 END) AS EntradasHoy,
    SUM(CASE WHEN m.EsSalida = 1 THEN 1 ELSE 0 END) AS SalidasHoy,
    SUM(CASE WHEN m.Lugar = 1 THEN 1 ELSE 0 END) AS TrabajoHoy,
    SUM(CASE WHEN m.Lugar = 2 THEN 1 ELSE 0 END) AS RefrigerioHoy,
    SUM(CASE WHEN m.ChecksumValido = 0 THEN 1 ELSE 0 END) AS InvalidasHoy,
    COUNT(DISTINCT m.CodTrabajador) AS TrabajadoresActivosHoy
FROM dbo.Marcaciones m
WHERE CAST(m.FechaHora AS DATE) = CAST(GETDATE() AS DATE);
GO
PRINT 'Vista vw_StatsHoy creada';

-- =====================================================================
-- STORED PROCEDURES
-- =====================================================================
PRINT '';
PRINT '======================================================';
PRINT 'Creando stored procedures...';
PRINT '======================================================';

GO
CREATE PROCEDURE dbo.sp_InsertarMarcacion
    @CodTarjeta NVARCHAR(20),
    @FechaHora DATETIME,
    @Incidencia NVARCHAR(4) = NULL,
    @Estado NVARCHAR(6) = NULL,
    @TipoMarcacion NVARCHAR(50) = NULL,
    @EsEntrada BIT = 0,
    @EsSalida BIT = 0,
    @ByteMarcacion INT = NULL,
    @Lugar INT = 1,
    @LugarDesc NVARCHAR(50) = 'Trabajo',
    @CodEquipo INT = NULL,
    @IPEquipo NVARCHAR(45) = NULL,
    @TramaHex NVARCHAR(200) = NULL,
    @TramaParseada NVARCHAR(100) = NULL,
    @ChecksumValido BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    -- Buscar trabajador por CodTarjeta
    DECLARE @CodTrabajador INT = NULL;
    SELECT @CodTrabajador = CodTrabajador FROM dbo.Trabajadores WHERE CodTarjeta = @CodTarjeta;

    -- Insertar marcación
    INSERT INTO dbo.Marcaciones (
        CodTarjeta, CodTrabajador, FechaHora, RecibidoEn,
        Incidencia, Estado, TipoMarcacion, EsEntrada, EsSalida,
        ByteMarcacion, Lugar, LugarDesc,
        CodEquipo, IPEquipo,
        TramaHex, TramaParseada, ChecksumValido,
        FechaHoraN, FechaHoraE, Activo
    ) VALUES (
        @CodTarjeta, @CodTrabajador, @FechaHora, GETDATE(),
        @Incidencia, @Estado, @TipoMarcacion, @EsEntrada, @EsSalida,
        @ByteMarcacion, @Lugar, @LugarDesc,
        @CodEquipo, @IPEquipo,
        @TramaHex, @TramaParseada, @ChecksumValido,
        GETDATE(), GETDATE(), 1
    );

    -- Devolver el ID generado
    SELECT SCOPE_IDENTITY() AS Id, @CodTrabajador AS CodTrabajador;

    -- Actualizar stats del equipo
    IF @CodEquipo IS NOT NULL
        UPDATE dbo.Equipos
        SET UltMarcacion = GETDATE(), TotalMarcaciones = TotalMarcaciones + 1, FecAct = GETDATE()
        WHERE CodEquipo = @CodEquipo;
END;
GO
PRINT 'Procedure sp_InsertarMarcacion creado';

GO
CREATE PROCEDURE dbo.sp_BuscarCrearTrabajador
    @CodTarjeta NVARCHAR(20),
    @Nombre NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CodTrabajador INT;

    SELECT @CodTrabajador = CodTrabajador FROM dbo.Trabajadores WHERE CodTarjeta = @CodTarjeta;

    IF @CodTrabajador IS NULL
    BEGIN
        INSERT INTO dbo.Trabajadores (CodTarjeta, Nombre1, EstadoDB, FecCre, FecAct)
        VALUES (@CodTarjeta, COALESCE(@Nombre, N'Trabajador ' + @CodTarjeta), 1, GETDATE(), GETDATE());
        SET @CodTrabajador = SCOPE_IDENTITY();
        SELECT @CodTrabajador AS CodTrabajador, 1 AS CreadoAhora;
    END
    ELSE
        SELECT @CodTrabajador AS CodTrabajador, 0 AS CreadoAhora;
END;
GO
PRINT 'Procedure sp_BuscarCrearTrabajador creado';

GO
CREATE PROCEDURE dbo.sp_BuscarCrearEquipo
    @IP NVARCHAR(45),
    @Descripcion NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CodEquipo INT;

    SELECT @CodEquipo = CodEquipo FROM dbo.Equipos WHERE IP = @IP;

    IF @CodEquipo IS NULL
    BEGIN
        INSERT INTO dbo.Equipos (Descripcion, IP, PuertoIP, TipoComunicacion, EstadoDB, Conectado, FecCre, FecAct)
        VALUES (COALESCE(@Descripcion, N'Equipo ' + @IP), @IP, 5000, N'TCP/IP', 1, 1, GETDATE(), GETDATE());
        SET @CodEquipo = SCOPE_IDENTITY();
        SELECT @CodEquipo AS CodEquipo, 1 AS CreadoAhora;
    END
    ELSE
    BEGIN
        UPDATE dbo.Equipos SET Conectado = 1, UltimaConn = GETDATE(), FecAct = GETDATE() WHERE CodEquipo = @CodEquipo;
        SELECT @CodEquipo AS CodEquipo, 0 AS CreadoAhora;
    END
END;
GO
PRINT 'Procedure sp_BuscarCrearEquipo creado';

GO
CREATE PROCEDURE dbo.sp_LogEvento
    @Nivel NVARCHAR(20),
    @Categoria NVARCHAR(50),
    @Mensaje NVARCHAR(500),
    @Detalle NVARCHAR(2000) = NULL,
    @CodEquipo INT = NULL,
    @IPEquipo NVARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Log_Eventos (FechaHora, Nivel, Categoria, Mensaje, Detalle, CodEquipo, IPEquipo)
    VALUES (GETDATE(), @Nivel, @Categoria, @Mensaje, @Detalle, @CodEquipo, @IPEquipo);
END;
GO
PRINT 'Procedure sp_LogEvento creado';

-- =====================================================================
-- VERIFICACIÓN FINAL
-- =====================================================================
PRINT '';
PRINT '======================================================';
PRINT 'VERIFICACIÓN FINAL';
PRINT '======================================================';

SELECT name AS Tabla FROM sys.tables ORDER BY name;

PRINT '';
PRINT '======================================================';
PRINT '✅ BD Biometrico_Dicon_Nuevo creada exitosamente';
PRINT '   - 20 tablas creadas';
PRINT '   - 2 vistas creadas';
PRINT '   - 4 stored procedures creados';
PRINT '   - Datos iniciales: 1 empresa, 1 sucursal, 1 equipo, 1 usuario admin, 12 parámetros';
PRINT '';
PRINT '   Usuario admin: admin / admin123';
PRINT '   Equipo: Reloj Huachipa (IP 169.254.134.140)';
PRINT '';
PRINT 'Para conectarte desde la app, usar en el .env:';
PRINT '   SQL_DATABASE=Biometrico_Dicon_Nuevo';
PRINT '======================================================';
GO
