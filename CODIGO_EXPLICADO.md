# Explicação do Código Passo a Passo

Este documento detalha o funcionamento de cada parte da Prova de Conceito (PoC) da nossa aplicação de videoconferência WebRTC offline.

## 1. O Servidor Customizado (`server.js`)

O arquivo `server.js` é o coração da nossa arquitetura local. Ele substitui o servidor de desenvolvimento padrão do Next.js (`next dev`) para adicionar três funcionalidades cruciais que permitem o teste via rede local (LAN): HTTPS, Proxy de WebSocket e Geração de QR Code.

### Passo a passo do `server.js`:
1. **Bibliotecas Necessárias**: Importamos módulos nativos do Node (`https`, `fs`, `os`, `path`) e bibliotecas externas como `http-proxy` (para redirecionar o tráfego do LiveKit) e `qrcode-terminal` (para facilitar o teste no celular).
2. **Descoberta do IP Local**: A função `getLocalIp()` varre as interfaces de rede do computador (ex: Wi-Fi ou Ethernet) buscando um endereço IPv4 válido que não seja interno (como 127.0.0.1). Isso é usado para descobrir o seu IP (ex: 192.168.0.15) e gerar o link correto para o celular.
3. **Proxy do LiveKit**: Instanciamos o `httpProxy`. Todo o tráfego que o nosso servidor Next.js receber na rota específica `/livekit` será interceptado e redirecionado para a porta onde o servidor de desenvolvimento do LiveKit está rodando localmente (`http://127.0.0.1:7880`), incluindo conexões e upgrades contínuos de WebSocket (`ws: true`). Isso resolve o bloqueio rigoroso de "Mixed Content" imposto por navegadores de celular, pois o dispositivo final se conecta apenas ao nosso túnel HTTPS seguro sem perceber que o LiveKit roda de forma insegura no background.
4. **Geração de Certificados**: A função `getOrGenerateCerts()` verifica se os certificados SSL existem na raiz do projeto. Se não existirem, ela utiliza a biblioteca `selfsigned` para gerá-los automaticamente na hora. Sem o protocolo HTTPS, o WebRTC bloquearia o acesso à câmera e ao microfone via Wi-Fi.
5. **Interceptação de Requisições**: Dentro do `createServer`, verificamos a URL de cada acesso:
   - Se começa com `/livekit`, usamos o proxy com `proxy.web()` e `proxy.ws()` para repassar pro servidor do LiveKit.
   - Caso contrário, passamos a requisição para o `handle` do Next.js renderizar a página React normalmente.
6. **QR Code**: No final da inicialização do servidor, geramos o link `https://<SEU_IP>:3000` na tela e utilizamos a biblioteca `qrcode-terminal` para criar uma imagem visível no prompt de comando.

---

## 2. API de Token (`app/api/token/route.js`)

O motor do LiveKit utiliza uma arquitetura baseada em tokens (JWT) para segurança e isolamento de salas. O frontend nunca deve entrar em uma sala diretamente ou possuir as chaves; ele precisa pedir um "ingresso assinado" pelo nosso backend.

### Passo a passo da API:
1. **Recepção de Dados**: A rota do backend no Next.js exporta uma função `POST`. Ela lê variáveis fundamentais como `roomName` (qual sala) e `participantName` (nome gerado aleatoriamente) a partir do corpo da requisição (`req.json()`).
2. **Leitura de Chaves Secretas**: O código acessa e valida as chaves de ambiente `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` configuradas previamente no arquivo `.env.local`. 
3. **Instanciação do Token**: Utiliza a classe especializada `AccessToken` fornecida pelo pacote oficial `livekit-server-sdk` e anexa a ela as permissões de acesso daquele usuário (como a tag de concessão `roomJoin: true` na sala específica selecionada no form).
4. **Assinatura Final**: Codifica tudo em um JWT utilizando criptografia e a chave secreta (`await at.toJwt()`) e retorna o token de sucesso para a tela de front end.

---

## 3. O Frontend (`app/page.js`)

Aqui se concentra toda a interface do usuário (UI) construída com React, lidando com a comunicação e exibição das câmeras em tempo real.

### Estrutura dos Componentes Customizados:
O pacote `@livekit/components-react` oferece muitos hooks poderosos. Nós os utilizamos para extrair comportamentos muito específicos (o Guide e o Operator).

- **`GuideView`**: É o componente renderizado quando você escolhe o papel "Guide" (Guia/Espectador). Ele utiliza o hook `useTracks` para monitorar todas as publicações de vídeo na sala, mas aplica a regra `.filter((t) => !t.participant.isLocal)` para impedir que uma tela cinza inútil referente a sua própria sessão ("já que o guide não envia vídeo") ocupe a interface, exibindo estritamente a visão dos Operadores conectados.
- **`OperatorView`**: Funciona de forma espelhada. O Operador possui um propósito unilateral, ele apenas exibe sua própria situação via streaming e não interage visualmente com guias. Assim, filtramos as conexões para mostrar apenas a câmera principal daquele dispositivo usando `t.participant.identity === localParticipant.identity`.
- **Botão de Encerrar Minimalista**: Ambos usam o botão vermelho simples `<DisconnectButton />`, cujo clique encerra as conexões de WebSockets ativas e limpa o estado, devolvendo a UI instantaneamente para o formulário.

### O Componente Principal (`Home`):
1. **Estados do React (`useState`)**: Mantemos em memória os campos como sala ativa (`roomName`), token de conexão (`token`), papel (`role`). Outro recurso vital é gerar o `serverUrl` dinâmico via `useEffect`, garantindo que ele busque os websockets sempre via `/livekit` sobre o mesmo domínio de origem (seja ele via IP pelo celular ou via localhost pelo computador base).
2. **Função Assíncrona `handleJoin`**: Assim que o formulário de login é submetido, o React interrompe o comportamento de form reload e realiza um `fetch()` no nosso back end `/api/token`. 
3. **A Sala ao Vivo (`<LiveKitRoom>`)**:
   - É o motor WebRTC instanciado de forma declarativa. 
   - A prop `video` é definida por `operatorVideoConfig`, que além de ativar a câmera apenas se você for "Operador", injeta o parâmetro especial `{ facingMode: 'environment' }`. Isso comunica nativamente à API de browsers móveis a prioridade de ignição da **Câmera Traseira**.
   - O componente `<RoomAudioRenderer />` corre de forma invisível gerenciando o processamento do fluxo contínuo bidirecional das vozes e microfones em tempo real por todo tempo.
