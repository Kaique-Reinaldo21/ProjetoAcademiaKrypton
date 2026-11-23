# Academia Krypton — Inicio rápido en clase (ES)

## Instalación local más rápida

Después de instalar las dependencias, crear una base y usuario MySQL **locales** y configurar `.env` con host **localhost**, ejecute `npm run setup:local` (Windows: `npm.cmd run setup:local`) y luego `npm run dev` (Windows: `npm.cmd run dev`). El comando prepara Prisma, aplica migraciones únicamente a la base **local** y registra las unidades ficticias que falten. Para crear solo las unidades utilice `npm run demo:unidades:local`. Ambos comandos bloquean hosts remotos y `NODE_ENV=production`; no use túneles de puerto local hacia una base remota. Consulte el [README](../README.md).

El repositorio es un entorno **académico de pruebas**, no un sistema listo para producción. Para el manual completo, consulte [GUIA-FACULDADE.md](GUIA-FACULDADE.md).

## Windows (PowerShell)
```powershell
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm.cmd ci
Copy-Item .env.example .env
# Edite .env con DATABASE_URL, JWT_SECRET y SESSION_SECRET
npm.cmd run check:env
npx.cmd prisma generate
npm.cmd run check:db
npm.cmd run prisma:status
npm.cmd run check:syntax
npm.cmd run dev
```

## Linux (Zorin/Ubuntu)
```bash
git clone https://github.com/Kaique-Reinaldo21/ProjetoAcademiaKrypton.git
cd ProjetoAcademiaKrypton
npm ci
cp .env.example .env
# Edite .env con DATABASE_URL, JWT_SECRET y SESSION_SECRET
npm run check:env
npx prisma generate
npm run check:db
npm run prisma:status
npm run check:syntax
npm run dev
```

Si ya tiene el repositorio, revise `git status` antes de `git pull --ff-only origin main` y preserve sus cambios y su `.env`.

## Seguridad y diagnóstico
Utilice credenciales de desarrollo locales para la universidad. **Nunca publique ni comparta .env**, secretos o contraseñas. Si lo transporta, prefiera una memoria USB personal cifrada; mantenga separadas las credenciales de la nube y las locales.

`check:env` valida la configuración sin mostrar contraseñas. `check:db` ejecuta consultas de solo lectura y cuenta las unidades, usuarios y planes. `prisma:status` inspecciona migraciones. **No ejecute el seed de demostración en una base de datos compartida ni use comandos de reset para solucionar errores**.

## Direcciones útiles
- Sitio: `http://localhost:3000`
- Estado básico: `/api/health` (no verifica conexión MySQL)
- Unidades: `/api/unidades` (`[]` indica cero unidades en la base consultada)
- Documentación de API: `/api-docs.html` (alternativa JSON: `/openapi.json`)

## Próximas funcionalidades
Agenda integrada con profesionales, entrenamientos, nutrición, portal del alumno, recepción, módulos administrativos y colas de trabajos son **planes futuros**, no funcionalidades terminadas. Para producción se necesitan permisos, protección de datos, almacenamiento seguro y workers independientes.
