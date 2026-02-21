# Paleta de cores - Zip UI

Este documento define os tokens usados na interface da home de chat.

## Cores base

| Token | Hex | Uso principal |
| --- | --- | --- |
| `--bg-0` | `#060d18` | fundo mais escuro |
| `--bg-1` | `#0e1828` | fundo secundario |
| `--bg-2` | `#18263c` | superficies de apoio |
| `--bg-3` | `#253753` | profundidade e contrastes |
| `--panel-soft` | `rgba(14, 24, 40, 0.84)` | cards com blur |
| `--panel-strong` | `rgba(9, 16, 27, 0.94)` | cards com maior densidade |
| `--border` | `#2d4565` | bordas e separadores |

## Texto

| Token | Hex | Uso principal |
| --- | --- | --- |
| `--text-main` | `#edf5ff` | texto de destaque |
| `--text-soft` | `#c3d5ea` | texto padrao |
| `--text-faint` | `#87a1bf` | texto auxiliar |

## Acentos

| Token | Hex | Uso principal |
| --- | --- | --- |
| `--accent-cyan` | `#25d0d1` | destaque principal |
| `--accent-blue` | `#53a7ff` | botoes e gradientes |
| `--accent-green` | `#8ce4af` | status online |
| `--accent-amber` | `#ffbf66` | acao secundaria |
| `--accent-red` | `#ff7d8e` | status ocupado/alerta |

## Gradiente recomendado

- `linear-gradient(130deg, rgba(8, 16, 30, 0.92), rgba(10, 19, 33, 0.86))`
- `linear-gradient(130deg, var(--accent-blue), var(--accent-cyan))`

## Boas praticas

- usar `--accent-cyan` para foco ativo em navegacao e listas.
- reservar `--accent-blue` para CTA e envio de mensagem.
- manter `--accent-red` apenas para estados de alerta.
- preferir `--text-faint` para meta-informacao e timestamps.
