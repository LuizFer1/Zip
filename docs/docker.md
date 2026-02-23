# Docker

## Build

```bash
docker compose build
```

## Run

```bash
docker compose up -d
```

O app roda em container Linux com Electron em modo headless via `xvfb`.

## Logs

```bash
docker compose logs -f zip
```

## Stop

```bash
docker compose down
```

## Conectar em peers (seed)

Defina `ZIP_P2P_SEEDS` ao subir o container:

```bash
ZIP_P2P_SEEDS=ip-ou-host:porta docker compose up -d
```

Exemplo:

```bash
ZIP_P2P_SEEDS=203.0.113.10:7070 docker compose up -d
```
