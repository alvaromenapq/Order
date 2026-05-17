# Sistema de Gestión de Órdenes

Mini sistema de gestión de órdenes compuesto por dos microservicios NestJS:

- **MS Ordenes** — CRUD de órdenes con PostgreSQL + TypeORM (puerto 3000)
- **MS Auditoria** — Log inmutable de cambios de estado con MongoDB + Mongoose (puerto 3001, TCP 4001)

## Requisitos

- Docker >= 24
- Docker Compose >= 2.20

## Configuración inicial

Copia el archivo de variables de entorno y ajusta los valores:

```bash
cp .env.example .env
```

Para pruebas locales con compose, el proyecto ya puede arrancar con la API key por defecto `local-dev-key`.

Si quieres fijarla explícitamente o cambiarla, usa:

```
API_KEY=local-dev-key
```

## Levantar el proyecto

```bash
docker compose up --build
```

Esto levanta los 4 servicios en orden:
1. `postgres` (espera healthcheck)
2. `mongo` (espera healthcheck)
3. `orders-service` (espera que postgres esté healthy)
4. `audit-service` (espera que mongo esté healthy)

## Verificar que funciona

```bash
# Estado de los contenedores
docker compose ps

# Logs del MS Ordenes
docker compose logs -f orders-service

# Logs del MS Auditoria
docker compose logs -f audit-service
```

## Endpoints disponibles

Todos los endpoints del MS Ordenes requieren el header `x-api-key` con el valor configurado en `API_KEY`.

### MS Ordenes — `http://localhost:3000`

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/orders` | Crear una orden |
| GET | `/orders` | Listar órdenes (con filtros y paginación) |
| GET | `/orders/search?q=texto` | Búsqueda full-text (mín. 3 caracteres) |
| PUT | `/orders/:id/status` | Cambiar estado de una orden |
| GET | `/catalog/products` | Consultar el catálogo mock disponible |

### MS Auditoria — `http://localhost:3001`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/audit/:orderId` | Historial de cambios de una orden |

## Ejemplos de uso

### Crear una orden

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -H "x-api-key: local-dev-key" \
  -d '{
    "userId": "user-42",
    "notes": "Entrega en horario de tarde",
    "items": [
      {
        "productId": "SKU-1234",
        "quantity": 2
      }
    ]
  }'
```

### Catalogo mock disponible para pruebas

El microservicio de ordenes incluye un catalogo interno en memoria para que `docker compose up --build` funcione sin dependencias externas de inventario. La validacion de stock se hace contra este catalogo server-side.

| productId | productName | unitPrice | availableStock | active | Uso recomendado |
|---|---|---:|---:|---|---|
| `SKU-1234` | Cafetera espresso | 129.90 | 8 | true | Happy path |
| `SKU-5678` | Molinillo electrico | 49.90 | 15 | true | Happy path |
| `SKU-9012` | Tazas termicas x2 | 24.50 | 30 | true | Happy path |
| `SKU-4040` | Filtro premium V60 | 15.75 | 0 | true | Probar stock insuficiente |
| `SKU-0000` | Producto descontinuado demo | 9.99 | 5 | false | Probar producto inactivo |

Reglas importantes:

- El request de `POST /orders` solo recibe `productId` y `quantity` por item.
- `productName` y `unitPrice` se resuelven en el backend y se persisten como snapshot historico.
- Si el `productId` no existe, esta inactivo o no tiene stock suficiente, la orden se rechaza con `400 Bad Request`.

### Consultar catálogo mock

```bash
curl http://localhost:3000/catalog/products \
  -H "x-api-key: local-dev-key"
```

### Listar órdenes paginadas

```bash
curl "http://localhost:3000/orders?status=PENDING&page=1&limit=10" \
  -H "x-api-key: local-dev-key"
```

### Cambiar estado de una orden

```bash
curl -X PUT http://localhost:3000/orders/<uuid>/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: local-dev-key" \
  -d '{"status": "CONFIRMED"}'
