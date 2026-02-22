# Operacao e Release

## Multi-no local

Rodar seed:

```bash
npm run start:node1
```

Rodar segundo no:

```bash
npm run start:node2
```

Cada script usa:
- DB separado (`zip-node1.db` / `zip-node2.db`)
- Porta separada (`7070` / `7071`)
- `user-data-dir` separado no diretório temporario
- `nodeId` separado

## Troubleshooting rapido

1. Erro de ABI de `better-sqlite3`:

```bash
npm run rebuild:native:electron
```

2. Limpar estado local:

```bash
taskkill /IM electron.exe /F
```

Depois apague os bancos locais que deseja recriar (`zip-node1.db`, `zip-node2.db`).

3. Erro `P2021` (tabela ausente):
- O bootstrap automatico do DB roda no startup.
- Se necessário, valide o caminho do banco (`ZIP_DB_PATH` / `DATABASE_URL`).

## Observabilidade

Logs P2P agora sao estruturados em JSON com escopo `p2p.*`.

Campos de metricas emitidos periodicamente:
- `eventsBroadcast`
- `eventsIngested`
- `duplicateEventsIgnored`
- `ingestFailures`
- `syncRequestsSent`
- `syncRequestsReceived`
- `syncResponsesSent`
- `syncResponsesReceived`
- `syncEventsSent`
- `syncEventsIngested`
- `syncFailures`

## Testes

Core (Node):

```bash
npm run test:core
```

Integracao Prisma (Electron):

```bash
npm run test:electron
```

Suite completa:

```bash
npm test
```

## Empacotamento e release

Empacotar diretorio local:

```bash
npm run package:dir
```

Gerar instalador Windows (NSIS):

```bash
npm run package:win
```

Fluxo de preparacao de release:

```bash
npm run release:prepare
```
