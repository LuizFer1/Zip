# Planejamento - Funcionalidades Restantes (Event Sourcing Assinado + Clean Architecture)

## 1 Diagnostico Atual do Codigo

Status geral:
- Parcialmente implementado para event sourcing.
- Funciona para persistencia basica, mas ainda sem garantir todos os invariantes criptograficos e de arquitetura.

Ja existe:
- `EventSerializer` com serializacao e canonicalizacao.
- `EventSigner` com Ed25519.
- `EventValidator` com validacao estrutural e de payload.
- `EventService` e `EventStore` funcionais.
- `IdentityService` com geracao de chave e persistencia local.

Principais lacunas encontradas:
- Acoplamento forte entre camada de aplicacao e Prisma.
- `EventStore` concreto dentro de `core/protocol` (dominio conhece infraestrutura).
- Fluxos de IPC ainda escrevem eventos direto via Prisma, pulando Service/Factory.
- Hash de encadeamento calculado com bytes incluindo assinatura (inconsistente com regra proposta).
- Assinatura nao obrigatoria em todos os fluxos.
- Falta de `PrismaEventStore` + `EventMapper`.
- Tipagem de identidade ainda fraca (`any`) e sem mapper de `null` -> `undefined`.
- Diversos modulos planejados estao vazios (network/replication/channel/crypto/storage).

## 2) Gaps Criticos por Prioridade

P0 (bloqueia requisitos de integridade e arquitetura):
- Garantir append-only real para eventos (remover operacoes de delete da porta principal).
- Tornar assinatura obrigatoria em `publish` e validacao obrigatoria em ingestao externa.
- Corrigir regra de hash chain para usar canonical sem assinatura.
- Criar porta de dominio `EventStorePort` e mover Prisma para implementacao de infraestrutura.
- Parar de gravar eventos direto em `main.ts` com `prisma.event.create`.

P1 (consistencia de dominio e seguranca):
- Introduzir `EventMapper` (infra) para mapear `Event <-> Prisma`.
- Introduzir mapper de identidade com normalizacao `string | null` (infra) para `string | undefined` (dominio).
- Corrigir tipagem de identidade (`any` -> tipos explicitos).
- Corrigir fluxo de chave privada criptografada para assinatura sem vazar dados para camada de UI.

P2 (evolucao para replicacao distribuida):
- Implementar validacoes de cadeia (`prev.id/hash`) por canal na ingestao externa.
- Implementar deteccao de duplicidade/ordem e estrategia para forks.
- Implementar servicos de `heads`, `sync`, `gossip`, `presence`, `peer`.

## 3) Plano em Fases

### Fase 1 - Contratos de Dominio e Limites de Camada

Objetivo:
- Separar claramente dominio/aplicacao/infra sem quebrar funcionalidade atual.

Entregas:
- Criar `EventStorePort` no dominio:
  - `append(event: Event): Promise<void>`
  - `getChannelEvents(channelId: string): Promise<Event[]>`
  - `getLast(channelId: string): Promise<Event | null>`
  - `exists(id: string): Promise<boolean>`
- Criar `IdentityStorePort` e `IdentityKeyVaultPort` no dominio.
- Remover import de Prisma dos modulos de dominio/aplicacao.

Criterios de aceite:
- Nenhum arquivo de dominio importa `@prisma/client`.
- `EventService` depende somente de interfaces.

### Fase 2 - PrismaEventStore + EventMapper

Objetivo:
- Implementar adaptador de persistencia sem vazar Prisma para dominio.

Entregas:
- Criar `PrismaEventStore implements EventStorePort`.
- Criar `EventMapper` (infra):
  - `toPersistence(event: Event)`
  - `toDomain(row: Prisma.Event...)`
  - normalizacao robusta de `prev`.
- Criar `IdentityMapper`:
  - DB (`string | null`) -> dominio (`string | undefined`) quando aplicavel.
- Integrar repositorios concretos no bootstrap da aplicacao.

Criterios de aceite:
- `EventService` funciona sem conhecer Prisma.
- `main.ts` nao usa `prisma.event.*` diretamente.

### Fase 3 - Factory e Service com Invariantes Criptograficos

Objetivo:
- Centralizar criacao/assinatura/validacao no fluxo correto.

Entregas:
- Refatorar `EventFactory` para fluxo unico:
  - serializar payload
  - montar evento base com `prev` correto
  - calcular hash do anterior com canonical sem assinatura
  - assinar evento
  - validar evento final
- Refatorar `EventService` para expor:
  - `publish(...)`
  - `history(channelId)`
  - `getLastEvent(channelId)`
  - `publishWithPrev(event)`
  - `validateExternalEvent(event)`
