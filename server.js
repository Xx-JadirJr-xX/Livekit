const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');
const os = require('os');
const qrcode = require('qrcode-terminal');
const { spawn } = require('child_process');

// Função auxiliar para pegar o IP da rede local
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0'; // Escuta em todas as interfaces de rede (LAN)
const port = 3000;

// Inicializa o Next.js
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Cria um proxy para o WebSocket do LiveKit
const proxy = httpProxy.createProxyServer({
  target: 'http://127.0.0.1:7880',
  ws: true,
});

proxy.on('error', (err, req, res) => {
  console.error('Erro no proxy do LiveKit:', err);
});

async function getOrGenerateCerts() {
  const keyPath = path.join(__dirname, 'localhost-key.pem');
  const certPath = path.join(__dirname, 'localhost.pem');

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath),
    };
  }

  console.log('> Gerando certificados HTTPS auto-assinados automaticamente...');
  const selfsigned = require('selfsigned');
  // Usamos localhost e o IP 0.0.0.0 como common name provisório,
  // pois para rodar localmente basta que o contexto seja https (mesmo com aviso do browser)
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = await selfsigned.generate(attrs, { days: 365, keySize: 2048 });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  
  return {
    key: pems.private,
    cert: pems.cert
  };
}

function startLiveKitServer() {
  const exePath = path.join(__dirname, 'livekit-server.exe');

  if (!fs.existsSync(exePath)) {
    console.error('\n⚠️ ERRO: O arquivo "livekit-server.exe" não foi encontrado na raiz do projeto!\n');
    process.exit(1);
  }

  const livekitProcess = spawn(exePath, ['--dev']);

  livekitProcess.stderr.on('data', (data) => {
    console.error(`[LiveKit Falhou ao Iniciar]: ${data.toString().trim()}`);
  });

  process.on('exit', () => livekitProcess.kill());
  process.on('SIGINT', () => {
    livekitProcess.kill();
    process.exit();
  });
}

(async () => {
  startLiveKitServer();

  const httpsOptions = await getOrGenerateCerts();
  console.log('> Iniciando e compilando Next.js (isso pode demorar 1 ou 2 minutos na primeira execução)...');
  
  app.prepare().then(() => {
    const server = createServer(httpsOptions, async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        
        // Intercepta e faz proxy de qualquer requisição para /livekit para o servidor LiveKit dev local
        if (parsedUrl.pathname.startsWith('/livekit')) {
          req.url = req.url.replace(/^\/livekit/, ''); // Remove /livekit da URL antes de repassar
          proxy.web(req, res);
          return;
        }

        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Erro ao processar requisição', req.url, err);
        res.statusCode = 500;
        res.end('Erro interno do servidor');
      }
    });

    // Proxy também para upgrades WebSocket (essencial para WebRTC/LiveKit)
    server.on('upgrade', (req, socket, head) => {
      const parsedUrl = parse(req.url, true);
      if (parsedUrl.pathname.startsWith('/livekit')) {
        req.url = req.url.replace(/^\/livekit/, '');
        proxy.ws(req, socket, head);
      }
    });

    server.once('error', (err) => {
        console.error(err);
        process.exit(1);
      })
      .listen(port, hostname, () => {
        const localIp = getLocalIp();
        const lanUrl = `https://${localIp}:${port}`;

        console.log('\n=============================================');
        console.log(`> Servidor WebRTC Local rodando com sucesso!`);
        console.log(`> Acesso local: https://localhost:${port}`);
        console.log(`> Acesso via Wi-Fi: ${lanUrl}`);
        console.log('> Proxy LiveKit: Habilitado');
        console.log('=============================================\n');
        console.log('Escaneie o QR Code abaixo com a câmera do celular para entrar na sala:\n');
        
        qrcode.generate(lanUrl, { small: true });
      });
  });
})();