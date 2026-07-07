# Product

## Register

product

## Users

Dueños de casa con luces de Home Assistant que ya usan Spotify. Contexto de uso
mixto y multi-dispositivo: montado en una tablet o pantalla fija en la sala
(mirado de lejos, luz ambiente tenue), controlado de cerca desde la laptop
mientras hacen otra cosa, y como control remoto rápido desde el celular. El
trabajo a resolver: ver qué suena y dejar que las luces de la casa sigan el
ánimo de la música sin tener que tocar nada — y, cuando quieren, ajustar luces,
modo fiesta, nocturno y letras a mano.

## Product Purpose

synqfy sincroniza las luces de Home Assistant con lo que suena en Spotify:
extrae la paleta de la portada del álbum y la proyecta en las luces. La
automatización vive en el backend, así que funciona con el navegador cerrado. La
UI es vista + control: reproductor, panel de luces, letras sincronizadas, cola,
historial y un modo kiosk para pantallas de adorno. Éxito = la casa "respira"
con la música sola, y cuando el usuario quiere intervenir, el control es
inmediato y legible desde cualquier dispositivo.

## Brand Personality

Ambient, familiar, sin ruido. Tres palabras: **cálido, sin fricción, atmosférico**.
El norte es Spotify —misma familiaridad de jerarquía, oscuro, un acento vivo,
foco en portada + controles— **pero sin los fondos de color que llenan toda la
pantalla**. La atmósfera la carga la portada blureada detrás de un scrim oscuro
(contenido, no relleno), no un degradado de borde a borde. La UI cede el
protagonismo a la música y a los colores que la música genera.

## Anti-references

- **Degradados que llenan la pantalla.** Nada de fondos de color saturado de
  borde a borde ni gradientes gigantes detrás de todo. La atmósfera viene de la
  cover blureada + scrim, no de color plano a pantalla completa.
- **Dashboard SaaS genérico.** Sin grillas de cards idénticas, sin hero-metric
  (número gigante + label chico), sin eyebrows en mayúsculas tracked sobre cada
  sección.
- **Home Assistant crudo.** Nada del look ingenieril de domótica: toggles y
  entidades amontonadas sin jerarquía ni atmósfera. Los controles de luces se
  sienten parte del reproductor, no un panel de config.
- **Neon / gamer RGB.** Sin glows de neón, sin morados eléctricos, sin estética
  "sync RGB". El color lo dicta la portada, con mesura.

## Design Principles

- **La música es la protagonista.** Portada y colores extraídos son el sujeto;
  la UI se corre a un costado. Cuando hay duda, quitar cromo, no agregar.
- **Atmósfera por profundidad, no por relleno.** Blur, scrim y capas dan clima;
  el color no se derrama a pantalla completa.
- **Familiar como Spotify, propio en el detalle.** Aprovechar convenciones que
  el usuario ya conoce (jerarquía, controles, acento), sin clonar el degradado.
- **Un solo diseño para todos los tamaños.** Tablet-de-lejos, laptop-de-cerca y
  celular-en-mano comparten la misma UI; responsive de verdad, legible a 3
  metros y usable con una mano.
- **El control es inmediato.** Toggle de luces, fiesta y ajustes responden ya;
  el estado real (nocturno, error de HA, fiesta) siempre visible.

## Accessibility & Inclusion

Nivel básico pragmático: texto legible con buen contraste sobre el scrim,
navegación y controles usables por teclado, foco visible. Sin compromiso formal
con un nivel WCAG, pero respetar `prefers-reduced-motion` en los crossfades y
animaciones por sensatez (la app corre en pantallas ambiente de larga
exposición).
