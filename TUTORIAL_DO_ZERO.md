# Tutorial Completo: Construindo um App WebRTC Offline com Next.js e LiveKit do Zero

Bem-vindo a este guia passo a passo! Aqui você aprenderá a criar, do absoluto zero, um sistema de videoconferência robusto focado em operar **totalmente offline** em uma rede local (LAN).

Esta aplicação resolve um grande problema técnico: **Navegadores móveis exigem HTTPS para liberar o uso da câmera/microfone**, mas servidores de desenvolvimento locais (como o `npm run dev` padrão do Next.js) rodam apenas em HTTP. Resolveremos isso criando um túnel seguro (Proxy HTTPS) conectando o Next.js ao poderoso motor do LiveKit.

---

## 🛠️ Pré-requisitos
Antes de começar, garanta que você tem na sua máquina:
1. **Node.js** instalado (versão 18+).
2. O executável do **LiveKit Server** para o seu sistema (baixe do repositório oficial no GitHub e deixe o arquivo `livekit-server.exe` salvo em uma pasta).

---

## Passo 1: Inicializando o Projeto Next.js

Abra o seu terminal na pasta onde deseja criar o projeto e execute o comando de criação do Next.js. Iremos usar o `App Router` padrão:

```bash
npx create-next-app@latest livekit-local-poc --js --eslint --no-tailwind --no-src-dir --app --import-alias "@/*"
```
*(Durante a instalação, diga "Não" para TypeScript, TailwindCSS e diretório src caso o instalador pergunte, para manter as coisas super simples).*

Entre na pasta do projeto:
```bash
cd livekit-local-poc
```

---

## Passo 2: Instalando as Dependências Essenciais

Nossa arquitetura precisa do SDK de Servidor (para gerar chaves), SDK de Cliente (para a tela), Proxy e gerador de certificados HTTPS. Rode o seguinte comando:

```bash
npm install @livekit/components-react @livekit/components-styles livekit-client livekit-server-sdk http-proxy selfsigned qrcode-terminal
```

---

## Passo 3: Configuração das Chaves de Ambiente

O LiveKit no modo desenvolvedor usa senhas padrão. Precisamos informar nosso Next.js sobre elas. 
Crie um arquivo chamado `.env.local` na raiz do projeto e cole o seguinte:

```env
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
# Esta flag abaixo desabilita a coleta de dados do Next.js para evitar que o servidor trave silenciosamente no fundo
NEXT_TELEMETRY_DISABLED=1
```

---

## Passo 4: Construindo o Servidor Customizado (A "Mágica" do HTTPS Local)

Não podemos usar o servidor padrão do Next.js. Precisamos de um que:
1. Gere certificados de segurança "Fakes" (HTTPS) para enganar o navegador do celular e destravar a Câmera.
2. Faça um "Proxy" (ponte invisível) encaminhando os pacotes de vídeo da tela (que está em HTTPS) para o servidor do LiveKit (que roda de forma insegura HTTP em background).
3. Mostre um QR Code na tela.

Crie o arquivo `server.js` na **raiz** do projeto e insira o seguinte código:

```javascript
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');
const os = require('os');
const qrcode = require('qrcode-terminal');

// Captura seu IP local (192.168.x.x)
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const port = 3000;
const app = next({ dev: true, hostname: '0.0.0.0', port });
const handle = app.getRequestHandler();

// Criação do Túnel/Proxy para o LiveKit (que rodará na porta 7880)
const proxy = httpProxy.createProxyServer({ target: 'http://127.0.0.1:7880', ws: true });

async function getOrGenerateCerts() {
  const keyPath = path.join(__dirname, 'localhost-key.pem');
  const certPath = path.join(__dirname, 'localhost.pem');

  if (fs.existsSync(keyPath)) return { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) };

  const selfsigned = require('selfsigned');
  const pems = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], { days: 365, keySize: 2048 });
  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  
  return { key: pems.private, cert: pems.cert };
}

(async () => {
  const httpsOptions = await getOrGenerateCerts();
  
  app.prepare().then(() => {
    const server = createServer(httpsOptions, async (req, res) => {
      const parsedUrl = parse(req.url, true);
      // Se a URL contém /livekit, manda pro servidor WebRTC
      if (parsedUrl.pathname.startsWith('/livekit')) {
        req.url = req.url.replace(/^\/livekit/, '');
        return proxy.web(req, res);
      }
      await handle(req, res, parsedUrl);
    });

    server.on('upgrade', (req, socket, head) => {
      const parsedUrl = parse(req.url, true);
      if (parsedUrl.pathname.startsWith('/livekit')) {
        req.url = req.url.replace(/^\/livekit/, '');
        proxy.ws(req, socket, head);
      }
    });

    server.listen(port, '0.0.0.0', () => {
        const lanUrl = `https://${getLocalIp()}:${port}`;
        console.log('Escaneie com a câmera do celular para testar:');
        qrcode.generate(lanUrl, { small: true });
    });
  });
})();
```

**ATENÇÃO:** Agora, abra o seu arquivo `package.json` e modifique a sessão "scripts" para avisar o Node para usar esse novo servidor:
```json
"scripts": {
  "dev": "node server.js",
  ...
}
```

---

## Passo 5: Criando o Backend de Permissões (API)

No LiveKit, a interface web não entra em uma sala sozinha. Ela pede um "Ticket" (Token JWT) ao servidor.

Crie a pasta `app/api/token/` e dentro dela um arquivo chamado `route.js`:

```javascript
import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { roomName, participantName } = await req.json();

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  // Monta o passaporte de acesso à sala
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: participantName,
  });

  // Permite que ele entre e fale
  at.addGrant({ roomJoin: true, room: roomName });

  const token = await at.toJwt();
  return NextResponse.json({ token });
}
```

---

## Passo 6: Construindo a Interface Frontend Visual

Abra o arquivo `app/page.js`, apague tudo o que está lá dentro e insira a nossa interface. Nós precisamos criar duas "Lentes" ou "Telas": uma para o Guia (que só recebe imagens) e uma pro Operador (que só manda imagens).

```javascript
"use client";

