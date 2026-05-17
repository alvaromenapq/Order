# CLAUDE.md

## Stack tecnologico

- Lenguaje: TypeScript
- Framework backend: NestJS
- Microservicio de ordenes: PostgreSQL con TypeORM
- Microservicio de auditoria: MongoDB con Mongoose
- Comunicacion entre microservicios: TCP o EventEmitter de NestJS
- Autenticacion: API Key o JWT en el microservicio de ordenes
- Busqueda de texto: PostgreSQL Full-Text Search (`tsvector`/`tsquery`) o `pg_trgm` con indice GIN
- Contenedores: Docker y `docker-compose` para entorno local
- Principios de diseno: SOLID aplicado de forma pragmatica

## Dominio del negocio

- retail

## Estandares y normas

- Arquitectura: microservicios con NestJS, simple y alineada a la estructura nativa del framework.
- Separacion por capas: controlador, servicio y repositorio en el microservicio de ordenes.
- Persistencia: TypeORM para ordenes y Mongoose para auditoria.
- Comunicacion interna: eventos de dominio para registrar cambios de estado en auditoria.
- Regla de diseno: priorizar claridad, cohesión alta y bajo acoplamiento.
- Regla de implementacion: evitar sobreingenieria, patrones innecesarios y abstracciones prematuras.
- Manejo de errores: usar excepciones tipadas de NestJS, por ejemplo `NotFoundException`, `BadRequestException` y equivalentes segun el caso.

## Contexto del ejercicio

Construir un mini sistema de gestion de ordenes compuesto por dos microservicios que se comunican entre si. El sistema debe permitir crear y consultar ordenes, y registrar automaticamente un log de auditoria ante cada cambio de estado.

## Microservicio 1 - Ordenes

Tecnologias base:

- NestJS
- PostgreSQL
- TypeORM

Requisitos:

- CRUD de ordenes con TypeORM y entidades correctamente tipadas.
- `POST /orders` debe validar stock minimo y asignar estado inicial.
- `GET /orders?status=&userId=` debe soportar paginacion con `page` y `limit`.
- `PUT /orders/:id/status` debe cambiar el estado con validacion de transicion.
- Separacion por modulos siguiendo la arquitectura de NestJS: controlador, servicio y repositorio.
- Aplicar principios SOLID sin sobreingenieria.
- Manejo de errores con excepciones tipadas de NestJS, por ejemplo `NotFoundException` y `BadRequestException`.
- Implementar un guard de autenticacion basico, mediante API Key o JWT.
- Implementar busqueda de texto sobre ordenes usando PostgreSQL Full-Text Search (`tsvector`/`tsquery`) o `pg_trgm`, con indice GIN y endpoint `GET /orders/search?q=texto`.

## Microservicio 2 - Auditoria

Tecnologias base:

- NestJS
- MongoDB
- Mongoose

Requisitos:

- Escuchar eventos del microservicio de ordenes via TCP o EventEmitter de NestJS.
- Persistir cada evento en MongoDB con los campos `orderId`, `fromStatus`, `toStatus`, `timestamp` y `metadata`.
- Mantener un log inmutable de cambios de estado.
- Exponer `GET /audit/:orderId` para retornar el historial completo de cambios de una orden.

## Entrega esperada

- `docker-compose.yml` que levante ambos servicios junto con PostgreSQL y MongoDB.
- `.env.example` documentado con todas las variables necesarias.
- `README.md` con instrucciones claras para correr el proyecto en local.
- Arquitectura simple, facil de seguir y alineada con NestJS.
- Codigo orientado a evaluacion tecnica: claro, mantenible y sin complejidad excesiva.

## Criterios de implementacion

- Priorizar claridad sobre sofisticacion.
- Respetar la arquitectura propuesta por NestJS.
- Aplicar principios SOLID de forma pragmatica.
- Evitar sobreingenieria.
- Mantener separacion clara de responsabilidades entre modulos y microservicios.

## Convenciones de codigo

- Naming: variables y funciones en camelCase.
- Naming: clases, DTOs, entidades y schemas en PascalCase.
- Naming: archivos en kebab-case.
- Tipado: no usar `any` salvo justificacion excepcional y acotada.
- Asincronia: usar `async/await` de forma consistente.
- Validacion: centralizar validaciones de entrada con DTOs y pipes de NestJS cuando aplique.
- Responsabilidad: cada modulo debe tener responsabilidades claras y acotadas.

## Regulaciones y compliance

- Seguridad base: validar entradas en todos los endpoints expuestos.
- Secrets: no hardcodear credenciales, llaves o cadenas de conexion; usar variables de entorno.
- Logs: no registrar secretos ni informacion sensible en texto plano.
- Dependencias: evitar dependencias con vulnerabilidades criticas conocidas cuando exista alternativa razonable.

## Convenciones de tests

- Framework de tests: Jest.
- Tests unitarios: cubrir reglas de negocio y validaciones de transicion de estado.
- Tests de integracion: cubrir endpoints principales y persistencia basica.
- Prioridad de cobertura: servicios, repositorios y flujo de auditoria por cambio de estado.
- Naming de tests: `should {comportamiento} when {condicion}`.
- Mocks reutilizables: cada microservicio debe contar con un archivo `mocks` centralizado en una carpeta compartida para evitar duplicacion y simplificar la preparacion de tests unitarios.