- Tornar assinatura obrigatoria para eventos locais.
- Em ingestao externa, recusar evento sem assinatura valida.

Criterios de aceite:
- Todo evento persistido passa por assinatura + validacao.
- `prev.hash` corresponde ao hash do evento anterior no canal.

### Fase 4 - Integracao com IdentityService (sem vazamento de privateKey)

Objetivo:
- Assinar eventos com chave local sem expor segredo.

Entregas:
- Introduzir servico de chave local para:
  - buscar chave privada criptografada
  - decriptar em memoria no momento da assinatura
  - devolver `Uint8Array` apenas internamente
- Nao retornar `privateKey` em DTOs expostos para IPC/UI.
- Ajustar contrato de `Identity` para tipos estritos.
- Padronizar `publicKey` em hex string no dominio.

Criterios de aceite:
- UI e IPC nunca recebem `privateKey`.
- Assinatura local funciona usando chave armazenada criptografada.

### Fase 5 - Integracao no Main/IPC e Eliminacao de Atalhos

Objetivo:
- Usar apenas application services para casos de uso.

Entregas:
- Substituir chamadas diretas `prisma.event.create/findMany` em `main.ts` por:
  - `EventService.publish`
  - `EventService.history`
  - builders de estado derivados (mensagens/canais)
- Garantir que `channel:create` e `message:send` gerem eventos assinados.
- Garantir que leitura de mensagens use reconstituicao por eventos validados.

Criterios de aceite:
- `main.ts` orquestra casos de uso; nao implementa regra de dominio.

### Fase 6 - Testes, Observabilidade e Hardening

Objetivo:
- Reduzir regressao e preparar replicacao.

Entregas:
- Testes unitarios:
  - serializer deterministico
  - signer sign/verify
  - validator por tipo de evento
  - factory (ordem hash -> assinatura -> validacao)
- Testes de integracao:
  - `PrismaEventStore` append/getLast/history
  - cadeia de eventos valida/invalida
- Logs estruturados para falhas de validacao/assinatura.

Criterios de aceite:
- Pipeline de build com testes automatizados.
- Cobertura minima dos componentes criticos de protocolo.

## 4) Backlog Tecnico Objetivo (Checklist)

- [ ] Criar `EventStorePort` no dominio.
- [ ] Implementar `PrismaEventStore` em `infrastructure`.
- [ ] Criar `EventMapper`.
- [ ] Criar `IdentityMapper` com regra `null <-> undefined`.
- [ ] Refatorar `EventService` para usar portas.
- [ ] Refatorar `EventFactory` para assinatura obrigatoria e validacao final.
- [ ] Corrigir hash chain para canonical sem assinatura.
- [ ] Integrar assinatura com chave local criptografada (sem vazamento).
- [ ] Remover acesso direto ao Prisma de `main.ts` para eventos.
- [ ] Implementar testes unitarios e integracao do protocolo.
- [ ] Renomear artefatos com typo (`indentity`, `event.sing.ts`, `chanel.repository.ts`).
- [ ] Implementar modulos vazios de rede/replicacao por prioridade.

## 5) Ordem Recomendada de PRs

1. PR-01: Portas de dominio + ajustes de tipagem.
2. PR-02: `EventMapper` + `PrismaEventStore`.
3. PR-03: Refactor `EventFactory`/`EventService` com invariantes criptograficos.
4. PR-04: Integracao Identity para assinatura segura.
5. PR-05: Migracao de `main.ts` para application services.
6. PR-06: Testes automatizados + hardening.
7. PR-07: Replicacao e servicos de rede.

## 6) Riscos e Mitigacoes

Risco:
- Quebra de compatibilidade com eventos antigos no campo `prev`.

Mitigacao:
- Implementar parser retrocompativel temporario no mapper.
- Escrever migracao de normalizacao para formato unico de `prev`.

Risco:
- Assinatura falhar por divergencia de representacao de payload.

Mitigacao:
- Usar exclusivamente `EventSerializer.canonicalBytes` para sign/verify/hash.
- Cobrir com testes fixos de snapshot binario.

Risco:
- Vazamento acidental de chave privada via DTO.

Mitigacao:
- Separar tipos `IdentityInternal` e `IdentityPublic`.
- Revisar contratos de IPC com testes.

## 7) Definicao de Pronto (DoD) Final

Considerar a etapa "event sourcing assinado" concluida somente quando:
- Todo evento novo e assinado e validado antes de persistir.
- Toda ingestao externa valida assinatura + cadeia.
- `EventService` nao depende de Prisma.
- `PrismaEventStore` + mappers isolam totalmente a infraestrutura.
- `privateKey` nao vaza para UI/IPC.
- Existe suite minima de testes automatizados para serializer/hash/signer/validator/store/service.