import { useState, useEffect } from 'react';
import { LiveKitRoom, RoomAudioRenderer, GridLayout, ParticipantTile, DisconnectButton, useTracks, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

// Componente do Guia (Só vê os outros, tira seu próprio espaço inútil da tela)
function GuideView() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }])
    .filter((t) => !t.participant.isLocal); // Regra de Ouro: Esconde o usuário atual

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#111' }}>
      <GridLayout tracks={tracks} style={{ flex: 1 }}><ParticipantTile /></GridLayout>
      <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#222' }}><DisconnectButton>Encerrar</DisconnectButton></div>
    </div>
  );
}

// Componente do Operador (Só vê a si mesmo para garantir a mira da câmera)
function OperatorView() {
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: false }])
    .filter((t) => t.participant.identity === localParticipant.identity); // Filtra só ele mesmo

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: '#111' }}>
      <GridLayout tracks={tracks} style={{ flex: 1 }}><ParticipantTile /></GridLayout>
      <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#222' }}><DisconnectButton>Encerrar</DisconnectButton></div>
    </div>
  );
}

// A Página Principal em si (Lobby de entrada)
export default function Home() {
  const [roomName, setRoomName] = useState('Sala1');
  const [role, setRole] = useState('operator');
  const [token, setToken] = useState('');
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    // Aponta o WebRTC para a própria página de onde acessamos (celular ou PC) graças ao proxy do passo 4!
    setServerUrl(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit`);
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    const participantName = `${role}-${Math.floor(Math.random() * 10000)}`;

    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName, participantName }),
    });
    const data = await res.json();
    setToken(data.token); // Isso trigga a renderização da câmera!
  };

  if (token && serverUrl) {
    // Configura "environment" (câmera traseira) apenas para Operadores
    const cameraSettings = role === 'operator' ? { facingMode: 'environment' } : false;

    return (
      <LiveKitRoom video={cameraSettings} audio={true} token={token} serverUrl={serverUrl} onDisconnected={() => setToken('')}>
        {role === 'operator' ? <OperatorView /> : <GuideView />}
        <RoomAudioRenderer />
      </LiveKitRoom>
    );
  }

  return (
    <form onSubmit={handleJoin} style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px', margin: '0 auto', marginTop: '20vh' }}>
      <h2>WebRTC Offline</h2>
      <label>Papel:</label>
      <select value={role} onChange={e => setRole(e.target.value)}>
        <option value="operator">Operator (Câmera Traseira Ativa)</option>
        <option value="guide">Guide (Somente Assiste)</option>
      </select>
      <button type="submit">Entrar</button>
    </form>
  );
}
```

*Nota: Para um estilo melhor do Body Global, recomendo colocar o arquivo `app/globals.css` com a tag `body { margin: 0; background-color: #f0f2f5; font-family: sans-serif; }`*

---

## Passo 7: Botando para Rodar!

Agora você tem todos os ingredientes. Siga o roteiro de execução final:

1. Vá no arquivo ou pasta onde está o executável do LiveKit (aquele do Pré-requisito 2). Abra um terminal nele e rode:
   ```bash
   .\livekit-server.exe --dev
   ```
2. Abra outro terminal dentro da nossa pasta Next.js e rode:
   ```bash
   npm run dev
   ```
3. O terminal gerará um QR Code. Pegue seu celular (conectado ao mesmo Roteador/Wi-Fi que o PC).
4. Escaneie. Quando aparecer a tela vermelha de perigo do navegador, confie (Avançado -> Ir para página insegura).
5. Escolha Operator no celular e Guide no PC! E a mágica da rede local acontece.
