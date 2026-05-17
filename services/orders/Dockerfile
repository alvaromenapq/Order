# =============================================================================
# Stage 1: builder
# Instala todas las dependencias y compila el proyecto TypeScript
# =============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifiestos de dependencias primero para aprovechar la cache de capas
COPY package.json package-lock.json ./

# Instalar todas las dependencias (incluye devDependencies para compilar)
RUN npm ci

# Copiar el codigo fuente y compilar
COPY . .
RUN npm run build

# =============================================================================
# Stage 2: production
# Imagen final ligera con solo los artefactos necesarios en runtime
# =============================================================================
FROM node:20-alpine AS production

WORKDIR /app

# Crear usuario no-root para ejecutar la aplicacion
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copiar manifiestos para instalar solo dependencias de produccion
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar el build compilado desde el stage builder
COPY --from=builder /app/dist ./dist

# Ajustar propietario de los archivos al usuario no-root
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
