Zip - Plataforma de Comunicação P2P

Copyright (C) 2026 Luiz Fernando Dantas

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
See the GNU Affero General Public License for more details.

Source code available at:
https://github.com/LuizFer1/zip

🚀 Zip

Zip é uma plataforma de comunicação desktop descentralizada, com arquitetura P2P, hierarquia de permissões e backup opcional em nuvem.

O objetivo do Zip é oferecer uma alternativa autônoma e privada a plataformas centralizadas como o Discord, permitindo que comunidades controlem seus próprios dados e infraestrutura.

✨ Principais Características

🖥 Aplicativo desktop (Electron)

🌐 Rede P2P entre usuários

💬 Canais de texto

🎧 Chamadas de voz via WebRTC

🌱 Sistema de seeds (continua funcionando sem host original)

🔐 Identidade baseada em criptografia (chave pública/privada)

🛡 Hierarquia de permissões assinada criptograficamente

☁️ Backup opcional em nuvem (modelo de monetização)

🧠 Filosofia do Projeto

Zip é:

Descentralizado por padrão

Autônomo (cada comunidade pode existir sem servidor central obrigatório)

Privado (controle local dos dados)

Extensível

A nuvem é opcional e usada apenas para:

Backup

Relay

Estabilidade extra

🏗 Arquitetura
📦 Desktop

Electron

🌐 Comunicação

P2P via WebRTC (DataChannel + Media)

🗄 Banco Local

SQLite

🔐 Segurança

Identidade baseada em chave pública

Mensagens assinadas

Permissões assinadas pelo Admin

Verificação de integridade distribuída

🌱 Como Funciona

Um usuário cria um servidor Zip.

Outros usuários entram via convite.

Todos os peers replicam mensagens.

Seeds mantêm o servidor ativo mesmo que o criador saia.

Permissões são validadas criptograficamente.

Se ativado, o backup em nuvem sincroniza os dados.

🎯 Objetivo

Construir uma plataforma intermediária entre:

Sistemas totalmente centralizados

Protocolos complexos estilo blockchain

Zip busca equilíbrio entre:

Simplicidade

Autonomia

Funcionalidade real

🚧 Status

Em desenvolvimento ativo.

Roadmap inclui:

Chat P2P

Sistema de seeds

Hierarquia assinada

Voz em grupo

Backup cloud opcional

🤝 Contribuição

Contribuições são bem-vindas.

Se você gosta de:

Sistemas distribuídos

P2P

Criptografia aplicada

Arquitetura descentralizada

Este projeto é para você.

📜 Licença

A definir.