```

Transiciones válidas:
- `PENDING` → `CONFIRMED`, `CANCELLED`, `FAILED`
- `CONFIRMED` → `PROCESSING`, `CANCELLED`, `FAILED`
- `PROCESSING` → `SHIPPED`, `CANCELLED`, `FAILED`
- `SHIPPED` → `DELIVERED`
- `DELIVERED`, `CANCELLED`, `FAILED` → _(estados terminales)_

### Búsqueda full-text

```bash
curl "http://localhost:3000/orders/search?q=cafetera" \
  -H "x-api-key: local-dev-key"
```

### Consultar auditoría

```bash
curl http://localhost:3001/audit/<orderId>
```

## Ejecutar tests

Desde el directorio de cada servicio:

```bash
# Unit tests
cd services/orders && npm test

# Unit tests con cobertura
cd services/orders && npm run test:cov

# Mismo para auditoria
cd services/audit && npm test
```

## Estructura del proyecto

```
.
├── docker-compose.yml
├── .env.example
├── README.md
├── docs/
│   ├── architecture/
│   │   ├── decisions/          # ADR-001, ADR-002, ADR-003
│   │   ├── contracts/          # OpenAPI + AsyncAPI
│   │   └── diagrams/           # C4 context + container
│   ├── specs/                  # Brief, spec, gaps
│   └── testing/                # Estrategia de testing
└── services/
    ├── orders/                 # MS Ordenes (NestJS + PostgreSQL)
    │   └── src/
    │       ├── catalog/        # Módulo de catálogo mock e endpoint read-only
    │       ├── common/guards/  # ApiKeyGuard
    │       ├── events/         # ClientProxy TCP hacia auditoria
    │       └── orders/         # Módulo de órdenes
    └── audit/                  # MS Auditoria (NestJS + MongoDB)
        └── src/
            └── audit/          # Módulo de auditoría
```

## Variables de entorno

Ver `.env.example` en la raíz para la lista completa documentada.

## Puntos diferenciadores

Esta entrega cumple con 3 de los 4 puntos diferenciadores solicitados.

### 1. Busqueda de texto sobre ordenes con PostgreSQL y endpoint `GET /orders/search?q=texto`

**Cumple:** Si

**Como esta implementado:**

- Se usa `pg_trgm` en PostgreSQL.
- El microservicio crea la extension y los indices GIN al arrancar.
- El endpoint disponible es `GET /orders/search?q=texto`.

**Como validarlo:**

1. Levanta el proyecto con `docker compose up --build`.
2. Crea una orden con `notes` o productos que luego puedas buscar.
3. Ejecuta:

```bash
curl "http://localhost:3000/orders/search?q=cafetera" \
  -H "x-api-key: local-dev-key"
```

4. Verifica que el endpoint responda `200 OK` y retorne las ordenes coincidentes.

### 2. Al menos un test de integracion o e2e con Jest para el flujo principal de creacion de orden

**Cumple:** Si

**Como esta implementado:**

- Existe un test de integracion del controlador de ordenes que cubre `POST /orders` con payload valido y respuesta `201 Created`.

**Como validarlo:**

1. Entra al microservicio de ordenes.
2. Ejecuta:

```bash
cd services/orders && npm test -- --runInBand
```

3. Verifica que pase el archivo de pruebas de integracion de orders.

### 3. Guard de autenticacion basico en el microservicio de ordenes

**Cumple:** Si

**Como esta implementado:**

- Se usa autenticacion por API Key.
- Todos los endpoints del microservicio de ordenes requieren el header `x-api-key`.

**Como validarlo:**

1. Llama cualquier endpoint sin `x-api-key`.
2. Verifica que responda `401 Unauthorized`.
3. Repite la llamada con `x-api-key: local-dev-key` y verifica que la respuesta sea exitosa.

Ejemplo:

```bash
curl http://localhost:3000/catalog/products
```

Debe responder `401`.

```bash
curl http://localhost:3000/catalog/products \
  -H "x-api-key: local-dev-key"
```

Debe responder `200 OK` con el catalogo mock.