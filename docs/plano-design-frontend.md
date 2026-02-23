# Plano de design do frontend

## 1. Objetivo
Criar uma nova interface para o Zip com foco em:
- fluxo de chat rapido;
- estados de rede P2P claros;
- base visual consistente para evolucao futura.

## 2. Escopo do MVP (primeira entrega)
- Tela de identidade (criar/ver perfil local).
- Lista de canais.
- Area de mensagens.
- Status de conexao P2P (conectado/desconectado/peers).

## 3. Sistema visual
- Definir tokens em um arquivo unico: cor, tipografia, espacamento, raio, sombra.
- Definir grade de layout desktop + mobile.
- Definir componentes base: botao, input, card, badge, lista, modal.
- Definir estados: hover, foco, loading, erro, vazio.

## 4. Fluxos e wireframes
- Wireframe de baixa fidelidade para os 4 fluxos do MVP.
- Validacao rapida com checklist de usabilidade (5 minutos por fluxo).
- Versao de media fidelidade com regras de responsividade.

## 5. Implementacao tecnica
- Escolher stack visual (CSS puro, Tailwind ou outro) e padronizar.
- Criar estrutura de pastas por dominio (`identity`, `channels`, `messages`, `network`).
- Reaproveitar IPC existente para ligar UI ao backend.
- Implementar tela por tela com feature flags simples.

## 6. Qualidade
- Checklist visual por breakpoint (mobile/tablet/desktop).
- Checklist de acessibilidade minima (contraste, foco visivel, navegacao por teclado).
- Testes de smoke de renderizacao e fluxo principal.

## 7. Sequencia sugerida (10 dias uteis)
1. Dia 1-2: tokens, layout base, componentes.
2. Dia 3-4: identidade + canais.
3. Dia 5-6: mensagens.
4. Dia 7: status P2P.
5. Dia 8: responsividade e acessibilidade.
6. Dia 9: polimento visual e estados de erro/vazio.
7. Dia 10: testes finais e ajuste de detalhes.
