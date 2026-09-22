# GenUI Studio 🚀

<div align="center">
  <img src="./public/logo-genui.png" alt="GenUI Studio Logo" width="96" height="96" style="border-radius: 18px;" />
  <h3>Generador Autónomo de Aplicaciones Web e Interfaces Inteligentes</h3>
  <p>Construye, ejecuta, edita y consulta software completo directamente en tu navegador con Inteligencia Artificial.</p>
</div>

---

## 🌟 Acerca de GenUI Studio

**GenUI Studio** es un entorno de desarrollo autónomo de última generación impulsado por IA. Permite a desarrolladores, arquitectos de software y equipos crear aplicaciones web interactivas de pila completa (Full-Stack) en tiempo real, ejecutándolas en un entorno aislado dentro del propio navegador sin necesidad de servidores externos ni contenedores en la nube.

---

## ✨ Características Principales

### 🧠 Soporte Multi-Proveedor de Modelos LLM
Conéctate con los modelos de lenguaje más potentes del mercado:
- **Google Gemini** (Gemini 2.0 Flash, Flash Lite, Pro)
- **OpenAI** (GPT-4o, GPT-4o mini, o1, o3-mini)
- **Anthropic Claude** (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3.5 Haiku)
- **DeepSeek** (DeepSeek V3, DeepSeek R1)
- **Groq**, **Ollama** (Modelos locales), **OpenRouter**, **Mistral**, **Together AI**, **Perplexity** y proveedores compatibles con la API de OpenAI.

---

### 💻 Runtime en el Navegador (WebContainer)
- Ejecución completa de aplicaciones Node.js y Vite en WebAssembly dentro de la pestaña del navegador.
- Servidor de desarrollo integrado con recarga rápida (HMR).
- Vista previa en vivo con vista móvil y de escritorio, consola de terminal e inspección de elementos.

---

### 🗄️ Base de Datos en Memoria y Persistencia Local
- **Persistencia Reactiva**: Las aplicaciones generadas guardan automáticamente sus registros en `localStorage` o `IndexedDB`, garantizando persistencia total de datos tras recargar con F5.
- **Motor SQL Relacional en el Cliente**: Soporte integrado con `alaSQL` para ejecutar consultas SQL reales (`SELECT`, `JOIN`, `GROUP BY`, `ORDER BY`, filtros de agregación) sobre tablas vivas.
- **Sincronización en Tiempo Real**: Los cambios en el sistema se sincronizan automáticamente con la pestaña de **Base de Datos** del Workbench.
- **Soporte Cloud con Supabase**: Conexión opcional para migraciones y operaciones SQL en la nube.

---

### 📊 Módulo de Reportes IA Generativos
- **Consultas en Lenguaje Natural y Voz**: Escribe o dicta por micrófono en español para consultar los datos del proyecto.
- **Métricas y KPIs Ejecutivos**: Detección y cálculo automático de totales, promedios y recuentos clave.
- **Visualizaciones Gráficas**: Gráficos dinámicos SVG (barras, dona/pie, líneas) calculados en tiempo real.
- **Exportación & Inyección**: Descarga de reportes en formato CSV y JSON, o inyección directa del reporte como componente React autónomo en el proyecto.

---

### 🎨 Diseño y Experiencia de Usuario
- **Tema Corporativo GenUI Studio**: Paleta de colores naranja de alto rendimiento (`#ff7a1a`).
- **Modo Claro y Oscuro Total**: Transición fluida con alto contraste y legibilidad optimizada en todos los paneles.
- **Landing Page Corporativa**: Página informativa completa en `/landing` con detalles de capacidades, planes y FAQ interactivo.
- **Copiado Rápido y Marcas de Tiempo**: Copiado con un clic de respuestas del usuario y del asistente con registro de hora AM/PM.

---

## 🛠️ Requisitos Previos

- **Node.js**: Versión 18.18.0 o superior (se recomienda Node 20 LTS).
- **Gestor de Paquetes**: `pnpm` (versión 9 o superior recomendada) o `npm`.
- **Navegador Web**: Google Chrome, Microsoft Edge, Brave o navegadores basados en Chromium con soporte de WebAssembly y aislamiento de origen (`Cross-Origin-Isolation`).

---

## 🚀 Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone https://github.com/Dxnxxl369/GenUIStudio.git
cd GenUIStudio
```

### 2. Instalar dependencias
```bash
pnpm install
```

### 3. Configurar Variables de Entorno
Copia el archivo de ejemplo para crear tu archivo `.env.local`:
```bash
cp .env.example .env.local
```
Edita `.env.local` y agrega tus claves de API según el proveedor que vayas a utilizar:
```env
# Ejemplo para Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=tu_clave_de_gemini

# Ejemplo para OpenAI
OPENAI_API_KEY=tu_clave_de_openai

# Ejemplo para DeepSeek
DEEPSEEK_API_KEY=tu_clave_de_deepseek

# Ejemplo para Groq
GROQ_API_KEY=tu_clave_de_groq
```

### 4. Iniciar el Servidor de Desarrollo
```bash
pnpm run dev
```

Abre tu navegador en [http://localhost:5173](http://localhost:5173) para empezar a construir aplicaciones con GenUI Studio.

---

## 📦 Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `pnpm run dev` | Inicia la aplicación en modo desarrollo con recarga rápida |
| `pnpm run build` | Compila el proyecto para producción |
| `pnpm run preview` | Ejecuta la versión compilada para previsualización |
| `pnpm run typecheck` | Ejecuta el comprobador de tipos de TypeScript (`tsc`) |
| `pnpm run lint` | Ejecuta ESLint sobre el código del proyecto |

---

## 🛡️ Seguridad y Buenas Prácticas

- Los archivos `.env` y `.env.local` están estrictamente ignorados por Git para evitar la filtración accidental de claves de API.
- Todo el código generado por la IA en WebContainer se ejecuta en un sandbox aislado del navegador, protegiendo el sistema operativo del usuario.

---

## 📄 Licencia

Este proyecto está bajo la licencia MIT.
