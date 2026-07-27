# Punto Cero One · Design System

**Versión:** 1.0 · Feb 2026
**Aplicación:** Todo el ecosistema Punto Cero.

---

## 1. Filosofía de marca

**Punto Cero** = el punto donde todo empieza.
Cada aplicación del ecosistema es una manifestación de esa idea. La identidad visual debe transmitir:

- Origen · comienzo · potencial infinito
- Tecnología · precisión · profesionalismo
- Comunidad · humanidad · Latinoamérica
- Premium sin ser frío · minimal sin ser plano

**Mantra:** *Todo empieza aquí.*

---

## 2. Familia de logotipos

### Logo maestro
`PC ONE` (asset oficial):
`https://customer-assets-m6fa6gv7.emergentagent.net/job_future-core-5/artifacts/ryqkybmj_ChatGPT%20Image%2027%20jul%202026%2C%2004_03_53%20p.m..png`

Elemento visual: **wordmark blanco "PC" + anillo cósmico (gradient azul→violeta→rosa) + wordmark "PUNTO CERO" + subtítulo "ONE"**.

### Variantes autorizadas
| Variante | Uso |
|---|---|
| `full` | Header desktop, footer, documentos oficiales, portadas |
| `compact` | Solo el ícono circular (favicon, avatar, iOS icon) |
| `mono-light` | Fondos oscuros — logo blanco |
| `mono-dark` | Fondos claros — logo navy |

### Uso técnico en código
```jsx
import BrandMark from '@/components/BrandMark';
<BrandMark size={40} variant="full" showTagline />
```

### Aplicaciones del ecosistema (uso `AppIcon`)
Cada aplicación comparte la misma geometría:
- Círculo exterior 24×24, stroke 1.75
- Glifo interior con peso consistente
- 3 variantes: `color` (default) · `mono-light` · `mono-dark`

```jsx
import AppIcon from '@/components/community/AppIcon';
<AppIcon name="legal" size={24} variant="color" />
```

Nombres válidos: `legal`, `news`, `video`, `jobs`, `ai`, `companies`, `marketplace`, `learn`, `events`, `music`, `podcast`, `capital`, `travel`, `health`, `accounting`, `home`, `search`, `community`.

---

## 3. Paleta de colores

### Núcleo de marca
| Token CSS | Valor | Uso |
|---|---|---|
| `--pc-navy` | `#0B1F3A` | Fondos oscuros, tipografía sobre claro |
| `--pc-navy-deep` | `#0A0F1C` | Superficies cósmicas, hero oscuro |
| `--pc-emerald` | `#00C896` | Acento primario · comunidad · Legal |
| `--pc-gold` | `#D4AF37` | 💎 Capital · CTAs institucionales |

### Anillo cósmico (aplicación en gradiente de marca)
| Token | Valor |
|---|---|
| `--pc-cosmic-1` | `#3B82F6` (azul) |
| `--pc-cosmic-2` | `#8B5CF6` (violeta) |
| `--pc-cosmic-3` | `#EC4899` (rosa) |
| `--pc-cosmic` | `linear-gradient(90deg, azul → violeta → rosa)` |

### Superficies
| Token | Valor |
|---|---|
| `--pc-bg-light` | `#F4F6FB` |
| `--pc-surface` | `#FFFFFF` |
| `--pc-border` | `rgba(11,31,58,0.06)` |
| `--pc-text` | `#0B1F3A` |
| `--pc-text-muted` | `rgba(11,31,58,0.65)` |

### Colores por vertical (para `AppIcon`)
| App | Color | App | Color |
|---|---|---|---|
| Legal | `#00C896` | Salud | `#F87171` |
| Noticias | `#3B82F6` | Contabilidad | `#10B981` |
| Videos | `#8B5CF6` | Podcast | `#F472B6` |
| Empleos | `#D4AF37` | Música | `#EF4444` |
| IA | `#22D3EE` | Marketplace | `#FB923C` |
| Empresas | `#94A3B8` | Aprende | `#A855F7` |
| Eventos | `#EC4899` | Viajes | `#06B6D4` |
| Capital | `#D4AF37` | Comunidad | `#14B8A6` |

---

## 4. Tipografía

- **Display / Wordmark:** `Space Grotesk` (700, 300) — títulos, hero, números grandes
- **Body:** `Inter`, fallback sistema — párrafos, UI

### Escala responsiva (usar `clamp()`)
| Rol | Valor |
|---|---|
| H1 hero | `clamp(2.2rem, 5.2vw, 3.6rem)` |
| H1 sección | `clamp(1.8rem, 4vw, 2.8rem)` |
| H2 | `clamp(1.4rem, 2.6vw, 1.9rem)` |
| H3 card | `1.05rem` – `1.25rem` |
| Body | `0.88rem` – `1rem` |
| Small · label | `0.62rem` – `0.72rem` con `letter-spacing: 0.18em – 0.28em` |

Pesos permitidos: 300 (display light), 500 (body), 600 (labels/nav), 700 (títulos), 800 (CTAs premium).

---

## 5. Reglas de uso — Do & Don't

