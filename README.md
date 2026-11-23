# Mi Rutina 💪

App de gimnasio para el cel que **funciona sin internet**. Todo se guarda en el propio teléfono.

## Qué hace
- **Hoy**: te dice qué rutina te toca según el día de la semana y te deja entrenar: anotas peso y reps de cada serie, ves lo que hiciste la última vez y tienes un temporizador de descanso que suena o vibra al terminar.
- **Rutina**: plantillas listas (full body 3 días, o empuje/jalón/pierna 6 días) o creas tus días (ej. "Pecho y tríceps") con ejercicios, series y reps, y los asignas de lunes a domingo.
- **Ejercicios**: más de 30 ejercicios ya cargados, cada uno con **animación** (hecha en código, funciona sin internet), tips de técnica y botón para buscar videos en YouTube. También puedes agregar los tuyos y ponerle a cada uno **su video** (lo grabas o lo eliges de la galería y se guarda en el cel), notas de técnica y un enlace opcional a YouTube.
- **Calentamiento** de 8 min con animaciones al inicio de cada entrenamiento, y series de aproximación en los ejercicios con barra.
- **Recuerda tus máquinas**: peso de tu barra o carro y tus ajustes (asiento, respaldo, agarre), y te dice qué discos poner por lado.
- **Te dice cuándo subir peso** (doble progresión): si la vez pasada llegaste al tope del rango de reps en todas las series, te avisa.
- **Cuerpo**: altura, peso, % de grasa y medidas (cintura, cadera, pecho, brazo, pierna), con IMC, masa magra, proteína diaria sugerida y gráficas.
- **Progreso**: calendario de las últimas 12 semanas, récords por ejercicio e historial de entrenamientos.
- **Respaldo**: desde Ajustes ⚙️ puedes exportar o importar tus datos en un archivo `.json` (los videos no se incluyen).

## Cómo ponerla en tu cel
La app es una página web que se instala como app (PWA). Solo hace falta internet **una vez**, para instalarla:

1. Publica el repositorio con **GitHub Pages**: *Settings → Pages → Deploy from a branch*, elige la rama y la carpeta `/ (root)`.
2. Abre en el cel el enlace que te da GitHub (`https://<usuario>.github.io/optifine/`).
3. **iPhone** (Safari): Compartir → *Agregar a pantalla de inicio*.
   **Android** (Chrome): menú ⋮ → *Instalar app*.
4. Ábrela desde el ícono. Ya funciona sin internet.

> ⚠️ Los datos viven solo en ese cel. Si borras la app o los datos del navegador, se pierden: haz un respaldo de vez en cuando.

## Para probarla en la compu
```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

## Archivos
- `index.html`, `styles.css`, `app.js`: la app (sin librerías ni dependencias).
- `anim.js`: animaciones de los ejercicios (muñequito en SVG + tips de técnica).
- `sw.js`: service worker que guarda la app para usarla sin internet. Si cambias algún archivo, sube la versión de `CACHE` para que los cels se actualicen.
- `manifest.webmanifest` e `icons/`: para instalarla como app.