**DO**
- Usar el gradiente cósmico solo en el logo, textos de marca o acentos puntuales.
- Reservar el dorado (`--pc-gold`) exclusivamente para 💎 Capital.
- Emerald para acentos de comunidad, tracción positiva, "LIVE".
- Mucho whitespace (min 1.5rem gap entre secciones en mobile, 3rem+ en desktop).
- Los retratos de fundadores y avatares siempre circulares.

**DON'T**
- No usar el gradiente cósmico como fondo de secciones completas.
- No mezclar el dorado con acentos que no sean Capital.
- No introducir tipografías nuevas sin actualizar este documento.
- No repetir el nombre "Punto Cero" en la navegación pública (usar palabras naturales: Inicio, Noticias, Videos…). La marca vive en el logo y productos específicos (Punto Cero Legal, Punto Cero Capital).
- No usar tarjetas rectangulares idénticas repetidas — variar tamaños, radios y acentos.

---

## 6. Espaciado y radios

| Token | Valor | Uso |
|---|---|---|
| `--pc-radius-sm` | 10px | Chips, badges, botones pequeños |
| `--pc-radius` | 16px | Cards, widgets, feed items |
| `--pc-radius-lg` | 24px | Hero cards, contenedores grandes |
| Pill button | 100px | CTAs, chips |

Espaciado interno estándar en cards: `padding: 1rem 1.15rem`. Feed / community grid: `gap: 1rem` entre items.

---

## 7. Sombras y elevación

```css
--pc-shadow-card:  0 4px 20px rgba(11,31,58,0.04);
--pc-shadow-hover: 0 12px 40px rgba(11,31,58,0.08);
```

Sobre fondos oscuros: usar `box-shadow: 0 0 0 1px rgba(255,255,255,0.06)` + glow radial en color de la vertical.

---

## 8. Tamaños mínimos

- Botones táctiles: 44×44 px (WCAG 2.5.5)
- Icono en nav: 20 px
- Icono en widget: 16 px
- Avatar circular mínimo: 26 px (chips), estándar 40 px, hero 60 px+
- Font-size mínimo: 0.62 rem (labels) · 0.78 rem (interacciones)

---

## 9. Versiones responsivas

### Breakpoints oficiales
| Rango | Comportamiento |
|---|---|
| < 640 px | 1 columna, hamburger menu, iconos apilados |
| 640 – 900 px | Feed sin sidebars, header compacto |
| 900 – 1200 px | Feed + right widgets (sin left sidebar) |
| ≥ 1200 px | 3 columnas full (260 · feed · 320) |

### Reglas globales (`index.css`)
- `html, body { overflow-x: clip }`
- `img, video, svg { max-width: 100%; height: auto }`
- Media queries defensivas colapsan grids `1fr 1fr` y `minmax(≥280px)` a 1 columna en mobile.

---

## 10. Adaptaciones por canal

| Canal | Formato recomendado |
|---|---|
| **Web / App** | Logo full + AppIcons por sección; Space Grotesk + Inter |
| **Móvil (icon)** | Logo compact (círculo) 1024×1024 con fondo negro cósmico |
| **Favicon** | Logo compact 32×32 y 16×16 (PNG) |
| **Redes sociales** | Logo compact centrado sobre fondo `#0A0F1C` — 1080×1080 avatar; portada 1500×500 con gradiente cósmico |
| **Documentos oficiales** | Logo full a la izquierda, tagline "TODO EMPIEZA AQUÍ" opcional |
| **Slides / Pitch Deck** | Wordmark blanco sobre navy, evitando repetición en cada slide |

---

## 11. Extensión del sistema

Cuando se agregue una nueva aplicación al ecosistema:

1. Reservar un **color** de la paleta (o añadir uno consistente con la familia).
2. Definir un **glyph** de 24×24 dentro del anillo circular estándar.
3. Añadir la entrada al `APP_MAP` en `AppIcon.jsx`.
4. Definir el nombre público **natural** (no "Punto Cero X" en la nav pública, salvo que sea un producto/marca).
5. Documentar el color y el glyph en este archivo.

**Ejemplo de nueva app:**
```js
// AppIcon.jsx — APP_MAP entry
newApp: {
  ring: '#XXXXXX',
  glyph: (<path d="…" strokeLinecap="round" />)
}
```

---

## 12. Referencias rápidas de archivos

| Archivo | Responsabilidad |
|---|---|
| `/frontend/src/components/BrandMark.jsx` | Logo maestro reutilizable |
| `/frontend/src/components/community/AppIcon.jsx` | Familia de iconografía |
| `/frontend/src/index.css` | Design tokens + responsive foundations |
| `/frontend/public/index.html` | Favicon + apple-touch-icon + title |
| `/frontend/src/components/community/*` | Layout LinkedIn-style (sidebar, widgets, feed) |
| `/frontend/src/components/SlideCarousel.jsx` | Slider genérico reutilizable |
| `/frontend/src/pages/CapitalHubPage.jsx` | Hub 💎 Capital (Investor Center) |

---

*Este documento evoluciona con el ecosistema. Cada cambio de identidad, color o iconografía debe reflejarse aquí antes de implementarse en código.*
